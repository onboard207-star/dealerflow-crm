# DealerFlow Enterprise Trust, Privacy, and Procurement Readiness

## Current recommendation

**ENTERPRISE TRUST: NO-GO for customer assurance claims beyond the scoped statements in the control registry.**

DealerFlow has repository-tested security controls, but it has not completed production backup restoration, external alert escalation, recurring privileged-access review, an independent penetration test, or a certification/attestation. Controls are not certifications, framework mappings are organizational aids, and internal automated tests are not independent assessment.

## Trust authorities

`config/trust-control-registry.json` is the versioned control inventory. `config/trust-evidence-registry.json` stores evidence separately, including verification date, maximum age, source, visibility, and independent-assessment status. `pnpm trust:check` rejects stale evidence represented as current, tested controls without current proof, unsupported compliance language, or certification flags without authorized independent evidence.

Current artifact visibility levels are Public, Qualified Prospect, Customer Admin Only, Internal Confidential, and Security Restricted. The repository registry contains metadata and safe references only—not secrets, full penetration details, raw logs, customer PII, contracts, insurance documents, or restricted assessment artifacts.

## Verified scope

Repository tests support scoped statements about tenant isolation/RLS, capability and location authorization, Twilio callback signatures, server configuration/secrets boundaries, telemetry filtering, invitation-bound signup, bounded tenant-aware AI recommendations, and selected accessibility behavior. Each statement is narrower than a general compliance or production-security claim.

Authentication remains incomplete for enterprise assurance: formal MFA, SSO/SCIM, lockout/load evidence, privileged access governance, and support elevation do not exist as verified enterprise controls. Accessibility testing is scoped and is not formal WCAG conformance.

## Open trust blockers

- Capture production backup scope/freshness and complete an isolated timed restore drill.
- Configure and exercise external alert receipt, ownership, acknowledgement, and escalation.
- Create a canonical privileged/break-glass access registry and recurring access review.
- Establish approved retention, export/privacy-request, deletion/legal-hold, and offboarding authorities before destructive workflows.
- Inventory actual subprocessors, data categories, regions, contract/DPA state, review owners, and disclosure status without inferring provider certifications.
- Establish vulnerability intake, dependency/SBOM review, exception/risk approval, incident tabletop evidence, and an independent penetration-test program.
- Verify production encryption, hosting regions, backup behavior, provider retention, and AI-provider data handling from authoritative provider/configuration evidence.

## Customer and procurement boundary

Questionnaire answers may be auto-filled only from current, unambiguous, approved evidence. Everything else is Needs Review. AI may summarize and draft but may not approve legal, privacy, compliance, insurance, residency, SLA, or certification commitments.

A future trust package may include approved architecture, security/privacy, subprocessor, BCP/DR, AI, and accessibility summaries. Security-restricted evidence must use controlled access and may never be published from repository metadata alone.

DealerFlow currently claims no SOC 2, ISO 27001, HIPAA, PCI DSS, GDPR, CCPA, penetration-test, data-residency, or formal WCAG status. Legal applicability and compliance conclusions require authorized counsel or independent assessment.
