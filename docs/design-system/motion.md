# Motion

## Purpose

Motion explains change, reinforces spatial relationships, and confirms interaction. It should make DealerFlow feel fast and intentional without adding spectacle or slowing frequent work.

## Principles

- Motion serves orientation, feedback, or continuity.
- Repeated operational interactions stay restrained and quick.
- Opacity and transform are preferred over layout-heavy animation.
- Exit transitions are usually faster than entrances.
- No essential meaning depends on animation.

## Usage Guidelines

### Duration tokens

| Token | Duration | Use |
| --- | ---: | --- |
| Instant | 80 ms | Pressed states and immediate feedback |
| Fast | 120 ms | Hover and small state changes |
| Standard | 180 ms | Dropdowns, menus, and common transitions |
| Overlay | 240 ms | Dialogs, drawers, and scrims |
| Layout | 320 ms | Rare, meaningful spatial transitions |

### Easing

- Enter: decelerating ease-out.
- Exit: accelerating ease-in.
- State change: balanced ease-in-out.
- Avoid bounce and elastic springs in routine enterprise interactions.

Drawers enter from their spatial origin. Dialogs use restrained opacity with subtle scale or vertical movement. Dropdowns remain anchored to their trigger. Loading transitions preserve layout and avoid showing a spinner for near-instant work.

Honor reduced-motion preferences by removing nonessential translation, scaling, parallax, and looping animation. Preserve functional feedback and final states.

## Do

- Use shared duration and easing tokens.
- Animate only the properties needed to explain a change.
- Keep focus management correct throughout overlay transitions.
- Test interruption, rapid repetition, and reduced motion.

## Don't

- Do not animate for decoration or personality alone.
- Do not delay navigation or primary actions to finish an animation.
- Do not move layout on hover.
- Do not use continuous motion in information-dense workspaces.
- Do not disable focus or loading communication under reduced motion.

## Future Considerations

- Shared transition presets for overlays and workspace changes.
- Performance budgets for motion on lower-powered mobile devices.
- Cross-platform motion parity for future native experiences.
- Research into perceived speed during long-running dealership operations.
