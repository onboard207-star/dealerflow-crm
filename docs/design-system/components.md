# Component Standards v1

## Buttons

Use buttons for actions and links for navigation. A button must have a clear accessible name, visible focus state, and disabled treatment when unavailable.

### Hierarchy

- **Primary:** the single dominant action in a region; solid brand surface with high-contrast text.
- **Secondary:** important supporting action; quiet neutral surface.
- **Outline:** neutral action on a clear background; useful in toolbars and grouped actions.
- **Ghost:** low-emphasis or contextual action; gains a subtle surface on hover and focus.
- **Danger:** destructive or high-risk action; use only where the consequence is real and pair with confirmation when needed.

Standard controls should be approximately 36–40 px high; compact controls 32 px only in information-dense desktop contexts. Preserve a 44 px touch target on touch layouts. Keep labels short, use sentence case, place leading icons before labels and directional icons after them. Loading buttons preserve width, communicate progress, and prevent duplicate submission. Disabled buttons must not be used to hide eligibility requirements; explain why the action is unavailable.

## Cards

Cards group related content only when a distinct surface improves comprehension. Avoid wrapping every section in a card.

- Use a quiet border and level-0 or level-1 elevation.
- Default to 16–24 px internal padding based on density and viewport.
- Align title, supporting text, and actions consistently in the header.
- Keep one primary content purpose per card.
- Use dividers only between genuinely distinct regions.
- Make a card clickable only when it has one navigation destination; nested controls remain independently operable.
- Do not use hover elevation on static cards or nest cards to manufacture hierarchy.
- Dashboard metric cards require decision value, a clear label, a value, and relevant context—not decoration.

## Status badges

Badges communicate compact status, category, ownership, or count information. Keep labels short and use sentence case.

- **Neutral:** inactive, draft, unknown, or non-evaluative metadata.
- **Brand:** selected, active, or product-defined emphasis when no feedback meaning applies.
- **AI:** AI-generated, AI-assisted, or awaiting AI review; always include an explicit AI label or icon.
- **Success:** complete, approved, delivered, or healthy.
- **Warning:** attention, waiting, expiring, incomplete, or at risk.
- **Danger:** failed, blocked, rejected, overdue, or critical.

Use tinted backgrounds, readable foregrounds, and optional icons. Never use color alone, never use badges as buttons, and do not assign different colors to arbitrary pipeline stages when text and order communicate them better. Status vocabulary must remain identical across summary, table, detail, and activity views.

## Forms

Every control requires a persistent label unless the purpose is unambiguous and programmatically named. Provide descriptions before input when they affect the choice and validation near the affected field. Preserve entered values after recoverable errors. Group related inputs semantically and keep keyboard order aligned with visual order.

## Tables

Use tables for comparable records with stable columns. Provide a visible title or accessible name, semantic headers, and predictable alignment.

- Align text left, comparable numbers right, and short statuses consistently.
- Use tabular numerals for currency, percentages, inventory age, and performance metrics.
- Keep header treatment quiet but distinct; avoid heavy grid lines.
- Use approximately 44–52 px rows by default and a documented compact density only for expert desktop workflows.
- Keep primary identity and critical status visible as columns are deprioritized.
- Support horizontal scrolling or transform into structured lists on narrow screens; do not shrink text below the type scale.
- Selection, sorting, pagination, and row actions must be keyboard accessible and announced correctly.
- Sticky headers and columns must preserve clear boundaries and must not obscure focus.
- Use truncation only with a reliable way to access the full value.
- Empty, loading, error, and partial states belong inside the table region without destroying its surrounding context.
- Avoid making both the entire row and nested actions compete for the same click target.

## Lists

Use lists for scannable records when comparison across strict columns is secondary. Maintain consistent identity, metadata, status, and action placement. Entire-row navigation must not interfere with nested buttons or menus.

## Timelines

Timelines present chronological events with clear timestamps, actors, event types, and outcomes. Differentiate confirmed activity from planned or AI-suggested activity. Collapse repetitive low-value events without hiding important changes or customer communications.

## Navigation

Navigation must provide orientation, current-location state, predictable keyboard behavior, and responsive adaptation. Preserve a stable app shell across workspaces. Use breadcrumbs for hierarchy, tabs for peer views within a context, and menus for secondary actions—not interchangeably.

## Empty, loading, and error states

- **Empty:** explain what is absent, why it matters, and the next available action. Do not invent production data to make a screen appear populated.
- **Loading:** preserve layout where practical, indicate active work, and avoid indefinite animation without status.
- **Error:** state what failed in plain language, preserve user input, provide recovery when possible, and expose actionable detail without leaking sensitive information.
- **Partial:** show available content while clearly identifying stale, unavailable, or incomplete regions.

## Component composition rules

- Prefer shared primitives plus small domain components over monolithic page components.
- Keep data fetching and business orchestration outside presentational primitives.
- Represent variants and states through typed props rather than duplicated markup.
- Favor composition and slots over a rapidly growing set of boolean props.
- Keep accessibility behavior inside the reusable component when it is intrinsic to that pattern.
- Avoid exposing raw styling escape hatches as the primary API; allow `className` for deliberate extension.
- Place placeholder or story data in fixtures, examples, or preview modules—not production components.
- Promote a pattern to the shared layer only after its reusable contract is understood.
