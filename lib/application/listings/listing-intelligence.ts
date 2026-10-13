export type ListingChannel =
  | "Dealer Website"
  | "AutoTrader"
  | "Cars.com"
  | "Facebook Marketplace"
  | "OEM"
  | "Other";

export type ListingManagementMode = "Authorized Integration" | "Manual";
export type ListingStatus = "Active" | "Paused" | "Removed" | "Unknown";

export interface VehicleListing {
  id: string;
  inventoryUnitId: string;
  channel: ListingChannel;
  status: ListingStatus;
  managementMode: ListingManagementMode;
  responsibleSalesperson?: string;
  listingUrl?: string;
}

export interface ListingRemovalTask {
  idempotencyKey: string;
  inventoryUnitId: string;
  channel: ListingChannel;
  managementMode: ListingManagementMode;
  responsibleSalesperson?: string;
  title: string;
  priority: "high";
}

export interface ListingAvailabilityAlert {
  message: string;
  activeListingCount: number;
  channels: readonly ListingChannel[];
  integrationListings: readonly VehicleListing[];
  manualListings: readonly VehicleListing[];
  removalTasks: readonly ListingRemovalTask[];
}

/**
 * Plans the safe response when an inventory unit becomes unavailable.
 * This is deliberately side-effect free: integrations and task persistence
 * can consume the plan without allowing a catalog export to mutate listings.
 */
export function planListingRemovalAlert(
  inventoryUnitId: string,
  listings: readonly VehicleListing[],
): ListingAvailabilityAlert | null {
  const active = listings.filter(
    (listing) =>
      listing.inventoryUnitId === inventoryUnitId &&
      (listing.status === "Active" || listing.status === "Unknown"),
  );
  if (active.length === 0) return null;

  const channels = [...new Set(active.map((listing) => listing.channel))];
  const integrationListings = active.filter(
    (listing) => listing.managementMode === "Authorized Integration",
  );
  const manualListings = active.filter(
    (listing) => listing.managementMode === "Manual",
  );
  const removalTasks = manualListings.map((listing) => ({
    idempotencyKey: `listing-removal:${inventoryUnitId}:${listing.id}`,
    inventoryUnitId,
    channel: listing.channel,
    managementMode: listing.managementMode,
    ...(listing.responsibleSalesperson
      ? { responsibleSalesperson: listing.responsibleSalesperson }
      : {}),
    title: `Remove unavailable vehicle listing from ${listing.channel}`,
    priority: "high" as const,
  }));

  return {
    message: `This vehicle is no longer available. You have active listings on ${channels.length} channel${channels.length === 1 ? "" : "s"}. Would you like to review and remove them?`,
    activeListingCount: active.length,
    channels,
    integrationListings,
    manualListings,
    removalTasks,
  };
}
