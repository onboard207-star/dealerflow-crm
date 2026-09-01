# DealerFlow Financial Operating System

## Current decision

**NOT AUTHORIZED — no financial metric is currently available as accounting or company-finance truth.**

DealerFlow has no connected accounting system, billing provider, bank feed, payroll system, expense source, approved finance owner, commercial-account authority, contract/subscription ledger, invoice/collection authority, provider price ledger, usage-cost ledger, or finance-specific internal permission model. No dashboard may display MRR, ARR, margin, cash, burn, runway, CAC, LTV, NRR, GRR, or customer economics as actual.

## Authority boundaries

Dealership retail Deals, purchase financing, quotes, appraisals, and delivery records are dealership operating data—not DealerFlow company finance. Product-usage telemetry records privacy-safe workflow events, not contractual/billable usage or provider cost. Pipeline is not revenue, bookings are not cash, implementation fees are not ARR, and estimates/forecasts are never actuals.

Formal accounting, bank, payroll, billing, and approved finance sources remain authoritative when connected. DealerFlow may later aggregate and forecast from those sources but must retain source, period, refresh time, value class, reconciliation, and correction history.

## Metric dictionary

`config/financial-metric-dictionary.json` defines formulas, allowed value classes, required sources, exclusions, and owner roles. Every metric is currently `unavailable`. `pnpm finance:check` prevents a metric from becoming available without its required authorities and prevents financial activation while dependencies remain missing.

Allowed value classes are Actual, Booked, Billed, Collected, Accrued Estimate, Forecast, and Scenario. Reports must never merge them into one unlabeled number. ARR excludes implementation fees and non-recurring revenue; NRR excludes new-logo revenue; recurring and implementation margins remain separate; cash/runway require authoritative sources and stated assumptions.

## Required implementation order

1. Establish restricted internal finance/leadership identities and scopes separate from dealership roles.
2. Create canonical commercial accounts, approved contracts, packages, subscriptions, discounts, and effective-dated revenue schedules.
3. Integrate billing/accounting/bank/payroll sources through governed provider contracts; do not build a card vault.
4. Add versioned provider prices, tenant/environment-scoped usage-cost records, implementation/support effort, and synthetic/test exclusions.
5. Reconcile sources before enabling actual metrics, then add versioned budgets, forecasts, assumptions, and immutable period snapshots.
6. Test finance isolation across dealer, support, partner, group, and unrelated internal roles.

## Executive and AI boundary

Future executive views must show formula, source, period, freshness, inclusion/exclusion rules, sample size, and actual-versus-estimate status. Small cohorts require insufficiency warnings. AI may explain authorized evidence and assumptions but cannot approve spend, payroll, prices, discounts, refunds, invoices, transfers, fundraising terms, contracts, accounting entries, or GO decisions.

Current recommendation: **NO-GO for financial dashboards, billing activation, unit-economics claims, cash/runway reporting, and investor metrics.**
