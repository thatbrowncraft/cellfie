/**
 * core/knowledge/rank — relevance scoring across all providers' merged
 * results (brief §23, second-pass audit §6, THIRD-PASS audit §1/§2/§3).
 *
 * THIRD-PASS FIX — the second pass's `isUsefulCandidate` treated
 * `subject`, `comparedAgainst`, and `aspect` as one flat bag of terms and
 * required only ANY single term to appear (substring, for
 * ABSTRACT/FULL_TEXT) or an exact word match (for METADATA_ONLY). Two
 * real problems with that for actual scientific literature:
 *
 *   1. It was simultaneously too loose and too strict. Too loose: a
 *      candidate with zero subject relevance could still pass just by
 *      matching an `aspect` word ("principle") or a `comparedAgainst`
 *      word — but subject relevance is supposed to be the dominant
 *      signal, not one term among equals. Too strict: `aspect` words are
 *      often abstract nouns ("principle", "interpretation") that a real,
 *      highly relevant paper legitimately never uses verbatim — a paper
 *      titled "Polymerase Chain Reaction: mechanism and applications" is
 *      exactly what someone searching "PCR — principle" wants, even
 *      though it never says "principle".
 *   2. METADATA_ONLY records used exact single-word equality
 *      (`title.split(...).some(w => terms.includes(w))`) instead of
 *      substring matching — a title containing "PCR-based diagnostics"
 *      wouldn't exact-match a bare "pcr" token search inconsistently
 *      with how ABSTRACT/FULL_TEXT records were checked.
 *
 * The fix: `subject` is now its own hard gate (substring match, checked
 * against title+abstract, or just title for METADATA_ONLY as a stronger
 * bar since there's no abstract to corroborate relevance). `aspect` and
 * `comparedAgainst` are demoted to ranking-only signals — they make an
 * already-subject-relevant candidate rank higher, but a candidate is
 * never accepted or rejected based on whether it happens to contain
 * those words. This is still a purely lexical, deterministic check — no
 * external AI/semantic-similarity service was added, per the brief's
 * explicit instruction to keep this lightweight.
 *
 * FOURTH-PASS FIX (final micro-fix before merge): `scoreOne`'s per-term
 * weights are now tiered (subject > comparedAgainst > aspect) instead of
 * flat, so the ranking math actually matches this file's own description
 * of subject as the dominant signal — see `scoreOne`'s own docstring
 * below for the exact weights. The usefulness gate (`isUsefulCandidate`)
 * is unchanged by this — it was already subject-only and never used
 * `termMatchScore`'s weights.
 */
import type { KnowledgeQueryContext, NormalizedKnowledgeResult } from './types'

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
}

function subjectTerms(context: KnowledgeQueryContext): string[] {
  return tokenize(context.subject)
}

function comparedTerms(context: KnowledgeQueryContext): string[] {
  return tokenize(context.comparedAgainst ?? '')
}

function aspectTerms(context: KnowledgeQueryContext): string[] {
  return tokenize(context.aspect ?? '')
}

/** All three buckets combined — used only for the overall relevance SCORE (ranking order), never for the usefulness gate below. */
export function queryTerms(context: KnowledgeQueryContext): string[] {
  return [...subjectTerms(context), ...comparedTerms(context), ...aspectTerms(context)]
}

function substringMatchScore(text: string, terms: string[], weight: number): number {
  let score = 0
  for (const term of terms) {
    if (text.includes(term)) score += weight
  }
  return score
}

/**
 * FOURTH-PASS FIX (final micro-fix before merge) — per-term weight is now
 * a parameter instead of a fixed 8/3, because `scoreOne` below applies a
 * different weight per bucket (subject/comparedAgainst/aspect). Nothing
 * else about the matching logic changed: still a plain title/abstract
 * substring check, same title-vs-abstract ratio (title always weighted
 * ~2.67x its bucket's abstract weight, matching the original 8:3 ratio).
 */
function termMatchScore(result: NormalizedKnowledgeResult, terms: string[], titleWeight: number, abstractWeight: number): number {
  const title = result.title.toLowerCase()
  const abstract = (result.abstract ?? '').toLowerCase()
  return substringMatchScore(title, terms, titleWeight) + substringMatchScore(abstract, terms, abstractWeight)
}

