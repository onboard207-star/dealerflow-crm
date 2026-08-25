"use client";
import { createContext, useContext, type CSSProperties,type ReactNode } from "react";
import type { TenantFeatures } from "@/lib/platform/tenant";
interface TenantRuntime { productName:string;logoUrl?:string;logoDarkUrl?:string;features:TenantFeatures;brandTokens:Record<string,string> }
const Context=createContext<TenantRuntime|undefined>(undefined);
export function TenantRuntimeProvider({children,value}:{children:ReactNode;value:TenantRuntime}){return <Context.Provider value={value}><div style={value.brandTokens as CSSProperties}>{children}</div></Context.Provider>}
export function useTenantRuntime(){return useContext(Context)}
