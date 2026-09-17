export const requiredQuoteCalculationVectors = [
  { id:"one-time-pay-otd", label:"One-time-pay out-the-door", requirement:"Cash total includes governed taxes and fees." },
  { id:"zero-apr-finance", label:"0% APR finance", requirement:"Principal amortizes without finance charge." },
  { id:"positive-apr-finance", label:"Positive APR finance", requirement:"Payment, total payments, and finance charge reconcile." },
  { id:"odd-cent-rounding", label:"Odd-cent rounding boundary", requirement:"The approved rounding policy resolves a half-cent boundary." },
  { id:"large-cash-down", label:"Large cash down", requirement:"Cash down remains bounded and amount financed stays nonnegative." },
  { id:"positive-equity", label:"Positive Trade equity", requirement:"Positive equity reduces the governed amount due or financed." },
  { id:"negative-equity", label:"Negative Trade equity", requirement:"Negative equity is carried explicitly without changing appraisal evidence." },
  { id:"two-trades", label:"Two Trades", requirement:"Multiple Trade snapshots aggregate deterministically." },
  { id:"rebate-tax-base", label:"Rebate tax-base treatment", requirement:"Jurisdiction policy determines whether rebate changes taxable base." },
  { id:"taxable-fee", label:"Taxable fee", requirement:"The fee participates in taxable base under the fixture policy." },
  { id:"non-taxable-fee", label:"Non-taxable fee", requirement:"The fee remains outside taxable base under the fixture policy." },
  { id:"optional-backend-product", label:"Optional backend product", requirement:"Selected product sell amount enters customer economics without exposing cost." },
  { id:"provider-lease", label:"Validated provider lease", requirement:"Complete provider terms produce the reviewed payment." },
  { id:"incomplete-lease", label:"Incomplete lease failure", requirement:"Missing required provider terms fail closed without a payment." },
  { id:"stale-program", label:"Stale program failure", requirement:"An expired or superseded source revision fails closed." },
] as const;

export type QuoteCalculationVectorId = typeof requiredQuoteCalculationVectors[number]["id"];

export interface ReviewedQuoteCalculationVector {
  id: QuoteCalculationVectorId;
  input: Readonly<Record<string, unknown>>;
  expected: Readonly<Record<string, number | string>>;
  independentlyReviewedBy: string;
  reviewedAt: string;
  evidenceReference: string;
}

export function validateReviewedQuoteCalculationVector(vector: ReviewedQuoteCalculationVector): readonly string[] {
  const issues: string[] = [];
  if (!requiredQuoteCalculationVectors.some((item) => item.id === vector.id)) issues.push("Vector ID is not in the required RC1 matrix.");
  if (!vector.independentlyReviewedBy.trim()) issues.push("Independent reviewer is required.");
  if (Number.isNaN(Date.parse(vector.reviewedAt))) issues.push("Review timestamp is invalid.");
  if (!vector.evidenceReference.trim()) issues.push("Independent evidence reference is required.");
  if (!Object.keys(vector.expected).length) issues.push("Independently reviewed expected values are required.");
  for (const [key,value] of Object.entries(vector.expected)) if (typeof value === "number" && !Number.isSafeInteger(value)) issues.push(`${key} must be a safe integer.`);
  return issues;
}
