import { describe, expect, it } from "vitest";
import { aggregateQuoteTradeEquity, validateQuotePaymentScenario, type QuotePaymentScenario, type QuoteTradeSnapshot } from "./quote-scenarios";

const base: QuotePaymentScenario = {
  id:"qpy_example1",organizationId:"org_example1",quoteId:"quo_example1",productScenarioId:"qps_example1",stableKey:"finance:60",position:0,
  mode:"finance",calculationStatus:"complete",termMonths:60,aprBasisPoints:599,cashDownCents:500_000,amountFinancedCents:3_000_000,
  paymentCents:58_000,totalPaymentCents:3_480_000,financeChargeCents:480_000,modeMetadata:{},sourceType:"lender-quote",sourceLabel:"Controlled lender quote",
  sourceReference:"program:v1",calculationPolicyVersion:"quote-vnext-v1",roundingPolicyVersion:"half-up-cent-v1",calculationFingerprint:"a".repeat(64),createdAt:"2026-09-17T00:00:00.000Z",
};
const trade=(id:string,allowance:number,payoff:number,appraisalAllowance=allowance):QuoteTradeSnapshot=>({
  id:`qts_${id}`,organizationId:"org_example1",quoteId:"quo_example1",productScenarioId:"qps_example1",tradeAppraisalId:`tap_${id}`,position:0,
  appraisalVersion:1,appraisalRevisionAt:"2026-09-17T00:00:00.000Z",appraisalAllowanceCents:appraisalAllowance,quoteAllowanceCents:allowance,payoffCents:payoff,
  equityCents:allowance-payoff,quoteAdjustmentCents:allowance-appraisalAllowance,...(allowance===appraisalAllowance?{}:{adjustmentReason:"Manager-approved Quote allowance."}),
  taxTreatmentMetadata:{jurisdiction:"unresolved"},sourceType:"application",createdAt:"2026-09-17T00:00:00.000Z",
});

describe("Quote vNext scenario contracts",()=>{
  it("accepts complete finance and fails incomplete lease closed",()=>{
    expect(validateQuotePaymentScenario(base)).toEqual([]);
    expect(validateQuotePaymentScenario({...base,mode:"lease",calculationStatus:"incomplete",termMonths:36,aprBasisPoints:undefined,amountFinancedCents:undefined,financeChargeCents:undefined,modeMetadata:{}})).toEqual(expect.arrayContaining([expect.stringContaining("fail closed"),expect.stringContaining("adjustedCapCostCents")]));
  });
  it("accepts complete provider lease terms",()=>{
    const lease={...base,mode:"lease" as const,termMonths:36,aprBasisPoints:undefined,amountFinancedCents:undefined,financeChargeCents:undefined,sourceType:"oem-program" as const,modeMetadata:{adjustedCapCostCents:3_500_000,residualValueCents:2_100_000,moneyFactorPpm:1250,acquisitionFeeCents:69_500,capCostReductionCents:300_000,rebateCents:100_000}};
    expect(validateQuotePaymentScenario(lease)).toEqual([]);
  });
  it("aggregates multiple positive and negative Trade snapshots without rewriting appraisal values",()=>{
    const first=trade("first",1_200_000,700_000),second=trade("second",800_000,900_000,750_000);
    expect(aggregateQuoteTradeEquity([first,second])).toBe(400_000);expect(second.appraisalAllowanceCents).toBe(750_000);expect(second.quoteAdjustmentCents).toBe(50_000);
  });
  it("rejects duplicate and inconsistent Trade evidence",()=>{
    const first=trade("first",1_200_000,700_000);expect(()=>aggregateQuoteTradeEquity([first,first])).toThrow("Duplicate");expect(()=>aggregateQuoteTradeEquity([{...first,equityCents:0}])).toThrow("inconsistent");
  });
});
