# CustomerSnapshot Component Specification

# Purpose

The CustomerSnapshot is a concise, high-value summary of the context a dealership employee should understand before interacting with a customer.

It answers one question:

> What do I need to know before I engage this customer?

The CustomerSnapshot complements three other workspace surfaces:

- **CustomerHeader** answers “Who is this?” and owns primary identity, current status, ownership, and immediate contact actions.
- **AICommandCenter** answers “What should I do?” and owns explainable recommendations, confidence, evidence, risks, and opportunities.
- **CustomerTimeline** answers “What happened?” and owns chronological activity and record history.

The Snapshot provides context, not history. It should prepare the user for a useful, informed interaction without reproducing the header, recommending an action, or becoming a condensed timeline.

# Responsibilities

The component is responsible for:

- Summarizing the most relevant known facts about the customer and their current journey.
- Grouping related facts into a predictable, quickly scannable structure.
- Distinguishing confirmed records, customer-stated preferences, and derived intelligence.
- Showing useful freshness and source context when a fact may change or requires explanation.
- Omitting irrelevant fields instead of filling the surface with empty labels.
- Communicating missing, stale, restricted, or unavailable context without inventing data.
- Remaining concise enough to understand in under 30 seconds.
- Supporting typed, workspace-neutral information groups that can be reused beyond Customer workspaces.

The component must not own primary customer identity, status, ownership, quick actions, AI recommendations, or chronological activity. A small amount of orienting context may be repeated only when the Snapshot is used independently and the repetition prevents ambiguity.

# Information Hierarchy

Information appears in this order:

1. **Identity context** — customer classification and relationship context not already dominant in CustomerHeader.
2. **Vehicle Interest** — the vehicles and trade information relevant to the current journey.
3. **Buying Journey** — the customer's current stage, intent, timeframe, finance, and appointment context.
4. **Communication** — how and when the customer prefers to engage, including consent.
5. **Customer Intelligence** — explainable behavioral or preference patterns supported by evidence.
6. **Important Notes** — a short set of engagement-critical facts that do not fit the preceding groups.

This order remains stable across breakpoints. A group may be omitted when it contains no relevant, permitted information. The omission must not reorder the remaining groups or leave unexplained visual gaps.

The Snapshot should use plain-language labels and concise values. Long explanations, activity logs, recommendation reasoning, and secondary metadata belong in their source records or neighboring components.

# Layout

Use one coherent summary surface divided into clearly labeled information groups. Groups may use compact definition lists, fact rows, or restrained sections, but the component must not resemble a dashboard of independent metric cards.

### Desktop

Use available width to present two or three balanced columns while preserving semantic order. Vehicle Interest and Buying Journey may receive more space when their contents are denser. Communication, Customer Intelligence, and Important Notes should remain visually connected to the same summary surface.

Columns must not cause a later group to be announced before an earlier group. Values should align consistently without stretching short facts across excessive horizontal space.

### Tablet

Reflow into one or two columns based on content pressure. Keep each information group intact when practical, and avoid splitting a short group across columns. Preserve full labels, consent states, evidence cues, and important notes before truncating optional detail.

### Mobile

Use one semantic column in the documented information order. Each group should be independently scannable, and labels and values must wrap naturally. Do not use horizontal scrolling, compressed multi-column fact grids, hover-only explanations, or collapsed content that hides engagement-critical facts.

# Identity

Identity provides relationship context rather than repeating the customer's name, primary status, or owner already shown in CustomerHeader.

Supported facts may include:

- **Customer Type** — for example, individual, household, business, returning customer, or service customer, using governed terminology.
- **Lead Source** — the approved source that created or materially originated the current relationship.
- **Location** — a useful customer, dealership, or market location when it affects engagement.
- **Assigned Salesperson** — only when the Snapshot is displayed without CustomerHeader or when assignment context is necessary to interpret another fact.

Identity facts must use confirmed records and clear labels. Avoid inferred demographic categories, unnecessary personal details, duplicated contact information, and labels that do not affect the employee's understanding of the relationship.

# Vehicle Interest

Vehicle Interest summarizes the customer's active vehicle context.

It may include:

- **Primary Vehicle** — the most relevant confirmed vehicle, with year, make, model, trim, and identifier only when useful.
- **Alternative Vehicles** — a concise set of credible alternatives the customer has expressed interest in or reviewed.
- **Trade Vehicle** — the customer's known trade, clearly distinguished from vehicles of interest.
- **Trade Equity** — a confirmed or explicitly estimated equity state, including freshness and qualification when applicable.
- **Vehicle Status** — meaningful availability or relationship status, such as in stock, incoming, sold, unavailable, or preference not yet confirmed.

Do not turn this section into an inventory record, appraisal worksheet, or vehicle-comparison tool. Show only the details needed to prepare for engagement. Estimated values must be labeled as estimates and must not appear current when their source is stale.

