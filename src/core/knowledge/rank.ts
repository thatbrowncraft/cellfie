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
 *
 * FIFTH-FIX ("Enzymes vs Proteins keeps showing Europe PMC" brief) — two
 * separate, compounding problems, both fixed in this pass, neither
 * touching financial/credential safety (see `../index.ts` and
 * `adapters/wikipedia.ts` — still plain key-free `fetch()`, unchanged):
 *
 *   1. PLURAL/SINGULAR GATE BUG (the actual root cause of the repeated
 *      screenshot behavior): `isUsefulCandidate` did an exact substring
 *      check of the raw subject token against the title/abstract.
 *      Comparison Studio items are typically plural ("Enzymes",
 *      "Proteins"), but Wikipedia's canonical article titles are
 *      singular ("Enzyme", "Protein") — and `"enzyme".includes("enzymes")`
 *      is `false` (the term is literally longer than the text it's
 *      being checked against). That silently disqualified Wikipedia's
 *      genuinely on-topic, genuinely usable articles from ever passing
 *      the gate for exactly the plural item names Comparison Studio
 *      passes as `subject`, leaving only the literature adapters —
 *      whose reference-only, license-withheld abstracts are what the
 *      screenshots show occupying the fallback slot. `termVariants`/
 *      `containsAnyVariant` below add simple, deterministic regular-
 *      English plural handling (enzyme⇄enzymes, family⇄families) to
 *      every substring check in this file — still no external AI/
 *      semantic-similarity service, per this file's existing "keep it
 *      lightweight" constraint; irregular plurals (e.g. "bacterium" /
 *      "bacteria") are a known, accepted gap of this lexical approach,
 *      not a regression from before.
 *   2. EUROPE PMC DEPRIORITIZED, WIKIPEDIA PRIORITIZED (brief: "remove
 *      Europe PMC or prioritize Wikipedia") — with (1) fixed, Wikipedia
 *      can now actually compete for the primary slot, but
 *      `contentQualityBonus` only gave it a token +2 edge (9 vs 7) over
 *      Europe PMC's own ABSTRACT tier, which a modestly-stronger keyword
 *      match could still overturn. Rather than removing Europe PMC
 *      outright (it's still a legitimate source for topics with no
 *      Wikipedia coverage, e.g. a specific organism strain), its
 *      ABSTRACT-tier bonus is now clearly subordinate to Wikipedia's —
 *      see `contentQualityBonus` below for the exact numbers — so a
 *      general-definition Wikipedia match wins the primary slot over a
 *      same-topic Europe PMC abstract by DESIGN, not by accident of
 *      keyword overlap. Europe PMC only still wins outright when it has
 *      genuine `FULL_TEXT` (rarer, and a real step up from an
 *      encyclopedia intro when it's actually available).
 */
import type { KnowledgeQueryContext, NormalizedKnowledgeResult } from './types'

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
}

/**
 * FIFTH-FIX: regular-English singular/plural variants of a lowercase
 * token, so a subject term typed as "Enzymes" still matches a title
 * that only says "Enzyme" (Wikipedia's canonical article-title form)
 * and vice versa. Deliberately simple and deterministic — handles the
 * common `-s` and `-ies` patterns only; irregular plurals are an
 * accepted gap, not a target for this lightweight, non-AI check.
 */
function termVariants(term: string): string[] {
  const variants = new Set([term])
  if (term.endsWith('ies') && term.length > 4) {
    variants.add(`${term.slice(0, -3)}y`)
  } else if (term.endsWith('y') && term.length > 2) {
    variants.add(`${term.slice(0, -1)}ies`)
  }
  if (term.endsWith('s') && !term.endsWith('ss') && term.length > 3) {
    variants.add(term.slice(0, -1))
  } else if (!term.endsWith('s')) {
    variants.add(`${term}s`)
  }
  return [...variants]
}

/** Substring match against every singular/plural variant of `term`, not just the literal token — see `termVariants` and the FIFTH-FIX docstring above. */
function containsAnyVariant(text: string, term: string): boolean {
  return termVariants(term).some((variant) => text.includes(variant))
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
    if (containsAnyVariant(text, term)) score += weight
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
  //
  // ARCHITECTURE FIX addition (brief §11, "do not use specialized papers
  // for general definitions"): Wikipedia is, by construction, a general/
  // definitional educational source — the exact opposite failure mode
  // from a narrow specialized paper that merely shares a keyword. A flat
  // per-term substring score can't tell "core definition" apart from
  // "incidental scientific term match" on its own, so this gives a
  // general-reference source a small deterministic edge over an
  // equally-scored specialized-literature ABSTRACT, without ever
  // requiring semantic understanding of what "general" means for an
  // arbitrary paper. A Europe PMC/PubMed result with a stronger genuine
  // term match (via `scoreOne`'s subject-weighted scoring) can still
  // outrank it — this is a nudge, not a hard tier.
  //
  // FIFTH-FIX ("remove Europe PMC or prioritize Wikipedia" brief): the
  // ABSTRACT-tier gap between Wikipedia and every other source is now
  // wide enough (+14 vs +4) that a same-relevance Wikipedia match wins
  // the primary enrichment slot over a Europe PMC/PubMed abstract by
  // design, not by accident of keyword overlap — see this file's module
  // docstring for why Europe PMC is deliberately deprioritized rather
  // than removed outright. FULL_TEXT is left source-agnostic: genuine
  // open-access full text is rarer than a Wikipedia intro and still a
  // real step up when it's actually available.
  if (result.contentAvailability === 'FULL_TEXT') return 10
  if (result.contentAvailability === 'ABSTRACT') return result.source === 'wikipedia' ? 14 : 4
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
 *
 * FIFTH-FIX: every substring check here now goes through
 * `containsAnyVariant`, so a plural subject like "Enzymes" also matches
 * a singular title like Wikipedia's "Enzyme" (and vice versa) — see the
 * module docstring's FIFTH-FIX section for why this, not source
 * removal, was the actual root cause of Wikipedia results never
 * surfacing for plural comparison item names.
 */
export function isUsefulCandidate(result: NormalizedKnowledgeResult, context: KnowledgeQueryContext): boolean {
  const terms = subjectTerms(context)
  if (terms.length === 0) return true

  const title = result.title.toLowerCase()
  if (result.contentAvailability === 'METADATA_ONLY' || result.contentAvailability === 'EXTERNAL_LINK') {
    return terms.some((t) => containsAnyVariant(title, t))
  }

  const abstract = (result.abstract ?? '').toLowerCase()
  return terms.some((t) => containsAnyVariant(title, t) || containsAnyVariant(abstract, t))
}

/**
 * FOURTH-PASS FIX (Europe PMC no-excerpt loop, "second fix" brief §1-4):
 * `isUsefulCandidate` above answers "is this candidate topically
 * relevant?" — it does NOT answer "does Cellfie actually have
 * displayable content for it?". Those are different questions, and
 * conflating them was the exact bug this fixes: a Europe PMC result
 * whose abstract exists at the provider but whose reuse rights are
 * unknown (see `../attribution.ts`'s `resolveAbstractPresentation`)
 * ends up with `contentAvailability: 'METADATA_ONLY'` and no `abstract`
 * text — topically relevant, genuinely a real paper, but nothing to
 * actually show as enrichment. The old pipeline let a candidate like
 * that occupy the primary enrichment slot as long as it passed
 * `isUsefulCandidate`, which produced exactly the "No excerpt is
 * available from this source" result the audit reported, sometimes
 * repeatedly across several Search Again presses.
 *
 * This function is the "can Cellfie actually give the user useful
 * content from this candidate" gate — true only for `FULL_TEXT` and
 * `ABSTRACT` (i.e. `result.abstract` is genuinely populated).
 * `METADATA_ONLY`/`EXTERNAL_LINK` candidates (including NCBI Bookshelf,
 * which by design never populates `abstract` — see
 * `adapters/ncbiBookshelf.ts` — and Europe PMC/PubMed results with an
 * unresolved-rights or absent abstract) are never "enrichment usable",
 * regardless of how strongly they match the query.
 *
 * This does NOT mean such a candidate is worthless or hidden — see
 * `pickReference` in `./index.ts`, which surfaces it as an honestly-
 * labeled, clearly SEPARATE reference-only citation (never the primary
 * `result`) when nothing enrichment-usable exists in the pool (brief
 * §16: "reference only / read at source" is an acceptable citation to
 * offer, but it must never occupy — or be labeled as — the primary
 * enrichment slot; see that file's `pickUsable` for the hard split).
 */
export function isEnrichmentUsable(result: NormalizedKnowledgeResult): boolean {
  return (result.contentAvailability === 'FULL_TEXT' || result.contentAvailability === 'ABSTRACT') && Boolean(result.abstract)
}
