# DealerFlow Integration Boundaries

## Principles

- Provider credentials never live in application records. Integration accounts store an environment or secret-manager reference.
- Every provider account belongs to one organization and optional location.
- Webhooks are authenticated before tenant context or operational records are accessed.
- Provider events enter a durable, idempotent inbox before they update CRM history.
- Delivery statuses are provider evidence, not optimistic application claims.
- Outbound communication requires durable consent evidence before an application service may invoke a gateway.

## Twilio provisioning

An administrator with `organization.configure` may call `POST /api/organizations/:organizationId/integrations/twilio`. The request supplies the Twilio Account SID, credential reference, public HTTPS origin, optional location, and optional E.164 sender. DealerFlow returns the complete webhook URL and random key once. PostgreSQL stores only its SHA-256 hash.

The same workflow is available at `/organizations/:organizationId/settings/integrations`. Location-restricted administrators may provision only an explicitly granted location; only an all-locations membership may create an organization-wide sender. The directory displays masked account metadata and never returns credential references, credential values, or webhook-key hashes. The generated webhook URL is a one-time handoff and must be saved in Twilio before leaving the page.

The reference `TWILIO_DEMO`, for example, resolves the auth token from `DEALERFLOW_INTEGRATION_SECRET_TWILIO_DEMO`. Its exact status callback URL resolves from `DEALERFLOW_INTEGRATION_SECRET_TWILIO_DEMO_WEBHOOK_URL`. Production deployments should inject both values from their hosting secret manager.

## Twilio webhooks

Twilio sends form-encoded webhooks signed with `X-Twilio-Signature`. DealerFlow validates the exact configured public URL and every received parameter using Twilio's official Node SDK before resolving a tenant event. See Twilio's [webhook security guidance](https://www.twilio.com/docs/usage/webhooks/webhooks-faq) and [messaging webhook lifecycle](https://www.twilio.com/docs/usage/webhooks/messaging-webhooks).

Accepted events enter `integration_events` under a provider-event uniqueness constraint. Replays are acknowledged without duplicate work. Inbound SMS requires exactly one tenant/location customer match by normalized sender phone. Ambiguous or missing matches remain `unmatched` for operational resolution. Material outbound callbacks reconcile both the canonical communication and its durable send attempt without allowing late callbacks to downgrade terminal `delivered` or `failed` states.

## Outbound messaging

`OutboundMessageGateway` is the provider-neutral boundary. Authenticated callers record consent at `POST /api/organizations/:organizationId/customers/:customerId/consents` and prepare an SMS at `POST /api/organizations/:organizationId/customers/:customerId/messages`. Both endpoints require `Idempotency-Key`. Requests require an E.164 destination, bounded content, purpose, active tenant integration, and current consent for the exact customer address.

Consent and revocation are immutable events. The latest matching event determines eligibility. Send attempts are persisted before dispatch, claimed once, and delayed outside the location's 8:00 AM–8:00 PM local window. Provider acceptance creates the canonical outbound communication; callbacks then update delivery evidence. Ambiguous provider failures become `delivery-unknown` and are not retried automatically.

Deferred attempts are processed by `POST /api/internal/jobs/outbound-messages`, authenticated with a separate `DEALERFLOW_JOB_SECRET` bearer credential. The scheduler supplies an optional bounded `limit` query parameter. A narrowly scoped database function discovers at most 100 due tenant/attempt identifiers; every subsequent consent recheck, claim, credential lookup, send, and state change executes inside that organization's forced-RLS context. Concurrent workers are safe because only one may move a queued attempt to `dispatching`.

Consent is revalidated immediately before deferred dispatch. A revocation or context change rejects the queued attempt without contacting Twilio. One tenant or attempt failure does not stop the remainder of the bounded batch, and responses report aggregate outcomes without tenant identifiers.

Customer-facing controls support consent-aware operational SMS. Marketing-policy details and jurisdiction-specific rules require compliance and founder approval before production traffic.

Administrators with `organization.configure` and `communication.read` may review ambiguous outcomes at `/organizations/:organizationId/operations/messages` or through the corresponding authenticated outbound-attempt APIs. DealerFlow requires a Twilio message ID for a verified sent/delivered outcome and an evidence reference for every resolution. Successful resolution creates the canonical timeline communication; a verified provider failure rejects the attempt. Resolution is location-scoped, audited, and allowed only from `delivery-unknown`.

## OpenAI recommendation boundary

`CustomerRecommendationGateway` is provider-neutral. The current OpenAI adapter uses the Responses API with strict JSON Schema output, `store: false`, a deployment-configured model, a 20-second timeout, and a unique provider idempotency key. Configure `DEALERFLOW_AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `DEALERFLOW_AI_MODEL`; use a restricted project service-account key supplied by the deployment secret manager.

The browser never supplies recommendation evidence. The authenticated route reads current tenant records on the server, removes customer contact identity, persists the evidence and pending run before provider contact, and accepts only cited evidence IDs from the bounded input set. Prompts request concise recommendations and explicitly prohibit invented facts and chain-of-thought. Refusals and provider failures are durable safe states. Completed guidance remains advisory and supports one-time human acceptance or dismissal; review does not execute the recommended business action.

Token counts, model, latency, refusal state, prompt version, and provider response ID are retained for audit and aggregate telemetry. Prompts, evidence, and output are not written to operational logs or alert payloads.
