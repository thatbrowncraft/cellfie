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

## Future Roadmap

### v0.2.0
Sprint 2

Study Tools

- Text search
- Highlights
- Sticky notes
- Bookmarks
- Continue Reading
- Reader improvements

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
