import type { DealStatus } from "./manage-deal";

export interface DeliveryReadinessInput {
  dealStatus: DealStatus;
  acceptedQuoteId?: string;
  acceptedQuoteVersion?: number;
  resolvedQuote?: { id: string; version: number; status: "accepted" | "other" };
  inventory?: { required: boolean; valid: boolean };
  documentRequirements: readonly { required: boolean; status: "pending" | "complete" | "waived" }[];
}

export interface DeliveryReadiness {
  ready: boolean;
  blockers: readonly ("deal-not-contracted" | "accepted-quote-missing" | "accepted-quote-mismatch" | "inventory-unavailable" | "documents-incomplete")[];
}

export function evaluateDeliveryReadiness(input: DeliveryReadinessInput): DeliveryReadiness {
  const blockers: DeliveryReadiness["blockers"][number][] = [];
  if (input.dealStatus !== "contracted") blockers.push("deal-not-contracted");
  if (!input.acceptedQuoteId || input.acceptedQuoteVersion === undefined || !input.resolvedQuote) {
    blockers.push("accepted-quote-missing");
  } else if (input.resolvedQuote.id !== input.acceptedQuoteId || input.resolvedQuote.version !== input.acceptedQuoteVersion || input.resolvedQuote.status !== "accepted") {
    blockers.push("accepted-quote-mismatch");
  }
  if (input.inventory?.required && !input.inventory.valid) blockers.push("inventory-unavailable");
  if (input.documentRequirements.some((item) => item.required && item.status !== "complete")) blockers.push("documents-incomplete");
  return { ready: blockers.length === 0, blockers };
}
