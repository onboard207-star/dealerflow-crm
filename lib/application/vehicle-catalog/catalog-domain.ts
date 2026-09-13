import type { VehicleCatalogAttributeKind, VehicleCatalogReadiness } from "./vehicle-catalog";

export interface CatalogProvenance {
  sourceSystem: string;
  sourceRecordId?: string;
  releaseId: string;
  readiness: VehicleCatalogReadiness;
}

export interface CatalogIdentity extends CatalogProvenance {
  id: string;
  stableKey: string;
  name: string;
}

export type CatalogMake = CatalogIdentity;
export interface CatalogModel extends CatalogIdentity { makeId: string; vehicleClass?: string }
export interface CatalogModelYear extends CatalogIdentity { modelId: string; year: number; generation?: string }
export interface CatalogTrim extends CatalogIdentity { modelYearId: string; badge?: string }

export type CatalogAttributeRelationship = "standard" | "optional" | "available" | "excluded" | "requires";
export interface CatalogAttribute extends CatalogIdentity {
  kind: VehicleCatalogAttributeKind;
  value?: string;
  unit?: string;
  metadata: Readonly<Record<string, unknown>>;
  relationship: CatalogAttributeRelationship;
  conditions: Readonly<Record<string, unknown>>;
}
export type CatalogSpecification = CatalogAttribute & { kind: "specification" };
export type CatalogFeature = CatalogAttribute & { kind: "feature" };
export type CatalogPackageOption = CatalogAttribute & { kind: "package" };
export type CatalogOEMPaint = CatalogAttribute & { kind: "exterior-color" };
export type CatalogOEMInterior = CatalogAttribute & { kind: "interior-color" };
export interface CatalogExteriorPaintEligibility { configurationId: string; paint: CatalogOEMPaint; relationship: CatalogAttributeRelationship; conditions: Readonly<Record<string, unknown>> }
export interface CatalogInteriorEligibility { configurationId: string; interior: CatalogOEMInterior; relationship: CatalogAttributeRelationship; conditions: Readonly<Record<string, unknown>> }
export interface CatalogColorRule { stableKey: string; exteriorPaintId: string; interiorIds: readonly string[]; availability: "available" | "excluded"; conditions: Readonly<Record<string, unknown>> }
export interface CatalogComparisonModel { id: string; stableKey: string; makeId: string; make: string; model: string }
export interface CatalogModelComparison extends CatalogProvenance { id: string; stableKey: string; subjectModel: CatalogComparisonModel; competitorModel: CatalogComparisonModel; categories: readonly string[]; relationship: string; evidence: Readonly<Record<string, unknown>> }

export interface CatalogConfiguration extends CatalogIdentity {
  trimId: string;
  make: CatalogMake;
  model: CatalogModel;
  modelYear: CatalogModelYear;
  trim: CatalogTrim;
  drivetrain?: string;
  powertrain?: string;
  engine?: string;
  transmission?: string;
  bodyStyle?: string;
  seatCount?: number;
  attributes: readonly CatalogAttribute[];
}

export interface VehicleCatalogSearchQuery {
  make?: string;
  model?: string;
  year?: number;
  trim?: string;
  configuration?: string;
  readiness?: readonly VehicleCatalogReadiness[];
  limit?: number;
}

export interface VehicleCatalogRepository {
  listMakes(): Promise<readonly CatalogMake[]>;
  listModels(makeId: string): Promise<readonly CatalogModel[]>;
  listModelYears(modelId: string): Promise<readonly CatalogModelYear[]>;
  listTrims(modelYearId: string): Promise<readonly CatalogTrim[]>;
  listConfigurations(trimId: string): Promise<readonly CatalogConfiguration[]>;
  getConfiguration(configurationId: string): Promise<CatalogConfiguration | undefined>;
  searchConfigurations(query: VehicleCatalogSearchQuery): Promise<readonly CatalogConfiguration[]>;
  listCompetitors(modelId: string): Promise<readonly CatalogModelComparison[]>;
}
