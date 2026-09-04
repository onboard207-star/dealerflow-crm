import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("PostgresAppointmentLifecycleProvider", () => {
  it("retires linked preparation tasks without deleting their history", () => {
    const source = readFileSync(new URL("./postgres-appointment-lifecycle.ts", import.meta.url), "utf8");

    expect(source).toContain('appointment.status === "cancelled" || appointment.status === "no-show"');
    expect(source).toContain("appointment_id=$2 AND status IN ('open','in-progress')");
    expect(source).toContain("Linked appointment was ${outcome}.");
    expect(source).toContain("task_status_events");
  });
});
