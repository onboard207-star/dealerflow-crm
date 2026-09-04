import { describe, expect, it } from "vitest";
import { evaluateDeliveryReadiness } from "./delivery-readiness";

const ready = {
  dealStatus: "contracted" as const,
  acceptedQuoteId: "quo_exact",
  acceptedQuoteVersion: 4,
  resolvedQuote: { id: "quo_exact", version: 4, status: "accepted" as const },
  inventory: { required: true, valid: true },
  documentRequirements: [{ required: true, status: "complete" as const }],
};

describe("delivery readiness", () => {
  it("becomes ready only when the exact accepted Quote and required documents resolve", () => {
    expect(evaluateDeliveryReadiness(ready)).toEqual({ ready: true, blockers: [] });
  });

  it("rejects an incorrect Quote version", () => {
    expect(evaluateDeliveryReadiness({ ...ready, acceptedQuoteVersion: 3 })).toMatchObject({ ready: false, blockers: ["accepted-quote-mismatch"] });
  });

  it("reports incomplete required documents without treating waived records as complete", () => {
    expect(evaluateDeliveryReadiness({ ...ready, documentRequirements: [{ required: true, status: "pending" }] })).toMatchObject({ ready: false, blockers: ["documents-incomplete"] });
    expect(evaluateDeliveryReadiness({ ...ready, documentRequirements: [{ required: true, status: "waived" }] }).ready).toBe(false);
  });

  it("fails closed for an invalid physical inventory binding", () => {
    expect(evaluateDeliveryReadiness({ ...ready, inventory: { required: true, valid: false } })).toMatchObject({ ready: false, blockers: ["inventory-unavailable"] });
  });
});
