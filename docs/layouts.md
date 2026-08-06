# Layouts

Layouts live in `src/shared/layouts/` and are re-exported from `src/shared/layouts/index.ts`. A layout only provides structure — max-width, columns, headers — never real content or data fetching. Every module page picks the layout that matches its content shape, per the Design System's container-width rules (§4.2).

| Layout | Use it for | Max width |
|---|---|---|
| `DashboardLayout` | Grids of cards/sections — Dashboard, Library toolbar+grid | 1200px (`max-w-content`) |
| `ReadingLayout` | Long-form content — Learn topics, Notes, Settings | 680px (`max-w-reading`) |
| `SplitLayout` | Two-pane views — PDF Reader + side panel | full width, configurable split |
| `ComparisonLayout` | Side-by-side comparisons — Comparison Studio | 960px (`max-w-comparison`) |
| `LaboratoryLayout` | Persistent left index + content — Laboratory | 1200px (`max-w-content`) |
| `EmptyStateLayout` | Centering a single `EmptyState` on an otherwise-empty page | 1200px |
| `LoadingLayout` | Wrapping skeleton placeholders while data loads | 1200px |
| `ErrorLayout` | Full-page error/404 states | 1200px |

## Picking the right one

Ask what the content's *shape* is, not what module it belongs to:

- A collection of independent cards/sections → `DashboardLayout`
- A single long document meant to be read start to finish → `ReadingLayout`
- Two related panes where one supports the other → `SplitLayout`
- Exactly two things being weighed against each other → `ComparisonLayout`
- A fixed list of sections plus whatever's currently selected → `LaboratoryLayout`

If a module's content shape doesn't match any of these as it develops, that's a sign a ninth layout is genuinely needed — add it here rather than forcing an odd fit, but check the existing seven first since most page shapes really do reduce to one of them.
