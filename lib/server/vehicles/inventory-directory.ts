import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface InventoryDirectoryItem { inventoryId: string; vehicleId: string; locationId: string; stockNumber: string; status: string; listPriceCents?: number; vin: string; year: number; make: string; model: string; trim?: string; exteriorColor?: string;updatedAt:string;primaryImage?:{url:string;altText:string;sourceType:"actual"|"cgi-reference"|"oem-reference"} }
export class InventoryDirectoryError extends Error { constructor(message: string) { super(message); this.name = "InventoryDirectoryError"; } }

export class InventoryDirectoryReader {
  constructor(private readonly pool: DatabasePool) {}
  list(context: { userId: string; organizationId: string; locationIds: readonly string[] | "all" }, query: { search?: string; status?: string; limit?: number }): Promise<{ records: InventoryDirectoryItem[] }> {
    const limit = query.limit ?? 25; if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new InventoryDirectoryError("limit must be between 1 and 100.");
    const search = query.search?.trim().slice(0, 100) ?? ""; const statuses = ["available", "hold", "sold", "unavailable"];
    if (query.status && !statuses.includes(query.status)) throw new InventoryDirectoryError("status is invalid.");
    return withTenantDatabaseContext(this.pool, { userId: context.userId, organizationId: context.organizationId }, async (client) => {
      const allLocations = context.locationIds === "all"; const locations = allLocations ? [] : [...context.locationIds];
      const result = (await client.query(`SELECT i.id AS inventory_id, i.vehicle_id, i.location_id, i.stock_number, i.status,
          i.list_price_cents,i.updated_at, v.vin, v.year, v.make, v.model, v.trim, v.exterior_color,
          media.delivery_url AS media_url,media.alt_text AS media_alt_text,media.source_type AS media_source_type
        FROM inventory_units i JOIN vehicles v ON v.organization_id = i.organization_id AND v.id = i.vehicle_id
        LEFT JOIN LATERAL (SELECT delivery_url,alt_text,source_type FROM inventory_unit_media
          WHERE organization_id=i.organization_id AND inventory_unit_id=i.id AND status='active'
          ORDER BY CASE source_type WHEN 'actual' THEN 0 WHEN 'oem-reference' THEN 1 ELSE 2 END,is_primary DESC,sort_order,id LIMIT 1) media ON true
        WHERE i.organization_id = $1 AND ($2::boolean OR i.location_id = ANY($3::text[]))
          AND ($4 = '' OR i.stock_number ILIKE '%' || $4 || '%' OR v.vin ILIKE '%' || $4 || '%'
            OR (v.year::text || ' ' || v.make || ' ' || v.model || ' ' || coalesce(v.trim,'')) ILIKE '%' || $4 || '%')
          AND ($5::text IS NULL OR i.status::text = $5)
        ORDER BY CASE i.status WHEN 'available' THEN 0 WHEN 'hold' THEN 1 WHEN 'unavailable' THEN 2 ELSE 3 END,
          i.updated_at DESC, i.id DESC LIMIT $6`, [context.organizationId, allLocations, locations, search, query.status ?? null, limit])) as { rows: Array<{ inventory_id: string; vehicle_id: string; location_id: string; stock_number: string; status: string; list_price_cents: number | null;updated_at:Date;vin: string; year: number; make: string; model: string; trim: string | null; exterior_color: string | null;media_url:string|null;media_alt_text:string|null;media_source_type:"actual"|"cgi-reference"|"oem-reference"|null }> };
      return { records: result.rows.map((row) => ({ inventoryId: row.inventory_id, vehicleId: row.vehicle_id, locationId: row.location_id,
        stockNumber: row.stock_number, status: row.status, ...(row.list_price_cents !== null ? { listPriceCents: row.list_price_cents } : {}),
        vin: row.vin, year: row.year, make: row.make, model: row.model, ...(row.trim ? { trim: row.trim } : {}),
        ...(row.exterior_color ? { exteriorColor: row.exterior_color } : {}),updatedAt:row.updated_at.toISOString(),...(row.media_url&&row.media_alt_text&&row.media_source_type?{primaryImage:{url:row.media_url,altText:row.media_alt_text,sourceType:row.media_source_type}}:{}) })) };
    });
  }
}
