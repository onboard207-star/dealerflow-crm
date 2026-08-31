import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";

import { previewImport, type ImportDomain, type ImportPreview, type ImportSourceRow } from "./import-preview";

export const importBatchStatuses = ["review-required", "ready", "completed", "failed", "aborted"] as const;
export type ImportBatchStatus = (typeof importBatchStatuses)[number];

export interface ImportBatch {
  id: string;
  organizationId: string;
  domain: ImportDomain;
  sourceName: string;
  sourceChecksum: string;
  mapping: Readonly<Record<string, string>>;
  status: ImportBatchStatus;
  preview: ImportPreview;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
}

export interface ImportBatchProvider {
  findByIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<ImportBatch | null>;
  create(batch: ImportBatch): Promise<ImportBatch>;
}

export class ImportBatchValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("The import batch is invalid.");
    this.name = "ImportBatchValidationError";
  }
}

export class ImportBatchService {
  constructor(private readonly provider: ImportBatchProvider, private readonly now = () => new Date()) {}

  async stage(input: {
    actor: AuthorizationActor;
    organizationId: string;
    domain: ImportDomain;
    sourceName: string;
    sourceChecksum: string;
    mapping: Readonly<Record<string, string>>;
    rows: readonly ImportSourceRow[];
    idempotencyKey: string;
    existingIdentityKeys?: ReadonlySet<string>;
    approvedRoleKeys?: ReadonlySet<string>;
  }): Promise<ImportBatch> {
    assertAuthorized(input.actor, { organizationId: input.organizationId, capability: "organization.configure" });
    const issues = validateInput(input);
    if (issues.length) throw new ImportBatchValidationError(issues);
    const existing = await this.provider.findByIdempotencyKey(input.organizationId, input.idempotencyKey);
    if (existing) return existing;
    const preview = previewImport(input);
    const status: ImportBatchStatus = preview.rejectedRows || preview.duplicateRows || preview.unresolvedRows ? "review-required" : "ready";
    return this.provider.create({
      id: generateEntityId("imb"), organizationId: input.organizationId, domain: input.domain,
      sourceName: input.sourceName.trim(), sourceChecksum: input.sourceChecksum.toLowerCase(), mapping: { ...input.mapping }, status, preview,
      idempotencyKey: input.idempotencyKey.trim(), createdBy: input.actor.userId, createdAt: this.now().toISOString(),
    });
  }
}

function validateInput(input: { sourceName: string; sourceChecksum: string; rows: readonly ImportSourceRow[]; idempotencyKey: string }) {
  const issues: string[] = [];
  if (!input.sourceName.trim() || input.sourceName.trim().length > 255) issues.push("Source name must be between 1 and 255 characters.");
  if (!/^[a-f0-9]{64}$/i.test(input.sourceChecksum)) issues.push("Source checksum must be a SHA-256 hex digest.");
  if (!input.idempotencyKey.trim() || input.idempotencyKey.trim().length > 200) issues.push("Idempotency key must be between 1 and 200 characters.");
  if (!input.rows.length || input.rows.length > 10_000) issues.push("A batch must contain between 1 and 10,000 rows.");
  return issues;
}
