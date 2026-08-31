interface ReferenceOnlyLinkProps {
  reference: { title: string; sourceName: string; sourceUrl: string }
}

/**
 * ARCHITECTURE FIX (knowledge-source repair brief §16/§17): renders the
 * optional `reference` a Knowledge Layer lookup can attach to an
 * otherwise-empty ('not-found'/'exhausted') result — a title, its
 * source, and a link to read it there. Deliberately renders NOTHING
 * else: no excerpt, no abstract, no body text, because there isn't any
 * — that's exactly why this is a reference and not a `result`
 * (see `core/knowledge/types.ts`'s `KnowledgeSearchResult.reference`).
 * Never style or word this to look like a found excerpt; it's a
 * "read this yourself" pointer, offered honestly alongside an empty
 * state rather than instead of one.
 */
export function ReferenceOnlyLink({ reference }: ReferenceOnlyLinkProps) {
  return (
    <a
      href={reference.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-block font-ui text-caption text-olive hover:underline"
    >
      Read “{reference.title}” at {reference.sourceName}
    </a>
  )
}
