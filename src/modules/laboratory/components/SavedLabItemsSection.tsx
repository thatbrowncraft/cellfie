import { useNavigate } from 'react-router-dom'
import { BookmarkSimple, Books, Globe, Trash } from '@phosphor-icons/react'
import { Button, Card, CardBody, EmptyState, Micro } from '../../../shared/components'
import { CATEGORY_LABELS } from '../../../core/laboratory/registry'
import type { LaboratoryCategory } from '../../../core/laboratory/types'
import { removeSavedLabItem } from '../../../core/laboratory/savedItems'
import type { SavedLabItemRecord } from '../../../core/db'

/**
 * Laboratory Saved Items — brief: "a dedicated Saved Lab Items section
 * within the Laboratory navigation... Dashboard = recent activity only."
 *
 * Renders every row in `savedLabItems`, grouped by the three Knowledge
 * Layer source types so a Cellfie curated save, a My Library excerpt,
 * and an Online Knowledge excerpt are never visually or semantically
 * merged into one undifferentiated list (brief §"Keep it clearly
 * labelled as Online Knowledge... do not turn external sources into
 * Cellfie curated content").
 */
export function SavedLabItemsSection({ items }: { items: SavedLabItemRecord[] }) {
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6">
        <EmptyState
          icon={<BookmarkSimple size={32} />}
          title="Nothing saved yet"
          description="Save a curated Laboratory entry, or a result from My Library or Online Knowledge, and it'll show up here — permanently, until you remove it."
        />
      </div>
    )
  }

  const cellfieItems = items.filter((i) => i.sourceType === 'cellfie-reference')
  const libraryItems = items.filter((i) => i.sourceType === 'my-library')
  const onlineItems = items.filter((i) => i.sourceType === 'online-knowledge')

  async function handleRemove(id: string) {
    await removeSavedLabItem(id)
  }

  return (
    <div className="flex flex-col gap-8">
      <Micro as="p">
        Everything you've explicitly saved from Laboratory — curated Cellfie content by reference, plus any My Library or Online Knowledge
        results you kept. This list persists on this device until you remove something.
      </Micro>

      {cellfieItems.length > 0 && (
        <section>
          <h3 className="mb-3 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">Cellfie Reference</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cellfieItems.map((record) => (
              <Card key={record.id} className="p-4">
                <CardBody className="flex flex-col gap-2 p-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/laboratory/${record.labCategory}/${record.labContentId}`)}
                    className="text-left"
                  >
                    <p className="font-display text-h3 font-medium text-ink-primary hover:underline">{record.title}</p>
                    {record.labCategory && (
                      <p className="mt-0.5 font-ui text-caption text-ink-tertiary">
                        {CATEGORY_LABELS[record.labCategory as LaboratoryCategory] ?? record.labCategory}
                      </p>
                    )}
                  </button>
                  <RemoveButton onClick={() => handleRemove(record.id)} />
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {libraryItems.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            <Books size={14} aria-hidden />
            My Library
          </h3>
          <div className="flex flex-col gap-3">
            {libraryItems.map((record) => (
              <Card key={record.id} className="p-4">
                <CardBody className="flex flex-col gap-2 p-0">
                  <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{record.title}</p>
                  {record.excerpt && (
                    <blockquote className="border-l-2 border-olive pl-3 font-body text-body text-ink-secondary">{record.excerpt}</blockquote>
                  )}
                  <cite className="font-ui text-micro not-italic text-ink-tertiary">
                    {record.bookTitle}
                    {record.author ? ` — ${record.author}` : ''}
                    {record.page ? `, p. ${record.page}` : ''}
                  </cite>
                  <RemoveButton onClick={() => handleRemove(record.id)} />
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {onlineItems.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-1.5 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            <Globe size={14} aria-hidden />
            Online Knowledge
          </h3>
          <div className="flex flex-col gap-3">
            {onlineItems.map((record) => (
              <Card key={record.id} className="p-4">
                <CardBody className="flex flex-col gap-2 p-0">
                  <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{record.title}</p>
                  {record.excerpt && <p className="font-body text-body text-ink-secondary">{record.excerpt}</p>}
                  {record.sourceUrl && (
                    <a
                      href={record.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-ui text-caption text-olive hover:underline"
                    >
                      {record.isAbstract ? 'Abstract from ' : 'From '}
                      {record.sourceName}
                    </a>
                  )}
                  <RemoveButton onClick={() => handleRemove(record.id)} />
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="tertiary" size="small" icon={<Trash size={14} />} onClick={onClick} className="self-start">
      Remove
    </Button>
  )
}
