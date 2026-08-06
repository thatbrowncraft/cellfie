import { useState, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { cn } from '../utils/cn'

export interface AccordionItem {
  id: string
  title: string
  content: ReactNode
}

interface AccordionProps {
  items: AccordionItem[]
  defaultOpenId?: string
  allowMultiple?: boolean
  className?: string
}

/**
 * Accordion — Design System §10.9. Used for Laboratory protocols, Common
 * Confusions, Settings groups. No card wrapper — just header rows with
 * dividers.
 */
export function Accordion({ items, defaultOpenId, allowMultiple = false, className }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpenId ? [defaultOpenId] : []))

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = allowMultiple ? new Set(prev) : new Set<string>()
      if (prev.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={cn('divide-y divide-border border-y border-border', className)}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id)
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center justify-between py-3 text-left font-ui text-ui font-medium text-ink-primary hover:text-ink-secondary"
            >
              {item.title}
              <CaretDown
                size={16}
                className={cn('shrink-0 transition-transform duration-micro ease-standard', isOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
            {isOpen && (
              <div id={`accordion-panel-${item.id}`} className="pb-4 font-body text-body text-ink-secondary">
                {item.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
