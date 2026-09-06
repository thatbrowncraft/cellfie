import { useEffect, type ReactNode } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Sparkle } from '@phosphor-icons/react'
import { Card, CardBody, EmptyState, H2, Body, Caption, Micro, CalloutBox, Button } from '../../shared/components'
import { getElementById } from '../../core/periodic-table/registry'
import { recordElementViewed } from '../../core/periodic-table/recentlyViewed'
import { categoryAccentColor } from './categoryStyle'

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <Micro className="block text-ink-tertiary">{label}</Micro>
      <Body className="mt-0.5">{value}</Body>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <Caption className="mb-2 block font-medium uppercase tracking-wide text-ink-tertiary">{title}</Caption>
      {children}
    </div>
  )
}

/**
 * Element profile — organized exactly per brief §10's section order.
 * Every section is conditionally rendered: a field the dataset doesn't
 * have for this element (brief §4's "don't force N/A") simply doesn't
 * appear, rather than showing an empty heading.
 */
export function ElementDetailPage() {
  const { elementId } = useParams<{ elementId: string }>()
  const navigate = useNavigate()
  const element = elementId ? getElementById(elementId) : undefined

  // Dashboard "Periodic Table" preview support — fire-and-forget, never
  // blocks render. Same pattern as Laboratory/Organism detail pages.
  useEffect(() => {
    if (element) {
      void recordElementViewed(element.id)
    }
  }, [element])

  if (!element) {
    return (
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
        <EmptyState
          title="Element not found"
          description="That element profile doesn't exist."
          action={
            <Button variant="secondary" onClick={() => navigate('/periodic-table')}>
              Back to Periodic Table
            </Button>
          }
        />
      </div>
    )
  }

  const accent = categoryAccentColor(element.elementCategory)

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <button
        type="button"
        onClick={() => navigate('/periodic-table')}
        className="mb-4 flex items-center gap-1.5 font-ui text-caption text-ink-secondary hover:text-ink-primary"
      >
        <ArrowLeft size={16} aria-hidden /> Periodic Table
      </button>

      {/* IDENTITY */}
      <header className="mb-6 flex items-start gap-4">
        <div
          className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-md border"
          style={{ borderColor: accent, backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` }}
        >
          <span className="font-ui text-micro text-ink-tertiary">{element.atomicNumber}</span>
          <span className="font-display text-h1 font-semibold text-ink-primary">{element.symbol}</span>
        </div>
        <div>
          <H2 as="h1">{element.name}</H2>
          <Body className="text-ink-secondary">
            {element.elementCategoryLabel} · Atomic mass {element.atomicMass}
          </Body>
        </div>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <Section title="Periodic Position">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Group" value={element.group} />
              <Field label="Period" value={element.period} />
              <Field label="Block" value={`${element.block}-block`} />
              <Field label="Family" value={element.elementCategoryLabel} />
            </div>
          </Section>

          <Section title="Electronic Structure">
            <div className="flex flex-col gap-3">
              <Field label="Electron Configuration" value={element.electronConfiguration} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Common Valency" value={element.commonValency} />
                <Field label="Common Oxidation States" value={element.commonOxidationStates?.join(', ')} />
              </div>
            </div>
          </Section>

          {(element.phaseAtRoomTemp || element.density || element.meltingPointC !== undefined || element.boilingPointC !== undefined) && (
            <Section title="Physical Properties">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="State (room temp)" value={element.phaseAtRoomTemp} />
                <Field label="Density" value={element.density} />
                <Field label="Melting Point" value={element.meltingPointC !== undefined ? `${element.meltingPointC} °C` : undefined} />
                <Field label="Boiling Point" value={element.boilingPointC !== undefined ? `${element.boilingPointC} °C` : undefined} />
              </div>
            </Section>
          )}

          {(element.electronegativityPauling !== undefined || element.notableCharacteristics) && (
            <Section title="Chemical Character">
              <div className="flex flex-col gap-2">
                <Field
                  label="Electronegativity (Pauling)"
                  value={element.electronegativityPauling !== undefined ? element.electronegativityPauling : undefined}
                />
                {element.notableCharacteristics && <Body>{element.notableCharacteristics}</Body>}
              </div>
            </Section>
          )}

          {element.occurrence && (
            <Section title="Occurrence">
              <Body>{element.occurrence}</Body>
              {element.discovery?.discoverer && (
                <Micro className="mt-1 block text-ink-tertiary">
                  {element.discovery.year ? `Discovered ${element.discovery.year} by ` : 'Discovered by '}
                  {element.discovery.discoverer}
                </Micro>
              )}
            </Section>
          )}

          {element.majorUses && element.majorUses.length > 0 && (
            <Section title="Uses">
              <ul className="list-inside list-disc font-body text-body text-ink-primary">
                {element.majorUses.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </Section>
          )}

          {element.biologicalRelevance && (
            <Section title="Biological Connection">
              <Body>{element.biologicalRelevance}</Body>
            </Section>
          )}

          {element.safetyNotes && (
            <Section title="Safety">
              <CalloutBox type="safety">{element.safetyNotes}</CalloutBox>
            </Section>
          )}

          {element.ncertRelevance && element.ncertRelevance.length > 0 && (
            <Section title="NCERT / Study Relevance">
              <ul className="list-inside list-disc font-body text-body text-ink-primary">
                {element.ncertRelevance.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Section>
          )}

          {element.whyHere && (
            <Section title="Why Is This Element Here?">
              <Body>{element.whyHere}</Body>
            </Section>
          )}

          {element.didYouKnow && (
            <Section title="Did You Know?">
              <CalloutBox type="aside">{element.didYouKnow}</CalloutBox>
            </Section>
          )}

          {element.genZNote && (
            <Section title="Gen Z Note">
              <div className="flex items-start gap-2 rounded-sm border border-terracotta p-3">
                <Sparkle size={18} className="mt-0.5 flex-shrink-0 text-terracotta" aria-hidden />
                <Body className="italic">{element.genZNote}</Body>
              </div>
            </Section>
          )}

          {element.relatedElements && element.relatedElements.length > 0 && (
            <Section title="Related Elements">
              <div className="flex flex-wrap gap-2">
                {element.relatedElements.map((relId) => {
                  const rel = getElementById(relId)
                  if (!rel) return null
                  return (
                    <Link
                      key={relId}
                      to={`/periodic-table/${relId}`}
                      className="rounded-full border border-border px-3 py-1 font-ui text-caption text-ink-secondary hover:bg-surface-raised hover:text-ink-primary"
                    >
                      {rel.symbol} — {rel.name}
                    </Link>
                  )
                })}
              </div>
            </Section>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
