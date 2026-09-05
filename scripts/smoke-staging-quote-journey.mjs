import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const confirmation = "RUN-SYNTHETIC-STAGING-QUOTE-JOURNEY";

export function parseArguments(values, environment = process.env) {
  if (environment.APP_ENV !== "staging") throw new Error("Staging quote-journey acceptance is disabled outside APP_ENV=staging.");
  const options = {};
  for (let index = 0; index < values.length; index += 2) options[values[index]?.replace(/^--/, "")] = values[index + 1];
  for (const name of ["confirm", "organization-id", "location-id", "deal-id", "application-url", "expected-database-host"]) {
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
    await db.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id','',true)", [input["organization-id"]]);
    const identities = await db.query(
      `SELECT users.id user_id,session.token FROM users
       JOIN auth_sessions session ON session.user_id=users.id AND session.expires_at>now()
       JOIN organization_memberships membership ON membership.user_id=users.id AND membership.organization_id=$1 AND membership.status='active'
       JOIN membership_roles mr ON mr.organization_id=membership.organization_id AND mr.membership_id=membership.id
       JOIN roles role ON role.organization_id=mr.organization_id AND role.id=mr.role_id AND role.key='salesperson'
       WHERE users.active AND users.email_verified
         AND (membership.all_locations OR EXISTS(SELECT 1 FROM membership_locations ml WHERE ml.organization_id=membership.organization_id AND ml.membership_id=membership.id AND ml.location_id=$2))
       ORDER BY session.created_at DESC LIMIT 1`,
      [input["organization-id"], input["location-id"]],
    );
    const salesperson = identities.rows[0];
    if (!salesperson) throw new Error("A login-ready staging Salesperson session is required.");
    await db.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [input["organization-id"], salesperson.user_id]);
    const managerResult = await db.query(
      `SELECT users.id user_id,session.token FROM users
       JOIN auth_sessions session ON session.user_id=users.id AND session.expires_at>now()
       JOIN organization_memberships membership ON membership.user_id=users.id AND membership.organization_id=$1 AND membership.status='active'
       JOIN membership_roles mr ON mr.organization_id=membership.organization_id AND mr.membership_id=membership.id
       JOIN role_capabilities capability ON capability.organization_id=mr.organization_id AND capability.role_id=mr.role_id AND capability.capability='quote.approve'
       WHERE users.active AND users.email_verified
         AND (membership.all_locations OR EXISTS(SELECT 1 FROM membership_locations ml WHERE ml.organization_id=membership.organization_id AND ml.membership_id=membership.id AND ml.location_id=$2))
       ORDER BY session.created_at DESC LIMIT 1`,
      [input["organization-id"], input["location-id"]],
    );
    const manager = managerResult.rows[0];
    if (!manager) throw new Error("A login-ready location-authorized staging Manager session is required.");
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
    if (!guard.rows[0] || guard.rows[0].data_class !== "demo" || guard.rows[0].owner_user_id !== salesperson.user_id || !guard.rows[0].salesperson_allowed || !guard.rows[0].manager_allowed) {
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
  const alternateAcceptance = await post(`${base}/quotes/${v1.payload.quote.id}/transitions`, "acceptance-quote:alternate-acceptance:v1", { toStatus: "accepted" });
  requireStatus(alternateAcceptance, [409], "alternate Quote acceptance rejection");

  const working = await post(`${base}/deals/${input["deal-id"]}/transitions`, "golden-deal:working", { toStatus: "working" });
  const pendingApproval = await post(`${base}/deals/${input["deal-id"]}/transitions`, "golden-deal:pending-approval", { toStatus: "pending-approval" });
  const approvedDeal = await post(`${base}/deals/${input["deal-id"]}/transitions`, "golden-deal:approved", { toStatus: "approved" }, managerCookie);
  const contracted = await post(`${base}/deals/${input["deal-id"]}/transitions`, "golden-deal:contracted", { toStatus: "contracted" });
  const contractedRetry = await post(`${base}/deals/${input["deal-id"]}/transitions`, "golden-deal:contracted", { toStatus: "contracted" });
  requireStatus(working, [200], "Deal working transition");
  requireStatus(pendingApproval, [200], "Deal pending-approval transition");
  requireStatus(approvedDeal, [200], "Manager Deal approval");
  requireStatus(contracted, [200], "Deal contracting");
  requireStatus(contractedRetry, [200], "Deal contracting retry");

  const unauthorizedDocument = await post(`${base}/deals/${input["deal-id"]}/documents`, "golden-document:unauthorized", { documentType: "unauthorized-test", sourceType: "uploaded", required: true, waiverAllowed: false });
  requireStatus(unauthorizedDocument, [403], "Salesperson document-management denial");
  const directUrl = await post(`${base}/deals/${input["deal-id"]}/documents`, "golden-document:direct-url", { documentType: "unsafe-reference-test", sourceType: "external-reference", externalReference: "https://example.invalid/private.pdf", required: true, waiverAllowed: false }, managerCookie);
  requireStatus(directUrl, [400], "direct document URL rejection");

  const requiredDocument = await post(`${base}/deals/${input["deal-id"]}/documents`, "golden-document:purchase-agreement", { documentType: "purchase-agreement", sourceType: "uploaded", required: true, waiverAllowed: false }, managerCookie);
  const requiredDocumentRetry = await post(`${base}/deals/${input["deal-id"]}/documents`, "golden-document:purchase-agreement", { documentType: "purchase-agreement", sourceType: "uploaded", required: true, waiverAllowed: false }, managerCookie);
  requireStatus(requiredDocument, [200, 201], "required document creation");
  requireStatus(requiredDocumentRetry, [200], "required document creation retry");
  const requiredDocumentId = requiredDocument.payload.requirement?.id;
  if (!requiredDocumentId || requiredDocumentRetry.payload.requirement?.id !== requiredDocumentId) throw new Error("Document creation idempotency evidence is incomplete.");

  const readinessBefore = await readReadiness(pool, input["organization-id"], input["deal-id"], context.manager.user_id);
  if (readinessBefore.ready || !readinessBefore.blockers.includes("documents-incomplete")) throw new Error("Pending required documents did not block delivery readiness.");
  const crossDealDocument = await post(`${base}/deals/dea_cross_deal_negative/documents/${requiredDocumentId}/transitions`, "golden-document:cross-deal", { toStatus: "provided" }, managerCookie);
  requireStatus(crossDealDocument, [409], "cross-Deal document transition denial");
  const documentProvided = await post(`${base}/deals/${input["deal-id"]}/documents/${requiredDocumentId}/transitions`, "golden-document:purchase-agreement:provided", { toStatus: "provided" }, managerCookie);
  const documentProvidedRetry = await post(`${base}/deals/${input["deal-id"]}/documents/${requiredDocumentId}/transitions`, "golden-document:purchase-agreement:provided", { toStatus: "provided" }, managerCookie);
  const documentCompleted = await post(`${base}/deals/${input["deal-id"]}/documents/${requiredDocumentId}/transitions`, "golden-document:purchase-agreement:complete", { toStatus: "complete" }, managerCookie);
  const documentCompletedRetry = await post(`${base}/deals/${input["deal-id"]}/documents/${requiredDocumentId}/transitions`, "golden-document:purchase-agreement:complete", { toStatus: "complete" }, managerCookie);
  requireStatus(documentProvided, [200], "document evidence");
  requireStatus(documentProvidedRetry, [200], "document evidence retry");
  requireStatus(documentCompleted, [200], "document completion");
  requireStatus(documentCompletedRetry, [200], "document completion retry");

  const waivableDocument = await post(`${base}/deals/${input["deal-id"]}/documents`, "golden-document:policy-waiver", { documentType: "policy-waiver-test", sourceType: "uploaded", required: true, waiverAllowed: true }, managerCookie);
  requireStatus(waivableDocument, [200, 201], "waivable document creation");
  const waivableDocumentId = waivableDocument.payload.requirement?.id;
  if (!waivableDocumentId) throw new Error("Waivable document identity is unavailable.");
  const unauthorizedWaiver = await post(`${base}/deals/${input["deal-id"]}/documents/${waivableDocumentId}/transitions`, "golden-document:unauthorized-waiver", { toStatus: "waived", reason: "Synthetic permission attack" });
  requireStatus(unauthorizedWaiver, [403], "unauthorized document waiver");
  const authorizedWaiver = await post(`${base}/deals/${input["deal-id"]}/documents/${waivableDocumentId}/transitions`, "golden-document:authorized-waiver", { toStatus: "waived", reason: "Synthetic policy-authorized acceptance waiver" }, managerCookie);
  const authorizedWaiverRetry = await post(`${base}/deals/${input["deal-id"]}/documents/${waivableDocumentId}/transitions`, "golden-document:authorized-waiver", { toStatus: "waived", reason: "Synthetic policy-authorized acceptance waiver" }, managerCookie);
  requireStatus(authorizedWaiver, [200], "authorized document waiver");
  requireStatus(authorizedWaiverRetry, [200], "authorized document waiver retry");
  const crossTenantDocument = await post(`${input.applicationUrl}/api/organizations/org_cross_tenant_negative/deals/${input["deal-id"]}/documents`, "golden-document:cross-tenant", { documentType: "cross-tenant-test", sourceType: "uploaded", required: true, waiverAllowed: false }, managerCookie);
  requireStatus(crossTenantDocument, [403], "cross-tenant document denial");

  const readinessAfter = await readReadiness(pool, input["organization-id"], input["deal-id"], context.manager.user_id);
  if (!readinessAfter.ready || readinessAfter.blockers.length) throw new Error("Completed document evidence did not satisfy delivery readiness.");

  const delivery = await post(`${base}/deals/${input["deal-id"]}/delivery`, "golden-delivery:schedule", { startsAt: "2030-09-05T14:00:00.000Z", endsAt: "2030-09-05T15:00:00.000Z", timezone: "America/New_York", notes: "Synthetic golden-journey handoff" });
  const deliveryRetry = await post(`${base}/deals/${input["deal-id"]}/delivery`, "golden-delivery:schedule", { startsAt: "2030-09-05T14:00:00.000Z", endsAt: "2030-09-05T15:00:00.000Z", timezone: "America/New_York", notes: "Synthetic golden-journey handoff" });
  requireStatus(delivery, [200, 201], "delivery scheduling");
  requireStatus(deliveryRetry, [200], "delivery scheduling retry");
  const deliveryId = delivery.payload.delivery?.id;
  if (!deliveryId || deliveryRetry.payload.delivery?.id !== deliveryId) throw new Error("Delivery scheduling idempotency evidence is incomplete.");
  const deliveryReady = await post(`${base}/deliveries/${deliveryId}/transitions`, "golden-delivery:ready", { toStatus: "ready" });
  const deliveryCompleted = await post(`${base}/deliveries/${deliveryId}/transitions`, "golden-delivery:completed", { toStatus: "completed" });
  const deliveryCompletedRetry = await post(`${base}/deliveries/${deliveryId}/transitions`, "golden-delivery:completed", { toStatus: "completed" });
  const deliveredDeal = await post(`${base}/deals/${input["deal-id"]}/transitions`, "golden-deal:delivered", { toStatus: "delivered" });
  const deliveredDealRetry = await post(`${base}/deals/${input["deal-id"]}/transitions`, "golden-deal:delivered", { toStatus: "delivered" });
  for (const [label, result] of [["delivery ready", deliveryReady], ["delivery completion", deliveryCompleted], ["delivery completion retry", deliveryCompletedRetry], ["Deal delivered", deliveredDeal], ["Deal delivered retry", deliveredDealRetry]]) requireStatus(result, [200], label);

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
        (SELECT unit_amount_cents FROM deal_quote_lines WHERE organization_id=$1 AND quote_id=$4 AND category='vehicle') v2_price,
        (SELECT status::text FROM deals WHERE organization_id=$1 AND id=$2) deal_status,
        (SELECT accepted_quote_id FROM deals WHERE organization_id=$1 AND id=$2) bound_quote_id,
        (SELECT accepted_quote_version FROM deals WHERE organization_id=$1 AND id=$2) bound_quote_version,
        (SELECT count(*)::int FROM deal_status_events WHERE organization_id=$1 AND deal_id=$2 AND idempotency_key='golden-deal:contracted') contract_event_count,
        (SELECT count(*)::int FROM deal_document_requirements WHERE organization_id=$1 AND deal_id=$2 AND idempotency_key='golden-document:purchase-agreement') required_document_count,
        (SELECT count(*)::int FROM deal_document_status_events WHERE organization_id=$1 AND requirement_id=$6) required_document_event_count,
        (SELECT count(*)::int FROM deal_document_status_events WHERE organization_id=$1 AND requirement_id=$7 AND to_status='waived') waiver_event_count,
        (SELECT count(*)::int FROM deal_deliveries WHERE organization_id=$1 AND deal_id=$2 AND idempotency_key='golden-delivery:schedule') delivery_count,
        (SELECT count(*)::int FROM deal_delivery_status_events WHERE organization_id=$1 AND delivery_id=$8 AND to_status='completed') delivery_completion_count`,
      [input["organization-id"], input["deal-id"], financeId, quoteId, v1.payload.quote.id, requiredDocumentId, waivableDocumentId, deliveryId],
    );
    await evidenceDb.query("COMMIT");
    const row = evidence.rows[0];
    if (!row || row.v1_count !== 1 || row.approval_count !== 1 || row.terms_count !== 1 || row.finance_count !== 1 || row.accepted_status !== "accepted" || row.approval_status !== "approved" || row.v1_price !== 4_200_000 || row.v2_price !== 4_150_000 || row.deal_status !== "delivered" || row.bound_quote_id !== quoteId || row.bound_quote_version !== v2.payload.quote.version || row.contract_event_count !== 1 || row.required_document_count !== 1 || row.required_document_event_count !== 3 || row.waiver_event_count !== 1 || row.delivery_count !== 1 || row.delivery_completion_count !== 1) throw new Error("Canonical golden-journey evidence is incomplete.");
    return { dealId: input["deal-id"], cashQuoteV1Id: v1.payload.quote.id, acceptedQuoteId: quoteId, financeQuoteId: financeId, leaseQuoteId: lease.payload.quote.id, approvalId, requiredDocumentId, waivableDocumentId, deliveryId, readinessBefore, readinessAfter, statuses: { v1: v1.status, v1Retry: v1Retry.status, v2: v2.status, finance: finance.status, terms: terms.status, termsRetry: termsRetry.status, leaseIncomplete: leaseIncomplete.status, approval: approval.status, approvalRetry: approvalRetry.status, selfApproval: selfApproval.status, managerDecision: decision.status, managerDecisionRetry: decisionRetry.status, proposal: proposalResponse.status, accepted: accepted.status, alternateAcceptance: alternateAcceptance.status, contracted: contracted.status, contractedRetry: contractedRetry.status, unauthorizedDocument: unauthorizedDocument.status, directUrl: directUrl.status, crossDealDocument: crossDealDocument.status, unauthorizedWaiver: unauthorizedWaiver.status, crossTenantDocument: crossTenantDocument.status, delivery: delivery.status, deliveryRetry: deliveryRetry.status, deliveryCompleted: deliveryCompleted.status, deliveryCompletedRetry: deliveryCompletedRetry.status, delivered: deliveredDeal.status, deliveredRetry: deliveredDealRetry.status }, evidence: row };
  } catch (error) { await evidenceDb.query("ROLLBACK").catch(() => undefined); throw error; } finally { evidenceDb.release(); }
}

async function readReadiness(pool, organizationId, dealId, userId) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [organizationId, userId]);
    const result = await db.query(
      `SELECT d.status::text deal_status,d.accepted_quote_id,d.accepted_quote_version,
        EXISTS(SELECT 1 FROM deal_quotes q WHERE q.organization_id=d.organization_id AND q.deal_id=d.id AND q.id=d.accepted_quote_id AND q.version=d.accepted_quote_version AND q.status='accepted') quote_valid,
        (d.inventory_unit_id IS NULL OR EXISTS(SELECT 1 FROM inventory_units i WHERE i.organization_id=d.organization_id AND i.location_id=d.location_id AND i.id=d.inventory_unit_id AND i.vehicle_id=d.primary_vehicle_id AND i.status='hold')) inventory_valid,
        EXISTS(SELECT 1 FROM deal_document_requirements r WHERE r.organization_id=d.organization_id AND r.deal_id=d.id AND r.required) has_required_documents,
        NOT EXISTS(SELECT 1 FROM deal_document_requirements r WHERE r.organization_id=d.organization_id AND r.deal_id=d.id AND r.required AND r.status NOT IN ('complete','waived')) documents_complete
       FROM deals d WHERE d.organization_id=$1 AND d.id=$2`,
      [organizationId, dealId],
    );
    await db.query("COMMIT");
    const row = result.rows[0];
    if (!row) throw new Error("Delivery-readiness Deal is unavailable.");
    const blockers = [];
    if (row.deal_status !== "contracted") blockers.push("deal-not-contracted");
    if (!row.accepted_quote_id || !row.accepted_quote_version) blockers.push("accepted-quote-missing");
    else if (!row.quote_valid) blockers.push("accepted-quote-mismatch");
    if (!row.inventory_valid) blockers.push("inventory-unavailable");
    if (!row.has_required_documents || !row.documents_complete) blockers.push("documents-incomplete");
    return { ready: blockers.length === 0, blockers };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { db.release(); }
}

function requireStatus(result, allowed, label) { if (!allowed.includes(result.status)) throw new Error(`${label} returned HTTP ${result.status}.`); }

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const pool = new Pool({ connectionString: input.databaseUrl, ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }, max: 2, application_name: "dealerflow-staging-quote-journey-smoke" });
  try { process.stdout.write(`${JSON.stringify(await run(pool, input))}\n`); } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`Staging quote-journey acceptance failed: ${error instanceof Error ? error.message : "Unknown error"}\n`); process.exitCode = 1; });
