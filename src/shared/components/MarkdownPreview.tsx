import { Fragment } from 'react'
import { cn } from '../utils/cn'

interface MarkdownPreviewProps {
  markdown: string
  className?: string
}

/**
 * A deliberately small Markdown renderer — headings, bold/italic, inline
 * code, links, blockquotes, and (un)ordered lists. Covers Sprint 2 §3's
 * "Title / Markdown / Images (future ready) / Tags" note body without
 * adding a markdown-parser dependency, per "no npm packages unless
 * absolutely essential." Not a CommonMark implementation — good enough
 * for study notes, not arbitrary markdown documents.
 */
export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  const blocks = parseBlocks(markdown)
  return (
    <div className={cn('flex flex-col gap-3 font-body text-body text-ink-primary', className)}>
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  )
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'paragraph'; text: string }

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
      i += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') })
      continue
    }

    const isBullet = /^[-*]\s+/.test(line)
    const isOrdered = /^\d+\.\s+/.test(line)
    if (isBullet || isOrdered) {
      const items: string[] = []
      const ordered = isOrdered
      while (i < lines.length && (ordered ? /^\d+\.\s+/.test(lines[i]) : /^[-*]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      paraLines.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'paragraph', text: paraLines.join(' ') })
  }

  return blocks
}

/** Bold, italic, inline code, and links within a single line of text. */
function renderInline(text: string, keyPrefix: string) {
  const parts: (string | JSX.Element)[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const token = match[0]
    key += 1
    if (token.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-${key}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      parts.push(<em key={`${keyPrefix}-${key}`}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={`${keyPrefix}-${key}`} className="rounded-sm bg-surface-raised px-1.5 py-0.5 font-mono text-caption">
          {token.slice(1, -1)}
        </code>
      )
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        parts.push(
          <a
            key={`${keyPrefix}-${key}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-olive underline underline-offset-4"
          >
            {linkMatch[1]}
          </a>
        )
      }
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function renderBlock(block: Block) {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${block.level + 1}`) as 'h2' | 'h3' | 'h4'
      const sizeClass = block.level === 1 ? 'text-h3' : block.level === 2 ? 'text-h3' : 'text-ui'
      return <Tag className={cn('font-display font-medium text-ink-primary', sizeClass)}>{renderInline(block.text, 'h')}</Tag>
    }
    case 'quote':
      return (
        <blockquote className="rounded-sm border-l-4 border-terracotta bg-surface-raised px-4 py-2 font-body italic text-ink-secondary">
          {renderInline(block.text, 'q')}
        </blockquote>
      )
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag className={cn('ml-5', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, `li-${i}`)}</li>
          ))}
        </Tag>
      )
    }
    case 'paragraph':
    default:
      return <p>{renderInline(block.text, 'p')}</p>
  }
}
