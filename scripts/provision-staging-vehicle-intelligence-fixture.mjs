import { createHash } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;

export const fixture = Object.freeze({
  organizationId: "org_demo_first_pilot_v1",
  locationId: "loc_demo_main_rooftop_v1",
  vehicleId: deterministicId("veh", "pilot-p1-02:vehicle-intelligence:accord-lx"),
  inventoryUnitId: deterministicId("inv", "pilot-p1-02:vehicle-intelligence:accord-lx"),
  vin: "TESTCATALG26LX001",
  stockNumber: "TEST-VI-LX-001",
  idempotencyKey: "pilot-p1-02:vehicle-intelligence:accord-lx:v1",
  year: 2026,
  make: "Honda",
  model: "Accord",
  trim: "LX",
  configurationId: "vcf_79197e26b9c52b480a8d38d7a899ef15",
  configurationStableKey: "CFG-HONDA-ACCORD-2026-LX-FWD-CVT",
  readiness: "pilot-ready",
});

export function parseArguments(values, environment = process.env) {
  const options = Object.fromEntries(values.map((value, index) => {
    if (!value.startsWith("--") || index % 2 !== 0) return [];
    return [value.slice(2), values[index + 1]];
  }).filter((entry) => entry.length === 2));
  if (environment.APP_ENV !== "staging") throw new Error("The Vehicle Intelligence fixture is disabled outside staging.");
  if (options.confirm !== "PROVISION-P1-02-VEHICLE-INTELLIGENCE-FIXTURE") {
    throw new Error("--confirm must equal PROVISION-P1-02-VEHICLE-INTELLIGENCE-FIXTURE.");
  }
  if (!options["expected-database-host"]) throw new Error("--expected-database-host is required.");
  const databaseUrl = new URL(environment.DATABASE_URL ?? "");
  if (databaseUrl.hostname !== options["expected-database-host"]) {
    throw new Error("DATABASE_URL does not match --expected-database-host.");
  }
  return { databaseUrl: databaseUrl.toString() };
}

