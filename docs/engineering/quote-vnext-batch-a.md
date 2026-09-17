# Quote vNext Batch A

## Scope

Batch A extends the existing immutable `deal_quotes` authority. It does not add a parallel Quote domain or change the accepted Lead-to-Delivered workflow.

Migration `0069_quote_vnext_scenarios` adds three immutable tenant-scoped child tables:

- `quote_product_scenarios` identifies the quoted vehicle or generic white-label product without placing automotive-only identity in the core contract.
- `quote_payment_scenarios` represents cash, finance, and complete provider-term lease structures with policy versions and a SHA-256 calculation fingerprint.
- `quote_trade_snapshots` supports zero, one, or multiple Trade snapshots while preserving canonical appraisal evidence separately from Quote allowance adjustments.

The TypeScript scenario contracts validate safe integer authority, fail incomplete lease scenarios closed, and aggregate positive and negative Trade equity without changing appraisal values. The fingerprint utility sorts object keys and stable-identity collections before hashing; duplicate identities, fractional currency authority, and unsafe integers are rejected.

The Batch B calculation-vector framework declares all 15 locked RC1 cases but deliberately contains no expected financial answers. A vector cannot be accepted without independently reviewed expected values, a reviewer, timestamp, and evidence reference; calculator output cannot bootstrap its own expected fixtures.

## Legacy backfill and reconciliation

The migration captures hashes of every legacy Quote and its lines, commercial terms, finance terms, lease terms, incentives, backend products, profitability, and approval evidence before backfill. It then:

1. creates exactly one deterministic `legacy:default-product` ProductScenario per Quote;
2. creates one deterministic PaymentScenario from the existing cash, finance, or lease structure;
3. creates zero TradeSnapshots when no Trade exists or one snapshot for the existing single-Trade structure;
4. calculates a deterministic legacy fingerprint from canonically ordered immutable inputs;
5. refuses the migration if a legacy lease lacks its required terms;
6. re-hashes all legacy authorities and aborts on any unexplained delta;
7. verifies exact ProductScenario, PaymentScenario, and TradeSnapshot cardinality.

Every backfill insert uses a deterministic ID and a scoped unique conflict target. Replaying the backfill statements cannot create duplicate children. Existing Quote, Trade, approval, incentive, backend product, profitability, status, and version records are never updated.

## Isolation and immutability

All three tables use same-tenant composite foreign keys, enabled and forced row-level security, tenant-scoped SELECT/INSERT policies, and no UPDATE/DELETE policy. A shared trigger rejects every update or delete after creation. Product inventory references remain optional so a generic product or a vehicle without a physical Inventory Unit can be represented without fabricating inventory.

## Rollback

Application rollback is schema-compatible because existing readers and services continue using the original Quote tables. Database rollback is not automatic: after reconciling that no newer application writes depend on the child tables, a separately reviewed forward migration may remove the three triggers, tables, and shared trigger function in child-first order. No legacy restoration is required because migration `0069` does not rewrite legacy authority.

## Acceptance status

The full local repository gate passes: Drizzle migration check, product-portfolio and execution-system reconciliation, ESLint with no warnings, strict TypeScript, 766 tests across 157 files, optimized production build, and whitespace integrity. Existing Quote and golden-journey regression coverage remains green. `IMP-QUOTE-040` is therefore **Built**.

`IMP-QUOTE-047` remains **Built, not Tested** until migration `0069` is exercised on both a clean database and a representative existing isolated database and the migration's embedded reconciliation gate completes twice without duplicate children. That environment evidence must include representative draft, presented, accepted, cash, finance, lease, Trade, incentive, backend-product, profitability, and approval records. No stage advancement is inferred from static SQL tests alone.
