"use client";
/* eslint-disable @next/next/no-img-element -- verified provider origins are dynamic and require an in-browser broken-object fallback. */

import { useEffect, useState } from "react";
import { CarFront, ChevronLeft, ChevronRight, ImageOff, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InventoryMediaControls } from "./InventoryMediaControls";

export interface VerifiedVehicleMediaAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  altText: string;
  verifiedAt: string;
  sourceType: "actual" | "cgi-reference" | "oem-reference";
  isPrimary: boolean;
  originalFilename?: string;
}

interface VerifiedVehicleMediaProps {
  assets: readonly VerifiedVehicleMediaAsset[];
  management?: { organizationId: string; inventoryUnitId: string };
}

export function VerifiedVehicleMedia({ assets, management }: VerifiedVehicleMediaProps) {
  const [selectedId, setSelectedId] = useState(assets[0]?.id);
  const [brokenIds, setBrokenIds] = useState<readonly string[]>([]);
  useEffect(() => setSelectedId(assets[0]?.id), [assets]);
  if (!assets.length) return <EmptyMedia />;
  const selectedIndex = Math.max(0, assets.findIndex((asset) => asset.id === selectedId));
  const selected = assets[selectedIndex]!;
  const broken = brokenIds.includes(selected.id);
  const selectOffset = (offset: number) => setSelectedId(assets[(selectedIndex + offset + assets.length) % assets.length]!.id);
  const markBroken = (id: string) => setBrokenIds((current) => current.includes(id) ? current : [...current, id]);

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-soft" aria-labelledby="media-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div><h2 id="media-heading" className="font-medium">Vehicle photos</h2><p className="text-xs text-muted-foreground">{selectedIndex + 1} of {assets.length}</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium"><ShieldCheck aria-hidden="true" className="size-3.5" />{sourceLabel(selected.sourceType)}</span>
      </div>
      <div className="relative flex min-h-72 items-center justify-center bg-muted/30 sm:min-h-[28rem]">
        {broken ? <BrokenMedia /> : <>{/* Verified dynamic provider URL; browser fallback is required for broken objects. */}{/* eslint-disable-next-line @next/next/no-img-element */}<img alt={selected.altText} className="max-h-[38rem] w-full object-contain" decoding="async" height={selected.height} onError={() => markBroken(selected.id)} src={selected.url} width={selected.width} /></>}
        {assets.length > 1 ? <><Button aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 shadow-md" onClick={() => selectOffset(-1)} size="icon" type="button" variant="secondary"><ChevronLeft aria-hidden="true" className="size-5" /></Button><Button aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 shadow-md" onClick={() => selectOffset(1)} size="icon" type="button" variant="secondary"><ChevronRight aria-hidden="true" className="size-5" /></Button></> : null}
      </div>
      <div className="border-t p-3"><div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Vehicle photo thumbnails">{assets.map((asset) => <div key={asset.id} role="listitem"><button aria-label={`View photo: ${asset.altText}`} aria-pressed={asset.id === selected.id} className="focus-ring relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted aria-pressed:ring-2 aria-pressed:ring-primary" onClick={() => setSelectedId(asset.id)} type="button">{brokenIds.includes(asset.id) ? <ImageOff aria-hidden="true" className="m-auto size-6 text-muted-foreground" /> : <>{/* eslint-disable-next-line @next/next/no-img-element */}<img alt="" className="size-full object-cover" height={80} loading="lazy" onError={() => markBroken(asset.id)} src={asset.url} width={80} /></>}{asset.isPrimary ? <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Primary</span> : null}</button></div>)}</div></div>
      <div className="border-t px-4 py-3"><p className="text-sm font-medium">{selected.altText}</p>{selected.sourceType !== "actual" ? <p className="mt-1 text-xs font-medium text-warning-foreground">{selected.sourceType === "cgi-reference" ? "CGI Reference — Actual Vehicle May Vary" : "OEM Reference — Actual Vehicle May Vary"}</p> : <p className="mt-1 text-xs text-muted-foreground">Verified photo of this inventory unit</p>}</div>
      {management ? <InventoryMediaControls {...management} mediaId={selected.id} isPrimary={selected.isPrimary} /> : null}
    </section>
  );
}

function EmptyMedia(){return <section className="overflow-hidden rounded-xl border bg-card shadow-soft" aria-labelledby="media-heading"><h2 id="media-heading" className="sr-only">Vehicle media</h2><div className="flex min-h-72 flex-col items-center justify-center gap-3 bg-muted/30 p-8 text-center sm:min-h-96"><span className="flex size-16 items-center justify-center rounded-2xl border bg-background shadow-sm"><CarFront aria-hidden="true" className="size-8 text-muted-foreground" /></span><div><p className="font-medium">No verified unit photos available</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Photos appear here only after they are verified against this exact inventory unit.</p></div></div></section>}
function BrokenMedia(){return <div className="flex flex-col items-center gap-3 p-8 text-center"><ImageOff aria-hidden="true" className="size-10 text-muted-foreground"/><div><p className="font-medium">Photo unavailable</p><p className="mt-1 text-sm text-muted-foreground">The image could not be loaded. Other vehicle details remain available.</p></div></div>}
function sourceLabel(source:VerifiedVehicleMediaAsset["sourceType"]){if(source==="actual")return"Actual inventory photo";if(source==="cgi-reference")return"CGI reference";return"OEM reference"}
