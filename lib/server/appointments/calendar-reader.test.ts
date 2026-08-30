import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { AppointmentCalendarReader, CalendarQueryError } from "./calendar-reader";

describe("AppointmentCalendarReader", () => {
  it("applies tenant and membership location scope inside the calendar query", async () => {
    const query = vi.fn<DatabaseClient["query"]>().mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
    await new AppointmentCalendarReader(pool).list(
      { userId: "usr_salesperson", organizationId: "org_dealerflow", locationIds: ["loc_main"] },
      { from: "2026-08-30", to: "2026-09-05", status: "confirmed" },
    );
    expect(query.mock.calls[2]?.[0]).toContain("appointment.organization_id=$1");
    expect(query.mock.calls[2]?.[0]).toContain("appointment.location_id=ANY($3::text[])");
    expect(query.mock.calls[2]?.[1]).toEqual(["org_dealerflow", false, ["loc_main"], "2026-08-30", "2026-09-05", "confirmed"]);
  });

  it("rejects invalid and unbounded filters before database access", () => {
    const pool = { connect: vi.fn() } as unknown as DatabasePool;
    const reader = new AppointmentCalendarReader(pool);
    expect(() => reader.list({ userId: "usr_salesperson", organizationId: "org_dealerflow", locationIds: "all" }, { from: "2026-08-30", to: "2026-10-30" })).toThrow(CalendarQueryError);
    expect(() => reader.list({ userId: "usr_salesperson", organizationId: "org_dealerflow", locationIds: "all" }, { from: "2026-08-30", to: "2026-09-01", status: "private" })).toThrow(CalendarQueryError);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
