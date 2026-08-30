# DealerFlow Integration Platform

## Canonical flow

External provider → connector → validation → normalization → tenant resolution → canonical DealerFlow domain → workflow → audit and observability.

Provider payloads never become DealerFlow's internal domain model. Connectors translate supported values explicitly and route unknown statuses, mappings, and authority conflicts to review.

## Provider registry

The typed registry records provider category, authentication method, supported capabilities, operations, release stage, and verification evidence. Internal stub providers are hidden from dealer-visible registry results. VinSolutions remains disabled roadmap support with no claimed operations. Twilio is the only provider currently backed by verified staging communication flows.

## Connector contract

Connectors may implement verification, health checks, pull, push, webhook handling, and disconnect behavior. Unsupported behavior raises an explicit error. The executor refuses authenticated operations without a server-side credential reference. Raw credentials are resolved only at the server boundary and are not returned to browser configuration.

## Status and failures

Lifecycle status is standardized as not configured, configuring, verifying, operational, degraded, failed, or disabled. Configured does not mean operational. Error categories distinguish authentication, authorization, rate limiting, network, schema, mapping, provider outage, tenant configuration, data conflict, and unknown failures. Retry policy must be chosen from the category; invalid credentials and schema failures must not be retried as transient outages.

## Authority and conflicts

Authority is declared per object or field as external wins, DealerFlow wins, newest wins, or review required. Newest wins requires both trustworthy timestamps; otherwise the result is review required. There is no hidden last-write-wins behavior.

## Test harness

The internal stub connector uses synthetic records and deterministic scenarios for success, authentication failure, provider outage, rate limiting, malformed input, and duplicate delivery. It is never displayed as a real dealer integration.

## Deferred production requirements

- Persistent provider registry and generalized tenant-integration schema beyond the current Twilio account model
- OAuth initiation, callback state binding, refresh, and revocation
- Sync jobs, checkpoints, reconciliation reports, and distributed locks
- Mapping persistence and integration conflict queue
- Generic lead and inventory ingestion adapters
- Partner API clients, scopes, tenant consent, versioning, and OpenAPI
- Outbound webhook subscriptions, signing, retries, dead letters, and replay
- Provider-specific DMS, CRM, inventory, service, finance, and marketing connectors

No connector advances beyond its release stage without authentication, isolation, mapping, idempotency, failure, rate-limit, security, monitoring, and support evidence.
