# DealerFlow Learning System

## Purpose

DealerFlow learning should help each employee understand the product, their role, the next workflow to learn, the current procedure, and where to get help. It must use one governed authority rather than unrelated tooltips, PDFs, release notes, and support scripts.

## Existing architecture reused

The foundation reuses active organization memberships, canonical role keys, capability grants, feature-aware navigation, tenant identity, release identity, and the implementation project's training launch gate. Roles influence content presentation but never expand data authorization.

No pre-existing training, help, knowledge, assignment, completion, or support-request persistence was found. This batch therefore does not create a competing database authority.

## Current implementation

`lib/application/learning/learning-center.ts` defines:

- versioned courses and modules;
- dealer and internal audiences;
- published, review, draft, and retired content states;
- role-specific published and draft training tracks;
- global and future tenant-scoped knowledge articles;
- role and capability-aware knowledge visibility;
- keyword, category, workspace, and feature filtering;
- deterministic assignment identity and duplicate removal;
- evidence-based completion, overdue, and waiver evaluation;
- first-login orientation that does not trap users;
- workspace-specific help context;
- role-, capability-, tenant-, and release-targeted education; and
- approved-article grounding payloads for a future product-help AI.

The authenticated Training Center at `/organizations/{organizationId}/training` displays published role tracks, approved visible articles, contextual help summaries, Quick Start guidance, and relevant What's New items. It is responsive and uses the existing tenant shell and semantic design tokens.

## Role tracks

Published tracks exist for Salesperson, BDC, Sales Manager, GSM, GM/Owner, Finance/Controller, Inventory, Reception, Dealer Administration, and internal Platform Administration.

Recon, Service Advisor, and Service Manager tracks remain draft because their authoritative application workflows are not available. Draft tracks are never assigned or shown as current training.

Multi-role users receive the union of published tracks for their active role keys. Identical assignments are deduplicated by organization, user, course, and course version rather than recreated at login.

## Knowledge governance

Published articles require a stable identifier, slug, version, category, role visibility, capability visibility, workspace, feature, audience, locale, owner, and review dates. Global content cannot carry a tenant owner. Tenant content must carry exactly one organization owner.

Executable scripts, JavaScript URLs, and inline event handlers are invalid content. A future authoring UI must use constrained Markdown or another sanitized representation and must validate content before review or publication.

Retired and draft content is excluded from search and grounding. Internal DealerFlow guidance is unavailable to dealer audiences. Sensitive Finance and administration guidance requires both an eligible role and the relevant capability.

## Completion and acknowledgments

Opening a course or page is not completion evidence. The domain accepts explicit confirmation, meaningful adoption evidence, or manager verification according to the module rule. Evidence is bound to the course version. Important acknowledgments require separate persistent user, timestamp, and version evidence.

The current Training Center intentionally states that completion and acknowledgments are not persisted. It does not render fabricated progress.

## Contextual help and support

Help contexts currently cover Customer, Inventory, AI, and Deal/document workspaces. Each context identifies its purpose, common actions, related visible articles, related courses, and safe support metadata.

Future support escalation may prefill tenant, user, role, workspace, route, and release. It must not attach customer or Deal PII automatically. No canonical support-request store or monitored destination exists, so the Training Center visibly marks submission unavailable.

Access-denied help should explain that a feature is unavailable for the current role and direct the user to a dealer administrator without exposing hidden capability details.

## Product-help AI

The grounding builder returns only current, published, visible article identifiers, versions, titles, and bounded excerpts. A future product-help AI must use a separate product-knowledge context from customer or Deal recommendation context, cite relevant content, and refuse when approved knowledge is insufficient.

No product-help AI provider call or answer UI is implemented in this batch.

## Release education

What's New items are filtered by publication state, tenant targeting, role, and capability. Major coaching must be dismissible or completeable only after durable user evidence exists. Routine release notes should not require acknowledgment.

## Privacy and analytics

Meaningful future adoption events may include first Customer Workspace use, first appointment, first AI summary, first inventory photo workflow, or first manager brief. DealerFlow must not treat every click as adoption or use training analytics for punitive employee scoring without approved policy.

Failed searches, article helpfulness, course completion, and support-after-training require privacy-minimized durable events before reporting is enabled.

## Deferred work

The following remain deferred until persistence, authorization, and operational ownership are designed and verified:

- training content, version, assignment, completion, acknowledgment, feedback, adoption, and failed-search tables;
- tenant-authored content and content administration;
- durable first-login state, resume position, progress dashboards, and launch-gate aggregation;
- manager assignment, due dates, waivers, team reporting, and certifications;
- full lessons, screenshots, videos, Drive publication, and localization;
- contextual Help drawers embedded into every workspace;
- feature coaching dismissal/completion;
- support-request submission and monitored escalation;
- AI product-help provider integration;
- training analytics and internal content administration; and
- staging users with independently authenticated role acceptance evidence.

Training remains a launch blocker until required pilot content, assignments, evidence, support ownership, and dealership acceptance are verified.
