import type { Pool } from "pg";
import type { VehicleCatalogReadiness } from "@/lib/application/vehicle-catalog";

export interface VehicleCatalogReadinessSnapshot { releaseId?:string; sourceRevision?:string; counts:Readonly<Record<string,number>>; readiness:Readonly<Record<VehicleCatalogReadiness,number>> }
export class VehicleCatalogReadinessReader {
  constructor(private readonly pool:Pool) {}
  async read():Promise<VehicleCatalogReadinessSnapshot> {
    const [release,counts,readiness]=await Promise.all([
      this.pool.query<{id:string;source_revision:string}>("SELECT id,source_revision FROM vehicle_catalog_releases WHERE status='accepted' ORDER BY completed_at DESC LIMIT 1"),
      this.pool.query<{kind:string;count:string}>(`SELECT kind,count(*)::text AS count FROM (SELECT 'makes' kind FROM vehicle_catalog_makes UNION ALL SELECT 'models' FROM vehicle_catalog_models UNION ALL SELECT 'model-years' FROM vehicle_catalog_model_years UNION ALL SELECT 'trims' FROM vehicle_catalog_trims UNION ALL SELECT 'configurations' FROM vehicle_catalog_configurations UNION ALL SELECT kind FROM vehicle_catalog_attributes UNION ALL SELECT 'comparisons' FROM vehicle_catalog_model_comparisons) records GROUP BY kind ORDER BY kind`),
      this.pool.query<{readiness:VehicleCatalogReadiness;count:string}>(`SELECT readiness,count(*)::text AS count FROM (SELECT readiness FROM vehicle_catalog_model_years UNION ALL SELECT readiness FROM vehicle_catalog_trims UNION ALL SELECT readiness FROM vehicle_catalog_configurations UNION ALL SELECT readiness FROM vehicle_catalog_model_comparisons) records GROUP BY readiness ORDER BY readiness`),
    ]);
    const current=release.rows[0]; const base:Record<VehicleCatalogReadiness,number>={"needs-review":0,"in-progress":0,verified:0,"pilot-ready":0,blocked:0,"not-applicable":0};
    for(const row of readiness.rows)base[row.readiness]=Number(row.count);
    return {...(current?{releaseId:current.id,sourceRevision:current.source_revision}:{}),counts:Object.fromEntries(counts.rows.map(row=>[row.kind,Number(row.count)])),readiness:base};
  }
}
