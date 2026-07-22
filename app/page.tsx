import { AppShell } from "@/components/app-shell";

export default function FoundationPreview() {
  return (
    <AppShell>
      <section className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-5xl items-center justify-center rounded-2xl border border-dashed bg-card/40 p-8 text-center shadow-soft">
        <div className="max-w-md"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">DealerFlow OS</p><h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">The workspace foundation is ready.</h1><p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground sm:text-base">Reusable layout architecture is in place. Product workspaces can be composed here without coupling them to the application shell.</p></div>
      </section>
    </AppShell>
  );
}
