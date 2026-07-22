# Motion Standards v1

## Motion principles

Motion should explain change, reinforce spatial relationships, and provide feedback. It must not slow frequent work or compete with dealership information.

- Use motion to show where an element came from, what changed, or whether an action succeeded.
- Keep repeated operational interactions restrained and fast.
- Animate opacity and transforms when practical; avoid layout-heavy animation.
- Never rely on animation alone to communicate state.

## Durations

Use these ranges as guidance, selecting the shortest duration that remains understandable:

- Immediate feedback and micro-interactions: 80–140 ms.
- Hover, focus-adjacent, and small state transitions: 120–180 ms.
- Dropdowns, menus, and compact overlays: 140–220 ms.
- Drawers and dialogs: 180–280 ms.
- Large layout transitions: 240–360 ms and only when they clarify spatial change.

Recommended v1 motion tokens:

- `motion-instant`: 80 ms.
- `motion-fast`: 120 ms.
- `motion-standard`: 180 ms.
- `motion-overlay`: 240 ms.
- `motion-layout`: 320 ms.

Avoid arbitrary per-component durations. Related transitions should share timing, and exits should usually use the next faster token.

## Easing

- Entrances: decelerating ease-out so elements arrive cleanly.
- Exits: accelerating ease-in so elements leave promptly.
- State changes in place: balanced ease-in-out.
- Avoid spring or bounce effects for routine enterprise interactions unless a future motion token explicitly defines them.

Recommended CSS curves:

- Enter: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Exit: `cubic-bezier(0.4, 0, 1, 1)`.
- Standard: `cubic-bezier(0.4, 0, 0.2, 1)`.

## Hover and focus behavior

Hover may adjust surface, border, foreground, or elevation subtly. It must not move layout or reveal essential information unavailable to keyboard and touch users.

Focus states are immediate, visible, and token-based. Do not animate focus indicators in ways that delay recognition. Keyboard focus and hover may share supporting surface changes, but focus must remain independently identifiable.

## Drawers, dialogs, dropdowns, and menus

- Drawers should enter from their spatial origin while the overlay fades in.
- Dialogs may combine a short opacity transition with subtle scale or vertical movement.
- Dropdowns and menus should appear near their trigger with restrained opacity and translation.
- Exits should be slightly faster than entrances.
- Focus movement, trapping, return, and dismissal behavior must remain correct regardless of animation.
- Background interaction must be blocked only for modal surfaces.

## Loading transitions

Avoid showing a spinner for work that completes nearly instantly. Use stable skeletons when content shape is known and a compact progress indicator when it is not. Prevent loading states from causing repeated layout shifts. Transition to loaded content with minimal opacity change rather than staged decorative animation.

Long-running operations should expose meaningful progress or status text when available. Loading animation must not imply completion.

## Reduced motion

Honor `prefers-reduced-motion: reduce`:

- Remove nonessential translation, scaling, parallax, and looping animation.
- Reduce required transitions to near-immediate opacity or state changes.
- Preserve functional feedback and final states.
- Do not disable focus indicators, loading status, or other essential communication.

Reduced-motion behavior is a component requirement and should be tested alongside default motion.
