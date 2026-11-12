# Implementation Plan — Frankenboard

Tasks are executed by Kiro CLI from this spec. Each task references the
requirements it satisfies. Run the full test suite (`npm test`) after every
task; do not mark a task complete while tests fail.

- [ ] 1. Project scaffolding
  - Create `index.html` (header, view switcher, search/filter bar, three view
    containers, editor panel container, `<noscript>` message), `styles.css`
    (stitched-monster design system per steering/tech.md), `src/app.js` stub
    that renders an empty state.
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 2. Task store core
  - Implement `src/store.js`: `createStore` with CRUD (`createTask`,
    `updateTask`, `deleteTask`), `moveTask`, `setDueDate`, validation
    (`ValidationError` on bad status/priority/date/tags), `localStorage`
    persistence under `frankenboard.v1` with corrupt-data fallback, and
    `onChange` subscription.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Store unit tests
  - Write `tests/store.test.js` covering CRUD, validation rejections (state
    untouched), persistence round-trip with fake storage, corrupt-data fallback.
  - _Requirements: 10.1_

- [ ] 4. Seed data + import/export
  - Implement `src/seed.js` (10 varied demo tasks) and store
    `importTasks`/`exportTasks` with strict validation (reject invalid files,
    keep current data).
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 5. Sheet view
  - Implement `src/views/sheet.js`: grid with Title/Status/Priority/Due
    date/Tags columns, inline cell editing, search filter, status/priority
    filters, column sorting (asc/desc toggle).
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Board view
  - Implement `src/views/board.js`: three columns (To do/Doing/Done), cards,
    HTML5 drag-and-drop between columns, empty-state messages, click-to-edit
    fallback.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Calendar view
  - Implement `src/views/calendar.js`: current-month grid, prev/next month
    navigation, tasks on due-date cells, drag between days, click empty day
    to create a task due that day, "Undated" strip for tasks without due dates.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. App wiring: view switching, editor panel, shortcuts
  - Implement `src/app.js`: view switcher (Sheet/Board/Calendar), `onChange`
    re-render, editor panel with all task fields, keyboard shortcuts (`n` new,
    `/` search, `1/2/3` views), seed/import/export buttons.
  - _Requirements: 6.1, 6.3, 8.1, 8.2, 8.3, 8.4_

- [ ] 9. Property-based tests for the no-drift invariant
  - Write `tests/store.property.test.js` with fast-check: random sequences of
    create/update/move/delete/setDueDate asserting count conservation, unique
    ids, valid statuses, and view-projection equality with the store.
  - _Requirements: 6.2, 10.2_

- [ ] 10. Design pass + responsive check
  - Apply the stitched-monster design system end-to-end (dashed stitch
    borders, bolts, graveyard palette), verify phone-width layout (no page
    horizontal overflow), verify `<noscript>` message.
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 11. End-to-end verification
  - Serve the app, run the manual checklist from design.md (create in Sheet
    → visible on Board and Calendar; drag on Board; drag on Calendar; reload
    persists), fix any issues found, and confirm `npm test` passes 100%.
  - _Requirements: 1.2, 6.1, 10.1_
