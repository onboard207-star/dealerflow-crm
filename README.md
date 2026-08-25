# DealerFlow AI

DealerFlow AI is an in-progress, AI-native dealership operating platform. The repository contains a responsive application foundation, live Customer Workspace, tenant-isolated PostgreSQL runtime, authenticated operational workflows, messaging and account-email adapters, and a controlled evidence-based AI recommendation boundary; it is not yet a production deployment.

The frontend uses Next.js 15, React 19, strict TypeScript, Tailwind CSS, Radix/shadcn-style primitives, and Lucide icons. Product and engineering decisions are governed by [AGENTS.md](AGENTS.md), the [Product Guide](docs/product/DEALERFLOW_PRODUCT_GUIDE.md), and the [Design System](docs/design-system/README.md).

## Development

```bash
pnpm install
pnpm dev
```

Open `/demo/customer-workspace` to review the current composed workspace using isolated demonstration data.

With the required database and authentication environment configured, `/` routes users through sign-in, active dealership selection, and the protected organization workspace. New accounts are created through expiring organization invitations; membership activation requires the invited, verified email identity.

After migrations, operators can establish the first dealership and queue its initial Owner invitation with `pnpm tenant:provision`. The provisioner creates stable tenant IDs, the first rooftop, versioned configuration, and immutable standard roles under forced-RLS context. Every account—including the initial owner—must prove possession of a live invitation before Better Auth creates it. Exact production usage and rerun safeguards are documented in [Deployment](docs/DEPLOYMENT.md#first-tenant-provisioning).

## Validation

```bash
pnpm validate
```

This validates the migration chain, lint, strict TypeScript, unit and architecture tests, and the optimized production build. Pull requests and pushes to `main` additionally enforce whitespace integrity, provisioner syntax, and both release container targets in GitHub Actions.

Verified blockers and the next execution phases are tracked in [Build Status](docs/BUILD_STATUS.md) and the prioritized [Completion Plan](docs/COMPLETION_PLAN.md).
Provider provisioning, webhook security, event processing, and outbound-delivery boundaries are documented in [Integrations](docs/INTEGRATIONS.md).

## Current boundaries

- Better Auth and tenant authorization are implemented but require a provisioned PostgreSQL database, applied migrations, and production secrets.
- The first backend API is authenticated lead intake at `POST /api/organizations/:organizationId/leads/intake`; callers must send `Idempotency-Key` and valid customer/source JSON.
- Authenticated appointment scheduling is available at `POST /api/organizations/:organizationId/appointments`; it atomically creates the appointment and its assigned follow-up task and requires an `Idempotency-Key` header.
- Authenticated communication outcomes can be recorded at `POST /api/organizations/:organizationId/customers/:customerId/communications`. This persists history; it does not send through an external provider.
- Authenticated SMS consent and delivery orchestration are available under `/api/organizations/:organizationId/customers/:customerId/consents` and `/messages`; provider credentials and a current exact-address consent event are mandatory.
- Quiet-hour-delayed SMS is processed by the separately authenticated internal outbound worker; consent is revalidated before every deferred dispatch.
- Authorized administrators can reconcile ambiguous provider outcomes from the Messaging Operations workspace with required external evidence and no automatic resend.
- Live customer workspaces are served from `/organizations/:organizationId/customers/:customerId` with capability-aware timeline visibility and server-enforced location access.
- `/organizations/:organizationId/leads` and `/organizations/:organizationId/customers` provide responsive operational discovery with corresponding authenticated JSON APIs under `/api/organizations/:organizationId`.
- `/organizations/:organizationId/inventory` provides capability-aware, location-filtered inventory discovery. The authenticated inventory API registers canonical VINs and inventory cycles; customer vehicle-interest writes link leads to those records without copied vehicle data.
- `/organizations/:organizationId/deals` provides a location-filtered deal queue. Authenticated deal creation and transition APIs enforce customer/lead/vehicle integrity, approval permission, idempotency, and terminal delivery outcomes.
- Deal quote APIs create immutable, typed financial versions and control presentation, acceptance, rejection, and expiration. Accepted totals become the Deal's authoritative agreed price without erasing prior offers.
- Trade-appraisal APIs preserve versioned allowance, payoff, and equity evidence and can create the acquired inventory cycle after contracting. Delivery APIs schedule and complete the physical handoff required before final Deal delivery.
- Twilio is the operational messaging adapter, Resend is the transactional account-email adapter, and OpenAI Responses is the controlled recommendation adapter. Airtable remains a migration source; Slack and storage adapters are not implemented.
- Demonstration records live outside production components.
- Airtable architecture and migration work must preserve canonical ownership and pass the documented deletion-readiness gates before destructive cleanup.
