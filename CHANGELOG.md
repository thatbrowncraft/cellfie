# 📚 Cellfie Changelog

All notable changes to Cellfie are documented in this file.

Cellfie is an offline-first scientific learning companion built for students, researchers, and lifelong learners. The project focuses on privacy, speed, and complete offline functionality without requiring accounts, cloud storage, or a paid AI subscription for its core workflow.

Versioning follows Semantic Versioning.

---

## [1.0.0] - First Stable Public Release

Release Date: August 2026

v1.0.0 is not a new sprint of features — it's the polishing pass across everything Sprints 1–6 built. Every module below shipped incrementally; this release is where they were hardened, made consistent with each other, and brought up to a stable, public-ready bar.

### Added

- Unified onboarding across all seven sections (Dashboard, Library, Concepts, Organism Explorer, Laboratory, Comparison Studio, Notes, Settings) so nothing in the app is discoverable only by accident.
- Settings-level backup/restore covering the full local database (library, concepts, organisms, laboratory items, comparisons, notes), not just notes as in earlier sprints.
- Consistent empty, loading, and error states across every module, replacing the mix of ad-hoc placeholders introduced sprint-by-sprint.

### Changed

- **Comparison Studio's enrichment flow reworked from a single hardcoded "Overview" mapping to a general "Use for" picker** — a retrieved excerpt can now be sent to *any* aspect row in a comparison (Overview, Key Distinguishing Feature, or a custom row), or filed as Additional Source Information, instead of only ever landing in Overview.
- **Per-sentence selection added to that same enrichment flow** — a retrieved excerpt is no longer accepted as one indivisible block; individual sentences can be picked out and routed to different sections of the same comparison, with already-used sentences marked and the rest staying available for further picks.
- Accepting enriched text into an already-filled comparison row now appends as additional evidence instead of silently overwriting whatever was already there.
- "Search again" in Comparison Studio's Online Knowledge tab now genuinely advances to a different candidate/source per side instead of re-surfacing the same top hit.
- Standardized card, dialog, tab, and empty-state components across Concepts, Organism Explorer, Laboratory, and Comparison Studio, replacing several near-duplicate implementations built during earlier sprints.
- Copy pass across every module for tone, terminology, and length consistency (e.g. "aspect" vs "row", "excerpt" vs "source" used consistently).

### Fixed

- **Comparison Studio excerpt truncation cutting off mid-sentence** — the shared excerpt-shortening helper used by every online source now always ends on a complete sentence (extending slightly past the normal length cap to finish a sentence in progress, or falling back to the last complete sentence before it) instead of cutting at a raw character/word limit and appending "…" mid-thought.
- **Comparison Studio sentence picker defaulting every sentence to "selected"** — tapping the one sentence you wanted used to *deselect* it while leaving the rest of the paragraph selected, so "Use selected text" silently sent the whole excerpt instead of just the tapped sentence; sentences now start unselected and only the ones explicitly tapped in are used.
- The same picker previously locked out further selection after one apply, because every untouched (still-selected-by-default) sentence got swept into the very next apply — fixed as part of the default-selection fix above, so unused sentences stay individually pickable for later sections.
- Assorted mobile-layout overflow and touch-target issues across Comparison Studio, Organism Explorer, and Laboratory dialogs.
- Stale reading-progress and dashboard stats after bulk library changes (import, delete, or collection edits).

### Performance

- Reduced redundant re-renders in Concept Detail and Comparison Workspace views when switching tabs or sides.
- Trimmed IndexedDB writes on rapid successive edits (aspect notes, highlight color changes) via debounced persistence.

### Status

**v1.0.0 complete.** Cellfie now covers PDF/EPUB reading, highlights, notes, bookmarks, cross-library search, Concepts with multi-book retrieval and study tools, Organism Explorer, Laboratory, Comparison Studio, and full local backup/restore — all offline-first, with no account and no required paid AI subscription.

---

## [0.6.0] - Sprint 6: Comparison Studio

Release Date: 2026

Sprint 6 adds a dedicated workspace for side-by-side comparative learning — Gram-positive vs Gram-negative, DNA vs RNA, aerobic vs anaerobic, or any two concepts a student needs to see next to each other instead of as two separate paragraphs.

