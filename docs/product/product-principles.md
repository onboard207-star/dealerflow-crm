# DealerFlow Product Principles

## Product mission

DealerFlow gives automotive retailers one coherent operating environment for moving customer work forward. It should reduce coordination cost, clarify the next best action, and help teams deliver a consistent customer experience without making people serve the software.

The product should feel modern, intelligent, focused, trustworthy, and fast. Every workflow should make complex dealership operations easier to understand and execute.

## Intended users

DealerFlow serves people with different responsibilities and levels of system fluency:

- Salespeople managing conversations, follow-up, appointments, and active opportunities.
- Managers monitoring performance, coaching teams, resolving exceptions, and allocating attention.
- Finance teams progressing approvals, products, documents, and delivery readiness.
- Service teams coordinating customer needs, appointments, work status, and handoffs.
- Operators and administrators configuring consistent processes across stores and teams.

Default to clear language, recognizable concepts, and efficient paths for frequent work. Expert speed must not make occasional users feel lost.

## Core experience principles

1. **Make the next action obvious.** Each surface should establish context, status, responsibility, and the most likely next step.
2. **Progress over administration.** Minimize data entry, navigation, and repeated confirmation that do not advance customer or operational outcomes.
3. **Dense when useful, calm by default.** Support serious operational work without presenting every field, control, and metric at once.
4. **Trust through clarity.** Explain system state, preserve user intent, show the consequences of consequential actions, and make recovery possible.
5. **Consistent, not rigid.** Shared patterns should transfer across workspaces while allowing domain-specific tasks to remain natural.
6. **Fast paths with safe edges.** Optimize frequent actions while protecting destructive, irreversible, or externally visible operations.
7. **Human judgment remains primary.** Automation and AI should assist decisions, not conceal uncertainty or remove meaningful control.

## Information hierarchy

Organize information from decision to detail:

1. Current context: the customer, vehicle, deal, repair order, task, or workspace in focus.
2. Operational state: status, urgency, ownership, blockers, and deadlines.
3. Primary actions: the small set of actions most likely to move work forward.
4. Supporting evidence: communication, activity, documents, financial context, and related records.
5. Advanced or infrequent controls: configuration, secondary metadata, and exceptional actions.

Use progressive disclosure rather than hiding essential state. Important warnings and dependencies must appear where the decision is made, not in distant settings or secondary screens.

## AI guidance principles

- AI should be contextual, optional, and clear about what it used and what it produced.
- Suggestions must remain distinguishable from confirmed facts and completed actions.
- Make uncertainty visible; never invent customer, vehicle, financial, or operational facts.
- Require explicit review before messages, records, commitments, or externally visible actions are created.
- Prefer specific assistance—summarizing, drafting, prioritizing, or explaining—over vague conversational surfaces.
- Preserve provenance where it affects trust: show the source or reason behind important recommendations.
- Provide a direct non-AI path for critical workflows.

## Avoiding CRM clutter

Traditional CRM density is not a goal. Avoid walls of fields, oversized dashboards, decorative metrics, persistent toolbars, and competing calls to action.

- Show fields when they support the current decision or task.
- Group related information into meaningful sections rather than generic cards.
- Prefer a strong default view with deliberate secondary disclosure.
- Reserve color for meaning, feedback, and emphasis.
- Avoid duplicating the same status or action across multiple nearby regions.
- Let whitespace, typography, and alignment establish hierarchy before adding containers.

## Workspace consistency

Customer, Lead, Deal, Inventory, Service, and Finance workspaces should share a recognizable operating model:

- A stable shell, navigation model, command access, and responsive behavior.
- Consistent placement and treatment of identity, status, ownership, activity, and primary actions.
- Shared primitives for lists, tables, timelines, forms, empty states, loading, errors, and confirmation.
- Domain terminology and workflows appropriate to each workspace.
- Predictable cross-workspace links that preserve context and support natural handoffs.

Do not force every workspace into the same layout. Preserve common interaction grammar while allowing the information hierarchy to match the work being performed.
