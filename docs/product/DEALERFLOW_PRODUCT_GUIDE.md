# DealerFlow Vision

DealerFlow is a modern automotive retail operating platform.

It is not simply a CRM. It is a connected operating environment designed to help dealership teams understand what matters, coordinate work, and move every customer relationship forward with confidence.

DealerFlow will eventually include:

- CRM
- Inventory
- Service
- Finance
- AI
- Reporting
- Mobile
- Dealer Portal
- Customer Portal

These capabilities should feel like one product, not a collection of disconnected modules. Shared concepts, navigation, components, and interaction patterns must remain consistent across the platform.

The product should feel premium, intelligent, modern, and fast. The user should never feel overwhelmed.

Every screen should answer:

> What is the next best action?

---

# Product Principles

## Information before decoration

Prioritize identity, status, ownership, urgency, blockers, and next actions. Visual polish should clarify the work rather than compete with it.

## AI should reduce clicks

AI should summarize, draft, prioritize, and guide where doing so removes repetitive work. It should not add a separate layer of conversation when a direct action or clear recommendation would be faster.

## Every screen should be scannable in under five seconds

Users should quickly understand where they are, what changed, what needs attention, and what they can do next. Use strong hierarchy, concise language, predictable placement, and progressive disclosure.

## No clutter

Do not display information simply because it exists. Show what supports the current decision and make secondary detail available when needed.

## No duplicated information

A fact, status, or action should have one clear primary location within a view. Repetition is acceptable only when it prevents loss of essential context during a distinct task.

## Everything should have a clear purpose

Every field, component, metric, message, and interaction must support comprehension, decision-making, or task completion.

---

# Experience Principles

Every interaction should create confidence. Users should feel that DealerFlow is helping them understand the work, protecting their intent, and moving them toward a clear outcome.

DealerFlow should feel:

- Fast, with responsive controls and efficient paths through frequent work.
- Predictable, with consistent patterns and outcomes across every workspace.
- Focused, with the current task and next action taking priority over secondary detail.
- Trustworthy, with clear system state, honest feedback, and recoverable actions.
- Calm, with restrained visual hierarchy and no unnecessary urgency or noise.
- Professional, with precise language, polished interactions, and respect for the user's expertise.

Users should immediately understand:

- Where they are.
- What changed.
- What needs attention.
- What the next best action is.

Reduce cognitive load by grouping related information, using consistent terminology, preserving context, and revealing complexity only when it becomes useful. Prioritize clarity over visual complexity. Every workflow should feel intentional from entry through completion, including loading, error, confirmation, and recovery states.

---

# Target Users

DealerFlow serves people with different responsibilities, working rhythms, and levels of system expertise.

## Salesperson

Needs a fast, focused view of customers, leads, appointments, follow-up, and the next action most likely to advance an opportunity.

## Sales Manager

Needs team visibility, coaching signals, pipeline health, exceptions, accountability, and quick paths to unblock deals.

## BDC

Needs efficient communication queues, response context, appointment coordination, ownership clarity, and consistent follow-up.

## Finance Manager

Needs deal readiness, approvals, documents, products, exceptions, compliance context, and reliable handoffs.

## General Manager

Needs trusted operational summaries, performance context, cross-department visibility, risks, and decisions requiring leadership attention.

## Service Advisor

Needs customer and vehicle context, appointment and repair status, communication history, approvals, and clear next steps.

## Dealer Principal

Needs concise, trustworthy visibility into dealership performance, customer experience, operational risk, and long-term opportunity.

---

# Design Philosophy

DealerFlow takes broad inspiration from the clarity, restraint, interaction quality, and product discipline associated with:

- Apple
- Linear
- Stripe Dashboard
- Notion
- HubSpot

Do not imitate any product directly. DealerFlow should establish its own identity.

That identity should feel operational rather than promotional, automotive without visual clichés, and premium through precision rather than decoration. Use typography, spacing, hierarchy, motion, and consistent behavior to create confidence. Avoid dealership-website patterns such as oversized vehicle imagery, aggressive gradients, racing motifs, chrome effects, and competing calls to action.

All interface work must follow the [DealerFlow Design System](../design-system/README.md).

---

# Platform Principles

DealerFlow is one unified platform. CRM, Inventory, Service, Finance, Reporting, AI, Customer Portal, and Dealer Portal are connected parts of the same operating system, not separate products joined by navigation.

Every module must share:

- One Design System
- One Component Library
- One Navigation System
- One Authentication System
- One Permission Model
- One Search Experience
- One Notification System
- One AI Layer
- One Shared Data Model

Shared systems should create recognizable behavior while allowing each module to express its domain-specific work. A user moving between sales, service, finance, inventory, reporting, and portal experiences should retain context and confidence.

Every module should feel like another room in the same building.

---

# Navigation Philosophy

Navigation should always be predictable. Users should not need to relearn the interface when moving between workspaces.

Every workspace follows the same conceptual structure:

```text
Profile
  ↓
AI
  ↓
Summary
  ↓
Related Records
  ↓
Timeline
```