### Added

#### Comparison Studio

- New Comparison flow — pick any two items (concepts, organisms, or free-typed subjects) to compare
- Explore Comparisons — browse curated and custom comparisons, favorite them, and resume a comparison in progress
- Comparison Workspace with a per-aspect, side-by-side layout (Overview, Key Distinguishing Feature, Primary Purpose/Indication, Limitations/Pitfalls, plus any custom aspect row a student adds)
- Duplicate and delete a comparison
- Per-aspect "Key Difference" marking to flag the rows that matter most for exam prep
- Free-text Notes field on every comparison, separate from the structured aspect rows
- "Mark as reviewed" tracking per comparison

#### Comparison Sources

- **Comparison sources panel** — search My Library or Online Knowledge for a *single* aspect row at a time
- **Whole-comparison enrichment** — a separate "Enrich comparison" action that searches once for both items across the entire comparison, instead of once per row
- Online Knowledge sourced from Wikipedia, Europe PMC, PubMed, and NCBI Bookshelf, clearly separated from My Library results
- Source attribution and license notices shown inline with every retrieved excerpt
- Reference-only fallback (title + link, no excerpt) when a source's content isn't safe to reproduce
- Resume-search support if a search is interrupted before finishing

### Database

- Added comparisons table and schema migration for Sprint 6
- Added curated-comparison overlay storage so a student's edits to a built-in comparison never modify the shared curated original
- Existing library, concept, and organism data preserved during migration

### Offline-first

Comparison browsing, custom comparisons, and My Library search remain fully offline. Online Knowledge search requires a connection; Cellfie clearly reports "offline"/"timed out"/"no usable excerpt" rather than failing silently.

### Technology

- React
- TypeScript
- Vite
- Dexie / IndexedDB
- Wikipedia, Europe PMC, PubMed, and NCBI Bookshelf public APIs (no API key required)

### Status

**Sprint 6 complete.** Comparison Studio joins Concepts, Organism Explorer, and Laboratory as a core study module.

---

## [0.5.0] - Sprint 5: Laboratory

Release Date: 2026

Sprint 5 adds a Laboratory section for practical, procedure-oriented microbiology learning — the counterpart to Concepts' more definitional, textbook-style content.

### Added

#### Laboratory

- Laboratory home with browsable categories of techniques and procedures (staining methods, diagnostic methods, culture techniques)
- Detailed laboratory technique pages with step-by-step procedure content
- Clinical Laboratory section for diagnostic/clinical-relevance material, kept distinct from general lab technique pages
- Related-content lists linking a lab technique to relevant concepts and organisms

#### Calculators & Converters

- Built-in scientific calculators for common lab computations, with saved calculator results
- Unit Converter for standard lab units (concentration, volume, dilution, etc.)

#### Sources & Saved Items

- Lab-specific sources panel for attaching references to a technique
- Save lab items (techniques, calculator results) for quick later access from a dedicated "Saved" section

### Database

- Added laboratory items and saved-lab-items storage for Sprint 5
- Existing library, concept, and comparison data preserved during migration

### Offline-first

All laboratory content, calculators, and the unit converter work fully offline; only optional source lookups require a connection.

### Technology

- React
- TypeScript
- Vite
- Dexie / IndexedDB

### Status

**Sprint 5 complete.** Laboratory brings practical/procedural learning alongside Concepts' definitional content.

---

## [0.4.0] - Sprint 4: Organism Explorer

Release Date: 2026

Sprint 4 adds a dedicated space for studying microorganisms, so students no longer have to hunt through multiple textbook chapters just to compare two organisms' characteristics.

### Added

#### Organism Explorer

- Taxonomy browser for navigating organisms by classification
- Category cards and category filter pills for browsing by organism group (bacteria, viruses, fungi, parasites, etc.)
- Quick Explore shortcut for jumping straight to commonly studied organisms
- Organism detail pages covering classification, characteristics, and clinical/laboratory relevance
- Breadcrumb navigation for moving back up through taxonomy levels
- Organism images sourced automatically per organism
- Personal edit panel so a student can annotate or adjust an organism's study content, mirroring Concepts' edit/restore model

