import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface VehicleWorkspaceRecord {
  inventory: {
    id: string;
    vehicleId: string;
    locationId: string;
    locationName: string;
    stockNumber: string;
    status: string;
    listPriceCents?: number;
    acquiredAt?: string;
    soldAt?: string;
    updatedAt: string;
  };
  vehicle: {
    vin: string;
    year: number;
    make: string;
    model: string;
    trim?: string;
    exteriorColor?: string;
  };
  catalogIntelligence?: {
    configurationId: string;
    configurationName: string;
    readiness: string;
    drivetrain?: string;
    powertrain?: string;
    engine?: string;
    transmission?: string;
    bodyStyle?: string;
    seatCount?: number;
    matchedAt: string;
    attributes: readonly { kind: string; name: string; value?: string; unit?: string }[];
  };
  media: readonly {
    id: string;
    url: string;
    contentType: "image/jpeg" | "image/png" | "image/webp";
    width: number;
    height: number;
    altText: string;
    sortOrder: number;
    capturedAt?: string;
    verifiedAt: string;
    sourceType: "actual" | "cgi-reference" | "oem-reference";
    isPrimary: boolean;
    originalFilename?: string;
  }[];
  events: readonly {
    id: string;
    kind: string;
    fromStatus?: string;
    toStatus: string;
    oldPriceCents?: number;
    newPriceCents?: number;
    reason?: string;
    occurredAt: string;
  }[];
  matches: readonly {
    interestId: string;
    customerId: string;
    customerName: string;
    leadId: string;
    leadStatus: string;
    leadStage: string;
    assignedUserName?: string;
    role: string;
  }[];
  deals: readonly {
    id: string;
    customerId: string;
    customerName: string;
    dealNumber: string;
    status: string;
    agreedPriceCents?: number;
  }[];
}

interface VehicleWorkspaceScope {
  userId: string;
  organizationId: string;
  locationIds: readonly string[] | "all";
  includeCustomerMatches: boolean;
  includeDeals: boolean;
}

export class VehicleWorkspaceReader {
  constructor(private readonly pool: DatabasePool) {}

