import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkSimple, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '../../shared/layouts'
import { Button, Card, CardBody, EmptyState } from '../../shared/components'
import { CATEGORY_LABELS, getLabContentById, resolveRelated } from '../../core/laboratory/registry'
import { getItemTagline } from '../../core/laboratory/microcopy'
import { recordLabItemViewed } from '../../core/laboratory/recentlyViewed'
import { isCellfieReferenceSaved, removeSavedLabItem, saveCellfieReference } from '../../core/laboratory/savedItems'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { db } from '../../core/db'
import type {
  BiochemicalTest,
  BiosafetyTopic,
  Equipment,
  Formula,
  LabConcept,
  LaboratoryCategory,
  Media,
  Protocol
} from '../../core/laboratory/types'
import { RelatedContentList } from './components/RelatedContentList'
import { LabSourcesPanel } from './components/LabSourcesPanel'
import {
  BiochemicalTestBody,
  BiosafetyBody,
  ConceptBody,
  EquipmentBody,
  FormulaBody,
  MediaBody,
  ProtocolBody
} from './components/ContentBodies'

/**
 * Laboratory Detail — Tier 1 Foundation (brief §28 Phase E). One
 * reusable page renders every content category rather than seven
 * near-duplicate components; each category's specific shape (Protocol,
 * Media, BiochemicalTest, etc.) is handled by its own render function
 * below, all sharing the same header/breadcrumb/related-content chrome.
 */
export function LaboratoryDetailPage() {
  const { category, id } = useParams<{ category: LaboratoryCategory; id: string }>()
  const navigate = useNavigate()

  const item = useMemo(() => (id ? getLabContentById(id) : undefined), [id])

  // Dashboard "Lab" preview support (brief: recent activity, bounded,
  // separate from Saved Lab Items) — fire-and-forget, never blocks
  // render. Only curated content reaching this branch is ever recorded.
  useEffect(() => {
    if (item && category && item.category === category) {
      void recordLabItemViewed(item.id, category)
    }
  }, [item, category])

  const isSaved = useLiveQuery<boolean>(
    () => (item ? isCellfieReferenceSaved(item.id) : Promise.resolve(false)),
    [item?.id],
    false
  )

  if (!category || !id || !item || item.category !== category) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Content not found"
          description="This Laboratory entry doesn't exist, or its content file couldn't be loaded."
          action={
            <Button variant="secondary" onClick={() => navigate('/laboratory')}>
              Back to Laboratory
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/laboratory')} className="hover:text-ink-secondary hover:underline">
          Laboratory
        </button>
        <CaretRight size={12} aria-hidden />
        <button
          type="button"
          onClick={() => navigate(`/laboratory?section=${category}`)}
          className="hover:text-ink-secondary hover:underline"
        >
          {CATEGORY_LABELS[category]}
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">{item.title}</span>
      </nav>

      <Button variant="tertiary" size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} className="mb-4">
        Back
      </Button>

      <header className="mb-8">
        <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
          {CATEGORY_LABELS[category]}
          {item.subcategory ? ` · ${item.subcategory}` : ''}
        </p>
        <h1 className="mt-1 font-display text-display font-semibold text-ink-primary">{item.title}</h1>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{getItemTagline(item.id, category)}</p>
        {item.scientificNotes && <p className="mt-3 font-body text-caption text-ink-tertiary">{item.scientificNotes}</p>}
      </header>

      <div className="flex flex-col gap-8">
        {category === 'protocol' && <ProtocolBody item={item as Protocol} />}
        {category === 'concept' && <ConceptBody item={item as LabConcept} />}
        {category === 'media' && <MediaBody item={item as Media} />}
        {category === 'biochemical-test' && <BiochemicalTestBody item={item as BiochemicalTest} />}
        {category === 'biosafety' && <BiosafetyBody item={item as BiosafetyTopic} />}
        {category === 'equipment' && <EquipmentBody item={item as Equipment} />}
        {category === 'formula' && <FormulaBody item={item as Formula} />}

        <RelatedSections item={item} />

        <SourcesSection item={item} category={category} isSaved={isSaved} />
      </div>
    </div>
  )
}

