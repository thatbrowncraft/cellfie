import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus } from '@phosphor-icons/react'
import { Button, Dropdown } from '../../shared/components'
import { getSuggestedAspects } from '../../core/comparison/domainPresets'
import { createCustomComparison } from '../../core/comparison/userComparisons'
import { getRandomNewComparisonTagline } from '../../core/comparison/microcopy'
import {
  COMPARISON_DIFFICULTY_LABELS,
  COMPARISON_DOMAIN_LABELS,
  COMPARISON_FREQUENCY_LABELS,
  type ComparisonDifficulty,
  type ComparisonDomain,
  type ComparisonFrequency,
  type ComparisonItemRef
} from '../../core/comparison/types'
import { findComparisonsInvolving } from '../../core/comparison/registry'
import type { EntitySearchHit } from '../../core/comparison/entitySearch'
import { ItemPicker } from './components/ItemPicker'

const DOMAIN_OPTIONS = Object.entries(COMPARISON_DOMAIN_LABELS).map(([value, label]) => ({ value, label }))
const DIFFICULTY_OPTIONS = Object.entries(COMPARISON_DIFFICULTY_LABELS).map(([value, label]) => ({ value, label }))
const FREQUENCY_OPTIONS = Object.entries(COMPARISON_FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))

/**
 * New Comparison flow (brief §12/§17/§18). Deliberately fast: Item A →
 * Item B → domain (auto-detected from either item's curated category,
 * editable) → aspect preset applied → straight into the workspace to
 * edit values. If `itemA`/`itemAName` arrive via query params (the
 * Item A → Item B step is skipped entirely. If `itemBName` is present
 * too (the Comparison Studio landing search's entity-pair "Build
 * comparison" fallback — brief §8B/§12A/§32), both steps are skipped and
 * the user lands straight on domain/difficulty/frequency.
 */
