import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkSimple, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout, LoadingLayout } from '../../shared/layouts'
import { Button, Card, CardBody, EmptyState, SkeletonCard } from '../../shared/components'
import { CATEGORY_LABELS } from '../../core/laboratory/registry'
import { getItemTagline } from '../../core/laboratory/microcopy'
import { recordLabItemViewed } from '../../core/laboratory/recentlyViewed'
import { isCellfieReferenceSaved, removeSavedLabItem, saveCellfieReference } from '../../core/laboratory/savedItems'
import { useLiveQuery } from '../../core/db/useLiveQuery'
import { db } from '../../core/db'
import { getClinicalContentById, resolveClinicalRelated } from '../../core/laboratory/clinicalRegistry'
import { LabSourcesPanel } from './components/LabSourcesPanel'
import { RelatedContentList } from './components/RelatedContentList'
import { BiochemicalTestBody, ConceptBody, EquipmentBody, FormulaBody, ProtocolBody } from './components/ContentBodies'
import type { BiochemicalTest, Equipment, Formula, LabConcept, LaboratoryCategory, LaboratoryContent, Protocol } from '../../core/laboratory/types'

/**
 * Clinical content detail page — Laboratory Clinical Expansion.
 *
 * Mirrors LaboratoryDetailPage's chrome (breadcrumb, header, body,
 * related content, sources/save) but backed by the lazy clinical
 * registry instead of the main one — `getClinicalContentById` is only
 * ever called here, from inside this already route-split page, never
 * from AppShell/Dashboard/router-eager code (see clinicalRegistry.ts's
 * header comment for why that separation matters for bundle size).
 * Reuses the exact same body renderers (ContentBodies.tsx) so a clinical
 * protocol/concept/equipment/formula renders identically to a Tier 1
 * one — no parallel visual language for "clinical" content.
 */
export function ClinicalDetailPage() {
  const { category, id } = useParams<{ category: LaboratoryCategory; id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<LaboratoryContent | undefined>(undefined)
  const [related, setRelated] = useState<Record<string, LaboratoryContent[]>>({})

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getClinicalContentById(id).then(async (found) => {
      if (cancelled) return
      setItem(found)
      setLoading(false)
      if (!found) return

      const relGroups: [string, string[] | undefined][] = [
        ['Related Protocols', found.relatedProtocols],
        ['Related Concepts', found.relatedConcepts],
        ['Related Media', found.relatedMedia],
        ['Related Biochemical Tests', found.relatedBiochemicalTests],
        ['Related Equipment', found.relatedEquipment],
        ['Related Formulas', found.relatedFormulas],
        ['Related Safety Information', found.relatedSafety]
      ]
      const resolvedEntries = await Promise.all(
        relGroups.map(async ([title, ids]) => [title, await resolveClinicalRelated(ids)] as const)
      )
      if (cancelled) return
      const nextRelated: Record<string, LaboratoryContent[]> = {}
      for (const [title, items] of resolvedEntries) {
        if (items.length > 0) nextRelated[title] = items
      }
      setRelated(nextRelated)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const isSaved = useLiveQuery<boolean>(() => (item ? isCellfieReferenceSaved(item.id) : Promise.resolve(false)), [item?.id], false)
  const [isSaving, setIsSaving] = useState(false)

  // Dashboard "Lab" preview support — same recording call
  // LaboratoryDetailPage makes for main-registry content, so a clinical
  // item opened here shows up in that same bounded recent-activity list.
  useEffect(() => {
    if (item && category && item.category === category) {
      void recordLabItemViewed(item.id, category)
    }
  }, [item, category])

  async function handleSave() {
    if (!item || !category) return
    setIsSaving(true)
    try {
      await saveCellfieReference({ id: item.id, category, title: item.title })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove() {
    if (!item) return
    const existing = await db.savedLabItems.where('labContentId').equals(item.id).first()
    if (existing) await removeSavedLabItem(existing.id)
  }

  if (loading) {
    return (
      <LoadingLayout>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </LoadingLayout>
    )
  }

  if (!category || !id || !item || item.category !== category) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Content not found"
          description="This Clinical Laboratory entry doesn't exist, or its content file couldn't be loaded."
          action={
            <Button variant="secondary" onClick={() => navigate('/laboratory/clinical')}>
              Back to Clinical Laboratory
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  const relatedCalcIds = item.relatedCalculators ?? []

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/laboratory')} className="hover:text-ink-secondary hover:underline">
          Laboratory
        </button>
        <CaretRight size={12} aria-hidden />
        <button type="button" onClick={() => navigate('/laboratory/clinical')} className="hover:text-ink-secondary hover:underline">
          Clinical Laboratory
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
        {category === 'biochemical-test' && <BiochemicalTestBody item={item as BiochemicalTest} />}
        {category === 'equipment' && <EquipmentBody item={item as Equipment} />}
        {category === 'formula' && <FormulaBody item={item as Formula} />}

        {(Object.keys(related).length > 0 || relatedCalcIds.length > 0) && (
          <div className="flex flex-col gap-6 border-t border-border pt-6">
            <h2 className="font-display text-h3 font-medium text-ink-primary">Related Content</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {Object.entries(related).map(([title, items]) => (
                <RelatedContentList key={title} title={title} items={items} />
              ))}
              {relatedCalcIds.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Related Calculators</p>
                  <div className="flex flex-col gap-2">
                    {relatedCalcIds.map((calcId) => (
                      <Card key={calcId} interactive className="p-3" onClick={() => navigate(`/laboratory/calculators/${calcId}`)}>
                        <CardBody className="flex items-center justify-between gap-2 p-0">
                          <span className="font-ui text-ui font-medium text-ink-primary">{calcId.replace('calc-', '').replace(/-/g, ' ')}</span>
                          <CaretRight size={16} className="shrink-0 text-ink-tertiary" aria-hidden />
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
      </div>
    </div>
  )
}
