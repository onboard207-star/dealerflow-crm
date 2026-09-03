import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  QuoteApprovalPolicyConflictError,
  QuoteApprovalPolicyService,
  QuoteApprovalPolicyValidationError,
} from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import { PostgresQuoteApprovalPolicyProvider } from "@/lib/server/deals";
import { loadDirectoryContext } from "../../../_lib/load-directory-context";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}

export default async function QuoteApprovalSettingsPage({
  params,
  searchParams,
}: Props) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "organization.configure");
  const service = new QuoteApprovalPolicyService(
    new PostgresQuoteApprovalPolicyProvider(context.pool, {
      userId: context.session.user.id,
      organizationId,
    }),
  );
  const current = await service.read(context.actor, { organizationId });
  const feedback = await searchParams;

  return (
    <AppShell
      organizationId={organizationId}
      navigationCapabilities={context.membership.capabilities}
      activeHref={`/organizations/${organizationId}/settings/configuration`}
      breadcrumbs={[
        { label: context.organization.name },
        { label: "Configuration" },
        { label: "Quote approvals" },
      ]}
      user={{
        name: context.session.user.name,
        email: context.session.user.email,
        ...(context.session.user.image ? { image: context.session.user.image } : {}),
      }}
    >
      <section aria-labelledby="quote-approval-settings-heading" className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Desking governance
            </p>
            <h1
              className="mt-2 text-2xl font-semibold tracking-tight"
              id="quote-approval-settings-heading"
            >
              Quote approval rules
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure when a draft Quote must receive an independent manager decision before it
              can be presented. These rules do not calculate credit, lender, payment, reserve, or
              gross-profit thresholds.
            </p>
          </div>
          <Link
            className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            href={`/organizations/${organizationId}/settings/configuration`}
          >
            Back to configuration
          </Link>
        </div>

        {feedback.notice ? (
          <p className="mt-4 rounded-lg border bg-muted p-3 text-sm" role="status">
            {feedback.notice}
          </p>
        ) : null}
        {feedback.error ? (
          <p
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            {feedback.error}
          </p>
        ) : null}

        <form action={saveQuoteApprovalPolicy.bind(null, organizationId)} className="mt-6 space-y-6">
          {current ? <input name="expectedVersion" type="hidden" value={current.version} /> : null}

          <fieldset className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
            <legend className="px-1 text-base font-semibold">Approval enforcement</legend>
            <div className="mt-2 space-y-3">
              <label className="flex items-start gap-3 rounded-lg border p-3">
                <input
                  className="mt-1"
                  defaultChecked={current?.enabled ?? true}
                  name="enabled"
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-medium">Enable Quote approval policy</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    When disabled, no Quote is automatically forced into manager approval by this
                    policy.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-3">
                <input
                  className="mt-1"
                  defaultChecked={current?.alwaysRequireApproval ?? false}
                  name="alwaysRequireApproval"
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Require manager approval for every Quote
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    This takes precedence over the discount threshold below.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
            <legend className="px-1 text-base font-semibold">Discount threshold</legend>
            <label className="mt-2 block">
              <span className="text-sm font-medium">Require approval at discount of</span>
              <div className="mt-1 flex max-w-sm items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground">$</span>
                <input
                  className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                  defaultValue={
                    current?.discountThresholdCents !== undefined
                      ? centsToInput(current.discountThresholdCents)
                      : ""
                  }
                  inputMode="decimal"
                  name="discountThresholdDollars"
                  placeholder="1000.00"
                />
              </div>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                Leave blank for no discount-based trigger. DealerFlow stores this value in cents
                and compares it against the immutable Quote discount.
              </span>
            </label>
          </fieldset>

          <div className="rounded-xl border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">Current scope</p>
            <p className="mt-1">
              Organization-wide default for {context.organization.name}. Location-specific
              overrides remain supported by the data model and can be added as a separate
              dealership-level control without changing this rule.
            </p>
            <p className="mt-2">
              {current
                ? `Saved policy version ${current.version}.`
                : "No Quote approval policy has been saved yet."}
            </p>
          </div>

          <button className="focus-ring min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Save Quote approval rules
          </button>
        </form>
      </section>
    </AppShell>
  );
}

async function saveQuoteApprovalPolicy(organizationId: string, formData: FormData) {
  "use server";
  const base = `/organizations/${organizationId}/settings/configuration/quote-approvals`;
  try {
    const context = await loadDirectoryContext(organizationId, "organization.configure");
    const threshold = parseMoney(String(formData.get("discountThresholdDollars") ?? ""));
    const expectedVersionRaw = String(formData.get("expectedVersion") ?? "").trim();
    const service = new QuoteApprovalPolicyService(
      new PostgresQuoteApprovalPolicyProvider(context.pool, {
        userId: context.session.user.id,
        organizationId,
      }),
    );

    await service.save({
      actor: context.actor,
      organizationId,
      correlationId: `quote-approval-policy:${organizationId}`,
      enabled: formData.get("enabled") === "on",
      alwaysRequireApproval: formData.get("alwaysRequireApproval") === "on",
      ...(threshold !== undefined ? { discountThresholdCents: threshold } : {}),
      ...(expectedVersionRaw ? { expectedVersion: Number(expectedVersionRaw) } : {}),
    });
    revalidatePath(base);
    revalidatePath(`/organizations/${organizationId}/desking`);
  } catch (error) {
    const message =
      error instanceof QuoteApprovalPolicyConflictError
        ? "The approval rules changed in another session. Reload this page before saving again."
        : error instanceof QuoteApprovalPolicyValidationError ||
            error instanceof AuthorizationError ||
            error instanceof Error
          ? error.message
          : "Quote approval rules were not saved.";
    redirect(`${base}?error=${encodeURIComponent(message)}`);
  }
  redirect(`${base}?notice=${encodeURIComponent("Quote approval rules saved.")}`);
}

function parseMoney(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Discount threshold must be a nonnegative dollar amount with at most two decimals.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Discount threshold must be greater than zero.");
  }
  return cents;
}

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}
