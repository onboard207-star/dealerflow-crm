import { createHash } from "node:crypto";

type Scalar = boolean | null | number | string;
export type QuoteFingerprintValue = Scalar | readonly QuoteFingerprintValue[] | { readonly [key: string]: QuoteFingerprintValue };
export interface QuoteFingerprintEntry { readonly stableKey: string; readonly [key: string]: QuoteFingerprintValue }

export interface QuoteCalculationFingerprintInput {
  quoteVersion: number;
  productScenario: QuoteFingerprintEntry;
  paymentScenario: QuoteFingerprintEntry;
  trades: readonly QuoteFingerprintEntry[];
  lines: readonly QuoteFingerprintEntry[];
  incentives: readonly QuoteFingerprintEntry[];
  optionalProducts: readonly QuoteFingerprintEntry[];
  sourceRevisions: readonly QuoteFingerprintEntry[];
  policies: {
    calculation: string;
    rounding: string;
    taxAndFee: string;
  };
}

export function quoteCalculationFingerprint(input: QuoteCalculationFingerprintInput): string {
  assertPositiveInteger(input.quoteVersion, "quoteVersion");
  const canonical = {
    quoteVersion: input.quoteVersion,
    productScenario: input.productScenario,
    paymentScenario: input.paymentScenario,
    trades: ordered(input.trades),
    lines: ordered(input.lines),
    incentives: ordered(input.incentives),
    optionalProducts: ordered(input.optionalProducts),
    sourceRevisions: ordered(input.sourceRevisions),
    policies: input.policies,
  } satisfies QuoteFingerprintValue;
  return createHash("sha256").update(canonicalQuoteCalculationJson(canonical)).digest("hex");
}

export function canonicalQuoteCalculationJson(value: QuoteFingerprintValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Quote fingerprint numbers must be safe integers.");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalQuoteCalculationJson).join(",")}]`;
  const object = value as { readonly [key: string]: QuoteFingerprintValue };
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalQuoteCalculationJson(object[key]!)}`).join(",")}}`;
}

function ordered(values: readonly QuoteFingerprintEntry[]): readonly QuoteFingerprintEntry[] {
  const seen = new Set<string>();
  const result = [...values].sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  for (const value of result) {
    if (!value.stableKey.trim()) throw new Error("Quote fingerprint entries require a stableKey.");
    if (seen.has(value.stableKey)) throw new Error(`Duplicate Quote fingerprint stableKey: ${value.stableKey}.`);
    seen.add(value.stableKey);
  }
  return result;
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer.`);
}
