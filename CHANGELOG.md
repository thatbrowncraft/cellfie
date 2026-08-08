# 📚 Cellfie Changelog

All notable changes to Cellfie are documented in this file.

Cellfie is an offline-first scientific learning companion built for students, researchers, and lifelong learners. The project focuses on privacy, speed, and complete offline functionality without requiring accounts, cloud storage, or AI.

Versioning follows Semantic Versioning.

---

# v0.1.0
## Sprint 1 • Offline PDF Reader Foundation

Release Date: August 2026

This is the first stable milestone of Cellfie. Sprint 1 establishes the complete offline PDF reading experience and the technical foundation for every future feature.

---

## Added

### Library

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

---

### PDF Reader

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

---

### Metadata Management

- Edit title
- Edit author
- Document type
- Language
- Tags
- Remove documents
- Add documents to collections

---

### User Interface

- Responsive layout
- Desktop navigation
- Mobile navigation
- Light and dark themes
- Clean reading interface
- Floating action button
- Search interface
- Modern card-based library

---

### Offline Features

- Works completely offline
- No login required
- No cloud storage
- Local IndexedDB database
- Browser-based storage
- Progressive Web App foundation

---

### Technical Foundation

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

---

## Changed

- Library cards now open the built-in reader instead of the browser PDF viewer.
- Reading progress is stored locally.
- Project structure reorganized for future feature modules.

---

## Fixed

- GitHub Pages deployment configuration.
- Base path issues for project repository deployment.
- GitHub Actions workflow configuration.
- Reader routing.
- Offline asset loading.
- PDF rendering issues.

---

## Known Limitations

The following features are intentionally postponed to future sprints.

- PDF text search
- Highlighting
- Sticky notes
- Bookmarks
- Table of contents
- Annotation tools
- Flashcards
- Concept extraction
- Organism Explorer
- Laboratory tools
- Comparison Studio
- AI assistant

---

## Performance

- Fully client-side
- Offline-first
- No external backend
- No authentication required

---

## [0.2.0] - Sprint 2: Active Learning

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
- Search across:
  - Books
  - Notes
  - Highlights
  - Bookmarks
  - Tags
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

Cellfie remains completely local and offline-first.

No:

- AI
- Cloud database
- Paid API
- User account
- External learning service

Books, reading progress, notes, highlights and bookmarks continue to use local device storage.

### Technology

- React
- TypeScript
- Vite
- PDF.js
- Dexie
- IndexedDB
- GitHub Pages

### Status

**Sprint 2 complete and deployed.**

This release establishes the core active-learning experience for Cellfie.


## Future Roadmap

---

### v0.3.0
Sprint 3

Knowledge Layer

- Concepts
- Concept linking
- Knowledge graph
- Smart indexing

---

### v0.4.0
Sprint 4

Organism Explorer

- Taxonomy
- Morphology
- Disease associations
- Interactive cards

---

### v0.5.0
Sprint 5

Virtual Laboratory

- Laboratory protocols
- Equipment guide
- Experiment walkthroughs
- Safety reference

---

### v0.6.0
Sprint 6

Comparison Studio

- Side-by-side comparisons
- Tables
- Visual comparison tools
- Scientific reference workspace

---

### v1.0.0

First Stable Public Release

Complete offline scientific learning companion featuring:

- PDF Reader
- Library
- Study Tools
- Concepts
- Organism Explorer
- Laboratory
- Comparison Studio
- Offline knowledge management

---

Developed with 📚 by Thatbrowncraft 

Project:
Cellfie

Repository:
https://github.com/thatbrowncraft/cellfie
