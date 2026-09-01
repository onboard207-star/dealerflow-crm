# DealerFlow Synthetic Pilot Harness

## Current scope

The harness creates one isolated deterministic demo tenant: `org_demo_first_pilot_v1`. It exists only for development, test, and staging acceptance. The organization is classified `demo` in PostgreSQL and cannot be mistaken for a pilot or production dealership.

The checked-in manifest is `config/synthetic-pilot-manifest.json`. It owns the fixture version, reference clock, stable tenant and rooftop IDs, expected fixture groups, analytics policy, and reset policy.

## Seed

Run migrations first, then `pnpm synthetic:seed`. `APP_ENV` must be `development`, `test`, or `staging`; `DATABASE_URL` must target that non-production database. The command includes an explicit `SYNTHETIC-DEMO` confirmation guard.

The command creates or verifies the exact demo tenant and rooftop, applies the existing dealership template, and reconciles expected counts. Rerunning it is idempotent. Identity or count divergence fails loudly.

## Safety and privacy

- Production execution is rejected before database access.
- The template seed refuses every organization not classified `demo`.
- Customer and staff email addresses use `.invalid` domains.
- Physical-unit identifiers begin with `TEST` and are not authoritative VINs.
- The reference time is frozen at `2026-08-31T12:00:00.000Z`.
- Provider calls are not made; communication outcomes are synthetic fixtures, not provider evidence.
- Product telemetry must match the organization data class, preventing demo activity from being relabeled as pilot or production adoption.

## Reconciliation

The seed verifies 26 staff memberships, 1,476 Leads, 432 delivered Deals, and 48 current available or held Inventory Units. Application permissions remain authoritative; fixture identities do not grant permission and application logic must not depend on fixture IDs.

## Reset boundary

A destructive reset command is intentionally not exposed yet. Canonical lifecycle evidence is append-only and protected against deletion. A reset that bypassed those controls would weaken pilot evidence.

For v1, reset means reconciling the stable manifest in an isolated demo database or restoring that database from a known synthetic snapshot. Governed scenario overlays and snapshot restoration remain the next harness phase. Production and pilot tenants are never reset targets.

## Acceptance status

Complete: deterministic clock and IDs, explicit demo classification, test-safe destinations and identifiers, idempotent seed, count reconciliation, production/non-demo refusal, and telemetry classification enforcement.

Still open: executable golden journeys, role persona login, provider failure injection, browser/accessibility/responsive/performance suites, reset/reseed proof, backup/restore evidence, and complete screenshot/evidence collection. These are blockers, not hidden successes.
