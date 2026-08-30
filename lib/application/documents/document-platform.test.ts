import { describe, expect, it } from "vitest";
import {
  calculateDealPacketCompleteness,
  createSafeDocumentFilename,
  DocumentPlatformError,
  renderDocumentTemplate,
  transitionDocumentStatus,
  transitionSignatureStatus,
  UnconfiguredSignatureProvider,
  validateDocumentTemplate,
  type DocumentTemplateVersion,
} from "./document-platform";

const template: DocumentTemplateVersion = {
  id: "dtv_quote_2",
  templateId: "dt_quote",
  version: 2,
  name: "Retail quote",
  documentType: "deal-quote",
  scope: "tenant",
  organizationId: "org_dealerflow",
  status: "active",
  body: "<h1>Quote for {{customer.name}}</h1><p>{{vehicle.description}}</p><p>{{customer.note}}</p>",
  requiredBindings: ["customer.name", "vehicle.description"],
  optionalBindings: ["customer.note"],
  approvalRequired: true,
};

describe("document platform", () => {
  it("renders deterministic content from an explicit immutable template version", () => {
    expect(
      renderDocumentTemplate(template, {
        "customer.name": "Jordan Lee",
        "vehicle.description": "2026 Honda CR-V",
      }),
    ).toEqual({
      status: "rendered",
      templateVersionId: "dtv_quote_2",
      templateVersion: 2,
      content: "<h1>Quote for Jordan Lee</h1><p>2026 Honda CR-V</p><p></p>",
      warnings: ["Optional binding is unavailable: customer.note."],
    });
  });

  it("returns needs-information instead of inventing required values", () => {
    expect(renderDocumentTemplate(template, { "customer.name": "Jordan Lee" })).toMatchObject({
      status: "needs-information",
      missingRequiredBindings: ["vehicle.description"],
    });
  });

  it("rejects undeclared bindings and executable template markup", () => {
    const invalid = {
      ...template,
      body: '<script>alert(1)</script>{{dealer.secret}}',
    };
    const result = validateDocumentTemplate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Template content contains unsafe executable markup.",
        "Template references undeclared bindings: dealer.secret.",
      ]),
    );
  });

  it("escapes bound values without altering trusted template markup", () => {
    const result = renderDocumentTemplate(template, {
      "customer.name": '<img src=x onerror="alert(1)">',
      "vehicle.description": "CR-V & Pilot",
    });
    expect(result.status).toBe("rendered");
    if (result.status === "rendered") {
      expect(result.content).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
      expect(result.content).toContain("CR-V &amp; Pilot");
    }
  });

  it("enforces global and tenant template ownership", () => {
    expect(validateDocumentTemplate({ ...template, scope: "global", organizationId: "org_dealerflow" }).valid).toBe(false);
    expect(validateDocumentTemplate({ ...template, scope: "tenant", organizationId: undefined }).valid).toBe(false);
  });

  it("makes finalized documents and signed envelopes immutable", () => {
    expect(() => transitionDocumentStatus("finalized", "draft")).toThrow(DocumentPlatformError);
    expect(() => transitionSignatureStatus("signed", "draft")).toThrow(DocumentPlatformError);
  });

  it("permits only governed review and signature transitions", () => {
    expect(transitionDocumentStatus("ready-for-review", "approved")).toBe("approved");
    expect(transitionSignatureStatus("sent", "viewed")).toBe("viewed");
    expect(() => transitionDocumentStatus("draft", "sent")).toThrow(DocumentPlatformError);
  });

  it("calculates packet completeness from tenant-configured requirements", () => {
    const result = calculateDealPacketCompleteness(
      [
        { id: "quote", label: "Accepted quote", required: true },
        { id: "delivery", label: "Delivery confirmation", required: true },
        { id: "trade", label: "Trade appraisal", required: false },
      ],
      [{ requirementId: "quote", documentId: "doc_quote", status: "finalized" }],
    );
    expect(result).toEqual({
      complete: false,
      requiredCount: 2,
      completedRequiredCount: 1,
      missingRequired: [{ id: "delivery", label: "Delivery confirmation", required: true }],
    });
  });

  it("creates predictable filenames without exposing raw punctuation", () => {
    expect(createSafeDocumentFilename({ documentType: "deal-quote", humanReference: "Quote #A/72 (Lee)", version: 3 })).toBe(
      "deal-quote-quote-a-72-lee-v3.pdf",
    );
  });

  it("fails closed when no signature provider is configured", async () => {
    const provider = new UnconfiguredSignatureProvider();
    await expect(
      provider.createEnvelope({
        organizationId: "org_dealerflow",
        documentId: "doc_quote",
        documentVersion: 2,
        signerName: "Jordan Lee",
        signerEmail: "jordan@example.test",
        idempotencyKey: "signature-1",
      }),
    ).rejects.toMatchObject({ code: "provider-not-configured" });
  });
});
