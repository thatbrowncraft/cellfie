import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CaretRight, WarningCircle } from '@phosphor-icons/react'
import { EmptyStateLayout } from '@/shared/layouts'
import { Accordion, Button, Card, CardBody, EmptyState } from '@/shared/components'
import { getExamSubjectById } from '@/core/exam-prep/subjects'
import { listTopicsForSubject } from '@/core/exam-prep/registry'
import { recordExamSubjectViewed } from '@/core/exam-prep/recentlyViewed'
import type { ExamSubjectId, ExamTopic } from '@/core/exam-prep/types'
import { resolveExamPrepAssetPath } from '@/shared/utils/resolveExamPrepAssetPath'

/**
 * Landing-page topic grouping (brief: "group chapters into labelled
 * sections instead of one flat list"). A subject opts in by adding an
 * entry to `TOPIC_GROUPS_BY_SUBJECT` below; every subject without one
 * keeps the plain flat grid (or the existing region-grouped layout for
 * Current Affairs) exactly as before. A topic id not present in a
 * subject's group list (e.g. a new chapter added before the map is
 * updated) safely falls into "More topics" rather than disappearing.
 */
interface TopicGroupDef {
  label: string
  topicIds: string[]
}

const HUMAN_ANATOMY_GROUPS: TopicGroupDef[] = [
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
 * Healthcare Quality & Accreditation landing groups — same "grouped
 * chapters instead of one flat list" treatment as Human Anatomy above,
 * via the same generic `TOPIC_GROUPS_BY_SUBJECT` mechanism.
 */
const HEALTHCARE_ACCREDITATION_GROUPS: TopicGroupDef[] = [
  {
    label: 'Foundations',
    topicIds: ['quality-accreditation-fundamentals', 'accreditation-vs-certification-vs-registration']
  },
  {
    label: 'Laboratory Accreditation',
    topicIds: [
      'nabl',
      'nabl-medical-laboratories',
      'iso-15189',
      'iso-17025',
      'laboratory-quality-management-system',
      'nabl-accreditation-process'
    ]
  },
  {
    label: 'Healthcare Accreditation',
    topicIds: ['nabh', 'nabh-hospital-accreditation', 'nabh-standards-patient-safety', 'hospital-quality-management']
  },
  {
    label: 'Quality Systems',
    topicIds: [
      'qci-accreditation-ecosystem',
      'iso-standards-healthcare-laboratories',
      'international-accreditation-bodies',
      'quality-indicators-continuous-improvement',
      'audits-assessments-nonconformities',
      'documentation-quality-records',
      'laboratory-safety-risk-quality'
    ]
  },
  { label: 'Revision', topicIds: ['accreditation-quick-revision'] }
]

const FOOD_SAFETY_GROUPS: TopicGroupDef[] = [
  {
    label: 'Unit 01 \u00b7 Food Laws, Regulations, Certification & Development Schemes',
    topicIds: ['fsft-food-laws-regulatory-regime', 'fsft-fssai', 'fsft-codex-global-scenario', 'fsft-fss-act-rules-regulations', 'fsft-adulteration-misbranding', 'fsft-certification-bis-agmark', 'fsft-food-safety-authorities-product-standards']
  },
  {
    label: 'Unit 02 \u00b7 Introduction to Basic Food Science',
    topicIds: ['fsft-history-traditional-foods', 'fsft-fortification-eat-right', 'fsft-carbohydrates', 'fsft-proteins', 'fsft-fats-lipids', 'fsft-vitamins', 'fsft-minerals', 'fsft-enzymes', 'fsft-digestion-absorption-fibre', 'fsft-metabolic-pathways', 'fsft-physical-properties-colloids', 'fsft-acid-base-buffer-chemical-properties']
  },
  {
    label: 'Unit 03 \u00b7 Food Microbiology & Food Biotechnology',
    topicIds: ['fsft-micro-characteristics-classification', 'fsft-micro-physiology-growth', 'fsft-food-poisoning-foodborne-toxins', 'fsft-microbial-techniques-rapid-methods', 'fsft-food-fermentation-fermented-products', 'fsft-spoilage-animal-foods', 'fsft-spoilage-plant-foods-canned', 'fsft-gmo-enzyme-protein-engineering', 'fsft-fermentation-preservation-alternative-food']
  },
  {
    label: 'Unit 04 \u00b7 Food & Nutrition',
    topicIds: ['fsft-food-nutrition-balanced-diet-rda', 'fsft-nutritional-assessment-malnutrition', 'fsft-nutrition-health-programmes-india', 'fsft-macro-micronutrient-deficiency-diseases']
  },
  {
    label: 'Unit 05 \u00b7 Food Preservation, Packaging & Storage',
    topicIds: ['fsft-preservation-principles-methods', 'fsft-food-packaging-types-evaluation', 'fsft-packaging-laws-novel-technologies', 'fsft-food-storage-structures-practices']
  },
  {
    label: 'Unit 06 \u00b7 Agricultural Science',
    topicIds: ['fsft-agriculture-status-farming-systems', 'fsft-crops-cropping-horticulture-agroforestry', 'fsft-livestock-aquaculture-integrated-enterprises']
  },
  {
    label: 'Unit 07 \u00b7 Food Safety, Quality Control, Hygiene & Standards',
    topicIds: ['fsft-food-safety-definition-scope-standards', 'fsft-food-hazards-risk-management', 'fsft-hygiene-sanitation-food-service', 'fsft-prp-ghp-gmp-ssop', 'fsft-haccp', 'fsft-iso-series-tqm-fsms']
  },
  {
    label: 'Unit 08 \u00b7 Animal Product Processing',
    topicIds: ['fsft-meat-composition-slaughter-curing', 'fsft-fish-poultry-processing', 'fsft-egg-characteristics', 'fsft-milk-composition-products-overview', 'fsft-milk-adulterants-detection']
  },
  {
    label: 'Unit 09 \u00b7 Dairy Science',
    topicIds: ['fsft-milk-science', 'fsft-dairy-unit-operations', 'fsft-dairy-product-technology', 'fsft-indigenous-dairy-products', 'fsft-dairy-quality-packaging-hygiene']
  },
  {
    label: 'Unit 10 \u00b7 Food Processing Technology',
    topicIds: ['fsft-membrane-nonthermal-technologies', 'fsft-nutraceuticals-functional-junk-foods', 'fsft-thermal-processing-pasteurisation-canning', 'fsft-concentration-dehydration-freezing-fermentation-irradiation-additives', 'fsft-aseptic-hurdle-hydrostatic-microwave', 'fsft-innovative-thermal-ohmic-dielectric-ir-induction']
  },
]

/**
 * Any subject whose landing page should group its topics under labelled
 * sections (instead of one flat syllabus-order grid) gets an entry here.
 * Adding the next grouped subject means adding one `TopicGroupDef[]`
 * above and one line here — `groupTopicsByDefinition` and the render
 * branch below are already fully generic.
 */
const TOPIC_GROUPS_BY_SUBJECT: Partial<Record<ExamSubjectId, TopicGroupDef[]>> = {
  'human-anatomy': HUMAN_ANATOMY_GROUPS,
  'healthcare-quality-accreditation': HEALTHCARE_ACCREDITATION_GROUPS,
  'food-safety-food-technology': FOOD_SAFETY_GROUPS
}

/**
 * Subjects whose groups render as expandable chapters (each group shows
 * only its title until opened, then reveals its own topics) instead of
 * every topic being visible at once. Opt-in, so Human Anatomy and
 * Healthcare Quality & Accreditation keep their existing always-open
 * grouped layout.
 */
const COLLAPSIBLE_GROUP_SUBJECTS: ReadonlySet<ExamSubjectId> = new Set<ExamSubjectId>(['food-safety-food-technology'])

/**
 * Remembers which unit was open when a topic was tapped, so Back from the
 * lesson returns to that unit instead of a fully collapsed list. Per-tab
 * convenience only — every read/write is guarded, and the page works the
 * same without it.
 */
const lastOpenUnitKey = (subjectId: string) => `cellfie:exam-prep:last-open-unit:${subjectId}`
function readLastOpenUnit(subjectId: string): string | undefined {
  try {
    return window.sessionStorage.getItem(lastOpenUnitKey(subjectId)) ?? undefined
  } catch {
    return undefined
  }
}
function writeLastOpenUnit(subjectId: string, unitId: string) {
  try {
    window.sessionStorage.setItem(lastOpenUnitKey(subjectId), unitId)
  } catch {
    /* storage unavailable — Back simply returns to the collapsed list */
  }
}

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
              src={resolveExamPrepAssetPath(topic.illustration.src)}
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

function groupTopicsByDefinition(topics: ExamTopic[], groupDefs: TopicGroupDef[]) {
  const byId = new Map(topics.map((t) => [t.id, t]))
  const used = new Set<string>()
  const groups = groupDefs
    .map((g) => {
      const items = g.topicIds.map((id) => byId.get(id)).filter((t): t is ExamTopic => Boolean(t))
      items.forEach((t) => used.add(t.id))
      return { label: g.label, items }
    })
    .filter((g) => g.items.length > 0)

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
  const groupDefs = subject ? TOPIC_GROUPS_BY_SUBJECT[subject.id] : undefined
  const isGrouped = Boolean(groupDefs)
  const isCollapsible = Boolean(subject && COLLAPSIBLE_GROUP_SUBJECTS.has(subject.id))
  const definedGroups = useMemo(
    () => (groupDefs ? groupTopicsByDefinition(topics, groupDefs) : []),
    [groupDefs, topics]
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
      ) : isGrouped && isCollapsible ? (
        <Accordion
          defaultOpenId={readLastOpenUnit(subject.id)}
          items={definedGroups.map((group, i) => {
            const unitId = `unit-${i + 1}`
            return {
              id: unitId,
              title: group.label,
              content: (
                <div className="grid gap-4 pt-1 sm:grid-cols-2">
                  {group.items.map((topic) => (
                    <TopicCard
                      key={topic.id}
                      topic={topic}
                      onClick={() => {
                        writeLastOpenUnit(subject.id, unitId)
                        navigate(`/exam-prep/${subject.id}/${topic.id}`)
                      }}
                    />
                  ))}
                </div>
              )
            }
          })}
        />
      ) : isGrouped ? (
        <div className="flex flex-col gap-8">
          {definedGroups.map((group) => (
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
