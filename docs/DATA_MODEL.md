# DealerFlow AI Data Model

## Source of truth

PostgreSQL is the target durable application database. Airtable remains an architecture, migration, synchronization, and temporary operational source until each domain is deliberately cut over. Application services use provider interfaces so migration does not require rewriting UI or business workflows.

## Tenant hierarchy

```text
Organization
├── Organization Configuration
├── Locations
├── Memberships
│   ├── Location Grants
│   └── Roles → Capabilities
├── Staff Invitations
│   ├── Proposed Location Grants
│   └── Proposed Roles
└── Operational Records
    ├── Customers
    └── Leads
```

Organization IDs are immutable authorization boundaries. Slugs, domains, and display names are mutable presentation and routing attributes.

Locations are stable tenant/location authorization boundaries. Authorized administrators may change a Location's display name and IANA timezone without changing its ID or slug; existing appointments and delivery records retain the timezone captured when they were scheduled. Creating, activating, or deactivating a Location requires an active all-locations membership in addition to `organization.configure`. A Location cannot be deactivated while it is the last active rooftop or while it owns active Leads, tasks, appointments, showroom visits, Deals, or available/held Inventory. Restricted administrators may maintain the display name and timezone only for Locations already in their grant.

`organization_configurations` holds the current validated white-label state and an optimistic-concurrency version. `organization_configuration_versions` stores immutable full snapshots for audited rollback. A rollback copies a same-tenant historical snapshot into the current row and appends another version; it never edits or deletes configuration history.

## Customer and lead lifecycle

A Customer represents the long-lived relationship. A Lead represents one shopping cycle. A returning customer receives a new Lead linked to the existing Customer; a completed sale does not close or duplicate the Customer.

Lead status moves through controlled open, working, and qualified states. A lost outcome requires a durable reason and may be reactivated when the same buying cycle resumes; archived Leads may also be reopened. Deal delivery is the only path to sold, and sold buying cycles are terminal. Every manual or Deal-driven status change appends an immutable event while the Lead's current status remains the optimized operational projection.

Customer profile maintenance updates the canonical long-lived identity rather than copying contact information into a Lead. Email and phone are normalized before persistence. Intake and profile changes acquire the same deterministic identity locks, then reject a contact value already owned by another Customer. Optimistic timestamps prevent an older browser view from overwriting a newer profile change, while audit records retain privacy-minimized field-presence evidence rather than duplicating contact values.

The durable CRM slice includes customers, leads, appointments, appointment-linked follow-up tasks, showroom visits, communications, consent evidence, outbound send attempts, canonical vehicles, location inventory, and lead vehicle interests. Vehicles retain one tenant-scoped identity across inventory cycles; inventory units represent each dealership acquisition, and lead interests reference the vehicle rather than copying its description. Deals, immutable quote versions, trade appraisal/acquisition, and delivery handoff are durable tenant-owned domains.

## Showroom visits

A showroom visit belongs to one Organization, Location, Customer, and active Lead buying cycle. It may reference the appointment that brought the customer into the store and an assigned staff member. A customer can have at most one checked-in or active visit at a time. Controlled transitions are `checked-in → active → completed`; either open state may be cancelled with a reason, and completion requires a concise outcome.

Every visit transition creates an insert-only status event. Check-in moves a linked scheduled or confirmed appointment to arrived; visit completion moves that arrived appointment to completed. Composite tenant/customer relationships prevent a visit from linking to another customer's Lead or appointment. Forced row-level security, immutable authority fields, idempotency keys, location authorization, and audit entries protect every mutation. Visit status appears in the customer timeline and may be used as factual AI evidence, but AI output cannot change visit state.

## Staff invitations

Organization invitations are tenant-owned authorization proposals, not active memberships. They store only a hash of a high-entropy, expiring token and reference exact organization roles and locations through composite tenant-safe relationships. Acceptance requires the invited, verified platform identity and atomically activates the membership and grants. Revocation and resend rotate or invalidate access without rewriting membership history; bounded hourly issuance and resend limits reduce abuse.

