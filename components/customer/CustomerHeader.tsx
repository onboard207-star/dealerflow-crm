"use client";

import { useId, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CalendarPlus,
  CarFront,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  RefreshCw,
  ShieldAlert,
  StickyNote,
  UserRound,
  WifiOff,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type {
  CustomerHeaderAction,
  CustomerHeaderData,
  CustomerHeaderProps,
  CustomerScore,
  CustomerTemperature,
} from "@/components/customer/CustomerHeader.types";
import { cn } from "@/lib/utils";

const temperatureStyles: Record<CustomerTemperature, string> = {
  hot: "bg-primary text-primary-foreground",
  warm: "bg-accent text-accent-foreground",
  cool: "bg-muted text-muted-foreground",
  unknown: "border border-border bg-muted text-muted-foreground",
};

const quickActions: ReadonlyArray<{
  action: CustomerHeaderAction;
  label: string;
  icon: typeof Phone;
}> = [
  { action: "call", label: "Call", icon: Phone },
  { action: "text", label: "Text", icon: MessageSquare },
  { action: "email", label: "Email", icon: Mail },
  { action: "appointment", label: "Appointment", icon: CalendarPlus },
  { action: "notes", label: "Notes", icon: StickyNote },
  { action: "more", label: "More", icon: MoreHorizontal },
];

export function CustomerHeader(props: CustomerHeaderProps) {
  const headingId = useId();
  const unavailableMessageId = useId();

  if (props.state === "loading") {
    return <CustomerHeaderLoading className={props.className} />;
  }

  if (props.state === "empty") {
    return (
      <StatePanel
        className={props.className}
        icon={<UserRound className="size-5" aria-hidden="true" />}
        title={props.title ?? "Customer details are not available"}
        description={
          props.description ??
          "Add customer information to establish identity and next steps."
        }
      />
    );
  }

  if (props.state === "error") {
    return (
      <StatePanel
        className={props.className}
        icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        title={props.title ?? "Customer details could not be loaded"}
        description={
          props.description ?? "Try again to restore the latest customer context."
        }
        action={
          props.onRetry ? (
            <Button variant="outline" onClick={props.onRetry}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
          ) : undefined
        }
        live="assertive"
      />
    );
  }

  if (props.state === "permission-restricted") {
    return (
      <StatePanel
        className={props.className}
        icon={<ShieldAlert className="size-5" aria-hidden="true" />}
        eyebrow={props.visibleIdentity?.status}
        title={props.visibleIdentity?.name ?? "Customer access restricted"}
        description={
          props.description ??
          "Your role does not include access to this customer workspace."
        }
      />
    );
  }

  const state = props.state ?? "ready";
  const isOffline = state === "offline";
  const isArchived = state === "archived";
  const customer = props.customer;
  const lastUpdatedLabel =
    props.state === "offline" ? props.lastUpdatedLabel : undefined;

  const isActionAvailable = (action: CustomerHeaderAction) => {
    if (!props.onAction) return false;
    if (props.state === "offline") return false;
    if (props.state === "archived") {
      return action === "more" && props.actionAvailability?.more !== false;
    }
    return props.actionAvailability?.[action] !== false;
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-soft",
        props.className,
      )}
      aria-labelledby={headingId}
    >
      {(isOffline || isArchived) && (
        <div
          className="flex items-start gap-2 border-b bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground sm:px-5"
          role="status"
        >
          {isOffline ? (
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Archive className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <p>
            <span className="font-medium text-foreground">
              {isOffline ? "Offline" : "Archived customer"}
            </span>
            {isOffline && lastUpdatedLabel
              ? ` · ${lastUpdatedLabel}`
              : isArchived
                ? " · Outreach and editing actions are unavailable."
                : " · Actions that require a connection are unavailable."}
          </p>
        </div>
      )}

      <div className="p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <Avatar className="size-11 ring-1 ring-border sm:size-12">
              <AvatarFallback className="text-sm">
                {customer.initials ?? getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  id={headingId}
                  className="min-w-0 text-xl font-semibold tracking-tight sm:text-2xl"
                >
                  {customer.name}
                </h1>
                <StatusBadge label={customer.status} />
                <TemperatureBadge temperature={customer.temperature} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Customer ID {customer.id}
              </p>
            </div>
          </div>

          <ScoreGroup customer={customer} />
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem
            icon={<UserRound className="size-4" aria-hidden="true" />}
            label="Assigned salesperson"
            value={customer.assignedSalesperson?.name ?? "Unassigned"}
            detail={customer.assignedSalesperson?.team}
          />
          <DetailItem
            icon={<CarFront className="size-4" aria-hidden="true" />}
            label="Primary vehicle"
            value={customer.primaryVehicle?.label ?? "Not selected"}
            detail={customer.primaryVehicle?.detail}
          />
          <DetailItem
            icon={<Phone className="size-4" aria-hidden="true" />}
            label="Phone"
            value={customer.phone ?? "Not provided"}
          />
          <DetailItem
            icon={<Mail className="size-4" aria-hidden="true" />}
            label="Email"
            value={customer.email ?? "Not provided"}
          />
          <DetailItem
            className="sm:col-span-2 lg:col-span-4"
            icon={<CalendarDays className="size-4" aria-hidden="true" />}
            label="Next appointment"
            value={
              customer.nextAppointment
                ? `${customer.nextAppointment.dateLabel} at ${customer.nextAppointment.timeLabel}`
                : "No upcoming appointment"
            }
            detail={
              customer.nextAppointment
                ? [customer.nextAppointment.type, customer.nextAppointment.status]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
          />
        </dl>
      </div>

      <div className="border-t bg-muted/20 px-4 py-3 sm:px-5 lg:px-6">
        <div
          className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
          aria-label="Customer quick actions"
        >
          {quickActions.map(({ action, label, icon: Icon }, index) => {
            const available = isActionAvailable(action);
            return (
              <Button
                key={action}
                variant={index === 0 && available ? "default" : "outline"}
                className="h-11 min-w-0 px-3"
                disabled={!available}
                aria-describedby={!available ? unavailableMessageId : undefined}
                onClick={() => props.onAction?.(action)}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Button>
            );
          })}
        </div>
        <p id={unavailableMessageId} className="sr-only">
          {isOffline
            ? "This action is unavailable while offline."
            : isArchived
              ? "This action is unavailable for an archived customer."
              : "This action is unavailable for this customer."}
        </p>
      </div>
    </section>
  );
}

function ScoreGroup({ customer }: { customer: CustomerHeaderData }) {
  const scores = [
    { label: "Buying", score: customer.buyingScore },
    { label: "Health", score: customer.healthScore },
    { label: "Lead", score: customer.leadScore },
  ].filter(
    (item): item is { label: string; score: CustomerScore } => Boolean(item.score),
  );

  if (scores.length === 0) return null;

  return (
    <dl className="grid grid-cols-3 gap-2" aria-label="Customer scores">
      {scores.map(({ label, score }) => (
        <div
          key={label}
          className="min-w-20 rounded-lg border bg-background px-3 py-2"
          title={score.explanation}
        >
          <dt className="text-[11px] font-medium text-muted-foreground">
            {label} score
          </dt>
          <dd className="mt-0.5 flex items-baseline gap-0.5">
            <span className="text-lg font-semibold tabular-nums">{score.value}</span>
            <span className="text-[11px] text-muted-foreground">/{score.max}</span>
          </dd>
          <span className="sr-only">
            {score.explanation}
            {score.updatedLabel ? ` ${score.updatedLabel}.` : ""}
          </span>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      {label}
    </span>
  );
}

function TemperatureBadge({ temperature }: { temperature: CustomerTemperature }) {
  const label = `${temperature.charAt(0).toUpperCase()}${temperature.slice(1)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        temperatureStyles[temperature],
      )}
      aria-label={`Customer temperature: ${label}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

function DetailItem({
  icon,
  label,
  value,
  detail,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </dd>
      {detail && (
        <dd className="mt-0.5 truncate text-xs text-muted-foreground" title={detail}>
          {detail}
        </dd>
      )}
    </div>
  );
}

function StatePanel({
  className,
  icon,
  eyebrow,
  title,
  description,
  action,
  live = "polite",
}: {
  className?: string;
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  live?: "polite" | "assertive";
}) {
  const titleId = useId();

  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-5 text-card-foreground shadow-soft sm:p-6",
        className,
      )}
      aria-live={live}
      aria-labelledby={titleId}
    >
      <div className="flex max-w-2xl items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>
          )}
          <h1 id={titleId} className="text-lg font-semibold">
            {title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </section>
  );
}

function CustomerHeaderLoading({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4 shadow-soft sm:p-5 lg:p-6",
        className,
      )}
      role="status"
      aria-label="Loading customer details"
    >
      <div className="animate-pulse motion-reduce:animate-none">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 max-w-full rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
          <div className="hidden grid-cols-3 gap-2 sm:grid">
            <div className="h-14 w-20 rounded-lg bg-muted" />
            <div className="h-14 w-20 rounded-lg bg-muted" />
            <div className="h-14 w-20 rounded-lg bg-muted" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-4 w-32 max-w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Customer details are loading.</span>
    </section>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
