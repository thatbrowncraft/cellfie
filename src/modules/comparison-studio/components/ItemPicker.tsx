import { useEffect, useState } from 'react'
import { MagnifyingGlass, PencilSimple } from '@phosphor-icons/react'
import { Dialog, Button, Input } from '../../../shared/components'
import { searchComparableEntities, type EntitySearchHit } from '../../../core/comparison/entitySearch'
import type { ComparisonItemRef, ComparisonDomain } from '../../../core/comparison/types'

interface ItemPickerProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional real cross-linked suggestions (brief §17 inline "Compare with…") — shown above free search when present. */
  suggestions?: EntitySearchHit[]
  onPick: (item: ComparisonItemRef, suggestedDomain?: ComparisonDomain) => void
}

/**
 * Item A / Item B picker (brief §12A/§12B/§17/§18). Two ways in:
 *  - search real Cellfie entities (organisms + Laboratory content), or
 *  - "Use a custom name" for anything that doesn't exist as curated
 *    content yet (a research method, a strain, an antibody, ...) — never
 *    required to match something in the database.
 */
export function ItemPicker({ open, onClose, title, suggestions, onPick }: ItemPickerProps) {
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [results, setResults] = useState<EntitySearchHit[]>([])
  const [searching, setSearching] = useState(false)

  // searchComparableEntities dynamically imports the Organism/Laboratory
  // registries on first use (see entitySearch.ts's header comment for
  // why that's load-bearing for bundle size) — so this is async and
  // guarded against a stale response landing after a newer keystroke.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    searchComparableEntities(q).then((hits) => {
      if (cancelled) return
      setResults(hits)
      setSearching(false)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  function handlePick(hit: EntitySearchHit) {
    onPick(hit.item, hit.suggestedDomain)
    reset()
  }

  function handleCustomSubmit() {
    const name = customName.trim()
    if (!name) return
    onPick({ name })
    reset()
  }

  function reset() {
    setQuery('')
    setCustomName('')
    setShowCustomInput(false)
    onClose()
  }

  return (
    <Dialog open={open} onClose={reset} title={title} size="md">
      <div className="flex flex-col gap-4">
        <div className="relative flex items-center">
          <MagnifyingGlass className="pointer-events-none absolute left-3 text-ink-tertiary" size={16} aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organisms, techniques, media, equipment…"
            aria-label="Search Cellfie content"
            className="w-full rounded-sm border border-border bg-canvas py-2.5 pl-9 pr-3 font-ui text-body text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-2 focus:border-olive"
          />
        </div>

        {!query.trim() && suggestions && suggestions.length > 0 && (
          <div>
            <p className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Suggested</p>
            <ul className="flex flex-col gap-1">
              {suggestions.map((hit, i) => (
                <ResultRow key={`${hit.item.refId ?? hit.item.name}-${i}`} hit={hit} onClick={() => handlePick(hit)} />
              ))}
            </ul>
          </div>
        )}

        {query.trim() && (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {searching ? (
              <li className="py-6 text-center font-body text-caption text-ink-tertiary">Searching…</li>
            ) : results.length === 0 ? (
              <li className="py-6 text-center font-body text-caption text-ink-tertiary">Nothing found for "{query}".</li>
            ) : (
              results.map((hit, i) => <ResultRow key={`${hit.item.refId ?? hit.item.name}-${i}`} hit={hit} onClick={() => handlePick(hit)} />)
            )}
          </ul>
        )}

        <div className="border-t border-border pt-4">
          {!showCustomInput ? (
            <Button variant="tertiary" size="small" icon={<PencilSimple size={14} />} onClick={() => setShowCustomInput(true)}>
              Use a custom name instead
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                autoFocus
                label="Custom item name"
                placeholder="e.g. Strain XR-12, or a specific research protocol"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomSubmit()
                }}
              />
              <div className="flex gap-2">
                <Button size="small" onClick={handleCustomSubmit} disabled={!customName.trim()}>
                  Use this
                </Button>
                <Button variant="tertiary" size="small" onClick={() => setShowCustomInput(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function ResultRow({ hit, onClick }: { hit: EntitySearchHit; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left hover:bg-surface-raised focus-visible:bg-surface-raised"
      >
        <span className="font-ui text-body text-ink-primary">{hit.item.name}</span>
        {hit.item.subtitle && <span className="font-ui text-micro text-ink-tertiary">{hit.item.subtitle}</span>}
      </button>
    </li>
  )
}
