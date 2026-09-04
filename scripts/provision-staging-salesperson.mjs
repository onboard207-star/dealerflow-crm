import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const confirmation = "PROVISION-SYNTHETIC-STAGING-SALESPERSON";

export function parseStagingSalespersonArguments(values, environment = process.env) {
  if (environment.APP_ENV !== "staging") {
    throw new Error("Staging Salesperson provisioning is disabled outside APP_ENV=staging.");
  }

  const options = Object.fromEntries(values.map((value, index) => {
    if (!value.startsWith("--") || index % 2 !== 0) return [];
    return [value.slice(2), values[index + 1]];
  }).filter((entry) => entry.length === 2));

  for (const name of ["confirm", "email", "organization-id", "location-id", "application-url", "expected-database-host"]) {
    if (!options[name]) throw new Error(`--${name} is required.`);
  }
  if (options.confirm !== confirmation) throw new Error(`--confirm must equal ${confirmation}.`);
  if (!/^org_[a-z0-9_-]{6,64}$/.test(options["organization-id"])) throw new Error("Organization ID is invalid.");
  if (!/^loc_[a-z0-9_-]{6,64}$/.test(options["location-id"])) throw new Error("Location ID is invalid.");
  if (!/^\S+\+[^@]+@\S+\.\S+$/.test(options.email)) throw new Error("Use a clearly synthetic plus-addressed email.");

  const databaseUrl = new URL(environment.DATABASE_URL ?? "");
  if (databaseUrl.hostname !== options["expected-database-host"]) {
    throw new Error("DATABASE_URL does not match --expected-database-host.");
  }
  const applicationUrl = new URL(options["application-url"]);
  if (applicationUrl.protocol !== "https:") throw new Error("The staging application URL must use HTTPS.");
  const databaseSslMode = environment.DATABASE_SSL_MODE ?? "verify-full";
  if (!['disable', 'verify-full'].includes(databaseSslMode)) throw new Error("DATABASE_SSL_MODE must be disable or verify-full.");

  return {
    applicationUrl: applicationUrl.origin,
    databaseUrl: databaseUrl.toString(),
    databaseSslMode,
    email: options.email.toLowerCase(),
    organizationId: options["organization-id"],
    locationId: options["location-id"],
  };
}

