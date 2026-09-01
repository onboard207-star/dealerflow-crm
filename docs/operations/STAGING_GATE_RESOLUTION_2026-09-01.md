# DealerFlow Staging Gate Resolution — September 1, 2026

## Outcome

Staging mutation stopped at environment preflight. No deployment, migration, seed, reset, import, provider transaction, outbound communication, or production action was performed.

The service reports `APP_ENV=staging` and uses staging-named resources, but Render places the web service and database inside an environment labeled `Production`. The database also contains an active `production`-class organization alongside the canonical `demo` tenant. The packet requires a stop when environment identity is ambiguous, so resource names and application configuration cannot override those conflicting facts.

## Verified state

- Branch and remote: `codex/staging-deployment` matched origin at starting commit `03d09bdfd511f1c83b5bef6d457ce54c35df808a`.
- Render web service: `dealerflow-staging` (`srv-da70hdc9v7es739ona0g`).
- Render database: `dealerflow-staging-db` (`dpg-da70e5ifngtc73bt7cs0-a`), PostgreSQL 16, private hostname, available.
- Render environment label: `Production`.
- Application environment: `staging`; Node runtime mode: `production`.
- Configured branch: `codex/staging-deployment`.
- Deployed commit: `856c7a02284588330128c332cdb48db0f3fc2be0`.
- Reviewed starting commit: `03d09bdfd511f1c83b5bef6d457ce54c35df808a`.
- Database: `dealerflow_staging`; current migration head is repository migration `0038_organization_data_class` with matching hash `cb3b916e4436f4fef45fad7a46e6f9f0e981aac20aae0e1369d3b10a3f432222`.
- Pending reviewed migration: `0039_import_commit_reversal`; it was not applied.
- Recovery: Render exposes point-in-time recovery for the prior three days. No restore was initiated or represented as completed evidence.
- Tenant classification: `org_demo_first_pilot_v1` is active `demo`; `org_ae339ff94d8461ef4630e7aa1c320f28` is active `production`.
- `DATABASE_SSL_MODE=disable` is explicitly configured for the private Render connection and should be reconfirmed when staging is isolated.

## Non-destructive smoke

The currently deployed, stale release passed:

- `GET /api/health`: HTTP 200 with environment `staging` and commit `856c7a0…`.
- `GET /api/ready`: HTTP 200; database and required runtime configuration ready.
- `GET /login`: HTTP 200.
- Anonymous transactional-email job request: HTTP 401.
- Anonymous outbound-message worker request: HTTP 401.
- Required CSP, HSTS, frame, content-type, referrer, and browser-permission headers were present.

This proves only current-runtime health. It is not exact-release deployment or pilot acceptance evidence. Golden journeys and responsive role acceptance were not run because the authenticated visible workspace is the production-class tenant and an authenticated synthetic-only workspace was not proved.

## Provider classification

| Provider | Classification | Evidence and action |
| --- | --- | --- |
| Resend transactional email | LIVE/PRODUCTION — DO NOT USE | Credential exists; sender and reply identities are not reserved test addresses. No send occurred. |
| Twilio SMS/voice | CREDENTIAL MISSING | No credential or callback URL. Keep blocked. |
| Cloudflare R2 | CONFIG MISSING | Provider, credentials, bucket, and public host absent. Keep blocked. |
| OpenAI | CREDENTIAL MISSING | Restricted provider/model/key absent. Deterministic AI paths remain the only usable class. |
| External alert webhook | CONFIG MISSING | Destination and signing secret absent. |
| Slack | NOT REQUIRED FOR CURRENT STAGING PROOF | Explicitly excluded from the first pilot. |
| External calendar sync | NOT REQUIRED FOR CURRENT STAGING PROOF | Internal calendar workflows exist; external synchronization is not accepted or required here. |
| Synthetic connector stubs | MOCK READY | Repository tests are useful degraded-path evidence, never provider-confirmed evidence. |

## Queue reconciliation

- Complete AUTO: `DWI-PILOT-002`, `DWI-PILOT-004`.
- REVIEW/BLOCKED: `DWI-PILOT-001`, `DWI-PILOT-003`, `DWI-PILOT-006`, `DWI-PILOT-007`.
- HUMAN_GATE/BLOCKED: `DWI-PILOT-005`.
- FUTURE/DEFERRED: `DWI-PROD-001`.
- TRIAGED/NOT RUNNER-READY: `DWI-MAINT-001`.
- No gate was marked satisfied because no exact-release approved staging mutation succeeded.

## Findings

