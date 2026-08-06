import { useRef, useState } from 'react'
import { Sun, Moon, Monitor } from '@phosphor-icons/react'
import { useTheme, type ThemeMode } from '../../core/theme'
import { useClickOutside } from '../hooks/useClickOutside'
import { cn } from '../utils/cn'

const options: { mode: ThemeMode; label: string; icon: JSX.Element }[] = [
  { mode: 'system', label: 'System', icon: <Monitor size={16} /> },
  { mode: 'light', label: 'Light', icon: <Sun size={16} /> },
  { mode: 'dark', label: 'Dark', icon: <Moon size={16} /> }
]

/** Theme switch control — Design System §10.5 (top nav), §11 (theme rules). */
export function ThemeToggle() {
  const { mode, setMode, resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const current = options.find((o) => o.mode === mode) ?? options[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}. Currently displaying ${resolvedTheme} theme.`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-raised hover:text-ink-primary"
      >
        {current.icon}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 min-w-[140px] rounded-sm border border-border bg-surface p-1 shadow-2">
          {options.map((opt) => (
            <button
              key={opt.mode}
              role="menuitemradio"
              aria-checked={mode === opt.mode}
              onClick={() => {
                setMode(opt.mode)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left font-ui text-ui',
                mode === opt.mode ? 'bg-surface-raised text-ink-primary font-medium' : 'text-ink-secondary hover:bg-surface-raised'
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