#### Search

- Knowledge-layer search panel scoped to organisms, separate from the library-wide search added in Sprint 2
- Search-results header summarizing matches by organism group

### Database

- Added organisms table and schema migration for Sprint 4
- Existing library, note, highlight, and bookmark data preserved during migration

### Offline-first

Browsing taxonomy, organism details, and saved edits work fully offline; organism image lookups require a connection and degrade gracefully without one.

### Technology

- React
- TypeScript
- Vite
- Dexie / IndexedDB

### Status

**Sprint 4 complete.** Organism Explorer becomes the third core study module alongside Library and Concepts.

---

## [0.3.0] - Sprint 3: Concepts & Knowledge Layer

Release Date: 2026

Sprint 3 is the largest sprint so far — it introduces Concepts, the heart of Cellfie's learning system, and the multi-book retrieval pipeline that searches a student's whole library instead of a single source.

### Added

#### Concepts

- Create and browse concepts (DNA, Gram staining, PCR, ELISA, or any topic a student needs to learn)
- Concept detail page bringing together every study tool for that concept in one place
- Concept cards showing progress and quick status at a glance
- Related-concepts panel for discovering connected topics

#### Multi-Book Retrieval

- Concept search considers **all relevant books in the library at once**, rather than defaulting to a single source
- Retrieval pipeline: local import → text/structure extraction → local indexing → concept search → relevance detection → section matching → multi-book retrieval → deduplication → study view
- Preserves textbook structure (headings, sections, source book, and page information) instead of flattening everything into generic text
- Source list per concept showing exactly which books and pages contributed content

#### Learn: Quick Revision, Core Concept, Exam Focus

- **Quick Revision** — a compact view for refreshing a concept a student already knows
- **Core Concept** — the main study view combining relevant sections pulled from the student's own books
- **Exam Focus** — a dedicated space for exam-relevant facts, distinctions, key points, and common confusions
- Curated educational fallback content and structured scientific reference notes for concepts a student's library doesn't yet cover

#### Personal Editing

- Edit → Modify → Save → Restore workflow on study sections, so a student can simplify, correct, or personalize extracted content
- Cellfie's original extracted material stays distinguishable from — and recoverable from — a student's edits

#### Study Notes & Memory Aids

- Per-concept study notes, kept separate from extracted/curated content
- Per-concept memory aids for mnemonics, associations, and personal reminders

#### Visual Tools

- Concept mind map and concept graph view for visualizing how concepts relate to one another
- Mind Map Studio for building a custom mind map around a concept
- Support for importing visuals (diagrams/images) into a concept

#### Research & Further Reading

- Separate research section for scientific literature beyond textbook level, kept clearly apart from a student's own uploaded material

### Database

- Added concepts, concept sources, study notes, and memory aids tables with schema migration for Sprint 3
- Existing library, note, highlight, and bookmark data preserved during migration

### Offline-first

Concept creation, editing, notes, memory aids, and retrieval from the student's own imported library all work fully offline. Curated fallback content and research references are the only parts that may involve an online lookup.

### Technology

- React
- TypeScript
- Vite
- Dexie / IndexedDB

### Status

**Sprint 3 complete.** Concepts becomes the foundation every later sprint (Organism Explorer, Laboratory, Comparison Studio) builds on for retrieval and study tooling.

---

## [0.2.0] - Sprint 2: Active Learning

Release Date: August 2026

Sprint 2 turns Cellfie from a PDF library into an interactive offline learning workspace.

### Added

#### PDF Reader

- Full in-app PDF reader
- Page navigation
- Page thumbnails
- Zoom controls
- Fit-to-width and fit-to-page modes
- Reading progress tracking
- Resume reading from the last opened page
- Direct page navigation and deep-link support
- Responsive reader layout for desktop and mobile

#### Highlights

- Text selection inside PDFs
- Create highlights from selected text
- Multiple highlight colors
- Attach notes to highlights
- Delete highlights
- Highlights remain linked to their source book and page

#### Notes

- Create notes directly from the PDF reader
- Notes automatically link to the current book and page
- Markdown-based note editor
- Markdown preview
- Search notes
- Sort notes
- Filter notes by book
- Group notes by book or subject
- Favorite notes
- Pin notes
- Edit existing notes
- Export notes as Markdown
- Export notes as JSON

