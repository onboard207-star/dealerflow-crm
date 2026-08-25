# DealerFlow AI Architecture

## Authority layers

- **Architecture Portal:** design and control-plane truth. It documents intended objects, capabilities, workflows, screens, and mappings; it is not the transactional database.
- **CRM runtime:** operational customer, lead, task, appointment, communication, visit, deal, and dealership activity authority.
- **Platform Ops:** workflow, automation, AI orchestration, rules, execution metadata, and observability authority.
- **AI guidance:** server-authoritative evidence, immutable prompt versions, strict structured output, durable run status, and human review form the recommendation authority. Model output never mutates CRM records directly.
- **Vehicle & Inventory:** PostgreSQL now holds tenant-scoped canonical VIN identity, location inventory cycles, and lead vehicle-interest relationships. Provider imports must resolve into these records rather than becoming a parallel authority.
- **Deal runtime:** Controlled, capability-aware status transitions preserve an insert-only history and atomically coordinate delivery with lead and inventory outcomes.
- **Quote runtime:** Immutable financial versions and line items preserve exactly what was presented. Controlled status events and a single-accepted-version invariant synchronize the chosen total back to the Deal.
- **Trade & delivery handoff:** Versioned trade equity evidence can become a verified inventory acquisition. Delivery scheduling and completion provide the physical-handoff gate before terminal Deal delivery.
- **Showroom runtime:** Tenant- and location-scoped visit records coordinate customer arrival, active engagement, outcome capture, linked appointment status, append-only event history, and the live customer timeline.

Application code must access runtime data through provider interfaces. UI components do not call Airtable, a database, or external vendors directly.

## Application layers

```text
UI and route handlers
        ↓
Application services
        ↓
Authorization + validation + audit boundary
        ↓
Provider interfaces
        ↓
Database, Airtable migration/sync, and external adapters
```

Provider interfaces are ports, not permission boundaries. Every server-side application service must authorize the actor against the requested organization, location, and capability before invoking a provider.

## Tenant isolation

Organization is the primary tenant boundary. Operational queries and mutations carry an immutable `organizationId`; location-scoped operations may also carry `locationId`. Authenticated actors receive explicit organization memberships, location scope, and capability grants.

Tenant filtering must be part of server-side queries and database constraints. UI filtering, routes, hostnames, slugs, and display names are not authorization controls. Cross-tenant denial must be tested at application-service and persistence boundaries.

## Provider boundary

The initial `CRMDataProvider` contract establishes cursor pagination and explicit organization scope for customer and lead operations. Implementations must:

- apply tenant scope to every query;
- validate provider responses at the adapter boundary;
- preserve canonical and provider record IDs;
- use idempotency and correlation IDs for mutations;
- handle pagination, retries, and rate limits;
- never manufacture unresolved relationships;
- emit structured failures rather than silently discarding records.

The interface will expand with application vertical slices rather than mirroring every field in Airtable.

## Security boundary

Capability authorization is server-side and deny-by-default. An actor must have a membership in the target organization, the requested capability, and access to the target location when one is supplied. Presentation checks may improve usability but cannot replace this boundary.

Better Auth provides session and CSRF-aware authentication over the platform user tables. Durable organization memberships, role capabilities, location grants, verified-email onboarding, invitation rate limits, and append-only audit records are enforced server-side and in PostgreSQL. Deployment smoke testing remains required against a provisioned production-like database and email provider.

Email/password account creation is invitation-only. Before Better Auth persists a user, a database hook extracts the token only from the trusted relative invitation callback and verifies the exact pending, unexpired tenant invitation plus normalized email. A narrow forced-RLS policy exposes only that possession proof; it does not expose invitation directories, roles, or locations. Email verification and explicit invitation acceptance remain separate mandatory steps before membership activation.

Tenant role administration is deliberately narrower than ordinary membership administration. Only an active member with both `organization.configure` and `staff.manage` plus all-location scope may create or change a custom role. The requested capability set must be a subset of the actor's own effective capabilities, and the PostgreSQL provider independently repeats the raw grant check to resist tampered callers. System roles are immutable; administrators cannot alter a role assigned to themselves or remove the final active staff-management path.

Global record search authenticates the organization request before resolving any source. The server searches only domains granted by the current capability set, passes the membership's exact location scope into every directory query, limits queries to 100 characters and at most ten results per domain, and returns private non-cacheable responses. The browser cannot request a capability or location override.

Management reporting requires `reports.view` and derives bounded 7-, 30-, or 90-day aggregates inside the authenticated tenant transaction. Every aggregate embeds the membership's exact location scope. Delivered sales use immutable Deal status events as their time authority; reported revenue is the sum of agreed Deal prices and is explicitly not presented as an accounting ledger.

Customer-facing Quote documents are server-rendered from one immutable Quote version and its stored line items. Access requires `deal.read`, authenticated tenant membership, and the Deal's exact location grant. The document uses resolved tenant product/support branding, is marked no-index, omits unnecessary customer contact data, and can be printed or saved as PDF by the browser. DealerFlow does not claim durable file storage or electronic-signature behavior until those domains are implemented.

Operational notifications are durable, deduplicated pointers to task assignments and Deal approval requests. Database triggers produce them from authoritative writes so alternate provider paths cannot omit the alert. Recipient-only forced RLS, current membership-location filtering, immutable authority fields, and private no-store APIs protect the stream. Opening an item records read state for that recipient and navigates to the authoritative workflow; notification text never replaces current task or Deal state.

Location administration treats rooftop IDs and slugs as stable authority while allowing audited display-name, timezone, and active-state maintenance. Application services and PostgreSQL providers both verify current membership scope. New Locations and active-state changes require `all_locations`; restricted administrators may update only their granted Location metadata. Deactivation queries every active operational domain and refuses to strand work or remove the tenant's final active rooftop.

## AI safety boundary

Recommendation generation requires authenticated tenant membership and `customer.read`; one-time acceptance or dismissal requires `customer.update`. Evidence is assembled from the already-authorized Customer Workspace read model and excludes names, phone numbers, email addresses, VINs, and free-form timeline content. The gateway receives bounded factual observations only. Strict output validation requires every explanation to cite supplied evidence IDs, permits exactly one primary action or a refusal, and rejects corrupt stored output on read. Chain-of-thought is neither requested, stored, nor displayed.
