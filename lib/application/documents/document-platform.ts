export type DocumentType =
  | "customer-summary"
  | "deal-quote"
  | "deal-packet"
  | "billing-statement"
  | "business-proposal"
  | "pilot-review"
  | "other";

export type TemplateScope = "global" | "tenant";
export type TemplateStatus = "draft" | "review" | "approved" | "active" | "retired";
export type DocumentStatus =
  | "draft"
  | "needs-information"
  | "ready-for-review"
  | "approved"
  | "sent"
  | "finalized"
  | "voided";
export type SignatureStatus =
  | "not-required"
  | "draft"
  | "ready"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "voided"
  | "expired"
  | "failed";

export interface DocumentTemplateVersion {
  readonly id: string;
  readonly templateId: string;
  readonly version: number;
  readonly name: string;
  readonly documentType: DocumentType;
  readonly scope: TemplateScope;
  readonly organizationId?: string;
  readonly status: TemplateStatus;
  readonly body: string;
  readonly requiredBindings: readonly string[];
  readonly optionalBindings: readonly string[];
  readonly approvalRequired: boolean;
}

export type DocumentBindingValue = string | number | boolean | null | undefined;
export type DocumentBindings = Readonly<Record<string, DocumentBindingValue>>;

export interface TemplateValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly referencedBindings: readonly string[];
}

export type RenderDocumentResult =
  | {
      readonly status: "needs-information";
      readonly templateVersionId: string;
      readonly missingRequiredBindings: readonly string[];
      readonly warnings: readonly string[];
    }
  | {
      readonly status: "rendered";
      readonly templateVersionId: string;
      readonly templateVersion: number;
      readonly content: string;
      readonly warnings: readonly string[];
    };

export interface DealPacketRequirement {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
}

export interface DealPacketDocument {
  readonly requirementId: string;
  readonly documentId: string;
  readonly status: DocumentStatus;
}

export interface DealPacketCompleteness {
  readonly complete: boolean;
  readonly requiredCount: number;
  readonly completedRequiredCount: number;
  readonly missingRequired: readonly DealPacketRequirement[];
}

export interface SignatureRequest {
  readonly organizationId: string;
  readonly documentId: string;
  readonly documentVersion: number;
  readonly signerName: string;
  readonly signerEmail: string;
  readonly idempotencyKey: string;
}

export interface SignatureEnvelope {
  readonly providerId: string;
  readonly providerEnvelopeId: string;
  readonly status: SignatureStatus;
  readonly occurredAt: string;
}

export interface SignatureProvider {
  readonly providerId: string;
  createEnvelope(request: SignatureRequest): Promise<SignatureEnvelope>;
  voidEnvelope(providerEnvelopeId: string): Promise<SignatureEnvelope>;
}

export interface DocumentStorageReference {
  readonly providerId: string;
  readonly objectKey: string;
  readonly checksumSha256: string;
  readonly contentType: "application/pdf";
}

export interface DocumentStorageProvider {
  readonly providerId: string;
  storeFinalizedPdf(input: {
    readonly organizationId: string;
    readonly documentId: string;
    readonly documentVersion: number;
    readonly bytes: Uint8Array;
    readonly checksumSha256: string;
  }): Promise<DocumentStorageReference>;
}

export class DocumentPlatformError extends Error {
  constructor(
    readonly code:
      | "invalid-template"
      | "invalid-transition"
      | "immutable-document"
      | "provider-not-configured",
    message: string,
  ) {
    super(message);
    this.name = "DocumentPlatformError";
  }
}

