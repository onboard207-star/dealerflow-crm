# AICommandCenter Component Specification

# Purpose

The AICommandCenter is DealerFlow's primary intelligence surface. It converts verified customer and operational context into one clear, explainable recommendation.

It answers one question:

> What should I do next, and why?

The component exists to reduce searching, prioritization effort, and unnecessary clicks. It should help a salesperson or manager act with greater confidence while preserving human review and decision-making.

The AICommandCenter is not a chatbot, a transcript of model activity, or a dashboard of every possible insight. It should present only the intelligence needed to understand and advance the current situation.

# Responsibilities

The component is responsible for:

- Presenting one primary Next Best Action.
- Explaining the recommendation with concise, verifiable evidence.
- Showing the confidence level associated with the recommendation.
- Explaining the intended Outcome Impact without guaranteeing a result.
- Communicating the applicable Time Horizon and recommendation freshness.
- Summarizing Buying Probability, Momentum, and Urgency when supported by current data.
- Identifying the most important risks and opportunities.
- Offering a limited set of relevant secondary actions.
- Distinguishing AI guidance from confirmed customer and dealership records.
- Communicating freshness, uncertainty, missing evidence, and unavailable intelligence.
- Preserving a direct human-controlled path for every recommended action.

The component must not send communications, change records, make commitments, or complete consequential actions without explicit human review.

## Design Principles

- Explain every recommendation.
- Never expose AI chain-of-thought.
- Show evidence, not conclusions alone.
- Keep the interface calm and scannable.
- Present one primary recommendation only.
- Avoid overwhelming users with excessive AI output.

# Information Hierarchy

Information appears in this order:

1. **Next Best Action** — the single recommended action that should receive attention now.
2. **AI Confidence** — how strongly the available evidence supports that recommendation.
3. **Outcome Impact** — why the action matters and the intended customer or business outcome.
4. **Time Horizon** — when the recommendation applies or should be completed.
5. **Recommendation Freshness** — when the recommendation was generated or last updated.
6. **Why This Recommendation** — concise facts and events the user can verify.
7. **Urgency** — why timing matters.
8. **Buying Probability** — the current likelihood signal when relevant.
9. **Momentum** — whether engagement and progress are increasing, stable, or declining.
10. **Risks and Opportunities** — the most important conditions that may affect the outcome.
11. **Recommended Actions** — a small set of secondary, human-controlled options.

The recommendation, confidence, impact, time horizon, and freshness must remain visually grouped as the primary decision region. Supporting metrics should never compete with the recommendation or turn the component into a score dashboard.

# Layout

The AICommandCenter should use one coherent surface with clearly related regions rather than a collection of disconnected cards.

The leading region contains:

- AI identity.
- Next Best Action.
- Confidence.
- Outcome Impact.
- Time Horizon.
- Recommendation Freshness.
- One primary action.

Why This Recommendation remains directly connected to the leading region. Supporting indicators for urgency, buying probability, and momentum appear as a concise summary. Risks, opportunities, and secondary actions follow in decreasing priority.

The layout may use columns on wide screens and stacked regions on narrow screens, but the reading order must not change. Supporting indicators may appear beside the recommendation on wide screens, but they must not separate the recommendation from its impact, timing, freshness, or evidence.

Avoid decorative AI effects, glowing surfaces, animated gradients, conversational bubbles, oversized metric cards, or visual treatments that turn the component into a dashboard. The surface should feel calm, precise, and operational.

# Buying Probability

Buying Probability communicates the estimated likelihood that the customer will complete the relevant purchase outcome within the approved prediction window.

It must include:

- A clear label.
- A value or approved range.
- The prediction window or context.
- Freshness information.
- A concise description of what the measure means.

Buying Probability is an estimate, not a fact or promise. It must not be presented when the prediction definition, supporting data, or minimum evidence threshold is unavailable. Changes should be described only when the comparison period and cause are meaningful.

# Momentum

Momentum communicates the direction and pace of recent customer engagement or workflow progress.

Approved states should remain simple and understandable, such as:

- Increasing
- Stable
- Declining
- Insufficient evidence

Momentum requires a stated evaluation period and supporting evidence. It must not be inferred from one isolated event when broader activity is unavailable. Direction must be communicated through text as well as any visual indicator.

# Urgency

Urgency communicates how soon attention is needed and why timing matters.

