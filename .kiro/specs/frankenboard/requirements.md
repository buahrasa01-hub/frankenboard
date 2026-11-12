# Requirements — Frankenboard

## Introduction
Frankenboard is a local-first task manager that stitches three incompatible
faces — a spreadsheet, a kanban board, and a calendar — onto one task dataset.
It is built for Kiroween 2026 (Frankenstein category). It runs entirely in the
browser with zero runtime dependencies and zero network calls.

## Glossary
- **Task**: one unit of work with id, title, notes, status, priority, due date,
  tags, createdAt, updatedAt.
- **Face / view**: one of Sheet, Board, Calendar — three renderings of the same
  dataset.
- **Store**: the single module that owns task data, validation, persistence,
  and the no-drift invariants.
- **Drift**: any state where two views disagree about a task (duplicated, lost,
  or stale).

## Requirements

### Requirement 1: Single task store
**User Story:** As a user, I want one place where my tasks live, so that no
matter which view I use, I always see the same tasks.

#### Acceptance Criteria
1. WHEN a task is created in any view THEN the Store SHALL persist it under
   the versioned key `frankenboard.v1` in localStorage.
2. WHEN the page reloads THEN the Store SHALL restore exactly the tasks that
   were persisted, with no additions, losses, or reordering surprises.
3. WHEN the stored data is missing or corrupt THEN the Store SHALL start with
   an empty task list and SHALL NOT throw.
4. WHEN a task is updated or deleted THEN the Store SHALL write the change
   immediately (no save button).

### Requirement 2: Task CRUD
**User Story:** As a user, I want to create, edit, and delete tasks, so that I
can manage my work.

#### Acceptance Criteria
1. WHEN I create a task THEN the Store SHALL assign it a unique id and
   `createdAt`/`updatedAt` timestamps and a default status of `todo`.
2. WHEN I edit a task's title, notes, status, priority, due date, or tags
   THEN the Store SHALL validate the values (status in `todo|doing|done`,
   priority in `low|medium|high`, dueDate a valid `YYYY-MM-DD` or null) and
   reject invalid values without mutating state.
3. WHEN I delete a task THEN the Store SHALL remove it from every view at once.
4. WHEN I change a task's status THEN its `updatedAt` SHALL be refreshed.

### Requirement 3: Sheet view
**User Story:** As a user, I want a spreadsheet grid of my tasks, so that I can
scan, sort, filter, and edit many tasks quickly.

#### Acceptance Criteria
1. WHEN the Sheet view is active THEN the System SHALL render one row per task
   with columns Title, Status, Priority, Due date, Tags.
2. WHEN I click a Title, Status, Priority, Due date, or Tags cell THEN the
   System SHALL allow inline editing of that field.
3. WHEN I type in the search box THEN the System SHALL filter rows by title,
   notes, and tags (case-insensitive substring).
4. WHEN I choose a status/priority filter THEN the System SHALL show only
   matching rows.
5. WHEN I click a column header THEN the System SHALL sort by that column
   (ascending, then descending on second click).

### Requirement 4: Board view
**User Story:** As a user, I want a kanban board, so that I can see flow and
drag tasks between To do, Doing, and Done.

#### Acceptance Criteria
1. WHEN the Board view is active THEN the System SHALL render three columns
   (To do, Doing, Done) with one card per task in its status column.
2. WHEN I drag a card to another column THEN the System SHALL update the
   task's status and re-render all views consistently.
3. WHEN drag-and-drop is unavailable (keyboard/touch) THEN I SHALL be able to
   change a task's status from its editor panel instead.
4. WHEN a column is empty THEN the System SHALL show an empty-state message
   (not a broken layout).

### Requirement 5: Calendar view
**User Story:** As a user, I want a month calendar of due dates, so that I can
see what is due when and reschedule by dragging.

#### Acceptance Criteria
1. WHEN the Calendar view is active THEN the System SHALL render the current
   month grid with tasks placed on their due-date cells.
2. WHEN I navigate to the previous/next month THEN the System SHALL render
   that month with the same tasks placed correctly.
3. WHEN I drag a task to another day THEN the System SHALL update its due date.
4. WHEN I click an empty day THEN the System SHALL offer to create a task due
   that day.
5. WHEN a task has no due date THEN the System SHALL list it in an "Undated"
   strip below the grid, from which it can be dragged onto a day.

### Requirement 6: No drift between views (the core invariant)
**User Story:** As a user, I want every view to always agree, so that I never
have to wonder which copy of a task is real.

#### Acceptance Criteria
1. WHEN any mutation happens in any view THEN all three views SHALL reflect
   the same task set within the same render cycle.
2. WHEN a task is moved, edited, or deleted THEN the total task count SHALL
   stay correct (no duplicates, no silent losses) — verified by property
   tests over random operation sequences.
3. WHEN the same task is edited in two views in sequence THEN the last write
   SHALL win and both views SHALL show the final value.

### Requirement 7: Import / export / seed
**User Story:** As a user, I want to back up my tasks and to see a lively demo
immediately, so that I can trust the app and try it fast.

#### Acceptance Criteria
1. WHEN I click Export THEN the System SHALL download a JSON file containing
   all tasks.
2. WHEN I import a JSON file THEN the System SHALL validate it (array of
   tasks with required fields) and replace the current task list only if
   valid; invalid files SHALL be rejected with a visible error and no data
   loss.
3. WHEN I click "Load demo data" THEN the System SHALL populate 10 varied
   tasks (across statuses, priorities, due dates, tags) so all three views
   are visibly alive.

### Requirement 8: Keyboard shortcuts and editor panel
**User Story:** As a user, I want keyboard shortcuts and one editor panel, so
that I can work fast without the mouse.

#### Acceptance Criteria
1. WHEN I press `n` THEN a new-task editor SHALL open.
2. WHEN I press `/` THEN the search box SHALL focus.
3. WHEN I press `1`, `2`, or `3` THEN the Sheet, Board, or Calendar view
   SHALL activate.
4. WHEN I click a task in any view THEN an editor panel SHALL open showing
   all fields, editable in place.

### Requirement 9: Stitched-monster design
**User Story:** As a user, I want the app to look like a stitched-together
monster, so that the Frankenstein theme is unmistakable.

#### Acceptance Criteria
1. WHEN the app loads THEN panels SHALL show dashed "stitch" borders, bolt
   accents, and the graveyard palette (near-black, bone, monster green,
   bruise purple).
2. WHEN viewed on a phone-sized screen THEN the layout SHALL remain usable
   (views stack, no horizontal overflow of the page).
3. WHEN JavaScript is disabled THEN the page SHALL show a clear message
   explaining that JavaScript is required.

### Requirement 10: Tests
**User Story:** As a developer, I want automated tests, so that the no-drift
invariant is proven, not just claimed.

#### Acceptance Criteria
1. WHEN `npm test` runs THEN all unit tests and property tests SHALL pass.
2. WHEN random sequences of create/update/move/delete operations are applied
   THEN property tests SHALL assert: task count is conserved, no duplicate
   ids exist, and every view's projection equals the store's task list.
3. WHEN a source file is saved during a Kiro session THEN the test-on-save
   hook SHALL run `npm test`.
