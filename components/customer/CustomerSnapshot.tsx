"use client";

import { useId, type ReactNode } from "react";
import {
  AlertTriangle,
  CarFront,
  ClipboardList,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  StickyNote,
  UserRound,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CustomerSnapshotData,
  CustomerSnapshotProps,
  SnapshotFact,
  SnapshotFactKind,
  SnapshotImportantNote,
  SnapshotIntelligenceItem,
} from "@/components/customer/CustomerSnapshot.types";
import { cn } from "@/lib/utils";

type SnapshotMode = "ready" | "error" | "offline";

const factKindLabels: Record<SnapshotFactKind, string> = {
  confirmed: "Confirmed",
  "customer-stated": "Customer-stated",
  estimated: "Estimate",
  derived: "Evidence-based insight",
};

export function CustomerSnapshot(props: CustomerSnapshotProps) {
  const headingId = useId();

  if (props.state === "loading") {
    return <CustomerSnapshotLoading className={props.className} />;
  }

  if (props.state === "empty") {
    return (
      <StatePanel
        className={props.className}
        description={
          props.description ??
          "No additional engagement context has been recorded for this customer."
        }
        headingId={headingId}
        icon={<ClipboardList aria-hidden="true" className="size-5" />}
        title={props.title ?? "No customer snapshot yet"}
      />
    );
  }

  if (props.state === "permission-restricted") {
    return (
      <StatePanel
        className={props.className}
        description={
          props.description ??
          "Your role does not include access to this customer context."
        }
        headingId={headingId}
        icon={<ShieldAlert aria-hidden="true" className="size-5" />}
        title={props.title ?? "Customer snapshot access restricted"}
      />
    );
  }

  if (props.state === "error") {
    if (!props.lastSnapshot) {
      return (
        <StatePanel
          action={
            props.onRetry ? (
              <Button
                className="h-11"
                onClick={props.onRetry}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Try again
              </Button>
            ) : undefined
          }
          className={props.className}
          description={
            props.description ??
            "Customer context could not be loaded. Try again to restore the latest snapshot."
          }
          headingId={headingId}
          icon={<AlertTriangle aria-hidden="true" className="size-5" />}
          live="assertive"
          title={props.title ?? "Customer snapshot unavailable"}
        />
      );
    }

    return (
      <SnapshotSurface
        affectedSections={props.unavailableSections}
        className={props.className}
        data={props.lastSnapshot}
        headingId={headingId}
        mode="error"
        onRetry={props.onRetry}
        statusDescription={
          props.description ??
          "The last trustworthy context is shown. Verify unavailable sections before relying on them."
        }
        statusTitle={props.title ?? "Some snapshot details could not be loaded"}
      />
    );
  }

  if (props.state === "offline") {
    return (
      <SnapshotSurface
        affectedSections={props.staleSections}
        className={props.className}
        data={props.snapshot}
        headingId={headingId}
        mode="offline"
        statusDescription={`${props.lastUpdatedLabel}. Live consent, vehicle, finance, and intelligence details may have changed.`}
        statusTitle="Offline snapshot"
      />
    );
  }

  return (
    <SnapshotSurface
      className={props.className}
      data={props.snapshot}
      headingId={headingId}
      mode="ready"
    />
  );
}

interface SnapshotSurfaceProps {
  affectedSections?: string[];
  className?: string;
  data: CustomerSnapshotData;
  headingId: string;
  mode: SnapshotMode;
  onRetry?: () => void;
  statusDescription?: string;
  statusTitle?: string;
}

function SnapshotSurface({
  affectedSections,
  className,
  data,
  headingId,
  mode,
  onRetry,
  statusDescription,
  statusTitle,
}: SnapshotSurfaceProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-soft",
        className,
      )}
    >
      {mode !== "ready" ? (
        <StatusNotice
          affectedSections={affectedSections}
          description={statusDescription}
          mode={mode}
          onRetry={onRetry}
          title={statusTitle}
        />
      ) : null}

      <header className="border-b p-4 sm:p-5 lg:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ClipboardList aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight" id={headingId}>
              Customer Snapshot
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              High-value context to review before engaging this customer.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <FactSection
          facts={data.identity}
          icon={<UserRound aria-hidden="true" className="size-4" />}
          id={`${headingId}-identity`}
          title="Identity"
        />
        <FactSection
          facts={data.vehicleInterest}
          icon={<CarFront aria-hidden="true" className="size-4" />}
          id={`${headingId}-vehicle-interest`}
          title="Vehicle Interest"
        />
        <FactSection
          facts={data.buyingJourney}
          icon={<ClipboardList aria-hidden="true" className="size-4" />}
          id={`${headingId}-buying-journey`}
          title="Buying Journey"
        />
        <FactSection
          facts={data.communication}
          icon={<MessageSquare aria-hidden="true" className="size-4" />}
          id={`${headingId}-communication`}
          title="Communication"
        />
        <IntelligenceSection
          id={`${headingId}-customer-intelligence`}
          items={data.customerIntelligence}
        />
        <NotesSection
          id={`${headingId}-important-notes`}
          notes={data.importantNotes}
        />
      </div>
    </section>
  );
}