const bindingPattern = /{{\s*([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\s*}}/g;
const unsafeTemplatePatterns = [/<\s*script\b/i, /javascript\s*:/i, /\son[a-z]+\s*=/i];

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function referencedBindings(body: string): readonly string[] {
  return unique([...body.matchAll(bindingPattern)].map((match) => match[1]));
}

function duplicateBindings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateDocumentTemplate(template: DocumentTemplateVersion): TemplateValidationResult {
  const errors: string[] = [];
  const references = referencedBindings(template.body);
  const declared = new Set([...template.requiredBindings, ...template.optionalBindings]);

  if (!template.id.trim() || !template.templateId.trim()) errors.push("Template and version identifiers are required.");
  if (!template.name.trim()) errors.push("Template name is required.");
  if (!Number.isInteger(template.version) || template.version < 1) errors.push("Template version must be a positive integer.");
  if (template.scope === "tenant" && !template.organizationId?.trim()) errors.push("Tenant templates require an organization identifier.");
  if (template.scope === "global" && template.organizationId !== undefined) errors.push("Global templates cannot belong to an organization.");
  if (template.status === "active" && template.body.trim().length === 0) errors.push("An active template must have content.");
  if (unsafeTemplatePatterns.some((pattern) => pattern.test(template.body))) errors.push("Template content contains unsafe executable markup.");

  const duplicates = duplicateBindings([...template.requiredBindings, ...template.optionalBindings]);
  if (duplicates.length > 0) errors.push(`Bindings must be unique: ${duplicates.join(", ")}.`);

  const undeclared = references.filter((binding) => !declared.has(binding));
  if (undeclared.length > 0) errors.push(`Template references undeclared bindings: ${undeclared.join(", ")}.`);

  return { valid: errors.length === 0, errors, referencedBindings: references };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasValue(value: DocumentBindingValue): value is string | number | boolean {
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
}

export function renderDocumentTemplate(
  template: DocumentTemplateVersion,
  bindings: DocumentBindings,
): RenderDocumentResult {
  const validation = validateDocumentTemplate(template);
  if (!validation.valid) throw new DocumentPlatformError("invalid-template", validation.errors.join(" "));

  const missingRequiredBindings = template.requiredBindings.filter((binding) => !hasValue(bindings[binding]));
  const warnings = template.optionalBindings
    .filter((binding) => !hasValue(bindings[binding]))
    .map((binding) => `Optional binding is unavailable: ${binding}.`);

  if (missingRequiredBindings.length > 0) {
    return { status: "needs-information", templateVersionId: template.id, missingRequiredBindings, warnings };
  }

  const content = template.body.replace(bindingPattern, (_token, binding: string) => {
    const value = bindings[binding];
    return hasValue(value) ? escapeHtml(String(value)) : "";
  });

  return {
    status: "rendered",
    templateVersionId: template.id,
    templateVersion: template.version,
    content,
    warnings,
  };
}

const documentTransitions: Readonly<Record<DocumentStatus, readonly DocumentStatus[]>> = {
  draft: ["needs-information", "ready-for-review", "voided"],
  "needs-information": ["draft", "ready-for-review", "voided"],
  "ready-for-review": ["draft", "approved", "voided"],
  approved: ["sent", "finalized", "voided"],
  sent: ["finalized", "voided"],
  finalized: [],
  voided: [],
};

export function transitionDocumentStatus(current: DocumentStatus, next: DocumentStatus): DocumentStatus {
  if (current === "finalized" || current === "voided") {
    throw new DocumentPlatformError("immutable-document", `${current} documents are immutable.`);
  }
  if (!documentTransitions[current].includes(next)) {
    throw new DocumentPlatformError("invalid-transition", `Cannot transition a document from ${current} to ${next}.`);
  }
  return next;
}

const signatureTransitions: Readonly<Record<SignatureStatus, readonly SignatureStatus[]>> = {
  "not-required": [],
  draft: ["ready", "voided"],
  ready: ["sent", "voided", "failed"],
  sent: ["viewed", "signed", "declined", "voided", "expired", "failed"],
  viewed: ["signed", "declined", "voided", "expired", "failed"],
  signed: [],
  declined: [],
  voided: [],
  expired: [],
  failed: ["ready", "voided"],
};

export function transitionSignatureStatus(current: SignatureStatus, next: SignatureStatus): SignatureStatus {
  if (!signatureTransitions[current].includes(next)) {
    throw new DocumentPlatformError("invalid-transition", `Cannot transition a signature from ${current} to ${next}.`);
  }
  return next;
}

export function calculateDealPacketCompleteness(
  requirements: readonly DealPacketRequirement[],
  documents: readonly DealPacketDocument[],
): DealPacketCompleteness {
  const required = requirements.filter((requirement) => requirement.required);
  const completeIds = new Set(
    documents.filter((document) => document.status === "finalized").map((document) => document.requirementId),
  );
  const missingRequired = required.filter((requirement) => !completeIds.has(requirement.id));
  return {
    complete: missingRequired.length === 0,
    requiredCount: required.length,
    completedRequiredCount: required.length - missingRequired.length,
    missingRequired,
  };
}

export function createSafeDocumentFilename(input: {
  readonly documentType: DocumentType;
  readonly humanReference: string;
  readonly version: number;
}): string {
  const reference = input.humanReference
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 64);
  const safeReference = reference || "document";
  return `${input.documentType}-${safeReference}-v${Math.max(1, Math.trunc(input.version))}.pdf`;
}

export class UnconfiguredSignatureProvider implements SignatureProvider {
  readonly providerId = "unconfigured";

  async createEnvelope(_request: SignatureRequest): Promise<SignatureEnvelope> {
    void _request;
    throw new DocumentPlatformError("provider-not-configured", "No electronic-signature provider is configured.");
  }

  async voidEnvelope(_providerEnvelopeId: string): Promise<SignatureEnvelope> {
    void _providerEnvelopeId;
    throw new DocumentPlatformError("provider-not-configured", "No electronic-signature provider is configured.");
  }
}
