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
import type { ContentAvailability } from './types'

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
