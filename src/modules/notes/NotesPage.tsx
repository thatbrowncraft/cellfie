import { NotePencil } from '@phosphor-icons/react'
import { DashboardLayout } from '../../shared/layouts'
import { EmptyState, Button } from '../../shared/components'

/**
 * Notes — rich text, images, handwritten attachments, source citations,
 * version history, internal links (SDD §2). No editor or data model in
 * this foundation task — Quick Capture FAB is the intended entry point,
 * previewed in the app shell.
 */
export function NotesPage() {
  return (
    <DashboardLayout title="Notes" subtitle="Everything you write stays linked back to where you learned it.">
      <div className="col-span-full rounded-md border border-border bg-surface p-6">
        <EmptyState
          icon={<NotePencil size={32} />}
          title="No notes yet"
          description="Use Quick Capture (bottom right, or press N) to jot your first note. It'll keep its full version history automatically."
          action={<Button variant="secondary">Write a note</Button>}
        />
      </div>
    </DashboardLayout>
  )
}
