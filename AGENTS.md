# DealerFlow Repository Guidance

## Product context

DealerFlow is a premium automotive retail operating platform for dealership salespeople, managers, finance teams, and service teams. Build experiences that feel modern, intelligent, focused, trustworthy, and highly usable.

Start with [Product principles](docs/product/product-principles.md) for the mission, users, experience principles, information hierarchy, AI guidance, and workspace consistency rules.

## Required documentation

All UI work must follow the DealerFlow design-system documentation:

- [Design system overview](docs/design-system/README.md)
- [Foundations](docs/design-system/foundations.md)
- [Components](docs/design-system/components.md)
- [Motion](docs/design-system/motion.md)
- [Frontend standards](docs/engineering/frontend-standards.md)

Use these documents as the detailed source of truth. Keep this file as a map rather than duplicating their specifications here.

## Implementation rules

- Build reusable components; do not duplicate page-specific UI or interaction patterns.
- Use strict TypeScript. Avoid `any`, unsafe casts, and untyped boundaries.
- Support responsive desktop, tablet, and mobile behavior.
- Use accessible semantic markup, complete keyboard navigation, and visible focus states.
- Reuse existing design tokens and UI primitives whenever practical.
- Preserve established component APIs and visual patterns unless the task explicitly changes them.
- Keep placeholder and demonstration data outside production components.
- Do not add Airtable, backend, API, authentication, or business-data integration unless the task explicitly requests it.

## Validation

After application code changes:

- Run the TypeScript typecheck and a production build.
- Run lint and existing tests when configured.
- Run focused checks for the behavior changed.
- Do not report validation as passing unless the command completed successfully.

Documentation-only changes do not require an application build unless they affect tooling or generated output. Always run available documentation and whitespace checks.

## Handoff

Report:

- changed files;
- validation commands and results;
- assumptions made;
- any deviations from the requested specification and why.
