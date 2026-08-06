# Creating a New Reusable Component

Use this checklist when the component library doesn't yet have something you need. Take `Tooltip.tsx` or `CalloutBox.tsx` as reference-quality examples of the target shape — small, focused, well-commented.

## 1. Confirm it doesn't already exist

Check `docs/components.md` and skim `src/shared/components/`. A slightly different prop shape on an existing component is usually a smaller change than a new file.

## 2. Check the Design System first

If there's a matching section in `cellfie-design-system.md` (§10.x has 22 component specs), build to that spec exactly — colors, spacing, radius, elevation, and states are already decided; don't reinterpret them. If there's no matching section, follow the five visual identity principles in §1 (paper over glass, ink over color, chapter not dashboard, one signature quietly repeated, timeless not trendy) and stay consistent with how the existing components in this library read.

## 3. File template

```tsx
import { cn } from '../utils/cn'
// import icons from '@phosphor-icons/react' if needed
// import hooks from '../hooks' if needed (useClickOutside, useFocusTrap, etc.)

interface MyComponentProps {
  // required props first, optional props with '?' after
  className?: string
}

/**
 * MyComponent — Design System §10.X (if applicable).
 * One or two sentences on what it's for and any non-obvious behavior.
 */
export function MyComponent({ className, ...rest }: MyComponentProps) {
  return <div className={cn('...', className)}>{/* ... */}</div>
}
```

## 4. Requirements before it's "done"

- **Controlled, not self-fetching.** Data comes in via props; changes go out via callbacks. No component should import from `core/db`, `react-router-dom`'s data APIs, or any module.
- **Uses design tokens, not literals.** Colors as `bg-surface`/`text-ink-primary`/etc., spacing as `p-4`/`gap-6`/etc., motion as `duration-standard ease-standard`. If you need a hex value or a raw `ms` number, that's a sign a token is missing — add it to `tailwind.config.ts` / `index.css` rather than inlining it.
- **Accessible by default:**
  - Interactive elements are real `<button>`/`<a>`/form elements, not `<div onClick>`.
  - Icon-only controls have `aria-label`.
  - Anything that opens/closes has the right `aria-expanded`/`aria-pressed`/`aria-checked` and is reachable/dismissable by keyboard (Esc, Tab, arrow keys where the Design System specifies them).
  - Color-coded states are paired with an icon, label, or shape — never color alone.
- **Respects reduced motion.** If you're using Tailwind transition utilities or the CSS transitions already defined, this is handled globally — you don't need to add anything. If you're doing something more involved (JS-driven animation, `requestAnimationFrame`), branch on `useReducedMotion()` from `shared/hooks`.
- **Theme-safe.** Test it with the Settings page's theme switcher in both Light and Dark before considering it finished — anything that looks wrong in one theme usually means a hardcoded color slipped in somewhere.

## 5. Export it

Add `export * from './MyComponent'` to `src/shared/components/index.ts` (or `shared/layouts/index.ts` for a layout), and add a row to `docs/components.md`.

## 6. Where hooks belong

If your component needs new shared behavior (say, a `useDebounce`), put it in `src/shared/hooks/` with the same pattern as the existing hooks (small, single-purpose, exported from `hooks/index.ts`) rather than inlining complex logic into the component file.