export async function provisionStagingSalesperson(pool, input) {
  const client = await pool.connect();
  const invitationId = deterministicId("oin", `${input.organizationId}:staging-salesperson:${input.email}`);
  const idempotencyKey = `operator-provision:${input.organizationId}:staging-salesperson:${input.email}`;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.organization_id',$1,true),set_config('app.user_id','',true),set_config('app.operator_provision','enabled',true),set_config('app.auth_runtime','enabled',true)",
      [input.organizationId],
    );
    const target = await client.query(
      `SELECT organization.id organization_id,location.id location_id,role.id role_id
       FROM organizations organization
       JOIN locations location ON location.organization_id=organization.id AND location.id=$2 AND location.active=true
       JOIN roles role ON role.organization_id=organization.id AND role.key='salesperson' AND role.system=true
       WHERE organization.id=$1 AND organization.active=true AND organization.data_class='demo'`,
      [input.organizationId, input.locationId],
    );
    if (!target.rows[0]) throw new Error("Target must be an active DEMO organization with the requested active location and system Salesperson role.");

    const existingUser = await client.query("SELECT id,email_verified,active FROM users WHERE lower(email)=lower($1) LIMIT 1", [input.email]);
    if (existingUser.rows[0]) {
      const user = existingUser.rows[0];
      const account = await client.query("SELECT 1 FROM auth_accounts WHERE user_id=$1 AND provider_id='credential' LIMIT 1", [user.id]);
      const membership = await client.query(
        `SELECT membership.id,
          EXISTS(SELECT 1 FROM membership_roles mr WHERE mr.organization_id=membership.organization_id AND mr.membership_id=membership.id AND mr.role_id=$3) salesperson,
          EXISTS(SELECT 1 FROM membership_locations ml WHERE ml.organization_id=membership.organization_id AND ml.membership_id=membership.id AND ml.location_id=$4) location_access
         FROM organization_memberships membership
         WHERE membership.organization_id=$1 AND membership.user_id=$2 AND membership.status='active'`,
        [input.organizationId, user.id, target.rows[0].role_id, input.locationId],
      );
      const ready = Boolean(user.active && user.email_verified && account.rows[0] && membership.rows[0]?.salesperson && membership.rows[0]?.location_access);
      await client.query("COMMIT");
      return { status: ready ? "ready" : "existing-user-incomplete", userId: user.id, organizationId: input.organizationId, locationId: input.locationId, invitationId };
    }

    const existingInvitation = await client.query(
      "SELECT id,status,expires_at FROM organization_invitations WHERE organization_id=$1 AND idempotency_key=$2 FOR UPDATE",
      [input.organizationId, idempotencyKey],
    );
    if (existingInvitation.rows[0]) {
      await client.query("COMMIT");
      return { status: "invitation-exists", organizationId: input.organizationId, locationId: input.locationId, invitationId };
    }

    const token = `${input.organizationId}.${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await client.query(
      "INSERT INTO organization_invitations(id,organization_id,email,token_hash,idempotency_key,all_locations,expires_at,invited_by) VALUES($1,$2,$3,$4,$5,false,$6,NULL)",
      [invitationId, input.organizationId, input.email, tokenHash, idempotencyKey, expiresAt],
    );
    await client.query(
      "INSERT INTO organization_invitation_roles(invitation_id,organization_id,role_id) VALUES($1,$2,$3)",
      [invitationId, input.organizationId, target.rows[0].role_id],
    );
    await client.query(
      "INSERT INTO organization_invitation_locations(invitation_id,organization_id,location_id) VALUES($1,$2,$3)",
      [invitationId, input.organizationId, input.locationId],
    );
    const actionUrl = new URL("/accept-invitation", input.applicationUrl);
    actionUrl.searchParams.set("token", token);
    await client.query(
      `INSERT INTO transactional_email_messages(id,organization_id,invitation_id,kind,recipient_email,subject,text_body,html_body,idempotency_key)
       VALUES($1,$2,$3,'organization-invitation',$4,'Join the DealerFlow synthetic staging dealership',$5,$6,$7)`,
      [
        deterministicId("tem", invitationId), input.organizationId, invitationId, input.email,
        `A governed synthetic staging Salesperson invitation is ready.\n\nAccept invitation: ${actionUrl}\n\nThis invitation expires in 7 days.`,
        `<p>A governed synthetic staging Salesperson invitation is ready.</p><p><a href="${escapeHtml(actionUrl.toString())}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`,
        `organization-invitation:${invitationId}`,
      ],
    );
    await client.query(
      "INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,new_values) VALUES($1,$2,NULL,'staging.synthetic_salesperson.provisioning_requested','organization_invitation',$3,'operator',$4,$5::jsonb)",
      [`aud_${randomUUID().replaceAll("-", "")}`, input.organizationId, invitationId, `staging-provision:${randomUUID()}`, JSON.stringify({ locationId: input.locationId, roleKey: "salesperson", synthetic: true })],
    );
    await client.query("COMMIT");
    return { status: "invitation-created", organizationId: input.organizationId, locationId: input.locationId, invitationId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function deterministicId(prefix, value) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function main() {
  const input = parseStagingSalespersonArguments(process.argv.slice(2));
  const pool = new Pool({ connectionString: input.databaseUrl, ssl: input.databaseSslMode === "disable" ? false : { rejectUnauthorized: true }, max: 1, application_name: "dealerflow-staging-salesperson-provisioner" });
  try {
    process.stdout.write(`${JSON.stringify(await provisionStagingSalesperson(pool, input))}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Staging Salesperson provisioning failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    process.exitCode = 1;
  });
}
