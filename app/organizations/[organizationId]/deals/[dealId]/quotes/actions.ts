"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  QuoteApprovalIntegrityError,
  QuoteApprovalService,
  QuoteApprovalValidationError,
  QuoteTermsIntegrityError,
  QuoteTermsService,
  QuoteTermsValidationError,
  QuoteLeaseIntegrityError,
  QuoteLeaseTermsService,
  QuoteLeaseValidationError,
  QuoteIncentiveService,
  QuoteIncentiveIntegrityError,
  QuoteIncentiveValidationError,
  QuoteBackendProductService,
  QuoteBackendProductIntegrityError,
  QuoteBackendProductValidationError,
  QuoteProfitabilityService,
  QuoteIntegrityError,
  QuoteService,
  QuoteTransitionError,
  QuoteValidationError,
  type QuoteLineCategory,
} from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import {
  PostgresQuoteApprovalProvider,
  PostgresQuoteProvider,
  PostgresQuoteTermsProvider,
  PostgresQuoteLeaseProvider,
  PostgresQuoteIncentiveProvider,
  PostgresQuoteBackendProductProvider,
  PostgresQuoteProfitabilityProvider,
} from "@/lib/server/deals";
import { loadDirectoryContext } from "../../../_lib/load-directory-context";

type LineInput = {
  category: QuoteLineCategory;
  description: string;
  unitAmountCents: number;
};

export async function createQuoteVersionAction(
  organizationId: string,
  dealId: string,
  formData: FormData,
) {
  const base = `/organizations/${organizationId}/deals/${dealId}/quotes`;
  try {
    const context = await loadDirectoryContext(organizationId, "deal.read");
    const purchaseType = enumValue(formData.get("purchaseType"), [
      "cash",
      "finance",
      "lease",
    ] as const);
    if (!purchaseType) throw new Error("Purchase type is required.");

    const vehiclePrice = parseRequiredMoney(formData, "vehiclePrice", "Vehicle selling price");
    const productAmount = parseOptionalMoney(formData, "productAmount");
    const accessoryAmount = parseOptionalMoney(formData, "accessoryAmount");
    const feeAmount = parseOptionalMoney(formData, "feeAmount");
    const taxAmount = parseOptionalMoney(formData, "taxAmount");
    const discountAmount = parseOptionalMoney(formData, "discountAmount");

    const lines: LineInput[] = [
      {
        category: "vehicle",
        description: "Vehicle selling price",
        unitAmountCents: vehiclePrice,
      },
    ];
    if (productAmount !== undefined && productAmount > 0) {
      lines.push({
        category: "product",
        description: String(formData.get("productDescription") ?? "").trim() || "Dealer product",
        unitAmountCents: productAmount,
      });
    }
    if (accessoryAmount !== undefined && accessoryAmount > 0) {
      lines.push({
        category: "accessory",
        description:
          String(formData.get("accessoryDescription") ?? "").trim() || "Accessory",
        unitAmountCents: accessoryAmount,
      });
    }
    if (feeAmount !== undefined && feeAmount > 0) {
      lines.push({
        category: "fee",
        description: String(formData.get("feeDescription") ?? "").trim() || "Dealer fee",
        unitAmountCents: feeAmount,
      });
    }
    if (taxAmount !== undefined && taxAmount > 0) {
      lines.push({
        category: "tax",
        description: "Estimated tax",
        unitAmountCents: taxAmount,
      });
    }
    if (discountAmount !== undefined && discountAmount > 0) {
      lines.push({
        category: "discount",
        description: String(formData.get("discountDescription") ?? "").trim() || "Discount",
        unitAmountCents: -discountAmount,
      });
    }

    const expiresAt = String(formData.get("expiresAt") ?? "").trim();
    const service = new QuoteService(
      new PostgresQuoteProvider(context.pool, {
        userId: context.session.user.id,
        organizationId,
      }),
    );
    const result = await service.create({
      actor: context.actor,
      organizationId,
      correlationId: `quote-workspace:${randomUUID()}`,
      idempotencyKey: `workspace:${dealId}:${randomUUID()}`,
      dealId,
      purchaseType,
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      lines,
    });
    revalidatePath(base);
    redirect(`${base}?notice=${encodeURIComponent(`Quote version ${result.quote.version} created.`)}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error, "The Quote version could not be created."))}`);
  }
}

