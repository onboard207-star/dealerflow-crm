import { describe,expect,it } from "vitest";
import { assertSyntheticEnvironment } from "./seed-synthetic-pilot.mjs";
describe("synthetic pilot seed guard",()=>{it("requires non-production and explicit confirmation",()=>{expect(()=>assertSyntheticEnvironment("production","SYNTHETIC-DEMO")).toThrow("disabled in production");expect(()=>assertSyntheticEnvironment("staging","wrong")).toThrow("--confirm");expect(()=>assertSyntheticEnvironment("staging","SYNTHETIC-DEMO")).not.toThrow();});});
