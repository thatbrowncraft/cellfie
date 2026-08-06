# Component Library

All components live in `src/shared/components/` and are re-exported from `src/shared/components/index.ts`, so you can import any of them as:

```tsx
import { Button, Card, Dialog } from '@/shared/components'
```

Every component below maps to a numbered section in the Design System (§10.x) — check that section if you want the full visual spec behind a choice.

| Component | File | Design System | Notes |
|---|---|---|---|
| `Display`, `H1`, `H2`, `H3`, `BodyLg`, `Body`, `UIText`, `Caption`, `Micro` | `Typography.tsx` | §3 | Prefer these over hand-assembled classes |
| `Button` | `Button.tsx` | §10.1 | `variant`: primary/secondary/tertiary, `size`: default/small |
| `Card`, `CardHeader`, `CardBody`, `CardFooter` | `Card.tsx` | §10.2 | Set `interactive` for the hover-lift + focus-ring behavior |
| `Input` | `Input.tsx` | §10.3 | Label is required, never placeholder-only |
| `SearchField`, `UniversalSearch` | `SearchField.tsx` | §10.7 | `UniversalSearch` is the Cmd/Ctrl+K overlay, wired up in `AppShell` |
| `Dropdown` | `Dropdown.tsx` | §10.4 | Full arrow-key navigation, `role="listbox"` |
| `Tabs` | `Tabs.tsx` | §10.8 | Arrow-key navigation between tabs, supports a `disabled` tab state |
| `Accordion` | `Accordion.tsx` | §10.9 | `allowMultiple` prop for independent open sections |
| `Dialog` | `Dialog.tsx` | §10.19 | Focus-trapped, returns focus to trigger on close |
| `BottomSheet` | `BottomSheet.tsx` | §10.20 | Mobile equivalent of `Dialog`; snaps open/closed, no peek state |
| `ContextMenu` | `ContextMenu.tsx` | §10.21 | Always paired with a visible kebab trigger, never right-click-only |
| `Tooltip` | `Tooltip.tsx` | §10.18 | 400ms hover delay; also triggers on focus |
| `CalloutBox` | `CalloutBox.tsx` | §10.10 | `type`: tip/warning/safety/aside |
| `ComparisonTable` | `ComparisonTable.tsx` | §10.11 | Real `<table>` semantics; `differs` flag marks a row with a dot, not full-row color |
| `IllustrationFrame` | `IllustrationFrame.tsx` | §7, §10.13 | The one signature visual element — deckled edge + specimen-label tab |
| `Skeleton`, `SkeletonText`, `SkeletonCard` | `LoadingSkeleton.tsx` | §12 | Calm pulse, preferred over spinners |
| `EmptyState` | `EmptyState.tsx` | — | General-purpose empty/zero-data pattern used across every module page |
| `SourceCitation` | `SourceCitation.tsx` | §10.17 | Renders `[¹]` style inline citation markers |
| `BookmarkToggle` | `Bookmark.tsx` | §10.15 | `aria-pressed` toggle, olive outline → terracotta fill |
| `CollectionCard` | `CollectionCard.tsx` | §10.16 | Meant to sit in a horizontally-scrollable shelf (`overflow-x-auto flex gap-4`) |
| `ThemeToggle` | `ThemeToggle.tsx` | §10.5, §11 | System/Light/Dark picker, used in `TopNav` |
| `QuickCaptureFab` | `QuickCaptureFab.tsx` | §10.22 | The one justified FAB in Cellfie — always pair with a keyboard-reachable alternative |

## Conventions every component follows

- **Accessible by default.** Labels, `aria-*` attributes, and keyboard support are built in, not bolted on — see `docs/adding-a-page.md` and `docs/creating-a-component.md` for what's expected of new ones.
- **Controlled, not self-fetching.** Every component takes data via props and reports changes via callbacks (`onChange`, `onToggle`, `onSelect`). None of them know about `IndexedDB`, routing, or any module's data — that's what keeps them reusable across modules that don't yet exist.
- **Theme-aware without a `theme` prop.** Because every color is a CSS variable, components never need to know or care which theme is active — swap `data-theme` on `<html>` and every open component updates instantly.
- **Motion tokens, not magic numbers.** Transitions use `duration-micro` / `duration-standard` / `duration-page` and `ease-standard` / `ease-entrance` — never a bespoke `150ms` typed directly into a component.
