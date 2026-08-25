# Deployment

DealerFlow is not deployed yet. The repository produces a valid optimized Next.js build, but production requires external PostgreSQL, authentication secrets, hosting, monitoring, and a migration execution environment.

## Runtime requirements

- Node.js 22
- pnpm 11.9.0
- PostgreSQL with SSL in staging and production
- `APP_ENV`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET` containing at least 32 high-entropy characters
- `DEALERFLOW_JOB_SECRET` containing at least 32 high-entropy characters and distinct from authentication/provider secrets
- `BETTER_AUTH_URL` using HTTPS outside local development and test
- `DEALERFLOW_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified `DEALERFLOW_EMAIL_FROM` sender
- Optional `DEALERFLOW_EMAIL_REPLY_TO` support mailbox
- Optional paired `DEALERFLOW_ALERT_WEBHOOK_URL` and high-entropy `DEALERFLOW_ALERT_WEBHOOK_SECRET` for aggregate operational alerts
- `DEALERFLOW_AI_PROVIDER=openai`, a secret-manager-injected `OPENAI_API_KEY`, and an explicitly pinned `DEALERFLOW_AI_MODEL`
- `DEALERFLOW_INTEGRATION_SECRET_<REFERENCE>` for each active provider account, injected by the deployment secret manager

The application exposes `/api/health` for process liveness and `/api/ready` for dependency readiness. Readiness returns HTTP 503 until PostgreSQL is configured and reachable; it does not expose connection details.
Readiness also fails closed when authentication, scheduler, transactional-email, or AI provider configuration is incomplete. Use authenticated `GET /api/internal/jobs/transactional-email` with the scheduler bearer secret for privacy-safe seven-day queue counts, oldest queued age, and grouped failure codes; no recipient addresses or message bodies are returned.

Copy `.env.example` for local configuration. Never commit populated environment files.

Configure the hosting scheduler to invoke both `POST /api/internal/jobs/outbound-messages` and `POST /api/internal/jobs/transactional-email` with `Authorization: Bearer <DEALERFLOW_JOB_SECRET>`. Run them frequently enough to satisfy messaging and account-email latency requirements. The email worker accepts a bounded `limit` query parameter from 1 through 100, defaults to 25, and retries transient delivery failures with bounded exponential backoff. Never expose the scheduler credential to browsers or reuse it as an application session secret.

Organization invitation links expire after seven days. Invitation tokens are delivered only by transactional email and stored only as hashes. Acceptance requires a signed-in, verified account whose normalized email matches the invitation; deployment smoke tests must cover mismatched-email rejection and cross-tenant role/location rejection.
The email worker reclaims `sending` rows abandoned for more than ten minutes. Provider idempotency keys make those recovery attempts safe. Alert when failed messages are nonzero, queued age exceeds the scheduler interval plus expected provider latency, or sending rows remain nonzero across consecutive worker runs.

When alert routing is configured, DealerFlow sends versioned JSON events with `X-DealerFlow-Signature: sha256=<HMAC>` over HTTPS. The receiver must verify the HMAC against the exact raw body before parsing, reject stale timestamps, deduplicate by correlation ID plus event code, and return a 2xx response within five seconds. Events contain aggregate counters and identifiers only; keys resembling contact data, credentials, tokens, or message content are stripped. Alert delivery is best-effort and never changes the durable job result; delivery failures are emitted to structured stderr telemetry.

## Quality gate

```bash
pnpm install --frozen-lockfile
pnpm validate
git diff --check
node --check scripts/provision-tenant.mjs
docker build --target migrator -t dealerflow-ai-migrator:verify .
docker build --target runner -t dealerflow-ai:verify .
```

`pnpm validate` includes migration-chain validation before lint, strict TypeScript, tests, and the optimized application build. CI enforces every command above for pull requests and `main`.

## Database migration

Migrations are checked into `drizzle/`. Apply them as an explicit release step:

```bash
DATABASE_URL=... pnpm db:migrate
```

Do not run schema push or automatic runtime initialization in production. Back up the database before applying a migration, capture the migration result, and deploy application code only after the required schema is available.
The repository test gate requires the Drizzle journal to match every numbered SQL file exactly and in order. An unjournaled file is not a migration and fails CI.

## First tenant provisioning

The first owner does not need to exist before provisioning. The operator supplies the intended email, and the provisioner atomically creates the tenant plus a seven-day Owner invitation in the transactional email queue. Direct email/password sign-up without that exact live invitation token and email is rejected by the authentication database hook.