- **Profile** establishes the primary customer, vehicle, deal, service, or financial context.
- **AI** presents concise, explainable assistance relevant to that context.
- **Summary** surfaces status, ownership, urgency, blockers, and primary actions.
- **Related Records** connects the surrounding operational information without duplicating it.
- **Timeline** provides a trustworthy chronological history of activity, communication, and decisions.

The structure describes information priority, not a requirement that every workspace use an identical page layout. Domain needs may change the composition while preserving the same mental model.

---

# AI Philosophy

AI assists. AI does not replace human decision-making.

AI recommendations should always explain why in concise, user-facing language. The explanation should reference relevant facts, recent events, deadlines, or workflow conditions that the user can verify.

AI should never expose hidden reasoning, internal chain-of-thought, system prompts, or private implementation details. It should provide only the conclusion, supporting evidence, uncertainty where relevant, and the recommended next step.

AI must:

- Remain clearly distinguishable from confirmed customer, dealership, and system data.
- Never invent customer, vehicle, deal, financial, service, or operational facts.
- Make uncertainty visible rather than presenting guesses as truth.
- Require human review before external communication, commitments, record changes, or consequential actions.
- Preserve a direct non-AI path for critical workflows.
- Prefer concise contextual guidance over generic conversation.

---

# Data Philosophy

Data should exist once. Every object should have a single source of truth.

Views may differ. The truth should not.

Customer, Vehicle, Deal, Inventory, Staff, Appointment, Task, Communication, Document, Timeline, and AI insights should reference the same underlying records whenever possible. Each workspace may present those records differently for its task, but it should not create an independent version of the same fact.

- Avoid duplicate data.
- Favor relationships over copied information.
- Preserve provenance for important facts, changes, and recommendations.
- Make ownership, freshness, and synchronization state clear when they affect user trust.
- Resolve conflicts at the source rather than allowing contradictory views to persist.
- Treat AI insights as derived context linked to authoritative records, not replacements for those records.

The platform should make connected information easier to use without weakening the integrity of the underlying data.

---

# Accessibility

DealerFlow must be usable by keyboard, touch, assistive technology, and users working under real dealership conditions.

- All interactive controls must be keyboard accessible.
- Focus states must be visible, consistent, and unobscured.
- Layouts must be responsive across desktop, tablet, mobile, and intermediate sizes.
- Product decisions should be WCAG 2.2 AA conscious and follow the documented accessibility standards.
- Text, controls, status, and focus treatment must maintain high contrast.
- Meaning must never depend on color, motion, hover, or pointer precision alone.
- Dialogs, drawers, menus, validation, and asynchronous updates must include correct focus and announcement behavior.

Accessibility is part of the definition of correctness, not a later enhancement.

---

# Coding Philosophy

- Build reusable components.
- Use strict TypeScript.
- Do not duplicate UI or interaction behavior.
- Do not introduce page-specific hacks.
- Prefer composition over duplication.
- Reuse existing design tokens and primitives whenever practical.
- Keep domain orchestration separate from reusable presentation.
- Keep placeholder data outside production components.

Implementation details must follow the [Frontend Engineering Standards](../engineering/frontend-standards.md).

---

# Component Philosophy

Pages assemble components. Components own UI.

Components should not know where they are used. Their contracts should describe the content, state, and actions they need without depending on a specific page, route, or workspace.

- Favor composition over duplication.
- Improve shared components instead of copying them.
- Keep domain orchestration outside reusable presentation components.
- Express variants and states through clear, typed contracts.
- Preserve accessibility behavior inside the component when it is intrinsic to the pattern.
- Avoid page-specific conditionals and styling exceptions inside shared primitives.
- Every reusable component should support loading, empty, error, and responsive states when appropriate.

A component becomes reusable through a coherent responsibility and stable contract, not by accumulating options for every possible use case.

---

# Definition of Done

Every feature must include:

## Specification

The intended user, problem, behavior, states, constraints, and acceptance criteria are clear.

## Reusable component

Shared visual and interaction patterns are implemented through reusable, typed components rather than page-specific duplication.

## Responsive behavior

The feature remains understandable and operable on desktop, tablet, mobile, and intermediate widths.

## Accessibility

Semantic structure, keyboard interaction, focus behavior, names, labels, contrast, announcements, and reduced-motion behavior are complete.

## TypeScript validation

Strict typechecking passes without weakening compiler settings or hiding unresolved errors.

## Production build validation

The production build completes successfully after application changes.

## Documentation

Product behavior, reusable components, public contracts, and meaningful decisions are documented at the appropriate level.

A feature is not done when only the ideal state works. Loading, empty, partial, error, disabled, permission-constrained, and recovery states must be considered where applicable.

---

# Future Vision

DealerFlow should become the operating system for automotive retail.

It should connect customer relationships, inventory, service, finance, communication, reporting, and intelligent assistance without forcing teams to work across fragmented tools. As the platform grows, it must preserve the clarity, speed, trust, and human focus established in its foundation.

"The best dealership software should disappear into the background, allowing great salespeople to focus entirely on customers."
