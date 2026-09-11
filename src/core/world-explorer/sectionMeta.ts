/**
 * core/world-explorer/sectionMeta — canonical display order for
 * `CountryProfile.sections`.
 *
 * A `CountryProfile`'s `sections` array (see `types.ts`) is still a
 * plain `LessonSection[]` — no schema change. This file only decides
 * WHERE each section id appears on the page, so:
 *
 * 1. Every country JSON can list its sections in whatever order was
 *    convenient to author them in.
 * 2. The rendered page still always follows the same
 *    At a Glance → Currency & Economy → Known For → Geography →
 *    Ecology → Culture → History → Government → Political Changes →
 *    India Connection → Global Relations → Science → Trade →
 *    Space & Innovation → Sports & Recognition → Intl. Organizations →
 *    Current Affairs → Quick Revision → Exam Focus → Memory Hook
 *    dashboard shape the brief asks for, for every country that has a
 *    profile — 10-section countries and 20-section countries alike.
 * 3. Adding a brand-new section id to a country JSON (e.g. a country's
 *    first `space-innovation` section) "just works": it slots into the
 *    right spot automatically. An id not listed here still renders —
 *    it's placed after every known id, in the order it appears in the
 *    JSON, so authoring ahead of this list never hides content.
 *
 * Depth is intentionally NOT uniform across countries (brief:
 * "content depth should be proportional to the country's importance
 * and available reliable information") — this file only orders
 * whichever section ids a given country's JSON actually has.
 */

/** Every section id currently in use across the 58 country profiles, plus every new id the brief asks for, in canonical reading order. */
export const SECTION_ORDER: string[] = [
  'currency-economy',
  'known-for',
  'geography',
  'ecology-environment',
  'people-culture',
  'history',
  'government-society',
  'political-constitutional-changes',
  'india-relations',
  'global-relations',
  'medical-scientific',
  'trade-economy',
  'space-innovation',
  'sports-arts-recognition',
  'international-organizations',
  'current-affairs-connection'
]

const ORDER_INDEX: Map<string, number> = new Map(SECTION_ORDER.map((id, i) => [id, i]))

/**
 * Sorts a country's sections into the canonical dashboard order.
 * Stable: unrecognized ids keep their relative JSON order and are
 * placed after every recognized id, so nothing is ever dropped or
 * hidden just because this list hasn't caught up with it yet.
 */
export function sortSectionsForDisplay<T extends { id: string }>(sections: T[]): T[] {
  return sections
    .map((section, originalIndex) => ({ section, originalIndex }))
    .sort((a, b) => {
      const orderA = ORDER_INDEX.get(a.section.id) ?? SECTION_ORDER.length + a.originalIndex
      const orderB = ORDER_INDEX.get(b.section.id) ?? SECTION_ORDER.length + b.originalIndex
      return orderA - orderB
    })
    .map(({ section }) => section)
}

/**
 * TOPIC_CATALOG — the World Explorer landing page's "browse by topic"
 * grid (see `WorldExplorerPage.tsx`) and the cross-country topic view
 * (`WorldExplorerTopicPage.tsx`) both read from this single list, so
 * the topic a student taps always matches a real, renderable id.
 *
 * `id` matches a `LessonSection.id` used across the country JSON files
 * — EXCEPT the three trailing entries (`quick-revision`, `exam-focus`,
 * `memory-hook`), which aren't sections at all but the other
 * per-country building blocks (`CountryProfile.quickRevision` /
 * `.examFocus` / `.genZNote`). `WorldExplorerTopicPage` special-cases
 * those three; every other id is looked up the normal way via
 * `getAllCountryProfiles()` + a `sections.find(id)`.
 */
export interface TopicCatalogEntry {
  id: string
  /** Icon + label together, e.g. "💰 Currency & Economy" — used as both the landing-page button label and the topic page heading. */
  label: string
}

export const TOPIC_CATALOG: TopicCatalogEntry[] = [
  { id: 'currency-economy', label: '💰 Currency & Economy' },
  { id: 'known-for', label: '⭐ What It’s Known For' },
  { id: 'geography', label: '🗺️ Geography' },
  { id: 'ecology-environment', label: '🌿 Ecology & Environment' },
  { id: 'people-culture', label: '🧑\u200d🤝\u200d🧑 People, Languages & Culture' },
  { id: 'history', label: '📜 History & Major Turning Points' },
  { id: 'government-society', label: '🏛️ Government & Political System' },
  { id: 'political-constitutional-changes', label: '🏛️ Political & Constitutional Changes' },
  { id: 'india-relations', label: '🇮🇳 Country & India' },
  { id: 'global-relations', label: '🤝 Global Relations' },
  { id: 'medical-scientific', label: '🧬 Science, Medicine & Technology' },
  { id: 'trade-economy', label: '📦 Trade & Major Exports' },
  { id: 'space-innovation', label: '🚀 Space, Innovation & Modern Development' },
  { id: 'sports-arts-recognition', label: '🏅 Sports, Arts & Global Recognition' },
  { id: 'international-organizations', label: '🌐 International Organizations & Memberships' },
  { id: 'current-affairs-connection', label: '📰 Current Affairs Connection' },
  { id: 'quick-revision', label: '⚡ Quick Revision' },
  { id: 'exam-focus', label: '🎯 Why It Matters for Exams' },
  { id: 'memory-hook', label: '🧠 Gen Z Memory Hook' }
]

export function getTopicCatalogEntry(topicId: string): TopicCatalogEntry | undefined {
  return TOPIC_CATALOG.find((t) => t.id === topicId)
}