Run the provisioner from the exact release image after migrations and before accepting dealership traffic:

```bash
DATABASE_URL=... APP_ENV=production pnpm tenant:provision -- \
  --organization-slug north-star-auto \
  --organization-name "North Star Auto" \
  --owner-email owner@example.com \
  --location-slug main \
  --location-name "Main Store" \
  --timezone America/New_York \
  --application-url https://crm.example.com
```

The command deterministically derives organization, location, invitation, configuration-version, and system-role IDs, establishes transaction-local tenant context before reading or writing forced-RLS tables, verifies every pre-existing structural identity, and commits atomically. A rerun with identical inputs is safe and does not rotate or expose the pending token. A conflicting name, slug, rooftop, Owner email, or system-role capability profile fails and rolls back instead of rewriting an existing tenant. Successful runs output only non-secret IDs and append operator audit evidence.

The checked-in standard roles are Owner, Sales Manager, Salesperson, BDC, and Finance Manager. The initial invitation grants only Owner with all-location scope; acceptance creates the membership only after Better Auth email verification. Owner holds every capability in the release. Standard roles are immutable in the application; change their definitions only through a reviewed release migration or provisioner-version upgrade, never through live database edits.

## Container release

`Dockerfile` produces two release targets:

- `runner`: minimal Next.js standalone runtime running as non-root UID/GID 1001;
- `migrator`: release task containing Drizzle and the checked-in migration chain.

Build one immutable image reference per commit. Run the migrator target as a one-off task with only `DATABASE_URL`, then deploy the runner target with the complete environment contract. Never execute migrations automatically when a web replica starts. Every third-party GitHub Action in the release gate is pinned to a reviewed 40-character commit SHA; retain the human-readable major-version comment when updating a pin, and never replace a pin with a mutable tag or branch.

```bash
docker build --target migrator -t dealerflow-ai-migrator:COMMIT .
docker build --target runner -t dealerflow-ai:COMMIT .
docker run --rm --env DATABASE_URL dealerflow-ai-migrator:COMMIT
docker run --read-only --tmpfs /tmp --cap-drop ALL -p 3000:3000 --env-file .env.production dealerflow-ai:COMMIT
```

The runtime image has an OCI health check, listens on port 3000, runs as a dedicated unprivileged user, and contains only the standalone server, static assets, and public assets. The deployment platform should additionally enforce a read-only root filesystem, dropped Linux capabilities, bounded CPU/memory, secret-manager injection, and at least two replicas after migration.

## Release verification

After deploying a candidate, run the read-only smoke suite from a trusted operator environment:

```bash
DEALERFLOW_SMOKE_BASE_URL=https://staging.example.com \
DEALERFLOW_JOB_SECRET=... \
pnpm smoke:deployment
```

The suite verifies liveness, full readiness, login rendering, anonymous rejection by both internal workers, authenticated privacy-safe email telemetry, `no-store` response contracts, baseline browser isolation headers, Content Security Policy, permissions policy, and HSTS over HTTPS. The production CSP restricts scripts, connections, forms, frames, workers, fonts, and objects to controlled sources while allowing credential-free HTTPS tenant images. Then complete a manual authenticated smoke pass for organization selection, tenant/location isolation, invitation acceptance, lead intake, customer workspace, outbound messaging with test credentials, quote transitions, trade, and delivery. Record the release SHA and evidence before promotion.

The staging pass must also generate a Customer recommendation with a non-production record, verify strict evidence citations and `store: false` behavior, exercise provider refusal/failure presentation, and record acceptance or dismissal without executing the suggested action. Confirm no customer contact data or model content appears in logs or alert delivery.

## Current deployment blockers

- No PostgreSQL environment has been provisioned.
- Authentication and its durable verification/recovery email queue cannot be runtime-verified until production database, auth, Resend, and verified sender-domain credentials are available.
- No hosting project, container registry, staging environment, monitoring destination, or rollback target is configured.
- Integration credentials, including an OpenAI project key, and webhook endpoints are unavailable.

## Rollback

The initial migration has not been applied. Before the first staging deployment, establish point-in-time recovery and test restore procedures. Application releases should be backward-compatible with the currently applied schema whenever practical; destructive migrations require a separate expand/migrate/contract sequence. Roll back web replicas to the previous immutable image only after verifying its schema compatibility. Do not reverse a migration by deleting production data; use a reviewed forward repair migration or restore to a proven recovery point.
