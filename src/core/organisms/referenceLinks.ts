/**
 * core/organisms/referenceLinks — Knowledge Layer + Source Library
 * brief, Phase 3 ("expand scientific source support").
 *
 * CDC, WHO, ASM, ICTV, and LPSN do not publish a public, key-free,
 * CORS-enabled JSON API this client-side PWA can call the way NCBI's
 * eutils endpoints already are — and several of these sites' terms of
 * use don't permit automated scraping/redistribution of their page
 * content in any case. Rather than either (a) silently drop these
 * sources from the brief's priority list, or (b) fetch/scrape their
 * HTML and repackage it as if it were retrieved content, this module
 * does neither: it deterministically builds a direct link to that
 * authority's own official search page for the exact query, and the
 * result is always labeled as an outbound lookup — never as an excerpt,
 * never counted in `sources` (which implies content was actually
 * retrieved and normalized).
 *
 * Picking WHICH authorities to link for a given query follows the
 * brief's own §Phase 3 table (bacterial taxonomy → LPSN, viral
 * taxonomy → ICTV, parasitology → CDC DPDx, etc.) using the same
 * best-effort category guess `knowledgeLayer.ts` already computes —
 * never a network call, so this is safe to run in every source mode
 * without violating "no silent source supplementation" (§Phase 4-6):
 * it only ever appears on 'trusted'-mode profiles, alongside sources
 * that WERE actually retrieved, never on a 'my-sources'/
 * 'specific-source' profile.
 */
import type { OrganismCategory, ReferenceLink } from './types'

export function buildReferenceLinks(query: string, category: OrganismCategory | undefined): ReferenceLink[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const q = encodeURIComponent(trimmed)

  const links: ReferenceLink[] = [
    { name: 'NCBI (all databases)', url: `https://www.ncbi.nlm.nih.gov/search/all/?term=${q}` },
    { name: 'CDC', url: `https://search.cdc.gov/search/?query=${q}` },
    { name: 'WHO', url: `https://www.who.int/home/search?indexCatalogue=genericsearchindex1&searchQuery=${q}` }
  ]

  if (category === 'bacteria') {
    // LPSN — the standard nomenclatural authority for bacterial/archaeal names.
    links.push({ name: 'LPSN (List of Prokaryotic names with Standing in Nomenclature)', url: `https://lpsn.dsmz.de/search?word=${q}` })
    links.push({ name: 'American Society for Microbiology (ASM)', url: `https://asm.org/search?q=${q}` })
  }

  if (category === 'fungi') {
    links.push({ name: 'CDC — Fungal Diseases', url: `https://search.cdc.gov/search/?affiliate=cdc-fungal&query=${q}` })
  }

  if (category === 'protozoa') {
    // CDC DPDx — the authoritative US reference for parasite diagnosis/identification.
    links.push({ name: 'CDC DPDx (Parasitology Diagnostic Assistance)', url: `https://www.cdc.gov/dpdx/az.html` })
  }

  if (category === 'virus') {
    // ICTV — the body that governs official virus taxonomy/nomenclature.
    links.push({ name: 'ICTV (International Committee on Taxonomy of Viruses)', url: `https://ictv.global/search?text=${q}` })
  }

  return links
}
