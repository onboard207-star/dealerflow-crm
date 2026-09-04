import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const confirmation = "RUN-SYNTHETIC-STAGING-QUOTE-JOURNEY";

export function parseArguments(values, environment = process.env) {
  if (environment.APP_ENV !== "staging") throw new Error("Staging quote-journey acceptance is disabled outside APP_ENV=staging.");
  const options = {};
  for (let index = 0; index < values.length; index += 2) options[values[index]?.replace(/^--/, "")] = values[index + 1];
  for (const name of ["confirm", "salesperson-email", "manager-email", "organization-id", "location-id", "deal-id", "application-url", "expected-database-host"]) {
    if (!options[name]) throw new Error(`--${name} is required.`);
  }
  if (options.confirm !== confirmation) throw new Error(`--confirm must equal ${confirmation}.`);
  const databaseUrl = new URL(environment.DATABASE_URL ?? "");
  if (databaseUrl.hostname !== options["expected-database-host"]) throw new Error("DATABASE_URL does not match --expected-database-host.");
  const applicationUrl = new URL(options["application-url"]);
  if (applicationUrl.protocol !== "https:") throw new Error("The staging application URL must use HTTPS.");
  return { ...options, applicationUrl: applicationUrl.origin, databaseUrl: databaseUrl.toString() };
}