# Buying Journey

Buying Journey explains where the customer is in the current retail process without recommending what the employee should do next.

It may include:

- **Current Stage** — the approved journey or workflow stage.
- **Purchase Intent** — a customer-stated or evidence-supported description of intent.
- **Estimated Timeframe** — the customer's stated timeframe or a clearly labeled, explainable estimate.
- **Finance Status** — concise, permission-aware context such as not discussed, considering financing, application started, or lender review in progress.
- **Appointment Status** — relevant appointment context without duplicating the complete appointment details owned by CustomerHeader or the history owned by CustomerTimeline.

Stage and status terminology must remain consistent with the rest of DealerFlow. Finance information must follow permission and sensitivity rules. The component must not imply approval, affordability, certainty, or purchase commitment when the record does not support it.

# Communication

Communication prepares the employee to engage the customer respectfully and through an appropriate channel.

It may include:

- **Preferred Contact Method** — the customer's confirmed preferred eligible channel.
- **Best Contact Time** — a customer-stated window or an evidence-based pattern with its basis clearly identified.
- **Last Contact** — a concise timestamp and channel for orientation, not a transcript or activity-history substitute.
- **Response Pattern** — a short, explainable observation such as “usually responds to text within one business day.”
- **Communication Consent** — the current consent or eligibility state for each relevant channel.

Consent and channel eligibility must never be inferred from preference or prior activity. Restricted channels must be clearly identified through text rather than color alone. The Snapshot displays communication context; it does not initiate or imply completion of communication actions.

# Customer Intelligence

Customer Intelligence summarizes useful patterns that can help an employee communicate more effectively. All intelligence must be evidence-based, explainable, appropriately fresh, and presented as guidance rather than fact when uncertainty exists.

Supported intelligence may include:

- **Buying Style** — for example, research-oriented or comparison-focused, when supported by meaningful observed behavior.
- **Decision Speed** — a qualified pattern based on sufficient prior or current journey evidence.
- **Price Sensitivity** — a carefully worded indication based on explicit budget statements, pricing questions, or documented preferences.
- **Brand Loyalty** — an observed relationship to a brand supported by ownership, service, or purchase records.
- **Competitor Shopping** — customer-stated or otherwise verified comparison activity.

Each intelligence item should provide:

- A concise label and value or approved qualitative state.
- A short explanation of what the statement means.
- The strongest supporting evidence or a path to it.
- Freshness or evaluation period when the interpretation may change.
- An uncertainty state when evidence is limited or conflicting.

Do not expose chain-of-thought, hidden reasoning, prompts, private model implementation details, or sensitive inferences. Do not infer protected characteristics, emotional states, financial capacity, or personal circumstances. If the evidence threshold is not met, omit the item or show an approved “Insufficient evidence” state.

# Important Notes

Important Notes highlights a small number of confirmed facts that should be known before engagement and are not represented more clearly elsewhere.

Examples include:

- Bringing spouse.
- Needs AWD.
- Wants photos.
- Interested in warranty.
- Requires financing.

Notes must be concise, current, relevant to the interaction, and attributable to an approved source. Prefer customer-stated language where appropriate. Show when a note was added or verified if age changes its meaning.

This section must not become a full note history, free-form dumping ground, private commentary surface, or substitute for CustomerTimeline. Limit visible content to the highest-value facts, and provide a future path to the source record rather than copying lengthy notes. Sensitive, outdated, duplicative, or permission-restricted notes must not appear.

# Accessibility

- Give the component a meaningful region name and use semantic headings for each information group.
- Use definition lists or equivalent semantic relationships for fact labels and values.
- Preserve a logical reading order that matches the visual hierarchy at every breakpoint.
- Communicate status, consent, uncertainty, freshness, availability, and errors with text rather than color, position, or icons alone.
- Ensure links, disclosures, source references, and recovery controls are keyboard accessible with visible, unobscured focus states.
- Do not require hover to reveal explanations, evidence, or restrictions.
- Hide decorative icons from assistive technology and give meaningful controls explicit accessible names.
- Announce asynchronous changes only when they materially affect the user's current understanding or task.
- Maintain documented contrast requirements and touch targets of at least 44 by 44 device-independent pixels when practical.
- Support text resizing and 200% zoom without clipped facts, overlapping labels, lost content, or horizontal page scrolling.

# Responsive Behavior

### Desktop

- Use two or three logical columns without changing semantic reading order.
- Keep labels, values, evidence cues, and freshness context visually associated.
- Avoid excessively wide lines and disconnected islands of information.
- Support long customer-provided values and localized text without overlap.

### Tablet

- Reflow groups before truncating meaningful content.
- Prefer two columns only when each group remains coherent and readable.
- Preserve communication consent, important notes, and intelligence explanations.
- Avoid horizontal scrolling and device-specific assumptions.

