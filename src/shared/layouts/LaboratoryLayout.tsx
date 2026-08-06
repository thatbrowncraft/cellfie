import type { ReactNode } from 'react'

interface LaboratoryLayoutProps {
  title: string
  sidebar: ReactNode
  children: ReactNode
}

/**
 * Laboratory Layout — a persistent left index (protocols/equipment list)
 * beside the active content, matching the "unified section" design of the
 * Laboratory module (SDD §2).
 */
export function LaboratoryLayout({ title, sidebar, children }: LaboratoryLayoutProps) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:px-8">
      <aside className="shrink-0 md:w-64">
        <h2 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{title}</h2>
        <nav className="flex flex-col gap-1">{sidebar}</nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