Urgency must be tied to verifiable conditions such as an upcoming appointment, expiring offer, unanswered customer communication, inventory availability, or task deadline. It should use calm, specific language rather than alarmist labels.

If no time-sensitive condition exists, do not manufacture urgency. Urgency and AI Confidence are independent: a recommendation may be urgent with limited evidence or well-supported without being time-sensitive.

# Next Best Action

Next Best Action is the one action DealerFlow recommends now.

It should contain:

- A direct action statement.
- The customer or operational context when needed.
- A timing recommendation when relevant.
- One clear primary control that begins, reviews, or prepares the action.
- A visible confidence indicator.

Use specific language such as “Call customer before 3:00 PM,” not generic language such as “Follow up.” Only one action may be visually primary. Alternative actions belong under Recommended Actions and must not compete with the recommendation.

The user remains responsible for reviewing and choosing whether to proceed.

# Why This Recommendation

This section explains the recommendation using a short list of evidence the user can verify.

Evidence may include:

- Recent customer communications or engagement.
- Confirmed appointments and deadlines.
- Vehicle availability or meaningful inventory changes.
- Explicit customer preferences or stated intent.
- Relevant task, deal, service, or finance status.
- Recent changes that materially affect the recommended action.

Evidence should use plain language, include useful recency context, and link to the underlying record when that behavior is supported in the future. Present the strongest two to four pieces of evidence. Do not repeat the conclusion as evidence.

# Risks

Risks identify conditions that could reduce the likelihood of a successful outcome or make the recommended action inappropriate.

Each risk should include:

- A concise description.
- The verified condition that created it.
- Its relevance to the recommendation.
- A mitigating action when one is known.

Show only material risks. Do not use fear-driven language, duplicate warnings already visible elsewhere, or imply certainty when evidence is incomplete. If no material risk is known, omit the region or state that no current risk is supported by available evidence.

# Opportunities

Opportunities identify evidence-supported conditions that may improve the customer experience or outcome.

Examples may include strong recent engagement, a matching vehicle becoming available, an upcoming appointment, a resolved blocker, or a relevant service-to-sales transition.

Opportunities should be specific, timely, and actionable. They must not become promotional claims or unsupported upsell suggestions. Show only the most relevant opportunities and keep them secondary to the Next Best Action.

# Recommended Actions

Recommended Actions contains a small set of secondary options related to the current recommendation.

Each action must:

- Use a specific outcome-oriented label.
- Remain explicitly user initiated.
- Respect permissions, consent, availability, and customer state.
- Explain why it is unavailable when the reason is not obvious.
- Preserve user review before external communication or consequential changes.

Limit the visible set to two or three actions. Additional valid actions may appear through a secondary disclosure, but the surface must not become a command list.

# AI Confidence

Every recommendation must include a small Confidence indicator.

Confidence communicates how strongly the available evidence supports the recommendation. It does not communicate certainty that the customer will respond, that the outcome will occur, or that the recommendation is objectively correct.

The indicator should include:

- The label “Confidence.”
- A percentage or approved confidence range.
- A concise accessible description.
- Freshness information when confidence may change over time.
- A path to the supporting evidence through Why This Recommendation.

For example, a recommendation may present “Confidence: 96%” beside “Call customer before 3:00 PM,” followed by evidence such as the customer opening a pricing email twice today, a test drive scheduled tomorrow, and the vehicle being in stock.

Confidence must be communicated with text, not color alone. Avoid oversized gauges, dramatic progress graphics, celebratory styling, or false claims of certainty. If the confidence calculation is not calibrated or the evidence threshold is not met, show an approved qualitative state such as “Limited evidence” instead of a misleading percentage.

# Outcome Impact

Outcome Impact explains why the recommended action matters and what customer or business outcome it is intended to improve.

It should appear directly below or immediately beside the Next Best Action and Confidence. Approved forms include:

- **Expected Outcome:** Increase likelihood of appointment confirmation.
- **Expected Impact:** High.
- **Potential Outcome:** Complete trade appraisal before tomorrow's test drive.
- **Potential Outcome:** Reduce customer response delay.
- **Potential Outcome:** Improve close probability.

Outcome Impact must be tied to the specific recommendation. It describes intent or estimated effect; it never guarantees a sale, appointment, approval, response, or other result. It must remain supporting context, not become a second recommendation.

