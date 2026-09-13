import { AppShell } from "@/components/app-shell";
import { VehicleCatalogComparisonWorkflow } from "@/components/inventory/VehicleCatalogComparisonWorkflow";
import { VehicleConfigurationComparison } from "@/components/inventory/VehicleConfigurationComparison";
import { VehicleConfigurationComparisonService } from "@/lib/application/vehicle-catalog";
import { PostgresVehicleCatalogRepository } from "@/lib/server/vehicles";
import { loadDirectoryContext } from "../../_lib/load-directory-context";

export const dynamic="force-dynamic";
export default async function VehicleComparePage({params,searchParams}:{params:Promise<{organizationId:string}>;searchParams:Promise<{configuration?:string|string[]}>}) {
  const {organizationId}=await params; const query=await searchParams; const context=await loadDirectoryContext(organizationId,"inventory.read");
  const repository=new PostgresVehicleCatalogRepository(context.pool); const configurations=await repository.searchConfigurations({readiness:["verified","pilot-ready"],limit:250});
  const options=configurations.map(item=>({configurationId:item.id,makeId:item.make.id,make:item.make.name,modelId:item.model.id,model:item.model.name,modelYearId:item.modelYear.id,year:item.modelYear.year,trimId:item.trim.id,trim:item.trim.name,configuration:item.name,readiness:item.readiness}));
  const selected=(Array.isArray(query.configuration)?query.configuration:query.configuration?[query.configuration]:[]).slice(0,3); let comparison;
  try { if(selected.length>=2) comparison=await new VehicleConfigurationComparisonService(repository).compare(selected); } catch { comparison=undefined; }
  const base=`/organizations/${organizationId}/inventory/compare`;
  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={`/organizations/${organizationId}/inventory`} breadcrumbs={[{label:context.organization.name},{label:"Inventory"},{label:"Compare"}]} user={{name:context.session.user.name,email:context.session.user.email,...(context.session.user.image?{image:context.session.user.image}:{})}}><main className="mx-auto max-w-7xl space-y-6"><header><h1 className="text-2xl font-semibold tracking-tight">Vehicle Intelligence comparison</h1><p className="mt-1 text-sm text-muted-foreground">Evidence-backed catalog facts for dealership conversations.</p></header><VehicleCatalogComparisonWorkflow basePath={base} options={options} initial={selected}/>{comparison?<VehicleConfigurationComparison comparison={comparison}/>:selected.length?<p role="alert" className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">The selected comparison is unavailable or incomplete. Choose another governed configuration.</p>:null}</main></AppShell>;
}
