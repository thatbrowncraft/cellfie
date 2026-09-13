import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '@/shared/layouts'
import { Button, Card, CardBody, EmptyState } from '@/shared/components'
import { getExamSubjectById } from '@/core/exam-prep/subjects'
import { listTopicsForSubject } from '@/core/exam-prep/registry'
import { recordExamSubjectViewed } from '@/core/exam-prep/recentlyViewed'
import type { ExamSubjectId, ExamTopic } from '@/core/exam-prep/types'

/**
 * Human Anatomy landing groups (brief: "group chapters into Foundations /
 * Body Systems / Organs & Senses / Final Revision instead of one flat
 * list"). Scoped to a single topic-id → group lookup used ONLY when
 * `subjectId === 'human-anatomy'` — every other subject keeps the plain
 * flat grid (or the existing region-grouped layout for Current Affairs)
 * exactly as before. A topic id not present here (e.g. a future chapter
 * added before this map is updated) safely falls into "More topics"
 * rather than disappearing.
 */
const HUMAN_ANATOMY_GROUPS: { label: string; topicIds: string[] }[] = [
  { label: 'Foundations', topicIds: ['anatomy-overview', 'anatomical-terminology'] },
  {
    label: 'Body Systems',
    topicIds: [
      'cardiovascular-system',
      'respiratory-system',
      'digestive-system',
      'nervous-system',
      'skeletal-system',
      'muscular-system',
      'urinary-system',
      'endocrine-system',
      'lymphatic-immune-system',
      'reproductive-system',
      'integumentary-system'
    ]
  },
  {
    label: 'Organs & Senses',
    topicIds: ['major-internal-organs', 'eye', 'ear', 'nose-olfactory-system', 'tongue-taste']
  },
  { label: 'Final Revision', topicIds: ['human-anatomy-quick-revision'] }
]

/**
 * One topic card, reused by the flat grid, the Current-Affairs region
 * groups, and the Human Anatomy chapter groups. `label` is whatever
 * small caption line each layout wants above the title (syllabus
 * index, category/date, or nothing).
 *
 * The thumbnail uses `object-contain` (never `object-cover`) — cropping
 * an anatomy illustration to fill a fixed-height box can cut off the
 * very labels the person needs to read, so the full diagram always
 * stays visible on a neutral background instead.
 */
function TopicCard({ topic, label, onClick }: { topic: ExamTopic; label?: string; onClick: () => void }) {
  return (
    <Card interactive onClick={onClick}>
      <CardBody className="flex flex-col gap-1">
        {topic.illustration && (
          <div className="mb-2 h-28 w-full overflow-hidden rounded-md border border-border bg-surface-raised">
            <img
              src={topic.illustration.src}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
            />
          </div>
        )}
        {label && (
          <p className="font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">{label}</p>
        )}
        <p className="font-display text-h3 font-medium text-ink-primary">{topic.title}</p>
        <p className="font-body text-caption text-ink-secondary">{topic.shortDescription}</p>
        <p className="mt-1 font-ui text-caption italic text-ink-tertiary">{topic.genZNote}</p>
      </CardBody>
    </Card>
  )
}

function groupHumanAnatomyTopics(topics: ExamTopic[]) {
  const byId = new Map(topics.map((t) => [t.id, t]))
  const used = new Set<string>()
  const groups = HUMAN_ANATOMY_GROUPS.map((g) => {
    const items = g.topicIds.map((id) => byId.get(id)).filter((t): t is ExamTopic => Boolean(t))
    items.forEach((t) => used.add(t.id))
    return { label: g.label, items }
  }).filter((g) => g.items.length > 0)

  const leftover = topics.filter((t) => !used.has(t.id))
  if (leftover.length > 0) {
    groups.push({ label: 'More Topics', items: leftover })
  }
  return groups
}

/**
 * Exam Prep — subject page. Lists every topic loaded for this subject
 * from `core/exam-prep/registry.ts`, in syllabus order — never a
 * hardcoded list of 10 cards, so a topic file that fails validation
 * simply doesn't appear rather than crashing the page (same
 * fail-soft behaviour as `core/laboratory/registry.ts` and
 * `core/concepts/curatedLessons/registry.ts`).
 *
 * Current Affairs 2026 topics carry an optional `region` — when ANY
 * topic in the subject has one set, this page groups by region
 * (Gujarat first, per that module's brief) with a small category/date
 * chip per card instead of the plain "N. Syllabus topic" label. Every
 * other subject's topics have no `region`, so they render exactly as
 * before — this is additive, not a redesign.
 */
