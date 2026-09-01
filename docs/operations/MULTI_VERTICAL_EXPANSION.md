# DealerFlow Multi-Vertical Expansion

## Current decision

**NOT AUTHORIZED — automotive remains the sole reference implementation and first priority.**

The automotive live-pilot, productization, commercial, and scale gates remain open. Engineering capacity must close those gates before building synthetic or live adjacent-industry packs. RV, Powersports, Marine, and Generic Inventory Sales are Concept records only; none is supported, commercially enabled, or represented by working vertical workflows.

## Important existing distinction

The tenant configuration contract contains `automotive`, `marine`, `powersports`, and `inventory-sales` values. Today these select terminology defaults such as Vehicle, Boat, Unit, or Item. They do not install schemas, workflows, providers, templates, AI knowledge, training, fixtures, migrations, or acceptance tests. A label is presentation—not product maturity or data authority.

## Core and pack boundary

Candidate core concepts include tenant/location, identity, users, roles, permissions, Customer/person, Lead/opportunity, appointments, tasks, communications, documents, events, notifications, integrations, audit, training/support, analytics, onboarding, entitlements, and reliability. Whether each can become truly cross-vertical requires semantic and automotive-regression evidence.

Automotive-specific authority currently includes VIN and stock identity, Vehicle/Inventory behavior, trade and appraisal, showroom/desking, quotes, delivery, vehicle-interest semantics, and automotive lifecycle rules. These must not be renamed or generalized merely for architectural symmetry.

Future pack extensions must have a canonical parent, tenant scope, audit, compatibility version, migration strategy, permissions, provider mapping, observability, cost attribution, and rollback behavior. Extension configuration cannot grant new tools, permissions, secrets, arbitrary code execution, or bypass core safety.

## Pack maturity and activation

The governed lifecycle is Concept → Synthetic → Internal Alpha → Design Partner → Pilot → Supported GA → Deprecated. Advancement requires explicit evidence. Commercial activation requires validated customer demand, provider/data path, synthetic fixtures, vertical golden journeys, negative isolation tests, documentation, training, support readiness, and economics.

At minimum a future pack must prove Inquiry/Lead → Assignment → Communication → Appointment/Visit → Asset/Product → Opportunity → Documents/Completion → Ownership/Retention or a validated equivalent. Every shared-core change must rerun automotive critical journeys.

## Candidate order

After repeatable automotive rollout and scale evidence, evaluate RV, then Powersports, then Marine using actual design-partner demand and provider feasibility. Do not build all three merely to satisfy a registry. Other industries require separate fit assessment; highly regulated verticals are not theme conversions.

## Current recommendation

Do not enter design-partner implementation yet. Preserve the bounded registry and focus engineering on automotive pilot/productization blockers. Current recommendation: **NO-GO for multi-vertical activation**.
