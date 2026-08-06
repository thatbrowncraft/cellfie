interface SourceCitationProps {
  index: number
  sourceLabel: string
  onClick?: () => void
}

/**
 * Source Citation — Design System §10.17.
 * Inline superscript tag in font-mono, e.g. [¹]. Clicking opens the PDF
 * Reader at that page (wired up once the Library/PDF Reader modules exist —
 * this foundation only renders the affordance).
 */
export function SourceCitation({ index, sourceLabel, onClick }: SourceCitationProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Source: ${sourceLabel}`}
      className="font-mono text-caption text-ink-secondary align-super hover:text-olive hover:underline underline-offset-2"
    >
      [{toSuperscriptDigits(index)}]
    </button>
  )
}

const superscriptMap: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹'
}

function toSuperscriptDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => superscriptMap[d] ?? d)
    .join('')
}
