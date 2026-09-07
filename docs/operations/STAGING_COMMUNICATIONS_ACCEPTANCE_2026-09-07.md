# Restricted Staging Communications Acceptance

**Date:** September 7, 2026  
**Release under repair:** `21865ef1802a18b535208415b9189577055e9352`  
**Environment:** `dealerflow-isolated-staging` / `org_demo_first_pilot_v1`  
**Result:** BLOCKED AT PROVIDER CONFIGURATION — no communication sent

## Existing architecture reused

DealerFlow already has one canonical communications authority: immutable consent events, durable SMS send attempts, Customer/Lead association, quiet hours, single-claim dispatch, Twilio gateway resolution from server-only credential references, signed webhook validation, tenant-routed provider inbox events, canonical Customer timeline communications, status reconciliation, delivery-unknown review, transactional account-email queueing, Resend delivery, bounded retries, structured aggregate telemetry, forced tenant RLS, and location/capability authorization.

No parallel messaging architecture was created.

## Configuration discovered

The isolated Render service reports `APP_ENV` configured. The following required values are absent:

- `DEALERFLOW_INTEGRATION_SECRET_TWILIO_DEMO`
- `DEALERFLOW_INTEGRATION_SECRET_TWILIO_DEMO_WEBHOOK_URL`
- `DEALERFLOW_STAGING_SMS_RECIPIENT_ALLOWLIST`
- `DEALERFLOW_STAGING_SMS_SENDER_ALLOWLIST`
- `DEALERFLOW_EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `DEALERFLOW_EMAIL_FROM`
- `DEALERFLOW_EMAIL_REPLY_TO`
- `DEALERFLOW_STAGING_EMAIL_RECIPIENT_ALLOWLIST`
- `DEALERFLOW_STAGING_EMAIL_SENDER_ALLOWLIST`

The Customer workspace accurately reports that no active Twilio sender is configured. No provider transaction was attempted, no test or real recipient was contacted, and no provider success was fabricated.

## Deterministic acceptance completed

- Added mandatory exact SMS sender and recipient allowlists for staging.
- Added mandatory exact transactional-email sender and recipient allowlists for staging.
- Staging SMS additionally requires a `demo` organization; pilot and production-class data fail closed.
- Allowlist validation occurs server-side immediately before provider contact.
- Fixed Twilio status-callback idempotency so `sent` then `delivered` are distinct while exact callback replay is deduplicated.
- Added canonical STOP processing for both operational and marketing SMS consent.
- Confirmed a later send fails when the latest consent event is revoked; re-consent requires the existing authorized evidence-backed path.
- Classified known provider 4xx outcomes as rejected; timeout, 5xx, network, and malformed responses remain delivery-unknown.
- Confirmed provider exceptions expose sanitized codes rather than provider bodies, credentials, or tokens.
- Confirmed tenant, location, Customer/Lead, consent, permission, and idempotency checks remain in the existing services and forced-RLS providers.
- Focused acceptance covers duplicate outbound requests, duplicate inbound/status events, invalid destination, permission denial, revoked consent, deferred consent recheck, provider rejection, ambiguous failure, and invalid/malformed provider results.

## UI and accessibility

The deployed Customer communication surface was inspected at 1440×900, 820×1180, and 390×844. At every viewport the semantic `Customer communication` region remained present and document width did not exceed viewport width. Native labeled select, text, and button controls preserve keyboard operation and existing visible-focus styling. Consent state and the missing-integration state are expressed in text, not color alone.

Live sent, delivered, failed, and opted-out provider states cannot be accepted visually until a restricted provider path exists. No unrelated UI was redesigned.

## Privacy review

Provider secrets remain environment-only and credential references remain server-side. Browser contracts do not return credentials or webhook hashes. Operational telemetry records bounded result counts/codes, not message bodies or raw provider payloads. The durable provider inbox and communication record retain synthetic content only as canonical tenant data; this is not telemetry and must remain tenant protected.

## Exact remaining requirement

An authorized operator must provide all of the following before live isolated-staging acceptance:

1. A Twilio test/subaccount Account SID and auth token with no production traffic.
2. One controlled Twilio sender and its exact HTTPS DealerFlow status/webhook URL.
3. One or more explicitly approved test phone numbers for the SMS recipient allowlist.
4. A Resend test/restricted API key and verified non-production sender mailbox/domain.
5. One or more explicitly approved test email recipients.
6. Confirmation whether first-pilot customer communications include SMS, customer email, or SMS only; transactional account email remains required for normal invitations/password setup.

After configuration, rerun the real-provider acceptance for outbound, inbound, STOP, post-STOP denial, callback progression/replay, provider failures, timeline projection, tenant/location/permission attacks, and all three viewports. P1-01 remains open until that evidence exists.
