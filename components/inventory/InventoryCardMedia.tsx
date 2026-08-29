"use client";
/* eslint-disable @next/next/no-img-element -- media origins are tenant-configured at runtime and require an in-browser broken-object fallback. */

import { useState } from "react";
import { CarFront, ImageOff } from "lucide-react";

export function InventoryCardMedia({image,label}:{image?:{url:string;altText:string;sourceType:"actual"|"cgi-reference"|"oem-reference"};label:string}){
  const[broken,setBroken]=useState(false);
  return <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30 sm:w-40">{image&&!broken?<>{/* Verified dynamic provider URL; browser fallback is required for broken objects. */}{/* eslint-disable-next-line @next/next/no-img-element */}<img alt={image.altText} className="size-full object-cover" decoding="async" loading="lazy" onError={()=>setBroken(true)} src={image.url}/></>:<div className="flex flex-col items-center gap-2 p-3 text-center text-muted-foreground">{broken?<ImageOff aria-hidden="true" className="size-7"/>:<CarFront aria-hidden="true" className="size-7"/>}<span className="text-xs">{broken?"Photo unavailable":"No vehicle photo"}</span></div>}{image?.sourceType&&image.sourceType!=="actual"&&!broken?<span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">{image.sourceType==="cgi-reference"?"CGI reference":"OEM reference"}</span>:null}<span className="sr-only">{label}</span></div>;
}
