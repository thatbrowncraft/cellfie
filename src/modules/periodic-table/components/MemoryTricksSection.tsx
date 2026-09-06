import { useMemo, useState } from 'react'
import { Brain } from '@phosphor-icons/react'
import { Accordion, Card, CardBody, CalloutBox, H3, UIText, Body, Caption, Micro } from '../../../shared/components'
import { cn } from '../../../shared/utils/cn'
import { ALL_ELEMENTS } from '../../../core/periodic-table/registry'
import {
  MEMORY_CHUNKS,
  FAMILY_MEMORY,
  PERIOD_MEMORY,
  TRANSITION_METAL_CHUNKS,
  LANTHANIDES,
  ACTINIDES,
  DIFFICULT_SEQUENCES,
  TEACHER_TRICKS
} from '../../../core/periodic-table/memoryTricks'
import { RecallCard } from './RecallCard'

const FIRST_20 = ALL_ELEMENTS.filter((e) => e.atomicNumber <= 20)

const PROGRESSION_LEVELS = [
  { level: 1, label: 'First 20' },
  { level: 2, label: 'Families' },
  { level: 3, label: 'Periods' },
  { level: 4, label: 'Transition Metals' },
  { level: 5, label: 'Lanthanides + Actinides' },
  { level: 6, label: 'Full 1–118' }
]

function MemoryChunkCard({
  label,
  symbols,
  mnemonic,
  note
}: {
  label: string
  symbols: string[]
  mnemonic: string
  note?: string
}) {
  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <Caption className="font-medium text-ink-primary">{label}</Caption>
      <p className="mt-1 font-ui text-caption text-ink-tertiary">{symbols.join(' · ')}</p>
      <Body className="mt-1 italic">{mnemonic}</Body>
      {note && <Body className="mt-1 text-ink-tertiary">{note}</Body>}
    </div>
  )
}

/**
 * Periodic Table Memory Tricks — extends the Trend Guide (brief's
 * "Periodic Table Memory Tricks" section, not a redesign of the
 * existing table/trend-guide above it). Pure presentational component
 * over `core/periodic-table/memoryTricks.ts`'s curated data; the only
 * local state is which recall cards are flipped, which lives in
 * `RecallCard` itself.
 */
