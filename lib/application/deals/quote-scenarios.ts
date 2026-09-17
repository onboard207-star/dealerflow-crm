export type QuoteProductKind = "generic" | "vehicle";
export type QuotePaymentMode = "cash" | "finance" | "lease";
export type QuoteScenarioCalculationStatus = "complete" | "incomplete";

export interface QuoteProductScenario {
  id: string;
  organizationId: string;
  quoteId: string;
  stableKey: string;
  position: number;
  productKind: QuoteProductKind;
  inventoryUnitId?: string;
  productReference: string;
  label: string;
  transactionMetadata: Readonly<Record<string, unknown>>;
  sourceType: "application" | "import" | "legacy-backfill" | "provider";
  sourceReference?: string;
  createdBy?: string;
  createdAt: string;
}

export interface QuotePaymentScenario {
  id: string;
  organizationId: string;
  quoteId: string;
  productScenarioId: string;
  stableKey: string;
  position: number;
  mode: QuotePaymentMode;
  calculationStatus: QuoteScenarioCalculationStatus;
  termMonths?: number;
  aprBasisPoints?: number;
  cashDownCents: number;
  amountFinancedCents?: number;
  paymentCents?: number;
  totalPaymentCents?: number;
  financeChargeCents?: number;
  modeMetadata: Readonly<Record<string, unknown>>;
  sourceType: "dealer-program" | "legacy-quote" | "lender-quote" | "manual-entry" | "oem-program";
  sourceLabel: string;
  sourceReference?: string;
  calculationPolicyVersion: string;
  roundingPolicyVersion: string;
  calculationFingerprint: string;
  createdBy?: string;
  createdAt: string;
}

export interface QuoteTradeSnapshot {
  id: string;
  organizationId: string;
  quoteId: string;
  productScenarioId: string;
  tradeAppraisalId: string;
  position: number;
  appraisalVersion: number;
  appraisalRevisionAt: string;
  appraisalAllowanceCents: number;
  quoteAllowanceCents: number;
  payoffCents: number;
  equityCents: number;
  quoteAdjustmentCents: number;
  adjustmentReason?: string;
  taxTreatmentMetadata: Readonly<Record<string, unknown>>;
  sourceType: "application" | "import" | "legacy-backfill" | "provider";
  sourceReference?: string;
  createdBy?: string;
  createdAt: string;
}

const leaseMetadata = ["adjustedCapCostCents", "residualValueCents", "moneyFactorPpm", "acquisitionFeeCents", "capCostReductionCents", "rebateCents"] as const;

export function validateQuotePaymentScenario(scenario: QuotePaymentScenario): readonly string[] {
  const issues: string[] = [];
  for (const [label, value] of Object.entries({
    position: scenario.position, cashDownCents: scenario.cashDownCents, termMonths: scenario.termMonths,
    aprBasisPoints: scenario.aprBasisPoints, amountFinancedCents: scenario.amountFinancedCents,
    paymentCents: scenario.paymentCents, totalPaymentCents: scenario.totalPaymentCents, financeChargeCents: scenario.financeChargeCents,
  })) if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) issues.push(`${label} must be a nonnegative safe integer.`);
  if (!/^[a-f0-9]{64}$/.test(scenario.calculationFingerprint)) issues.push("calculationFingerprint must be a SHA-256 digest.");
  if (scenario.mode === "cash" && (scenario.calculationStatus !== "complete" || scenario.totalPaymentCents === undefined)) issues.push("Cash scenarios require a complete total payment.");
  if (scenario.mode === "finance" && scenario.calculationStatus === "complete") {
    for (const key of ["termMonths", "aprBasisPoints", "amountFinancedCents", "paymentCents", "totalPaymentCents", "financeChargeCents"] as const)
      if (scenario[key] === undefined) issues.push(`Complete finance scenarios require ${key}.`);
  }
  if (scenario.mode === "lease") {
    if (scenario.calculationStatus !== "complete") issues.push("Lease scenarios fail closed unless provider terms are complete.");
    for (const key of ["termMonths", "paymentCents", "totalPaymentCents"] as const)
      if (scenario[key] === undefined) issues.push(`Lease scenarios require ${key}.`);
    for (const key of leaseMetadata) if (!isNonnegativeSafeInteger(scenario.modeMetadata[key])) issues.push(`Lease scenarios require ${key}.`);
  }
  return issues;
}

export function aggregateQuoteTradeEquity(trades: readonly QuoteTradeSnapshot[]): number {
  const identities = new Set<string>();
  let total = 0;
  for (const trade of trades) {
    if (identities.has(trade.tradeAppraisalId)) throw new Error(`Duplicate Trade snapshot: ${trade.tradeAppraisalId}.`);
    identities.add(trade.tradeAppraisalId);
    if (!isNonnegativeSafeInteger(trade.quoteAllowanceCents) || !isNonnegativeSafeInteger(trade.payoffCents)) throw new Error("Trade allowance and payoff must be nonnegative safe integers.");
    if (trade.equityCents !== trade.quoteAllowanceCents - trade.payoffCents) throw new Error("Trade snapshot equity is inconsistent.");
    if (trade.quoteAdjustmentCents !== trade.quoteAllowanceCents - trade.appraisalAllowanceCents) throw new Error("Trade snapshot adjustment is inconsistent.");
    total += trade.equityCents;
    if (!Number.isSafeInteger(total)) throw new Error("Aggregated Trade equity exceeds safe integer bounds.");
  }
  return total;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