export async function requestQuoteApprovalAction(
  organizationId: string,
  dealId: string,
  quoteId: string,
  formData: FormData,
) {
  const base = `/organizations/${organizationId}/deals/${dealId}/quotes`;
  try {
    const context = await loadDirectoryContext(organizationId, "deal.read");
    const reason = String(formData.get("reason") ?? "").trim();
    const service = new QuoteApprovalService(
      new PostgresQuoteApprovalProvider(context.pool, {
        userId: context.session.user.id,
        organizationId,
      }),
    );
    await service.request({
      actor: context.actor,
      organizationId,
      correlationId: `quote-approval:${randomUUID()}`,
      idempotencyKey: `quote-approval:${quoteId}:${randomUUID()}`,
      quoteId,
      ...(reason ? { reason } : {}),
    });
    revalidatePath(base);
    revalidatePath(`/organizations/${organizationId}/desking`);
    redirect(`${base}?notice=${encodeURIComponent("Manager approval requested.")}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error, "Manager approval could not be requested."))}`);
  }
}

export async function presentQuoteAction(
  organizationId: string,
  dealId: string,
  quoteId: string,
) {
  const base = `/organizations/${organizationId}/deals/${dealId}/quotes`;
  try {
    const context = await loadDirectoryContext(organizationId, "deal.read");
    const service = new QuoteService(
      new PostgresQuoteProvider(context.pool, {
        userId: context.session.user.id,
        organizationId,
      }),
    );
    await service.transition({
      actor: context.actor,
      organizationId,
      correlationId: `quote-present:${randomUUID()}`,
      idempotencyKey: `quote-present:${quoteId}:${randomUUID()}`,
      quoteId,
      toStatus: "presented",
    });
    revalidatePath(base);
    redirect(`${base}?notice=${encodeURIComponent("Quote marked presented.")}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error, "The Quote could not be presented."))}`);
  }
}

export async function attachQuoteTermsAction(organizationId: string, dealId: string, quoteId: string, formData: FormData) {
  const base = `/organizations/${organizationId}/deals/${dealId}/quotes`;
  try {
    const context = await loadDirectoryContext(organizationId, "deal.read");
    const cashDownCents = parseOptionalMoney(formData, "cashDown");
    const tradeAppraisalId = String(formData.get("tradeAppraisalId") ?? "").trim();
    const apr = String(formData.get("apr") ?? "").trim();
    const term = String(formData.get("termMonths") ?? "").trim();
    const sourceType = enumValue(formData.get("sourceType"), ["manual-entry", "lender-quote", "oem-program", "dealer-program"] as const);
    const sourceLabel = String(formData.get("sourceLabel") ?? "").trim();
    const sourceReference = String(formData.get("sourceReference") ?? "").trim();
    const hasFinanceInput = Boolean(apr || term || sourceType || sourceLabel || sourceReference);
    let finance: { aprBasisPoints: number; termMonths: number; sourceType: "manual-entry" | "lender-quote" | "oem-program" | "dealer-program"; sourceLabel: string; sourceReference?: string } | undefined;
    if (hasFinanceInput) {
      if (!apr || !term || !sourceType || !sourceLabel) throw new Error("APR, term, source type, and source label are all required to calculate a payment.");
      finance = { aprBasisPoints: parseAprToBasisPoints(apr), termMonths: parseTerm(term), sourceType, sourceLabel, ...(sourceReference ? { sourceReference } : {}) };
    }
    await new QuoteTermsService(new PostgresQuoteTermsProvider(context.pool, { userId: context.session.user.id, organizationId })).create({
      actor: context.actor, organizationId, correlationId: `quote-terms:${randomUUID()}`, quoteId,
      ...(cashDownCents !== undefined ? { cashDownCents } : {}), ...(tradeAppraisalId ? { tradeAppraisalId } : {}), ...(finance ? { finance } : {}),
    });
    revalidatePath(base);
    revalidatePath(`/organizations/${organizationId}/quotes/${quoteId}/print`);
    redirect(`${base}?notice=${encodeURIComponent("Commercial and finance terms saved to this Quote version.")}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error, "Quote terms could not be saved."))}`);
  }
}

