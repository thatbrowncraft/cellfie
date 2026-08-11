import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface TabItem {
  id: string
  label: string
  disabled?: boolean
  content: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  defaultTabId?: string
  className?: string
  /** Controlled mode (e.g. syncing with a URL search param) — when provided together
   *  with `onChange`, Tabs stops managing its own active-tab state internally. */
  activeId?: string
  onChange?: (id: string) => void
}

/**
 * Tabs — Design System §10.8. Underline style, terracotta active indicator.
 * Full role="tablist"/"tab"/"tabpanel" semantics with arrow-key navigation.
 * Uncontrolled by default; pass `activeId`/`onChange` to control it externally.
 */
export function Tabs({ tabs, defaultTabId, className, activeId: controlledActiveId, onChange }: TabsProps) {
  const enabledTabs = tabs.filter((t) => !t.disabled)
  const isControlled = controlledActiveId !== undefined && onChange !== undefined
  const [uncontrolledActiveId, setUncontrolledActiveId] = useState(defaultTabId ?? enabledTabs[0]?.id)
  const activeId = isControlled ? controlledActiveId : uncontrolledActiveId
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function setActiveId(id: string) {
    if (isControlled) {
      onChange(id)
    } else {
      setUncontrolledActiveId(id)
    }
  }

  function focusTab(id: string) {
    setActiveId(id)
    tabRefs.current[id]?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = enabledTabs[(index + 1) % enabledTabs.length]
      focusTab(next.id)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = enabledTabs[(index - 1 + enabledTabs.length) % enabledTabs.length]
      focusTab(prev.id)
    }
  }

  const activeTab = tabs.find((t) => t.id === activeId)

  return (
    <div className={className}>
     <div
  role="tablist"
  aria-label="Sections"
  className="flex w-full min-w-0 border-b border-border"
>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          const enabledIndex = enabledTabs.findIndex((t) => t.id === tab.id)
          return (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[tab.id] = el)}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              onClick={() => !tab.disabled && setActiveId(tab.id)}
              onKeyDown={(e) => !tab.disabled && handleKeyDown(e, enabledIndex)}
              className={cn(
                'relative min-w-0 flex-1 px-1 py-3 text-center font-ui text-ui font-medium leading-tight transition-colors duration-micro',
                tab.disabled
                  ? 'text-ink-tertiary cursor-not-allowed'
                  : isActive
                    ? 'text-ink-primary'
                    : 'text-ink-secondary hover:text-ink-primary'
              )}
            >
              {tab.label}
              {tab.disabled && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-ink-tertiary align-middle" aria-hidden />}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-terracotta" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      {activeTab && (
        <div role="tabpanel" id={`tabpanel-${activeTab.id}`} aria-labelledby={`tab-${activeTab.id}`} className="py-6">
          {activeTab.content}
        </div>
      )}
    </div>
  )
}
