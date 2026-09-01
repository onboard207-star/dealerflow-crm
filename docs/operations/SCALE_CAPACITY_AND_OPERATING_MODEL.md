# DealerFlow Scale Capacity and Operating Model

## Current recommendations

- **25 rooftops: NO-GO**
- **50 rooftops: NO-GO**

Commercial launch is not authorized and no first-ten operating evidence exists. Production metrics, provider quotas, support capacity, implementation throughput, unit economics, representative load, noisy-neighbor behavior, and recovery-at-scale have not been measured. Unknown capacity remains `unknown` in `config/scale-capacity-manifest.json`; configured request limits are documented separately and are not presented as throughput.

## Capacity evidence model

Every subsystem requires an environment, exact release, measurement window, workload profile, p50/p95/p99 or applicable throughput, error rate, normal utilization, warning and critical thresholds, remaining headroom, and evidence reference. Metrics include rooftops, concurrent users, lead ingestion, communications, inventory, media, AI, jobs, webhooks, imports, documents, support, database connections, and API latency.

The existing bounded worker batches, import sizes, and directory page sizes protect individual requests. They do not establish sustained capacity, provider throughput, fair scheduling, queue recovery, or 25/50-rooftop readiness.

## Required synthetic profiles

Future non-production tests must model small, medium, and high-volume rooftops plus centralized BDC/group traffic. Workloads must include bursty Monday leads, month-end Deal activity, inventory imports, appointment reminders, media uploads, provider callbacks, and bounded campaign spikes. Synthetic identities and destinations remain isolated from production.

Tests must measure baseline, 25-rooftop, and 50-rooftop profiles separately. A noisy-neighbor scenario must drive one tenant to its allowed extreme while unrelated tenants execute lead, Customer, appointment, search, inventory, and manager workflows. Provider tests must cover rate limiting, timeouts, duplicate/out-of-order callbacks, backlog recovery, and no uncontrolled retries.

## Operating protections required before scale

- Tenant-aware backpressure, retry limits, dead-letter handling, and fair scheduling for every asynchronous workflow.
- Provider quota inventory, concentration risk, safe degradation, cost bounds, and escalation ownership.
- Database query-plan, connection, lock, pagination, growth, and migration-at-scale evidence.
- Cache keys that include every tenant, authorization scope, version, and freshness dependency.
- Internal/Synthetic, Canary, Small Cohort, and Broad Release cohorts with health and rollback gates.
- Continuous tenant-isolation regression for search, exports, AI, documents, media, queues, analytics, and privileged support paths.
- Current recovery-at-scale drill, monitored SLO evidence, support/on-call ownership, and implementation capacity.

## Stop-scale triggers

Pause new launches for cross-tenant/security risk, repeated systemic P1, provider saturation without safe mitigation, exhausted headroom, failed recovery evidence, queue/database instability, uncontrolled cost, or implementation/support overload. Sales demand and configured limits are never evidence of available capacity.

## Evidence needed for 25 rooftops

First-ten stability, audited production metrics/provider quotas, measured subsystem headroom, 25-rooftop load, noisy-neighbor and provider-saturation tests, migration/recovery-at-scale, cross-tenant isolation, support and implementation capacity, verified cost instrumentation, and cohort rollback must all pass.

## Additional evidence needed for 50 rooftops

All 25-rooftop evidence must remain current, the 25-rooftop recommendation must be GO, and a separate 50-rooftop projected test must pass without relying on linear extrapolation. Current recommendation remains **NO-GO for both 25 and 50 rooftops**.
