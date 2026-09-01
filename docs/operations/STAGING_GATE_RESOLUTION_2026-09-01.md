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
