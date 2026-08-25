import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";
import systemRoles from "../config/system-roles.json" with { type: "json" };

const { Pool } = pg;

export function deterministicId(prefix, value) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

export function parseArguments(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) throw new Error(`A value is required for ${flag ?? "each option"}.`);
    parsed[flag.slice(2)] = value.trim();
  }
  for (const name of ["organization-slug", "organization-name", "owner-email", "location-slug", "location-name", "application-url"]) if (!parsed[name]) throw new Error(`--${name} is required.`);
  if (!validSlug(parsed["organization-slug"])) throw new Error("Organization slug must use lowercase letters, numbers, and single hyphens.");
  if (!validSlug(parsed["location-slug"])) throw new Error("Location slug must use lowercase letters, numbers, and single hyphens.");
  if (!/^\S+@\S+\.\S+$/.test(parsed["owner-email"])) throw new Error("Owner email is invalid.");
  let applicationUrl;
  try { applicationUrl = new URL(parsed["application-url"]); } catch { throw new Error("Application URL is invalid."); }
  if (applicationUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(applicationUrl.hostname)) throw new Error("Application URL must use HTTPS outside localhost.");
  applicationUrl.pathname = "/"; applicationUrl.search = ""; applicationUrl.hash = "";
  const timezone = parsed.timezone || "America/New_York";
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new Error("Timezone must be a valid IANA timezone."); }
  return { organizationSlug: parsed["organization-slug"], organizationName: bounded(parsed["organization-name"], "Organization name", 200), ownerEmail: parsed["owner-email"].toLowerCase(), locationSlug: parsed["location-slug"], locationName: bounded(parsed["location-name"], "Location name", 200), timezone, applicationUrl: applicationUrl.origin };
}

export function buildProvisioningPlan(input) {
  const organizationId = deterministicId("org", input.organizationSlug);
  const configuration = {
    id: organizationId, slug: input.organizationSlug, vertical: "automotive",
    brand: { organizationName: input.organizationName, productName: "DealerFlow", colors: { primary: "#4f5fe7", secondary: "#e9ebf8", accent: "#dde2ff" } },
    features: { crm: true, inventory: true, finance: true, service: false, reporting: true, ai: true, customerPortal: false, dealerPortal: false },
    terminology: { item: "Vehicle", itemPlural: "Vehicles", itemIdentifier: "VIN", location: "Dealership", locationPlural: "Dealerships", inventoryUnit: "Inventory Unit" },
  };
  return { ...input, organizationId, configuration, configurationVersionId: deterministicId("ocv", `${organizationId}:initial`), locationId: deterministicId("loc", `${organizationId}:${input.locationSlug}`), invitationId: deterministicId("oin", `${organizationId}:initial-owner:${input.ownerEmail}`), roles: systemRoles.map(role => ({ ...role, id: deterministicId("rol", `${organizationId}:${role.key}`) })) };
}

