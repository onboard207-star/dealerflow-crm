# Design Foundations v1

## Color system

Color is semantic, restrained, and theme-aware. Components consume role-based tokens; raw palette values stay inside the token layer. The reference values below define the intended v1 direction and do not change the current application tokens.

### Reference palette

| Category | Light reference | Dark reference | Intended use |
| --- | --- | --- | --- |
| Brand | `#4F5FDB` | `#7C8CFF` | Primary actions, current selection, focus emphasis, restrained brand moments |
| AI | `#7C3AED` | `#A78BFA` | AI-originated suggestions, controls, and explanations only |
| Success | `#15803D` | `#4ADE80` | Completed, healthy, approved, or positive outcomes |
| Warning | `#B45309` | `#FBBF24` | Attention, delay, incomplete requirements, or recoverable risk |
| Danger | `#DC2626` | `#F87171` | Destructive actions, failure, blocking errors, or critical risk |
| Neutral | Slate-based | Cool gray-based | Text, structure, disabled states, and non-semantic metadata |

Brand is not a decoration color. Use it for a single dominant action, selected navigation, focus, and concise emphasis—not large background fields or every interactive element.

AI color indicates provenance, not quality or certainty. AI content must also carry a label, icon, or explanatory text. Never recolor ordinary automation as AI.

Success, warning, and danger represent system meaning. Pair them with text or icons, and use tinted surfaces with strong foregrounds instead of saturated blocks for routine badges and notices.

### Backgrounds and surfaces

- **Canvas:** the lowest application layer; approximately `#F8F9FB` in light mode and `#0F1115` in dark mode.
- **Surface:** primary content, panels, cards, and menus; white or near-white in light mode and a subtly lifted neutral in dark mode.
- **Subtle surface:** inset groups, table headers, secondary controls, and quiet hover states.
- **Elevated surface:** dialogs, dropdowns, command surfaces, and temporary overlays.
- **Scrim:** neutral-black transparency used behind modal layers; never use brand color for modal dimming.

Use surface contrast and borders before shadows. Adjacent persistent surfaces need enough luminance separation to remain legible in both themes.

### Borders and interaction color

- Default borders quietly define structure and inputs.
- Strong borders indicate selection, emphasis, or high-value separation.
- Focus rings use the brand family with sufficient contrast against both the component and surrounding surface.
- Disabled borders and content remain perceivable without implying availability.
- Separators should organize content, not produce a boxed grid around every region.

Do not introduce literal colors in application components when a semantic token exists. Color must not be the only signal for status, validation, selection, AI provenance, or urgency.

## Typography

Typography creates hierarchy with size, weight, spacing, and placement before color. DealerFlow uses a neutral, highly legible system sans stack for v1 and a system monospace stack for identifiers.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | 30–36 / 36–44 px | 600 | Rare onboarding or major empty-state statements |
| Workspace title | 24–30 / 30–36 px | 600 | Primary context heading |
| Section title | 18–20 / 24–28 px | 600 | Major content groups |
| Component title | 14–16 / 20–24 px | 600 | Cards, panels, dialogs, and table groups |
| Body | 14 / 20 px | 400 | Default interface copy and values |
| Label | 12–14 / 16–20 px | 500–600 | Controls, column headers, and compact actions |
| Metadata | 12 / 16 px | 400–500 | Timestamps, supporting context, and counts |
| Micro | 11 / 14 px | 500–600 | Short uppercase group labels only |

Use sentence case. Avoid all caps except short navigation group labels or regulated abbreviations. Keep body copy left-aligned, use tabular numerals for comparable financial or performance values, and reserve monospaced text for technical identifiers. Avoid weights above 700 and muted text below accessible contrast.

## Spacing system

Use a four-pixel base grid, expressed through the existing Tailwind scale. The preferred set is `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` px.

- `4 px`: icon or status micro-gaps.
- `8 px`: tightly related content and compact control gaps.
- `12 px`: control padding and dense row spacing.
- `16 px`: default component padding and field groups.
- `20–24 px`: card sections, panel padding, and related component groups.
- `32–40 px`: major workspace sections.
- `48–64 px`: sparse marketing-like or onboarding compositions only.

