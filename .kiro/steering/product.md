---
inclusion: always
---

# Product — Frankenboard

## What it is
Frankenboard is a local-first task manager for people who juggle their work
across three tools that never agree with each other: a spreadsheet for lists, a
kanban board for flow, and a calendar for deadlines. It stitches all three
faces onto ONE dataset. A task edited in the sheet moves on the board; a card
dragged on the board lands on a new day in the calendar. The seams are visible
on purpose — dashed stitch borders, bolts, a graveyard palette — because the
monster look is the joke and the point (Kiroween 2026, Frankenstein category).

## Who it is for
- Anyone who plans work in a spreadsheet but tracks it on a board and misses
  deadlines because the three copies drift apart.
- Judges of Kiroween 2026: the app must work end-to-end in under a minute with
  zero setup, zero account, zero network dependency beyond the page itself.

## Core promise
**One task, three faces, zero drift.** Moving a task in any view can never
duplicate it, lose it, or leave the other views stale. This invariant is the
heart of the product and is verified by property-based tests.

## Features (in priority order)
1. One versioned task store (localStorage), import/export JSON.
2. Sheet view: inline editing, sort, filter (status/priority/tag), search.
3. Board view: kanban columns To do / Doing / Done, drag-and-drop.
4. Calendar view: month grid by due date, drag between days, click a day to
   set a due date.
5. Seed demo data (one click) so a first-time visitor sees all three views alive.
6. Keyboard shortcuts (n = new task, / = search, 1/2/3 = switch view).

## Non-goals
- No accounts, no server, no sync, no collaboration.
- No paid services, no API keys, no analytics, no tracking.
- No framework: vanilla HTML/CSS/JS, zero runtime dependencies, so the app
  runs from a static host (GitHub Pages) and works offline after first load.

## Success criteria
- A new visitor understands the "one dataset, three faces" idea within 30
  seconds of the demo.
- All unit + property tests pass (`npm test`).
- The app works identically from `index.html` opened directly and from the
  deployed GitHub Pages URL.
