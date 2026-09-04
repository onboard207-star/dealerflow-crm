import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const confirmation = "RUN-SYNTHETIC-STAGING-SALES-JOURNEY";

export function parseArguments(values, environment = process.env) {
  if (environment.APP_ENV !== "staging") throw new Error("Staging sales-journey smoke testing is disabled outside APP_ENV=staging.");
  const options = {};
  for (let index = 0; index < values.length; index += 2) options[values[index]?.replace(/^--/, "")] = values[index + 1];
  for (const name of ["confirm", "actor-email", "customer-email", "organization-id", "location-id", "application-url", "expected-database-host", "starts-at", "ends-at"]) {
    if (!options[name]) throw new Error(`--${name} is required.`);
  }
  if (options.confirm !== confirmation) throw new Error(`--confirm must equal ${confirmation}.`);
  if (!options["customer-email"].endsWith("@example.invalid")) throw new Error("The customer must use the reserved synthetic email domain.");
  const databaseUrl = new URL(environment.DATABASE_URL ?? "");
  if (databaseUrl.hostname !== options["expected-database-host"]) throw new Error("DATABASE_URL does not match --expected-database-host.");
  const applicationUrl = new URL(options["application-url"]);
  if (applicationUrl.protocol !== "https:") throw new Error("The staging application URL must use HTTPS.");
  const startsAt = new Date(options["starts-at"]);
  const endsAt = new Date(options["ends-at"]);
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt) throw new Error("The supplied appointment range is invalid.");
  if (startsAt <= new Date()) throw new Error("--starts-at must be in the future.");
  return { ...options, applicationUrl: applicationUrl.origin, databaseUrl: databaseUrl.toString() };
}

