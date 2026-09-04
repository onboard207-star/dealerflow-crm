import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { AIRecommendationControls } from "@/components/ai/AIRecommendationControls";
import type { AICommandCenterProps } from "@/components/ai/AICommandCenter.types";
import { CustomerWorkspace } from "@/components/workspaces/customer/CustomerWorkspace";
import { ShowroomVisitControls } from "@/components/customer/ShowroomVisitControls";
import { VehicleInterestControls } from "@/components/customer/VehicleInterestControls";
import { DealCreationControls } from "@/components/customer/DealCreationControls";
import { DeliveryHandoffControls } from "@/components/customer/DeliveryHandoffControls";
import { QuoteControls } from "@/components/customer/QuoteControls";
import { AppointmentControls } from "@/components/customer/AppointmentControls";
import { CommunicationControls } from "@/components/customer/CommunicationControls";
import { TradeWorkflowControls } from "@/components/customer/TradeWorkflowControls";
import { TaskControls } from "@/components/customer/TaskControls";
import { LeadLifecycleControls } from "@/components/customer/LeadLifecycleControls";
import { CustomerProfileControls } from "@/components/customer/CustomerProfileControls";
import { assertAuthorized, type Capability } from "@/lib/platform/auth";
import { getAuth, PostgresMembershipReader, resolveAuthorizationActor } from "@/lib/server/auth";
import { CustomerRecommendationReader } from "@/lib/server/ai";
import { CustomerWorkspaceReader } from "@/lib/server/customers";
import { getDatabasePool } from "@/lib/server/database";
import { OrganizationDirectory } from "@/lib/server/organizations";
import { InventoryDirectoryReader } from "@/lib/server/vehicles";
import { CommunicationWorkspaceReader } from "@/lib/server/communications";

export const dynamic = "force-dynamic";
interface PageProps { params: Promise<{ organizationId: string; customerId: string }> }

