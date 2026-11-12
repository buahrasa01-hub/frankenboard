---
inclusion: always
---

# Structure — Frankenboard

```
frankenboard/
├── index.html            # Single page: header, view switcher, three view containers, editor panel
├── styles.css            # All styling: stitched-monster design system
├── src/
│   ├── app.js            # Wiring: view switching, shortcuts, seed/import/export, editor panel
│   ├── store.js          # Task store: CRUD, filters, validation, persistence, invariants
│   ├── seed.js           # Demo dataset (10 tasks across statuses/dates/tags)
│   └── views/
│       ├── sheet.js      # Spreadsheet-grid renderer + inline editing
│       ├── board.js      # Kanban renderer + drag-and-drop
│       └── calendar.js   # Month-grid renderer + drag between days
├── tests/
│   ├── store.test.js     # Unit tests for the store
│   └── store.property.test.js  # fast-check property tests for store invariants
├── .kiro/
│   ├── steering/         # product.md, tech.md, structure.md (this file)
│   ├── specs/frankenboard/  # requirements.md, design.md, tasks.md
│   ├── hooks/            # test-on-save.json
│   └── agents/           # test-writer.md (custom agent)
├── package.json          # test/serve scripts, fast-check devDependency
├── README.md
└── LICENSE               # MIT
```

## Naming
- Files: kebab-case (`store.property.test.js`).
- Store functions: verbs — `createTask`, `updateTask`, `moveTask`,
  `deleteTask`, `setDueDate`, `listTasks`.
- Task fields: `id`, `title`, `notes`, `status` (`todo`|`doing`|`done`),
  `priority` (`low`|`medium`|`high`), `dueDate` (ISO date or `null`),
  `tags` (string array), `createdAt`, `updatedAt` (ISO timestamps).
- View modules export one `render(container, tasks, actions)` function each;
  `actions` is the set of store operations the view may call — views never
  import the store directly.

## Rules
- Never add `/.kiro` or any sub-folder to `.gitignore` (hackathon rules:
  the `/.kiro` directory must be visible in the repo).
- Never commit `node_modules/` or credentials.
- Keep `index.html` dependency-free: no CDN scripts, fonts, or images.
- Every new source file gets a test (hook enforces `npm test` on save).