export async function provisionVehicleIntelligenceFixture(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.organization_id',$1,true),set_config('app.user_id','usr_synthetic_operator',true),set_config('app.auth_runtime','enabled',true)",
      [fixture.organizationId],
    );
    const target = await client.query(
      `SELECT organization.id organization_id, location.id location_id,
              configuration.id configuration_id, configuration.stable_key configuration_stable_key,
              configuration.readiness, trim.name trim_name, model_year.year,
              model.name model_name, make.name make_name
       FROM organizations organization
       JOIN locations location ON location.organization_id=organization.id
         AND location.id=$2 AND location.active=true
       JOIN vehicle_catalog_configurations configuration ON configuration.id=$3
       JOIN vehicle_catalog_trims trim ON trim.id=configuration.trim_id
       JOIN vehicle_catalog_model_years model_year ON model_year.id=trim.model_year_id
       JOIN vehicle_catalog_models model ON model.id=model_year.model_id
       JOIN vehicle_catalog_makes make ON make.id=model.make_id
       WHERE organization.id=$1 AND organization.active=true AND organization.data_class='demo'
       FOR UPDATE OF organization`,
      [fixture.organizationId, fixture.locationId, fixture.configurationId],
    );
    const identity = target.rows[0];
    if (!identity) throw new Error("The exact DEMO tenant, rooftop, and catalog configuration were not found.");
    assertCatalogIdentity(identity);

    const actor = await client.query(
      `SELECT membership.user_id
       FROM organization_memberships membership
       JOIN membership_roles membership_role ON membership_role.organization_id=membership.organization_id
         AND membership_role.membership_id=membership.id
       JOIN roles role ON role.organization_id=membership_role.organization_id
         AND role.id=membership_role.role_id AND role.key='inventory-manager'
       WHERE membership.organization_id=$1 AND membership.status='active'
       ORDER BY membership.created_at, membership.user_id
       LIMIT 1`,
      [fixture.organizationId],
    );
    const actorUserId = actor.rows[0]?.user_id;
    if (!actorUserId) throw new Error("An active canonical Inventory Manager is required.");

    const existing = await client.query(
      `SELECT vehicle.id vehicle_id, vehicle.vin, vehicle.year, vehicle.make, vehicle.model, vehicle.trim,
              inventory.id inventory_unit_id, inventory.stock_number, inventory.location_id,
              inventory.status, inventory.list_price_cents
       FROM vehicles vehicle
       JOIN inventory_units inventory ON inventory.organization_id=vehicle.organization_id
         AND inventory.vehicle_id=vehicle.id
       WHERE vehicle.organization_id=$1
         AND (vehicle.id=$2 OR vehicle.vin=$3 OR inventory.id=$4 OR inventory.stock_number=$5 OR inventory.idempotency_key=$6)`,
      [fixture.organizationId, fixture.vehicleId, fixture.vin, fixture.inventoryUnitId, fixture.stockNumber, fixture.idempotencyKey],
    );
    if (existing.rows.length) {
      if (existing.rows.length !== 1 || !matchesFixture(existing.rows[0])) {
        throw new Error("The governed fixture identity conflicts with existing staging data.");
      }
      await client.query("COMMIT");
      return { status: "existing", ...publicEvidence() };
    }

    await client.query(
      `INSERT INTO vehicles
        (id,organization_id,vin,year,make,model,trim,exterior_color,created_by,updated_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,NULL,$8,$8)`,
      [fixture.vehicleId, fixture.organizationId, fixture.vin, fixture.year, fixture.make, fixture.model, fixture.trim, actorUserId],
    );
    await client.query(
      `INSERT INTO inventory_units
        (id,organization_id,location_id,vehicle_id,stock_number,idempotency_key,status,list_price_cents,acquired_at,created_by,updated_by)
       VALUES($1,$2,$3,$4,$5,$6,'available',NULL,now(),$7,$7)`,
      [fixture.inventoryUnitId, fixture.organizationId, fixture.locationId, fixture.vehicleId, fixture.stockNumber, fixture.idempotencyKey, actorUserId],
    );
    await client.query(
      `INSERT INTO audit_logs
        (id,organization_id,action,entity_type,entity_id,source,correlation_id,new_values)
       VALUES($1,$2,'staging.synthetic_vehicle_intelligence_fixture.provisioned','inventory_unit',$3,
              'synthetic-acceptance-fixture',$4,$5::jsonb)`,
      [
        deterministicId("aud", fixture.idempotencyKey),
        fixture.organizationId,
        fixture.inventoryUnitId,
        fixture.idempotencyKey,
        JSON.stringify(publicEvidence()),
      ],
    );
    await client.query("COMMIT");
    return { status: "created", ...publicEvidence() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function assertCatalogIdentity(row) {
  const actual = {
    configurationId: row.configuration_id,
    configurationStableKey: row.configuration_stable_key,
    readiness: row.readiness,
    trim: row.trim_name,
    year: Number(row.year),
    model: row.model_name,
    make: row.make_name,
  };
  for (const field of ["configurationId", "configurationStableKey", "readiness", "trim", "year", "model", "make"]) {
    if (normalize(actual[field]) !== normalize(fixture[field])) {
      throw new Error(`Accepted catalog identity mismatch: ${field}.`);
    }
  }
  if (!['verified', 'pilot-ready'].includes(actual.readiness)) throw new Error("The catalog configuration is not eligible.");
}

function matchesFixture(row) {
  return row.vehicle_id === fixture.vehicleId && row.inventory_unit_id === fixture.inventoryUnitId &&
    row.vin === fixture.vin && Number(row.year) === fixture.year && normalize(row.make) === normalize(fixture.make) &&
    normalize(row.model) === normalize(fixture.model) && normalize(row.trim) === normalize(fixture.trim) &&
    row.stock_number === fixture.stockNumber && row.location_id === fixture.locationId &&
    row.status === "available" && row.list_price_cents === null;
}

function publicEvidence() {
  return {
    organizationId: fixture.organizationId,
    locationId: fixture.locationId,
    vehicleId: fixture.vehicleId,
    inventoryUnitId: fixture.inventoryUnitId,
    vin: fixture.vin,
    stockNumber: fixture.stockNumber,
    year: fixture.year,
    make: fixture.make,
    model: fixture.model,
    trim: fixture.trim,
    configurationId: fixture.configurationId,
    configurationStableKey: fixture.configurationStableKey,
    readiness: fixture.readiness,
  };
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deterministicId(prefix, value) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const pool = new Pool({ connectionString: input.databaseUrl, max: 1, application_name: "dealerflow-p1-02-fixture" });
  try {
    process.stdout.write(`${JSON.stringify(await provisionVehicleIntelligenceFixture(pool), null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Vehicle Intelligence fixture failed."}\n`);
    process.exitCode = 1;
  });
}