Quantified impact may appear only when the estimate is calibrated, explainable, and supported by approved data. Do not show unsupported precision such as “+18%” without a defensible model and confidence standard. When a numeric estimate is not trustworthy, use a qualified level such as High, Medium, or Low, or use a concise outcome-oriented statement.

Language must remain operational, customer-safe, and clear about the difference between an estimated impact and a confirmed result. When Outcome Impact cannot be supported, omit it or use an explicitly qualified qualitative statement.

# Time Horizon

Time Horizon communicates when the recommendation is relevant and how long it should remain actionable.

Approved forms may include:

- Now
- Today
- This Week
- Before Appointment
- After Appointment
- Before Delivery
- After Delivery
- Before Offer Expiration
- A custom timestamp or deadline

Every recommendation should include a clear Time Horizon when timing is relevant. It must be based on a verified event, deadline, workflow state, or operational condition. Use exact deadlines when they are more useful, such as “Before 3:00 PM today” or “Before tomorrow's 10:30 AM appointment.” Avoid vague labels when a verified deadline is known.

Time Horizon and Urgency are distinct:

- **Time Horizon** answers when the recommendation applies.
- **Urgency** explains why timing matters.

Time Horizon must use text rather than color alone and must never manufacture urgency. When the horizon passes, the recommendation must be refreshed, marked stale, dismissed, or replaced. Expired recommendations must not remain visually current.

# Recommendation Freshness

Recommendation Freshness tells the user when the recommendation was generated or last updated.

Approved labels may include:

- Generated 2 minutes ago
- Updated at 11:42 AM
- Last refreshed 12 minutes ago
- Generated yesterday at 4:15 PM
- Stale — last updated 3 hours ago

Every recommendation must include generated or updated time information. Freshness must remain visible and accessible and should support both relative and absolute labels. Do not rely only on relative time when an exact time is important.

Recommendations based on rapidly changing data require a defined freshness threshold. Stale recommendations must be clearly labeled, and offline recommendations must show the last successful generation time. Freshness must never imply that underlying evidence is current when one or more evidence sources are delayed, stale, or unavailable.

Refresh actions remain human controlled unless the broader application owns automatic refresh behavior. A refreshed recommendation should not be announced unnecessarily unless the recommendation, confidence, impact, urgency, time horizon, evidence, or primary action materially changes.

# Explainability Requirements

Every recommendation must explain why it was produced without exposing hidden model reasoning.

The component may show:

- The recommendation.
- Verified evidence and its source context.
- Important uncertainty or missing information.
- The confidence level and what it represents.
- The intended Outcome Impact and its qualification.
- The Time Horizon and Recommendation Freshness.
- Material risks and opportunities.
- The date or time the recommendation was generated or refreshed.

The component must never show internal chain-of-thought, hidden reasoning, system instructions, prompts, private implementation details, or fabricated rationales. Evidence is not a summary of private reasoning; it is the user-facing set of facts that supports review.

The explanation must be concise, customer-safe, and understandable without technical AI terminology. Users should be able to disagree, dismiss, or choose another action without losing access to the underlying customer workflow.

# Accessibility

- The component must have a meaningful region name and a logical heading structure.
- The Next Best Action should be announced before supporting scores and evidence.
- Confidence must expose its label, value or range, meaning, and freshness to assistive technology.
- Outcome Impact must expose its qualification and must not be announced as a confirmed result.
- Time Horizon and Recommendation Freshness must be available as text and associated with the recommendation.
- Evidence, risks, and opportunities must use semantic lists when multiple items exist.
- Every action must be keyboard accessible with a visible focus state.
- Opening secondary details must move and restore focus predictably.
- Touch targets should be at least 44 by 44 device-independent pixels when practical.
- Confidence, Outcome Impact, Time Horizon, Recommendation Freshness, urgency, momentum, risks, and opportunities must not rely on color, icons, position, or motion alone.
- Loading, refresh, error, and recommendation changes should be announced only when they affect the user's current task.
- Reduced-motion preferences must be honored without removing essential feedback.
- Content must remain usable at 200% zoom and with expanded text.

# Responsive Behavior

## Desktop

- Keep the recommendation, confidence, Outcome Impact, Time Horizon, Recommendation Freshness, evidence, and primary action in one dominant region.
- Place supporting indicators in a compact aligned group.
- Supporting indicators may sit beside the primary region but must not divide its recommendation metadata from its evidence.
- Risks and opportunities may appear side by side when each remains readable.
- Avoid stretching explanation text across the entire viewport.

