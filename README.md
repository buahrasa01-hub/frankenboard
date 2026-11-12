# Frankenboard 🧟

**One dataset, three incompatible faces — stitched into one app.**

Frankenboard is a local-first task manager that takes three tools that were never
meant to live together — a **spreadsheet**, a **kanban board**, and a **calendar** —
and stitches them into a single monster. Every task you create exists in all three
faces at once: edit a cell in the sheet and the card moves on the board; drag a
card and the calendar date follows. Nothing is duplicated, nothing is lost — the
seams are visible on purpose.

Built with [Kiro](https://kiro.dev) (CLI, spec-driven development) for
**Kiroween 2026 — Frankenstein category**.

## Live demo

https://buahrasa01-hub.github.io/frankenboard/

## Features

- **Sheet view** — spreadsheet-style grid: inline cell editing, sort, filter by
  status / priority / tag, search.
- **Board view** — kanban columns (To do / Doing / Done) with drag-and-drop.
- **Calendar view** — month grid by due date; drag tasks between days, click a
  day to set a due date.
- **One store** — a single versioned task store; all three views read and write
  the same data. Moving a task in any view can never duplicate or lose it.
- **Local-first** — all data lives in your browser (`localStorage`). No account,
  no server, no tracking. Import/export JSON any time.
- **Stitched design** — visible seams, bolts and a graveyard palette. The
  monster look is the point.

## Run it

No build step, no dependencies at runtime. Open `index.html` in a browser, or
serve the folder:

```sh
npx serve .
# or
python3 -m http.server
```

## Tests

```sh
npm install   # fast-check only, devDependency for property-based tests
npm test      # node --test: unit + property tests (store invariants)
```

Property-based tests (fast-check) verify the store invariants, e.g. a task moved
between views is never duplicated or lost, and status transitions are consistent
across all three views.

## How it was built (Kiro)

This project was built spec-first with Kiro CLI:

- `.kiro/specs/frankenboard/requirements.md` — user stories + acceptance criteria
- `.kiro/specs/frankenboard/design.md` — architecture, data model, view contracts
- `.kiro/specs/frankenboard/tasks.md` — discrete implementation tasks, executed
  by Kiro CLI (`kiro-cli chat --no-interactive`)
- `.kiro/steering/` — product, tech and structure guidance loaded in every
  Kiro session
- `.kiro/hooks/test-on-save.json` — runs the test suite whenever Kiro saves a
  source file
- `.kiro/agents/test-writer.md` — custom agent that writes tests for new code
- MCP: fetch server configured in `.kiro/settings/mcp.json`, used to pull
  reference docs during the build

See the Devpost write-up for the full story of how Kiro was used.

## License

MIT — see [LICENSE](LICENSE).