export default async function CustomerPage({ params }: PageProps) {
  const { organizationId, customerId } = await params;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const pool = getDatabasePool();
  const actor = await resolveAuthorizationActor(session.user.id, organizationId, new PostgresMembershipReader(pool));
  const membership = actor.memberships[0]!;
  assertAuthorized(actor, { capability: "customer.read", organizationId });
  assertAuthorized(actor, { capability: "lead.read", organizationId });
  const has = (capability: Capability) => membership.capabilities.includes(capability);
  const record = await new CustomerWorkspaceReader(pool).read(session.user.id, organizationId, customerId, {
    locationIds: membership.locationIds, communications: has("communication.read"),
    appointments: has("appointment.read"), tasks: has("task.read"),
    inventory: has("inventory.read"),
    deals: has("deal.read"),
  });
  if (!record) notFound();
  assertAuthorized(actor, { capability: "customer.read", organizationId, locationId: record.customer.locationId });
  const organization = (await new OrganizationDirectory(pool).listForUser(session.user.id)).find((item) => item.id === organizationId);
  if (!organization) notFound();
  const canUpdateVehicleInterest = has("inventory.read") && has("lead.update");
  const inventory = canUpdateVehicleInterest && record.lead && ["open", "working", "qualified"].includes(record.lead.status)
    ? await new InventoryDirectoryReader(pool).list({ userId: session.user.id, organizationId, locationIds: membership.locationIds }, { status: "available", limit: 100 })
    : { records: [] };
  const interestedVehicleIds = new Set(record.vehicleInterests.map((item) => item.vehicleId));
  const vehicleOptions = inventory.records.filter((item) => !interestedVehicleIds.has(item.vehicleId)).map((item) => ({
    vehicleId: item.vehicleId, locationId: item.locationId,
    label: `${item.year} ${item.make} ${item.model}${item.trim ? ` ${item.trim}` : ""}`,
    detail: [`Stock ${item.stockNumber}`, item.exteriorColor, item.listPriceCents !== undefined ? formatPrice(item.listPriceCents) : undefined].filter(Boolean).join(" · "),
  }));
  const communicationContext = record.customer.locationId && record.customer.phone && (has("communication.read") || has("communication.consent.manage"))
    ? await new CommunicationWorkspaceReader(pool).read({ userId: session.user.id, organizationId, locationId: record.customer.locationId, customerId, phone: record.customer.phone })
    : {};
  const recommendationRun = await new CustomerRecommendationReader(pool).latest(
    session.user.id,
    organizationId,
    customerId,
  );
  const appointmentDate = record.nextAppointment ? new Date(record.nextAppointment.startsAt) : undefined;
  const identity = [
    ...(record.lead ? [{ id: "lead-source", label: "Lead Source", value: record.lead.source, kind: "confirmed" as const }] : []),
    ...(record.lead?.assignedUserName ? [{ id: "owner", label: "Assigned Salesperson", value: record.lead.assignedUserName, kind: "confirmed" as const }] : []),
  ];
  const buyingJourney = [
    ...(record.lead ? [{ id: "stage", label: "Current Stage", value: record.lead.stage, detail: `Lead status: ${record.lead.status}`, kind: "confirmed" as const }] : []),
    ...(record.nextAppointment ? [{ id: "appointment", label: "Appointment Status", value: record.nextAppointment.status, detail: formatDateTime(record.nextAppointment.startsAt), kind: "confirmed" as const }] : []),
  ];
  const communication = [
    ...(record.customer.email ? [{ id: "email", label: "Email", value: record.customer.email, kind: "confirmed" as const }] : []),
    ...(record.customer.phone ? [{ id: "phone", label: "Phone", value: record.customer.phone, kind: "confirmed" as const }] : []),
  ];
  const vehicleInterest = record.vehicleInterests.map((item) => ({ id: item.id,
    label: item.role === "primary" ? "Primary Vehicle" : item.role === "trade" ? "Trade Vehicle" : "Alternative Vehicle",
    value: `${item.year} ${item.make} ${item.model}${item.trim ? ` ${item.trim}` : ""}`,
    detail: [item.exteriorColor, item.stockNumber ? `Stock ${item.stockNumber}` : undefined,
      item.inventoryStatus ? `Inventory: ${item.inventoryStatus}` : undefined].filter(Boolean).join(" · "), kind: "confirmed" as const }));
  const primaryVehicle = record.vehicleInterests.find((item) => item.role === "primary");
  const tradeVehicle = record.vehicleInterests.find((item) => item.role === "trade");
  const dealVehicles = record.vehicleInterests.flatMap((item) => item.role === "primary" && item.inventoryId && item.inventoryLocationId && ["available", "hold"].includes(item.inventoryStatus ?? "") ? [{
    vehicleId: item.vehicleId, inventoryUnitId: item.inventoryId, locationId: item.inventoryLocationId,
    label: `${item.year} ${item.make} ${item.model}${item.trim ? ` ${item.trim}` : ""}`,
    detail: [item.stockNumber ? `Stock ${item.stockNumber}` : undefined, item.inventoryStatus].filter(Boolean).join(" · "),
  }] : []);
  if (record.deal) buyingJourney.push({ id: "deal", label: "Deal", value: record.deal.status,
    detail: [record.deal.dealNumber, record.deal.purchaseType, record.deal.agreedPriceCents !== undefined ? formatPrice(record.deal.agreedPriceCents) : undefined].filter(Boolean).join(" · "), kind: "confirmed" });
  if (record.quote) buyingJourney.push({ id: "quote", label: "Quote", value: record.quote.status,
    detail: [`Version ${record.quote.version}`, record.quote.purchaseType, formatPrice(record.quote.totalCents)].join(" · "), kind: "confirmed" });
  if (record.tradeAppraisal) buyingJourney.push({ id: "trade-appraisal", label: "Trade Appraisal", value: record.tradeAppraisal.status,
    detail: `${record.tradeAppraisal.vehicleLabel} · ${formatPrice(record.tradeAppraisal.allowanceCents)} allowance · ${formatPrice(record.tradeAppraisal.equityCents)} equity`, kind: "confirmed" });
  if (record.delivery) buyingJourney.push({ id: "delivery", label: "Delivery", value: record.delivery.status,
    detail: formatDateTime(record.delivery.startsAt), kind: "confirmed" });

  return <AppShell organizationId={organizationId} navigationCapabilities={membership.capabilities} activeHref={`/organizations/${organizationId}/customers`}
    breadcrumbs={[{ label: organization.name, href: `/organizations/${organizationId}/workspace` }, { label: record.customer.displayName }]}
    user={{ name: session.user.name, email: session.user.email, ...(session.user.image ? { image: session.user.image } : {}) }}>
    <CustomerWorkspace
      headerProps={{ state: record.customer.status === "archived" ? "archived" : "ready", customer: {
        id: record.customer.id, name: record.customer.displayName, status: record.customer.status,
        temperature: "unknown", ...(record.customer.email ? { email: record.customer.email } : {}),
        ...(record.customer.phone ? { phone: record.customer.phone } : {}),
        ...(record.lead?.assignedUserName ? { assignedSalesperson: { name: record.lead.assignedUserName } } : {}),
        ...(primaryVehicle ? { primaryVehicle: { label: `${primaryVehicle.year} ${primaryVehicle.make} ${primaryVehicle.model}${primaryVehicle.trim ? ` ${primaryVehicle.trim}` : ""}`,
          detail: [primaryVehicle.exteriorColor, primaryVehicle.stockNumber ? `Stock ${primaryVehicle.stockNumber}` : undefined].filter(Boolean).join(" · ") } } : {}),
        ...(record.nextAppointment && appointmentDate ? { nextAppointment: {
          dateLabel: new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: record.nextAppointment.timezone }).format(appointmentDate),
          timeLabel: new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: record.nextAppointment.timezone }).format(appointmentDate),
          type: record.nextAppointment.type, status: record.nextAppointment.status } } : {}),
      }}}
      aiCommandProps={toAICommandProps(recommendationRun)}
      aiControls={<AIRecommendationControls
        canReview={has("customer.update")}
        customerId={customerId}
        organizationId={organizationId}
        reviewed={Boolean(recommendationRun?.reviewDecision)}
        {...(recommendationRun?.status === "completed" ? { runId: recommendationRun.id } : {})}
      />}
      leadControls={record.lead ? <LeadLifecycleControls canUpdate={has("lead.update")} lead={{ id:record.lead.id,status:record.lead.status,stage:record.lead.stage }} organizationId={organizationId}/> : undefined}
      profileControls={<CustomerProfileControls canUpdate={has("customer.update")} customer={record.customer} organizationId={organizationId}/>}
      appointmentControls={<AppointmentControls
        canCreate={has("appointment.create") && has("appointment.read") && has("task.create") && has("task.read")}
        canUpdate={has("appointment.update") && has("appointment.read")}
        customerId={customerId}
        organizationId={organizationId}
        {...(record.nextAppointment?.assignedUserId ?? record.lead?.assignedUserId ? { assignedUserId: record.nextAppointment?.assignedUserId ?? record.lead?.assignedUserId } : {})}
        {...(record.lead && ["open", "working", "qualified"].includes(record.lead.status) ? { leadId: record.lead.id } : {})}
        {...(record.customer.locationId ? { locationId: record.customer.locationId } : {})}
        {...(record.nextAppointment ? { nextAppointment: record.nextAppointment } : {})}
      />}
      taskControls={<TaskControls
        canCreate={has("task.create") && has("task.read")}
        canUpdate={has("task.update") && has("task.read")}
        customerId={customerId}
        organizationId={organizationId}
        tasks={record.activeTasks}
        {...(record.customer.locationId ? { locationId: record.customer.locationId } : {})}
        {...(record.lead && ["open", "working", "qualified"].includes(record.lead.status) ? { leadId: record.lead.id } : {})}
      />}
      communicationControls={<CommunicationControls
        canRecord={has("communication.create") && has("communication.read")}
        canManageConsent={has("communication.consent.manage")}
        canSend={has("communication.send") && has("communication.read")}
        customerId={customerId}
        organizationId={organizationId}
        {...(record.customer.locationId ? { locationId: record.customer.locationId } : {})}
        {...(record.customer.phone ? { phone: record.customer.phone } : {})}
        {...(record.lead ? { leadId: record.lead.id } : {})}
        {...(communicationContext.integrationId ? { integrationId: communicationContext.integrationId } : {})}
        {...(communicationContext.consent ? { consent: communicationContext.consent } : {})}
      />}
      visitControls={<ShowroomVisitControls
        canCreate={has("appointment.create")}
        canUpdate={has("appointment.update")}
        customerId={customerId}
        organizationId={organizationId}
        {...(record.nextAppointment?.assignedUserId ?? record.lead?.assignedUserId ? { assignedUserId: record.nextAppointment?.assignedUserId ?? record.lead?.assignedUserId } : {})}
        {...(record.nextAppointment ? { appointmentId: record.nextAppointment.id } : {})}
        {...(record.currentVisit ? { currentVisit: record.currentVisit } : {})}
        {...(record.lead && ["open", "working", "qualified"].includes(record.lead.status) ? { leadId: record.lead.id } : {})}
        {...(record.customer.locationId ? { locationId: record.customer.locationId } : {})}
      />}
      vehicleControls={<VehicleInterestControls
        canUpdate={canUpdateVehicleInterest}
        customerId={customerId}
        options={vehicleOptions}
        organizationId={organizationId}
        {...(record.lead && ["open", "working", "qualified"].includes(record.lead.status) ? { leadId: record.lead.id } : {})}
      />}
      dealControls={<DealCreationControls
        canApprove={has("deal.approve")}
        canCreate={has("deal.create") && has("deal.read") && has("inventory.read")}
        canUpdate={has("deal.update")}
        customerId={customerId}
        organizationId={organizationId}
        {...(record.currentVisit?.assignedUserId ?? record.lead?.assignedUserId ? { ownerUserId: record.currentVisit?.assignedUserId ?? record.lead?.assignedUserId } : {})}
        {...(record.nextAppointment ? { appointmentId: record.nextAppointment.id } : {})}
        {...(record.currentVisit ? { showroomVisitId: record.currentVisit.id } : {})}
        vehicles={dealVehicles}
        {...(record.lead && ["open", "working", "qualified"].includes(record.lead.status) ? { leadId: record.lead.id } : {})}
        {...(record.deal && record.deal.status !== "cancelled" ? { existingDeal: { id: record.deal.id, dealNumber: record.deal.dealNumber, status: record.deal.status, deliveryCompleted: record.delivery?.status === "completed" } } : {})}
      />}
      quoteControls={<QuoteControls
        canCreate={has("quote.create")}
        canRead={has("quote.read")}
        organizationId={organizationId}
        {...(record.deal ? { deal: { id: record.deal.id, dealNumber: record.deal.dealNumber, status: record.deal.status } } : {})}
        {...(record.quote ? { quote: record.quote } : {})}
      />}
      tradeControls={<TradeWorkflowControls
        canAddTrade={has("inventory.create") && has("inventory.read") && has("lead.update")}
        canAppraise={has("deal.read") && has("deal.update") && has("inventory.read")}
        customerId={customerId}
        organizationId={organizationId}
        {...(record.customer.locationId ? { locationId: record.customer.locationId } : {})}
        {...(record.lead && ["open", "working", "qualified"].includes(record.lead.status) ? { leadId: record.lead.id } : {})}
        {...(record.deal ? { deal: { id: record.deal.id, status: record.deal.status } } : {})}
        {...(tradeVehicle ? { tradeVehicle: { id: tradeVehicle.vehicleId, label: `${tradeVehicle.year} ${tradeVehicle.make} ${tradeVehicle.model}${tradeVehicle.trim ? ` ${tradeVehicle.trim}` : ""}` } } : {})}
        {...(record.tradeAppraisal ? { appraisal: record.tradeAppraisal } : {})}
      />}
      deliveryControls={<DeliveryHandoffControls
        canUpdate={has("deal.update") && has("inventory.read")}
        organizationId={organizationId}
        {...(record.deal ? { deal: { id: record.deal.id, status: record.deal.status } } : {})}
        {...(record.delivery ? { delivery: record.delivery } : {})}
      />}
      snapshotProps={{ state: "ready", snapshot: { id: record.customer.id, identity, vehicleInterest, buyingJourney, communication } }}
      sidebarItems={[{ id: "tasks", label: "Open Tasks", description: "Assigned follow-up requiring attention.", statusLabel: String(record.openTaskCount), disabled: !has("task.read") },
        { id: "deal", label: "Deal", description: record.deal ? record.deal.dealNumber : "No deal started", statusLabel: record.deal?.status ?? "Not started", disabled: !has("deal.read") },
        { id: "quote", label: "Quote", description: record.quote ? `Version ${record.quote.version} · ${formatPrice(record.quote.totalCents)}` : "No quote created", statusLabel: record.quote?.status ?? "Not started", disabled: !has("deal.read") },
        { id: "trade", label: "Trade Appraisal", description: record.tradeAppraisal?.vehicleLabel ?? "No trade appraisal", statusLabel: record.tradeAppraisal?.status ?? "Not started", disabled: !has("deal.read") },
        { id: "delivery", label: "Delivery", description: record.delivery ? formatDateTime(record.delivery.startsAt) : "Not scheduled", statusLabel: record.delivery?.status ?? "Not started", disabled: !has("deal.read") }]}
      timelineEntries={record.timeline}
    />
  </AppShell>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function formatPrice(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100); }

