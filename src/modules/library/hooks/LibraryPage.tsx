import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, MagnifyingGlass } from '@phosphor-icons/react'
import { DashboardLayout } from '@/shared/layouts'
import { Button, SearchField, Dropdown, EmptyState } from '@/shared/components'
import { db, documentTypeLabels, type Collection, type DocumentType, type LibraryItem } from '@/core/db'
import { useLiveQuery } from '@/core/db/useLiveQuery'

import { LibraryItemCard } from './components/LibraryItemCard'
import { ImportDialog } from './components/ImportDialog'
import { EditMetadataDialog } from './components/EditMetadataDialog'
import { RemoveConfirmDialog } from './components/RemoveConfirmDialog'
import { CollectionsShelf } from './components/CollectionsShelf'
import { NewCollectionDialog } from './components/NewCollectionDialog'

type SortOrder = 'recent' | 'title' | 'author'

const sortOptions: { value: SortOrder; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'author', label: 'Author (A–Z)' }
]

const typeFilterOptions = [
  { value: 'all', label: 'All types' },
  ...(Object.entries(documentTypeLabels) as [DocumentType, string][]).map(([value, label]) => ({ value, label }))
]

/**
 * Library — import, organize, view metadata, remove (SDD §2). Search
 * across content, AI, and content generation are explicitly out of scope
 * here (Knowledge Engine Spec §0/§19's Phase 5); items land with
 * `indexingStatus: 'queued'` so a future indexing engine has a clean
 * on-ramp without a schema migration.
 */
export function LibraryPage() {
  const navigate = useNavigate()
  const items = useLiveQuery<LibraryItem[]>(() => db.libraryItems.orderBy('createdAt').reverse().toArray(), [], [])
  const collections = useLiveQuery<Collection[]>(() => db.collections.orderBy('createdAt').toArray(), [], [])

  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [newCollectionOpen, setNewCollectionOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null)
  const [removingItem, setRemovingItem] = useState<LibraryItem | null>(null)

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      for (const id of item.collectionIds) {
        counts[id] = (counts[id] ?? 0) + 1
      }
    }
    return counts
  }, [items])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    let result = items.filter((item) => {
      if (activeCollectionId && !item.collectionIds.includes(activeCollectionId)) return false
      if (typeFilter !== 'all' && item.documentType !== typeFilter) return false
      if (!query) return true
      return (
        item.title.toLowerCase().includes(query) ||
        (item.author?.toLowerCase().includes(query) ?? false) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })

    result = [...result].sort((a, b) => {
      if (sortOrder === 'title') return a.title.localeCompare(b.title)
      if (sortOrder === 'author') return (a.author ?? '').localeCompare(b.author ?? '')
      return b.createdAt - a.createdAt
    })

    return result
  }, [items, searchQuery, typeFilter, activeCollectionId, sortOrder])

  function handleOpen(item: LibraryItem) {
    navigate(`/library/${item.id}/read`)
  }

  const isLibraryEmpty = items.length === 0
  const isFilterEmpty = !isLibraryEmpty && filteredItems.length === 0

  return (
    <DashboardLayout
      title="Library"
      subtitle="Everything you've imported, organized and fully searchable — offline."
    >
      <div className="col-span-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          placeholder="Search your library…"
          onChange={setSearchQuery}
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Dropdown
            label="Sort"
            options={sortOptions}
            value={sortOrder}
            onChange={(v) => setSortOrder(v as SortOrder)}
            className="w-44"
          />
          <Dropdown
            label="Type"
            options={typeFilterOptions}
            value={typeFilter}
            onChange={setTypeFilter}
            className="w-44"
          />
          <Button size="small" onClick={() => setImportOpen(true)}>
            Import files
          </Button>
        </div>
      </div>

      {!isLibraryEmpty && (
        <div className="col-span-full">
          <CollectionsShelf
            collections={collections}
            itemCounts={itemCounts}
            activeCollectionId={activeCollectionId}
            onSelect={setActiveCollectionId}
            onCreateNew={() => setNewCollectionOpen(true)}
          />
        </div>
      )}

      {isLibraryEmpty && (
        <div className="col-span-full rounded-md border border-border bg-surface p-6">
          <EmptyState
            icon={<BookOpen size={32} />}
            title="Your library is empty"
            description="Import a PDF to get started. Everything stays on this device."
            action={<Button variant="secondary" onClick={() => setImportOpen(true)}>Import your first file</Button>}
          />
        </div>
      )}

      {isFilterEmpty && (
        <div className="col-span-full rounded-md border border-border bg-surface p-6">
          <EmptyState
            icon={<MagnifyingGlass size={32} />}
            title="Nothing matches"
            description="Try a different search term, or clear the type/collection filters."
          />
        </div>
      )}

      {filteredItems.map((item) => (
        <LibraryItemCard
          key={item.id}
          item={item}
          onEdit={() => setEditingItem(item)}
          onManageCollections={() => setEditingItem(item)}
          onOpen={() => handleOpen(item)}
          onRemove={() => setRemovingItem(item)}
        />
      ))}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <NewCollectionDialog open={newCollectionOpen} onClose={() => setNewCollectionOpen(false)} />
      <EditMetadataDialog item={editingItem} collections={collections} onClose={() => setEditingItem(null)} />
      <RemoveConfirmDialog item={removingItem} onClose={() => setRemovingItem(null)} />
    </DashboardLayout>
  )
}
