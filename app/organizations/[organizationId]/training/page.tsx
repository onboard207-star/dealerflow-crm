import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { loadDirectoryContext } from "@/app/organizations/[organizationId]/_lib/load-directory-context";
import { resolveHelpContext, resolveReleaseEducation, resolveRoleTraining, searchKnowledge, type KnowledgeCategory, type LearningViewer } from "@/lib/application/learning";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Training Center" };

interface Props {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}

const categories: readonly KnowledgeCategory[] = ["getting-started", "sales", "bdc", "management", "inventory", "finance", "recon", "service", "ai", "mobile", "integrations", "billing", "admin", "troubleshooting", "security"];

export default async function TrainingCenterPage({ params, searchParams }: Props) {
  const { organizationId } = await params;
  const { q = "", category } = await searchParams;
  const context = await loadDirectoryContext(organizationId, "customer.read");
  const viewer: LearningViewer = { organizationId, roleKeys: context.membership.roleKeys ?? [], capabilities: context.membership.capabilities, audience: "dealer" };
  const selectedCategory = categories.find((item) => item === category);
  const courses = resolveRoleTraining(viewer);
  const articles = searchKnowledge({ query: q, viewer, ...(selectedCategory ? { category: selectedCategory } : {}) });
  const releases = resolveReleaseEducation(viewer);
  const base = `/organizations/${organizationId}/training`;

  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base} breadcrumbs={[{ label: context.organization.name }, { label: "Training Center" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
    <div className="mx-auto max-w-7xl" aria-labelledby="training-heading">
      <header className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Role-aware learning</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" id="training-heading">Training Center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Learn the workflows available to your current role, find approved product guidance, and review relevant changes.</p>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="my-training-heading">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-primary">My Training</p><h2 className="mt-1 text-xl font-semibold" id="my-training-heading">Courses for your role</h2></div><Pill>{courses.length} {courses.length === 1 ? "track" : "tracks"}</Pill></div>
            {courses.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{courses.map((course) => <section className="rounded-xl border bg-card shadow-soft" key={course.id} aria-labelledby={`${course.id}-heading`}><header className="p-5"><div className="flex flex-wrap items-center gap-2"><Pill primary>{course.required ? "Required" : "Optional"}</Pill><span className="text-xs text-muted-foreground">Version {course.version}</span></div><h3 className="mt-3 text-lg font-semibold" id={`${course.id}-heading`}>{course.title}</h3><p className="mt-1 text-sm text-muted-foreground">{course.description}</p></header><div className="px-5 pb-5"><ol className="space-y-2" aria-label={`${course.title} modules`}>{course.modules.map((item, index) => <li className="flex gap-3 rounded-lg border bg-muted/20 p-3 text-sm" key={item.id}><span className="font-semibold text-primary" aria-hidden="true">{index + 1}</span><span>{item.title}</span></li>)}</ol><p className="mt-4 text-xs leading-5 text-muted-foreground">Completion tracking and acknowledgments are not yet persisted. Opening this course does not mark it complete.</p></div></section>)}</div> : <div className="mt-4 rounded-xl border border-dashed bg-muted/20 p-6"><h3 className="font-medium">No published role track</h3><p className="mt-2 text-sm text-muted-foreground">DealerFlow will not assign training for unfinished modules. Contact your dealer administrator if your role assignment is incorrect.</p></div>}
          </section>

          <section aria-labelledby="knowledge-heading">
            <p className="text-sm font-medium text-primary">Product Guides</p><h2 className="mt-1 text-xl font-semibold" id="knowledge-heading">Search approved knowledge</h2>
            <form className="mt-4 grid gap-3 rounded-xl border bg-card p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_12rem_auto]" action={base} method="get" role="search">
              <label className="space-y-2"><span className="text-sm font-medium">Keywords</span><input className="focus-ring min-h-11 w-full rounded-lg border bg-background px-3 text-sm" defaultValue={q} name="q" placeholder="Search product help" /></label>
              <label className="space-y-2"><span className="text-sm font-medium">Category</span><select className="focus-ring min-h-11 w-full rounded-lg border bg-background px-3 text-sm" defaultValue={selectedCategory ?? ""} name="category"><option value="">All visible</option>{categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
              <button className="focus-ring min-h-11 self-end rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">Search</button>
            </form>
            <div className="mt-4 space-y-3" aria-live="polite">{articles.length ? articles.map((article) => <article className="rounded-xl border bg-card p-4 shadow-soft sm:p-5" key={article.id}><div className="flex flex-wrap items-center gap-2"><Pill>{label(article.category)}</Pill><span className="text-xs text-muted-foreground">Version {article.version} · reviewed {article.lastReviewed}</span></div><h3 className="mt-3 font-semibold">{article.title}</h3><p className="mt-2 text-sm text-muted-foreground">{article.summary}</p><p className="mt-3 text-sm leading-6">{article.body}</p></article>) : <div className="rounded-xl border border-dashed bg-muted/20 p-6"><h3 className="font-medium">No visible results</h3><p className="mt-2 text-sm text-muted-foreground">Try a different keyword or category. Hidden or retired content is never included in results.</p></div>}</div>
          </section>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Training and help resources">
          <AsideCard title="Quick Start" description="Start with the product available to your role."><ol className="space-y-3 text-sm"><li>1. Open your role workspace.</li><li>2. Review current priorities and queues.</li><li>3. Open an authorized record.</li><li>4. Use contextual product guidance.</li><li>5. Verify important AI-supported facts.</li></ol><Link className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium" href={`/organizations/${organizationId}/workspace`}>Open my workspace</Link></AsideCard>
          <HelpSummary viewer={viewer} organizationId={organizationId} />
          <AsideCard title="What's New" description="Published changes relevant to your role and current access.">{releases.length ? <ul className="space-y-4">{releases.map((item) => <li key={item.id}><Pill>{label(item.kind)}</Pill><p className="mt-2 text-sm font-medium">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.summary}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No current release education applies to your role.</p>}</AsideCard>
          <section className="rounded-xl border border-dashed bg-muted/20 p-4" aria-labelledby="support-status"><h2 className="font-semibold" id="support-status">Support requests unavailable</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">A canonical support-request authority and monitored destination are not configured. DealerFlow will not pretend a request was submitted.</p></section>
        </aside>
      </div>
    </div>
  </AppShell>;
}

function HelpSummary({ viewer, organizationId }: { viewer: LearningViewer; organizationId: string }) {
  const workspaces = ["customer", "inventory", "ai", "deals"];
  const visible = workspaces.map((workspace) => resolveHelpContext(workspace, viewer)).filter((item): item is NonNullable<typeof item> => Boolean(item) && item!.articles.length > 0);
  return <AsideCard title="Contextual Help" description="Guidance is scoped to the workspace and your current access."><ul className="space-y-3">{visible.map(({ context, articles }) => <li className="rounded-lg border p-3" key={context.workspace}><p className="text-sm font-medium">{context.title}</p><p className="mt-1 text-xs text-muted-foreground">{articles.map((article) => article.title).join(" · ")}</p></li>)}</ul><p className="mt-4 text-xs text-muted-foreground">Support context may include tenant, user, role, workspace, route, and release. Customer PII is not attached automatically.</p><Link className="focus-ring mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary" href={`/organizations/${organizationId}/training`}>Browse all help</Link></AsideCard>;
}

function AsideCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="rounded-xl border bg-card shadow-soft"><header className="p-4 pb-3 sm:p-5 sm:pb-3"><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></header><div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div></section>; }
function Pill({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) { return <span className={primary ? "inline-flex rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground" : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"}>{children}</span>; }
function label(value: string) { return value.replaceAll("-", " ").replace(/^./, (character) => character.toUpperCase()); }
