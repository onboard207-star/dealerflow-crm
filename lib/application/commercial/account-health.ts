export type AccountHealthStatus = "green" | "yellow" | "red";
export type AccountHealthSeverity = "critical" | "warning" | "information";
export type IntegrationHealth = "healthy" | "degraded" | "failed" | "unknown";

export interface AccountHealthSignal {
  readonly code: string;
  readonly label: string;
  readonly severity: AccountHealthSeverity;
  readonly evidence: string;
}

export interface AccountHealthInput {
  readonly unresolvedIncidents: Readonly<{ priority: "p0" | "p1" | "p2" | "p3"; reference: string }[]>;
  readonly criticalIntegrations: ReadonlyArray<{ name: string; health: IntegrationHealth }>;
  readonly billingStatus?: "current" | "past_due" | "suspended" | "unknown";
  readonly adoptionStatus?: "healthy" | "low" | "unknown";
  readonly sponsorEngagement?: "engaged" | "at_risk" | "unknown";
  readonly pilotProgress?: "on_track" | "at_risk" | "blocked" | "not_applicable" | "unknown";
}

export interface AccountHealthAssessment {
  readonly status: AccountHealthStatus;
  readonly reasons: readonly AccountHealthSignal[];
}

export function assessAccountHealth(input: AccountHealthInput): AccountHealthAssessment {
  const reasons: AccountHealthSignal[] = [];

  for (const incident of input.unresolvedIncidents) {
    if (incident.priority === "p0" || incident.priority === "p1") {
      reasons.push({ code: `incident.${incident.priority}`, label: `Unresolved ${incident.priority.toUpperCase()} incident`, severity: "critical", evidence: incident.reference });
    } else if (incident.priority === "p2") {
      reasons.push({ code: "incident.p2", label: "Unresolved P2 incident", severity: "warning", evidence: incident.reference });
    }
  }

  for (const integration of input.criticalIntegrations) {
    if (integration.health === "failed") reasons.push({ code: "integration.failed", label: `${integration.name} integration failed`, severity: "critical", evidence: "Current integration health check reports failure." });
    if (integration.health === "degraded") reasons.push({ code: "integration.degraded", label: `${integration.name} integration degraded`, severity: "warning", evidence: "Current integration health check reports degraded service." });
    if (integration.health === "unknown") reasons.push({ code: "integration.unknown", label: `${integration.name} integration health unknown`, severity: "warning", evidence: "No current integration health result is available." });
  }

  addOperationalSignal(reasons, "billing", input.billingStatus, "current", { past_due: "Billing is past due.", suspended: "Billing is suspended.", unknown: "Billing health is unknown." }, input.billingStatus === "suspended" ? "critical" : "warning");
  addOperationalSignal(reasons, "adoption", input.adoptionStatus, "healthy", { low: "Product adoption is below the configured healthy threshold.", unknown: "Adoption health is unknown." });
  addOperationalSignal(reasons, "sponsor", input.sponsorEngagement, "engaged", { at_risk: "Executive sponsor engagement is at risk.", unknown: "Sponsor engagement is unknown." });
  addOperationalSignal(reasons, "pilot", input.pilotProgress, ["on_track", "not_applicable"], { at_risk: "Pilot progress is at risk.", blocked: "Pilot progress is blocked.", unknown: "Pilot progress is unknown." }, input.pilotProgress === "blocked" ? "critical" : "warning");

  const requiredMissing = [input.billingStatus, input.adoptionStatus, input.sponsorEngagement, input.pilotProgress].some((value) => value === undefined);
  if (requiredMissing) reasons.push({ code: "assessment.incomplete", label: "Account health data is incomplete", severity: "warning", evidence: "One or more required operational signals were not provided." });

  const status: AccountHealthStatus = reasons.some((reason) => reason.severity === "critical") ? "red" : reasons.some((reason) => reason.severity === "warning") ? "yellow" : "green";
  return { status, reasons };
}

function addOperationalSignal<T extends string>(reasons: AccountHealthSignal[], code: string, value: T | undefined, healthy: T | readonly T[], evidence: Partial<Record<T, string>>, severity: AccountHealthSeverity = "warning") {
  if (value === undefined || (Array.isArray(healthy) ? healthy.includes(value) : value === healthy)) return;
  const explanation = evidence[value];
  if (explanation) reasons.push({ code: `${code}.${value}`, label: explanation, severity, evidence: explanation });
}
