import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowClockwise, ArrowSquareOut, Bookmark, Check, GitBranch, Globe, Sparkle, Star, Trash, UploadSimple } from '@phosphor-icons/react'
import { Button, CalloutBox, Dialog, EmptyState, IllustrationFrame } from '@/shared/components'
import { EmptyStateLayout } from '@/shared/layouts'
import {
  ACCEPTED_CUSTOM_IMAGE_TYPES,
  addOrganismImage,
  customImageRejectionMessages,
  MAX_CUSTOM_IMAGES_PER_ORGANISM,
  fungalClinicalGroupLabels,
  fungalMorphologicalTypeLabels,
  bodyLocationLabels,
  gramReactionLabels,
  getOrganismById,
  getOrganismByIdIncludingSaved,
  getRelatedOrganisms,
  hyphaeTypeLabels,
  isOrganismSaved,
  organismCategoryLabels,
  protozoanGroupLabels,
  refreshSavedOrganism,
  relatedOrganismRelationshipLabels,
  removeOrganismImage,
  removeSavedOrganism,
  saveOrganism,
  setPrimaryOrganismImage,
  transmissionRouteLabels,
  viralEnvelopeLabels,
  viralGenomeStrandednessLabels,
  viralGenomeTypeLabels,
  viralReplicationSiteLabels,
  type OrganismProfile
} from '@/core/organisms'
import { recordOrganismViewed } from '@/core/organisms/recentlyViewed'
import { useOrganismImages } from './hooks/useOrganismImages'
import { OrganismEditPanel } from './components/OrganismEditPanel'

/** A single label/value row — used across Classification, Habitat, and Lab Identification. Renders nothing when the value is absent, per Sprint 4 §6 ("do not show empty labels"). */
function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{label}</dt>
      <dd className="font-body text-body text-ink-primary sm:text-right">{value}</dd>
    </div>
  )
}

/** A compact chip for Morphology — deliberately small so a full set of structural fields never turns into a wall of huge cards (§7). */
function MorphologyChip({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="rounded-sm border border-border bg-surface-raised px-3 py-2">
      <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className="font-body text-caption text-ink-primary">{value}</p>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h2 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{title}</h2>
      {children}
    </div>
  )
}

function BulletList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <ul className="list-disc space-y-1.5 pl-5 font-body text-body text-ink-primary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Organism Detail — Sprint 4 §5-§13, Master Revision §20-§28/§35/§36. A
 * single scrollable specimen profile rather than a tabbed interface —
 * this keeps the "field guide" feel the spec asks for (§4) and matches
 * how a printed atlas entry reads: identity up top, then classification,
 * morphology, category-specific characteristics, habitat, lab
 * identification, recognition clues, clinical importance, and exam
 * facts in that order. Every section is conditionally rendered — a
 * field a content author hasn't filled in simply doesn't show up, which
 * is also what keeps a virus profile from ever showing a bacterial
 * Gram-reaction chip (§35): virus content files simply never populate
 * that field.
 */
