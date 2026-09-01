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

Run `pnpm synthetic:reset` only after migrations and only against the isolated synthetic environment. The command requires all of the following before it reaches fixture deletion:

- `APP_ENV` is `development`, `test`, or `staging`; production is rejected before database access.
- The exact organization identity is `org_demo_first_pilot_v1`, active, and canonically classified `demo`.
- The explicit reset confirmation is `RESET-SYNTHETIC-DEMO`.
- The acknowledged fixture version is exactly `pilot-demo-v1`.
- Every existing Customer, Lead, Vehicle, Inventory Unit, interest, communication, appointment, task, Deal, Deal event, delivery, and membership in the tenant belongs to the deterministic fixture.

The reset locks and rechecks the canonical demo classification, verifies the ownership boundary, deletes only deterministic fixture IDs in dependency order, and reseeds them in one database transaction. Any unexpected tenant record, foreign-key dependency, deletion failure, or reseed failure rolls back the entire operation. It never deletes the organization, location, users, roles, memberships, or append-only audit history.

Every successful reset appends a `synthetic.reset_completed` audit event with the fixture version and deterministic summary. The command then reconciles the stable manifest counts. Production and pilot tenants are never reset targets.

## Acceptance status

Complete locally: deterministic clock and IDs, explicit demo classification, test-safe destinations and identifiers, idempotent seed, governed atomic reset/reseed, unexpected-record refusal, append-only reset evidence, count reconciliation, production/non-demo refusal, and telemetry classification enforcement.

Still open: execution against an authorized exact-release staging database, executable golden journeys, role persona login, provider failure injection, browser/accessibility/responsive/performance suites, backup/restore evidence, and complete screenshot/evidence collection. These are blockers, not hidden successes.
