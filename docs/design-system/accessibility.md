# Accessibility

## Purpose

Accessibility ensures DealerFlow remains usable by dealership staff across abilities, devices, environments, and input methods. It is a requirement for component and feature correctness.

## Principles

- Target WCAG 2.2 AA for product interfaces.
- Use semantic HTML before additional accessibility attributes.
- Keyboard, touch, pointer, and assistive-technology paths are equivalent.
- Status and action never depend on color, motion, or hover alone.
- Accessibility behavior belongs inside reusable components where possible.

## Usage Guidelines

### Contrast and perception

- Normal text requires at least 4.5:1 contrast.
- Large text requires at least 3:1 contrast.
- Meaningful control boundaries, focus indicators, and graphics require at least 3:1 against adjacent colors.
- Support light, dark, high-contrast, and reduced-motion preferences where available.

### Keyboard and focus

Every interaction must be reachable and operable in a logical order. Focus indicators must remain visible, consistent, and unobscured by sticky UI. Dialogs and drawers trap focus when modal, support expected dismissal, and return focus to the trigger. Menus, tabs, and composite controls follow established keyboard conventions.

### Names, structure, and feedback

Controls need accessible names; inputs need associated labels; pages and regions need meaningful headings and landmarks. Validation, loading, completion, and asynchronous changes must be announced when they are not otherwise evident. Use live regions sparingly and avoid repeated announcements.

### Responsive and physical access

Content must remain usable at 200% zoom and reflow without losing information or actions. Touch targets should be at least 44 by 44 CSS pixels when practical. Do not require precise gestures, hover, drag, or a single orientation without an alternative.

## Do

- Test complete keyboard flows and focus restoration.
- Verify names, roles, states, labels, and announcements.
- Test zoom, text expansion, themes, and reduced motion.
- Include accessibility acceptance criteria in component specifications.
- Use real content shapes when testing truncation and reflow.

## Don't

- Do not add redundant accessibility attributes to native controls.
- Do not remove focus outlines without an equal or stronger replacement.
- Do not use disabled controls when an explanation and available path are required.
- Do not hide essential content only for visual cleanliness.
- Do not claim accessibility based only on automated testing.

## Future Considerations

- Automated accessibility checks in development and CI.
- Screen-reader and voice-control test matrices.
- Accessibility release gates and defect severity standards.
- Documented support for high-contrast and cognitive accessibility preferences.
- Regular testing with disabled users and dealership professionals.