#### Bookmarks

- Add bookmarks while reading
- Remove bookmarks
- View bookmarks inside the reader sidebar
- Bookmarks remain linked to individual books and pages

#### Search

- Cross-library search infrastructure
- Search across books, notes, highlights, bookmarks, and tags
- Search results can navigate to the relevant content
- In-book search support

#### Reading Dashboard

The dashboard now displays real reading activity:

- Books in library
- Pages read
- Highlights
- Notes
- Bookmarks
- Reading streak
- Reading time
- Continue Reading shortcut

#### Backup & Export

- JSON backup export
- Markdown note export
- Local-first backup workflow
- No cloud storage required

### Improved

- PDF reader architecture
- Library-to-reader navigation
- Mobile reader layout
- Reader sidebar organization
- Library cards now show reading progress
- Note management and organization
- Application-wide search behavior
- Dashboard now uses actual reading data
- Database structure expanded to support learning activity

### Database

- Added database schema migration for Sprint 2
- Added highlights storage
- Added notes storage
- Added reading-time tracking
- Added bookmark cleanup when a library item is removed
- Existing library data is preserved during migration

### Offline-first

Cellfie remains completely local and offline-first. No AI, cloud database, paid API, user account, or external learning service is required. Books, reading progress, notes, highlights and bookmarks continue to use local device storage.

### Technology

- React
- TypeScript
- Vite
- PDF.js
- Dexie
- IndexedDB
- GitHub Pages

### Status

**Sprint 2 complete and deployed.** This release establishes the core active-learning experience for Cellfie.

---

## [0.1.0] - Sprint 1: Offline PDF Reader Foundation

Release Date: August 2026

This is the first stable milestone of Cellfie. Sprint 1 establishes the complete offline PDF reading experience and the technical foundation for every future feature.

### Added

#### Library

- Import PDF files directly from the device
- Automatic library creation using IndexedDB
- Persistent offline storage
- Book cover thumbnails
- Metadata extraction
- Search library by title
- Sort documents
- Document type filtering
- Collections foundation
- Recent imports

#### PDF Reader

- Built-in PDF reader
- Fast page rendering using PDF.js
- Page thumbnails
- Thumbnail sidebar
- Page navigation
- Zoom controls
- Fit Width
- Fit Page
- Current page indicator
- Reading progress tracking
- Resume reading support
- Mobile responsive reader layout
- Desktop split-view reader

#### Metadata Management

- Edit title
- Edit author
- Document type
- Language
- Tags
- Remove documents
- Add documents to collections

#### User Interface

- Responsive layout
- Desktop navigation
- Mobile navigation
- Light and dark themes
- Clean reading interface
- Floating action button
- Search interface
- Modern card-based library

#### Offline Features

- Works completely offline
- No login required
- No cloud storage
- Local IndexedDB database
- Browser-based storage
- Progressive Web App foundation

#### Technical Foundation

Framework

- React
- TypeScript
- Vite

PDF Engine

- PDF.js

Storage

- Dexie
- IndexedDB

Deployment

- GitHub Pages
- GitHub Actions CI/CD

### Changed

- Library cards now open the built-in reader instead of the browser PDF viewer.
- Reading progress is stored locally.
- Project structure reorganized for future feature modules.

### Fixed

- GitHub Pages deployment configuration.
- Base path issues for project repository deployment.
- GitHub Actions workflow configuration.
- Reader routing.
- Offline asset loading.
- PDF rendering issues.

### Known Limitations

The following were intentionally postponed at the time and shipped in later sprints (see above):

- PDF text search → Sprint 2
- Highlighting → Sprint 2
- Sticky notes → Sprint 2
- Bookmarks → Sprint 2
- Concept extraction → Sprint 3
- Organism Explorer → Sprint 4
- Laboratory tools → Sprint 5
- Comparison Studio → Sprint 6

### Performance

- Fully client-side
- Offline-first
- No external backend
- No authentication required

---

Developed with 📚 by Thatbrowncraft

Project: Cellfie

Repository: <https://github.com/thatbrowncraft/cellfie>
