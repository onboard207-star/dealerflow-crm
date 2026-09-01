# DealerFlow Productization and Repeatable Dealer Rollout

## Current decision

**NOT AUTHORIZED — the post-pilot prerequisite has not occurred.**

DealerFlow has staging and repository evidence, not a completed live-pilot and hypercare record. No behavior is classified as pilot-proven, no module is claimed as production-supported, and no second-dealer GO is implied. `config/productization-manifest.json` records the evidence gate; `config/module-maturity-catalog.json` records current capability maturity and limitations.

## Evidence boundary

Productization begins only after the pilot final report, approved hypercare exit, incident and support review, acceptance matrix, training feedback, data-quality and provider-health findings, architecture reconciliation, and technical-debt register are current. Missing evidence stays missing. Staging usage, synthetic volume, route rendering, and intended architecture cannot substitute for live operating evidence.

The future pilot lessons ledger must classify each finding as Product Defect, Configuration Gap, Training Gap, Data/Integration Gap, Documentation Gap, Customer-Specific Requirement, or New Product Opportunity, with an evidence link, owner, disposition, and target release where applicable.

## Existing reusable foundations

- The idempotent tenant provisioner creates canonical organization/location configuration, standard roles, and an initial Owner invitation without customer or inventory facts.
- The typed entitlement registry maps capabilities to tenant modules and authorization removes capabilities owned by disabled modules.
- Tenant configuration is parsed and validated through a canonical contract with version history.
- Launch readiness fails closed on missing gates, P0/P1 defects, absent acceptance, or wrong-tenant administrator authority.
- Synthetic/demo data is explicitly classified and excluded from live adoption and commercial reporting.

These foundations remain implementation assets, not proof of a repeatable dealer rollout.

## Standard versus override model

Future configuration decisions must be explicit: platform-required safety control, product default, optional-module default, dealer-group policy, rooftop override, user preference, provider-specific setting, or customer-specific requirement. Precedence must be documented and validated. Tenant overrides may not weaken tenant isolation, authorization, consent/opt-out, audit, provider signature checks, or other platform safety controls.

Dealer-specific IDs, names, mappings, credentials, business hours, sender identities, calendars, data authority, support contacts, and success metrics are always unresolved until supplied and approved. They must never be copied from the synthetic tenant or inferred from another dealer.

## Repeatable implementation path

After authorization, the second-dealer path is: discovery, scope and fit-gap, governed configuration, provider setup, migration preflight, staged import and reconciliation, user provisioning, role training, UAT, GO review, controlled launch, and hypercare. Each phase stores evidence and supports `Not Started`, `Discovery`, `Configuration`, `Integration`, `Data Migration`, `Training`, `UAT`, `GO Review`, `Live/Hypercare`, `Stable`, or `Blocked` without deriving readiness from an opaque score.

The key acceptance proof is a fresh empty synthetic tenant that is bootstrapped, configured, imported, provisioned, trained, accepted, smoked, and safely rolled back without using first-dealer facts. Cross-tenant and upgrade tests must prove the existing tenant remains unchanged and tenant overrides are preserved.

## Manual steps that remain governed

| Step | Why manual | Required owner/evidence | Automation boundary |
| --- | --- | --- | --- |
| Pilot lessons disposition | Requires operating evidence and product judgment | Product owner with linked pilot evidence | AI may summarize; it may not decide disposition. |
| Dealer identity and scope | Contractual and customer-specific | DealerFlow implementation owner and dealer sponsor | Validate supplied values; never invent them. |
| Ambiguous identity/migration mapping | Incorrect guesses can corrupt canonical relationships | Data owner with preview and reconciliation | Automate deterministic mappings only. |
| Provider credentials and sender approval | Secret, regulated, and provider-controlled | Integration owner with health/failure evidence | Store references and validate capabilities; never synthesize secrets. |
| GO/NO-GO | Human accountability is required | Named authorized launch owner with timestamp | Tools may report blockers; they may not approve GO. |
| Backup restore and alert drill | Requires external infrastructure and ownership | Reliability owner with retained evidence | Automate checks after resources are approved. |

## Second-dealer gate

GO requires an approved standardized baseline, fresh-tenant and cross-tenant E2E, upgrade and rollback evidence, tenant isolation, provider acceptance, migration reconciliation, role UAT, training completion, monitoring/recovery, support ownership, zero P0, and no dealer-blocking P1. Billing and autonomous communications remain separately authorized boundaries.

Until those conditions exist, the correct recommendation is **NO-GO for productization and second-dealer rollout**.