Roles are tenant-owned reusable capability profiles. Bootstrap-defined system roles are immutable; tenant administrators may create and revise custom roles without copying grants onto each membership. Role changes use optimistic concurrency and append audit evidence. Structural administration requires all-location authority, cannot grant capabilities beyond the administrator's own effective access, cannot mutate a role assigned to the acting membership, and cannot remove the final active `staff.manage` path.

The operator provisioner establishes a new tenant atomically without pre-creating an identity. Deterministic organization, rooftop, invitation, configuration-version, and system-role IDs make identical reruns safe while exact-value verification rejects collisions or configuration drift. It seeds immutable Owner, Sales Manager, Salesperson, BDC, and Finance Manager profiles, queues a single all-location Owner invitation, and writes audit evidence without creating or handling account credentials. The membership exists only after invitation-bound account creation, email verification, and acceptance.

## Vehicle lifecycle

- `vehicles` is the tenant-scoped canonical VIN identity.
- `inventory_units` records a dealership/location inventory cycle. A sold vehicle may later return as a new unit without creating a second vehicle identity.
- `lead_vehicle_interests` links one buying cycle to primary, alternative, or trade context and enforces that its lead belongs to the same customer.
- Current inventory status and historical interest are separate facts. Selling or removing inventory must not erase the customer's relationship to the vehicle.
- Inventory media belongs to one exact inventory unit and records immutable delivery, verification, dimensions, content, filename, and provenance authority. `actual`, `cgi-reference`, and `oem-reference` are explicit source types; only one active image may be primary for an inventory unit. Reference media never becomes proof of a physical VIN photo, and removing a primary image safely promotes the next active image without republishing the removed object.
- Inventory and interest mutations are idempotent, audited, capability-controlled, and protected by forced row-level security.
- Authorized inventory staff may correct list price and explicitly move units between available and unavailable with evidence. Held and sold states remain Deal-controlled. Registration, trade acquisition, manual maintenance, Deal hold, and Deal sale produce immutable `inventory_unit_events`; optimistic timestamps reject stale merchandising edits.

## Deal lifecycle

A Deal belongs to exactly one Customer and one Lead buying cycle. The selected Vehicle is canonical; an optional Inventory Unit must match the same organization, location, and vehicle. Controlled transitions are `draft → working → pending approval → approved → contracted → delivered`, with explicit rollback and cancellation paths. Approval requires a distinct capability.

A Lead buying cycle can have only one non-cancelled Deal. Cancelling preserves the historical Deal and permits a replacement proposal; every other status retains the uniqueness claim through delivery. Creation requires an active Lead at the authorized location and, when an Inventory Unit is selected, that exact unit must match the Deal location and Vehicle.

Every transition creates an insert-only status event. Contracting places available inventory on hold. Delivery atomically marks inventory sold, closes the Lead as sold, marks the selected vehicle interest purchased, and retires remaining active alternatives. The Customer remains active so future purchases begin with a new Lead rather than a duplicate customer.

## Quote versions

A Deal may have multiple Quote versions, but financial contents are never overwritten. Each version contains typed, ordered line items and integer-cent totals constrained both in the application and PostgreSQL. Exactly one vehicle line anchors the quote; products, accessories, fees, taxes, and negative discounts remain explicit rather than being folded into an opaque payment.

Quote status history is insert-only. Draft quotes may be presented, and presented quotes may be accepted, rejected, or expired. Only one version may be accepted for a Deal. Acceptance atomically copies its authoritative total and purchase type onto the Deal while retaining every earlier version for audit and comparison.

## Trade and delivery handoff

Trade appraisals are immutable financial versions tied to the Deal and the customer's canonical trade Vehicle. Allowance, payoff, and calculated equity remain distinct. One version may be accepted; acquisition requires a contracted Deal and atomically creates a new Inventory Unit for that same Vehicle while marking its buying-cycle interest as traded.

Trade intake resolves or creates canonical Vehicle identity from a validated VIN and atomically links it to the active Customer/Lead buying cycle with the trade role. It does not create inventory prematurely. Only an accepted appraisal on a contracted Deal may convert that customer-owned Vehicle into an acquired Inventory Unit at the Deal location.

