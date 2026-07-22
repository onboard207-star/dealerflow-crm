# Status Badges

## Purpose

Status badges provide compact, consistent signals about state, category, ownership, provenance, or count. They help users scan without replacing clear language.

## Principles

- Status vocabulary is consistent across every view.
- Color reinforces text; it never replaces it.
- Badges are informational, not decorative.
- Semantic meaning determines treatment.
- Compact does not mean cryptic.

## Usage Guidelines

- **Neutral:** draft, inactive, unknown, or non-evaluative metadata.
- **Brand:** selected, active, or product-defined emphasis without feedback meaning.
- **AI:** AI-generated or AI-assisted content; include an AI label or icon.
- **Success:** complete, approved, delivered, or healthy.
- **Warning:** attention, waiting, incomplete, expiring, or at risk.
- **Danger:** failed, blocked, rejected, overdue, or critical.

Use short sentence-case labels, tinted backgrounds, and readable foregrounds. Add an icon only when it improves recognition or supports non-color communication. A badge that triggers an action must be implemented and labeled as a control, not styled as passive status.

## Do

- Use the same label for the same status across tables, summaries, and timelines.
- Pair urgency with specific language.
- Keep badge shape, padding, and type consistent.
- Provide accessible names for icon-only supporting indicators.
- Test color and text contrast in both themes.

## Don't

- Do not assign arbitrary colors to every pipeline stage.
- Do not use badges as primary buttons.
- Do not abbreviate statuses users may not understand.
- Do not use AI styling for ordinary automation.
- Do not create several badges where one concise status is sufficient.

## Future Considerations

- Governed status vocabulary by domain.
- Count, removable-filter, and presence badge subtypes.
- Time-sensitive status behavior and accessible urgency.
- Cross-workspace mapping for operational lifecycle states.
