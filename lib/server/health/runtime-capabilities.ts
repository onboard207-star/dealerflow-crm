import { parseServerEnvironment } from "@/lib/server/config";

export type OptionalRuntimeStatus = "configured" | "not-configured";

export interface OptionalRuntimeCapabilities {
  ai: OptionalRuntimeStatus;
  media: OptionalRuntimeStatus;
  alerting: OptionalRuntimeStatus;
}

export function inspectOptionalRuntimeCapabilities(source: Readonly<Record<string, string | undefined>>): OptionalRuntimeCapabilities {
  const environment = safeEnvironment(source);
  return {
    ai: configured(() => parseServerEnvironment(source, { ai: true })),
    media: configured(() => parseServerEnvironment(source, { media: true })),
    alerting: environment?.alertWebhookUrl && environment.alertWebhookSecret ? "configured" : "not-configured",
  };
}

function configured(check: () => unknown): OptionalRuntimeStatus {
  try {
    check();
    return "configured";
  } catch {
    return "not-configured";
  }
}

function safeEnvironment(source: Readonly<Record<string, string | undefined>>) {
  try {
    return parseServerEnvironment(source);
  } catch {
    return undefined;
  }
}
