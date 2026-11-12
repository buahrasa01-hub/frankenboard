# Design — Frankenboard

## Overview
A single-page, zero-dependency web app. One pure-JS store owns all data; three
view modules render the same data three ways; `app.js` wires them together.
No backend, no network calls, no build step. Deployed as static files on
GitHub Pages.

## Architecture

```
index.html
  └─ app.js  (view switching, shortcuts, seed/import/export, editor panel)
       ├─ store.js      (pure data layer: CRUD, validation, persistence)
       ├─ seed.js       (demo dataset)
       └─ views/
            ├─ sheet.js     (grid renderer + inline editing)
            ├─ board.js     (kanban renderer + drag-and-drop)
            └─ calendar.js  (month grid renderer + drag between days)
```

Rendering model: **re-render on change**. After every store mutation, `app.js`
calls `renderActiveView()`; the active view re-reads `store.listTasks()` and
rebuilds its DOM. Views never cache task data, which makes drift structurally
impossible — the invariant is enforced by architecture, then proven by tests.

## Components and interfaces

### Store (`src/store.js`)
Pure functions over an in-memory array + `localStorage` persistence. No DOM.

```js
createStore(storageKey) -> {
  listTasks(filter?), getTask(id),
  createTask({title, notes?, status?, priority?, dueDate?, tags?}),
  updateTask(id, patch), deleteTask(id),
  moveTask(id, status), setDueDate(id, date),
  importTasks(array), exportTasks(), clearAll()
}
```

- Validation: `validateTask` rejects bad status/priority/date/tags; invalid
  mutations throw a `ValidationError` and leave state untouched.
- Persistence: `save()` writes `{version: 1, tasks: [...]}` as JSON after every
  mutation; `load()` parses and validates, falling back to `[]` on any error.
- Ids: `crypto.randomUUID()` with `Date.now()` + counter fallback.

### Views (`src/views/*.js`)
Each exports `render(container, tasks, actions)` where `actions` is
`{updateTask, deleteTask, moveTask, setDueDate, openEditor}`. Views call
actions; they never import the store. Drag-and-drop uses HTML5 DnD with a
`dataTransfer` payload of the task id; every draggable has a click-to-edit
fallback.

### App (`src/app.js`)
- Holds current view (`sheet`|`board`|`calendar`), filters, search text,
  calendar month cursor.
- Subscribes to store changes (store calls `onChange` after each mutation) and
  re-renders.
- Editor panel: a `<dialog>`-style panel (plain div) with all task fields.
- Shortcuts: `n` new, `/` search focus, `1/2/3` views (ignored while typing
  in an input).

### Seed (`src/seed.js`)
`seedTasks()` returns 10 tasks: a mix of statuses, priorities, due dates
across this week/month, tags like `lab`, `haunt`, `potion`.

## Data model

```js
Task = {
  id: string,            // uuid
  title: string,         // required, non-empty
  notes: string,         // optional
  status: "todo"|"doing"|"done",
  priority: "low"|"medium"|"high",
  dueDate: "YYYY-MM-DD" | null,
  tags: string[],        // lowercase, trimmed, deduped
  createdAt: ISO string,
  updatedAt: ISO string
}
```

Storage: `localStorage["frankenboard.v1"] = JSON.stringify({version: 1, tasks})`.

## Sequence diagrams

### Create task (any view)
```
User -> app.js: submit new-task form
app.js -> store.createTask(data)
store -> validate -> assign id/timestamps -> persist -> onChange
app.js -> renderActiveView() (reads store.listTasks())
```

### Drag card Board -> Done
```
User -> board.js: drop card on "Done" column
board.js -> actions.moveTask(id, "done")
store -> validate status -> update + persist -> onChange
app.js -> renderActiveView()  // board re-renders; sheet/calendar would too
```

## Error handling
- Invalid task data: `ValidationError`, shown in the editor panel / toast;
  state unchanged.
- Corrupt storage: caught on load, start empty, show a one-time notice.
- Invalid import file: rejected with visible error, current data kept.
- Drag onto an invalid drop target: no-op.

## Testing strategy
- **Unit tests** (`tests/store.test.js`, `tests/views.test.js`): CRUD, validation,
  filters, sort, persistence round-trip (with a fake storage object), import
  validation.
- **Property tests** (`tests/store.property.test.js`, fast-check): for random
  sequences of operations (create/update/move/delete/setDueDate), assert:
  1. `listTasks().length` equals creates minus deletes;
  2. ids are unique;
  3. every task's status is one of the three values;
  4. re-rendering any view's projection from the store yields the same set.
- **Manual checklist** (in the demo video): create in Sheet → appears on
  Board and Calendar; drag on Board → date unchanged, status changed; drag on
  Calendar → due date changed, status unchanged; reload → everything persists.

## Deployment
Static files on GitHub Pages (`gh api` Pages enable, branch `main`, path `/`).
No server config needed. The app must work from `file://` too (no fetch of
local files — all modules are relative `import` paths, which work over
`http(s)`; for `file://` the page shows a hint to serve it if modules fail).
