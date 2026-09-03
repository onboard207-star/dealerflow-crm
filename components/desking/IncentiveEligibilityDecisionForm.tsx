"use client";
import {useActionState} from"react";
import {decideIncentiveEligibilityAction,type QuoteApprovalActionState} from"@/app/organizations/[organizationId]/desking/actions";
const initialState:QuoteApprovalActionState={ok:false,message:""};
export function IncentiveEligibilityDecisionForm({organizationId,applicationId,decision}:{organizationId:string;applicationId:string;decision:"verified"|"ineligible"}){
  const action=decideIncentiveEligibilityAction.bind(null,organizationId,applicationId,decision);
  const[state,formAction,pending]=useActionState(action,initialState);
  return <form action={formAction} className="space-y-2">
    <textarea className="focus-ring min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm" maxLength={1000} name="eligibilityBasis" placeholder={decision==="verified"?"Document why the customer qualifies":"Document why the customer does not qualify"} required/>
    <button className={decision==="verified"?"focus-ring min-h-10 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground":"focus-ring min-h-10 w-full rounded-lg border px-3 text-sm font-medium"} disabled={pending}>
      {pending?"Saving…":decision==="verified"?"Verify eligibility":"Mark ineligible"}
    </button>
    {state.message?<p aria-live="polite" className="text-xs text-muted-foreground">{state.message}</p>:null}
  </form>;
}