A Deal has at most one delivery handoff. Delivery records retain the scheduled time range and IANA timezone, then move through scheduled, ready, and completed states with insert-only events. Cancellation requires a reason. A Deal cannot transition to delivered until its handoff is completed; the subsequent Deal transition atomically finishes the sale and inventory outcomes.

Appointments belong to one organization and customer and may reference the originating lead, location, and assigned user. Tasks use the same ownership boundary and may reference their appointment. Composite organization-aware foreign keys prevent records from linking across tenants. Scheduling creates the appointment and follow-up task in one transaction, uses organization-scoped idempotency keys, and serializes concurrent retries with a transaction advisory lock.

Appointment status follows controlled transitions from scheduled through confirmation, arrival, and completion, with terminal cancellation and no-show outcomes requiring evidence. Every status change appends an immutable event. Showroom check-in and completion update linked appointments through the same event authority, preventing the customer timeline from relying on mutable appointment state alone.

Standalone customer tasks use the same canonical record and may move from open to in progress, completed, or evidence-backed cancelled. Every creation and transition appends an immutable `task_status_events` record; task authority fields cannot be reassigned across tenants, locations, customers, Leads, or appointments after creation. Customer-workspace reads and mutations enforce capability and membership-location scope.

Communications record verified call, SMS, and email outcomes; they do not claim DealerFlow delivered a message unless an integration reports that status. Manually logged call and email evidence requires a bounded summary, a valid direction/outcome combination, a non-future timestamp, exact Customer/Lead context, and an idempotency key. The customer timeline is a read model over lead, communication, appointment, showroom-visit, task, vehicle, deal, quote, trade, and delivery authorities rather than a copied history table. Visibility is capability-aware, and customer lookup applies allowed-location filtering before related activity is queried.

## Operational notifications

`notifications` is a durable per-recipient attention stream, not a copied source of business truth. Task creation produces one deduplicated assignment notification for its active owner. A Deal entering pending approval produces one notification for each active manager with `deal.approve` and access to that Deal location. Notification links point back to the authoritative Customer Workspace where the actual task or Deal state is evaluated.

Forced RLS permits reads and read-state updates only when the current authenticated user is the recipient. Trigger inserts additionally require an active same-tenant membership and matching location grant. Authority fields are immutable, deletion is unavailable, and the application repeats current membership-location filtering so revoked rooftop access cannot expose stale notification content. Read state belongs only to the recipient.

## AI recommendation runs

`ai_recommendation_runs` belongs to one Organization and Customer and may reference that Customer's Lead. It persists a pending run before provider contact, the prompt version and bounded evidence snapshot, validated output or refusal, sanitized failure code, provider/model usage metadata, and an optional one-time human review. Composite foreign keys, forced RLS, organization-scoped idempotency, per-customer pending-run uniqueness, and an authority-field trigger prevent cross-tenant links and historical rewrites. Model output is advisory evidence, never CRM authority and never an automatic mutation instruction.

## External provenance

`external_record_mappings` maps canonical application entities to provider records, including Airtable base, table, and record IDs. Mappings are unique by provider source identity and by canonical entity identity. A migration must not manufacture a relationship when its source record cannot be resolved.

## Audit history

`audit_logs` records organization, actor, action, entity, source, correlation ID, timestamp, and old/new values where appropriate. Audit records are append-only at the application layer.

## Tenant enforcement

Tenant-owned tables use explicit `organization_id` columns, supporting indexes, and PostgreSQL row-level security policies in the initial migration. Application transactions must set the verified organization context before accessing tenant-owned data. RLS is defense in depth; services must still authorize actors and include tenant predicates.

## Identifier policy

Application IDs use immutable, opaque, prefixed identifiers such as `org_`, `loc_`, `usr_`, `mem_`, `oin_`, `cus_`, `led_`, `ntf_`, `air_`, and `aud_`. Airtable record IDs are provenance identifiers, not canonical application IDs or authorization boundaries.

## Migration discipline

- Schema changes are checked into `drizzle/` and applied through `pnpm db:migrate`.
- Production schema is never initialized or pushed implicitly during application startup.
- Migration application requires `DATABASE_URL`; code generation and validation do not.
- Legacy Airtable deletion requires all four documented readiness gates.