export async function attachQuoteLeaseTermsAction(organizationId: string, dealId: string, quoteId: string, formData: FormData) {
  const base = `/organizations/${organizationId}/deals/${dealId}/quotes`;
  try {
    const context = await loadDirectoryContext(organizationId, "deal.read");
    const sourceType = enumValue(formData.get("leaseSourceType"), ["manual-entry", "lender-quote", "oem-program", "dealer-program"] as const);
    const sourceLabel = String(formData.get("leaseSourceLabel") ?? "").trim();
    const sourceReference = String(formData.get("leaseSourceReference") ?? "").trim();
    const annualMileage = String(formData.get("annualMileage") ?? "").trim();
    if (!sourceType || !sourceLabel) throw new Error("Lease source type and source label are required.");
    await new QuoteLeaseTermsService(new PostgresQuoteLeaseProvider(context.pool, { userId: context.session.user.id, organizationId })).create({
      actor: context.actor, organizationId, correlationId: `quote-lease:${randomUUID()}`, quoteId,
      adjustedCapCostCents: parseRequiredMoney(formData, "adjustedCapCost", "Adjusted cap cost"),
      residualValueCents: parseRequiredMoney(formData, "residualValue", "Residual value"),
      moneyFactorPpm: parseMoneyFactorToPpm(String(formData.get("moneyFactor") ?? "").trim()),
      termMonths: parseTerm(String(formData.get("leaseTermMonths") ?? "").trim()),
      ...(annualMileage ? { annualMileage: parseAnnualMileage(annualMileage) } : {}),
      ...(parseOptionalMoney(formData, "acquisitionFee") !== undefined ? { acquisitionFeeCents: parseOptionalMoney(formData, "acquisitionFee") } : {}),
      ...(parseOptionalMoney(formData, "capCostReduction") !== undefined ? { capCostReductionCents: parseOptionalMoney(formData, "capCostReduction") } : {}),
      ...(parseOptionalMoney(formData, "rebate") !== undefined ? { rebateCents: parseOptionalMoney(formData, "rebate") } : {}),
      sourceType, sourceLabel, ...(sourceReference ? { sourceReference } : {}),
    });
    revalidatePath(base);
    revalidatePath(`/organizations/${organizationId}/quotes/${quoteId}/print`);
    redirect(`${base}?notice=${encodeURIComponent("Lease terms saved to this Quote version.")}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error, "Lease terms could not be saved."))}`);
  }
}

function parseRequiredMoney(formData: FormData, name: string, label: string) {
  const value = parseMoney(String(formData.get(name) ?? ""));
  if (value === undefined) throw new Error(`${label} is required.`);
  return value;
}

function parseOptionalMoney(formData: FormData, name: string) {
  return parseMoney(String(formData.get(name) ?? ""));
}

function parseMoney(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Money values must be nonnegative with no more than two decimal places.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Money value is invalid.");
  return cents;
}

function parseAprToBasisPoints(value: string) {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) throw new Error("APR must be a percentage with at most two decimal places.");
  const apr = Number(value);
  if (!Number.isFinite(apr) || apr < 0 || apr > 100) throw new Error("APR must be between 0% and 100%.");
  return Math.round(apr * 100);
}

function parseTerm(value: string) {
  if (!/^\d+$/.test(value)) throw new Error("Term must be a whole number of months.");
  const term = Number(value);
  if (!Number.isSafeInteger(term) || term < 1 || term > 120) throw new Error("Term must be between 1 and 120 months.");
  return term;
}

function parseMoneyFactorToPpm(value: string) {
  if (!/^0(?:\.\d{1,6})?$/.test(value)) throw new Error("Money factor must be a decimal such as 0.002050.");
  const factor = Number(value);
  if (!Number.isFinite(factor) || factor < 0 || factor > 0.1) throw new Error("Money factor is outside the supported range.");
  return Math.round(factor * 1_000_000);
}

function parseAnnualMileage(value: string) {
  if (!/^\d+$/.test(value)) throw new Error("Annual mileage must be a whole number.");
  const mileage = Number(value);
  if (!Number.isSafeInteger(mileage) || mileage <= 0 || mileage > 100000) throw new Error("Annual mileage is invalid.");
  return mileage;
}

function enumValue<const V extends readonly string[]>(
  value: FormDataEntryValue | null,
  values: V,
): V[number] | undefined {
  return typeof value === "string" && values.includes(value) ? (value as V[number]) : undefined;
}

