/**
 * core/knowledge/labels — the one place that turns a `ContentAvailability`
 * value into user-facing text, so every UI surface describes a result
 * the same honest way.
 *
 * SECOND-PASS FIX (brief §9/§10): the first-pass implementation collapsed
 * `contentAvailability` into a single `isAbstract` boolean computed as
 * `contentAvailability === 'ABSTRACT' || contentAvailability === 'FULL_TEXT'`
 * — which meant a FULL_TEXT result was displayed with the exact same
 * "Abstract from …" label as an ABSTRACT result. That's a real honesty
 * bug: a full-text result must say so, not be quietly downgraded to
 * "abstract". This module replaces that boolean with an explicit label
 * per `ContentAvailability` value, and nothing downstream needs to infer
 * content type from a lossy boolean anymore.
 */
import type { ContentAvailability, NormalizedKnowledgeResult } from './types'

export function contentAvailabilityLabel(availability: ContentAvailability | undefined): string {
  switch (availability) {
    case 'FULL_TEXT':
      return 'Full text available from'
    case 'ABSTRACT':
      return 'Abstract from'
    case 'METADATA_ONLY':
      return 'Publication metadata from'
    case 'EXTERNAL_LINK':
      return 'External link from'
    default:
      return 'From'
  }
}

/**
 * Shown in place of body text whenever a result has no genuine
 * excerpt/abstract to display. See `resultDisplayText` below for why
 * this exists — a title is a citation, never a substitute for content.
 */
const NO_EXCERPT_TEXT = 'No excerpt is available from this source — open the link below to read it at the source.'

/**
 * The one honest way to get body/paragraph text for a knowledge
 * result, for any caller that needs a plain `text: string` to render
 * (e.g. `SourcedExcerpt.text` in `core/organisms/types.ts`, consumed by
 * `LabSourcesPanel.tsx` / `ComparisonSourcesPanel.tsx` /
 * `ComparisonEnrichmentPanel.tsx` / `OrganismDetailPage.tsx`).
 *
 * ROOT-CAUSE FIX (brief §11, "metadata-only results must not
 * masquerade as knowledge"): every one of those call sites used to fall
 * back to `result.abstract ?? result.title` when a provider had no
 * abstract — which meant a bare paper/chapter TITLE was silently
 * rendered as if it were the enrichment excerpt itself (exactly the
 * "Metabolic enzymes moonlighting as RNA binding..." bug the brief
 * describes). A title can still be shown as a citation/link label
 * elsewhere in the same UI, but it must never stand in for content
 * here. This function is the one place that decision is made, so every
 * caller gets the same honest behavior without re-deriving it.
 */
export function resultDisplayText(result: Pick<NormalizedKnowledgeResult, 'abstract'>): string {
  return result.abstract ?? NO_EXCERPT_TEXT
}
