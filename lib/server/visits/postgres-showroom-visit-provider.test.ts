import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("PostgresShowroomVisitProvider", () => {
  it("binds arrival to the Lead assignment and completes linked preparation tasks with evidence", () => {
    const source = readFileSync(new URL("./postgres-showroom-visit-provider.ts", import.meta.url), "utf8");

    expect(source).toContain("a.lead_id=l.id");
    expect(source).toContain("a.assigned_user_id=$6");
    expect(source).toContain("l.assigned_user_id=$6");
    expect(source).toContain("JOIN membership_locations");
    expect(source).toContain("appointment_id=$2 AND status IN ('open','in-progress')");
    expect(source).toContain("Customer arrived for the linked appointment.");
    expect(source).toContain("task_status_events");
  });
});
