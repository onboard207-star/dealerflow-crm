import type {
  CatalogMatchConfiguration,
  CatalogMatchVehicle,
  VehicleConfigurationMatch,
  VehicleConfigurationMatchProvider,
  VehicleConfigurationMatchSession,
} from "@/lib/application/vehicle-catalog";
import type { DatabasePool } from "@/lib/server/database";
import { withTenantDatabaseContext } from "@/lib/server/database";

interface QueryResult<Row> {
  rows: Row[];
}

interface Executor {
  query<Row>(queryText: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
}

export class PostgresVehicleConfigurationMatchProvider
  implements VehicleConfigurationMatchProvider
{
  constructor(
    private readonly pool: DatabasePool,
    private readonly context: { userId: string; organizationId: string },
  ) {}

  transaction<Result>(
    operation: (session: VehicleConfigurationMatchSession) => Promise<Result>,
  ): Promise<Result> {
    return withTenantDatabaseContext(this.pool, this.context, (client) =>
      operation(new Session(client as Executor)),
    );
  }
}

class Session implements VehicleConfigurationMatchSession {
  constructor(private readonly db: Executor) {}

  async findVehicle(
    organizationId: string,
    vehicleId: string,
  ): Promise<CatalogMatchVehicle | undefined> {
    const result = await this.db.query<VehicleRow>(
      `SELECT v.id, v.organization_id, inventory.location_id, v.year, v.make, v.model, v.trim
       FROM vehicles v
       JOIN LATERAL (
         SELECT i.location_id
         FROM inventory_units i
         WHERE i.organization_id = v.organization_id AND i.vehicle_id = v.id
         ORDER BY CASE WHEN i.status IN ('available', 'hold') THEN 0 ELSE 1 END,
                  i.updated_at DESC, i.id DESC
         LIMIT 1
       ) inventory ON true
       WHERE v.organization_id = $1 AND v.id = $2
       LIMIT 1`,
      [organizationId, vehicleId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          organizationId: row.organization_id,
          locationId: row.location_id,
          year: row.year,
          make: row.make,
          model: row.model,
          ...(row.trim ? { trim: row.trim } : {}),
        }
      : undefined;
  }

  async findConfiguration(
    configurationId: string,
  ): Promise<CatalogMatchConfiguration | undefined> {
    const result = await this.db.query<ConfigurationRow>(
      `SELECT configuration.id, model_year.year, make.name AS make, model.name AS model,
              trim.name AS trim, configuration.readiness
       FROM vehicle_catalog_configurations configuration
       JOIN vehicle_catalog_trims trim ON trim.id = configuration.trim_id
       JOIN vehicle_catalog_model_years model_year ON model_year.id = trim.model_year_id
       JOIN vehicle_catalog_models model ON model.id = model_year.model_id
       JOIN vehicle_catalog_makes make ON make.id = model.make_id
       WHERE configuration.id = $1
       LIMIT 1`,
      [configurationId],
    );
    return result.rows[0];
  }

  async findVerified(
    organizationId: string,
    vehicleId: string,
  ): Promise<VehicleConfigurationMatch | undefined> {
    const result = await this.db.query<MatchRow>(
      `SELECT id, organization_id, vehicle_id, configuration_id, status, source,
              evidence, matched_by
       FROM vehicle_catalog_matches
       WHERE organization_id = $1 AND vehicle_id = $2 AND status = 'verified'
       LIMIT 1`,
      [organizationId, vehicleId],
    );
    const row = result.rows[0];
    if (!row || row.status !== "verified" || !row.matched_by) return undefined;
    return {
      id: row.id,
      organizationId: row.organization_id,
      vehicleId: row.vehicle_id,
      configurationId: row.configuration_id,
      status: "verified",
      source: row.source,
      evidence: row.evidence,
      matchedBy: row.matched_by,
    };
  }

  async insert(match: VehicleConfigurationMatch): Promise<void> {
    await this.db.query(
      `INSERT INTO vehicle_catalog_matches
        (id, organization_id, vehicle_id, configuration_id, status, source, evidence, matched_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        match.id,
        match.organizationId,
        match.vehicleId,
        match.configurationId,
        match.status,
        match.source,
        JSON.stringify(match.evidence),
        match.matchedBy,
      ],
    );
  }
}

interface VehicleRow {
  id: string;
  organization_id: string;
  location_id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
}

type ConfigurationRow = CatalogMatchConfiguration;

interface MatchRow {
  id: string;
  organization_id: string;
  vehicle_id: string;
  configuration_id: string;
  status: string;
  source: string;
  evidence: VehicleConfigurationMatch["evidence"];
  matched_by: string | null;
}
