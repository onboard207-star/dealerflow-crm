# DealerFlow Commercial Launch and First-Ten Operations

## Current decision

**NOT AUTHORIZED — broad selling, billing, and first-ten rollout remain disabled.**

The productization gate is `NOT_AUTHORIZED`; therefore the prerequisite for commercial launch is false. No first-ten dealer cohort, executed contract, revenue, unit economics, customer outcome, reference customer, or commercial capacity claim exists. The repository must not manufacture those records or present pipeline UI backed by placeholders.

`config/commercial-launch-manifest.json` records scale evidence and activation boundaries. `config/commercial-capability-catalog.json` maps every module in the product maturity catalog to a customer-safe sell posture. `pnpm commercial:check` fails if the catalogs diverge, a non-production-supported module becomes sellable, or commercial activation precedes authorization.

## Existing commercial foundation

- Account health is deterministic and evidence-based; critical incidents and failed integrations cannot be averaged away.
- Dealership administration is tenant-scoped and separated from future internal commercial authority.
- The public pricing surface describes a non-binding package framework and publishes no unapproved price.
- Commercial accounts, agreements, subscriptions, pricing approvals, billing, renewals, expansion, and cross-tenant administration are intentionally absent.

These are correct boundaries. They are not a completed commercial operating system.

## Stop-sell posture

No current module is marked broadly sellable. Pilot and experimental modules are `stop-sell`; unimplemented modules are `unavailable`. A future `conditional-sell` state requires exact customer scope, known limitations, provider dependencies, implementation approval, and a governed exception. `sell` requires both `production-supported` maturity and commercial authorization.

Sales materials, demos, proposals, and discovery summaries must be generated from this catalog and explicit limitations. DMS posting, lender submission, recording, e-signature, equity mining, autonomous pricing, and other unavailable capabilities may not appear as included scope.

## Commercial authority required

Before activation, approved records must identify packaging and pricing versions, discount authority, implementation fees, provider pass-through policy, contract template, billing provider, commercial approver, and approval timestamp. Proposal generation must remain separate from contract execution and billing activation. Demo and pilot tenants remain excluded unless converted through a new governed production tenant path.

## First-ten operating gate

The first-ten rollout remains blocked until the fresh second-dealer path passes and the first pilot is stable. Additional requirements are measured implementation/support capacity, provider and production reliability, multi-tenant isolation, representative synthetic load, authoritative usage/cost inputs, monitored recovery, and controlled rollout waves.

Suggested waves are planning defaults only: one proven pilot, two standard dealers, three additional dealers after repeatability evidence, then four after capacity and reliability remain healthy. A commercially closed dealer may still be stop-launch. No commercial state overrides launch safety.

## Future authoritative workflows

When authorized, commercial work should add separate, permissioned authorities for prospect qualification, technical fit, proposal/version history, commercial approval references, implementation handoff, capacity, customer success, renewals, expansion, support, and usage/cost evidence. Dealer retail Customers, Leads, Deals, and communications must never double as DealerFlow commercial-account records.

Readiness and health must expose component evidence rather than one opaque score. ROI, margin, time-to-value, adoption, renewal dates, and customer outcomes require authoritative inputs and must clearly distinguish estimates from actuals.

## Recommendation

Do not begin first-ten acquisition or billing activation. Close production and productization gates first, then authorize a customer-safe capability set and one controlled commercial implementation wave. Current recommendation: **NO-GO for broad commercial launch and first-ten scale.**
