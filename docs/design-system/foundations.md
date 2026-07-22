# Foundations

## Purpose

Foundations define the shared logic beneath every DealerFlow interface. They connect visual decisions to semantic design tokens so the product stays coherent across workspaces, themes, and devices.

## Principles

- Use semantic meaning instead of implementation-specific values.
- Keep the visual system restrained, legible, and operational.
- Make hierarchy transferable across Customer, Lead, Deal, Inventory, Service, Finance, Reporting, and portal experiences.
- Treat light and dark themes as equivalent expressions of one system.
- Prefer a small, governed scale over unlimited creative choice.

## Usage Guidelines

### Design-token model

Tokens use three conceptual layers:

1. **Reference tokens** describe raw palette, type, spacing, radius, shadow, and motion values.
2. **Semantic tokens** describe purpose, such as background, foreground, border, action, success, warning, danger, or AI.
3. **Component tokens** map semantic roles to a component state only when a shared primitive needs finer control.

Application design should specify semantic roles. Reference values remain an implementation detail of the token system.

### Token naming conventions

Use names that move from category to role to state: `category.role.state`. Examples include `color.action.primary`, `color.feedback.danger`, `space.component.default`, `radius.control`, and `motion.duration.fast`.

- Use lowercase descriptive words.
- Name by purpose, not appearance; prefer `foreground.muted` over `gray-500`.
- Keep state suffixes consistent: `default`, `hover`, `active`, `focus`, `disabled`.
- Avoid workspace names in shared foundation tokens.

### Component naming conventions

- Name components by stable responsibility: `StatusBadge`, `DataTable`, or `WorkspaceHeader`.
- Use PascalCase for component names and sentence case for user-facing labels.
- Name variants by hierarchy or meaning: `primary`, `secondary`, `danger`, `success`.
- Avoid names tied to coordinates, a single page, or temporary campaigns.

The detailed visual scales live in [Colors](colors.md), [Typography](typography.md), [Spacing](spacing.md), [Layout](layout.md), and [Motion](motion.md).

## Do

- Reuse the smallest sufficient set of semantic tokens.
- Validate every token across themes, states, and supported contrast requirements.
- Define a token only when it expresses a repeatable design decision.
- Record downstream impact when changing shared foundations.

## Don't

- Do not encode raw color names or pixel values in semantic token names.
- Do not create tokens to avoid making a component decision.
- Do not duplicate equivalent tokens for separate workspaces.
- Do not change a foundation value to fix one local composition.

## Future Considerations

- Machine-readable token schemas and cross-platform output.
- Automated token documentation and visual regression checks.
- Density, data-visualization, and customer-facing token extensions.
- Formal token lifecycle states: experimental, stable, deprecated, and removed.
