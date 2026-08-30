/**
 * core/knowledge/attribution — NCBI/PubMed attribution and
 * license-aware Europe PMC/Crossref abstract handling.
 *
 * FINAL COMPLIANCE CORRECTION: the previous pass truncated every
 * third-party abstract to ~280 characters and treated that as if it
 * were a legal "safe" length. It is not, and no such general rule
 * exists. Fair use (where it applies at all) is a fact-specific,
 * case-by-case legal test this app does not and cannot evaluate,
 * and none of the providers this app calls say that short excerpts
 * are automatically reusable:
 *
 *   - Europe PMC: content is supplied by publishers/authors; reuse
 *     rights over that content remain with whoever holds them.
 *   - Crossref: most *metadata* is reusable, but a deposited abstract
 *     may still be copyrighted by its publisher/author.
 *   - NCBI/PubMed: abstracts may be copyrighted by publishers/authors;
 *     NLM does not provide legal advice about redistributing them.
 *
 * So this module no longer treats "short" as "safe". Metadata (title,
 * authors, journal, date, DOI/PMID/PMCID, license link, source URL) is
 * factual and stays freely usable — that part is untouched. Abstract
 * TEXT is only ever shown when the provider itself told us the item
 * carries a license this app recognizes as clearly permitting reuse
 * (see `assessLicense`). When no such license is present, or it's one
 * this app doesn't recognize, the abstract text is withheld entirely —
 * metadata and a source link are still shown, plus a plain notice that
 * the full abstract is available at the source rather than reproduced
 * here. Nothing here invents a license or infers one from a provider
 * name or from excerpt length.
 *
 * When a recognized permissive license IS present, this module still
 * keeps the displayed excerpt short (`MAX_ABSTRACT_EXCERPT_CHARS`) —
 * that cap is a conservative, non-displacive UX choice at that point
 * (the person can already legally see more at the source), not a
 * separate legal boundary in its own right.
 */

/**
 * User-visible NCBI attribution. Shown wherever a PubMed-sourced result
 * is displayed. Deliberately plain and factual — no claim of NCBI/NLM
 * endorsement or certification, and no implication that PubMed
 * abstracts are public domain (this adapter doesn't display PubMed
 * abstract text at all; this notice covers the metadata it does show).
 */
export const NCBI_ATTRIBUTION_NOTICE =
  'Sourced from PubMed®, a database of the U.S. National Library of Medicine (NLM). Cellfie is not endorsed or certified by NLM/NCBI. PubMed abstracts may be copyrighted by their publishers or authors — NLM does not provide legal advice about redistributing them.'

/**
 * Shown under a Europe PMC/Crossref abstract excerpt that IS being
 * displayed, because the provider reported a license this app
 * recognizes as clearly permitting reuse. Says so explicitly, and
 * still points back to the source rather than implying this excerpt
 * is the complete, canonical abstract.
 */
export const LICENSED_ABSTRACT_NOTICE =
  "Short excerpt shown under the open license the source reported for this item — this is a shortened excerpt for reference, not the complete abstract. See the source for the full abstract and its exact license terms."

/**
 * Shown in place of abstract text whenever a provider has an abstract
 * but its reuse rights are unknown, restricted, or simply not stated
 * in a way this app recognizes. Deliberately does not reproduce any of
 * the underlying text — this is the "don't guess" path.
 */
export const ABSTRACT_LICENSE_UNKNOWN_NOTICE =
  "This source's abstract isn't reproduced here because its reuse rights aren't established from what the provider returned — Cellfie shows publication details and a link instead. The full abstract is available at the source."

/**
 * Ceiling on how much of an ALREADY-LICENSED-PERMISSIVE abstract this
 * app ever displays or stores, in characters. This is a conservative,
 * non-displacive UX choice once reuse is already established — NOT a
 * copyright "safe harbor" and not applied as a substitute for checking
 * the license in the first place (see `resolveAbstractPresentation`,
 * which is the only place that decides whether to show text at all).
 */
const MAX_ABSTRACT_EXCERPT_CHARS = 280