  read(scope: VehicleWorkspaceScope, inventoryUnitId: string): Promise<VehicleWorkspaceRecord | null> {
    return withTenantDatabaseContext(this.pool, { userId: scope.userId, organizationId: scope.organizationId }, async (client) => {
      const allLocations = scope.locationIds === "all";
      const locationIds = allLocations ? [] : [...scope.locationIds];
      const result = await client.query(
        `SELECT i.id, i.vehicle_id, i.location_id, l.name AS location_name, i.stock_number,
          i.status::text, i.list_price_cents, i.acquired_at, i.sold_at, i.updated_at,
          v.vin, v.year, v.make, v.model, v.trim, v.exterior_color
        FROM inventory_units i
        JOIN vehicles v ON v.organization_id=i.organization_id AND v.id=i.vehicle_id
        JOIN locations l ON l.organization_id=i.organization_id AND l.id=i.location_id
        WHERE i.organization_id=$1 AND i.id=$2 AND ($3::boolean OR i.location_id=ANY($4::text[]))`,
        [scope.organizationId, inventoryUnitId, allLocations, locationIds],
      ) as { rows: InventoryRow[] };
      const row = result.rows[0];
      if (!row) return null;

      const mediaResult = await client.query(
        `SELECT id,delivery_url,content_type,width,height,alt_text,sort_order,captured_at,verified_at,source_type,is_primary,original_filename
        FROM inventory_unit_media
        WHERE organization_id=$1 AND inventory_unit_id=$2 AND location_id=$3 AND vehicle_id=$4 AND status='active'
        ORDER BY is_primary DESC,sort_order,id LIMIT 50`,
        [scope.organizationId, inventoryUnitId, row.location_id, row.vehicle_id],
      ) as { rows: MediaRow[] };

      const eventResult = await client.query(
        `SELECT id,kind,from_status::text,to_status::text,old_price_cents,new_price_cents,reason,occurred_at
        FROM inventory_unit_events WHERE organization_id=$1 AND inventory_unit_id=$2
        ORDER BY occurred_at DESC,id DESC LIMIT 50`,
        [scope.organizationId, inventoryUnitId],
      ) as { rows: EventRow[] };
      const catalogResult = await client.query(
        `SELECT configuration.id AS configuration_id, configuration.name AS configuration_name,
          configuration.readiness, configuration.drivetrain, configuration.powertrain,
          configuration.engine, configuration.transmission, configuration.body_style,
          configuration.seat_count, match.matched_at,
          COALESCE(jsonb_agg(jsonb_build_object(
            'kind', attribute.kind, 'name', attribute.name, 'value', attribute.value, 'unit', attribute.unit
          ) ORDER BY attribute.kind, attribute.name)
          FILTER (WHERE attribute.id IS NOT NULL), '[]'::jsonb) AS attributes
        FROM vehicle_catalog_matches match
        JOIN vehicle_catalog_configurations configuration ON configuration.id=match.configuration_id
        LEFT JOIN vehicle_catalog_configuration_attributes relationship
          ON relationship.configuration_id=configuration.id
        LEFT JOIN vehicle_catalog_attributes attribute ON attribute.id=relationship.attribute_id
        WHERE match.organization_id=$1 AND match.vehicle_id=$2 AND match.status='verified'
        GROUP BY configuration.id,match.matched_at
        LIMIT 1`,
        [scope.organizationId, row.vehicle_id],
      ) as { rows: CatalogRow[] };
      const matchResult = scope.includeCustomerMatches ? await client.query(
        `SELECT interest.id AS interest_id,interest.customer_id,customer.display_name AS customer_name,
          lead.id AS lead_id,lead.status::text AS lead_status,lead.stage AS lead_stage,
          owner.display_name AS assigned_user_name,interest.role::text
        FROM lead_vehicle_interests interest
        JOIN customers customer ON customer.organization_id=interest.organization_id AND customer.id=interest.customer_id
        JOIN leads lead ON lead.organization_id=interest.organization_id AND lead.id=interest.lead_id
        LEFT JOIN users owner ON owner.id=lead.assigned_user_id
        WHERE interest.organization_id=$1 AND interest.vehicle_id=$2 AND interest.status='active'
          AND lead.status IN ('open','working','qualified')
          AND ($3::boolean OR lead.location_id=ANY($4::text[]))
        ORDER BY CASE interest.role WHEN 'primary' THEN 0 ELSE 1 END,lead.updated_at DESC LIMIT 25`,
        [scope.organizationId, row.vehicle_id, allLocations, locationIds],
      ) as { rows: MatchRow[] } : { rows: [] };
      const dealResult = scope.includeDeals ? await client.query(
        `SELECT deal.id,deal.customer_id,customer.display_name AS customer_name,deal.deal_number,
          deal.status::text,deal.agreed_price_cents
        FROM deals deal JOIN customers customer ON customer.organization_id=deal.organization_id AND customer.id=deal.customer_id
        WHERE deal.organization_id=$1 AND deal.inventory_unit_id=$2
          AND ($3::boolean OR deal.location_id=ANY($4::text[]))
        ORDER BY deal.updated_at DESC LIMIT 25`,
        [scope.organizationId, inventoryUnitId, allLocations, locationIds],
      ) as { rows: DealRow[] } : { rows: [] };

      return {
        inventory: {
          id: row.id, vehicleId: row.vehicle_id, locationId: row.location_id, locationName: row.location_name,
          stockNumber: row.stock_number, status: row.status, updatedAt: row.updated_at.toISOString(),
          ...(row.list_price_cents !== null ? { listPriceCents: row.list_price_cents } : {}),
          ...(row.acquired_at ? { acquiredAt: row.acquired_at.toISOString() } : {}),
          ...(row.sold_at ? { soldAt: row.sold_at.toISOString() } : {}),
        },
        vehicle: {
          vin: row.vin, year: row.year, make: row.make, model: row.model,
          ...(row.trim ? { trim: row.trim } : {}),
          ...(row.exterior_color ? { exteriorColor: row.exterior_color } : {}),
        },
        ...(catalogResult.rows[0]
          ? { catalogIntelligence: catalog(catalogResult.rows[0]) }
          : {}),
        media: mediaResult.rows.map((asset) => ({
          id: asset.id,
          url: asset.delivery_url,
          contentType: asset.content_type,
          width: asset.width,
          height: asset.height,
          altText: asset.alt_text,
          sortOrder: asset.sort_order,
          ...(asset.captured_at ? { capturedAt: asset.captured_at.toISOString() } : {}),
          verifiedAt: asset.verified_at.toISOString(),
          sourceType: asset.source_type,
          isPrimary: asset.is_primary,
          ...(asset.original_filename ? { originalFilename: asset.original_filename } : {}),
        })),
        events: eventResult.rows.map((event) => ({
          id: event.id, kind: event.kind, toStatus: event.to_status, occurredAt: event.occurred_at.toISOString(),
          ...(event.from_status ? { fromStatus: event.from_status } : {}),
          ...(event.old_price_cents !== null ? { oldPriceCents: event.old_price_cents } : {}),
          ...(event.new_price_cents !== null ? { newPriceCents: event.new_price_cents } : {}),
          ...(event.reason ? { reason: event.reason } : {}),
        })),
        matches: matchResult.rows.map((match) => ({
          interestId: match.interest_id, customerId: match.customer_id, customerName: match.customer_name,
          leadId: match.lead_id, leadStatus: match.lead_status, leadStage: match.lead_stage, role: match.role,
          ...(match.assigned_user_name ? { assignedUserName: match.assigned_user_name } : {}),
        })),
        deals: dealResult.rows.map((deal) => ({
          id: deal.id, customerId: deal.customer_id, customerName: deal.customer_name,
          dealNumber: deal.deal_number, status: deal.status,
          ...(deal.agreed_price_cents !== null ? { agreedPriceCents: deal.agreed_price_cents } : {}),
        })),
      };
    });
  }
}

