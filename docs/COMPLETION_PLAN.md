# DealerFlow AI Completion Plan

## Current state

DealerFlow is a tested Next.js 15, React 19, strict TypeScript application with a responsive white-label shell, PostgreSQL/Drizzle persistence, Better Auth, forced row-level security, capability authorization, operational CRM workflows, Twilio messaging, transactional email, and a portable standalone container.

Implemented vertical slices include organization/location access, staff invitations, customers, repeat Leads, appointments, tasks, communications and consent, vehicle/inventory relationships, Deals, immutable Quote versions, trade appraisal/acquisition, delivery handoff, and the live Customer Workspace. Provider callbacks, scheduler jobs, idempotency, ambiguous-delivery reconciliation, health/readiness checks, structured telemetry, and signed operational alerts have explicit boundaries.

The repository quality gate covers migration validation, strict type checking, lint, unit/architecture tests, and the optimized production build. Runtime secrets, database infrastructure, provider accounts, hosting, and monitoring destinations are external deployment dependencies rather than repository implementations.

## Remaining external gates

1. Provision managed PostgreSQL with SSL, backups, point-in-time recovery, and a tested restore path.
2. Apply the checked-in migration chain in staging and run tenant-isolation integration tests against PostgreSQL.
3. Provision and verify a Resend sender domain; exercise verification, recovery, invitation, retry, and failure telemetry.
4. Provision Twilio test/production accounts; verify webhook signatures, inbound matching, consent enforcement, delivery callbacks, and ambiguous outcomes.
5. Select an OCI host and registry, configure scheduler invocations, deploy staging, and run the documented smoke/security checklist.
6. Connect a monitoring destination to the signed aggregate alert webhook and define paging thresholds/ownership.
7. Complete the Airtable authority reconciliation gates before any legacy retirement or two-way migration.

## Repository roadmap

1. Add provisioned-database integration coverage and migration rollback/restore evidence when infrastructure is available.
2. Add repeatable Playwright/axe accessibility coverage when registry access is available; retain the completed live browser checks at 375, 512 (200%-zoom proxy), 768, and 1440 pixels as current manual evidence.
3. Complete durable document storage only where it is required for the sellable MVP. Tenant-isolated showroom visits, capability-aware global record search, location-scoped manager reporting, tenant-branded printable Quote proposals, and recipient-isolated operational notifications are implemented.
4. Calibrate the controlled AI recommendation boundary in staging with approved dealership scenarios, refusal cases, cost/latency budgets, and human-review quality metrics. Never expose chain-of-thought or permit direct model mutations.
5. Finish tenant branding administration, custom-domain verification, terminology previews, and feature configuration operations.
6. Perform staged performance, security, accessibility, restore, and incident-response exercises before production promotion.

## Definition of deployable MVP

- Every request and job is authenticated or explicitly public, tenant-safe, bounded, observable, and sanitized.
- Lead-to-sale and repeat-customer workflows run against authoritative PostgreSQL records without a demo facade.
- Provider delivery claims come only from verified provider evidence.
- Desktop and mobile critical workflows pass automated and manual accessibility checks.
- Migrations, backups, rollback compatibility, monitoring, alerts, scheduler jobs, and smoke tests are verified in staging.
- Tenant data, branding, terminology, permissions, integrations, and configuration remain isolated per organization.
- All repository validation commands and provisioned integration suites pass for the exact release image.