### Mobile

- Use one semantic column in the documented hierarchy.
- Allow labels and values to wrap at natural boundaries.
- Keep important notes and consent states directly available without hover.
- Avoid dense tables, narrow side-by-side facts, and horizontal carousels.
- Preserve comfortable touch targets for any disclosure or source controls.

Responsive behavior should be driven by content pressure rather than device labels. The component must remain usable at intermediate widths, with long content, localized text, and at 200% zoom.

# Component States

### Ready

Show only relevant, permitted, and sufficiently trustworthy facts. Distinguish confirmed records from estimates or derived intelligence. Omit absent optional groups and keep the remaining hierarchy intact.

### Loading

Preserve the expected group structure with restrained placeholders to reduce layout shift. Do not show sample customer facts, intelligence, vehicles, notes, or consent values while real context is loading. Loading treatments must honor reduced-motion preferences.

### Empty

Use the Empty state when no useful Snapshot context is available, not when one optional field is missing. Explain that no additional engagement context is recorded and, when appropriate, provide a permission-aware path to the underlying records. Do not invent generic guidance or duplicate CustomerHeader content to fill space.

### Error

Preserve trustworthy groups that loaded successfully. Identify which information could not be loaded, explain the effect in plain language, and provide recovery when possible. Do not replace the whole Snapshot with a generic error when useful context remains available, and do not present failed derived intelligence as current.

### Offline

Preserve the last available read-only Snapshot when permitted. Clearly identify stale groups, show the last successful update when known, and distinguish locally available facts from information that could not be refreshed. Do not imply that consent, vehicle status, finance status, or intelligence remains current without confirmation.

### Permission Restricted

Show only groups and facts the user may access. Do not reveal restricted content through placeholders, counts, headings, accessible names, tooltips, source labels, or unexplained layout gaps. If the entire Snapshot is restricted, explain the restriction without exposing policy details or sensitive values.

# Cross-Workspace Architecture

The CustomerSnapshot should be designed as an instance of a reusable information-summary pattern rather than a one-off customer page layout.

Future workspace contexts include:

- Customer
- Inventory
- Service
- Finance
- Management

The shared architecture should support typed sections, labeled facts, source and freshness metadata, permission states, and optional evidence without hardcoding customer-only field names into the underlying composition. Workspace-specific schemas determine which sections and facts are valid; they must not create duplicated versions of the same visual pattern.

Every workspace summary should preserve the same principles:

- One concise orientation surface.
- Predictable information hierarchy.
- Confirmed facts clearly separated from estimates and derived intelligence.
- Permission-aware and freshness-aware content.
- Responsive and accessible composition.
- No duplication of the workspace's header, recommendation surface, or timeline.

# Future Enhancements

Future versions may consider:

- AI-generated summaries with evidence, freshness, and human-readable uncertainty.
- Smart highlights based on approved, explainable relevance rules.
- Favorite facts selected by the user.
- Manager notes with clear authorship and permissions.
- Team annotations with audit and visibility controls.
- Pinned facts with ownership and expiration behavior.
- Auto-generated customer profiles with governed evidence requirements.
- Cross-workspace summaries that preserve source context and permissions.

These are future functionality only. They are not implementation requirements for the initial component. Each enhancement requires product validation, typed data contracts, governance, permission review, responsive behavior, and accessibility acceptance criteria before adoption.

# Acceptance Criteria

The implementation is complete when:

- A dealership employee can understand the customer context in under 30 seconds.
- Information is grouped logically and presented in the documented hierarchy.
- The component does not duplicate primary identity, status, ownership, or actions from CustomerHeader.
- The component does not duplicate recommendations, confidence, or recommendation evidence from AICommandCenter.
- The component does not become a chronological history or duplicate CustomerTimeline.
- The component remains concise and scannable with realistic content and long values.
- All Customer Intelligence is evidence-based, explainable, appropriately qualified, and free of chain-of-thought.
- Communication consent remains explicit and independent from preference or previous activity.
- The component supports reusable, strict typed data contracts without customer-only assumptions in the shared architecture.
- Placeholder and demonstration data remains outside the production component.
- Responsive behavior works across desktop, tablet, mobile, intermediate widths, and 200% zoom.
- Ready, Loading, Empty, Error, Offline, and Permission Restricted states are complete.
- Partial errors and offline conditions preserve trustworthy information while clearly identifying stale or unavailable content.
- Restricted information is not exposed visually or to assistive technology.
- Keyboard operation, semantic structure, visible focus, text alternatives, contrast, and touch targets satisfy the DealerFlow accessibility standards.
- The design follows the DealerFlow Product Guide and Design System.
- No backend, API, Airtable, authentication, or business-data integration is introduced by the component specification.