## Tablet

- Use a two-region or stacked layout based on content pressure.
- Keep the recommendation, confidence, impact, time horizon, freshness, and evidence together.
- Move secondary metrics or actions below the primary recommendation before truncating content.
- Preserve full action labels and visible confidence.

## Mobile

- Use one semantic reading column.
- Preserve this reading order:
  1. Next Best Action.
  2. Confidence.
  3. Outcome Impact.
  4. Time Horizon.
  5. Recommendation Freshness.
  6. Why This Recommendation.
  7. Primary action.
  8. Supporting indicators.
  9. Risks.
  10. Opportunities.
  11. Secondary actions.
- Stack the primary decision region, indicators, risks, opportunities, and secondary actions.
- Avoid horizontal scrolling, clipped evidence, and icon-only primary actions.
- Keep the primary action reachable without making the surface permanently obstructive.

Responsive behavior should remain usable at intermediate widths, under text expansion, and at 200% zoom.

# Component States

## Ready

Show one primary recommendation, Confidence, Outcome Impact when supported, Time Horizon when relevant, Recommendation Freshness, two to four evidence items, applicable urgency, Buying Probability, and Momentum indicators, material risks and opportunities, one primary action, and two or three secondary actions.

Do not invent impact, time horizon, freshness, or other intelligence when data is unavailable. When Outcome Impact cannot be supported, omit it or use a clearly qualified qualitative statement.

## Loading

Preserve the component's expected structure with restrained placeholders. Do not show sample recommendations, scores, evidence, or confidence while real intelligence is loading. Avoid layout shift and honor reduced motion.

## Empty

Explain why no recommendation is available. Distinguish:

- Insufficient evidence.
- No relevant recommendation.
- Recommendation expired and awaiting refresh.
- Workflow completed.
- Intelligence unavailable for this workspace type.

Offer a direct non-AI path or useful next step without manufacturing guidance.

## Error

Preserve the last trustworthy recommendation when allowed, along with previously confirmed context. Clearly label whether Confidence, Outcome Impact, Time Horizon, Recommendation Freshness, or evidence may be stale. Explain which intelligence could not be produced or refreshed, provide recovery when possible, and keep safe non-AI actions available. Do not show an old recommendation as current.

## Offline

Show the last successfully generated recommendation only when its generated time and stale status are visible. Disable refresh and connected actions without implying success. Preserve safe read-only evidence and provide the direct non-AI path. Clearly communicate that Confidence and Outcome Impact may no longer reflect current conditions.

## Permission Restricted

Do not reveal recommendation text, evidence, scores, Confidence, Outcome Impact, Time Horizon, Recommendation Freshness, risks, or opportunities the user is not permitted to access. Explain the restriction without exposing policy details or leaving sensitive information in accessible names, tooltips, or layout placeholders.

# Cross-Workspace Architecture

AICommandCenter is a reusable intelligence pattern that adapts to multiple DealerFlow workspaces without changing its core mental model.

The core question remains:

> What should I do next, and why?

## Customer and Sales

Contextual recommendations may include:

- Call customer before 3:00 PM.
- Confirm tomorrow's appointment.
- Complete trade appraisal.
- Send pricing follow-up.
- Re-engage an aging lead.

## Inventory

Contextual recommendations may include:

- Review pricing on this vehicle.
- Review a vehicle that has aged 72 days.
- Respond to high local demand.
- Compare similar units that are selling faster.
- Reassign merchandising priority.
- Request updated photos.

## Service

Contextual recommendations may include:

- Contact customer before warranty expiration.
- Offer approved payment options.
- Follow up on deferred repair.
- Route a service customer to sales.
- Confirm transportation needs.

## Finance

Contextual recommendations may include:

- Review promotional-rate eligibility.
- Request missing proof of income.
- Present a likely approval path.
- Rework structure before submission.
- Confirm lender stipulations.

## Management

Contextual recommendations may include:

- Coach a salesperson on missed follow-up.
- Review lead-aging risk.
- Reassign an unattended opportunity.
- Address declining response performance.
- Review team appointment conversion.