function message(error: unknown, fallback: string) {
  if (
    error instanceof QuoteValidationError ||
    error instanceof QuoteIntegrityError ||
    error instanceof QuoteTransitionError ||
    error instanceof QuoteApprovalValidationError ||
    error instanceof QuoteApprovalIntegrityError ||
    error instanceof QuoteTermsValidationError ||
    error instanceof QuoteTermsIntegrityError ||
    error instanceof QuoteLeaseValidationError ||
    error instanceof QuoteLeaseIntegrityError ||
    error instanceof QuoteIncentiveValidationError ||
    error instanceof QuoteIncentiveIntegrityError ||
    error instanceof QuoteBackendProductValidationError ||
    error instanceof QuoteBackendProductIntegrityError ||
    error instanceof AuthorizationError ||
    error instanceof Error
  ) {
    return error.message;
  }
  return fallback;
}

function isRedirectError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT"),
  );
}

export async function attachIncentiveProgramAction(
  organizationId:string,
  dealId:string,
  quoteId:string,
  formData:FormData,
) {
  const base=`/organizations/${organizationId}/deals/${dealId}/quotes`;
  try {
    const context=await loadDirectoryContext(organizationId,"deal.read");
    const quoteLineId=String(formData.get("quoteLineId")??"").trim();
    const programId=String(formData.get("programId")??"").trim();
    const amountRaw=String(formData.get("amountCents")??"").trim();
    if(!quoteLineId||!programId||!/^\d+$/.test(amountRaw)) {
      throw new Error("Discount line and incentive program are required.");
    }
    const service=new QuoteIncentiveService(
      new PostgresQuoteIncentiveProvider(context.pool,{
        userId:context.session.user.id,
        organizationId,
      }),
    );
    await service.create({
      actor:context.actor,
      organizationId,
      correlationId:`quote-incentive:${randomUUID()}`,
      quoteId,
      quoteLineId,
      programId,
      amountCents:Number(amountRaw),
    });
    revalidatePath(base);
    revalidatePath(`/organizations/${organizationId}/desking`);
    redirect(`${base}?notice=${encodeURIComponent("Incentive attached and awaiting eligibility verification.")}`);
  } catch(error) {
    if(isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error,"Incentive could not be attached."))}`);
  }
}

export async function attachBackendProductCostAction(
  organizationId:string,
  dealId:string,
  quoteId:string,
  formData:FormData,
) {
  const base=`/organizations/${organizationId}/deals/${dealId}/quotes`;
  try{
    const context=await loadDirectoryContext(organizationId,"deal.read");
    const quoteLineId=String(formData.get("quoteLineId")??"").trim();
    const productId=String(formData.get("productId")??"").trim();
    const costCents=parseRequiredMoney(formData,"cost","Internal cost");
    const service=new QuoteBackendProductService(
      new PostgresQuoteBackendProductProvider(context.pool,{
        userId:context.session.user.id,organizationId
      }),
    );
    await service.attach({
      actor:context.actor,organizationId,
      correlationId:`quote-backend:${randomUUID()}`,
      quoteId,quoteLineId,productId,costCents
    });
    revalidatePath(base);
    revalidatePath(`/organizations/${organizationId}/desking`);
    redirect(`${base}?notice=${encodeURIComponent("Internal product cost saved.")}`);
  }catch(error){
    if(isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error,"Internal product cost could not be saved."))}`);
  }
}

export async function captureQuoteProfitabilityAction(organizationId: string, dealId: string, quoteId: string, formData: FormData) {
  void formData;
  const base = `/organizations/${organizationId}/deals/${dealId}/quotes`;
  try {
    const context = await loadDirectoryContext(organizationId, "deal.read");
    await new QuoteProfitabilityService(new PostgresQuoteProfitabilityProvider(context.pool, { userId: context.session.user.id, organizationId })).capture({
      actor: context.actor, organizationId, correlationId: `quote-profitability:${randomUUID()}`, quoteId,
    });
    revalidatePath(base);
    revalidatePath(`/organizations/${organizationId}/desking`);
    redirect(`${base}?notice=${encodeURIComponent("Profitability snapshot captured for this Quote version.")}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`${base}?error=${encodeURIComponent(message(error, "Profitability could not be captured."))}`);
  }
}