export async function run(pool, input, environment = process.env) {
  if (!environment.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required.");
  const db = await pool.connect();
  let context;
  try {
    await db.query("BEGIN");
    await db.query("SELECT set_config('app.auth_runtime','enabled',true)");
    const identities = await db.query(
      `SELECT users.id user_id,lower(users.email) email,session.token FROM users
       JOIN auth_sessions session ON session.user_id=users.id AND session.expires_at>now()
       WHERE lower(users.email)=ANY($1::text[]) AND users.active AND users.email_verified
       ORDER BY session.created_at DESC`,
      [[input["salesperson-email"].toLowerCase(), input["manager-email"].toLowerCase()]],
    );
    const salesperson = identities.rows.find((row) => row.email === input["salesperson-email"].toLowerCase());
    const manager = identities.rows.find((row) => row.email === input["manager-email"].toLowerCase());
    if (!salesperson || !manager) throw new Error("Login-ready Salesperson and Manager staging sessions are required.");
    await db.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [input["organization-id"], salesperson.user_id]);
    const guard = await db.query(
      `SELECT organization.data_class,deal.customer_id,deal.lead_id,deal.primary_vehicle_id,deal.inventory_unit_id,
        deal.owner_user_id,deal.location_id,vehicle.year,vehicle.make,vehicle.model,vehicle.trim,
        EXISTS(SELECT 1 FROM organization_memberships membership
          JOIN membership_roles mr ON mr.organization_id=membership.organization_id AND mr.membership_id=membership.id
          JOIN role_capabilities capability ON capability.organization_id=mr.organization_id AND capability.role_id=mr.role_id AND capability.capability='quote.create'
          WHERE membership.organization_id=deal.organization_id AND membership.user_id=$3 AND membership.status='active') salesperson_allowed,
        EXISTS(SELECT 1 FROM organization_memberships membership
          JOIN membership_roles mr ON mr.organization_id=membership.organization_id AND mr.membership_id=membership.id
          JOIN role_capabilities capability ON capability.organization_id=mr.organization_id AND capability.role_id=mr.role_id AND capability.capability='quote.approve'
          WHERE membership.organization_id=deal.organization_id AND membership.user_id=$4 AND membership.status='active') manager_allowed
       FROM deals deal JOIN organizations organization ON organization.id=deal.organization_id
       JOIN vehicles vehicle ON vehicle.organization_id=deal.organization_id AND vehicle.id=deal.primary_vehicle_id
       WHERE deal.organization_id=$1 AND deal.id=$2 AND deal.location_id=$5`,
      [input["organization-id"], input["deal-id"], salesperson.user_id, manager.user_id, input["location-id"]],
    );
    if (!guard.rows[0] || guard.rows[0].data_class !== "demo" || !guard.rows[0].salesperson_allowed || !guard.rows[0].manager_allowed) {
      throw new Error("Quote acceptance requires the exact DEMO Deal and authorized staging identities.");
    }
    context = { ...guard.rows[0], salesperson, manager };
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { db.release(); }

  const cookie = (identity) => {
    const signature = createHmac("sha256", environment.BETTER_AUTH_SECRET).update(identity.token).digest("base64");
    return `__Secure-better-auth.session_token=${encodeURIComponent(`${identity.token}.${signature}`)}`;
  };
  const salespersonCookie = cookie(context.salesperson);
  const managerCookie = cookie(context.manager);
  const base = `${input.applicationUrl}/api/organizations/${input["organization-id"]}`;
  const post = async (url, key, body, sessionCookie = salespersonCookie) => {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, cookie: sessionCookie }, body: JSON.stringify(body) });
    return { status: response.status, payload: await response.json().catch(() => ({})) };
  };
  const vehicleLabel = `${context.year} ${context.make} ${context.model}${context.trim ? ` ${context.trim}` : ""}`;
  const lines = (price) => [{ category: "vehicle", description: `${vehicleLabel} — synthetic user-supplied acceptance price`, unitAmountCents: price }];

  const v1 = await post(`${base}/deals/${input["deal-id"]}/quotes`, "acceptance-quote:cash:v1", { purchaseType: "cash", lines: lines(4_200_000) });
  const v1Retry = await post(`${base}/deals/${input["deal-id"]}/quotes`, "acceptance-quote:cash:v1", { purchaseType: "cash", lines: lines(4_200_000) });
  requireStatus(v1, [200, 201], "cash Quote v1"); requireStatus(v1Retry, [200], "cash Quote v1 retry");
  const v2 = await post(`${base}/deals/${input["deal-id"]}/quotes`, "acceptance-quote:cash:v2", { purchaseType: "cash", lines: lines(4_150_000) });
  requireStatus(v2, [200, 201], "cash Quote v2");
  const finance = await post(`${base}/deals/${input["deal-id"]}/quotes`, "acceptance-quote:finance:v1", { purchaseType: "finance", lines: lines(4_150_000) });
  requireStatus(finance, [200, 201], "finance Quote");
  const financeId = finance.payload.quote?.id;
  const terms = await post(`${base}/quotes/${financeId}/terms`, "unused-by-immutable-terms", { cashDownCents: 500_000, finance: { aprBasisPoints: 599, termMonths: 60, sourceType: "manual-entry", sourceLabel: "Synthetic acceptance input — not a lender offer" } });
  const termsRetry = await post(`${base}/quotes/${financeId}/terms`, "unused-by-immutable-terms", { cashDownCents: 500_000, finance: { aprBasisPoints: 599, termMonths: 60, sourceType: "manual-entry", sourceLabel: "Synthetic acceptance input — not a lender offer" } });
  requireStatus(terms, [201], "finance terms"); requireStatus(termsRetry, [409], "immutable finance terms retry");

  const lease = await post(`${base}/deals/${input["deal-id"]}/quotes`, "acceptance-quote:lease:v1", { purchaseType: "lease", lines: lines(4_150_000) });
  requireStatus(lease, [200, 201], "lease Quote");
  const leaseIncomplete = await post(`${base}/quotes/${lease.payload.quote?.id}/lease-terms`, "unused", { sourceType: "manual-entry", sourceLabel: "Synthetic incomplete lease test", termMonths: 36 });
  requireStatus(leaseIncomplete, [400], "incomplete lease rejection");

  const quoteId = v2.payload.quote?.id;
  if (!quoteId || v1Retry.payload.quote?.id !== v1.payload.quote?.id) throw new Error("Quote version idempotency evidence is incomplete.");
  const approval = await post(`${base}/quotes/${quoteId}/approval`, "acceptance-quote:approval:v2", { reason: "Synthetic manager-review acceptance" });
  const approvalRetry = await post(`${base}/quotes/${quoteId}/approval`, "acceptance-quote:approval:v2", { reason: "Synthetic manager-review acceptance" });
  requireStatus(approval, [200, 201], "approval request"); requireStatus(approvalRetry, [200], "approval request retry");
  const approvalId = approval.payload.approval?.id;
  const selfApproval = await post(`${base}/quote-approvals/${approvalId}/decision`, "acceptance-quote:self-approval", { decision: "approved" });
  requireStatus(selfApproval, [403, 409], "Salesperson self-approval denial");
  const decision = await post(`${base}/quote-approvals/${approvalId}/decision`, "acceptance-quote:manager-approval:v2", { decision: "approved", reason: "Synthetic acceptance approval" }, managerCookie);
  const decisionRetry = await post(`${base}/quote-approvals/${approvalId}/decision`, "acceptance-quote:manager-approval:v2", { decision: "approved", reason: "Synthetic acceptance approval" }, managerCookie);
  requireStatus(decision, [200], "manager decision"); requireStatus(decisionRetry, [200], "manager decision retry");
  const presented = await post(`${base}/quotes/${quoteId}/transitions`, "acceptance-quote:present:v2", { toStatus: "presented" });
  requireStatus(presented, [200], "Quote presentation");

  const proposalResponse = await fetch(`${input.applicationUrl}/organizations/${input["organization-id"]}/quotes/${quoteId}/print`, { headers: { cookie: salespersonCookie } });
  const proposal = await proposalResponse.text();
  if (proposalResponse.status !== 200 || !proposal.includes("Purchase proposal") || !proposal.includes(`Version ${v2.payload.quote.version}`)) throw new Error("Exact-version proposal rendering failed.");
  for (const forbidden of ["Vehicle cost", "Front gross", "Backend gross", "Total gross", "Cost source", "Manager rationale"]) {
    if (proposal.includes(forbidden)) throw new Error(`Customer proposal exposed internal field: ${forbidden}.`);
  }
  const accepted = await post(`${base}/quotes/${quoteId}/transitions`, "acceptance-quote:accept:v2", { toStatus: "accepted" });
  requireStatus(accepted, [200], "exact Quote acceptance");

  const evidenceDb = await pool.connect();
  try {
    await evidenceDb.query("BEGIN");
    await evidenceDb.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [input["organization-id"], context.salesperson.user_id]);
    const evidence = await evidenceDb.query(
      `SELECT
        (SELECT count(*)::int FROM deal_quotes WHERE organization_id=$1 AND deal_id=$2 AND idempotency_key LIKE 'acceptance-quote:%') quote_count,
        (SELECT count(*)::int FROM deal_quotes WHERE organization_id=$1 AND idempotency_key='acceptance-quote:cash:v1') v1_count,
        (SELECT count(*)::int FROM deal_quote_approvals WHERE organization_id=$1 AND request_idempotency_key='acceptance-quote:approval:v2') approval_count,
        (SELECT count(*)::int FROM quote_commercial_terms WHERE organization_id=$1 AND quote_id=$3) terms_count,
        (SELECT count(*)::int FROM quote_finance_terms WHERE organization_id=$1 AND quote_id=$3) finance_count,
        (SELECT estimated_payment_cents FROM quote_finance_terms WHERE organization_id=$1 AND quote_id=$3) estimated_payment_cents,
        (SELECT status::text FROM deal_quotes WHERE organization_id=$1 AND id=$4) accepted_status,
        (SELECT status::text FROM deal_quote_approvals WHERE organization_id=$1 AND quote_id=$4) approval_status,
        (SELECT version FROM deal_quotes WHERE organization_id=$1 AND id=$4) accepted_version,
        (SELECT unit_amount_cents FROM deal_quote_lines WHERE organization_id=$1 AND quote_id=$5 AND category='vehicle') v1_price,
        (SELECT unit_amount_cents FROM deal_quote_lines WHERE organization_id=$1 AND quote_id=$4 AND category='vehicle') v2_price`,
      [input["organization-id"], input["deal-id"], financeId, quoteId, v1.payload.quote.id],
    );
    await evidenceDb.query("COMMIT");
    const row = evidence.rows[0];
    if (!row || row.v1_count !== 1 || row.approval_count !== 1 || row.terms_count !== 1 || row.finance_count !== 1 || row.accepted_status !== "accepted" || row.approval_status !== "approved" || row.v1_price !== 4_200_000 || row.v2_price !== 4_150_000) throw new Error("Canonical Quote evidence is incomplete.");
    return { dealId: input["deal-id"], cashQuoteV1Id: v1.payload.quote.id, acceptedQuoteId: quoteId, financeQuoteId: financeId, leaseQuoteId: lease.payload.quote.id, approvalId, statuses: { v1: v1.status, v1Retry: v1Retry.status, v2: v2.status, finance: finance.status, terms: terms.status, termsRetry: termsRetry.status, leaseIncomplete: leaseIncomplete.status, approval: approval.status, approvalRetry: approvalRetry.status, selfApproval: selfApproval.status, managerDecision: decision.status, managerDecisionRetry: decisionRetry.status, proposal: proposalResponse.status, accepted: accepted.status }, evidence: row };
  } catch (error) { await evidenceDb.query("ROLLBACK").catch(() => undefined); throw error; } finally { evidenceDb.release(); }
}

function requireStatus(result, allowed, label) { if (!allowed.includes(result.status)) throw new Error(`${label} returned HTTP ${result.status}.`); }

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const pool = new Pool({ connectionString: input.databaseUrl, ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }, max: 2, application_name: "dealerflow-staging-quote-journey-smoke" });
  try { process.stdout.write(`${JSON.stringify(await run(pool, input))}\n`); } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`Staging quote-journey acceptance failed: ${error instanceof Error ? error.message : "Unknown error"}\n`); process.exitCode = 1; });