interface FactSectionProps {
  facts?: SnapshotFact[];
  icon: ReactNode;
  id: string;
  title: string;
}

function FactSection({ facts, icon, id, title }: FactSectionProps) {
  if (!facts || facts.length === 0) return null;

  return (
    <section
      aria-labelledby={id}
      className="border-b p-4 last:border-b-0 sm:p-5 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0 lg:p-6"
    >
      <SectionHeading icon={icon} id={id} title={title} />
      <dl className="mt-4 space-y-4">
        {facts.map((fact) => (
          <FactRow fact={fact} key={fact.id} />
        ))}
      </dl>
    </section>
  );
}

function FactRow({ fact }: { fact: SnapshotFact }) {
  const metadata = [
    fact.kind ? factKindLabels[fact.kind] : undefined,
    fact.sourceLabel,
    fact.freshnessLabel,
  ].filter((item): item is string => Boolean(item));

  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {fact.label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
      {fact.detail ? (
        <dd className="mt-1 text-sm text-muted-foreground">{fact.detail}</dd>
      ) : null}
      {metadata.length > 0 ? (
        <dd className="mt-1 text-xs text-muted-foreground">
          {metadata.join(" · ")}
        </dd>
      ) : null}
    </div>
  );
}

function IntelligenceSection({
  id,
  items,
}: {
  id: string;
  items?: SnapshotIntelligenceItem[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <section
      aria-labelledby={id}
      className="border-b p-4 last:border-b-0 sm:p-5 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0 lg:p-6"
    >
      <SectionHeading
        icon={<Lightbulb aria-hidden="true" className="size-4" />}
        id={id}
        title="Customer Intelligence"
      />
      <dl className="mt-4 space-y-5">
        {items.map((item) => (
          <div key={item.id}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm font-medium">{item.value}</dd>
            <dd className="mt-1 text-sm text-muted-foreground">
              {item.explanation}
            </dd>
            <dd className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Evidence:</span>{" "}
              {item.evidence}
              {item.evaluationPeriod ? ` · ${item.evaluationPeriod}` : ""}
              {item.freshnessLabel ? ` · ${item.freshnessLabel}` : ""}
              {item.uncertainty ? ` · Uncertainty: ${item.uncertainty}` : ""}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function NotesSection({
  id,
  notes,
}: {
  id: string;
  notes?: SnapshotImportantNote[];
}) {
  if (!notes || notes.length === 0) return null;

  return (
    <section
      aria-labelledby={id}
      className="border-b p-4 last:border-b-0 sm:p-5 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0 lg:p-6"
    >
      <SectionHeading
        icon={<StickyNote aria-hidden="true" className="size-4" />}
        id={id}
        title="Important Notes"
      />
      <ul className="mt-4 space-y-3" role="list">
        {notes.map((note) => (
          <li className="rounded-lg border bg-muted/30 p-3" key={note.id}>
            <p className="text-sm font-medium">{note.text}</p>
            {note.sourceLabel || note.verifiedLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {[note.sourceLabel, note.verifiedLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({
  icon,
  id,
  title,
}: {
  icon: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold" id={id}>
      <span className="text-muted-foreground">{icon}</span>
      {title}
    </h3>
  );
}

interface StatusNoticeProps {
  affectedSections?: string[];
  description?: string;
  mode: Exclude<SnapshotMode, "ready">;
  onRetry?: () => void;
  title?: string;
}

function StatusNotice({
  affectedSections,
  description,
  mode,
  onRetry,
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
          {affectedSections && affectedSections.length > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "offline" ? "May be stale" : "Unavailable"}: {affectedSections.join(", ")}.
            </p>
          ) : null}
        </div>
      </div>
      {mode === "error" && onRetry ? (
        <Button
          className="h-11 shrink-0"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

interface StatePanelProps {
  action?: ReactNode;
  className?: string;
  description: string;
  headingId: string;
  icon: ReactNode;
  live?: "assertive" | "polite";
  title: string;
}

function StatePanel({
  action,
  className,
  description,
  headingId,
  icon,
  live,
  title,
}: StatePanelProps) {
  return (
    <section
      aria-labelledby={headingId}
      aria-live={live}
      className={cn(
        "rounded-xl border bg-card p-6 text-card-foreground shadow-soft sm:p-8",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight" id={headingId}>
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

function CustomerSnapshotLoading({ className }: { className?: string }) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading customer snapshot"
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-soft",
        className,
      )}
    >
      <span className="sr-only">Loading customer snapshot</span>
      <div className="animate-pulse motion-reduce:animate-none">
        <div className="flex gap-3 border-b p-4 sm:p-5 lg:p-6">
          <div className="size-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-3 w-72 max-w-full rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="space-y-4 border-b p-4 sm:p-5 lg:p-6" key={item}>
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-4 w-4/5 rounded bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