function RelatedSections({ item }: { item: Protocol | LabConcept | Media | BiochemicalTest | BiosafetyTopic | Equipment | Formula }) {
  const groups: { title: string; ids?: string[] }[] = [
    { title: 'Related Protocols', ids: item.relatedProtocols },
    { title: 'Related Concepts', ids: item.relatedConcepts },
    { title: 'Related Media', ids: item.relatedMedia },
    { title: 'Related Biochemical Tests', ids: item.relatedBiochemicalTests },
    { title: 'Related Equipment', ids: item.relatedEquipment },
    { title: 'Related Formulas', ids: item.relatedFormulas },
    { title: 'Related Safety Information', ids: item.relatedSafety }
  ]

  const nonEmpty = groups
    .map((g) => ({ title: g.title, items: resolveRelated(g.ids) }))
    .filter((g) => g.items.length > 0)

  const calcIds = item.relatedCalculators
  const hasCalcLinks = calcIds && calcIds.length > 0

  if (nonEmpty.length === 0 && !hasCalcLinks) return null

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <h2 className="font-display text-h3 font-medium text-ink-primary">Related Content</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {nonEmpty.map((g) => (
          <RelatedContentList key={g.title} title={g.title} items={g.items} />
        ))}
        {hasCalcLinks && <RelatedCalculators ids={calcIds!} />}
      </div>
    </div>
  )
}

function RelatedCalculators({ ids }: { ids: string[] }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-2">
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Related Calculators</p>
      <div className="flex flex-col gap-2">
        {ids.map((id) => (
          <Card key={id} interactive className="p-3" onClick={() => navigate(`/laboratory/calculators/${id}`)}>
            <CardBody className="flex items-center justify-between gap-2 p-0">
              <span className="font-ui text-ui font-medium text-ink-primary">{id.replace('calc-', '').replace(/-/g, ' ')}</span>
              <CaretRight size={16} className="shrink-0 text-ink-tertiary" aria-hidden />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Laboratory 2.0 brief §18 — the three information layers, always shown
 * distinctly. "Cellfie Reference" is what used to be the standalone
 * References section (Layer 1, always available, never requires a
 * lookup); "My Library" and "Online Knowledge" (Layers 2-3) live in
 * `LabSourcesPanel` and only populate on explicit user action.
 */
function SourcesSection({
  item,
  category,
  isSaved
}: {
  item: Protocol | LabConcept | Media | BiochemicalTest | BiosafetyTopic | Equipment | Formula
  category: LaboratoryCategory
  isSaved: boolean
}) {
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    try {
      await saveCellfieReference({ id: item.id, category, title: item.title })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove() {
    const existing = await db.savedLabItems.where('labContentId').equals(item.id).first()
    if (existing) await removeSavedLabItem(existing.id)
  }

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <h2 className="font-display text-h3 font-medium text-ink-primary">Sources</h2>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Cellfie Reference</p>
          {isSaved ? (
            <span className="flex items-center gap-1.5 font-ui text-micro font-medium text-olive">
              <BookmarkSimple size={14} weight="fill" aria-hidden />
              Saved to Saved Lab Items
              <button type="button" onClick={handleRemove} className="ml-1 text-ink-tertiary underline hover:text-ink-secondary">
                Remove
              </button>
            </span>
          ) : (
            <Button variant="secondary" size="small" icon={<Bookmark size={14} />} disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving…' : 'Save to Saved Lab Items'}
            </Button>
          )}
        </div>
        <ul className="space-y-1 font-body text-caption text-ink-secondary">
          {item.references.map((r, i) => (
            <li key={i}>
              {r.label}
              {r.publisher ? ` — ${r.publisher}` : ''}
              {r.edition ? ` (${r.edition})` : ''}
            </li>
          ))}
        </ul>
        <p className="mt-2 font-ui text-micro text-ink-tertiary">
          Source type: {item.sourceType.replace(/-/g, ' ')} · Version {item.version} · Last verified {item.lastVerified}
        </p>
      </div>

      <LabSourcesPanel title={item.title} contentId={item.id} />
    </div>
  )
}
