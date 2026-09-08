# Restricted Staging Communications Acceptance

**Date:** September 7, 2026  
**Release under repair:** `21865ef1802a18b535208415b9189577055e9352`  
**Environment:** `dealerflow-isolated-staging` / `org_demo_first_pilot_v1`  
**Result:** EMAIL PASSED — live SMS paused at the Twilio A2P/provider gate

## September 8 email closure

Email acceptance is closed. The live allowlisted Resend path passed, and the remaining eight historical queued messages are blocked by the staging recipient boundary exactly as designed. Those governed historical records are not defects and must not be rewritten or bypassed to manufacture a fully sent queue. Sender and recipient allowlists remain bare email addresses; the configured display-name From identity is parsed separately by the existing gateway.

This closes the email portion of PILOT-P1-01 without introducing a second provider route or changing application code. SMS remains paused at the external Twilio A2P/sender-enablement gate.

## September 8 Twilio activation

The isolated service now has the server-only Twilio credential, exact callback URL, sender allowlist, and controlled-recipient allowlist. The running container confirmed all four values are present with `APP_ENV=staging`. DealerFlow has exactly one active Twilio integration scoped to `Synthetic Main Rooftop`, and Twilio's primary inbound webhook now points to the one-time signed DealerFlow route. The pre-existing Make.com route remains configured as the backup handler rather than being deleted.

One new synthetic Customer/Lead was created through canonical lead intake using the controlled Twilio-verified recipient. Express written consent evidence was recorded from the owner's explicit staging-test authorization. One operational message was accepted by DealerFlow and queued by the canonical quiet-hours policy for the next permitted local window; no Twilio provider request occurred during this run.

Twilio reports the only available toll-free sender as `Messaging disabled` and requires registration resubmission. DealerFlow must not claim provider acceptance, delivery, callback, inbound, STOP, or post-STOP evidence until Twilio enables messaging. The later Resend acceptance result is recorded above.

## Live closure attempt

A second live preflight was performed against deployed commit `c058141c171405cfea2ac6701f41b71caec14e49` after the approved communications scope was confirmed. The running service and the Render service Environment page independently showed that the Twilio, Resend, callback, sender-allowlist, and recipient-allowlist variables listed below were not installed on `dealerflow-isolated-staging`. The active deployment remained healthy at the expected commit, but no provider configuration restart or newer deployment was pending.

The safety envelope therefore failed closed before any destination, message body, provider credential, or provider transaction was reached. No SMS, inbound webhook, STOP event, transactional email, or one-to-one customer email was attempted. P1-01 remains blocked at configuration and must not be represented as provider accepted.

## Existing architecture reused

DealerFlow already has one canonical communications authority: immutable consent events, durable SMS send attempts, Customer/Lead association, quiet hours, single-claim dispatch, Twilio gateway resolution from server-only credential references, signed webhook validation, tenant-routed provider inbox events, canonical Customer timeline communications, status reconciliation, delivery-unknown review, transactional account-email queueing, Resend delivery, bounded retries, structured aggregate telemetry, forced tenant RLS, and location/capability authorization.

No parallel messaging architecture was created.

## Initial configuration discovered

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

The following must be completed before live isolated-staging acceptance:

1. Complete or resubmit Twilio toll-free registration and wait for messaging to become enabled, or provision a separate approved staging sender without disrupting an existing production route.
2. After messaging is enabled, dispatch the already queued controlled message through the canonical job, then complete callback, retry, failure, inbound, replay, STOP, post-STOP, tenant, location, permission, privacy, and responsive acceptance.
3. Preserve the accepted Resend staging path and its exact bare-address allowlists; do not reopen the eight correctly blocked historical messages.

After Twilio enables the sender, rerun the real-provider SMS acceptance for outbound, inbound, STOP, post-STOP denial, callback progression/replay, provider failures, timeline projection, tenant/location/permission attacks, and all three viewports. The email portion is passed; only SMS remains externally gated.