function toAICommandProps(
  run: Awaited<ReturnType<CustomerRecommendationReader["latest"]>>,
): AICommandCenterProps {
  if (!run) {
    return {
      state: "empty",
      reason: "insufficient-evidence",
      description: "Generate guidance from the current authoritative customer record when enough evidence is available.",
    };
  }
  if (run.status === "pending") return { state: "loading" };
  if (run.status === "failed") {
    return {
      state: "error",
      description: "DealerFlow could not produce validated guidance from the available evidence.",
    };
  }
  if (run.status === "refused") {
    return {
      state: "empty",
      reason: "no-relevant-recommendation",
      description: "DealerFlow declined to recommend an action because the available evidence did not support one.",
    };
  }
  const recommendation = run.recommendation;
  if (!recommendation) {
    return { state: "error", description: "Stored guidance did not pass validation." };
  }
  const evidenceById = new Map(run.evidence.map((item) => [item.id, item]));
  const updatedAt = new Date(run.updatedAt);
  const ageMinutes = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 60_000));
  const urgency = recommendation.urgency === "immediate" ? "high" : recommendation.urgency;
  return {
    state: "ready",
    recommendation: {
      id: run.id,
      workspace: { kind: "customer-sales", label: "Customer intelligence" },
      nextBestAction: recommendation.primaryAction,
      confidence: {
        kind: "numeric",
        value: recommendation.confidence,
        max: 100,
        description: "Strength of support in the cited DealerFlow evidence, not a guaranteed outcome.",
      },
      timeHorizon: { label: recommendation.timeHorizon },
      freshness: {
        label: ageMinutes < 1 ? "Just generated" : `${ageMinutes} minutes ago`,
        exactLabel: updatedAt.toLocaleString("en-US"),
        stale: ageMinutes >= 60,
        sourceStatus: "Based on authoritative workspace records",
      },
      evidence: recommendation.evidenceIds.flatMap((id) => {
        const evidence = evidenceById.get(id);
        return evidence ? [{ id, statement: evidence.observation, sourceLabel: evidence.category, timeLabel: new Date(evidence.observedAt).toLocaleString("en-US") }] : [];
      }),
      urgency: { level: urgency, label: recommendation.urgency, reason: recommendation.rationale },
      risks: recommendation.risks.map((title, index) => ({ id: `risk-${index + 1}`, title })),
      opportunities: recommendation.opportunities.map((title, index) => ({ id: `opportunity-${index + 1}`, title })),
      primaryAction: {
        id: "primary-recommendation",
        label: recommendation.primaryAction,
        availability: "disabled",
        unavailableReason: "Review the recommendation, then complete the action in its source workflow.",
      },
      recommendedActions: recommendation.supportingActions.map((label, index) => ({
        id: `supporting-action-${index + 1}`,
        label,
        availability: "disabled",
        unavailableReason: "Complete this action in its source workflow.",
      })),
    },
  };
}