Mobile layouts generally use 16 px page gutters, tablets 20–24 px, and desktops 24–32 px. Dense operational tables may use 12 px vertical cell padding; do not reduce interactive targets below accessible sizes. Avoid arbitrary spacing and do not use empty space to conceal weak information hierarchy.

## Radius

Use a restrained family of radii:

- Small, 6–8 px: badges, compact inputs, and small controls.
- Medium, 10–12 px: buttons, inputs, cards, and menus.
- Large, 14–16 px: dialogs, command surfaces, and major floating panels.
- Full: avatars, circular icon controls, and true pills only.

Do not use pill shapes for ordinary rectangular controls. Nested elements should not have equal or larger radii than their container without a clear reason.

## Elevation

Elevation communicates layer and interaction priority, never luxury through heavy shadow.

| Level | Treatment | Use |
| --- | --- | --- |
| 0 | Canvas or surface contrast, no shadow | Page canvas, inset sections |
| 1 | Quiet border and minimal ambient shadow | Cards, sticky toolbars, persistent panels |
| 2 | Defined border plus soft medium shadow | Dropdowns, popovers, command suggestions |
| 3 | Scrim plus broad soft shadow | Dialogs, mobile drawers, critical floating surfaces |

Prefer borders for persistent structure and shadows for temporary layers. Shadows should be neutral, diffuse, and weaker in dark mode. Avoid stacked shadows, colored glows, glassmorphism that harms contrast, and elevation changes that cause layout movement.

## Icon standards

- Use Lucide icons through `lucide-react`.
- Use 16 px in compact controls, 18–20 px in standard controls, and 24 px only for prominent empty states or navigation moments.
- Pair unfamiliar icons with text; do not rely on ambiguous symbols.
- Decorative icons must be hidden from assistive technology.
- Icon-only controls require an accessible name and an adequate target size.
- Use stroke and color consistently with surrounding text and state.
- Do not mix icon families without an explicit design-system decision.
- Automotive icons should be literal and operational—vehicle, key, wrench, document—not decorative speedometers, racing flags, or brand-like vehicle silhouettes.

## Responsive layout

Follow Tailwind's configured mobile-first breakpoints unless the application configuration changes them:

- Base: mobile and narrow layouts.
- `sm` (640 px): larger mobile and compact tablet refinements.
- `md` (768 px): tablet layout and increased navigation/context capacity.
- `lg` (1024 px): desktop shell and persistent sidebar behavior.
- `xl` (1280 px) and `2xl` (1536 px): wider content and information-dense workspace refinements.

Choose breakpoints based on content pressure, not named devices alone. Components must remain usable between defined breakpoints and under text zoom.

### Layout rules

- Build mobile-first and prioritize the current task over secondary context.
- Use one primary column on mobile; introduce split panes only when each pane remains independently usable.
- Convert persistent desktop navigation to an accessible drawer on smaller screens.
- Keep primary actions visible without permanently consuming excessive viewport height.
- Allow content to define maximum readable width; operational tables and boards may use the available viewport.
- Prefer column priority, horizontal scrolling, or list transformation for tables; never squeeze columns into unreadable fragments.
- Reflow action groups before truncating labels. Avoid horizontal scrolling for ordinary forms and prose.
- Test at 320, 390, 768, 1024, 1280, and 1536 px, plus intermediate widths and 200% zoom.
- Account for safe areas, on-screen keyboards, sticky regions, and touch input on mobile devices.

## Light and dark themes

Both themes are first-class. Components must use semantic tokens and be reviewed in each theme.

- Maintain readable text and control contrast.
- Preserve hierarchy without making dark surfaces uniformly black or light surfaces uniformly white.
- Keep borders visible but quiet.
- Adjust elevation and overlays for the surrounding luminance.
- Preserve the meaning of primary and feedback colors across themes.
- Avoid theme-specific markup or duplicated component trees.
- Respect the system preference by default and persist an explicit user choice.

The current token values are authoritative until a task explicitly changes them.
