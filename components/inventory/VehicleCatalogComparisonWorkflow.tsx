"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VehicleCatalogSelector, type VehicleCatalogSelectorOption } from "./VehicleCatalogSelector";

export function VehicleCatalogComparisonWorkflow({basePath,options,initial}:{basePath:string;options:readonly VehicleCatalogSelectorOption[];initial:readonly string[]}) {
  const router=useRouter(); const [values,setValues]=useState<Array<string|undefined>>([initial[0],initial[1],initial[2]]);
  const update=(index:number,value:string|undefined)=>setValues(current=>current.map((item,position)=>position===index?value:item));
  const selected=values.filter((value):value is string=>Boolean(value)); const valid=new Set(selected).size===selected.length&&selected.length>=2;
  return <section aria-labelledby="catalog-selection-heading" className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
    <h2 id="catalog-selection-heading" className="text-lg font-semibold">Choose configurations</h2><p className="mt-1 text-sm text-muted-foreground">Compare two or three governed, catalog-backed configurations. Inventory and VIN identity remain separate.</p>
    <div className="mt-5 space-y-6">{[0,1,2].map(index=><div key={index}><h3 className="mb-3 text-sm font-semibold">Vehicle {String.fromCharCode(65+index)}{index===2?" (optional)":""}</h3><VehicleCatalogSelector idPrefix={`comparison-${index}`} options={options} value={values[index]} onChange={value=>update(index,value)}/></div>)}</div>
    <button type="button" disabled={!valid} onClick={()=>router.push(`${basePath}?${selected.map(id=>`configuration=${encodeURIComponent(id)}`).join("&")}`)} className="focus-ring mt-6 min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">Compare vehicles</button>
  </section>;
}
