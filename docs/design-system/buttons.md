# Buttons

## Purpose

Buttons initiate actions with clear hierarchy, predictable feedback, and safe behavior. They should make the next best action obvious without turning every action into a visual priority.

## Principles

- One dominant action per region.
- Visual emphasis matches consequence and frequency.
- Labels describe outcomes, not vague intent.
- Every state remains accessible and understandable.
- Buttons perform actions; links navigate.

## Usage Guidelines

- **Primary:** solid brand treatment for the dominant action.
- **Secondary:** quiet neutral surface for important support actions.
- **Outline:** neutral action in toolbars or grouped controls.
- **Ghost:** contextual or low-emphasis action.
- **Danger:** genuinely destructive or high-risk action.

Standard buttons are approximately 36–40 px high. Compact 32 px controls are limited to information-dense desktop contexts; touch layouts preserve a 44 px target. Use sentence-case verb phrases such as “Schedule appointment” or “Save changes.” Leading icons support meaning; trailing icons indicate direction or disclosure.

Loading buttons preserve width, communicate progress, and prevent duplicate action. Disabled buttons remain readable and should be accompanied by an explanation when the reason is not obvious. Icon-only buttons require an accessible name and, when unfamiliar, a tooltip.

## Do

- Use concise, specific action labels.
- Place the primary action predictably within its region.
- Confirm destructive or irreversible actions when needed.
- Provide pressed, hover, focus, loading, and disabled states.
- Keep action groups ordered by importance.

## Don't

- Do not place multiple primary buttons in one decision region.
- Do not use danger styling for harmless cancellation.
- Do not use disabled state to conceal eligibility requirements.
- Do not make labels wrap in ordinary button groups.
- Do not use a button for navigation.

## Future Considerations

- Split buttons and command-aware actions.
- Permission and eligibility explanation patterns.
- Async progress behavior for long dealership operations.
- Density-specific sizing tokens.
