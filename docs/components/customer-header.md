# CustomerHeader Component Specification

# Purpose

The CustomerHeader is the reusable orientation and action surface at the top of every DealerFlow customer workspace. It gives dealership users a reliable summary of the customer relationship before they review deeper records, activity, or workflow detail.

The CustomerHeader exists to reduce searching, repeated navigation, and uncertainty. Within a few seconds, it should answer:

- Who is this customer?
- What is their current status?
- Who owns this customer?
- What should I do next?

The component is shared across customer contexts. It must remain independent of any single page, department, workflow, or data source.

# Responsibilities

### Customer Identity

Present the customer's preferred display name as the strongest element. Supporting identity may include a customer identifier, preferred name, organization, location, or customer type when those details prevent ambiguity. Identity must never depend on a photo.

### Status

Show one clear primary lifecycle or workflow status using consistent DealerFlow vocabulary. Supporting risk, urgency, or archive state may appear separately when operationally necessary. Status meaning must remain identical across the customer header, records, tables, and timeline.

### Ownership

Identify the primary owner and, when relevant, the owning team or department. Ownership should distinguish a confirmed assignment from unassigned, shared, or unavailable ownership.

### Buying Score

Summarize the customer's current purchase intent or readiness when available. The score requires a clear label, a consistent scale, freshness context, and an accessible explanation of what the value represents.

### Health Score

Summarize the overall health of the customer relationship when available. It should reflect an approved, explainable definition and must not imply certainty beyond the underlying evidence.

### Lead Score

Summarize lead quality or engagement when applicable. If the customer is not in a lead workflow, the score should be omitted rather than displayed as empty or irrelevant.

### Primary Contact Information

Present the preferred phone number and email address, with clear labels and availability. Contact details should support the related quick action without duplicating all secondary contact records.

### Primary Vehicle of Interest

Show the vehicle most relevant to the current customer journey. Prefer a concise year, make, and model identity plus a meaningful availability or relationship detail. Make uncertainty clear when the primary vehicle has not been confirmed.

### Next Appointment

Show the nearest relevant upcoming appointment, including date, time, appointment type, and status. Past, cancelled, or completed appointments do not qualify as the next appointment.

### Primary Quick Actions

Provide the small set of frequent actions that move the customer relationship forward. Actions must reflect availability, permissions, contact data, and customer state without overwhelming the header.

# Layout

### Desktop

Use a horizontal, multi-region composition with customer identity and primary status anchored at the leading edge. Scores, ownership, vehicle, contact, and appointment information should form a scannable middle region. Quick actions should remain grouped at the trailing edge or in a clearly separated action row when width is constrained.

The header may use multiple rows, but each row must have a clear purpose. Avoid a dashboard-like grid of unrelated cards. The identity and next action should remain visually dominant.

### Tablet

Use a two-region or stacked composition. Keep identity and status together, followed by the most important current context. Allow secondary information to wrap into a second row without changing its semantic order. Quick actions may remain visible as a compact group, with lower-priority actions moved into More.

### Mobile

Use a single-column composition. Present identity and status first, followed by a concise score summary, ownership, vehicle, contact, and next appointment. Keep the highest-value quick actions reachable without horizontal overflow. Secondary actions belong in More.

Mobile layout must not become a smaller desktop header. It should prioritize the current task, allow text to wrap, and preserve touch-target size.

# Information Hierarchy

Information appears in this order:

1. **Identity** — establishes who the workspace is about.
2. **Status** — communicates the customer's current operational state.
3. **AI Scores** — summarizes Buying, Health, and Lead scores when relevant and available.
4. **Ownership** — establishes accountability and the responsible person or team.
5. **Vehicle** — identifies the primary vehicle of interest.
6. **Contact** — surfaces the preferred ways to reach the customer.
7. **Quick Actions** — presents the immediate actions available to the user.

The visual layout may reflow across breakpoints, but the reading order and priority must remain stable. Next Appointment belongs with current operational context and should appear before quick actions when present.

# Quick Actions

### Call

Starts a call workflow using the preferred available phone number. If multiple numbers exist, the action may open a choice. If no callable number exists or permission is missing, explain why the action is unavailable.

### Text

Starts a text-message workflow using the preferred eligible mobile number. Consent, communication preference, and permission restrictions must be respected before composition or sending.

### Email

Starts an email workflow using the preferred valid email address. The action must not imply that a message was sent merely because composition opened.

### Appointment

Creates or manages an appointment in the customer's context. If a future appointment already exists, the action should make the existing state clear before creating another.

### Notes

Opens a focused note-entry workflow tied to the customer. Saving, cancellation, and error behavior must preserve user intent and prevent duplicate entries.

### More

Contains valid secondary or infrequent actions. More must not hide the primary next action, destructive state, or critical status. Menu contents should remain concise, grouped by purpose, and permission-aware.

Quick actions use specific accessible labels and a predictable order. Icon-only presentation is permitted only where meaning remains unambiguous and an accessible name is provided.

# Component States

### Loading

Preserve the header's expected structure so surrounding content does not shift. Represent identity, status, context, and actions with restrained placeholders. Do not show invented names, scores, vehicles, or contact information. Quick actions remain unavailable until their requirements are known.

### Empty

Use empty treatment for a valid customer record that lacks optional context. Keep known identity visible. Omit irrelevant scores and show concise missing-information guidance where adding the information is useful and permitted. The entire header should not become an empty state because one field is absent.

### Error

