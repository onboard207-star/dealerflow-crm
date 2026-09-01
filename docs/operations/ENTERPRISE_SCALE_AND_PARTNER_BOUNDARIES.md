# DealerFlow Enterprise Scale and Partner Boundaries

## Current recommendations

- **100 rooftops: NO-GO**
- **Enterprise dealer-group rollout: NO-GO**
- **Partner/reseller activation: NO-GO**

The 25- and 50-rooftop gates have not passed. There is no measured 100-rooftop capacity, enterprise customer, dealer-group authority, partner agreement, regional deployment, enterprise identity provider, or authoritative platform economics. None is inferred from tenant-local staging behavior.

## Current architecture boundary

The organization is the canonical tenant boundary. Locations, memberships, roles, configuration, records, jobs, and provider mappings remain organization-scoped. Dealer groups above that boundary, Platform Admin, cross-tenant support, partner/reseller identities, delegated administration, SSO/SCIM, partner APIs, enterprise billing, usage ledgers, and regional routing do not exist.

This absence must not be bypassed through a larger role, commercial metadata, shared account, database query, or branded UI. An enterprise agreement describes commercial scope; it never grants runtime data access.

## Configuration and white-label scope

Current supported inheritance is Platform Default to Organization only. Organization branding and feature/terminology configuration is versioned. Partner/Brand, Enterprise/Group, Rooftop, and User Preference layers are deferred until their identities, allowed fields, precedence, conflict handling, preview, audit, and rollback exist.

Custom domains remain deferred until ownership, TLS, callback, cookie, and host verification are implemented. Branding may not remove tenant isolation, authorization, audit identity, provider verification, consent/opt-out, security notices, or platform-required controls.

## Enterprise and partner authority requirements

A future hierarchy must use explicit immutable IDs for enterprise account, group, customer organization, rooftop, team, and user. Every delegated action requires assigned-customer scope, role ceilings, least privilege, audit, revocation, and adversarial cross-group tests. Partners may not enumerate or browse unassigned customers and do not receive sensitive operational, employee, communication, or commercial data by default.

SSO/OIDC/SAML and SCIM remain interfaces only after provider-specific configuration, role/group mapping, deprovisioning, session revocation, idempotency, audit, and failure behavior pass. Native authentication remains governed and must not be silently disabled.

## Scale evidence required

The 50-rooftop gate must first be GO. Additional proof includes realistic 100-rooftop and burst load, tenant/group noisy-neighbor behavior, bounded failure domains, cross-group and partner isolation, white-label isolation, enterprise rollout waves, recovery at scale, provider capacity, support/implementation throughput, cost allocation, identity acceptance, API/webhook governance, and approved partner commercial terms.

The three recommendations remain independent. Passing 100-rooftop load would not authorize partner access; approving a partner agreement would not prove enterprise group isolation; enterprise readiness would not automatically authorize regionalization or billing.

## Evidence honesty

DealerFlow must not claim SOC 2, ISO, HIPAA, PCI, data residency, contractual SLOs, gross margin, partner economics, or reference-customer status without formal evidence and approval. Unknown regions, allocations, quotas, and certifications remain unknown.

Current recommendation remains **NO-GO for 100 rooftops, enterprise group rollout, and partner/reseller activation**.
