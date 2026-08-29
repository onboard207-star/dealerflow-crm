import { CalendarCheck, CalendarClock, CarFront, CircleDollarSign, ClipboardList, FileText, MessageSquare, Repeat2, Store, UserPlus } from "lucide-react";

import type { TimelineEntry, TimelineKind } from "@/lib/server/customers";

const icons = { lead: UserPlus, communication: MessageSquare, appointment: CalendarClock, visit: Store, task: ClipboardList, vehicle: CarFront, deal: CircleDollarSign, quote: FileText, trade: Repeat2, delivery: CalendarCheck } satisfies Record<TimelineKind, typeof UserPlus>;

export function CustomerTimeline({ entries }: { entries: readonly TimelineEntry[] }) {
  return (
    <section aria-labelledby="customer-timeline-heading" className="rounded-xl border bg-card p-4 shadow-soft sm:p-5 lg:p-6">
      <h2 id="customer-timeline-heading" className="text-lg font-semibold tracking-tight">Customer Timeline</h2>
      <p className="mt-1 text-sm text-muted-foreground">Chronological activity from authoritative DealerFlow records.</p>
      {entries.length ? <ol className="mt-5 space-y-1">
        {entries.map((entry) => { const Icon = icons[entry.kind]; return (
          <li key={`${entry.kind}-${entry.id}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-lg p-2.5 hover:bg-muted/40">
            <span className="grid size-9 place-items-center rounded-full border bg-background"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /></span>
            <div className="min-w-0"><div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2"><h3 className="break-words text-sm font-medium">{entry.title}</h3><time className="text-xs text-muted-foreground" dateTime={entry.occurredAt}>{formatDate(entry.occurredAt)}</time></div>
              {entry.description ? <p className="mt-1 break-words text-sm text-muted-foreground">{entry.description}</p> : null}
              {entry.status ? <p className="mt-1 text-xs capitalize text-muted-foreground">{entry.status.replace("-", " ")}</p> : null}</div>
          </li>); })}
      </ol> : <div className="mt-5 rounded-lg border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">No recorded activity is available for this customer yet.</div>}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
