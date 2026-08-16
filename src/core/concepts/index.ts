/**
 * core/concepts — Sprint 3, Offline Knowledge Layer. Barrel export
 * matching the pattern of core/search and core/stats: this module owns
 * the Concept/ConceptSource/ConceptRelation data model's business logic
 * (normalization, CRUD, deterministic extraction, statistics, and graph
 * data building). No AI, no cloud, no new dependencies — see each file's
 * header comment for specifics.
 */

export * from './normalize'
export * from './service'
export * from './extraction'
export * from './stats'
export * from './graph'
export * from './librarySearch'
export * from './onlineKnowledge'
export * from './relevance'
export * from './textDisplay'
export * from './examTools'
export * from './detailedStudy'
export * from './researchReadings'
export * from './mindMapStudio'
export * from './studyNotes'
export * from './curatedLessons/registry'
export * from './bookLesson'
