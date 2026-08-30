import { AppShell } from "@/components/app-shell";
import { OperatingBrief } from "@/components/ai/OperatingBrief";
import { buildOperatingBrief } from "@/lib/application/ai";
import { loadDirectoryContext } from "@/app/organizations/[organizationId]/_lib/load-directory-context";
import { resolveWorkspaceProfiles, RoleWorkspaceReader } from "@/lib/server/organizations";

export const dynamic="force-dynamic";
interface Props{params:Promise<{organizationId:string}>;searchParams:Promise<{view?:string}>}

export default async function AIWorkspacePage({params,searchParams}:Props){
  const{organizationId}=await params,{view}=await searchParams;
  const context=await loadDirectoryContext(organizationId,"customer.read");
  const resolved=resolveWorkspaceProfiles(context.membership,view),profile=resolved.active;
  const base=`/organizations/${organizationId}/ai`;
  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base} breadcrumbs={[{label:context.organization.name},{label:"DealerFlow AI"}]} user={{name:context.session.user.name,email:context.session.user.email,...(context.session.user.image?{image:context.session.user.image}:{})}}>
    <section aria-labelledby="ai-workspace-heading" className="mx-auto max-w-7xl">
      <header className="min-w-0 border-b pb-6"><p className="break-words text-xs font-semibold uppercase tracking-[0.1em] text-primary sm:tracking-[0.18em]">Authorized operating assistant</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl" id="ai-workspace-heading">DealerFlow AI</h1><p className="mt-2 max-w-3xl break-words text-sm leading-6 text-muted-foreground">Role-aware operating guidance grounded in the DealerFlow records your membership can access.</p></header>
      {!context.configuration.features.ai?<Unavailable title="DealerFlow AI is disabled" description="This organization has disabled the AI module."/>:!profile?<Unavailable title="No authorized AI context" description="Your membership does not include an enabled operational workspace."/>:!profile.moduleAvailable?<Unavailable title={`${profile.label} intelligence is unavailable`} description="DealerFlow will not create guidance without an authoritative workflow and supporting records."/>:<AIWorkspaceContent context={context} profile={profile}/>} 
    </section>
  </AppShell>;
}

async function AIWorkspaceContent({context,profile}:{context:Awaited<ReturnType<typeof loadDirectoryContext>>;profile:NonNullable<ReturnType<typeof resolveWorkspaceProfiles>["active"]>}){
  const model=await new RoleWorkspaceReader(context.pool).read({userId:context.session.user.id,organizationId:context.organization.id,membership:context.membership,profile});
  const prompts=starterPrompts(profile.key);
  return <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><OperatingBrief brief={buildOperatingBrief({capabilities:context.membership.capabilities,model,profile})}/><aside className="min-w-0 space-y-6" aria-label="AI workspace controls"><section aria-labelledby="starter-prompts" className="rounded-xl border bg-card p-4 shadow-soft sm:p-5"><h2 className="font-semibold" id="starter-prompts">Role-aware questions</h2><p className="mt-1 text-sm text-muted-foreground">These show the questions this workspace is designed to answer.</p><ul className="mt-4 space-y-2" role="list">{prompts.map(prompt=><li className="rounded-lg border bg-muted/20 p-3 text-sm" key={prompt}>{prompt}</li>)}</ul></section><section aria-labelledby="conversation-status" className="rounded-xl border border-dashed bg-muted/20 p-4 sm:p-5"><h2 className="font-semibold" id="conversation-status">Conversational assistant unavailable</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">A restricted AI provider is not configured in staging. Verified operating briefs remain available, but DealerFlow will not simulate provider answers, drafts, or streaming.</p><p className="mt-3 text-xs text-muted-foreground">No autonomous actions are enabled.</p></section></aside></div>;
}

function Unavailable({title,description}:{title:string;description:string}){return <section aria-labelledby="ai-unavailable" className="mt-6 rounded-xl border border-dashed bg-muted/20 p-8 text-center"><h2 className="font-semibold" id="ai-unavailable">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p></section>}
function starterPrompts(key:string){if(key==="my-work")return["Who should I work with first?","Which follow-ups are overdue?","What appointments do I have today?"];if(key==="team-management")return["What needs manager attention?","Which Leads are unassigned?","Which Deals need review?"];if(key==="bdc")return["Which Leads need engagement?","What appointments need attention?","What is overdue?"];if(key==="inventory")return["Which vehicles are missing photos?","What inventory needs attention?","Which provider data is unavailable?"];if(key==="finance"||key==="controller")return["Which Deals require review?","What is pending approval?","What finance context is excluded?"];return["What needs attention today?","Where is operational risk?","What verified records support this brief?"];}
