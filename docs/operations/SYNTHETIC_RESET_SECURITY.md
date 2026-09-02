# Synthetic Reset Security

DealerFlow synthetic reset is an isolated-staging maintenance operation. It is not an application feature or a general tenant deletion API.

## Authorization model

Migration `0040_synthetic_reset_maintenance_role` creates the `NOLOGIN`, `NOBYPASSRLS` role `dealerflow_synthetic_reset_executor`. A separately credentialed staging maintenance login may be granted this role during controlled environment provisioning. The ordinary application database identity must never inherit it.

The role receives only the table privileges needed to validate, delete, and deterministically rebuild the synthetic fixture. Existing forced row-level security remains active. The two immutable lifecycle tables that previously had no DELETE policy—`deal_status_events` and `deal_deliveries`—receive dedicated DELETE policies restricted by all of the following:

- membership in the maintenance role;
- the canonical organization ID `org_demo_first_pilot_v1`;
- matching transaction-local tenant context;
- fixture version `pilot-demo-v1` in transaction-local context;
- the canonical organization slug;
- an active organization classified as `demo`.

The reset runner sets the fixture-version context inside the existing reset transaction. It also verifies that every reset-managed row is fixture-owned before mutation and checks every DELETE result. A denied or partial deletion raises an error and rolls back the transaction. The completion audit event is inserted only after deletion and deterministic reseeding succeed.

## Reset-managed table audit

| Table | Existing mutation policy | Reset handling |
| --- | --- | --- |
| `deal_deliveries` | SELECT, INSERT, UPDATE only | Dedicated synthetic DELETE policy |
| `deal_status_events` | SELECT and INSERT only | Dedicated synthetic DELETE policy |
| `deals` | Tenant-scoped FOR ALL | Existing policy |
| `tasks` | Tenant-scoped FOR ALL | Existing policy |
| `appointments` | Tenant-scoped FOR ALL | Existing policy |
| `communications` | Tenant-scoped FOR ALL | Existing policy |
| `lead_vehicle_interests` | Tenant-scoped FOR ALL | Existing policy |
| `leads` | Tenant-scoped general policy | Existing policy |
| `inventory_units` | Tenant-scoped FOR ALL | Existing policy |
| `vehicles` | Tenant-scoped FOR ALL | Existing policy |
| `customers` | Tenant-scoped general policy | Existing policy |

Deletion remains explicitly child-before-parent. Foreign keys, forced RLS, organization scoping, unexpected-record refusal, and transaction rollback are not weakened.

## Staging provisioning

Create a distinct login using the managed database administration channel, grant it only `dealerflow_synthetic_reset_executor`, and expose its connection string only to the controlled reset command. Never place the maintenance connection string in normal application runtime configuration. Revoke or rotate the login after the acceptance operation when persistent reset access is unnecessary.

Before every staging reset, verify the exact database identity, `APP_ENV=staging`, zero production-class organizations, recovery availability, the deployed commit, and absence of production provider credentials. Production and legacy staging are never eligible.
