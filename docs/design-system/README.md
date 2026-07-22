# DealerFlow Design System v1

## Purpose

The DealerFlow design system is the visual and interaction rulebook for a coherent, accessible automotive retail operating platform. It defines how foundations, components, layout, and motion work together across every workspace and device.

DealerFlow should feel premium, modern, intelligent, fast, clean, and confident. Its automotive character should come from operational precision, informed language, and purposeful detail—not dealership clichés, chrome effects, racing motifs, oversized vehicle imagery, or promotional-site styling.

The system draws broad inspiration from the restraint, clarity, and product craft associated with Apple, Linear, Stripe Dashboard, Notion, and HubSpot. It must not reproduce any product's visual identity, layouts, or distinctive components.

## Design principles

1. **Operational clarity first.** Make identity, state, ownership, urgency, and next action easy to scan.
2. **Premium through restraint.** Use proportion, typography, alignment, and precise interaction before decoration.
3. **Dense when useful, calm by default.** Reveal the detail required for the task without making every surface feel like a database.
4. **Confidence through consistency.** Shared states and actions should look and behave the same across Customer, Lead, Deal, Inventory, Service, and Finance workspaces.
5. **Intelligence in context.** AI belongs beside the work it supports and must remain distinguishable from confirmed human or system activity.
6. **Speed is a feature.** Optimize frequent paths, keyboard use, perceived performance, and low-friction transitions.
7. **Every state is designed.** Empty, loading, partial, error, offline, disabled, and success states are part of the component contract.
8. **Accessible by default.** Accessibility is a release requirement, not an optional refinement.

## Documentation map

- [Product principles](../product/product-principles.md): mission, users, hierarchy, AI behavior, and workspace consistency.
- [Foundations](foundations.md): color, type, spacing, shape, elevation, icons, responsive behavior, and themes.
- [Components](components.md): component expectations, states, and composition rules.
- [Motion](motion.md): animation purpose, timing, easing, interaction feedback, overlays, and reduced motion.
- [Frontend standards](../engineering/frontend-standards.md): implementation architecture, TypeScript, accessibility, responsive engineering, and validation.

Together these documents define Design System v1. If guidance conflicts, accessibility and product clarity take priority, followed by foundations, component rules, and local composition.

## Governance

- Existing tokens and primitives are the default. Extend them only when a recurring product need cannot be met through composition.
- A new component must solve a reusable interaction or presentation problem, not encode one page's data or workflow.
- Changes to shared tokens or primitives must consider light and dark themes, all supported breakpoints, keyboard behavior, and downstream consumers.
- Prefer incremental, backwards-compatible improvements. Breaking visual or API changes require an explicit migration plan.
- Document new public variants, states, and behavior in the relevant design-system file.
- Accessibility is part of component correctness, not a later review step.
- Changes to this v1 rulebook should record the decision, affected primitives, migration impact, and founder approval when required.

## Using the system

Components should consume semantic tokens rather than literal colors or arbitrary values. Workspaces should compose shared primitives and domain components, providing data and actions through typed contracts.

Workspace code owns domain meaning and orchestration. Design-system code owns reusable presentation, interaction behavior, and state treatment. If a pattern appears in more than one workspace, evaluate whether it belongs in the shared component layer before copying it.

## Accessibility standards

DealerFlow targets WCAG 2.2 AA for product interfaces.

- Text and interactive visuals must meet AA contrast requirements: at least 4.5:1 for normal text, 3:1 for large text, and 3:1 for meaningful UI boundaries and states.
- Every interactive element must be reachable and operable by keyboard in a logical order.
- Focus must remain visible with a consistent two-pixel-equivalent indicator that is not obscured by sticky UI.
- Use semantic HTML first. Add ARIA only to supply information or behavior that native semantics cannot provide.
- Icon-only controls require accessible names; unfamiliar icons also require visible labels or tooltips.
- Touch targets should be at least 44 by 44 CSS pixels when space allows and never depend on pixel-perfect tapping.
- Status, validation, selection, and urgency must not rely on color alone.
- Dialogs, drawers, and menus must manage focus, support Escape where conventional, and restore focus to their trigger.
- Content must remain usable at 200% zoom, with text reflow and without loss of actions or information.
- Honor reduced motion, system theme preference, text scaling, and high-contrast needs.
- Announce asynchronous results and validation changes when they are not otherwise evident to assistive technology.

## Version status

This documentation defines DealerFlow Design System v1. It is normative for new UI work, but documented palette values and token names are specifications until a separate implementation task updates the codebase. Current application tokens remain unchanged by this documentation task.

## Open Decisions Requiring Founder Approval

- Final brand hue: retain the proposed confident indigo-blue or move toward a more automotive navy.
- AI identity: use a dedicated violet family or represent AI through brand color plus an AI glyph.
- Product density default: comfortable or compact for desktop dealership workflows.
- Default corner character: the proposed 10–12 px softness or a sharper 8 px enterprise profile.
- Brand typography: continue with the system stack or license a distinctive product typeface.
- Dark theme positioning: equal first-class default, user preference only, or selected workspace default.
- Data visualization palette and whether dealership/store comparison requires additional categorical colors in v1.
- Customer-facing surfaces: share the core product system or establish a related but warmer sub-theme.
