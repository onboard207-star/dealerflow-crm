"use server";

import { revalidatePath } from "next/cache";

import {
  QuoteApprovalService,
  QuoteApprovalIntegrityError,
  QuoteApprovalValidationError,
  QuoteIncentiveService,
  QuoteIncentiveIntegrityError,
  QuoteIncentiveValidationError,
  type QuoteApprovalDecision,
} from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import { PostgresQuoteApprovalProvider, PostgresQuoteIncentiveProvider } from "@/lib/server/deals";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export type QuoteApprovalActionState = {
  ok: boolean;
  message: string;
};

export async function decideQuoteApprovalAction(
  organizationId: string,
  approvalId: string,
  decision: QuoteApprovalDecision,
  _previousState: QuoteApprovalActionState,
  formData: FormData,
): Promise<QuoteApprovalActionState> {
  try {
    const context = await loadDirectoryContext(organizationId, "deal.read");
    const reason = String(formData.get("reason") ?? "").trim();
    const service = new QuoteApprovalService(
      new PostgresQuoteApprovalProvider(context.pool, {
        userId: context.session.user.id,
        organizationId,
      }),
    );

    const result = await service.decide({
      actor: context.actor,
      organizationId,
      correlationId: `desking:${approvalId}`,
      idempotencyKey: `desking:${approvalId}:${decision}`,
      approvalId,
      decision,
      ...(reason ? { reason } : {}),
    });

    revalidatePath(`/organizations/${organizationId}/desking`);
    return {
      ok: true,
      message:
        result.approval.status === "approved"
          ? "Quote approved."
          : "Quote declined. A revised quote version is required before issue.",
    };
  } catch (error) {
    if (
      error instanceof QuoteApprovalIntegrityError ||
      error instanceof QuoteApprovalValidationError ||
      error instanceof AuthorizationError
    ) {
      return { ok: false, message: error.message };
    }
    console.error("Quote approval decision failed", {
      organizationId,
      approvalId,
      decision,
      error,
    });
    return { ok: false, message: "The quote approval decision could not be saved." };
  }
}

export async function decideIncentiveEligibilityAction(
  organizationId:string,
  applicationId:string,
  decision:"verified"|"ineligible",
  _previousState:QuoteApprovalActionState,
  formData:FormData,
):Promise<QuoteApprovalActionState>{
  try{
    const context=await loadDirectoryContext(organizationId,"deal.read");
    const basis=String(formData.get("eligibilityBasis")??"").trim();
    const service=new QuoteIncentiveService(
      new PostgresQuoteIncentiveProvider(context.pool,{
        userId:context.session.user.id,
        organizationId,
      }),
    );
    await service.decide({
      actor:context.actor,
      organizationId,
      correlationId:`incentive-decision:${applicationId}`,
      applicationId,
      decision,
      eligibilityBasis:basis,
    });
    revalidatePath(`/organizations/${organizationId}/desking`);
    return {ok:true,message:decision==="verified"?"Incentive eligibility verified.":"Customer marked ineligible for this incentive."};
  }catch(error){
    if(error instanceof QuoteIncentiveIntegrityError||error instanceof QuoteIncentiveValidationError||error instanceof AuthorizationError){
      return {ok:false,message:error.message};
    }
    return {ok:false,message:"The incentive eligibility decision could not be saved."};
  }
}
