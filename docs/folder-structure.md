# Folder Structure

```
cellfie/
├── index.html
├── package.json
├── vite.config.ts          # PWA plugin config, @ path alias
├── tailwind.config.ts      # every design token, translated from the Design System
├── tsconfig.json
├── src/
│   ├── main.tsx             # React root, imports index.css
│   ├── App.tsx              # composition root: ThemeProvider → BrowserRouter → AppRouter
│   ├── index.css            # design tokens as CSS variables (light+dark), base typography,
│   │                         # focus states, reduced-motion, page-transition keyframes
│   │
│   ├── app/                 # the persistent app shell — not a "module," the frame around all of them
│   │   ├── AppShell.tsx      # composes TopNav + Sidebar + BottomNav + content area + FAB + search
│   │   ├── TopNav.tsx
│   │   ├── Sidebar.tsx       # responsive: full sidebar → icon rail → mobile drawer
│   │   ├── BottomNav.tsx     # mobile-only tab bar
│   │   ├── PageTransition.tsx
│   │   └── router.tsx        # <Routes> mapping paths to module pages
│   │
│   ├── modules/              # one folder per feature area — each owns its own page(s)
│   │   ├── dashboard/
│   │   ├── library/
│   │   ├── concepts/         # placeholder for Learn + Concept Explorer (see config/navigation.ts)
│   │   ├── organism-explorer/
│   │   ├── laboratory/
│   │   ├── comparison-studio/
│   │   ├── notes/
│   │   ├── settings/
│   │   └── not-found/
│   │
│   ├── core/                 # cross-cutting infrastructure, no UI
│   │   ├── theme/             # ThemeProvider, useTheme — system/light/dark, persisted
│   │   └── db/                 # IndexedDB availability check only — no schema yet (by design)
│   │
│   ├── shared/                # the reusable UI foundation — this is most of Task 3
│   │   ├── components/          # the ~20 component library entries (see docs/components.md)
│   │   ├── layouts/             # the 8 layout primitives (see docs/layouts.md)
│   │   ├── hooks/                # useMediaQuery, useBreakpoint, useReducedMotion,
│   │   │                          # useLocalStorage, useClickOutside, useFocusTrap, useOnlineStatus
│   │   └── utils/
│   │       └── cn.ts              # tiny classnames joiner (no clsx dependency needed at this scale)
│   │
│   └── config/
│       ├── navigation.ts       # single source of truth for sidebar/bottom-nav items + routes
│       └── subjects.registry.ts # "subjects are data, not code" — empty placeholder registry
│
└── docs/                     # you are here
```

## Why this shape

**`app/` vs `modules/` vs `shared/`.** This mirrors the Software Design Document's core rule: *modules never import each other directly.* `shared/` is the only thing every module is allowed to depend on. `app/` depends on `modules/` (to route to their pages) and `shared/` (for the shell chrome), but no module depends on `app/` or on another module. If Organism Explorer someday needs something Comparison Studio has, that thing belongs in `shared/` or `core/`, not imported cross-module.

**`core/` has no UI.** Theme and persistence are infrastructure, not components. This keeps `shared/components` free of anything that talks to `localStorage` or `IndexedDB` directly — components take props and call callbacks; `core/` and page components are where side effects happen.

**Every module is a folder, not a file**, even though each currently holds one page component. This is deliberate — Phase 1+ will add hooks, sub-components, and (eventually) module-local state to these folders without needing to restructure anything, per the module-manifest pattern described in the Software Design Document.

**`concepts/` is one folder standing in for two future modules.** See the comment at the top of `src/config/navigation.ts` for the full reasoning — the short version is that Task 3's brief specifies 8 routes, which condenses the SDD's separate Learn and Concept Explorer modules into one. Splitting it later means adding a folder and a route, not restructuring anything.
