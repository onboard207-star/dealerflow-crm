# DealerFlow Developer Platform and Marketplace

## Current recommendations

- **Private ecosystem: NO-GO**
- **Partner ecosystem: NO-GO**
- **Public marketplace: NO-GO**

DealerFlow does not currently have app or publisher identities, tenant installations, OAuth app grants, extension scopes, developer sandbox credentials, a versioned public API/event contract, usage ledger, certification workflow, or marketplace billing. Existing application routes and provider webhooks must not be presented as developer products.

## Current surface classification

Organization-scoped HTTP routes serve the DealerFlow web application through user sessions, current memberships, capabilities, feature entitlements, and PostgreSQL tenant context. Internal job routes serve controlled deployment workers. The Twilio callback is a provider-specific signed ingress path. Health/readiness endpoints are operational probes. Provisioning and synthetic seed scripts are operator/test tooling.

All are `internal-only` or `provider-private`. None is a supported SDK/API, generic webhook subscription, extension runtime, or compatibility commitment. Consumers may not depend on raw database tables, internal TypeScript services, route implementation details, or Airtable identifiers.

## Required extension authority

Before even a private app can install, DealerFlow needs stable app and publisher identities, app versions/status, extension types, granular scope catalog, allowed tenant classes, compatibility, callback domains, support/security ownership, tenant-admin consent, installation/revocation records, scoped credentials, audit, and immediate enforcement after revocation.

Sandbox credentials must be environment-bound and unable to reach production. Every app must use canonical tenant-scoped contracts; reseller or commercial relationships never imply developer trust or customer access.

## Security boundaries

Extensions may not use platform-wide credentials, bypass user/tenant authorization, consent/opt-out, field authority, audit, provider policy, AI approval, or finance restrictions. UI extensions require named surfaces and minimal explicit context rather than arbitrary scripts or DOM/session access. Writes go through authorized audited APIs. Third-party content and AI tool output are untrusted.

Webhook/event support requires versioned payloads, tenant context, signatures, replay windows, HTTPS registered domains, at-least-once semantics, idempotent consumption, bounded retries, disable/dead-letter behavior, causation metadata, and loop protection. No exactly-once claim is implied.

## Ecosystem progression

The correct order is Internal Tooling → Private Tenant Apps → Certified Partner Apps → Public Marketplace. Each step requires multi-tenant install/configure/use/failure/revoke certification, adversarial scope and replay tests, load/backpressure, upgrade/deprecation, observability, kill switches, support ownership, vulnerability handling, and cost controls.

Public listings, ratings, money movement, unrestricted AI tools, finance apps, arbitrary executable tenant code, and marketplace social proof remain deferred. Current recommendation is **NO-GO for all three ecosystem tiers**.
