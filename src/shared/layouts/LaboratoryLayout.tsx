import { useState, type ReactNode } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'

interface LaboratoryLayoutProps {
  title: string
  sidebar: ReactNode
  children: ReactNode
}

/**
 * Laboratory Layout — a persistent left index (protocols/equipment list)
 * beside the active content, matching the "unified section" design of the
 * Laboratory module (SDD §2).
 *
 * The section list collapses behind the "Sections" heading — tap it to
 * hide/show the list. Starts expanded (unchanged default behavior); the
 * collapse is local UI state only, not persisted, so every page load
 * starts open.
 */
export function LaboratoryLayout({ title, sidebar, children }: LaboratoryLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:px-8">
      <aside className="shrink-0 md:w-64">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="mb-3 flex w-full items-center justify-between gap-2 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary"
        >
          <span>{title}</span>
          {collapsed ? <CaretDown size={14} aria-hidden /> : <CaretUp size={14} aria-hidden />}
        </button>
        {!collapsed && <nav className="flex flex-col gap-1">{sidebar}</nav>}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