interface InventoryRow { id:string;vehicle_id:string;location_id:string;location_name:string;stock_number:string;status:string;list_price_cents:number|null;acquired_at:Date|null;sold_at:Date|null;updated_at:Date;vin:string;year:number;make:string;model:string;trim:string|null;exterior_color:string|null }
interface MediaRow { id:string;delivery_url:string;content_type:"image/jpeg"|"image/png"|"image/webp";width:number;height:number;alt_text:string;sort_order:number;captured_at:Date|null;verified_at:Date;source_type:"actual"|"cgi-reference"|"oem-reference";is_primary:boolean;original_filename:string|null }
interface EventRow { id:string;kind:string;from_status:string|null;to_status:string;old_price_cents:number|null;new_price_cents:number|null;reason:string|null;occurred_at:Date }
interface MatchRow { interest_id:string;customer_id:string;customer_name:string;lead_id:string;lead_status:string;lead_stage:string;assigned_user_name:string|null;role:string }
interface DealRow { id:string;customer_id:string;customer_name:string;deal_number:string;status:string;agreed_price_cents:number|null }
interface CatalogRow { configuration_id:string;configuration_name:string;readiness:string;drivetrain:string|null;powertrain:string|null;engine:string|null;transmission:string|null;body_style:string|null;seat_count:number|null;matched_at:Date;attributes:readonly {kind:string;name:string;value:string|null;unit:string|null}[] }

function catalog(row: CatalogRow): NonNullable<VehicleWorkspaceRecord["catalogIntelligence"]> {
  return {
    configurationId: row.configuration_id,
    configurationName: row.configuration_name,
    readiness: row.readiness,
    ...(row.drivetrain ? { drivetrain: row.drivetrain } : {}),
    ...(row.powertrain ? { powertrain: row.powertrain } : {}),
    ...(row.engine ? { engine: row.engine } : {}),
    ...(row.transmission ? { transmission: row.transmission } : {}),
    ...(row.body_style ? { bodyStyle: row.body_style } : {}),
    ...(row.seat_count !== null ? { seatCount: row.seat_count } : {}),
    matchedAt: row.matched_at.toISOString(),
    attributes: row.attributes.map((attribute) => ({
      kind: attribute.kind,
      name: attribute.name,
      ...(attribute.value ? { value: attribute.value } : {}),
      ...(attribute.unit ? { unit: attribute.unit } : {}),
    })),
  };
}