export function MemoryTricksSection() {
  const [first20Stage, setFirst20Stage] = useState<'symbols' | 'names' | 'both'>('both')

  const first20Symbols = useMemo(() => FIRST_20.map((e) => e.symbol), [])
  const first20Names = useMemo(() => FIRST_20.map((e) => e.name), [])

  const accordionItems = [
    {
      id: 'by-period',
      title: 'By Period',
      content: (
        <div className="flex flex-col gap-4">
          {PERIOD_MEMORY.map((p) => (
            <div key={p.period} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <Caption className="font-medium text-ink-primary">
                Period {p.period} ({p.range[0]}–{p.range[1]})
              </Caption>
              <p className="mt-1 font-ui text-caption text-ink-tertiary">{p.symbols.join(' · ')}</p>
              {p.difficultPart && (
                <Body className="mt-1 text-ink-tertiary">
                  <span className="font-medium text-ink-secondary">Hard part: </span>
                  {p.difficultPart}
                </Body>
              )}
              <Body className="mt-1">
                <span className="font-medium text-ink-secondary">Recall trick: </span>
                {p.recallTrick}
              </Body>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'by-family',
      title: 'By Family',
      content: (
        <div className="flex flex-col gap-4">
          {FAMILY_MEMORY.map((f) => (
            <div key={f.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <Caption className="font-medium text-ink-primary">{f.label}</Caption>
              <p className="mt-1 font-ui text-caption text-ink-tertiary">
                {f.symbols.map((s, i) => `${f.atomicNumbers[i]} ${s}`).join(' · ')}
              </p>
              <p className="mt-0.5 font-ui text-caption text-ink-tertiary">{f.names.join(', ')}</p>
              <Body className="mt-1 italic">{f.mnemonic}</Body>
              <Body className="mt-1 text-ink-tertiary">{f.patternHint}</Body>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'transition-metals',
      title: 'Transition Metals',
      content: (
        <div className="flex flex-col gap-4">
          <Body className="text-ink-tertiary">
            The d-block is long, but it only ever shows up in four chunks — one per period. Learn each chunk once.
          </Body>
          {TRANSITION_METAL_CHUNKS.map((c) => (
            <MemoryChunkCard key={c.id} label={c.label} symbols={c.symbols} mnemonic={c.mnemonic} note={c.note} />
          ))}
        </div>
      )
    },
    {
      id: 'lanthanides',
      title: 'Lanthanides',
      content: (
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-ui text-caption text-ink-tertiary">
              {LANTHANIDES.symbols.map((s, i) => `${LANTHANIDES.atomicNumbers[i]} ${s}`).join(' · ')}
            </p>
            <p className="mt-0.5 font-ui text-caption text-ink-tertiary">{LANTHANIDES.names.join(', ')}</p>
          </div>
          {LANTHANIDES.mnemonicHalves.map((half, i) => (
            <div key={i} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <p className="font-ui text-caption text-ink-tertiary">{half.symbols.join(' · ')}</p>
              <Body className="mt-1 italic">{half.mnemonic}</Body>
            </div>
          ))}
          <Body className="text-ink-tertiary">{LANTHANIDES.troubleSpot}</Body>
        </div>
      )
    },
    {
      id: 'actinides',
      title: 'Actinides',
      content: (
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-ui text-caption text-ink-tertiary">
              {ACTINIDES.symbols.map((s, i) => `${ACTINIDES.atomicNumbers[i]} ${s}`).join(' · ')}
            </p>
            <p className="mt-0.5 font-ui text-caption text-ink-tertiary">{ACTINIDES.names.join(', ')}</p>
          </div>
          {ACTINIDES.mnemonicHalves.map((half, i) => (
            <div key={i} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <p className="font-ui text-caption text-ink-tertiary">{half.symbols.join(' · ')}</p>
              <Body className="mt-1 italic">{half.mnemonic}</Body>
            </div>
          ))}
          <Body className="text-ink-tertiary">{ACTINIDES.troubleSpot}</Body>
        </div>
      )
    },
    {
      id: 'difficult-sequences',
      title: 'Difficult Sequences',
      content: (
        <div className="flex flex-col gap-4">
          {DIFFICULT_SEQUENCES.map((d) => (
            <div key={d.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <Caption className="font-medium text-ink-primary">{d.label}</Caption>
              <p className="mt-1 font-ui text-caption text-ink-tertiary">{d.symbols.join(' · ')}</p>
              <Body className="mt-1">{d.hook}</Body>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'teacher-tricks',
      title: 'Teacher Tricks',
      content: (
        <div className="flex flex-col gap-3">
          {TEACHER_TRICKS.map((t) => (
            <CalloutBox key={t.id} type="tip" title="Teacher Trick">
              {t.text}
            </CalloutBox>
          ))}
        </div>
      )
    },
    {
      id: 'full-recall',
      title: 'Full 1–118 Quick Recall',
      content: (
        <div className="flex flex-col gap-4">
          <Body className="text-ink-tertiary">
            The whole sequence, chunked in 10s. Each chunk below is its own mnemonic — you don't need all twelve at
            once, just the ones you haven't nailed yet.
          </Body>
          {MEMORY_CHUNKS.map((c) => (
            <MemoryChunkCard key={c.id} label={c.label} symbols={c.symbols} mnemonic={c.mnemonic} note={c.note} />
          ))}
          <div className="mt-2 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[320px] border-collapse">
              <thead>
                <tr className="bg-surface-raised">
                  <th scope="col" className="px-3 py-2 text-left font-ui text-caption font-medium text-ink-secondary">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-ui text-caption font-medium text-ink-secondary">
                    Symbol
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-ui text-caption font-medium text-ink-secondary">
                    Element
                  </th>
                </tr>
              </thead>
              <tbody className="max-h-80 overflow-y-auto">
                {ALL_ELEMENTS.map((e, i) => (
                  <tr key={e.id} className={cn('border-t border-border', i % 2 === 1 && 'bg-surface')}>
                    <td className="px-3 py-1.5 font-ui text-caption text-ink-tertiary">{e.atomicNumber}</td>
                    <td className="px-3 py-1.5 font-ui text-caption font-medium text-ink-primary">{e.symbol}</td>
                    <td className="px-3 py-1.5 font-body text-caption text-ink-secondary">{e.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Micro className="block">Scroll for the full 118 — this is a revision table, not a replacement for the grid above.</Micro>
        </div>
      )
    }
  ]

  return (
    <Card className="mt-6">
      <CardBody>
        <div className="flex items-start gap-3">
          <Brain size={24} className="mt-1 flex-shrink-0 text-terracotta" aria-hidden />
          <div>
            <H3>Periodic Table Memory Tricks</H3>
            <Body className="mt-1 text-ink-secondary">
              Because memorizing 118 elements one by one is not exactly a personality trait.
            </Body>
          </div>
        </div>

        {/* Progression path — brief §19: easiest to hardest, not all 118 thrown at once. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PROGRESSION_LEVELS.map((l) => (
            <span
              key={l.level}
              className="rounded-full border border-border px-3 py-1 font-ui text-caption font-medium text-ink-secondary"
            >
              Level {l.level} · {l.label}
            </span>
          ))}
        </div>

        {/* First 20 — dedicated treatment, brief §5. */}
        <div className="mt-6 rounded-md border border-border bg-surface-raised p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <UIText as="h4" className="text-body font-semibold">
              Level 1 — The First 20 (Your Starter Pack)
            </UIText>
            <div className="flex gap-1">
              {(['symbols', 'names', 'both'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFirst20Stage(mode)}
                  aria-pressed={first20Stage === mode}
                  className={cn(
                    'rounded-sm border px-2.5 py-1 font-ui text-caption font-medium transition-colors duration-micro',
                    first20Stage === mode
                      ? 'border-olive bg-surface text-ink-primary'
                      : 'border-border text-ink-secondary hover:bg-surface'
                  )}
                >
                  {mode === 'both' ? 'Both' : mode === 'symbols' ? 'Symbols' : 'Names'}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 font-ui text-caption text-ink-tertiary">
            {first20Stage !== 'names' && <span>{first20Symbols.slice(0, 10).join(' ')}</span>}
            {first20Stage === 'both' && <br />}
            {first20Stage !== 'symbols' && <span>{first20Names.slice(0, 10).join(', ')}</span>}
          </p>
          <p className="mt-1 font-ui text-caption text-ink-tertiary">
            {first20Stage !== 'names' && <span>{first20Symbols.slice(10, 20).join(' ')}</span>}
            {first20Stage === 'both' && <br />}
            {first20Stage !== 'symbols' && <span>{first20Names.slice(10, 20).join(', ')}</span>}
          </p>

          <div className="mt-3 flex flex-col gap-3">
            <MemoryChunkCard label="Elements 1–10" symbols={MEMORY_CHUNKS[0].symbols} mnemonic={MEMORY_CHUNKS[0].mnemonic} />
            <MemoryChunkCard label="Elements 11–20" symbols={MEMORY_CHUNKS[1].symbols} mnemonic={MEMORY_CHUNKS[1].mnemonic} />
          </div>

          <Caption className="mt-4 block font-medium text-ink-secondary">Quick recall — tap to flip</Caption>
          <div className="mt-2 grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4">
            <RecallCard prompt="Element 17?" answer="Cl — Chlorine" />
            <RecallCard prompt="Atomic number of Potassium?" answer="19 — K" />
            <RecallCard prompt="Symbol Na is…" answer="Sodium (11)" />
            <RecallCard prompt="Na Mg Al Si ? ?" answer="P S" />
          </div>
        </div>

        <Accordion className="mt-6" items={accordionItems} allowMultiple />
      </CardBody>
    </Card>
  )
}
