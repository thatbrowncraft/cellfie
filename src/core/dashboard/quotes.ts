/**
 * core/dashboard/quotes — Dashboard motivational line.
 *
 * Replaces the old static "N-day reading streak — keep it going." line
 * under the Dashboard's title with a short, warm, slightly nerdy
 * microbiology-study quote that changes on every visit/reload. Purely a
 * small local curated array — no external API, no persistence beyond
 * "what was shown last" (kept client-side only, via
 * shared/hooks/useLocalStorage, so a reload doesn't repeat the same
 * line twice in a row).
 */

export const DASHBOARD_QUOTES: string[] = [
  'Every organism you understand is one mystery less.',
  'Small cells. Huge stories.',
  'Read the page. Understand the organism. Own the concept.',
  'One more concept today. Future-you will be annoyingly grateful.',
  "Somewhere, a bacterium is dividing every 20 minutes. You can highlight one paragraph.",
  "Gram stains don't lie. Neither does consistent revision.",
  "You're not behind. You're mid-culture — give it time to grow.",
  'The syllabus is long. So was evolution. Keep going.',
  'A well-labeled diagram today saves a panicked 2am tomorrow.',
  'Microbes have no ego. Neither should your study streak.',
  "Today's flashcard is tomorrow's automatic answer.",
  'Understand one pathway properly and three more start making sense.',
  "You don't need motivation. You need five more minutes with this page.",
  'Future clinician, current page-turner. Both count.'
]

/**
 * Picks a quote, avoiding an immediate repeat of `previousQuote` when
 * there's more than one quote to choose from. Pure function — the
 * caller owns persisting "previousQuote" (see DashboardPage.tsx).
 */
export function pickDashboardQuote(previousQuote?: string): string {
  if (DASHBOARD_QUOTES.length <= 1) return DASHBOARD_QUOTES[0] ?? ''
  const choices = DASHBOARD_QUOTES.filter((q) => q !== previousQuote)
  const pool = choices.length > 0 ? choices : DASHBOARD_QUOTES
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]
}