export async function provisionTenant(pool, plan) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true),set_config('app.operator_provision','enabled',true)", [deterministicId("usr", "operator-provisioner"), plan.organizationId]);
    await client.query("INSERT INTO organizations(id,slug,name,vertical) VALUES($1,$2,$3,'automotive') ON CONFLICT(id) DO NOTHING", [plan.organizationId, plan.organizationSlug, plan.organizationName]);
    await requireExact(client, "SELECT id FROM organizations WHERE id=$1 AND slug=$2 AND name=$3 AND vertical='automotive' AND active=true", [plan.organizationId, plan.organizationSlug, plan.organizationName], "Organization identity conflicts with an existing tenant.");
    await client.query("WITH inserted AS (INSERT INTO organization_configurations(organization_id,product_name,brand,features,terminology,version) VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6) ON CONFLICT(organization_id) DO NOTHING RETURNING organization_id) INSERT INTO organization_configuration_versions(id,organization_id,configuration,change_kind,created_by) SELECT $7,inserted.organization_id,$8::jsonb,'update',NULL FROM inserted ON CONFLICT(id) DO NOTHING", [plan.organizationId, plan.configuration.brand.productName, JSON.stringify(plan.configuration.brand), JSON.stringify(plan.configuration.features), JSON.stringify(plan.configuration.terminology), randomUUID(), plan.configurationVersionId, JSON.stringify(plan.configuration)]);
    await client.query("INSERT INTO locations(id,organization_id,slug,name,timezone) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING", [plan.locationId, plan.organizationId, plan.locationSlug, plan.locationName, plan.timezone]);
    await requireExact(client, "SELECT id FROM locations WHERE organization_id=$1 AND id=$2 AND slug=$3 AND name=$4 AND timezone=$5 AND active=true", [plan.organizationId, plan.locationId, plan.locationSlug, plan.locationName, plan.timezone], "Location identity conflicts with an existing rooftop.");
    for (const role of plan.roles) await establishRole(client, plan.organizationId, role);
    const ownerRole = plan.roles.find(role => role.key === "owner");
    const token = `${plan.organizationId}.${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const inserted = await client.query("INSERT INTO organization_invitations(id,organization_id,email,token_hash,idempotency_key,all_locations,expires_at,invited_by) VALUES($1,$2,$3,$4,$5,true,$6,NULL) ON CONFLICT(organization_id,idempotency_key) DO NOTHING RETURNING id", [plan.invitationId, plan.organizationId, plan.ownerEmail, tokenHash, `operator-provision:${plan.organizationId}:owner`, expiresAt]);
    const created = Boolean(inserted.rows[0]);
    if (!created) await requireExact(client, "SELECT id FROM organization_invitations WHERE organization_id=$1 AND id=$2 AND lower(email)=lower($3) AND status='pending' AND expires_at>now() AND invited_by IS NULL", [plan.organizationId, plan.invitationId, plan.ownerEmail], "Initial Owner invitation conflicts with an existing or expired invitation.");
    if (created) {
      await client.query("INSERT INTO organization_invitation_roles(invitation_id,organization_id,role_id) VALUES($1,$2,$3)", [plan.invitationId, plan.organizationId, ownerRole.id]);
      await queueInvitation(client, plan, token);
    }
    await client.query("INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,new_values) VALUES($1,$2,NULL,'organization.provisioned','organization',$2,'operator',$3,$4::jsonb)", [`aud_${randomUUID().replaceAll("-", "")}`, plan.organizationId, `provision:${randomUUID()}`, JSON.stringify({ organizationSlug: plan.organizationSlug, locationId: plan.locationId, ownerInvitationId: plan.invitationId })]);
    await client.query("COMMIT");
    return { organizationId: plan.organizationId, locationId: plan.locationId, ownerInvitationId: plan.invitationId };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function establishRole(client, organizationId, role) {
  await client.query("INSERT INTO roles(id,organization_id,key,name,description,system) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(id) DO NOTHING", [role.id, organizationId, role.key, role.name, role.description]);
  await requireExact(client, "SELECT id FROM roles WHERE organization_id=$1 AND id=$2 AND key=$3 AND name=$4 AND system=true", [organizationId, role.id, role.key, role.name], `System role ${role.key} conflicts with an existing role.`);
  await client.query("INSERT INTO role_capabilities(role_id,organization_id,capability) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING", [role.id, organizationId, role.capabilities]);
  const grants = await client.query("SELECT capability FROM role_capabilities WHERE organization_id=$1 AND role_id=$2 ORDER BY capability", [organizationId, role.id]);
  if (grants.rows.map(row => row.capability).join("\n") !== [...role.capabilities].sort().join("\n")) throw new Error(`System role ${role.key} capability profile does not match this release.`);
}

async function queueInvitation(client, plan, token) {
  const url = new URL("/accept-invitation", plan.applicationUrl); url.searchParams.set("token", token);
  const text = `You have been invited to join ${plan.organizationName} in DealerFlow.\n\nAccept invitation: ${url}\n\nThis invitation expires in 7 days.`;
  const html = `<p>You have been invited to join <strong>${escapeHtml(plan.organizationName)}</strong> in DealerFlow.</p><p><a href="${escapeHtml(url.toString())}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`;
  await client.query("INSERT INTO transactional_email_messages(id,organization_id,invitation_id,kind,recipient_email,subject,text_body,html_body,idempotency_key) VALUES($1,$2,$3,'organization-invitation',$4,$5,$6,$7,$8)", [`tem_${randomUUID().replaceAll("-", "")}`, plan.organizationId, plan.invitationId, plan.ownerEmail, `Join ${plan.organizationName} in DealerFlow`, text, html, `organization-invitation:${plan.invitationId}`]);
}

async function requireExact(client, query, values, message) { if (!(await client.query(query, values)).rows[0]) throw new Error(message); }
function validSlug(value) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value); }
function bounded(value, label, maximum) { if (!value || value.length > maximum) throw new Error(`${label} must contain 1 to ${maximum} characters.`); return value; }
function escapeHtml(value) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim(); if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString: databaseUrl, ssl: ["staging", "production"].includes(process.env.APP_ENV || "development") ? { rejectUnauthorized: true } : undefined, max: 1, application_name: "dealerflow-provisioner" });
  try { process.stdout.write(`${JSON.stringify(await provisionTenant(pool, buildProvisioningPlan(parseArguments(process.argv.slice(2)))))}\n`); } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`Tenant provisioning failed: ${error instanceof Error ? error.message : "Unknown error"}\n`); process.exitCode = 1; });
