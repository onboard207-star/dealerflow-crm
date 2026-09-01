import { describe,expect,it } from "vitest";
import { assertSyntheticEnvironment, assertSyntheticReset } from "./seed-synthetic-pilot.mjs";

describe("synthetic pilot seed guard",()=>{
  it("requires non-production and explicit seed confirmation",()=>{expect(()=>assertSyntheticEnvironment("production","SYNTHETIC-DEMO")).toThrow("disabled in production");expect(()=>assertSyntheticEnvironment("staging","wrong")).toThrow("--confirm");expect(()=>assertSyntheticEnvironment("staging","SYNTHETIC-DEMO")).not.toThrow();});
  it("requires non-production, reset confirmation, and the exact fixture version",()=>{expect(()=>assertSyntheticReset("production","RESET-SYNTHETIC-DEMO","pilot-demo-v1")).toThrow("disabled in production");expect(()=>assertSyntheticReset("staging","wrong","pilot-demo-v1")).toThrow("--confirm");expect(()=>assertSyntheticReset("staging","RESET-SYNTHETIC-DEMO","wrong")).toThrow("--fixture-version");expect(()=>assertSyntheticReset("staging","RESET-SYNTHETIC-DEMO","pilot-demo-v1")).not.toThrow();});
});
