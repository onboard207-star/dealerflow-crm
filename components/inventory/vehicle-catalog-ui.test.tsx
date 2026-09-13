import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VehicleCatalogSelector, type VehicleCatalogSelectorOption } from "./VehicleCatalogSelector";
import { VehicleConfigurationComparison } from "./VehicleConfigurationComparison";
import { VehicleCatalogComparisonWorkflow } from "./VehicleCatalogComparisonWorkflow";

const options:readonly VehicleCatalogSelectorOption[]=[{configurationId:"vcf_honda",makeId:"vma_honda",make:"Honda",modelId:"vmo_crv",model:"CR-V",modelYearId:"vmy_2026",year:2026,trimId:"vtr_sport",trim:"Sport-L Hybrid",configuration:"AWD",readiness:"pilot-ready"}];
describe("vehicle catalog UI",()=>{
  it("renders one reusable cascading selector with all hierarchy levels",()=>{const html=renderToStaticMarkup(createElement(VehicleCatalogSelector,{options,onChange:()=>{}}));for(const label of["Make","Model","Model year","Trim","Configuration"])expect(html).toContain(label);expect(html).toContain("disabled");});
  it("renders unavailable comparison facts explicitly",()=>{const html=renderToStaticMarkup(createElement(VehicleConfigurationComparison,{comparison:{configurations:[],facts:[{key:"range",label:"EV range",values:[{configurationId:"a",state:"unavailable"}]}]}}));expect(html).toContain("Unavailable");expect(html).toContain("never treated as zero");});
  it("mounts two required selectors and one optional selector in the comparison workflow",()=>{const html=renderToStaticMarkup(createElement(VehicleCatalogComparisonWorkflow,{basePath:"/inventory/compare",options,initial:[]}));expect(html).toContain("Vehicle A");expect(html).toContain("Vehicle B");expect(html).toContain("Vehicle C (optional)");expect(html).toContain("Compare vehicles");});
});
