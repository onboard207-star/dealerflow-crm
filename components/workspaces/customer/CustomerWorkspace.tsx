"use client";

import { useId } from "react";
import {
  CalendarClock,
  ClipboardList,
  MessageSquare,
  ReceiptText,
  Sparkles,
  Store,
  Wrench,
} from "lucide-react";

import { AICommandCenter } from "@/components/ai/AICommandCenter";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CustomerSnapshot } from "@/components/customer/CustomerSnapshot";
import { CustomerTimeline } from "@/components/customer/CustomerTimeline";
import type {
  CustomerWorkspaceProps,
  CustomerWorkspaceSidebarItem,
} from "@/components/workspaces/customer/CustomerWorkspace.types";
import { cn } from "@/lib/utils";

const defaultSidebarItems: CustomerWorkspaceSidebarItem[] = [
  {
    id: "tasks",
    label: "Tasks",
    description: "Open and upcoming customer tasks.",
    statusLabel: "Coming soon",
  },
  {
    id: "alerts",
    label: "Alerts",
    description: "Important changes that may require attention.",
    statusLabel: "Coming soon",
  },
  {
    id: "documents",
    label: "Documents",
    description: "Customer-facing and internal files.",
    statusLabel: "Coming soon",
  },
  {
    id: "quotes",
    label: "Quotes",
    description: "Saved and draft purchase proposals.",
    statusLabel: "Coming soon",
  },
  {
    id: "trade-appraisal",
    label: "Trade Appraisal",
    description: "Trade details and appraisal progress.",
    statusLabel: "Coming soon",
  },
];

const timelineCategories = [
  { label: "Communications", icon: MessageSquare },
  { label: "Appointments", icon: CalendarClock },
  { label: "Tasks", icon: ClipboardList },
  { label: "Showroom Visits", icon: Store },
  { label: "Deal Activity", icon: ReceiptText },
  { label: "AI Events", icon: Sparkles },
] as const;

export function CustomerWorkspace({
  aiCommandProps,
  aiControls,
  className,
  headerProps,
  onSidebarItemSelect,
  sidebarItems = defaultSidebarItems,
  snapshotProps,
  visitControls,
  vehicleControls,
  dealControls,
  deliveryControls,
  quoteControls,
  appointmentControls,
  communicationControls,
  tradeControls,
  taskControls,
  leadControls,
  profileControls,
  timelineDescription =
    "This workspace will display the complete chronological customer history, including calls, emails, texts, appointments, tasks, showroom visits, AI events, and deal activity.",
  timelineTitle = "Customer Timeline",
  timelineEntries,
}: CustomerWorkspaceProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-screen-2xl flex-col gap-5 sm:gap-6",
        className,
      )}
    >
      <header>
        <CustomerHeader {...headerProps} />
      </header>

      <AICommandCenter {...aiCommandProps} />

      {aiControls}

      {leadControls}

      {profileControls}

      {appointmentControls}

      {taskControls}

      {communicationControls}

      {visitControls}

      {vehicleControls}

      {dealControls}

      {quoteControls}

      {tradeControls}

      {deliveryControls}

      <WorkspaceMainRegion
        onSidebarItemSelect={onSidebarItemSelect}
        sidebarItems={sidebarItems}
        snapshotProps={snapshotProps}
      />

      {timelineEntries ? <CustomerTimeline entries={timelineEntries} /> : <TimelinePlaceholder
        description={timelineDescription}
        title={timelineTitle}
      />}
    </div>
  );
}

interface WorkspaceMainRegionProps {
  onSidebarItemSelect?: (itemId: string) => void;
  sidebarItems: CustomerWorkspaceSidebarItem[];
  snapshotProps: CustomerWorkspaceProps["snapshotProps"];
}

function WorkspaceMainRegion({
  onSidebarItemSelect,
  sidebarItems,
  snapshotProps,
}: WorkspaceMainRegionProps) {
  return (
    <section
      aria-label="Customer context and supporting tools"
      className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-12 xl:gap-6"
    >
      <div className="min-w-0 xl:col-span-8">
        <CustomerSnapshot {...snapshotProps} />
      </div>
      <WorkspaceSidebar
        className="min-w-0 xl:col-span-4"
        items={sidebarItems}
        onItemSelect={onSidebarItemSelect}
      />
    </section>
  );
}

interface WorkspaceSidebarProps {
  className?: string;
  items: CustomerWorkspaceSidebarItem[];
  onItemSelect?: (itemId: string) => void;
}

function WorkspaceSidebar({
  className,
  items,
  onItemSelect,
}: WorkspaceSidebarProps) {
  const headingId = useId();

  return (
    <aside
      aria-labelledby={headingId}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-soft",
        className,
      )}
    >
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight" id={headingId}>
          Workspace
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Supporting tools for the current customer journey.
        </p>
      </div>

      <ul className="divide-y" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <SidebarItem item={item} onItemSelect={onItemSelect} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SidebarItem({
  item,
  onItemSelect,
}: {
  item: CustomerWorkspaceSidebarItem;
  onItemSelect?: (itemId: string) => void;
}) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{item.label}</span>
        {item.description ? (
          <span className="mt-1 block text-sm text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {item.disabled ? "Unavailable" : (item.statusLabel ?? "Planned")}
      </span>
    </>
  );

  if (onItemSelect && !item.disabled) {
    return (
      <button
        className="focus-ring flex min-h-11 w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground sm:p-5"
        onClick={() => onItemSelect(item.id)}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      aria-disabled={item.disabled || undefined}
      className="flex min-h-11 items-start gap-3 p-4 sm:p-5"
    >
      {content}
    </div>
  );
}

interface TimelinePlaceholderProps {
  description: string;
  title: string;
}

function TimelinePlaceholder({
  description,
  title,
}: TimelinePlaceholderProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5 lg:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight" id={headingId}>
              {title}
            </h2>
            <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Coming next
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Wrench
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
      </div>

      <ul
        aria-label="Planned customer timeline categories"
        className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
      >
        {timelineCategories.map(({ icon: Icon, label }) => (
          <li
            className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground"
            key={label}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
