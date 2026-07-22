# Frontend Engineering Standards

## Technology baseline

DealerFlow uses the Next.js App Router, React, strict TypeScript, Tailwind CSS, existing Radix/shadcn-style primitives, and Lucide icons. Follow the versions and configuration pinned in the repository. Do not introduce a competing framework, styling system, component library, or icon family without explicit approval.

## Next.js App Router

- Use the `app/` directory and App Router conventions.
- Keep layouts focused on shared structure, providers, metadata, and route composition.
- Use route groups and nested layouts when they clarify ownership without changing URLs unnecessarily.
- Keep route entry files thin; compose workspace and feature components rather than implementing entire screens inline.
- Do not add API routes, server actions, middleware, or backend integrations unless explicitly requested.

## React and component boundaries

- Build small components around a coherent responsibility, not arbitrary line-count limits.
- Separate reusable UI behavior from workspace-specific orchestration and business meaning.
- Prefer composition over inheritance and duplicated markup.
- Keep state near the smallest shared owner that needs it.
- Extract hooks only when they represent reusable stateful behavior.
- Avoid effects for values that can be derived during rendering.

## Strict TypeScript

- Preserve `strict` compiler settings.
- Define explicit public prop and data-contract types.
- Prefer discriminated unions for state variants and exhaustive handling for closed domains.
- Use `unknown` at untrusted boundaries and narrow it safely.
- Avoid `any`, broad assertions, non-null assertions, and suppression comments unless the constraint is documented and unavoidable.
- Do not weaken compiler settings to resolve a local type error.

## Tailwind and primitives

- Use semantic design tokens through Tailwind utilities.
- Reuse existing Radix/shadcn-style primitives for accessible interaction behavior.
- Use the shared `cn` helper for conditional class composition.
- Avoid arbitrary values when the configured scale or token expresses the intent.
- Keep repeated variant logic in reusable components, using typed variants where appropriate.
- Do not modify global tokens for a page-specific need.

## Lucide icons

Import icons directly from `lucide-react`. Use consistent sizes and stroke treatment. Decorative icons must use `aria-hidden`; icon-only controls need accessible names. Do not use icons as substitutes for clear status or action labels.

## File naming

- Use kebab-case for component, hook, utility, and documentation filenames.
- Use descriptive names tied to responsibility rather than visual position alone.
- Export React components in PascalCase and hooks with a `use` prefix.
- Keep barrel exports small and intentional; avoid dependency cycles.
- Co-locate feature-private code and place broadly reusable primitives in the shared component layer.

## Props and data contracts

- Keep props minimal, typed, and stable.
- Pass domain data through explicit view models rather than entire backend records.
- Use callbacks named for intent, such as `onOpenChange` or `onConfirm`.
- Model controlled and uncontrolled behavior deliberately; do not mix them accidentally.
- Do not embed fake customer, lead, deal, inventory, service, or finance data in production components.
- Store examples and placeholder data in dedicated fixtures or preview modules.

## Server and client components

Use Server Components by default. Add `"use client"` only when a component requires browser APIs, local state, effects, event handlers, or client-only context.

- Keep client boundaries narrow and pass serializable props across them.
- Do not convert an entire route or workspace to a Client Component for one interactive control.
- Keep browser-only dependencies out of Server Components.
- Treat server/client boundaries as architectural and performance decisions, not error workarounds.

## Accessibility

- Use semantic HTML before ARIA.
- Provide accessible names, labels, descriptions, and error associations.
- Support full keyboard operation with logical focus order and visible focus states.
- Manage focus for dialogs, drawers, menus, and dynamically revealed content.
- Ensure touch targets remain usable and state is not communicated by color alone.
- Test zoom, text expansion, and both light and dark themes.
- Preserve reduced-motion preferences.

## Responsive design

Build mobile-first and refine at content-driven breakpoints. Support mobile, tablet, desktop, and intermediate widths. Avoid device-specific assumptions, fixed page widths, and interactions available only on hover. Verify navigation, overflow, tables, dialogs, forms, and primary actions at representative widths.

## Validation expectations

After application code changes, run:

1. TypeScript typecheck.
2. Production build.
3. Lint when configured.
4. Existing tests, plus focused tests for changed behavior, when configured.
5. Responsive and interaction smoke checks proportional to the change.

For documentation-only changes, run whitespace validation and any configured Markdown or link checks. Report commands that could not run and why. Never claim success based only on compilation when the change requires behavioral verification.
