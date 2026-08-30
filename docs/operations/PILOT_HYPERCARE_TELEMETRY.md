# DealerFlow Pilot Hypercare and Product Telemetry

## Current State

DealerFlow remains pre-launch. No live pilot adoption, support outcome, conversion, or success metric is claimed. This foundation records privacy-safe meaningful events only after a real pilot authority and approved instrumentation are connected.

## Event Authority

`product_usage_events` is an append-only tenant-scoped evidence stream with forced row-level security, tenant/location relationships, release and feature-flag attribution, idempotency, and bounded attributes. It records identifiers and categories—not customer content.

Governed events are: `customer.opened`, `lead.responded`, `task.completed`, `appointment.created`, `appointment.confirmed`, `inventory.opened`, `inventory.photo-added`, `deal.opened`, `manager.exception-reviewed`, `ai.summary-requested`, `ai.feedback-recorded`, and `support.created`.

## Privacy and Exclusions

Telemetry rejects attribute keys associated with messages, notes, prompts, names, email, phone, address, VIN, credentials, financial data, or documents. Values are primitive, bounded, and limited to 20 attributes.

Every event identifies its actor as dealer user, DealerFlow staff, automation, or synthetic and its data class as demo, pilot, or production. Only non-demo dealer-user events count toward human adoption. Internal QA, automation, and simulations cannot inflate adoption.

## Metrics

Adoption must require meaningful governed events, not page views or login counts. Workflow metrics should prefer canonical domain events for Lead response, tasks, appointments, Inventory, and Deals. Every success metric requires a versioned definition, source, baseline period, pilot period, and confidence of Verified, Partial, or Insufficient Data.

## Hypercare Views

Future internal Pilot Operations views may aggregate Overview, Health, Adoption, Workflows, Support, Integrations, AI, Success Metrics, Feedback, Releases, and Risks. Before a real launch they must display `NO LIVE PILOT DATA`. Cross-tenant access requires a separately governed Platform Admin authority and must not be inferred from dealer administration.

## Deferred Dependencies

Instrumentation, pilot/account persistence, support cases, training completion, feedback, success-metric definitions, review documents, conversion states, provider costs, and cross-tenant operations remain deferred until their canonical authorities exist. Synthetic simulations must use `actor_type=synthetic` and `data_class=demo` and remain excluded from real metrics.
