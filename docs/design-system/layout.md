# Layout

## Purpose

Layout organizes complex dealership work into predictable, responsive regions. It establishes a stable shell while allowing each workspace to prioritize its domain.

## Principles

- Mobile-first, content-driven responsiveness.
- Stable navigation and orientation across modules.
- One clear primary task per view.
- Progressive disclosure for secondary detail.
- Operational density without visual clutter.
- Context should survive movement between related records and workspaces.

## Usage Guidelines

### Grid system

- Mobile: four-column conceptual grid with 16 px gutters.
- Tablet: eight-column conceptual grid with 20–24 px gutters.
- Desktop: twelve-column conceptual grid with 24–32 px gutters.
- Use consistent internal gaps of 16–24 px.
- Grids guide alignment; components may span or nest columns when their content requires it.

### Breakpoints

- Base: narrow mobile layouts.
- `sm`, 640 px: larger mobile refinements.
- `md`, 768 px: tablet composition.
- `lg`, 1024 px: persistent desktop navigation.
- `xl`, 1280 px: wider operational layouts.
- `2xl`, 1536 px: large-screen refinement, not uncontrolled stretching.

Choose a breakpoint when content becomes constrained, not because a named device was detected.

### Workspace composition

Use the stable application shell for global navigation, search, notifications, profile, and theme. Inside a workspace, establish identity and status first, then primary actions, summary, related records, and timeline. Detail panels may use split layouts on large screens and drawers or stacked regions on smaller screens.

Tables may use available width. Prose, forms, and focused tasks should use a readable maximum width. Reflow action groups before truncating labels. Account for safe areas, on-screen keyboards, sticky regions, text zoom, and touch input.

## Do

- Test at 320, 390, 768, 1024, 1280, and 1536 px plus intermediate widths.
- Preserve the primary identity, status, and action when space contracts.
- Use column priority, horizontal table scrolling, or list transformation deliberately.
- Keep sticky elements from obscuring content or focus.
- Let content determine appropriate maximum width.

## Don't

- Do not create desktop-first layouts that collapse as an afterthought.
- Do not use hover-only actions or pointer-only disclosure.
- Do not squeeze tables into unreadable columns.
- Do not apply a fixed maximum width to every operational surface.
- Do not change navigation vocabulary or location by workspace.

## Future Considerations

- Formal workspace templates and split-pane behavior.
- Container queries for reusable responsive components.
- User-controlled density and panel persistence.
- Large-screen operations-center layouts and native mobile patterns.