function contentQualityBonus(result: NormalizedKnowledgeResult): number {
  // Second-pass fix (brief §6/§11): weighted so that even a decent
  // multi-term title/abstract match on a METADATA_ONLY record does not
  // routinely outrank a genuinely on-topic ABSTRACT/FULL_TEXT record —
  // "metadata-only results should generally rank below useful
  // abstracts/full-text content for enrichment".
  if (result.contentAvailability === 'FULL_TEXT') return 10
  if (result.contentAvailability === 'ABSTRACT') return 7
  return 0
}

function recencyBonus(result: NormalizedKnowledgeResult): number {
  const year = Number.parseInt((result.publicationDate ?? '').slice(0, 4), 10)
  if (Number.isNaN(year) || year <= 1990) return 0
  return Math.min(6, (year - 1990) * 0.05)
}

/**
 * Combined ranking score. FOURTH-PASS FIX (final micro-fix before merge):
 * subject, comparedAgainst, and aspect used to share the same per-term
 * weight (8 title / 3 abstract each), which meant a candidate with many
 * aspect/comparedAgainst term hits could out-rank one with genuinely
 * stronger subject relevance — contradicting this file's own comments,
 * which already described subject as the dominant signal. Weights are
 * now tiered so the ranking math actually matches that description:
 *
 *   SUBJECT        — full weight (8 title / 3 abstract per term):
 *                    the strongest signal, by a clear margin.
 *   COMPARED_AGAINST — half weight (4 title / 1.5 abstract per term):
 *                    a secondary signal, reinforcing subject relevance
 *                    without competing with it.
 *   ASPECT         — quarter weight (2 title / 0.75 abstract per term):
 *                    a small ranking bonus only, exactly per brief
 *                    ("aspect improves ranking but is not always a hard
 *                    literal-match requirement") — never a gate (see
 *                    `isUsefulCandidate`, unchanged).
 *
 * `isUsefulCandidate` (the hard usefulness gate) is untouched by this —
 * it never called `termMatchScore` in the first place, it does its own
 * subject-only substring check directly.
 */
function scoreOne(result: NormalizedKnowledgeResult, context: KnowledgeQueryContext): number {
  const subjectScore = termMatchScore(result, subjectTerms(context), 8, 3)
  const comparedScore = termMatchScore(result, comparedTerms(context), 4, 1.5)
  const aspectScore = termMatchScore(result, aspectTerms(context), 2, 0.75)
  return subjectScore + comparedScore + aspectScore + contentQualityBonus(result) + recencyBonus(result)
}

export function rankResults(results: NormalizedKnowledgeResult[], context: KnowledgeQueryContext): NormalizedKnowledgeResult[] {
  return results
    .map((r) => ({ ...r, relevanceScore: scoreOne(r, context) }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * THIRD-PASS FIX (brief §1/§2/§3): the usefulness gate now checks ONLY
 * subject relevance — "subject relevance is the strongest requirement"
 * and the only hard requirement. `comparedAgainst`/`aspect` never gate a
 * candidate in or out; they only affect ranking order (`scoreOne` above).
 *
 * This is intentionally still a hard gate, not a suggestion (brief §3:
 * "do not lower the safety bar... a metadata-only result should still
 * require strong subject relevance... do not make every different
 * result count as useful"):
 *   - ABSTRACT/FULL_TEXT: subject term must appear in title OR abstract.
 *   - METADATA_ONLY/EXTERNAL_LINK: subject term must appear in the
 *     TITLE specifically — there's no abstract to corroborate relevance,
 *     so the bar for a thin record stays stricter, exactly preserving
 *     the second pass's intent while fixing its exact-word-equality bug
 *     (now substring matching, like every other check in this module).
 *
 * When `context.subject` is too short/generic to tokenize (e.g. "Rh"),
 * there is nothing meaningful to gate on, so every candidate passes —
 * unchanged from the second pass's behavior for that edge case.
 */
export function isUsefulCandidate(result: NormalizedKnowledgeResult, context: KnowledgeQueryContext): boolean {
  const terms = subjectTerms(context)
  if (terms.length === 0) return true

  const title = result.title.toLowerCase()
  if (result.contentAvailability === 'METADATA_ONLY' || result.contentAvailability === 'EXTERNAL_LINK') {
    return terms.some((t) => title.includes(t))
  }

  const abstract = (result.abstract ?? '').toLowerCase()
  return terms.some((t) => title.includes(t) || abstract.includes(t))
}
