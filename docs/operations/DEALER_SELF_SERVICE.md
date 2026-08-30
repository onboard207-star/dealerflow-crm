# Dealer Self-Service and Commercial Operations

## Purpose

DealerFlow separates dealership administration from DealerFlow internal commercial operations. A dealership administrator may manage only the organization authorized by their active membership. Internal commercial records must never be inferred from dealership customer, deal, or communication data.

## Available dealership self-service

- Organization and location administration
- Staff invitations, membership status, role, and location access
- Branding and supported configuration
- Supported communications integration configuration
- Audited administrative mutations

Sensitive Owner/General Manager, Controller, and Finance Manager assignments require an explicit confirmation. The server determines whether a role is sensitive from the canonical role record; a browser cannot downgrade that classification. Existing self-change, tenant-scope, capability, and last-manager protections still apply.

## Account health authority

Account health is a deterministic, explainable assessment. Every non-green result includes evidence. An unresolved P0/P1, blocked pilot, suspended billing state, or failed critical integration makes the account red and cannot be offset by healthier signals. Unknown, degraded, low-adoption, or incomplete required data makes the account yellow. Green requires all required signals to be present and healthy.

The evaluator is an application-domain authority only. It does not create commercial accounts, read dealership consumers, or persist invented metrics.

## Internal and dealer boundaries

- Dealer navigation exposes only dealership capabilities.
- Cross-tenant administration requires a separately modeled internal identity and authorization boundary.
- Commercial account, agreement, subscription, discount, renewal, expansion, collections, and customer-success records remain separate from retail CRM records.
- Prices, contracts, adoption thresholds, support commitments, and financial metrics must come from authoritative configuration or records, never placeholder production data.

## Deferred until an authoritative model exists

- Platform-admin console and cross-tenant support access
- Billing provider, invoicing, collections, suspension, and cancellation workflows
- Commercial CRM, proposals, agreements, discount approvals, renewals, and expansion workflows
- Customer-success plans, configured adoption thresholds, support portal, knowledge base, and training content
- Partner API credentials, approval workflows, and external developer documentation
- Production unit economics and executive metrics

These capabilities belong in the MVP only when their identities, permissions, persistence, audit requirements, and external dependencies are explicit and testable. They must not be represented by nonfunctional UI.
