# DealerFlow Design System v1

## Purpose

The DealerFlow Design System is the single source of truth for the product's visual language. It aligns foundations, components, interaction, responsive behavior, and accessibility so every workspace feels like part of one premium automotive retail operating platform.

DealerFlow should feel premium, modern, intelligent, fast, calm, professional, and operational. Its automotive character should come from precision, useful context, and confident workflow design—not dealership advertising, chrome effects, racing motifs, or oversized vehicle imagery.

The system takes broad inspiration from the restraint and product craft associated with Apple, Linear, Stripe Dashboard, Notion, and HubSpot. It must not imitate any product's identity or distinctive patterns.

## Principles

1. Information before decoration.
2. Operational clarity before visual novelty.
3. Calm hierarchy, even when information is dense.
4. Shared patterns across every workspace.
5. Fast paths with safe, accessible edges.
6. Semantic tokens instead of one-off visual values.
7. Reusable components instead of page-specific variants.

## Usage Guidelines

Use this documentation in layers:

- [Foundations](foundations.md) defines the system model, design tokens, naming, and governance.
- [Colors](colors.md), [Typography](typography.md), and [Spacing](spacing.md) define core visual scales.
- [Layout](layout.md) defines grids, containers, responsive behavior, and workspace composition.
- [Buttons](buttons.md), [Cards](cards.md), [Tables](tables.md), [Forms](forms.md), [Badges](badges.md), and [Icons](icons.md) define component rules.
- [Motion](motion.md) defines timing, easing, transitions, and reduced-motion behavior.
- [Accessibility](accessibility.md) defines the non-negotiable usability baseline.
- [Component index](components.md) provides a stable map for component guidance.

When guidance conflicts, accessibility and user comprehension take priority, followed by foundations, the relevant component document, and local composition. Product code should consume documented semantic tokens and shared primitives rather than restating these rules.

## Do

- Start with the relevant foundation and component documents before designing a workflow.
- Reuse named tokens and established component variants.
- Review work in light and dark themes and at mobile, tablet, and desktop widths.
- Document shared additions, states, and migration impact.
- Improve the system when a recurring product need is not represented.

## Don't

- Do not invent local colors, spacing, shadows, icons, or component variants.
- Do not use visual density as a substitute for information hierarchy.
- Do not make one workspace feel like a separate product.
- Do not copy another product's composition or signature styling.
- Do not treat accessibility or responsive behavior as post-build polish.

## Future Considerations

- Formal design-token distribution and automated parity checks.
- Versioned component maturity and deprecation status.
- Data-visualization, illustration, and customer-facing sub-systems.
- Design QA tooling for contrast, responsive behavior, and token usage.
- A governed contribution and founder-approval workflow for major visual changes.

"Design consistency is a product feature."
