---
inclusion: always
---

# Tech — Frankenboard

## Stack
- **Runtime:** vanilla HTML + CSS + JavaScript (ES modules). Zero runtime
  dependencies, no build step, no framework. The app must run by opening
  `index.html` or from any static host.
- **Data:** `localStorage` under a versioned key (`frankenboard.v1`). All
  mutations go through a single store module; views never write storage
  directly. Import/export is a JSON file download/upload.
- **Tests:** `node --test` (Node built-in test runner) for unit tests.
  Property-based tests use `fast-check` (devDependency only) to verify store
  invariants across random operation sequences.
- **Tooling:** Kiro CLI 3.x for spec-driven implementation. Node 24 available
  on the build machine.

## Conventions
- ES modules throughout (`"type": "module"` in package.json).
- One module per concern: `src/store.js` (data + invariants), `src/views/`
  (sheet/board/calendar renderers), `src/app.js` (wiring, view switching,
  shortcuts), `src/seed.js` (demo data).
- Pure functions for the store core (create/update/move/delete, filters) so
  they are testable without DOM. DOM code lives only in view modules.
- IDs: `crypto.randomUUID()` with a timestamp fallback.
- Dates: ISO `YYYY-MM-DD` strings for due dates; no date library.
- All user-visible strings in English (hackathon materials must be English).
- Accessibility: buttons have labels, drag operations have keyboard/click
  equivalents (click a task to change status/date via a small editor panel).

## Design system (the "stitched monster" look)
- Palette: near-black graveyard `#12100e` background, bone `#e8e0c8` text,
  monster green `#7dc242` accents, bruise purple `#8b5cf6` secondary,
  warning orange `#f59e0b` for due-soon.
- Seams: `2px dashed` borders on panels (the "stitches"), bolt glyphs (`✕`
  / `●`) as decorative rivets — pure CSS, no images.
- Typography: system stack with a monospace accent for IDs/dates.
- No external fonts, no images, no icon libraries — everything must render
  offline.

## Quality bar
- `npm test` must pass 100% before any commit.
- Every store mutation is covered by at least one property test.
- No `console.error` on load; no uncaught exceptions in any view switch.
- The app must work with JavaScript disabled? No — JS is required, but the
  page must show a clear `<noscript>` message.
