import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const confirmation = "RUN-SYNTHETIC-STAGING-LEAD-IDEMPOTENCY";

export function parseArguments(values, environment = process.env) {
  if (environment.APP_ENV !== "staging") throw new Error("Staging lead smoke testing is disabled outside APP_ENV=staging.");
  const options = {};
  for (let index = 0; index < values.length; index += 2) options[values[index]?.replace(/^--/, "")] = values[index + 1];
  for (const name of ["confirm", "actor-email", "customer-email", "organization-id", "location-id", "application-url", "expected-database-host"]) {
    if (!options[name]) throw new Error(`--${name} is required.`);
  }
  if (options.confirm !== confirmation) throw new Error(`--confirm must equal ${confirmation}.`);
  const databaseUrl = new URL(environment.DATABASE_URL ?? "");
  if (databaseUrl.hostname !== options["expected-database-host"]) throw new Error("DATABASE_URL does not match --expected-database-host.");
  const applicationUrl = new URL(options["application-url"]);
  if (applicationUrl.protocol !== "https:") throw new Error("The staging application URL must use HTTPS.");
  if (!options["customer-email"].endsWith("@example.invalid")) throw new Error("The customer must use the reserved synthetic email domain.");
  return { ...options, databaseUrl: databaseUrl.toString(), applicationUrl: applicationUrl.origin };
}

export async function run(pool, input, environment = process.env) {
  if (!environment.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.auth_runtime','enabled',true)");
    const identity = await client.query(
      `SELECT users.id user_id,session.token
       FROM users JOIN auth_sessions session ON session.user_id=users.id AND session.expires_at>now()
       WHERE lower(users.email)=lower($1) AND users.active AND users.email_verified
       ORDER BY session.created_at DESC LIMIT 1`,
      [input["actor-email"]],
    );
    const actor = identity.rows[0];
    if (!actor) throw new Error("A verified login-ready staging actor session is required.");
    await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [input["organization-id"], actor.user_id]);
    const scope = await client.query(
      `SELECT EXISTS(SELECT 1 FROM organizations WHERE id=$1 AND data_class='demo' AND active) demo,
        EXISTS(SELECT 1 FROM organization_memberships membership
          JOIN membership_roles mr ON mr.organization_id=membership.organization_id AND mr.membership_id=membership.id
          JOIN roles role ON role.organization_id=mr.organization_id AND role.id=mr.role_id AND role.key='salesperson'
          JOIN membership_locations ml ON ml.organization_id=membership.organization_id AND ml.membership_id=membership.id AND ml.location_id=$3
          WHERE membership.organization_id=$1 AND membership.user_id=$2 AND membership.status='active') allowed`,
      [input["organization-id"], actor.user_id, input["location-id"]],
    );
    if (!scope.rows[0]?.demo || !scope.rows[0]?.allowed) throw new Error("The actor must be a location-scoped Salesperson in an active DEMO tenant.");
    await client.query("COMMIT");

    const signature = createHmac("sha256", environment.BETTER_AUTH_SECRET).update(actor.token).digest("base64");
    const cookie = `__Secure-better-auth.session_token=${encodeURIComponent(`${actor.token}.${signature}`)}`;
    const idempotencyKey = "acceptance-provider-20260903-001";
    const payload = {
      locationId: input["location-id"], source: "Website", sourceLeadId: "synthetic-provider-acceptance-20260903-001",
      sourceDetail: "Governed provider retry acceptance", assignedUserId: actor.user_id, preferredContactMethod: "email",
      appointmentRequest: { notes: "Synthetic provider appointment request" },
      customer: { displayName: "Taylor Retry Acceptance", firstName: "Taylor", lastName: "Retry Acceptance", email: input["customer-email"], phone: "+12075550198" },
    };
    const submit = async () => {
      const response = await fetch(`${input.applicationUrl}/api/organizations/${input["organization-id"]}/leads/intake`, {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey, cookie }, body: JSON.stringify(payload),
      });
      const body = await response.json();
      return { status: response.status, body };
    };
    const first = await submit();
    const retry = await submit();
    return {
      firstStatus: first.status, retryStatus: retry.status,
      customerId: first.body.customer?.id, leadId: first.body.lead?.id, taskId: first.body.followUpTask?.id, intakeId: first.body.intake?.id,
      sameCustomer: first.body.customer?.id === retry.body.customer?.id,
      sameLead: first.body.lead?.id === retry.body.lead?.id,
      sameTask: first.body.followUpTask?.id === retry.body.followUpTask?.id,
      sameIntake: first.body.intake?.id === retry.body.intake?.id,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const pool = new Pool({ connectionString: input.databaseUrl, ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }, max: 1 });
  try { process.stdout.write(`${JSON.stringify(await run(pool, input))}\n`); } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`Staging lead smoke failed: ${error instanceof Error ? error.message : "Unknown error"}\n`); process.exitCode = 1; });
