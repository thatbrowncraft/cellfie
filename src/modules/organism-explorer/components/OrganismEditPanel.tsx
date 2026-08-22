import { useState } from 'react'
import { Check, PencilSimple, X } from '@phosphor-icons/react'
import { Button, Dropdown, Input, type DropdownOption } from '@/shared/components'
import { gramReactionLabels, updateOrganismProfile, type GramReaction, type OrganismProfile } from '@/core/organisms'

interface OrganismEditPanelProps {
  organism: OrganismProfile
  onSaved: (updated: OrganismProfile) => void
}

const GRAM_OPTIONS: DropdownOption[] = (['positive', 'negative', 'variable', 'not-applicable'] as GramReaction[]).map((value) => ({
  value,
  label: gramReactionLabels[value]
}))

interface DraftState {
  quickTags: string
  identificationClues: string
  genus: string
  species: string
  family: string
  order: string
  class: string
  phylum: string
  kingdom: string
  domain: string
  shape: string
  size: string
  arrangement: string
  motility: string
  capsule: string
  oxygenRequirement: string
  gramReaction: GramReaction | undefined
  morphologyNotes: string
  importantDisease: string
  importantTest: string
  distinguishingFeature: string
  keyBiochemicalReaction: string
}

function toDraft(o: OrganismProfile): DraftState {
  return {
    quickTags: o.quickTags.join(', '),
    identificationClues: o.identificationClues.join('\n'),
    genus: o.classification.genus ?? '',
    species: o.classification.species ?? '',
    family: o.classification.family ?? '',
    order: o.classification.order ?? '',
    class: o.classification.class ?? '',
    phylum: o.classification.phylum ?? '',
    kingdom: o.classification.kingdom ?? '',
    domain: o.classification.domain ?? '',
    shape: o.morphology.shape ?? '',
    size: o.morphology.size ?? '',
    arrangement: o.morphology.arrangement ?? '',
    motility: o.morphology.motility ?? '',
    capsule: o.morphology.capsule ?? '',
    oxygenRequirement: o.morphology.oxygenRequirement ?? '',
    gramReaction: o.morphology.gramReaction,
    morphologyNotes: o.morphology.notes ?? '',
    importantDisease: o.examFacts.importantDisease ?? '',
    importantTest: o.examFacts.importantTest ?? '',
    distinguishingFeature: o.examFacts.distinguishingFeature ?? '',
    keyBiochemicalReaction: o.examFacts.keyBiochemicalReaction ?? ''
  }
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function splitCommaList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** undefined (not '') for a blank field, so an emptied-out field is actually removed rather than saved as an empty string that still renders an (empty) row. */
function orUndefined(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined
}

/**
 * §"edit or write options at every section" — a single edit surface
 * covering the fields most likely to come back thin or empty from a
 * Knowledge Layer lookup (quick tags, identification clues,
 * classification, core morphology, and the exam-facts summary).
 *
 * Deliberately NOT covering (this pass): the category-specific detail
 * blocks (`fungalDetails`/`protozoanDetails`/`virusDetails`), the
 * normalized filter-matching enum fields (`shapeCategory`,
 * `oxygenRequirementCategory`, etc.), sources, and related-organism
 * links. Exposing those as free text risks silently breaking the
 * category filters, which match on the normalized enum, not the
 * display string — a real form/dropdown per category would be the
 * right way to cover them and is future scope, not something to fake
 * with a text box.
 *
 * Only ever rendered for `sourceType !== 'curated-local'` — see
 * `updateOrganismProfile`'s doc comment for why editing a curated
 * profile isn't offered at all.
 */
export function OrganismEditPanel({ organism, onSaved }: OrganismEditPanelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DraftState>(() => toDraft(organism))
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setDraft(toDraft(organism))
    setEditing(true)
  }

  function updateField<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    const updated = await updateOrganismProfile(organism, {
      quickTags: splitCommaList(draft.quickTags),
      identificationClues: splitLines(draft.identificationClues),
      classification: {
        genus: orUndefined(draft.genus),
        species: orUndefined(draft.species),
        family: orUndefined(draft.family),
        order: orUndefined(draft.order),
        class: orUndefined(draft.class),
        phylum: orUndefined(draft.phylum),
        kingdom: orUndefined(draft.kingdom),
        domain: orUndefined(draft.domain)
      },
      morphology: {
        ...organism.morphology,
        shape: orUndefined(draft.shape),
        size: orUndefined(draft.size),
        arrangement: orUndefined(draft.arrangement),
        motility: orUndefined(draft.motility),
        capsule: orUndefined(draft.capsule),
        oxygenRequirement: orUndefined(draft.oxygenRequirement),
        gramReaction: draft.gramReaction,
        notes: orUndefined(draft.morphologyNotes)
      },
      examFacts: {
        ...organism.examFacts,
        importantDisease: orUndefined(draft.importantDisease),
        importantTest: orUndefined(draft.importantTest),
        distinguishingFeature: orUndefined(draft.distinguishingFeature),
        keyBiochemicalReaction: orUndefined(draft.keyBiochemicalReaction)
      }
    })
    setIsSaving(false)
    setEditing(false)
    onSaved(updated)
  }

  function handleCancel() {
    setDraft(toDraft(organism))
    setEditing(false)
  }

  if (!editing) {
    return (
      <Button variant="tertiary" size="small" icon={<PencilSimple size={14} />} onClick={startEditing}>
        Edit organism
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-5 rounded-md border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-caption font-semibold uppercase tracking-wide text-ink-tertiary">Edit organism</h3>
        <div className="flex gap-2">
          <Button variant="tertiary" size="small" icon={<X size={14} />} onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" size="small" icon={<Check size={14} />} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving\u2026' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div>
        <Input label="Quick tags (comma-separated)" value={draft.quickTags} onChange={(e) => updateField('quickTags', e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block font-ui text-micro font-medium text-ink-tertiary">Identification clues (one per line)</label>
        <textarea
          value={draft.identificationClues}
          onChange={(e) => updateField('identificationClues', e.target.value)}
          rows={4}
          className="w-full rounded-sm border border-border bg-canvas p-3 font-body text-body text-ink-primary outline-none focus:border-2 focus:border-olive"
        />
      </div>

      <div>
        <h4 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Classification</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label="Domain" value={draft.domain} onChange={(e) => updateField('domain', e.target.value)} />
          <Input label="Kingdom" value={draft.kingdom} onChange={(e) => updateField('kingdom', e.target.value)} />
          <Input label="Phylum" value={draft.phylum} onChange={(e) => updateField('phylum', e.target.value)} />
          <Input label="Class" value={draft.class} onChange={(e) => updateField('class', e.target.value)} />
          <Input label="Order" value={draft.order} onChange={(e) => updateField('order', e.target.value)} />
          <Input label="Family" value={draft.family} onChange={(e) => updateField('family', e.target.value)} />
          <Input label="Genus" value={draft.genus} onChange={(e) => updateField('genus', e.target.value)} />
          <Input label="Species" value={draft.species} onChange={(e) => updateField('species', e.target.value)} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Morphology</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input label="Shape" value={draft.shape} onChange={(e) => updateField('shape', e.target.value)} />
          <Input label="Size" value={draft.size} onChange={(e) => updateField('size', e.target.value)} />
          <Input label="Arrangement" value={draft.arrangement} onChange={(e) => updateField('arrangement', e.target.value)} />
          <Input label="Motility" value={draft.motility} onChange={(e) => updateField('motility', e.target.value)} />
          <Input label="Capsule" value={draft.capsule} onChange={(e) => updateField('capsule', e.target.value)} />
          <Input label="Oxygen requirement" value={draft.oxygenRequirement} onChange={(e) => updateField('oxygenRequirement', e.target.value)} />
          <Dropdown
            label="Gram reaction"
            options={GRAM_OPTIONS}
            value={draft.gramReaction}
            onChange={(v) => updateField('gramReaction', v as GramReaction)}
            placeholder="Not set"
          />
        </div>
        <div className="mt-3">
          <Input label="Other morphology notes" value={draft.morphologyNotes} onChange={(e) => updateField('morphologyNotes', e.target.value)} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Exam facts</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Important disease" value={draft.importantDisease} onChange={(e) => updateField('importantDisease', e.target.value)} />
          <Input label="Important test" value={draft.importantTest} onChange={(e) => updateField('importantTest', e.target.value)} />
          <Input label="Distinguishing feature" value={draft.distinguishingFeature} onChange={(e) => updateField('distinguishingFeature', e.target.value)} />
          <Input label="Key biochemical reaction" value={draft.keyBiochemicalReaction} onChange={(e) => updateField('keyBiochemicalReaction', e.target.value)} />
        </div>
      </div>

      <p className="font-body text-micro text-ink-tertiary">
        These changes save to your own local copy of this organism — they never modify Cellfie's curated library.
      </p>
    </div>
  )
}
