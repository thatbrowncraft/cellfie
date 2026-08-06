import { useRef, useState, type KeyboardEvent } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { useClickOutside } from '../hooks/useClickOutside'
import { cn } from '../utils/cn'

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  label: string
  options: DropdownOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Dropdown / Select — Design System §10.4.
 * Full keyboard operability: arrow keys, type-ahead via native behavior,
 * Esc to close. role="listbox"/"option" semantics.
 */
export function Dropdown({ label, options, value, onChange, placeholder = 'Select…', className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, () => setOpen(false), open)

  const selected = options.find((o) => o.value === value)

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open) {
        onChange?.(options[activeIndex].value)
        setOpen(false)
      } else {
        setOpen(true)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-2', className)}>
      <span id={`${label}-label`} className="font-ui text-ui font-medium text-ink-primary">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${label}-label`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between rounded-sm border border-border bg-canvas px-4 py-3 font-ui text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
      >
        <span className={selected ? '' : 'text-ink-tertiary'}>{selected?.label ?? placeholder}</span>
        <CaretDown size={16} className={cn('transition-transform duration-micro', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <ul role="listbox" aria-label={label} className="relative z-20 mt-1 rounded-md border border-border bg-surface p-1 shadow-2">
          {options.map((opt, i) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange?.(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-4 py-2 text-left font-ui text-body',
                  i === activeIndex ? 'bg-surface-raised' : '',
                  opt.value === value ? 'border-l-2 border-olive font-medium text-ink-primary pl-3' : 'text-ink-primary'
                )}
              >
                {opt.label}
                {opt.value === value && <Check size={16} className="text-olive" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
