export type ProviderWorkspaceKind = "social-media" | "website-analytics";

export interface ProviderWorkspaceScope {
  kind: ProviderWorkspaceKind;
  locationIds: readonly string[] | "all";
  organizationId: string;
  userId: string;
}

export type ProviderWorkspaceResult<T> =
  | { state: "loading" }
  | { state: "disconnected"; providerLabel: string }
  | { state: "setup-needed"; providerLabel: string; requirements: readonly string[] }
  | { state: "empty"; providerLabel: string; description: string }
  | { state: "error"; providerLabel: string; retryable: boolean; safeMessage: string }
  | { state: "ready"; providerLabel: string; data: T; observedAt: string };

export interface ProviderWorkspaceAdapter<T> {
  read(scope: ProviderWorkspaceScope): Promise<ProviderWorkspaceResult<T>>;
}

export function assertProviderWorkspaceScope(scope: ProviderWorkspaceScope): void {
  if (!/^org_[a-z0-9_-]{6,64}$/.test(scope.organizationId)) throw new Error("A valid organization scope is required.");
  if (!/^usr_[a-z0-9_-]{6,64}$/.test(scope.userId)) throw new Error("A valid user scope is required.");
  if (scope.locationIds !== "all" && (!scope.locationIds.length || scope.locationIds.some((id) => !/^loc_[a-z0-9_-]{6,64}$/.test(id)))) throw new Error("A valid location scope is required.");
}
