"use client";

import { useState } from "react";

export function VehicleListingControls({ organizationId, inventoryUnitId, listingId, channel, status, removalTaskStatus }: { organizationId: string; inventoryUnitId: string; listingId: string; channel: string; status: string; removalTaskStatus: string }) {
  const [state, setState] = useState({ status, removalTaskStatus });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function update(payload: Record<string, string>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/inventory/${inventoryUnitId}/listings/${listingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { listing?: { status: string; removalTaskStatus: string }; message?: string };
      if (!response.ok || !body.listing) throw new Error(body.message ?? "Listing could not be updated.");
      setState(body.listing);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Listing could not be updated."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    <span className="text-xs text-muted-foreground">Status: {state.status}</span>
    {state.status !== "Removed" ? <button type="button" disabled={busy} className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50" onClick={() => update({ status: "Removed", removalTaskStatus: "Completed" })}>Mark removed</button> : null}
    {state.status !== "Removed" && state.removalTaskStatus !== "Open" ? <button type="button" disabled={busy} className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50" onClick={() => update({ removalTaskStatus: "Open" })}>Open task</button> : null}
    {state.removalTaskStatus === "Open" ? <button type="button" disabled={busy} className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50" onClick={() => update({ removalTaskStatus: "Completed" })}>Complete task</button> : null}
    {error ? <span className="text-xs text-destructive" role="alert">{error}</span> : null}
    <span className="sr-only">{channel}</span>
  </div>;
}
