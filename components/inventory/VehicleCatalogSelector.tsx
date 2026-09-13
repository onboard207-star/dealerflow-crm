"use client";

import { useMemo, useState } from "react";
import type { VehicleCatalogReadiness } from "@/lib/application/vehicle-catalog";

export interface VehicleCatalogSelectorOption {
  configurationId: string;
  makeId: string;
  make: string;
  modelId: string;
  model: string;
  modelYearId: string;
  year: number;
  trimId: string;
  trim: string;
  configuration: string;
  readiness: VehicleCatalogReadiness;
}

interface VehicleCatalogSelectorProps {
  options: readonly VehicleCatalogSelectorOption[];
  value?: string;
  onChange: (configurationId: string | undefined) => void;
  idPrefix?: string;
}

export function VehicleCatalogSelector({ options, value, onChange, idPrefix = "vehicle-catalog" }: VehicleCatalogSelectorProps) {
  const selected = options.find((item) => item.configurationId === value);
  const [makeId, setMakeId] = useState(selected?.makeId ?? "");
  const [modelId, setModelId] = useState(selected?.modelId ?? "");
  const [modelYearId, setModelYearId] = useState(selected?.modelYearId ?? "");
  const [trimId, setTrimId] = useState(selected?.trimId ?? "");
  const makes = unique(options, "makeId", "make");
  const models = unique(options.filter((item) => item.makeId === makeId), "modelId", "model");
  const years = unique(options.filter((item) => item.modelId === modelId), "modelYearId", "year");
  const trims = unique(options.filter((item) => item.modelYearId === modelYearId), "trimId", "trim");
  const configurations = useMemo(() => options.filter((item) => item.trimId === trimId), [options, trimId]);
  const reset = (level: "make"|"model"|"year"|"trim") => {
    if (level === "make") setModelId("");
    if (level === "make" || level === "model") setModelYearId("");
    if (level !== "trim") setTrimId("");
    onChange(undefined);
  };
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <legend className="sr-only">Select an exact vehicle catalog configuration</legend>
      <Select id={`${idPrefix}-make`} label="Make" value={makeId} options={makes} onChange={(next) => {setMakeId(next);reset("make");}} />
      <Select id={`${idPrefix}-model`} label="Model" value={modelId} options={models} disabled={!makeId} onChange={(next) => {setModelId(next);reset("model");}} />
      <Select id={`${idPrefix}-year`} label="Model year" value={modelYearId} options={years} disabled={!modelId} onChange={(next) => {setModelYearId(next);reset("year");}} />
      <Select id={`${idPrefix}-trim`} label="Trim" value={trimId} options={trims} disabled={!modelYearId} onChange={(next) => {setTrimId(next);reset("trim");}} />
      <Select id={`${idPrefix}-configuration`} label="Configuration" value={value ?? ""} options={configurations.map((item) => ({value:item.configurationId,label:item.configuration}))} disabled={!trimId} onChange={(next) => onChange(next || undefined)} />
    </fieldset>
  );
}

function Select({id,label,value,options,disabled,onChange}:{id:string;label:string;value:string;options:readonly {value:string;label:string}[];disabled?:boolean;onChange:(value:string)=>void}) {
  return <label className="text-sm font-medium" htmlFor={id}>{label}<select id={id} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" value={value} disabled={disabled} onChange={(event)=>onChange(event.target.value)}><option value="">Select {label.toLowerCase()}</option>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function unique<T extends VehicleCatalogSelectorOption>(items:readonly T[],id:keyof T,label:keyof T){const map=new Map<string,string>();for(const item of items)map.set(String(item[id]),String(item[label]));return [...map].map(([value,text])=>({value,label:text}));}
