/**
 * Subjects Registry — SDD §5, §23.
 * "Subjects are data, not code." Every subject Cellfie knows about is
 * declared here, not hardcoded into module components. Modules read from
 * this registry to build subject filters, navigation, and grouping.
 *
 * This is a structural placeholder for Task 3 — no subjects are seeded,
 * since seeding real subject content is outside the design-foundation
 * scope. The shape below is what Phase 1 modules will read from.
 */

export interface Subject {
  id: string
  name: string
  /** A Phosphor icon name (resolved by the consuming component), kept as
   *  a string here so this file stays free of UI-library imports. */
  icon?: string
  /** One of the three accent hues, per Design System §2.3 usage rules. */
  accent?: 'olive' | 'sage' | 'terracotta'
}

export const subjects: Subject[] = []

export function getSubjectById(id: string): Subject | undefined {
  return subjects.find((s) => s.id === id)
}
