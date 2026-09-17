import { describe, expect, it } from "vitest";
import { canonicalQuoteCalculationJson, quoteCalculationFingerprint, type QuoteCalculationFingerprintInput } from "./quote-calculation-fingerprint";

const input: QuoteCalculationFingerprintInput = {
  quoteVersion: 2,
  productScenario: { stableKey: "product:primary", sellingPriceCents: 3_810_000 },
  paymentScenario: { stableKey: "payment:finance:60", mode: "finance", aprBasisPoints: 599, termMonths: 60 },
  trades: [
    { stableKey: "trade:second", allowanceCents: 800_000, payoffCents: 900_000 },
    { stableKey: "trade:first", allowanceCents: 1_200_000, payoffCents: 700_000 },
  ],
  lines: [{ stableKey: "line:vehicle", totalCents: 3_810_000 }],
  incentives: [], optionalProducts: [], sourceRevisions: [{ stableKey: "rate:manual", revision: "v1" }],
  policies: { calculation: "quote-vnext-v1", rounding: "half-up-cent-v1", taxAndFee: "tenant-policy-v1" },
};

describe("Quote calculation fingerprint", () => {
  it("is stable across object key and collection ordering", () => {
    const reordered: QuoteCalculationFingerprintInput = {
      ...input,
      productScenario: { sellingPriceCents: 3_810_000, stableKey: "product:primary" },
      trades: [...input.trades].reverse(),
    };
    expect(quoteCalculationFingerprint(reordered)).toBe(quoteCalculationFingerprint(input));
    expect(quoteCalculationFingerprint(input)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("changes when an economically material input changes", () => {
    expect(quoteCalculationFingerprint({ ...input, paymentScenario: { ...input.paymentScenario, aprBasisPoints: 600 } })).not.toBe(quoteCalculationFingerprint(input));
  });
  it("rejects duplicate stable identities and unsafe numeric authority", () => {
    expect(() => quoteCalculationFingerprint({ ...input, trades: [input.trades[0]!, input.trades[0]!] })).toThrow("Duplicate");
    expect(() => canonicalQuoteCalculationJson({ cents: 1.5 })).toThrow("safe integers");
    expect(() => canonicalQuoteCalculationJson({ cents: Number.MAX_SAFE_INTEGER + 1 })).toThrow("safe integers");
  });
});
