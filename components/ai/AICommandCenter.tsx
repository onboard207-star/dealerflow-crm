"use client";

import { useId, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Gauge,
  Lightbulb,
  Minus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AICommandAction,
  AICommandCenterProps,
  AICommandEmptyReason,
  AICommandRecommendation,
  AIConfidence,
  AIInsightItem,
  AIMomentum,
} from "@/components/ai/AICommandCenter.types";

type RecommendationMode = "ready" | "error" | "offline";

const emptyStateContent: Record<
  AICommandEmptyReason,
  { title: string; description: string }
> = {
  "insufficient-evidence": {
    title: "Not enough evidence yet",
    description:
      "DealerFlow needs more relevant activity before it can make a trustworthy recommendation.",
  },
  "no-relevant-recommendation": {
    title: "No recommendation right now",
    description:
      "There is no relevant next action for the current workflow at this time.",
  },
  "expired-awaiting-refresh": {
    title: "Recommendation is being refreshed",
    description:
      "The previous recommendation expired. A new recommendation will appear when current evidence is available.",
  },
  "workflow-completed": {
    title: "Workflow complete",
    description:
      "This workflow has no remaining AI-recommended action.",
  },
  "unsupported-workspace": {
    title: "Intelligence is not available here",
    description:
      "This workspace does not currently support AI recommendations.",
  },
};

export function AICommandCenter(props: AICommandCenterProps) {
  const titleId = useId();

  if (props.state === "loading") {
    return <AICommandCenterLoading className={props.className} />;
  }

  if (props.state === "empty") {
    const fallback = emptyStateContent[props.reason];

    return (
      <StatePanel
        className={props.className}
        description={props.description ?? fallback.description}
        icon={<Lightbulb aria-hidden="true" className="size-5" />}
        title={props.title ?? fallback.title}
        titleId={titleId}
      >
        {props.fallbackAction ? (
          <ActionButton
            action={props.fallbackAction}
            mode="ready"
            onAction={props.onAction}
            variant="outline"
          />
        ) : null}
      </StatePanel>
    );
  }

  if (props.state === "permission-restricted") {
    return (
      <StatePanel
        className={props.className}
        description={
          props.description ??
          "Your role does not include access to this recommendation. Contact an administrator if you need access."
        }
        icon={<ShieldAlert aria-hidden="true" className="size-5" />}
        title={props.title ?? "Intelligence access restricted"}
        titleId={titleId}
      />
    );
  }

  if (props.state === "error") {
    if (!props.lastRecommendation) {
      return (
        <StatePanel
          className={props.className}
          description={
            props.description ??
            "DealerFlow could not load a trustworthy recommendation. Try again when the connection is restored."
          }
          icon={<AlertTriangle aria-hidden="true" className="size-5" />}
          title={props.title ?? "Recommendation unavailable"}
          titleId={titleId}
        >
          {props.onRetry ? (
            <Button onClick={props.onRetry} type="button" variant="outline">
              <RefreshCw aria-hidden="true" className="size-4" />
              Try again
            </Button>
          ) : null}
        </StatePanel>
      );
    }

    return (
      <RecommendationSurface
        className={props.className}
        mode="error"
        onAction={props.onAction}
        onRetry={props.onRetry}
        recommendation={props.lastRecommendation}
        staleAreas={props.staleAreas}
        statusDescription={
          props.description ??
          "The last trustworthy recommendation is shown below. Verify stale details before acting."
        }
        statusTitle={props.title ?? "Recommendation could not be refreshed"}
        titleId={titleId}
      />
    );
  }

  if (props.state === "offline") {
    return (
      <RecommendationSurface
        className={props.className}
        mode="offline"
        onAction={props.onAction}
        recommendation={props.recommendation}
        statusDescription="Live evidence is unavailable. Confidence and outcome impact may be stale, and connected actions are disabled until the connection returns."
        statusTitle="You are offline"
        titleId={titleId}
      />
    );
  }

  return (
    <RecommendationSurface
      className={props.className}
      mode="ready"
      onAction={props.onAction}
      recommendation={props.recommendation}
      titleId={titleId}
    />
  );
}

interface RecommendationSurfaceProps {
  className?: string;
  mode: RecommendationMode;
  onAction?: (actionId: string) => void;
  onRetry?: () => void;
  recommendation: AICommandRecommendation;
  staleAreas?: string[];
  statusDescription?: string;
  statusTitle?: string;
  titleId: string;
}