/**
 * Truncates text to a short, non-displacive excerpt. Cuts at the
 * nearest word boundary at or before the limit rather than mid-word,
 * and appends an ellipsis so it's visually obvious this is a partial
 * excerpt. Text at or under the limit is returned unchanged. Never
 * throws. This function makes no license determination of its own —
 * callers must already know the text is safe to show before calling
 * it (see `resolveAbstractPresentation`).
 */
export function conservativeAbstractExcerpt(text: string | undefined, maxChars: number = MAX_ABSTRACT_EXCERPT_CHARS): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  const slice = trimmed.slice(0, maxChars)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${cut.trim()}…`
}

export type LicenseAssessment = 'permissive' | 'unknown'

/**
 * Classifies a provider-reported license string (a bare code like
 * "cc by", or a full URL like Crossref's
 * "https://creativecommons.org/licenses/by/4.0/") as either clearly
 * permitting reuse of the underlying text, or not.
 *
 * Deliberately narrow and fails CLOSED, not open: only public domain /
 * CC0 and CC-BY / CC-BY-SA are treated as 'permissive'. CC-BY-NC and
 * CC-BY-ND are intentionally EXCLUDED — they restrict commercial use or
 * derivative works respectively, and this app has no way to evaluate
 * either restriction against a specific downstream use, so it doesn't
 * try. Any license string this function doesn't recognize, any
 * unfamiliar/unlisted license, and no license info at all all return
 * 'unknown' — never assumed permissive by default, and never inferred
 * from the provider's name or from how short the text happens to be.
 */
export function assessLicense(license: string | undefined): LicenseAssessment {
  if (!license) return 'unknown'
  const raw = license.toLowerCase().trim()
  if (!raw) return 'unknown'

  // Public domain / CC0, either as a CC0 deed URL or a bare code.
  if (/creativecommons\.org\/publicdomain\/zero/.test(raw)) return 'permissive'
  if (/(^|[^a-z0-9])cc0([^a-z0-9]|$)/.test(raw)) return 'permissive'
  if (/public\s?domain/.test(raw)) return 'permissive'

  // CC-BY or CC-BY-SA as a full creativecommons.org license URL. The
  // path segment is matched exactly so "by-nc" or "by-nd" URLs (which
  // contain "by" but are NOT this license) never match.
  if (/creativecommons\.org\/licenses\/by\//.test(raw)) return 'permissive'
  if (/creativecommons\.org\/licenses\/by-sa\//.test(raw)) return 'permissive'

  // CC-BY or CC-BY-SA as a bare code (e.g. "cc by", "cc-by", "ccby",
  // "cc by-sa"). Normalize whitespace to hyphens first, then require an
  // exact match so "cc-by-nc" / "cc-by-nd" do not match either pattern.
  const normalized = raw.replace(/\s+/g, '-')
  if (/^cc-?by$/.test(normalized)) return 'permissive'
  if (/^cc-?by-sa$/.test(normalized)) return 'permissive'

  return 'unknown'
}

export interface AbstractPresentation {
  /** Displayable excerpt text, or `undefined` when reuse terms aren't established and Cellfie doesn't reproduce the source's text at all. */
  text?: string
  /** The notice to show alongside this result — set whenever the provider had ANY abstract, whether shown or withheld, so the person always knows what happened and why. `undefined` only when the provider had no abstract at all. */
  notice?: string
}

/**
 * The one place that decides whether a third-party abstract is ever
 * displayed. Given the raw abstract text a provider returned and
 * whatever license info that same provider reported for the item,
 * this either:
 *
 *   - returns a short, license-covered excerpt plus a notice saying so
 *     (only when `assessLicense` recognizes the license), or
 *   - returns no text at all, plus a notice saying the abstract exists
 *     at the source but isn't reproduced here because its reuse rights
 *     aren't established.
 *
 * Never invents a license, never infers reusability from the
 * provider's name, and never treats a short excerpt as inherently
 * safer than a long one.
 */
export function resolveAbstractPresentation(rawAbstract: string | undefined, license: string | undefined): AbstractPresentation {
  if (!rawAbstract) return {}
  if (assessLicense(license) === 'permissive') {
    return { text: conservativeAbstractExcerpt(rawAbstract), notice: LICENSED_ABSTRACT_NOTICE }
  }
  return { text: undefined, notice: ABSTRACT_LICENSE_UNKNOWN_NOTICE }
}