- P0: none identified.
- P1: ambiguous Render environment identity and mixed demo/production tenant classes prevent staging mutation.
- P1: exact reviewed release is not deployed; migration 0039 and its endpoints are absent from staging.
- P1: R2, Twilio, AI, alerting, human owners, pilot dry run, and role UAT evidence remain missing.
- P2: deployed release metadata reports an unknown deployment timestamp; exact-release evidence should include an immutable deployed timestamp.
- P3: catalog projection consolidation remains triaged and intentionally did not bypass pilot gates.

## Exact next human action

Create or designate an explicit isolated Render **Staging** environment and database that contain no production-class tenant data. Provide the resulting web-service and database identifiers. After that isolation is proved, Codex can deploy the exact reviewed descendant, apply migration 0039, verify health, seed/reset the demo fixture, and run the synthetic import/reversal and acceptance sequence authorized by the packet.

Production remains closed and pilot cutover remains `NO_GO`.

## Isolated staging activation addendum

An isolated Render target was established after the original mixed-environment preflight stopped:

- Render project: `DealerFlow AI` (`prj-dabjgncs728c73fhi4t0`).
- Render environment: `DealerFlow Staging` (`evm-dabjhoss728c73fhllk0`).
- Web service: `dealerflow-isolated-staging` (`srv-dabk8d610ojc73ds3afg`).
- PostgreSQL database: `dealerflow-isolated-staging-db` (`dpg-dabjm5e1egvs73b1s92g-a`).
- Staging URL: `https://dealerflow-isolated-staging.onrender.com`.
- Deployed branch and commit: `codex/staging-deployment` at `028c198d226d1979ed539c671b0719410f8c0d33`.
- Runtime: Docker from `./Dockerfile`, final `runner` stage, Starter compute, Virginia region, `/api/health`, auto-deploy disabled.
- Environment identity: `APP_ENV=staging`; database connectivity uses only the new database's private internal URL with `DATABASE_SSL_MODE=disable`.
- `GET /api/health`: HTTP 200 with the exact staging commit.
- `GET /api/ready`: HTTP 503; database is `ready`, required runtime/email configuration is `unavailable`, and AI, media, and alerting are `not-configured`.
- Provider isolation: no Resend, Twilio, OpenAI, Cloudflare R2, Slack, calendar, or other production/provider credentials were copied or enabled.

The database was created fresh without production data. No migration, seed, reset, import, reversal, provider transaction, or outbound communication ran. Migration `0039_import_commit_reversal` remains unapplied. The prior `dealerflow-staging` service and its production-class database were not modified.

The exact next gate is recovery/schema preflight and explicit authorization to apply migration `0039` to this isolated database. Pilot cutover remains `NO_GO`.

## Recovery and migration activation

The authorized recovery/schema preflight completed against database `dpg-dabjm5e1egvs73b1s92g-a`:

- Render exposes point-in-time recovery for the prior three days.
- The target database name was `dealerflow_staging_nvzi`; it contained no application schema, migration ledger, organizations, or production-class data before activation.
- Migration `0039_import_commit_reversal.sql` was unchanged from commit `028c198d226d1979ed539c671b0719410f8c0d33` and had SHA-256 `8c70e7a35a2d3836500859acb17e08df26bbf97ca5840e02d9589d4b886354f7`.
- The repository runner applied the fresh schema chain through `0039` and reported success.
- The Drizzle ledger contains 40 entries and its final hash matches the reviewed migration hash.
- `import_applied_records` has row-level security enabled and forced, one tenant-isolation policy, immutable/reversal constraints, and its same-batch foreign key.
- Post-migration organization and production-class organization counts remained zero.

No seed, reset, import, reversal, provider transaction, outbound communication, production action, or legacy deletion was part of this migration batch. Governed synthetic/demo staging work may proceed; all non-demo, provider, human-acceptance, and production gates remain closed.

## Synthetic AUTO execution result

The deterministic initial seed completed and reconciled the exact `pilot-demo-v1` fixture: 26 staff, 1,476 Leads, 432 delivered Deals, and 48 current available/held Inventory Units. The tenant is `org_demo_first_pilot_v1`, its class is `demo`, and no production-class organization exists.

The subsequent guarded reset failed on `deal_status_events_same_organization_deal_fk` because the reset attempted to delete referenced Deals before their Deal status events. PostgreSQL rejected the operation and the enclosing transaction rolled back. Post-failure verification returned the same four fixture counts, zero `synthetic.reset_completed` events, and zero production-class organizations.

This is a genuine P1 staging blocker. Reseed, import/reversal, and further acceptance mutation stopped. The required correction is to repair and regression-test deterministic reset dependency order without weakening foreign keys, RLS, tenant guards, or rollback behavior, deploy the reviewed fix to isolated staging, and then rerun the guarded reset once.
