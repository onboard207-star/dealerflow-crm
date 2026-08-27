import { describe, expect, it } from "vitest";

import type { RequestContext } from "@/lib/platform/data";

import {
  PostgresCRMSession,
  type QueryResult,
  type SqlExecutor,
} from "./postgres-crm-provider";

const now = new Date("2026-08-23T12:00:00.000Z");
const context: RequestContext = {
  actorId: "usr_salesperson",
  organizationId: "org_dealerflow",
  locationId: "loc_main",
  correlationId: "req_123",
};

class QueueDatabase implements SqlExecutor {
  readonly calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  private readonly results: Array<QueryResult<Record<string, unknown>>>;

  constructor(...results: Array<QueryResult<Record<string, unknown>>>) {
    this.results = results;
  }

  async query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, values });
    return (this.results.shift() ?? { rows: [] }) as QueryResult<Row>;
  }
}

function customerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cus_jordan",
    organization_id: "org_dealerflow",
    location_id: "loc_main",
    display_name: "Jordan Lee",
    first_name: "Jordan",
    last_name: "Lee",
    email: "jordan@example.com",
    phone: "+12075550184",
    status: "active",
    created_at: now,
    created_by: "usr_salesperson",
    updated_at: now,
    updated_by: "usr_salesperson",
    ...overrides,
  };
}

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "led_website",
    organization_id: "org_dealerflow",
    location_id: "loc_main",
    customer_id: "cus_jordan",
    assigned_user_id: "usr_salesperson",
    source: "Dealer Website",
    source_detail: "CR-V landing page",
    stage: "new",
    status: "open",
    idempotency_key: "web:123",
    created_at: now,
    created_by: "usr_salesperson",
    updated_at: now,
    updated_by: "usr_salesperson",
    ...overrides,
  };
}

describe("PostgresCRMSession", () => {
  it("serializes an idempotency key within the current transaction", async () => {
    const database = new QueueDatabase({ rows: [] });
    const session = new PostgresCRMSession(database);
    await session.acquireIdempotencyLock(
      { organizationId: "org_dealerflow" },
      "website:123",
    );
    expect(database.calls[0]?.text).toContain("pg_advisory_xact_lock");
    expect(database.calls[0]?.values).toEqual(["org_dealerflow:website:123"]);
  });

  it("always scopes direct record reads by organization", async () => {
    const database = new QueueDatabase({ rows: [customerRow()] });
    const session = new PostgresCRMSession(database);

    const customer = await session.getCustomer(
      { organizationId: "org_dealerflow" },
      "cus_jordan",
    );

    expect(customer?.id).toBe("cus_jordan");
    expect(database.calls[0]?.text).toContain("organization_id = $1");
    expect(database.calls[0]?.values).toEqual([
      "org_dealerflow",
      "cus_jordan",
    ]);
  });

  it("fails closed when contact identifiers resolve to multiple customers", async () => {
    const database = new QueueDatabase({
      rows: [customerRow(), customerRow({ id: "cus_conflict" })],
    });
    const session = new PostgresCRMSession(database);

    await expect(
      session.findCustomerByIdentity({
        organizationId: "org_dealerflow",
        normalizedEmail: "jordan@example.com",
        normalizedPhone: "+12075550184",
      }),
    ).rejects.toThrow("multiple records");
  });

  it("writes a customer and immutable audit event through one executor", async () => {
    const database = new QueueDatabase({ rows: [customerRow()] }, { rows: [] });
    const session = new PostgresCRMSession(database);

    const customer = await session.createCustomer(context, {
      id: "cus_jordan",
      organizationId: "org_dealerflow",
      locationId: "loc_main",
      displayName: "Jordan Lee",
      email: "jordan@example.com",
      normalizedEmail: "jordan@example.com",
    });

    expect(customer.createdBy).toBe("usr_salesperson");
    expect(database.calls).toHaveLength(2);
    expect(database.calls[1]?.text).toContain("INSERT INTO audit_logs");
    expect(database.calls[1]?.values).toContain("req_123");
  });

  it("rejects cross-tenant writes before issuing SQL", async () => {
    const database = new QueueDatabase();
    const session = new PostgresCRMSession(database);

    await expect(
      session.createLead(context, {
        id: "led_other",
        organizationId: "org_other",
        customerId: "cus_other",
        source: "Import",
        stage: "new",
        idempotencyKey: "import:1",
      }),
    ).rejects.toThrow("organization do not match");
    expect(database.calls).toHaveLength(0);
  });

  it("maps lead metadata and applies cursor pagination", async () => {
    const database = new QueueDatabase({
      rows: [leadRow(), leadRow({ id: "led_second" })],
    });
    const session = new PostgresCRMSession(database);

    const result = await session.listLeads({
      organizationId: "org_dealerflow",
      limit: 1,
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.idempotencyKey).toBe("web:123");
    expect(result.nextCursor).toBe("led_website");
    expect(database.calls[0]?.text).toContain("status::text = $6");
    expect(database.calls[0]?.text).not.toContain("status = $6");
  });
});
