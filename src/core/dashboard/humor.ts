/**
 * core/dashboard/humor — subtle Gen Z humor micro-lines, Dashboard ONLY.
 *
 * These are deliberately imported and rendered only from
 * modules/dashboard/DashboardPage.tsx. Library, Concepts, Organisms,
 * Notes, Comparison Studio, and the PDF Reader keep their existing,
 * unmodified copy — nothing here is wired into those pages.
 *
 * Laboratory has its own dedicated, bespoke set of one-liners instead of
 * reusing these — see `core/laboratory/microcopy.ts`. Keep the two
 * separate: Laboratory's copy is written to land specific scientific
 * jokes about *that* protocol/media/test/equipment/formula, which a
 * shared generic map couldn't do per-item.
 */
export const DASHBOARD_HUMOR = {
  books: 'Your academic emotional support pile.',
  bookmarks: 'Things your brain said: remember this.',
  notes: "Because apparently remembering wasn't enough.",
  highlights: 'Yellow means this is definitely on the exam.',
  reading: 'Character development, but make it academic.',
  concepts: 'Things you now know and can casually flex.',
  organisms: 'Tiny organisms. Massive syllabus energy.',
  lab: 'Because vibes are not a valid lab method.',
  comparisons: 'Let the microbes fight. You decide the winner.'
} as const