The component must preserve the same core information hierarchy across workspaces. Workspace-specific labels, evidence, metrics, risks, opportunities, and actions may vary, but one primary recommendation remains dominant. Confidence, Outcome Impact, Time Horizon, Recommendation Freshness, and evidence remain core concepts everywhere.

The public architecture must not hardcode customer-only terminology. Each workspace defines its own permissions, evidence sources, action availability, outcome definitions, and freshness policies. Variants should be expressed through typed configuration or data contracts rather than duplicated components.

Users moving between sales, inventory, service, finance, and management should recognize the same decision pattern and understand it without relearning the interface.

# Future Enhancements

Future versions may consider:

- Workspace-specific intelligence models.
- Recommendation history within and across workspaces.
- Change explanations such as “Why this recommendation changed.”
- Measured outcome tracking.
- Recommendation effectiveness reporting.
- Confidence and impact calibration by workspace and action type.
- Team-level recommendation queues.
- Manager coaching recommendations.
- Inventory aging recommendations.
- Service retention recommendations.
- Finance structure recommendations.
- Recommendation expiration policies.
- User feedback such as useful, not useful, completed, dismissed, or incorrect.
- Safe recommendation drafting for customer communications.
- Evidence provenance and source-health reporting.
- Recommendation quality monitoring.
- Evidence links to communications, appointments, inventory, and timeline events.
- Multiple recommendation horizons, such as immediate, today, and this week.
- Proactive alerts when confidence, impact, urgency, freshness, or evidence changes materially.

These are future capabilities and are not part of the first implementation. Each requires product validation, permission review, data provenance, accessibility criteria, calibration standards, and clear human control.

# Acceptance Criteria

Implementation will be complete only when all applicable criteria are satisfied:

- The component answers “What should I do next, and why?” within a five-second scan.
- Exactly one recommendation is visually and semantically primary.
- Every recommendation includes a visible Confidence indicator.
- Confidence includes a value or approved range, meaning, freshness when relevant, and a connection to supporting evidence.
- Confidence never implies certainty of customer behavior or business outcome.
- The component communicates why the recommended action matters.
- Outcome Impact is visible when supported and never guarantees a result.
- Numeric impact is shown only when it is defensible, calibrated, explainable, and supported by approved data.
- Every time-sensitive recommendation includes a Time Horizon.
- Time Horizon and Urgency remain conceptually distinct.
- Expired recommendations are refreshed, marked stale, dismissed, or replaced rather than shown as current.
- Every recommendation includes generated or updated time information.
- Stale recommendations are visibly labeled.
- Recommendation, Confidence, Outcome Impact, Time Horizon, Recommendation Freshness, and evidence remain grouped in the primary decision region.
- Why This Recommendation contains two to four concise, verifiable evidence items when sufficient evidence exists.
- The interface exposes evidence and uncertainty without exposing chain-of-thought, hidden reasoning, prompts, or private implementation details.
- Buying Probability, Momentum, and Urgency appear only when their definitions, evidence, and freshness requirements are satisfied.
- Risks and Opportunities contain only material, evidence-supported information.
- Recommended Actions remain secondary, limited, permission-aware, and explicitly user initiated.
- No communication, commitment, record change, or consequential action occurs without human review.
- Ready, Loading, Empty, Error, Offline, and Permission Restricted states are complete and do not invent intelligence.
- Stale or offline recommendations are visibly labeled with their last successful generation time.
- Error and Offline states clearly communicate stale Confidence, Outcome Impact, Time Horizon, Recommendation Freshness, and evidence.
- The information hierarchy and reading order remain stable across desktop, tablet, mobile, intermediate widths, and 200% zoom.
- Keyboard operation, visible focus, screen-reader structure, touch targets, contrast, color independence, and reduced-motion behavior meet DealerFlow accessibility standards.
- The component uses the established DealerFlow visual language and remains calm, concise, and operational.
- Long recommendations, missing indicators, low confidence, multiple evidence items, and localized text do not break the layout.
- Long outcome statements, exact deadlines, stale labels, localized timestamps, and missing impact data do not break the layout.
- The component supports customer, inventory, service, finance, and management workspaces through reusable typed contracts.
- The core component does not hardcode customer-only assumptions.
- Cross-workspace variations preserve the primary information hierarchy.
- Placeholder content remains outside the production component.
- Strict type validation, production-build validation, configured lint, and relevant tests pass after implementation.
- Public behavior, states, assumptions, evidence requirements, and approved specification deviations are documented.
