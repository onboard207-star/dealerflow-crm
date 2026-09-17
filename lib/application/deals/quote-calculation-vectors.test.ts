import { describe, expect, it } from "vitest";
import { requiredQuoteCalculationVectors, validateReviewedQuoteCalculationVector } from "./quote-calculation-vectors";

describe("Quote calculation vector framework",()=>{
  it("declares the complete locked RC1 vector matrix without manufacturing expected values",()=>{
    expect(requiredQuoteCalculationVectors).toHaveLength(15);
    expect(new Set(requiredQuoteCalculationVectors.map(item=>item.id)).size).toBe(15);
    expect(requiredQuoteCalculationVectors.map(item=>item.id)).toEqual(expect.arrayContaining(["one-time-pay-otd","two-trades","provider-lease","incomplete-lease","stale-program"]));
    expect(requiredQuoteCalculationVectors.some(item=>Object.hasOwn(item,"expected"))).toBe(false);
  });
  it("requires independent evidence before a vector can be accepted",()=>{
    expect(validateReviewedQuoteCalculationVector({id:"positive-apr-finance",input:{},expected:{},independentlyReviewedBy:"",reviewedAt:"invalid",evidenceReference:""})).toHaveLength(4);
    expect(validateReviewedQuoteCalculationVector({id:"positive-apr-finance",input:{principalCents:3_000_000},expected:{paymentCents:58_000},independentlyReviewedBy:"Finance reviewer",reviewedAt:"2026-09-17T12:00:00.000Z",evidenceReference:"review:quote-vector-003"})).toEqual([]);
  });
});
