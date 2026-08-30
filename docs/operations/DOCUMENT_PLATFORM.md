# DealerFlow Document Platform

## Purpose

DealerFlow documents must be generated from canonical application data through an explicit, immutable template version. A document is evidence, not a screenshot of mutable UI state.

The intended lifecycle is:

Canonical data → versioned template → generated instance → human approval → PDF/export → delivery → signature → finalized storage → timeline, audit, and retention.

Only the parts described as implemented below may be represented as available product behavior.

## Existing authority reused

DealerFlow already has immutable, versioned Deal quotes with stored line items and totals. The protected quote print route reads that authority through `QuoteDocumentReader`, enforces `deal.read`, tenant membership, and location scope, applies tenant branding, excludes unnecessary customer contact data, and is marked `noindex`.

That route provides a browser print/save-to-PDF experience. It is not a durable server-generated PDF, delivery record, stored document, or electronic signature.

## Application-domain foundation

`lib/application/documents/document-platform.ts` establishes reusable contracts and pure policy for:

- global and tenant-owned immutable template versions;
- explicit required and optional data bindings;
- deterministic rendering that never invents missing values;
- safe value escaping and rejection of executable template markup;
- review, approval, sent, finalized, and voided document states;
- electronic-signature states and a provider-neutral boundary;
- tenant-configurable Deal packet completeness;
- finalized PDF storage references; and
- predictable, sanitized export filenames.

This layer contains no React UI, persistence adapter, PDF engine, cloud-storage implementation, email delivery, or provider credentials.

## Template governance

A template version is immutable after use. Editing creates a new version rather than changing historical output. Global templates cannot carry a tenant owner. Tenant templates must carry exactly one organization owner.

Every placeholder must be declared as required or optional. Required data that is absent produces `needs-information`; it must never be replaced with a plausible value. Missing optional data is blank and produces a warning.

The initial renderer recognizes only simple dotted placeholders such as `{{customer.name}}`. It does not execute expressions, scripts, arbitrary HTML event handlers, or dynamic code. Bound values are escaped before insertion. A future template editor must use the same validator before review or activation.

Activation, rollback, approval ownership, and template release history require persistent authority before an administration UI is enabled.

## Document lifecycle

Allowed document transitions are deliberately narrow:

- Draft may move to needs information, ready for review, or voided.
- Needs information may return to draft, move to ready for review, or be voided.
- Ready for review may return to draft, be approved, or be voided.
- Approved may be sent, finalized, or voided.
- Sent may be finalized or voided.
- Finalized and voided documents are immutable terminal records.

The policy does not itself grant access. Any persistent command must additionally enforce tenant, rooftop, capability, and record access at both application and database boundaries and record actor, timestamp, correlation, and source evidence.

## Deal packets

Packet requirements are configuration input, not universal hardcoded dealership rules. A packet is complete only when every configured required item has a finalized document. Optional documents do not block completion. Requirements may vary by tenant, location, Deal type, jurisdiction, and program after those authorities are modeled.

The current implementation calculates completeness only. It does not claim that legal, lender, OEM, state, or tax forms are complete or approved.

## PDFs, storage, and export

The current quote route supports browser print/save-to-PDF only. DealerFlow does not yet have a canonical server PDF generator or finalized-document repository.

A future implementation must:

- render from a saved generated-document version rather than current mutable data;
- produce deterministic server-side output with checksums;
- store private objects behind tenant- and record-scoped authorization;
- use short-lived download authorization and private cache policy;
- retain template version, source snapshot, generator version, checksum, and actor evidence;
- distinguish generated, delivered, signed, superseded, voided, and deleted artifacts; and
- verify recovery, retention, legal hold, and deletion behavior.

Google Drive may be an optional export destination. It must not become the canonical document store or authorization system.

## Electronic-signature readiness

The domain defines a provider-neutral signature request, envelope, lifecycle, and explicit unconfigured provider. No real electronic-signature provider is integrated or claimed.

Before enabling signature actions, a provider adapter must support tenant-scoped credential resolution, idempotent envelope creation, authenticated and replay-safe webhooks, monotonic status transitions, signer and document-version binding, timestamped provider evidence, decline and expiry handling, void controls, and retrieval of a verified completed artifact. Signed documents are immutable.

DealerFlow must display evidence and provider status without claiming legal enforceability. Legal and compliance review remains an owner responsibility.

## Delivery and audit

“Sent” must eventually require durable delivery evidence linked to an exact document version, recipient, channel, provider identifier, actor, and timestamp. A rendered preview or opened mail client is not delivery.

Document creation, missing-data resolution, review, approval, send, signature events, finalization, download, export, void, retention, legal hold, and deletion must be auditable before their corresponding controls are enabled.

## Security and privacy

Generated documents may contain customer, financial, and Deal data. Implementations must minimize included fields, fail closed on authorization ambiguity, prevent cross-tenant object references, avoid sensitive identifiers in filenames and logs, use private storage, and never pass document content to unrelated providers.

Public links, anonymous signature access, and externally shareable documents require separately reviewed token, expiry, revocation, abuse, and audit designs.

## Deferred work

The following are intentionally deferred rather than represented by stubs in product UI:

- persistent template, template-version, generated-document, packet, delivery, signature, and retention schemas;
- tenant template administration and test-data preview;
- canonical customer summaries, billing statements, proposals, pilot reviews, and complete Deal packet definitions;
- server-side PDF generation and layout acceptance;
- private document storage and retrieval;
- email or portal delivery with verified outcomes;
- a real electronic-signature provider and webhook adapter;
- finalized-document search, retention, legal hold, and deletion workflows;
- document timeline events, approval queues, metrics, and reporting; and
- jurisdiction-specific legal, lender, tax, OEM, warranty, and compliance forms.

These items require persistent authority, access policy, provider configuration, legal review where applicable, tests, and staging evidence before release.
