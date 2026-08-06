# Adding a New Page

This walks through adding a page the same way the 8 existing placeholders were built. Say you're adding a real Learn topic page once Phase 2 starts.

## 1. Create the module folder (if it doesn't exist)

```
src/modules/learn/
└── TopicPage.tsx
```

If the module already exists (e.g. you're adding a second page to `concepts/`), just add the new file there.

## 2. Build the page using existing layouts and components

```tsx
// src/modules/learn/TopicPage.tsx
import { ReadingLayout } from '@/shared/layouts'
import { Tabs, IllustrationFrame } from '@/shared/components'

export function TopicPage() {
  return (
    <ReadingLayout title="ELISA" eyebrow="Immunology">
      {/* real content goes here once the data model exists */}
    </ReadingLayout>
  )
}
```

Reach for `shared/components` and `shared/layouts` first. Only build something module-local if it's genuinely specific to that module and won't be reused — and even then, consider whether it's actually a missing entry in `shared/components`.

## 3. Register the route

Add it to `src/app/router.tsx`:

```tsx
import { TopicPage } from '../modules/learn/TopicPage'
// ...
<Route path="/learn/:topicId" element={<TopicPage />} />
```

## 4. Add it to navigation (if it should appear in the sidebar/bottom nav)

Edit `src/config/navigation.ts` — add an entry to the `navItems` array with a `path`, `label`, a Phosphor icon, and whether it belongs in `inBottomNav`. Nothing else needs to change; `Sidebar` and `BottomNav` both read from this one array.

If the page is reached only by drilling in from somewhere else (like a topic page reached from a card, not from the sidebar), skip this step — just register the route.

## 5. Respect module boundaries

Don't import anything from another module's folder (`src/modules/*`). If two modules need to share something, it belongs in `shared/` or `core/`. This is the one rule that keeps the whole app addable-to without needing a refactor pass later.

## 6. Accessibility checklist for any new page

- Page has exactly one `<h1>` (a layout's `title` prop usually handles this).
- Every interactive element is reachable by keyboard and has a visible focus state (inherited automatically if you're using `shared/components`).
- Loading states use `LoadingLayout` + `Skeleton`/`SkeletonCard`, not a bare spinner.
- Empty/zero-data states use `EmptyState`, not a blank div.
- Color is never the only signal of state — pair with an icon or label (this matters most for anything with a "selected/active/error" concept).
