import type { ApplicationEnvironment } from "@/lib/server/config";

export interface ReleaseInfo {
  environment: ApplicationEnvironment;
  commitSha: string | "unknown";
  deployedAt: string | "unknown";
}

export function resolveReleaseInfo(source: Readonly<Record<string, string | undefined>>): ReleaseInfo {
  const environment = readEnvironment(source.APP_ENV);
  const commit = source.DEALERFLOW_RELEASE_SHA?.trim() || source.RENDER_GIT_COMMIT?.trim();
  const deployedAt = source.DEALERFLOW_DEPLOYED_AT?.trim();
  return Object.freeze({
    environment,
    commitSha: commit && /^[a-f0-9]{7,40}$/i.test(commit) ? commit.toLowerCase() : "unknown",
    deployedAt: deployedAt && !Number.isNaN(Date.parse(deployedAt)) ? new Date(deployedAt).toISOString() : "unknown",
  });
}

function readEnvironment(value: string | undefined): ApplicationEnvironment {
  return value === "test" || value === "staging" || value === "production" ? value : "development";
}

