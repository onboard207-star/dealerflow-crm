# DealerFlow Current Execution State

**Updated:** September 1, 2026  
**Branch:** `codex/staging-deployment`  
**Latest completed implementation:** `DWI-PILOT-004` at `40ae05dcaf7ecf3d85bb30aab38875fc19476ac3`
**Pilot:** NO_GO  
**Current milestone:** First Pilot Reliable

## Active Item

No AUTO item is currently eligible.

The isolated Render target is active in `DealerFlow Staging`: web service `srv-dabk8d610ojc73ds3afg` uses database `dpg-dabjm5e1egvs73b1s92g-a` and runs exact commit `715f3f9489e31a33ea4387b2108f54a5b69c4b06`. The code-only fix now proves the reset transaction uses governed fixture version `pilot-demo-v1`, distinct from internal template version `v1`. The single authorized reset failed closed on missing EXECUTE permission for `notification_recipient_is_active` under the dedicated maintenance identity. Transactional rollback preserved 26 staff, 1,476 leads, 432 delivered Deals, 48 current Inventory Units, 432 deliveries, and 432 Deal status events; zero reset-completed events exist. Forced RLS remains enabled on both protected lifecycle tables. The transient maintenance login was disabled and its credential removed. This remains a P1 staging blocker. No reseed or further AUTO mutation ran.

## Queue Summary

- P0: 0
- P1: 7 active/waiting/blocked
- P2: 1 deferred
- P3: 1 triaged
- Eligible AUTO item: none
- Commercially supported capabilities: 0

## Safe Boundary

Stop synthetic AUTO mutation until the maintenance identity receives the narrowly required function permission through reviewed schema/security remediation, regression tests pass, and another isolated-staging reset is separately authorized. No non-demo import/reversal, provider activation, real customer send, destructive cleanup, or pilot GO is authorized. The old mixed/Production-labeled service and database remain closed to mutation.
