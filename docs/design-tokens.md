# Design Tokens

Every value below is copied exactly from `cellfie-design-system.md` — nothing here is approximated. There are two layers:

1. **CSS custom properties** in `src/index.css` — these hold the actual color values and flip when `data-theme` changes on `<html>`.
2. **Tailwind config** in `tailwind.config.ts` — maps utility class names to those CSS variables (for colors) or to literal values (for spacing/type/radius/etc., which don't change between themes).

You style things with Tailwind classes; you never need to reach for a CSS variable directly unless you're writing raw CSS (as in a couple of spots in `index.css` itself, like the scrim and the deckled-edge SVG).

## Colors

| Tailwind class | CSS variable | Light value | Dark value |
|---|---|---|---|
| `bg-canvas` | `--color-bg-canvas` | `#F6F1E7` | `#221E19` |
| `bg-surface` | `--color-bg-surface` | `#EFE7D8` | `#2A251E` |
| `bg-surface-raised` | `--color-bg-surface-raised` | `#E7DCC7` | `#332C23` |
| `border-border` / `border` | `--color-border` | `#DCCFB4` | `#413828` |
| `border-border-strong` | `--color-border-strong` | `#C7B999` | `#54492F` |
| `text-ink-primary` | `--color-text-primary` | `#3A2E22` | `#EEE3D0` |
| `text-ink-secondary` | `--color-text-secondary` | `#6C5A46` | `#C3B49B` |
| `text-ink-tertiary` | `--color-text-tertiary` | `#9C8A71` | `#8E7E67` |
| `text-olive` / `bg-olive` | `--color-accent-olive` | `#6E7A41` | `#95A566` |
| `text-sage` / `bg-sage` | `--color-accent-sage` | `#A6B48C` | `#B7C29E` |
| `text-terracotta` / `bg-terracotta` | `--color-highlight-terracotta` | `#BE6A48` | `#D48861` |
| `text-success` | `--color-success` | `#4C6B45` | `#7A9A6E` |
| `text-warning` | `--color-warning` | `#B8843C` | `#D2A15E` |
| `text-error` | `--color-error` | `#A24B3D` | `#C26C5B` |

**Usage rule (Design System §2.3):** 90% of any screen should be neutral tokens. Terracotta is the one "loudest" color — one primary action or focal point per screen, never a large fill. Never rely on color alone to convey meaning; always pair with an icon, label, or pattern (every component in this library already does this — see `CalloutBox`, `ComparisonTable`, `Sidebar`'s active state).

### Accent "wash" utilities

Low-opacity tinted fills (active nav state, collection card swatches, destructive-hover backgrounds) are implemented as dedicated classes in `index.css` — `.wash-olive`, `.wash-sage`, `.wash-terracotta`, `.wash-error`, `.hover-wash-error` — using `color-mix()` rather than Tailwind's `/opacity` modifier. Our palette is CSS-variable-driven rather than using Tailwind's rgb-channel color function convention, so the slash modifier (e.g. `bg-olive/15`) won't reliably apply alpha to a `var(--color-...)` reference. Add new washes the same way if you need another one.

## Typography

| Role | Tailwind class(es) | Face | Size / line-height |
|---|---|---|---|
| Display | `font-display text-display` | Fraunces 600 | 40px / 1.15 |
| H1 | `font-display text-h1` | Fraunces 600 | 32px / 1.2 |
| H2 | `font-display text-h2` | Fraunces 500 | 24px / 1.25 |
| H3 | `font-display text-h3` | Fraunces 500 | 20px / 1.3 |
| Body Large | `font-body text-body-lg` | Literata 400 | 18px / 1.7 |
| Body | `font-body text-body` | Literata 400 | 16px / 1.65 |
| UI | `font-ui text-ui` | Karla 500 | 14px / 1.5 |
| Caption | `font-ui text-caption` | Karla 400 | 13px / 1.4 |
| Micro | `font-ui text-micro` | Karla 500, uppercase, tracked | 11px / 1.3 |

Prefer the ready-made components in `src/shared/components/Typography.tsx` (`<Display>`, `<H1>`, `<H2>`, `<H3>`, `<BodyLg>`, `<Body>`, `<UIText>`, `<Caption>`, `<Micro>`) over hand-assembling the classes — they encode the correct default HTML tag for each role and keep the font-family/size pairing from ever drifting apart.

**Hard rule from the Design System (§3.1), enforced by convention here, not by the compiler:** Fraunces (`font-display`) is headings only, never body copy. Literata (`font-body`) is reading content only, never UI chrome (buttons, nav, labels). If you're tempted to use `font-body` on a button, that's a signal something's misclassified.

## Spacing

4px base unit. Tailwind's default numeric spacing scale is overridden to match exactly:

`1`→4px `2`→8px `3`→12px `4`→16px `5`→20px `6`→24px `8`→32px `10`→40px `12`→48px `16`→64px `20`→80px `24`→96px

Use as normal Tailwind spacing utilities: `p-4`, `gap-6`, `mb-8`, etc.

## Radius

`rounded-sm` = 6px (chips, inputs, tags) · `rounded-md` = 10px (buttons, cards) · `rounded-lg` = 16px (dialogs, sheets, illustration frames) · `rounded-full` = 999px (pills, avatars)

## Elevation

`shadow-0` (none, border only) · `shadow-1` (hover on cards/dropdowns) · `shadow-2` (tooltips, menus, popovers) · `shadow-3` (dialogs, sheets)

## Motion

| Token | Value | Tailwind |
|---|---|---|
| micro | 120ms | `duration-micro` |
| standard | 220ms | `duration-standard` |
| page | 320ms | `duration-page` |
| ease-standard | `cubic-bezier(0.4,0,0.2,1)` | `ease-standard` |
| ease-entrance | `cubic-bezier(0,0,0.2,1)` | `ease-entrance` |

The same values are also exposed as raw CSS variables (`--motion-micro`, `--motion-ease-entrance`, etc.) for the couple of places that need hand-written CSS (the page-enter keyframe).

**Reduced motion is handled globally** — `index.css` collapses all animation/transition durations to near-zero under `prefers-reduced-motion: reduce`. You don't need to add a reduced-motion branch to new components; it's covered by the global rule unless you're doing something unusual (a canvas animation, a `requestAnimationFrame` loop) that the CSS rule can't reach.

## Breakpoints & Containers

| Name | Min-width | Tailwind prefix |
|---|---|---|
| Tablet | 640px | `sm:` |
| Desktop | 1024px | `md:` |
| Wide | 1440px | `lg:` |

Container widths: `max-w-reading` (680px), `max-w-content` (1200px), `max-w-comparison` (960px). Sidebar width: `w-sidebar` (280px) / `w-rail` (64px, tablet icon rail).
