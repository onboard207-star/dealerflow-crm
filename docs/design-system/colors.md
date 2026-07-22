# Colors

## Purpose

Color establishes hierarchy, communicates state, and creates a confident DealerFlow identity across light and dark themes. It is functional before it is expressive.

## Principles

- Use semantic color roles rather than raw palette values.
- Reserve saturated color for action, feedback, selection, and provenance.
- Keep persistent work surfaces neutral and calm.
- Color never carries meaning alone.
- Light and dark themes preserve meaning, not necessarily identical values.

## Usage Guidelines

### Reference direction

| Family | Light reference | Dark reference | Role |
| --- | --- | --- | --- |
| Brand | `#4F5FDB` | `#7C8CFF` | Primary action, selection, focus, restrained identity |
| AI | `#7C3AED` | `#A78BFA` | AI provenance and AI-specific controls |
| Success | `#15803D` | `#4ADE80` | Complete, approved, healthy, delivered |
| Warning | `#B45309` | `#FBBF24` | Attention, waiting, incomplete, at risk |
| Danger | `#DC2626` | `#F87171` | Failure, blocked, rejected, destructive |
| Neutral | Cool slate | Cool gray | Text, controls, structure, metadata |

These values document direction for future token implementation; application code continues to use the current approved tokens until a separate implementation task.

### Semantic roles

- **Background:** application canvas; near-white in light mode and deep neutral in dark mode.
- **Surface:** primary content, cards, panels, menus, and controls.
- **Surface subtle:** table headers, inset groups, quiet hover states, and secondary controls.
- **Surface elevated:** dialogs, dropdowns, command surfaces, and popovers.
- **Foreground:** primary content with the strongest readable contrast.
- **Foreground muted:** supporting metadata that still meets contrast requirements.
- **Border:** quiet structural separation.
- **Border strong:** focus-adjacent, selected, or emphasized separation.
- **Scrim:** neutral translucent layer behind modal content.

Brand is not a general decoration color. AI color identifies origin, not certainty. Feedback colors use tinted surfaces and readable text for routine states; saturated fills are reserved for urgent or compact moments.

## Do

- Pair feedback and AI color with text or an icon.
- Check contrast in every state and theme.
- Use neutral surfaces to keep operational information calm.
- Use one dominant brand action in a region.

## Don't

- Do not add literal colors to product components when a semantic role exists.
- Do not use arbitrary colors for pipeline stages or categories.
- Do not tint large surfaces with brand or AI color.
- Do not reduce disabled content below usable contrast.
- Do not use automotive clichés such as metallic gradients or neon racing palettes.

## Future Considerations

- Founder approval of final brand and AI hues.
- Accessible categorical colors for data visualization.
- High-contrast theme overrides.
- Customer-facing color extensions that remain recognizably DealerFlow.