Preserve any trustworthy information already available. Identify which region failed, explain the effect in plain language, and offer recovery when possible. Do not replace the entire header with a generic error if identity and actions remain usable.

### Offline

Show that information may be stale and identify the last known update when available. Preserve safe read-only context and locally available actions. Prevent actions that require a connection from appearing successful, and explain their offline status.

### Permission Restricted

Show only information and actions the current user is allowed to access. Do not reveal restricted values through placeholders, tooltips, labels, accessible names, or layout gaps. When an expected action is unavailable, explain the restriction without exposing sensitive policy details.

### Archived Customer

Display archived state prominently and calmly. Reduce emphasis on ordinary outreach and editing actions. Provide only actions valid for archived records, such as viewing history or restoring access when permitted. Do not present archived customers as active opportunities.

# Accessibility

### Keyboard Support

Every action must be reachable and operable by keyboard in a logical order that follows the information hierarchy. Menus and composite controls must use established keyboard conventions. No information or action may require hover.

### Focus Behavior

Focus indicators must be visible, consistent, and unobscured. Opening an action menu or related workflow should place focus appropriately; closing it should return focus to the initiating control. Updates to scores or status must not unexpectedly move focus.

### Screen Reader Expectations

The header must have a meaningful region label. The customer name should act as the primary heading for the workspace when appropriate. Statuses, scores, ownership, contact information, vehicle, appointment, and actions require clear names and relationships. Visual separators and decorative icons should not create noise.

Asynchronous changes should be announced only when they affect the user's current task. Scores must expose their label, value, scale, and freshness or explanation where relevant.

### Touch Targets

Interactive targets should be at least 44 by 44 device-independent pixels when practical and remain separated enough to prevent accidental activation. Mobile actions must not depend on precise tapping.

### Color Independence

Status, scores, urgency, archive state, action availability, and errors must use text, icons, structure, or patterns in addition to color. All text, controls, and meaningful boundaries must meet the documented contrast requirements.

# Responsive Behavior

### Desktop

- Preserve a clear left-to-right scan from identity to actions.
- Keep frequently used quick actions visible.
- Use available width for operational context without stretching content into disconnected regions.
- Support long names, localized text, and text zoom without overlap.

### Tablet

- Reflow into two logical rows or regions before truncating meaningful content.
- Preserve identity, status, next appointment, and the most important actions.
- Move secondary actions into More when space becomes constrained.
- Avoid horizontal scrolling for the header.

### Mobile

- Use one semantic reading column.
- Preserve identity, status, owner, and next appointment near the top.
- Allow labels and values to wrap without reducing text below the design-system scale.
- Keep touch actions reachable and free from horizontal overflow.
- Collapse optional detail deliberately rather than hiding it without an access path.

Responsive behavior should be determined by content pressure, not a device name alone. The component must remain usable at intermediate widths and under 200% zoom.

# Design Principles

The CustomerHeader should feel:

- **Fast** — essential context is immediately scannable, and common actions are direct.
- **Confident** — identity, status, ownership, and system state are unambiguous.
- **Calm** — restrained surfaces, color, and density prevent unnecessary urgency.
- **Professional** — language, alignment, feedback, and interaction respect dealership expertise.
- **Operational** — every displayed element supports context, accountability, or action.

The component should feel premium through precision, not decoration. It should not resemble a promotional customer card, a collection of dashboard widgets, or a dealership website banner.

# Future Enhancements

Future versions may consider:

- Customer photo with a reliable non-photo fallback.
- Trade indicator and trade-vehicle summary.
- Lifetime value with an approved definition and source.
- VIP status with governed eligibility and language.
- Customer tags with controlled vocabulary and overflow behavior.
- Multiple vehicles with a clear primary relationship.
- Unread communications with source and count context.
- AI alerts with provenance, explanation, urgency, and human review.

These ideas are not v1 implementation requirements. Each requires product validation, data definitions, permission review, responsive behavior, and accessibility acceptance criteria before adoption.

# Acceptance Criteria

Implementation will be considered complete only when all applicable criteria are satisfied:

- The component is reusable across every customer workspace and contains no page-specific assumptions.
- The header answers who the customer is, their current status, who owns them, and the next best action within a five-second scan.
- Customer identity is the primary heading and remains usable without a photo.
- Status vocabulary matches the rest of DealerFlow.
- Buying, Health, and Lead scores appear only when applicable and expose a label, value, scale, and explanation or freshness context.
- Ownership clearly distinguishes assigned, unassigned, shared, and unavailable states.
- Primary vehicle, contact information, and next appointment are concise, accurate, and non-duplicative.
- Call, Text, Email, Appointment, Notes, and More actions follow availability, consent, permission, and customer-state rules.
- Information hierarchy and reading order remain consistent across desktop, tablet, mobile, intermediate widths, and 200% zoom.
- Loading, partial empty, error, offline, permission-restricted, and archived states are implemented without invented data or loss of trustworthy context.
- Every action is fully keyboard accessible with visible focus and correct focus restoration.
- Screen readers receive meaningful structure, labels, state, and score context without decorative noise.
- Touch targets, contrast, color independence, and reduced-motion behavior meet DealerFlow accessibility standards.
- Long names, missing optional values, multiple contact methods, and localized content do not break the layout.
- The component uses the DealerFlow Design System's existing tokens, component patterns, icon standards, and motion guidance.
- Placeholder or demonstration data remains outside the production component.
- Strict TypeScript validation, production build validation, configured lint, and existing relevant tests pass after implementation.
- The final implementation documentation records public behavior, supported states, assumptions, and any approved specification deviations.