export function ExamPrepSubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()

  const subject = useMemo(() => (subjectId ? getExamSubjectById(subjectId) : undefined), [subjectId])
  const topics = useMemo(
    () => (subjectId ? listTopicsForSubject(subjectId as ExamSubjectId) : []),
    [subjectId]
  )
  const isHumanAnatomy = subject?.id === 'human-anatomy'
  const anatomyGroups = useMemo(
    () => (isHumanAnatomy ? groupHumanAnatomyTopics(topics) : []),
    [isHumanAnatomy, topics]
  )
  const isRegionGrouped = topics.some((t) => t.region)
  const regionGroups = useMemo(() => {
    if (!isRegionGrouped) return []
    const gujarat = topics.filter((t) => t.region === 'gujarat')
    const india = topics.filter((t) => t.region === 'india')
    const other = topics.filter((t) => !t.region)
    return [
      { label: '\uD83C\uDDEE\uD83C\uDDF3 Gujarat First', items: gujarat },
      { label: '\uD83C\uDDEE\uD83C\uDDF3 India', items: india },
      { label: 'Other', items: other }
    ].filter((g) => g.items.length > 0)
  }, [isRegionGrouped, topics])

  // Dashboard "Exam Prep" preview support — fire-and-forget, never blocks
  // render. Same pattern as Organism/Lab/Element detail pages.
  useEffect(() => {
    if (subject) {
      void recordExamSubjectViewed(subject.id)
    }
  }, [subject])

  if (!subject) {
    return (
      <EmptyStateLayout>
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="Subject not found"
          description="This Exam Prep subject doesn't exist yet."
          action={
            <Button variant="secondary" onClick={() => navigate('/exam-prep')}>
              Back to Exam Prep
            </Button>
          }
        />
      </EmptyStateLayout>
    )
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1 font-ui text-caption text-ink-tertiary">
        <button type="button" onClick={() => navigate('/exam-prep')} className="hover:text-ink-secondary hover:underline">
          Exam Prep
        </button>
        <CaretRight size={12} aria-hidden />
        <span className="font-medium text-ink-primary">{subject.title}</span>
      </nav>

      <Button variant="tertiary" size="small" icon={<ArrowLeft size={16} />} onClick={() => navigate('/exam-prep')} className="mb-4">
        Back
      </Button>

      <header className="mb-8">
        <h1 className="font-display text-display font-semibold text-ink-primary">{subject.title}</h1>
        <p className="mt-2 max-w-2xl font-body text-body text-ink-secondary">{subject.shortDescription}</p>
        <p className="mt-2 font-ui text-body-lg italic text-ink-tertiary">{subject.genZNote}</p>
        {isRegionGrouped && (
          <p className="mt-3 inline-block rounded-full bg-surface-secondary px-3 py-1 font-ui text-micro font-medium uppercase tracking-wide text-ink-tertiary">
            Current Affairs • 2026 — curated, not a live feed
          </p>
        )}
      </header>

      {topics.length === 0 ? (
        <EmptyState
          icon={<WarningCircle size={32} />}
          title="No topics yet"
          description="Content for this subject hasn't been added yet."
        />
      ) : isHumanAnatomy ? (
        <div className="flex flex-col gap-8">
          {anatomyGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 font-display text-h3 font-semibold text-ink-primary">{group.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.items.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onClick={() => navigate(`/exam-prep/${subject.id}/${topic.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : isRegionGrouped ? (
        <div className="flex flex-col gap-8">
          {regionGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 font-display text-h3 font-semibold text-ink-primary">{group.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.items.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    label={[topic.category, topic.eventDate].filter(Boolean).join(' \u00b7 ') || 'Current Affairs'}
                    onClick={() => navigate(`/exam-prep/${subject.id}/${topic.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {topics.map((topic, i) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              label={`${i + 1}. Syllabus topic`}
              onClick={() => navigate(`/exam-prep/${subject.id}/${topic.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
