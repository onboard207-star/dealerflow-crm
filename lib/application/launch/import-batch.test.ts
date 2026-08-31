import { describe, expect, it, vi } from "vitest";
import { ImportBatchService, ImportBatchValidationError, type ImportBatch, type ImportBatchProvider } from "./import-batch";

const actor = { userId: "usr_admin001", memberships: [{ organizationId: "org_dealer001", locationIds: "all" as const, capabilities: ["organization.configure" as const] }] };
function provider(existing: ImportBatch | null = null) { return { findByIdempotencyKey: vi.fn().mockResolvedValue(existing), create: vi.fn(async (batch: ImportBatch) => batch) } satisfies ImportBatchProvider; }
const valid = { actor, organizationId: "org_dealer001", domain: "customer-lead" as const, sourceName: "pilot-customers.csv", sourceChecksum: "a".repeat(64), mapping: { Name: "displayName", Email: "email" }, rows: [{ Name: "Jordan Lee", Email: "jordan@example.com" }], idempotencyKey: "pilot-import-1" };

describe("ImportBatchService", () => {
  it("persists a clean preview as ready", async () => { const target = provider(); const result = await new ImportBatchService(target, () => new Date("2026-08-31T12:00:00Z")).stage(valid); expect(result).toMatchObject({ status: "ready", createdBy: actor.userId, preview: { validRows: 1 } }); expect(target.create).toHaveBeenCalledOnce(); });
  it("quarantines duplicate and unresolved rows for review", async () => { const target = provider(); const result = await new ImportBatchService(target).stage({ ...valid, existingIdentityKeys: new Set(["customer:email:jordan@example.com"]) }); expect(result.status).toBe("review-required"); expect(result.preview.duplicateRows).toBe(1); });
  it("returns the prior batch for the same tenant idempotency key", async () => { const prior = { id: "imb_existing1", organizationId: valid.organizationId } as ImportBatch; const target = provider(prior); expect(await new ImportBatchService(target).stage(valid)).toBe(prior); expect(target.create).not.toHaveBeenCalled(); });
  it("rejects unbounded or unverifiable sources before persistence", async () => { await expect(new ImportBatchService(provider()).stage({ ...valid, sourceChecksum: "unknown", rows: [] })).rejects.toBeInstanceOf(ImportBatchValidationError); });
});