export function NewComparisonPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const prefilledItemA = useMemo<ComparisonItemRef | undefined>(() => {
    const name = searchParams.get('itemAName')
    if (!name) return undefined
    const refKind = searchParams.get('itemARefKind') as ComparisonItemRef['refKind'] | null
    const refId = searchParams.get('itemARefId') ?? undefined
    const labCategory = searchParams.get('itemALabCategory') ?? undefined
    return { name, refKind: refKind ?? undefined, refId, labCategory }
  }, [searchParams])

  // Item B prefill mirrors Item A's exactly (brief §17's existing
  // convention) — the missing half of it is what made the Comparison
  // Studio landing search's "Build comparison" fallback (brief §8B/§12A)
  // need a Studio-side workaround instead of just deep-linking here with
  // both sides already filled in.
  const prefilledItemB = useMemo<ComparisonItemRef | undefined>(() => {
    const name = searchParams.get('itemBName')
    if (!name) return undefined
    const refKind = searchParams.get('itemBRefKind') as ComparisonItemRef['refKind'] | null
    const refId = searchParams.get('itemBRefId') ?? undefined
    const labCategory = searchParams.get('itemBLabCategory') ?? undefined
    return { name, refKind: refKind ?? undefined, refId, labCategory }
  }, [searchParams])

  const prefilledDomain = useMemo<ComparisonDomain | undefined>(() => {
    const domainParam = searchParams.get('domain')
    return domainParam ? (domainParam as ComparisonDomain) : undefined
  }, [searchParams])

  const [itemA, setItemA] = useState<ComparisonItemRef | undefined>(prefilledItemA)
  const [itemB, setItemB] = useState<ComparisonItemRef | undefined>(prefilledItemB)
  const [domain, setDomain] = useState<ComparisonDomain>(prefilledDomain ?? 'custom')
  const [difficulty, setDifficulty] = useState<ComparisonDifficulty>('intermediate')
  const [frequency, setFrequency] = useState<ComparisonFrequency>('common')
  const [pickerFor, setPickerFor] = useState<'A' | 'B' | null>(null)
  const [saving, setSaving] = useState(false)

  const tagline = useMemo(() => getRandomNewComparisonTagline(), [])

  const suggestionsForB: EntitySearchHit[] = useMemo(() => {
    if (!itemA?.refId) return []
    // Real cross-linked suggestions first (brief §17): other items already paired with Item A in curated comparisons.
    const fromExistingComparisons = findComparisonsInvolving(itemA.refId).map((c) => (c.itemA.refId === itemA.refId ? c.itemB : c.itemA))
    const seen = new Set<string>()
    const deduped: ComparisonItemRef[] = []
    for (const ref of fromExistingComparisons) {
      const key = ref.refId ?? ref.name
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(ref)
    }
    return deduped.map((ref) => ({ item: ref, suggestedDomain: domain }))
  }, [itemA, domain])

  function handlePickItem(side: 'A' | 'B', item: ComparisonItemRef, suggestedDomain?: ComparisonDomain) {
    if (side === 'A') {
      setItemA(item)
      if (suggestedDomain) setDomain(suggestedDomain)
    } else {
      setItemB(item)
      if (suggestedDomain && domain === 'custom') setDomain(suggestedDomain)
    }
  }

  async function handleContinue() {
    if (!itemA || !itemB) return
    setSaving(true)
    const suggested = getSuggestedAspects(domain)
    const aspects = suggested.map((preset) => ({ id: preset.id, label: preset.label, valueA: '', valueB: '' }))
    const record = await createCustomComparison({ domain, difficulty, frequency, itemA, itemB, aspects })
    // `openSource` (correction-pass Part 2/3/4) came from the landing search's "My Library"/"Online Knowledge" entity-pair buttons — forward it plus the first aspect id so ComparisonWorkspacePage can open the Fill-from-source dialog on the right tab immediately, instead of landing on a blank workspace that looks identical to plain "Build comparison."
    const openSource = searchParams.get('openSource')
    const suffix = openSource ? `?openSource=${openSource}&focusAspect=${encodeURIComponent(aspects[0]?.id ?? '')}` : ''
    navigate(`/comparison/${record.id}${suffix}`, { replace: true })
  }

  // If both items *and* the domain arrived prefilled (the landing search's entity-pair "Build comparison" / "My Library" / "Online Knowledge" actions all send all three), there's nothing left for the person to decide here — auto-continue straight into the workspace instead of making them tap "Open comparison workspace" on a screen that's already fully filled in (correction-pass Part 2: "the user should never hit a dead end," and every extra confirmation tap on mobile is its own small dead end). A person who only searched one item, or wants to change the domain/difficulty first, still lands on this screen normally — this only fires when literally everything is already decided.
  const autoContinueEligible = Boolean(prefilledItemA && prefilledItemB && prefilledDomain)
  useEffect(() => {
    if (autoContinueEligible) void handleContinue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (autoContinueEligible) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-ui text-body text-ink-tertiary">Setting up your comparison…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="font-display text-h1 font-semibold text-ink-primary">New Comparison</h1>
        <p className="mt-2 font-body text-body text-ink-secondary">{tagline}</p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <ItemSlot label="Item A" item={itemA} onClick={() => setPickerFor('A')} />
          <span className="justify-self-center font-display text-h2 text-ink-tertiary" aria-hidden>
            vs
          </span>
          <ItemSlot label="Item B" item={itemB} onClick={() => setPickerFor('B')} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Dropdown label="Domain" options={DOMAIN_OPTIONS} value={domain} onChange={(v) => setDomain(v as ComparisonDomain)} />
          <Dropdown label="Difficulty" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={(v) => setDifficulty(v as ComparisonDifficulty)} />
          <Dropdown label="Frequency" options={FREQUENCY_OPTIONS} value={frequency} onChange={(v) => setFrequency(v as ComparisonFrequency)} />
        </div>

        <div>
          <Button icon={<ArrowRight size={18} />} iconPosition="trailing" disabled={!itemA || !itemB || saving} onClick={handleContinue}>
            {saving ? 'Creating…' : 'Open comparison workspace'}
          </Button>
        </div>
      </div>

      <ItemPicker
        open={pickerFor === 'A'}
        onClose={() => setPickerFor(null)}
        title="Choose Item A"
        onPick={(item, suggestedDomain) => handlePickItem('A', item, suggestedDomain)}
      />
      <ItemPicker
        open={pickerFor === 'B'}
        onClose={() => setPickerFor(null)}
        title="Choose Item B"
        suggestions={suggestionsForB}
        onPick={(item, suggestedDomain) => handlePickItem('B', item, suggestedDomain)}
      />
    </div>
  )
}

function ItemSlot({ label, item, onClick }: { label: string; item?: ComparisonItemRef; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[88px] flex-col items-start justify-center gap-1 rounded-md border border-dashed border-border-strong bg-surface p-4 text-left hover:border-olive"
    >
      <span className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{label}</span>
      {item ? (
        <>
          <span className="font-display text-h3 font-medium text-ink-primary">{item.name}</span>
          {item.subtitle && <span className="font-ui text-caption text-ink-tertiary">{item.subtitle}</span>}
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-ui text-body text-olive">
          <Plus size={16} aria-hidden /> Choose an item
        </span>
      )}
    </button>
  )
}