export async function run(pool, input, environment = process.env) {
  if (!environment.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required.");
  const client = await pool.connect();
  let context;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.auth_runtime','enabled',true)");
    const identity = await client.query(
      `SELECT users.id user_id,session.token FROM users
       JOIN auth_sessions session ON session.user_id=users.id AND session.expires_at>now()
       WHERE lower(users.email)=lower($1) AND users.active AND users.email_verified
       ORDER BY session.created_at DESC LIMIT 1`,
      [input["actor-email"]],
    );
    if (!identity.rows[0]) throw new Error("A login-ready staging Salesperson session is required.");
    await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [input["organization-id"], identity.rows[0].user_id]);
    const result = await client.query(
      `SELECT lead.id lead_id,customer.id customer_id,lead.assigned_user_id,
        inventory.id inventory_unit_id,inventory.vehicle_id
       FROM customers customer
       JOIN leads lead ON lead.organization_id=customer.organization_id AND lead.customer_id=customer.id
         AND lead.status IN ('open','working','qualified') AND lead.location_id=$3
       JOIN LATERAL (SELECT unit.id,unit.vehicle_id FROM inventory_units unit
         WHERE unit.organization_id=lead.organization_id AND unit.location_id=$3 AND unit.status='available'
         ORDER BY unit.updated_at,unit.id LIMIT 1) inventory ON true
       WHERE customer.organization_id=$2 AND lower(customer.email)=lower($1)
       ORDER BY lead.created_at DESC LIMIT 1`,
      [input["customer-email"], input["organization-id"], input["location-id"]],
    );
    context = { ...identity.rows[0], ...result.rows[0] };
    if (!result.rows[0]) throw new Error("An active synthetic Lead and authoritative available inventory unit are required.");
    const guard = await client.query(
      `SELECT EXISTS(SELECT 1 FROM organizations WHERE id=$1 AND data_class='demo' AND active) demo,
        EXISTS(SELECT 1 FROM organization_memberships membership
          JOIN membership_roles mr ON mr.organization_id=membership.organization_id AND mr.membership_id=membership.id
          JOIN roles role ON role.organization_id=mr.organization_id AND role.id=mr.role_id AND role.key='salesperson'
          JOIN membership_locations ml ON ml.organization_id=membership.organization_id AND ml.membership_id=membership.id AND ml.location_id=$3
          WHERE membership.organization_id=$1 AND membership.user_id=$2 AND membership.status='active') allowed`,
      [input["organization-id"], context.user_id, input["location-id"]],
    );
    if (!guard.rows[0]?.demo || !guard.rows[0]?.allowed || context.assigned_user_id !== context.user_id) {
      throw new Error("The journey must use the assigned location-scoped Salesperson in an active DEMO tenant.");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const signature = createHmac("sha256", environment.BETTER_AUTH_SECRET).update(context.token).digest("base64");
  const cookie = `__Secure-better-auth.session_token=${encodeURIComponent(`${context.token}.${signature}`)}`;
  const base = `${input.applicationUrl}/api/organizations/${input["organization-id"]}`;
  const post = async (url, key, body) => {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, cookie }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  };

  const appointmentBody = {
    locationId: input["location-id"], customerId: context.customer_id, leadId: context.lead_id,
    assignedUserId: context.user_id, type: "Test drive", startsAt: input["starts-at"], endsAt: input["ends-at"],
    timezone: "America/New_York", notes: "Governed synthetic sales-journey acceptance",
    followUp: { title: "Prepare for synthetic test drive", dueAt: input["starts-at"], priority: "normal" },
  };
  const appointment = await post(`${base}/appointments`, "acceptance-journey:appointment:v1", appointmentBody);
  const appointmentRetry = await post(`${base}/appointments`, "acceptance-journey:appointment:v1", appointmentBody);
  requireStatus(appointment, [200, 201], "appointment creation");
  requireStatus(appointmentRetry, [200], "appointment retry");
  const appointmentId = appointment.payload.appointment?.id;
  if (!appointmentId || appointmentRetry.payload.appointment?.id !== appointmentId) throw new Error("Appointment retry did not reuse the canonical record.");

  const invalidTime = await post(`${base}/appointments`, "acceptance-journey:invalid-time:v1", { ...appointmentBody, startsAt: "not-a-time" });
  const wrongAssignee = await post(`${base}/appointments`, "acceptance-journey:wrong-assignee:v1", { ...appointmentBody, assignedUserId: "usr_unauthorized_synthetic" });
  requireStatus(invalidTime, [400], "invalid appointment timestamp rejection");
  requireStatus(wrongAssignee, [409], "unauthorized appointment assignee rejection");

  const confirmed = await post(`${base}/appointments/${appointmentId}/transitions`, "acceptance-journey:appointment-confirmed:v1", { toStatus: "confirmed" });
  const confirmedRetry = await post(`${base}/appointments/${appointmentId}/transitions`, "acceptance-journey:appointment-confirmed:v1", { toStatus: "confirmed" });
  requireStatus(confirmed, [200], "appointment confirmation");
  requireStatus(confirmedRetry, [200], "appointment confirmation retry");

  const visitBody = { locationId: input["location-id"], customerId: context.customer_id, leadId: context.lead_id, appointmentId, assignedUserId: context.user_id, purpose: "Scheduled synthetic test drive" };
  const visit = await post(`${base}/showroom-visits`, "acceptance-journey:visit:v1", visitBody);
  const visitRetry = await post(`${base}/showroom-visits`, "acceptance-journey:visit:v1", visitBody);
  requireStatus(visit, [200, 201], "showroom check-in");
  requireStatus(visitRetry, [200], "showroom retry");
  const visitId = visit.payload.visit?.id;
  if (!visitId || visitRetry.payload.visit?.id !== visitId) throw new Error("Showroom retry did not reuse the canonical record.");

  const started = await post(`${base}/showroom-visits/${visitId}/transitions`, "acceptance-journey:visit-started:v1", { toStatus: "active" });
  const startedRetry = await post(`${base}/showroom-visits/${visitId}/transitions`, "acceptance-journey:visit-started:v1", { toStatus: "active" });
  requireStatus(started, [200], "showroom start");
  requireStatus(startedRetry, [200], "showroom start retry");

  const vehicle = await post(`${base}/customers/${context.customer_id}/vehicle-interests`, "acceptance-journey:vehicle:v1", { locationId: input["location-id"], leadId: context.lead_id, vehicleId: context.vehicle_id, role: "primary", notes: "Selected from authoritative available staging inventory" });
  requireStatus(vehicle, [200, 201], "vehicle selection");
  const unknownVehicle = await post(`${base}/customers/${context.customer_id}/vehicle-interests`, "acceptance-journey:unknown-vehicle:v1", { locationId: input["location-id"], leadId: context.lead_id, vehicleId: "veh_unknown_synthetic", role: "alternative" });
  requireStatus(unknownVehicle, [409], "unknown vehicle rejection");

  const dealBody = { locationId: input["location-id"], customerId: context.customer_id, leadId: context.lead_id, appointmentId, showroomVisitId: visitId, primaryVehicleId: context.vehicle_id, inventoryUnitId: context.inventory_unit_id, ownerUserId: context.user_id };
  const deal = await post(`${base}/deals`, "acceptance-journey:deal:v1", dealBody);
  const dealRetry = await post(`${base}/deals`, "acceptance-journey:deal:v1", dealBody);
  requireStatus(deal, [200, 201], "Deal creation");
  requireStatus(dealRetry, [200], "Deal retry");
  const dealId = deal.payload.deal?.id;
  if (!dealId || dealRetry.payload.deal?.id !== dealId) throw new Error("Deal retry did not reuse the canonical record.");
  const approvalDenied = await post(`${base}/deals/${dealId}/transitions`, "acceptance-journey:unauthorized-approval:v1", { toStatus: "approved" });
  requireStatus(approvalDenied, [403], "Salesperson manager-approval denial");

  let tenantAttackStatus = "not-run-no-second-tenant";
  if (input["attack-organization-id"]) {
    const attack = await post(`${input.applicationUrl}/api/organizations/${input["attack-organization-id"]}/appointments/${appointmentId}/transitions`, "acceptance-journey:tenant-attack:v1", { toStatus: "completed" });
    requireStatus(attack, [403], "cross-tenant denial");
    tenantAttackStatus = String(attack.status);
  }

  const evidenceClient = await pool.connect();
  try {
    await evidenceClient.query("BEGIN");
    await evidenceClient.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [input["organization-id"], context.user_id]);
    const evidence = await evidenceClient.query(
      `SELECT appointment.id appointment_id,appointment.status appointment_status,appointment.assigned_user_id,
        visit.id visit_id,visit.status visit_status,visit.appointment_id visit_appointment_id,
        deal.id deal_id,deal.appointment_id deal_appointment_id,deal.showroom_visit_id deal_visit_id,deal.owner_user_id,
        (SELECT count(*)::int FROM appointments WHERE organization_id=$1 AND idempotency_key='acceptance-journey:appointment:v1') appointment_count,
        (SELECT count(*)::int FROM showroom_visits WHERE organization_id=$1 AND idempotency_key='acceptance-journey:visit:v1') visit_count,
        (SELECT count(*)::int FROM deals WHERE organization_id=$1 AND idempotency_key='acceptance-journey:deal:v1') deal_count,
        (SELECT count(*)::int FROM appointment_status_events WHERE organization_id=$1 AND appointment_id=appointment.id) appointment_event_count,
        (SELECT count(*)::int FROM showroom_visit_status_events WHERE organization_id=$1 AND visit_id=visit.id) visit_event_count,
        (SELECT count(*)::int FROM deal_status_events WHERE organization_id=$1 AND deal_id=deal.id) deal_event_count,
        (SELECT count(*)::int FROM tasks WHERE organization_id=$1 AND appointment_id=appointment.id AND status='completed') completed_prep_tasks,
        (SELECT count(*)::int FROM audit_logs WHERE organization_id=$1 AND correlation_id LIKE 'req_%' AND entity_id IN (appointment.id,visit.id,deal.id)) audit_count
       FROM appointments appointment
       JOIN showroom_visits visit ON visit.organization_id=appointment.organization_id AND visit.appointment_id=appointment.id
       JOIN deals deal ON deal.organization_id=visit.organization_id AND deal.showroom_visit_id=visit.id
       WHERE appointment.organization_id=$1 AND appointment.id=$2 AND visit.id=$3 AND deal.id=$4`,
      [input["organization-id"], appointmentId, visitId, dealId],
    );
    await evidenceClient.query("COMMIT");
    const row = evidence.rows[0];
    if (!row || row.appointment_count !== 1 || row.visit_count !== 1 || row.deal_count !== 1 || row.completed_prep_tasks < 1) throw new Error("Canonical journey evidence is incomplete.");
    return {
      customerId: context.customer_id, leadId: context.lead_id, appointmentId, visitId, vehicleId: context.vehicle_id,
      inventoryUnitId: context.inventory_unit_id, dealId, appointmentCreateStatus: appointment.status,
      appointmentRetryStatus: appointmentRetry.status, visitCreateStatus: visit.status, visitRetryStatus: visitRetry.status,
      dealCreateStatus: deal.status, dealRetryStatus: dealRetry.status, invalidTimeStatus: invalidTime.status,
      wrongAssigneeStatus: wrongAssignee.status, unknownVehicleStatus: unknownVehicle.status,
      approvalDeniedStatus: approvalDenied.status, tenantAttackStatus, evidence: row,
    };
  } catch (error) {
    await evidenceClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    evidenceClient.release();
  }
}

function requireStatus(result, allowed, label) {
  if (!allowed.includes(result.status)) throw new Error(`${label} returned HTTP ${result.status}.`);
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const pool = new Pool({ connectionString: input.databaseUrl, ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }, max: 2, application_name: "dealerflow-staging-sales-journey-smoke" });
  try { process.stdout.write(`${JSON.stringify(await run(pool, input))}\n`); } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`Staging sales-journey smoke failed: ${error instanceof Error ? error.message : "Unknown error"}\n`); process.exitCode = 1; });
