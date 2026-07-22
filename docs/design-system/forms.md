# Forms and Inputs

## Purpose

Forms collect and edit information accurately with minimal cognitive load. Inputs should help users complete dealership work quickly while preventing avoidable errors.

## Principles

- Labels remain visible and specific.
- Ask only for information required at the current stage.
- Validation is timely, local, and actionable.
- User input survives recoverable errors.
- Input type and formatting match the data being collected.

## Usage Guidelines

Use persistent labels above or beside controls. Placeholder text may provide an example but never replaces a label. Supporting text appears before interaction when it changes the decision; validation appears near the affected field and is associated programmatically.

Standard inputs are approximately 40 px high, with 44 px touch targets on touch layouts. Use textarea, select, checkbox, radio, switch, date, currency, phone, and search patterns according to the data—not visual preference. Group related controls with fieldsets and legends where appropriate.

Distinguish required, optional, read-only, disabled, loading, invalid, and successful states. Use input masks only when they improve entry without blocking paste, assistive technology, or valid international formats. Long forms should use meaningful sections and progressive disclosure.

## Do

- Use clear labels and concise instructions.
- Choose safe defaults without inventing customer or business information.
- Validate format after a user has had a reasonable chance to enter data.
- Move focus to the first invalid field after failed submission when appropriate.
- Preserve values and explain how to recover.

## Don't

- Do not use placeholder-only labels.
- Do not validate every keystroke with disruptive error messages.
- Do not disable paste for identifiers, phone numbers, or secure fields.
- Do not create multi-column mobile forms.
- Do not mix view and edit states without a clear interaction model.

## Future Considerations

- Standard field components for automotive and financial data.
- Autosave, optimistic updates, and conflict-resolution patterns.
- Complex form flows, review steps, and draft recovery.
- Locale-aware addresses, phone numbers, currency, dates, and identity fields.