function RecommendationSurface({
  className,
  mode,
  onAction,
  onRetry,
  recommendation,
  staleAreas,
  statusDescription,
  statusTitle,
  titleId,
}: RecommendationSurfaceProps) {
  const risks = recommendation.risks ?? [];
  const opportunities = recommendation.opportunities ?? [];
  const recommendedActions = recommendation.recommendedActions ?? [];
  const hasIndicators = Boolean(
    recommendation.urgency ||
      recommendation.buyingProbability ||
      recommendation.momentum,
  );

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-soft",
        className,
      )}
    >
      {mode !== "ready" ? (
        <StatusNotice
          description={statusDescription}
          mode={mode}
          onRetry={onRetry}
          staleAreas={staleAreas}
          title={statusTitle}
        />
      ) : null}

      <header className="flex items-start gap-3 border-b p-4 sm:p-5 lg:p-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {recommendation.aiLabel ?? "AI Command Center"}
            </p>
            {recommendation.freshness.stale ? (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Stale
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium">
            {recommendation.workspace.label}
          </p>
          {recommendation.workspace.contextLabel ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {recommendation.workspace.contextLabel}
            </p>
          ) : null}
        </div>
      </header>

      <div className="p-4 sm:p-5 lg:p-6">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next Best Action
          </p>
          <h2
            className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
            id={titleId}
          >
            {recommendation.nextBestAction}
          </h2>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="AI Confidence">
            <ConfidenceValue confidence={recommendation.confidence} />
          </MetricCard>

          {recommendation.outcomeImpact ? (
            <MetricCard label={recommendation.outcomeImpact.label}>
              <p className="font-semibold">
                {recommendation.outcomeImpact.statement}
              </p>
              {recommendation.outcomeImpact.qualification ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {recommendation.outcomeImpact.qualification}
                </p>
              ) : null}
            </MetricCard>
          ) : null}

          {recommendation.timeHorizon ? (
            <MetricCard label="Time Horizon">
              <p className="font-semibold">{recommendation.timeHorizon.label}</p>
              {recommendation.timeHorizon.deadlineLabel ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {recommendation.timeHorizon.expired ? "Expired: " : ""}
                  {recommendation.timeHorizon.deadlineLabel}
                </p>
              ) : null}
            </MetricCard>
          ) : null}

          <MetricCard label="Recommendation Freshness">
            <p className="font-semibold">{recommendation.freshness.label}</p>
            {recommendation.freshness.exactLabel ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {recommendation.freshness.exactLabel}
              </p>
            ) : null}
            {recommendation.freshness.sourceStatus ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {recommendation.freshness.sourceStatus}
              </p>
            ) : null}
          </MetricCard>
        </dl>

        <section aria-labelledby={`${titleId}-why`} className="mt-6">
          <h3 className="text-base font-semibold" id={`${titleId}-why`}>
            Why This Recommendation
          </h3>
          <ul className="mt-3 grid gap-2" role="list">
            {recommendation.evidence.map((item) => (
              <li
                className="flex gap-3 rounded-lg border bg-muted/40 p-3"
                key={item.id}
              >
                <Target
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div>
                  <p className="text-sm font-medium">{item.statement}</p>
                  {item.sourceLabel || item.timeLabel ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[item.sourceLabel, item.timeLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-5">
          <ActionButton
            action={recommendation.primaryAction}
            mode={mode}
            onAction={onAction}
          />
        </div>

        {hasIndicators ? (
          <section
            aria-labelledby={`${titleId}-indicators`}
            className="mt-8 border-t pt-6"
          >
            <h3 className="text-base font-semibold" id={`${titleId}-indicators`}>
              Supporting Indicators
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {recommendation.urgency ? (
                <IndicatorCard
                  icon={<Clock3 aria-hidden="true" className="size-4" />}
                  label="Urgency"
                  value={recommendation.urgency.label}
                >
                  {recommendation.urgency.reason}
                </IndicatorCard>
              ) : null}
              {recommendation.buyingProbability ? (
                <IndicatorCard
                  icon={<Gauge aria-hidden="true" className="size-4" />}
                  label="Buying Probability"
                  value={`${recommendation.buyingProbability.value}%`}
                >
                  {recommendation.buyingProbability.context}. {recommendation.buyingProbability.description}{" "}
                  {recommendation.buyingProbability.freshnessLabel}.
                </IndicatorCard>
              ) : null}
              {recommendation.momentum ? (
                <IndicatorCard
                  icon={<MomentumIcon momentum={recommendation.momentum} />}
                  label="Momentum"
                  value={recommendation.momentum.label}
                >
                  {recommendation.momentum.explanation} {recommendation.momentum.period}.
                </IndicatorCard>
              ) : null}
            </div>
          </section>
        ) : null}

        {risks.length > 0 || opportunities.length > 0 ? (
          <div className="mt-8 grid gap-6 border-t pt-6 lg:grid-cols-2">
            {risks.length > 0 ? (
              <InsightList
                id={`${titleId}-risks`}
                icon={<AlertTriangle aria-hidden="true" className="size-4" />}
                items={risks}
                title="Risks"
              />
            ) : null}
            {opportunities.length > 0 ? (
              <InsightList
                id={`${titleId}-opportunities`}
                icon={<Lightbulb aria-hidden="true" className="size-4" />}
                items={opportunities}
                title="Opportunities"
              />
            ) : null}
          </div>
        ) : null}

        {recommendedActions.length > 0 ? (
          <section
            aria-labelledby={`${titleId}-actions`}
            className="mt-8 border-t pt-6"
          >
            <h3 className="text-base font-semibold" id={`${titleId}-actions`}>
              Recommended Actions
            </h3>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {recommendedActions.map((action) => (
                <ActionButton
                  action={action}
                  key={action.id}
                  mode={mode}
                  onAction={onAction}
                  variant="outline"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

function ConfidenceValue({ confidence }: { confidence: AIConfidence }) {
  return (
    <>
      <p className="font-semibold">
        {confidence.kind === "numeric"
          ? `${confidence.value}%`
          : confidence.label}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {confidence.description}
      </p>
      {confidence.freshnessLabel ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {confidence.freshnessLabel}
        </p>
      ) : null}
    </>
  );
}

interface IndicatorCardProps {
  children: ReactNode;
  icon: ReactNode;
  label: string;
  value: string;
}

function IndicatorCard({ children, icon, label, value }: IndicatorCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function MomentumIcon({ momentum }: { momentum: AIMomentum }) {
  if (momentum.direction === "increasing") {
    return <TrendingUp aria-hidden="true" className="size-4" />;
  }

  if (momentum.direction === "declining") {
    return <TrendingDown aria-hidden="true" className="size-4" />;
  }

  return <Minus aria-hidden="true" className="size-4" />;
}

interface InsightListProps {
  id: string;
  icon: ReactNode;
  items: AIInsightItem[];
  title: string;
}

function InsightList({ icon, id, items, title }: InsightListProps) {
  return (
    <section aria-labelledby={id}>
      <h3
        className="flex items-center gap-2 text-base font-semibold"
        id={id}
      >
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      <ul className="mt-3 space-y-2" role="list">
        {items.map((item) => (
          <li className="rounded-lg border p-3" key={item.id}>
            <p className="text-sm font-medium">{item.title}</p>
            {item.evidence ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Evidence: {item.evidence}
              </p>
            ) : null}
            {item.mitigation ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Mitigation: {item.mitigation}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ActionButtonProps {
  action: AICommandAction;
  mode: RecommendationMode;
  onAction?: (actionId: string) => void;
  variant?: "default" | "outline";
}

function ActionButton({
  action,
  mode,
  onAction,
  variant = "default",
}: ActionButtonProps) {
  const unavailableOffline =
    mode === "offline" && action.requiresConnection !== false;
  const disabled = action.availability === "disabled" || unavailableOffline;
  const unavailableReason = unavailableOffline
    ? "Unavailable while offline"
    : action.unavailableReason ?? "Unavailable";

  return (
    <Button
      aria-label={disabled ? `${action.label}. ${unavailableReason}` : undefined}
      className="w-full sm:w-auto"
      disabled={disabled}
      onClick={() => onAction?.(action.id)}
      type="button"
      variant={variant}
    >
      {action.label}
      {variant === "default" ? (
        <ArrowRight aria-hidden="true" className="size-4" />
      ) : null}
    </Button>
  );
}

interface StatusNoticeProps {
  description?: string;
  mode: Exclude<RecommendationMode, "ready">;
  onRetry?: () => void;
  staleAreas?: string[];
  title?: string;
}

function StatusNotice({
  description,
  mode,
  onRetry,
  staleAreas,
  title,
}: StatusNoticeProps) {
  return (
    <div
      className="flex flex-col gap-3 border-b bg-muted/50 p-4 sm:flex-row sm:items-start sm:justify-between"
      role="status"
    >
      <div className="flex gap-3">
        {mode === "offline" ? (
          <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        ) : (
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        )}
        <div>
          <p className="font-semibold">{title}</p>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
          {staleAreas && staleAreas.length > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Stale areas: {staleAreas.join(", ")}.
            </p>
          ) : null}
        </div>
      </div>
      {mode === "error" && onRetry ? (
        <Button onClick={onRetry} type="button" variant="outline">
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

interface StatePanelProps {
  children?: ReactNode;
  className?: string;
  description: string;
  icon: ReactNode;
  title: string;
  titleId: string;
}

function StatePanel({
  children,
  className,
  description,
  icon,
  title,
  titleId,
}: StatePanelProps) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-xl border bg-card p-6 text-card-foreground shadow-soft sm:p-8",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight" id={titleId}>
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {description}
      </p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function AICommandCenterLoading({ className }: { className?: string }) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading AI recommendation"
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-soft",
        className,
      )}
    >
      <span className="sr-only">Loading AI recommendation</span>
      <div className="animate-pulse motion-reduce:animate-none">
        <div className="flex gap-3 border-b p-4 sm:p-5 lg:p-6">
          <div className="size-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-4 w-52 max-w-full rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-6 p-4 sm:p-5 lg:p-6">
          <div className="space-y-3">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-8 w-3/4 rounded bg-muted" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div className="h-28 rounded-lg bg-muted" key={item} />
            ))}
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div className="h-16 rounded-lg bg-muted" key={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