export function OrganismDetailPage() {
  const { organismId } = useParams<{ organismId: string }>()
  const navigate = useNavigate()

  // Knowledge Layer Integration §15 — curated resolves instantly and
  // synchronously (the common case, no loading flash); a saved or
  // cached Knowledge Layer profile resolves one tick later via the
  // unified async resolver. Never triggers a network request itself —
  // that only ever happens from the Explorer's explicit "Search trusted
  // scientific sources" action (§42).
  const [organism, setOrganism] = useState<OrganismProfile | undefined>(() =>
    organismId ? getOrganismById(organismId) : undefined
  )
  const [isResolving, setIsResolving] = useState(() => Boolean(organismId) && !getOrganismById(organismId ?? ''))

  useEffect(() => {
    if (!organismId) return
    const curated = getOrganismById(organismId)
    if (curated) {
      setOrganism(curated)
      setIsResolving(false)
      return
    }
    let cancelled = false
    setIsResolving(true)
    getOrganismByIdIncludingSaved(organismId).then((resolved) => {
      if (!cancelled) {
        setOrganism(resolved)
        setIsResolving(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [organismId])

  const relatedOrganisms = useMemo(() => (organism ? getRelatedOrganisms(organism) : []), [organism])

  // Dashboard "Saved organisms" support (requested dashboard change #4) —
  // records that this organism was opened, via the existing appSettings
  // table (see core/organisms/recentlyViewed.ts). Purely additive; does
  // not affect anything rendered on this page.
  useEffect(() => {
    if (organism) {
      void recordOrganismViewed(organism.id)
    }
  }, [organism])

  // Knowledge Layer Integration §12/§35 — "Save to My Organisms".
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => {
    if (!organism) return
    if (organism.sourceType === 'curated-local') return
    let cancelled = false
    isOrganismSaved(organism.id).then((saved) => {
      if (!cancelled) setIsSaved(saved)
    })
    return () => {
      cancelled = true
    }
  }, [organism])

  async function handleSaveOrganism() {
    if (!organism) return
    setIsSaving(true)
    await saveOrganism(organism)
    setIsSaving(false)
    setIsSaved(true)
  }

  async function handleRemoveSavedOrganism() {
    if (!organism) return
    await removeSavedOrganism(organism.id)
    setIsSaved(false)
  }

  // Knowledge Layer + Source Library brief §Phase 12 — "Refresh
  // scientific information". Only ever runs from this explicit tap;
  // opening/reopening a saved organism never re-triggers it on its own.
  // On failure the existing saved profile (and this whole page's data)
  // is left completely untouched — see refreshSavedOrganism's own doc
  // comment for why that's safe.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | undefined>(undefined)

  async function handleRefreshOrganism() {
    if (!organism) return
    setIsRefreshing(true)
    setRefreshError(undefined)
    const result = await refreshSavedOrganism(organism.id)
    setIsRefreshing(false)
    if (result.status === 'refreshed') {
      setOrganism(result.profile)
    } else {
      setRefreshError("Couldn't refresh right now — showing your saved version.")
    }
  }

  // Organism Library / Illustration System continuation §19-§27 — every
  // image the user has uploaded for this organism (primary + thumbnails),
  // each with a live blob: URL. `useOrganismImages` is backed by
  // useLiveQuery, so an upload/removal/primary-change below updates this
  // page and the Explorer grid immediately with no manual refetch.
  const { images, primaryImage, primaryImageUrl, thumbnails } = useOrganismImages(organismId ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageError, setImageError] = useState<string | undefined>(undefined)
  const [isUploading, setIsUploading] = useState(false)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // always allow re-selecting the same file next time
    if (!file || !organismId) return
    setImageError(undefined)
    setIsUploading(true)
    // §22 bug fix: the previous version had no catch here, so if
    // addOrganismImage ever rejected instead of resolving, `isUploading`
    // stayed `true` forever — the "Uploading…" that never went away.
    // addOrganismImage itself now never rejects (every failure path
    // returns `{ ok: false, reason }`), but this still guarantees the
    // spinner clears even if something truly unexpected throws.
    try {
      const result = await addOrganismImage(organismId, file)
      if (!result.ok && result.reason) {
        setImageError(customImageRejectionMessages[result.reason])
      }
    } catch {
      setImageError(customImageRejectionMessages['storage-error'])
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemoveImage(imageId: string) {
    if (!organismId) return
    setImageError(undefined)
    await removeOrganismImage(organismId, imageId)
  }

  async function handleSetPrimaryImage(imageId: string) {
    if (!organismId) return
    await setPrimaryOrganismImage(organismId, imageId)
  }

  if (isResolving) {
    return (
      <EmptyStateLayout>
        <EmptyState title="Loading…" description="Checking your saved organisms." />
      </EmptyStateLayout>
    )
  }

  if (!organism) {
    return (
      <EmptyStateLayout>
        <EmptyState
          title="Organism not found"
          description="This organism may have been removed, or the link is out of date. It also isn't in your saved organisms — searching for it again from the Organism Explorer will look it up."
          action={
            <Button variant="secondary" onClick={() => navigate('/organisms')}>
              Back to Organism Explorer
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  const { classification, morphology, habitat, labIdentification, clinicalImportance, examFacts, fungalDetails, protozoanDetails, virusDetails } =
    organism

  const headerBadges = [
    organismCategoryLabels[organism.category],
    morphology.gramReaction && morphology.gramReaction !== 'not-applicable' ? gramReactionLabels[morphology.gramReaction] : undefined,
    morphology.acidFast ? 'Acid-fast' : undefined,
    morphology.shape,
    classification.order
  ].filter((b): b is string => Boolean(b))

  const hasClassification = Object.values(classification).some(Boolean)
  const hasHabitat = habitat && Object.values(habitat).some(Boolean)
  const hasMicroscopy = labIdentification?.microscopy && Object.values(labIdentification.microscopy).some(Boolean)
  const hasCulture = labIdentification?.culture && Object.values(labIdentification.culture).some(Boolean)
  const hasBiochemTests = (labIdentification?.biochemicalTests?.length ?? 0) > 0
  const hasLabId = hasMicroscopy || hasCulture || hasBiochemTests
  const hasClinical = Boolean(
    clinicalImportance &&
      (clinicalImportance.diseases?.length ||
        clinicalImportance.virulenceFactors?.length ||
        clinicalImportance.toxins?.length ||
        clinicalImportance.transmission ||
        clinicalImportance.epidemiology ||
        clinicalImportance.labSignificance)
  )
  const hasExamFacts = Object.values(examFacts).some(Boolean)
  const hasFungalDetails = Boolean(
    fungalDetails && (fungalDetails.morphologicalType || fungalDetails.hyphae?.length || fungalDetails.reproductiveStructures?.length || fungalDetails.clinicalGroup)
  )
  const hasProtozoanDetails = Boolean(
    protozoanDetails && (protozoanDetails.group || protozoanDetails.majorLocation || protozoanDetails.transmissionRoute || protozoanDetails.lifeCycleForm)
  )
  const hasVirusDetails = Boolean(
    virusDetails &&
      (virusDetails.genomeType || virusDetails.genomeStrandedness || virusDetails.envelope || virusDetails.capsidSymmetry || virusDetails.replicationSite || virusDetails.transmissionRoute)
  )

  return (
    <div className="mx-auto w-full min-w-0 max-w-content overflow-x-hidden px-4 py-8 sm:px-6 md:px-8">
      <button
        type="button"
        onClick={() => navigate('/organisms')}
        className="mb-4 flex items-center gap-1.5 font-ui text-caption font-medium text-ink-secondary hover:text-ink-primary"
      >
        <ArrowLeft size={16} />
        Organism Explorer
      </button>

      <header className="mb-6 flex flex-col gap-5">
        <div className="flex w-full flex-col gap-2 sm:max-w-xl">
          <IllustrationFrame
            src={primaryImageUrl ?? organism.externalImage?.imageUrl}
            alt={`Illustration of ${organism.scientificName}`}
            caption={organism.commonName ?? organism.scientificName}
            className="w-full"
          />
          {!primaryImageUrl && organism.externalImage && (
            <p className="font-body text-micro text-ink-tertiary">
              Image: {organism.externalImage.sourceName}
              {organism.externalImage.sourceUrl && (
                <>
                  {' \u2014 '}
                  <a href={organism.externalImage.sourceUrl} target="_blank" rel="noreferrer" className="text-olive hover:underline">
                    source
                  </a>
                </>
              )}
            </p>
          )}

          {/* §21 — additional (non-primary) images as small thumbnails, only
              shown once a second image exists; tapping one makes it primary.
              "Show more" opens the full gallery, and only appears once there
              are 2+ images total (never for a single image). */}
          {thumbnails.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {thumbnails.slice(0, 4).map(({ image, url }) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => handleSetPrimaryImage(image.id)}
                  title="Set as primary image"
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface-raised"
                >
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full animate-pulse bg-surface-raised" />
                  )}
                </button>
              ))}
              {images.length > 1 && (
                <Button variant="tertiary" size="small" onClick={() => setIsGalleryOpen(true)}>
                  Show more
                </Button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_CUSTOM_IMAGE_TYPES.join(',')}
            onChange={handleFileSelected}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="flex flex-wrap items-center gap-2">
            {images.length >= MAX_CUSTOM_IMAGES_PER_ORGANISM ? (
              <span className="font-ui text-caption font-medium text-ink-tertiary">
                Maximum reached: {MAX_CUSTOM_IMAGES_PER_ORGANISM} images
              </span>
            ) : (
              <Button
                variant="secondary"
                size="small"
                icon={<UploadSimple size={14} />}
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? 'Saving\u2026' : images.length > 0 ? 'Add another illustration' : 'Add your illustration'}
              </Button>
            )}
            {primaryImage && (
              <Button variant="tertiary" size="small" icon={<Trash size={14} />} onClick={() => handleRemoveImage(primaryImage.id)}>
                Remove image
              </Button>
            )}
          </div>
          {imageError && <p className="font-body text-caption text-error">{imageError}</p>}
        </div>

        {isGalleryOpen && (
          <Dialog open={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} title="Illustrations" size="lg">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map(({ image, url }) => (
                <div key={image.id} className="flex flex-col gap-2 rounded-md border border-border p-2">
                  <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-sm bg-surface-raised">
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="block h-full w-full animate-pulse bg-surface-raised" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {image.isPrimary ? (
                      <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
                        <Star size={13} weight="fill" aria-hidden />
                        Primary
                      </span>
                    ) : (
                      <Button variant="tertiary" size="small" onClick={() => handleSetPrimaryImage(image.id)}>
                        Make primary
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.id)}
                      aria-label="Remove this image"
                      className="text-ink-tertiary hover:text-error"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Dialog>
        )}
        <div className="flex flex-col gap-2">
          <div>
            <h1 className="font-display text-display font-semibold italic text-ink-primary">{organism.scientificName}</h1>
            {organism.commonName && <p className="mt-1 font-ui text-body text-ink-tertiary">{organism.commonName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {headerBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-surface-raised px-2.5 py-1 font-ui text-micro font-medium text-ink-secondary"
              >
                {badge}
              </span>
            ))}
          </div>

          {organism.sourceType && organism.sourceType !== 'curated-local' && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="flex items-center gap-1 rounded-full border border-terracotta/40 bg-surface-raised px-2.5 py-1 font-ui text-micro font-medium text-ink-secondary">
                <Globe size={12} aria-hidden />
                {'Knowledge Layer \u2014 retrieved from scientific sources'}
              </span>
              {isSaved ? (
                <span className="flex items-center gap-1 font-ui text-micro font-medium text-olive">
                  <Check size={13} aria-hidden />
                  Saved locally
                  <button type="button" onClick={handleRemoveSavedOrganism} className="ml-1 text-ink-tertiary underline hover:text-ink-secondary">
                    Remove
                  </button>
                </span>
              ) : (
                <Button variant="secondary" size="small" icon={<Bookmark size={14} />} disabled={isSaving} onClick={handleSaveOrganism}>
                  {isSaving ? 'Saving\u2026' : 'Save to My Organisms'}
                </Button>
              )}
              {isSaved && (
                <Button
                  variant="tertiary"
                  size="small"
                  icon={<ArrowClockwise size={14} />}
                  disabled={isRefreshing}
                  onClick={handleRefreshOrganism}
                >
                  {isRefreshing ? 'Refreshing\u2026' : 'Refresh scientific information'}
                </Button>
              )}
            </div>
          )}
          {refreshError && <p className="font-body text-micro text-ink-tertiary">{refreshError}</p>}
          {organism.sourceType && organism.sourceType !== 'curated-local' && (
            <div className="w-full pt-1">
              <OrganismEditPanel organism={organism} onSaved={(updated) => { setOrganism(updated); setIsSaved(true) }} />
            </div>
          )}
        </div>
      </header>

      {(organism.genZNote || organism.sourceType !== 'curated-local') && (
        <div className="mb-4">
          {organism.genZNote ? (
            <CalloutBox type="aside" title="Lab brain note">
              {organism.genZNote}
            </CalloutBox>
          ) : (
            // Gen Z Learning Layer — Knowledge Layer/user-saved profiles
            // never get a fabricated memory hook from uncertain retrieved
            // information (per the redesign brief, "do not fabricate
            // humorous claims from uncertain information"). This is the
            // explicit fallback rather than silently omitting the section.
            <CalloutBox type="aside" title="Lab brain note">
              Memory hook unavailable for this source.
            </CalloutBox>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {hasClassification && (
          <SectionCard title="Classification">
            <dl>
              <InfoRow label="Domain" value={classification.domain} />
              <InfoRow label="Kingdom" value={classification.kingdom} />
              <InfoRow label="Phylum" value={classification.phylum} />
              <InfoRow label="Class" value={classification.class} />
              <InfoRow label="Order" value={classification.order} />
              <InfoRow label="Family" value={classification.family} />
              <InfoRow label="Genus" value={classification.genus} />
              <InfoRow label="Species" value={classification.species} />
            </dl>
          </SectionCard>
        )}

        <SectionCard title="Morphology">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MorphologyChip label="Shape" value={morphology.shape} />
            <MorphologyChip label="Arrangement" value={morphology.arrangement} />
            <MorphologyChip
              label="Gram reaction"
              value={morphology.gramReaction ? gramReactionLabels[morphology.gramReaction] : undefined}
            />
            {morphology.acidFast !== undefined && <MorphologyChip label="Acid-fast" value={morphology.acidFast ? 'Yes' : 'No'} />}
            <MorphologyChip label="Size" value={morphology.size} />
            {morphology.sporeForming !== undefined && (
              <MorphologyChip label="Spore" value={morphology.sporeForming ? 'Spore-forming' : 'Non-spore-forming'} />
            )}
            <MorphologyChip label="Capsule" value={morphology.capsule} />
            <MorphologyChip label="Motility" value={morphology.motility} />
            <MorphologyChip label="Oxygen requirement" value={morphology.oxygenRequirement} />
          </div>
          {morphology.notes && <p className="mt-3 font-body text-caption text-ink-secondary">{morphology.notes}</p>}
        </SectionCard>

        {hasFungalDetails && (
          <SectionCard title="Fungal characteristics">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MorphologyChip
                label="Morphological type"
                value={fungalDetails?.morphologicalType ? fungalMorphologicalTypeLabels[fungalDetails.morphologicalType] : undefined}
              />
              <MorphologyChip
                label="Hyphae"
                value={fungalDetails?.hyphae?.length ? fungalDetails.hyphae.map((h) => hyphaeTypeLabels[h]).join(', ') : undefined}
              />
              <MorphologyChip
                label="Clinical group"
                value={fungalDetails?.clinicalGroup ? fungalClinicalGroupLabels[fungalDetails.clinicalGroup] : undefined}
              />
            </div>
            {fungalDetails?.reproductiveStructures && fungalDetails.reproductiveStructures.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Reproductive/structural features</h3>
                <BulletList items={fungalDetails.reproductiveStructures} />
              </div>
            )}
          </SectionCard>
        )}

        {hasProtozoanDetails && (
          <SectionCard title="Protozoan characteristics">
            <dl>
              <InfoRow label="Group" value={protozoanDetails?.group ? protozoanGroupLabels[protozoanDetails.group] : undefined} />
              <InfoRow
                label="Major location"
                value={protozoanDetails?.majorLocation ? bodyLocationLabels[protozoanDetails.majorLocation] : undefined}
              />
              <InfoRow
                label="Transmission"
                value={protozoanDetails?.transmissionRoute ? transmissionRouteLabels[protozoanDetails.transmissionRoute] : undefined}
              />
              <InfoRow label="Life-cycle form" value={protozoanDetails?.lifeCycleForm} />
            </dl>
          </SectionCard>
        )}

        {hasVirusDetails && (
          <SectionCard title="Viral characteristics">
            <dl>
              <InfoRow label="Genome" value={virusDetails?.genomeType ? viralGenomeTypeLabels[virusDetails.genomeType] : undefined} />
              <InfoRow
                label="Genome type"
                value={virusDetails?.genomeStrandedness ? viralGenomeStrandednessLabels[virusDetails.genomeStrandedness] : undefined}
              />
              <InfoRow label="Envelope" value={virusDetails?.envelope ? viralEnvelopeLabels[virusDetails.envelope] : undefined} />
              <InfoRow label="Capsid symmetry" value={virusDetails?.capsidSymmetry} />
              <InfoRow
                label="Replication site"
                value={virusDetails?.replicationSite ? viralReplicationSiteLabels[virusDetails.replicationSite] : undefined}
              />
              <InfoRow
                label="Transmission"
                value={virusDetails?.transmissionRoute ? transmissionRouteLabels[virusDetails.transmissionRoute] : undefined}
              />
            </dl>
          </SectionCard>
        )}

        {organism.knowledgeLayer?.taxonomicResolution && (
          <CalloutBox
            type={
              organism.knowledgeLayer.taxonomicResolution.resolvedRank === 'genus' &&
              organism.scientificName.trim().split(/\s+/).length >= 2
                ? 'aside'
                : 'tip'
            }
            title="Taxonomic resolution"
          >
            {organism.knowledgeLayer.taxonomicResolution.resolvedRank === 'species' ? (
              <p>
                NCBI Taxonomy confirms “{organism.knowledgeLayer.taxonomicResolution.acceptedName}” as a species-level record.
              </p>
            ) : organism.knowledgeLayer.taxonomicResolution.resolvedRank === 'genus' ? (
              <p>
                NCBI Taxonomy only has a genus-level record for this query
                {organism.knowledgeLayer.taxonomicResolution.acceptedName ? ` (${organism.knowledgeLayer.taxonomicResolution.acceptedName})` : ''} — the
                information below reflects the genus, not a confirmed species-specific record.
              </p>
            ) : (
              <p>NCBI Taxonomy's record for this query is above species/genus level.</p>
            )}
          </CalloutBox>
        )}

        {organism.knowledgeLayer && (organism.knowledgeLayer.generalReference || organism.knowledgeLayer.meshScopeNote) && (
          <SectionCard title="General information">
            <div className="flex flex-col gap-4">
              {organism.knowledgeLayer.generalReference && (
                <div>
                  <p className="font-body text-body text-ink-primary">{organism.knowledgeLayer.generalReference.text}</p>
                  <p className="mt-1.5 font-ui text-micro text-ink-tertiary">
                    {organism.knowledgeLayer.generalReference.isAbstract ? 'Abstract from ' : 'From '}
                    <a
                      href={organism.knowledgeLayer.generalReference.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-olive hover:underline"
                    >
                      {organism.knowledgeLayer.generalReference.sourceName}
                    </a>
                  </p>
                </div>
              )}
              {organism.knowledgeLayer.meshScopeNote && (
                <div>
                  <h3 className="mb-1 font-ui text-caption font-semibold text-ink-secondary">MeSH scope note</h3>
                  <p className="font-body text-body text-ink-primary">{organism.knowledgeLayer.meshScopeNote.text}</p>
                  <p className="mt-1.5 font-ui text-micro text-ink-tertiary">
                    From{' '}
                    <a
                      href={organism.knowledgeLayer.meshScopeNote.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-olive hover:underline"
                    >
                      {organism.knowledgeLayer.meshScopeNote.sourceName}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {(organism.knowledgeLayer?.libraryExcerpts?.length ?? 0) > 0 && (
          <SectionCard
            title={
              organism.knowledgeLayer?.sourceMode === 'specific-source'
                ? `From ${organism.knowledgeLayer?.libraryExcerpts?.[0]?.bookTitle ?? 'your book'}`
                : 'Found in your sources'
            }
          >
            <div className="flex flex-col gap-4">
              {organism.knowledgeLayer?.libraryExcerpts?.map((excerpt, i) => (
                <div key={`${excerpt.libraryItemId}-${excerpt.page}-${i}`}>
                  <p className="font-body text-body italic text-ink-primary">"{excerpt.text}"</p>
                  <p className="mt-1.5 font-ui text-micro text-ink-tertiary">
                    {excerpt.bookTitle}
                    {excerpt.author ? ` \u2014 ${excerpt.author}` : ''}, p. {excerpt.page}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {(organism.knowledgeLayer?.referenceLinks?.length ?? 0) > 0 && (
          <SectionCard title="Look up on other trusted sources">
            <p className="mb-3 font-body text-micro text-ink-tertiary">
              These are direct links to each authority's own search page for “{organism.scientificName}” — Cellfie hasn't retrieved or verified
              their content.
            </p>
            <div className="flex flex-col gap-2">
              {organism.knowledgeLayer?.referenceLinks?.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-sm border border-border px-3 py-2 font-ui text-caption font-medium text-ink-secondary hover:bg-surface-raised"
                >
                  {link.name}
                  <ArrowSquareOut size={13} className="shrink-0 text-ink-tertiary" />
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {hasHabitat && (
          <SectionCard title="Habitat">
            <dl>
              <InfoRow label="Natural habitat" value={habitat?.naturalHabitat} />
              <InfoRow label="Host association" value={habitat?.hostAssociation} />
              <InfoRow label="Environmental occurrence" value={habitat?.environmentalOccurrence} />
              <InfoRow label="Reservoir" value={habitat?.reservoir} />
            </dl>
          </SectionCard>
        )}

        {hasLabId && (
          <SectionCard title="Lab identification">
            <div className="flex flex-col gap-5">
              {hasMicroscopy && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Microscopy</h3>
                  <dl>
                    <InfoRow label="Stain" value={labIdentification?.microscopy?.stain} />
                    <InfoRow label="Appearance" value={labIdentification?.microscopy?.appearance} />
                    <InfoRow label="Arrangement" value={labIdentification?.microscopy?.arrangement} />
                  </dl>
                </div>
              )}

              {hasCulture && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Culture</h3>
                  <dl>
                    <InfoRow label="Media" value={labIdentification?.culture?.media} />
                    <InfoRow label="Growth characteristics" value={labIdentification?.culture?.growthCharacteristics} />
                    <InfoRow label="Colony morphology" value={labIdentification?.culture?.colonyMorphology} />
                    <InfoRow label="Pigmentation" value={labIdentification?.culture?.pigmentation} />
                    <InfoRow label="Hemolysis" value={labIdentification?.culture?.hemolysis} />
                  </dl>
                </div>
              )}

              {hasBiochemTests && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Biochemical tests</h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[280px] border-collapse">
                      <thead>
                        <tr className="bg-surface-raised">
                          <th scope="col" className="px-4 py-2.5 text-left font-ui text-ui font-medium text-ink-secondary">
                            Test
                          </th>
                          <th scope="col" className="px-4 py-2.5 text-left font-ui text-ui font-medium text-ink-primary">
                            Result
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {labIdentification?.biochemicalTests?.map((t, i) => (
                          <tr key={`${t.test}-${i}`} className="border-t border-border">
                            <th scope="row" className="px-4 py-2.5 text-left font-ui text-ui font-medium text-ink-secondary">
                              {t.test}
                            </th>
                            <td className="px-4 py-2.5 font-body text-body text-ink-primary">{t.result}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {organism.identificationClues.length > 0 && (
          <CalloutBox type="tip" title="How to recognize it">
            <ul className="list-disc space-y-1 pl-4">
              {organism.identificationClues.map((clue, i) => (
                <li key={i}>{clue}</li>
              ))}
            </ul>
          </CalloutBox>
        )}

        {hasClinical && (
          <SectionCard title="Clinical & microbiological importance">
            <div className="flex flex-col gap-4">
              {clinicalImportance?.diseases && clinicalImportance.diseases.length > 0 && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Associated diseases/conditions</h3>
                  <BulletList items={clinicalImportance.diseases} />
                </div>
              )}
              {clinicalImportance?.virulenceFactors && clinicalImportance.virulenceFactors.length > 0 && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Virulence factors</h3>
                  <BulletList items={clinicalImportance.virulenceFactors} />
                </div>
              )}
              {clinicalImportance?.toxins && clinicalImportance.toxins.length > 0 && (
                <div>
                  <h3 className="mb-1.5 font-ui text-caption font-semibold text-ink-secondary">Toxins</h3>
                  <BulletList items={clinicalImportance.toxins} />
                </div>
              )}
              <dl>
                <InfoRow label="Transmission" value={clinicalImportance?.transmission} />
                <InfoRow label="Epidemiology" value={clinicalImportance?.epidemiology} />
                <InfoRow label="Laboratory significance" value={clinicalImportance?.labSignificance} />
              </dl>
            </div>
          </SectionCard>
        )}

        {hasExamFacts && (
          <div className="rounded-md border border-terracotta/40 bg-surface-raised p-5">
            <h2 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
              <Sparkle size={14} className="text-terracotta" aria-hidden />
              Exam quick facts
            </h2>
            <dl>
              <InfoRow label="Gram reaction" value={examFacts.gramReaction} />
              <InfoRow label="Shape" value={examFacts.shape} />
              <InfoRow label="Key biochemical reaction" value={examFacts.keyBiochemicalReaction} />
              <InfoRow label="Important disease" value={examFacts.importantDisease} />
              <InfoRow label="Important test" value={examFacts.importantTest} />
              <InfoRow label="Distinguishing feature" value={examFacts.distinguishingFeature} />
            </dl>
          </div>
        )}

        {relatedOrganisms.length > 0 && (
          <SectionCard title="Related organisms">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 font-ui text-caption text-ink-tertiary">
                <GitBranch size={14} aria-hidden />
                Organisms worth comparing this one against
              </div>
              <div className="flex flex-col gap-2">
                {relatedOrganisms.map(({ organism: related, relationship }) => (
                  <button
                    key={related.id}
                    type="button"
                    onClick={() => navigate(`/organisms/${related.id}`)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border-strong bg-canvas px-3 py-2 text-left hover:bg-surface-raised"
                  >
                    <span className="font-ui text-caption font-medium italic text-ink-primary">{related.scientificName}</span>
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-ink-tertiary">
                      {relatedOrganismRelationshipLabels[relationship]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {organism.sources.length > 0 && (
          <SectionCard title="Sources this profile is informed by">
            <div className="flex flex-col gap-2">
              {organism.sources.map((source, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="font-body text-caption text-ink-secondary">
                    {source.kind === 'local-book' ? source.bookTitle ?? source.name : source.name}
                    {source.kind === 'local-book' && source.page && <span className="text-ink-tertiary">{` \u2014 p. ${source.page}`}</span>}
                    <span className="ml-2 rounded-full bg-surface-raised px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-ink-tertiary">
                      {source.kind === 'educational' ? 'Educational' : source.kind === 'local-book' ? 'Your library' : 'Scientific'}
                    </span>
                  </span>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex shrink-0 items-center gap-1 font-ui text-caption font-medium text-olive hover:underline"
                    >
                      Visit <ArrowSquareOut size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
