import type { Config } from 'tailwindcss'

// Cellfie design tokens, translated 1:1 from the Design System (v1).
// Values are never approximated — every number here traces back to a
// token in cellfie-design-system.md. Colors reference CSS custom
// properties (defined in src/index.css) so the same class names work
// in both light and dark theme without duplicate utilities.
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      // Design System §4.3 — named for clarity, min-width based (Tailwind default direction)
      sm: '640px', // tablet starts
      md: '1024px', // desktop starts
      lg: '1440px' // wide starts
    },
    extend: {
      colors: {
        canvas: 'var(--color-bg-canvas)',
        surface: 'var(--color-bg-surface)',
        'surface-raised': 'var(--color-bg-surface-raised)',
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)'
        },
        ink: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)'
        },
        olive: 'var(--color-accent-olive)',
        sage: 'var(--color-accent-sage)',
        terracotta: 'var(--color-highlight-terracotta)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)'
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        body: ['Literata', 'ui-serif', 'Georgia', 'serif'],
        ui: ['Karla', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      fontSize: {
        display: ['2.5rem', { lineHeight: '1.15' }],
        h1: ['2rem', { lineHeight: '1.2' }],
        h2: ['1.5rem', { lineHeight: '1.25' }],
        h3: ['1.25rem', { lineHeight: '1.3' }],
        'body-lg': ['1.125rem', { lineHeight: '1.7' }],
        body: ['1rem', { lineHeight: '1.65' }],
        ui: ['0.875rem', { lineHeight: '1.5' }],
        caption: ['0.8125rem', { lineHeight: '1.4' }],
        micro: ['0.6875rem', { lineHeight: '1.3' }]
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px'
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        full: '999px'
      },
      boxShadow: {
        0: '0 0 0 0 rgba(0,0,0,0)',
        1: '0 1px 3px rgba(58,46,34,0.08)',
        2: '0 4px 12px rgba(58,46,34,0.12)',
        3: '0 12px 32px rgba(58,46,34,0.18)'
      },
      maxWidth: {
        reading: '680px',
        content: '1200px',
        comparison: '960px'
      },
      width: {
        sidebar: '280px',
        rail: '64px'
      },
      transitionDuration: {
        micro: '120ms',
        standard: '220ms',
        page: '320ms'
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        entrance: 'cubic-bezier(0, 0, 0.2, 1)'
      }
    }
  },
  plugins: []
}

export default config
