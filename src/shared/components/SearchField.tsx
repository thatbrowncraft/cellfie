import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { cn } from '../utils/cn'

interface SearchFieldProps {
  placeholder?: string
  onChange?: (value: string) => void
  className?: string
  /** Restores the field's starting text — used by callers that persist the search term in the URL (e.g. Organism Explorer, so a page refresh doesn't silently clear it). Every other existing caller omits this and keeps its old behavior (starts empty) unchanged. */
  defaultValue?: string
}

/** Inline search field — used within pages (e.g. Library toolbar). */
export function SearchField({ placeholder = 'Search…', onChange, className, defaultValue = '' }: SearchFieldProps) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className={cn('relative flex items-center', className)}>
      <MagnifyingGlass className="pointer-events-none absolute left-4 text-ink-tertiary" size={18} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onChange?.(e.target.value)
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-sm border border-border bg-canvas py-3 pl-11 pr-4 font-ui text-body text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-2 focus:border-olive"
      />
    </div>
  )
}

interface SearchResultGroup {
  label: string
  results: { id: string; title: string; subtitle?: string; icon?: ReactNode; path?: string }[]
}

interface UniversalSearchProps {
  open: boolean
  onClose: () => void
  groups?: SearchResultGroup[]
  onQueryChange?: (query: string) => void
  /** Fires when a result is chosen; the caller (AppShell) owns navigation since this component has no router access. */
  onSelectResult?: (result: { id: string; title: string; path?: string }) => void
}

/**
 * Universal Search overlay — Design System §10.7.
 * Cmd/Ctrl+K modal, grouped results by content type, calm empty state.
 * Sprint 2 §7 wires this to `core/search`'s cross-entity search (Notes,
 * Highlights, Bookmarks, Books, Tags) — `onQueryChange` lets the caller
 * debounce/run that search as the person types; `groups` is what comes
 * back.
 */
export function UniversalSearch({ open, onClose, groups = [], onQueryChange, onSelectResult }: UniversalSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  useFocusTrap(containerRef, open)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Query resets each time the overlay opens fresh, so a stale search
  // from last time never lingers.
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  if (!open) return null

  const hasResults = groups.some((g) => g.results.length > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search Cellfie"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-lg bg-surface p-6 shadow-3 animate-in"
      >
        <div className="relative flex items-center">
          <MagnifyingGlass className="pointer-events-none absolute left-1 text-ink-tertiary" size={22} aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              onQueryChange?.(e.target.value)
            }}
            placeholder="Search notes, highlights, bookmarks, books, tags…"
            className="w-full border-b border-border bg-transparent py-3 pl-9 font-display text-h3 text-ink-primary placeholder:text-ink-tertiary outline-none"
          />
          <button onClick={onClose} aria-label="Close search" className="absolute right-1 text-ink-tertiary hover:text-ink-primary">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto" aria-live="polite">
          {!hasResults ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="font-ui text-ui text-ink-secondary">
                {query ? `Nothing found for "${query}" yet.` : 'Start typing to search your library.'}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-1">
                  {group.results.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          onSelectResult?.(r)
                          onClose()
                        }}
                        className="flex w-full items-center gap-3 rounded-sm px-4 py-2 text-left hover:bg-surface-raised focus-visible:bg-surface-raised"
                      >
                        {r.icon}
                        <span className="font-ui text-body text-ink-primary">{r.title}</span>
                        {r.subtitle && <span className="font-ui text-caption text-ink-tertiary">{r.subtitle}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
