# Tables

## Purpose

Tables support comparison, scanning, sorting, and action across stable record sets. They should make operational patterns visible without becoming a wall of fields.

## Principles

- Columns exist to support comparison or action.
- Primary identity and critical status remain visible.
- Numerical data is aligned for scan speed.
- Dense data does not excuse poor accessibility.
- Responsive behavior is designed, not improvised.

## Usage Guidelines

Provide a visible title or accessible name, semantic column headers, and predictable alignment. Align text left, comparable numbers right, and concise statuses consistently. Use tabular numerals for currency, percentages, inventory age, and performance measures.

Default rows are approximately 44–52 px high. Use quiet headers and subtle row separation rather than heavy grids. Sticky headers or columns must preserve clear boundaries and never obscure focus. Truncated values require a reliable way to access the full content.

On narrow screens, prioritize columns, allow deliberate horizontal scrolling, or transform records into structured lists. Sorting, selection, pagination, filters, and row actions must work by keyboard and expose state to assistive technology.

## Do

- Keep table actions close to the records they affect.
- Preserve context during loading, empty, partial, and error states.
- Use concise column labels and consistent formats.
- Announce sorting and selection changes.
- Provide batch-action feedback and safe reversal when practical.

## Don't

- Do not expose every available field as a column.
- Do not shrink text or controls to force a table into mobile width.
- Do not use both full-row navigation and conflicting nested click targets.
- Do not rely on row color alone for status or selection.
- Do not hide critical values behind horizontal scrolling without priority review.

## Future Considerations

- Virtualization standards for large data sets.
- User-managed columns, saved views, and density modes.
- Inline editing and validation patterns.
- Advanced comparison, grouping, and export behavior.
