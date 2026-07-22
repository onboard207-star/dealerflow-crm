# Spacing

## Purpose

Spacing expresses relationships, separates concepts, and keeps dense operational interfaces calm. A shared scale makes layouts feel intentional across all workspaces.

## Principles

- Use a four-pixel base grid.
- Space by semantic relationship, not by visual guesswork.
- Repetition creates rhythm and faster scanning.
- Responsive compression must preserve legibility and target size.
- Whitespace supports hierarchy; it does not compensate for weak structure.

## Usage Guidelines

The preferred scale is `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` px.

| Value | Typical use |
| ---: | --- |
| 4 px | Icon, status, or value micro-gap |
| 8 px | Tight related content and compact controls |
| 12 px | Control padding and dense rows |
| 16 px | Default component padding and field grouping |
| 20–24 px | Card sections, panels, and related groups |
| 32–40 px | Major workspace sections |
| 48–64 px | Sparse onboarding or major separation |

Use 16 px page gutters on mobile, 20–24 px on tablet, and 24–32 px on desktop. Use the smallest spacing that clearly expresses the relationship. Component internal spacing should remain stable even when external layout spacing changes.

## Do

- Select values from the documented scale.
- Keep equivalent component anatomy consistently spaced.
- Group labels, values, and help text by proximity.
- Increase separation between distinct workflow stages.
- Preserve accessible touch targets when density increases.

## Don't

- Do not introduce arbitrary gaps or margins.
- Do not use empty cards solely to manufacture whitespace.
- Do not make every section equally distant from every other section.
- Do not compress forms or action groups until they become error-prone.
- Do not add space around unclear content instead of fixing hierarchy.

## Future Considerations

- Named semantic spacing tokens for component and layout roles.
- Comfortable and compact density modes.
- Platform-specific spacing adjustments for future native applications.
- Automated detection of off-scale values in implementation.
