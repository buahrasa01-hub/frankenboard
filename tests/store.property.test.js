/**
 * tests/store.property.test.js
 * Property-based tests for the Frankenboard store — no-drift invariants.
 *
 * Covers all five invariants from requirements 6.2 and 10.2:
 *   1. Count conservation
 *   2. Unique ids
 *   3. Valid status on every task
 *   4. State unchanged on failure (failed ops are atomic)
 *   5. View-projection equality (listTasks filter matches unfiltered subset)
 *
 * Every property exercises a fully mixed sequence of createTask / updateTask /
 * moveTask / deleteTask / setDueDate so the invariants are stressed across
 * realistic interleaved operation patterns, not single-operation scenarios.
 *
 * Run with: node --test tests/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { createStore, createMemoryStorage } from '../src/store.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStore() {
  return createStore('prop-test', createMemoryStorage());
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const statusArb   = fc.constantFrom('todo', 'doing', 'done');
const priorityArb = fc.constantFrom('low', 'medium', 'high');

// Titles that survive validatePatch: non-empty after trim
const titleArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter(s => s.trim().length > 0);

// Valid ISO dates or null
const dateArb = fc.oneof(
  fc.constant(null),
  fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(d => d.toISOString().slice(0, 10))
);

// Tags: arrays of lowercase alpha strings (always valid)
const tagArb = fc.array(
  fc.stringMatching(/^[a-z]{1,12}$/),
  { minLength: 0, maxLength: 4 }
);

// A full valid task-creation input
const taskInputArb = fc.record({
  title:    titleArb,
  status:   statusArb,
  priority: priorityArb,
  dueDate:  dateArb,
  tags:     tagArb,
});

// ── Operation model ───────────────────────────────────────────────────────────
//
// Each "op" is a tagged union describing one store mutation.  We pick the
// target task at runtime from a live id pool so operations stay valid even
// after earlier deletes.  When the pool is empty, mutating ops are skipped
// (they would throw "not found" which is intentional, but we want sequences
// that also exercise happy-path mutations).

/** @typedef {{ kind: 'create',  input: object }} CreateOp */
/** @typedef {{ kind: 'update',  patch: object }} UpdateOp */
/** @typedef {{ kind: 'move',    status: string }} MoveOp */
/** @typedef {{ kind: 'delete' }}               DeleteOp */
/** @typedef {{ kind: 'setDate', date: string|null }} SetDateOp */
/** @typedef {CreateOp|UpdateOp|MoveOp|DeleteOp|SetDateOp} Op */

/** @returns {fc.Arbitrary<Op>} */
function opArb() {
  return fc.oneof(
    // create
    fc.record({ kind: fc.constant('create'), input: taskInputArb }),

    // update — patch may be partial; some patches are intentionally invalid to
    // exercise the atomic-failure invariant
    fc.oneof(
      // valid patch
      fc.record({
        kind:  fc.constant('update'),
        patch: fc.record({
          title:    titleArb,
          status:   statusArb,
          priority: priorityArb,
          dueDate:  dateArb,
          tags:     tagArb,
        }),
      }),
      // invalid patch (bad status)
      fc.record({
        kind:  fc.constant('update'),
        patch: fc.record({ status: fc.constant('archived') }),
      }),
      // invalid patch (empty title)
      fc.record({
        kind:  fc.constant('update'),
        patch: fc.record({ title: fc.constant('') }),
      }),
    ),

    // move — sometimes valid, sometimes invalid (exercises atomic failure)
    fc.oneof(
      fc.record({ kind: fc.constant('move'), status: statusArb }),
      fc.record({ kind: fc.constant('move'), status: fc.constant('invalid-status') }),
    ),

    // delete
    fc.record({ kind: fc.constant('delete') }),

    // setDate — sometimes valid, sometimes invalid
    fc.oneof(
      fc.record({ kind: fc.constant('setDate'), date: dateArb }),
      fc.record({ kind: fc.constant('setDate'), date: fc.constant('not-a-date') }),
    ),
  );
}

/**
 * Run a sequence of operations against a store.
 * Returns { created, deleted } counts for counting invariants.
 * Target task is always the last-created live task (index 0 of live pool),
 * which guarantees we exercise mutations on real ids without relying on
 * random index sampling that could collide with already-deleted tasks.
 *
 * @param {object}   store
 * @param {Op[]}     ops
 * @returns {{ created: number, deleted: number }}
 */
function runOps(store, ops) {
  // We maintain an ordered list of live ids so mutating ops always have a
  // valid target.  We deliberately pick `liveIds[idx % liveIds.length]` where
  // idx comes from the op's position, spreading mutations across all live tasks.
  const liveIds = [];
  let created = 0;
  let deleted = 0;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];

    if (op.kind === 'create') {
      const task = store.createTask(op.input);
      liveIds.push(task.id);
      created++;
      continue;
    }

    // All other ops need a live target; skip if store is empty
    if (liveIds.length === 0) continue;

    const targetId = liveIds[i % liveIds.length];

    if (op.kind === 'delete') {
      store.deleteTask(targetId);
      liveIds.splice(liveIds.indexOf(targetId), 1);
      deleted++;
    } else if (op.kind === 'update') {
      try { store.updateTask(targetId, op.patch); } catch { /* expected */ }
    } else if (op.kind === 'move') {
      try { store.moveTask(targetId, op.status); } catch { /* expected */ }
    } else if (op.kind === 'setDate') {
      try { store.setDueDate(targetId, op.date); } catch { /* expected */ }
    }
  }

  return { created, deleted };
}

// ── Invariant 1: Count conservation ──────────────────────────────────────────

describe('property: count conservation', () => {
  it('listTasks length equals creates minus deletes after mixed operation sequences', () => {
    fc.assert(
      fc.property(
        fc.array(opArb(), { minLength: 1, maxLength: 40 }),
        (ops) => {
          const store = makeStore();
          const { created, deleted } = runOps(store, ops);
          return store.listTasks().length === created - deleted;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('count stays correct when all tasks are deleted after interleaved mutations', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 1, maxLength: 20 }),
        fc.array(statusArb, { minLength: 0, maxLength: 20 }),
        (inputs, moves) => {
          const store = makeStore();
          const ids = inputs.map(input => store.createTask(input).id);

          // Interleave some moves
          for (let i = 0; i < moves.length && i < ids.length; i++) {
            store.moveTask(ids[i], moves[i]);
          }

          // Set due dates on even-indexed tasks
          for (let i = 0; i < ids.length; i += 2) {
            store.setDueDate(ids[i], '2026-10-31');
          }

          // Delete all
          for (const id of ids) store.deleteTask(id);

          return store.listTasks().length === 0;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ── Invariant 2: Unique ids ───────────────────────────────────────────────────

describe('property: unique ids', () => {
  it('all task ids remain unique throughout a mixed sequence of creates and mutations', () => {
    fc.assert(
      fc.property(
        fc.array(opArb(), { minLength: 1, maxLength: 50 }),
        (ops) => {
          const store = makeStore();
          runOps(store, ops);
          const ids = store.listTasks().map(t => t.id);
          return ids.length === new Set(ids).size;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ids remain unique after import followed by mixed mutations', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 2, maxLength: 15 }),
        fc.array(opArb(), { minLength: 0, maxLength: 20 }),
        (seedInputs, ops) => {
          const store = makeStore();
          store.importTasks(seedInputs);

          // Apply further ops on top of the imported dataset
          runOps(store, ops);

          const ids = store.listTasks().map(t => t.id);
          return ids.length === new Set(ids).size;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ── Invariant 3: Valid status ─────────────────────────────────────────────────

const VALID_STATUSES = new Set(['todo', 'doing', 'done']);

describe('property: valid status', () => {
  it('every task status stays within todo|doing|done after mixed operations including invalid moves', () => {
    fc.assert(
      fc.property(
        fc.array(opArb(), { minLength: 1, maxLength: 40 }),
        (ops) => {
          const store = makeStore();
          runOps(store, ops);
          return store.listTasks().every(t => VALID_STATUSES.has(t.status));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every task status stays valid after a sequence that alternates create, move, update, and setDueDate', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 1, maxLength: 20 }),
        fc.array(
          fc.record({
            validMove:   statusArb,
            invalidMove: fc.constantFrom('wip', 'blocked', 'archived', 'pending'),
            newDate:     dateArb,
            patch:       fc.record({ priority: priorityArb, tags: tagArb }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (inputs, rounds) => {
          const store = makeStore();
          const ids = inputs.map(inp => store.createTask(inp).id);
          if (ids.length === 0) return true;

          for (let i = 0; i < rounds.length; i++) {
            const id    = ids[i % ids.length];
            const round = rounds[i];

            // valid move
            store.moveTask(id, round.validMove);
            // invalid move should be rejected
            try { store.moveTask(id, round.invalidMove); } catch { /* expected */ }
            // set a due date
            store.setDueDate(id, round.newDate);
            // partial update
            store.updateTask(id, round.patch);
          }

          return store.listTasks().every(t => VALID_STATUSES.has(t.status));
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ── Invariant 4: State unchanged on failure ───────────────────────────────────

describe('property: state unchanged on failure', () => {
  it('a failed updateTask leaves listTasks identical to the snapshot taken before the call', () => {
    fc.assert(
      fc.property(
        // Build up a non-trivial store first
        fc.array(taskInputArb, { minLength: 1, maxLength: 15 }),
        // Then try a bad update patch
        fc.oneof(
          fc.record({ status:   fc.constantFrom('wip', 'blocked', 'archived') }),
          fc.record({ priority: fc.constantFrom('urgent', 'critical') }),
          fc.record({ title:    fc.constant('') }),
          fc.record({ dueDate:  fc.constantFrom('31-12-2026', '2026/12/31', 'today') }),
          fc.record({ tags:     fc.constant('not-an-array') }),
        ),
        (inputs, badPatch) => {
          const store = makeStore();
          const ids   = inputs.map(inp => store.createTask(inp).id);

          // Interleave some valid mutations before the failing call
          for (let i = 0; i < ids.length; i += 3) {
            store.moveTask(ids[i], ['todo', 'doing', 'done'][i % 3]);
          }

          const targetId = ids[Math.floor(ids.length / 2)];
          const before   = JSON.stringify(store.listTasks());

          try { store.updateTask(targetId, badPatch); } catch { /* expected */ }

          return JSON.stringify(store.listTasks()) === before;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('a failed moveTask leaves listTasks identical to the snapshot taken before the call', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 1, maxLength: 15 }),
        fc.constantFrom('wip', 'blocked', 'archived', 'pending', 'cancelled'),
        (inputs, badStatus) => {
          const store = makeStore();
          const ids   = inputs.map(inp => store.createTask(inp).id);

          // Some valid mutations before the failing call
          if (ids.length > 1) {
            store.setDueDate(ids[0], '2026-11-01');
            store.updateTask(ids[ids.length - 1], { priority: 'high' });
          }

          const targetId = ids[0];
          const before   = JSON.stringify(store.listTasks());

          try { store.moveTask(targetId, badStatus); } catch { /* expected */ }

          return JSON.stringify(store.listTasks()) === before;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('a failed setDueDate leaves listTasks identical to the snapshot taken before the call', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 1, maxLength: 15 }),
        fc.constantFrom('31/12/2026', 'next friday', '2026-13-01', 'yesterday', ''),
        (inputs, badDate) => {
          const store = makeStore();
          const ids   = inputs.map(inp => store.createTask(inp).id);

          // Some valid mutations before the failing call
          for (let i = 1; i < ids.length; i += 2) {
            store.moveTask(ids[i], 'doing');
          }

          const targetId = ids[0];
          const before   = JSON.stringify(store.listTasks());

          try { store.setDueDate(targetId, badDate); } catch { /* expected */ }

          return JSON.stringify(store.listTasks()) === before;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('a failed createTask leaves the task count unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 0, maxLength: 10 }),
        fc.oneof(
          fc.record({ title: fc.constant('') }),
          fc.record({ title: fc.constant('   ') }),
          fc.record({ title: fc.constant('ok'), status: fc.constant('not-a-status') }),
          fc.record({ title: fc.constant('ok'), priority: fc.constant('urgent') }),
        ),
        (inputs, badInput) => {
          const store = makeStore();
          inputs.forEach(inp => store.createTask(inp));

          // Some mutations between valid creates and the bad create
          const tasks = store.listTasks();
          if (tasks.length > 0) {
            store.moveTask(tasks[0].id, 'doing');
            store.setDueDate(tasks[0].id, '2026-10-31');
          }

          const beforeCount = store.listTasks().length;
          const beforeSnap  = JSON.stringify(store.listTasks());

          try { store.createTask(badInput); } catch { /* expected */ }

          return (
            store.listTasks().length === beforeCount &&
            JSON.stringify(store.listTasks()) === beforeSnap
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('a failed importTasks call preserves the entire existing task set', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 1, maxLength: 10 }),
        fc.array(
          fc.oneof(
            // mix valid and invalid task objects
            taskInputArb,
            fc.record({ title: fc.constant('') }),
            fc.record({ title: titleArb, status: fc.constant('bogus') }),
          ),
          { minLength: 1, maxLength: 10 }
        ).filter(arr => arr.some(t =>
          typeof t.title !== 'string' ||
          t.title.trim() === '' ||
          (t.status && !VALID_STATUSES.has(t.status))
        )),
        (existingInputs, badImport) => {
          const store = makeStore();
          existingInputs.forEach(inp => store.createTask(inp));

          const before = JSON.stringify(store.listTasks());

          try { store.importTasks(badImport); } catch { /* expected */ }

          return JSON.stringify(store.listTasks()) === before;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ── Invariant 5: View-projection equality ─────────────────────────────────────

describe('property: view-projection equality', () => {
  it('listTasks filtered by status matches the exact subset of listTasks with that status', () => {
    fc.assert(
      fc.property(
        fc.array(opArb(), { minLength: 1, maxLength: 40 }),
        (ops) => {
          const store = makeStore();
          runOps(store, ops);

          const all = store.listTasks();

          for (const status of ['todo', 'doing', 'done']) {
            const projection = store.listTasks({ status });
            const expected   = all.filter(t => t.status === status);

            if (projection.length !== expected.length) return false;

            const projIds = new Set(projection.map(t => t.id));
            const expIds  = new Set(expected.map(t => t.id));

            if (projIds.size !== expIds.size) return false;
            for (const id of expIds) {
              if (!projIds.has(id)) return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('listTasks filtered by priority matches the exact subset of listTasks with that priority', () => {
    fc.assert(
      fc.property(
        fc.array(opArb(), { minLength: 1, maxLength: 40 }),
        (ops) => {
          const store = makeStore();
          runOps(store, ops);

          const all = store.listTasks();

          for (const priority of ['low', 'medium', 'high']) {
            const projection = store.listTasks({ priority });
            const expected   = all.filter(t => t.priority === priority);

            if (projection.length !== expected.length) return false;

            const projIds = new Set(projection.map(t => t.id));
            for (const t of expected) {
              if (!projIds.has(t.id)) return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the union of all three status projections equals the full unfiltered task list', () => {
    fc.assert(
      fc.property(
        fc.array(opArb(), { minLength: 1, maxLength: 40 }),
        (ops) => {
          const store = makeStore();
          runOps(store, ops);

          const all = store.listTasks();
          const allIds = new Set(all.map(t => t.id));

          const unionIds = new Set([
            ...store.listTasks({ status: 'todo'  }).map(t => t.id),
            ...store.listTasks({ status: 'doing' }).map(t => t.id),
            ...store.listTasks({ status: 'done'  }).map(t => t.id),
          ]);

          if (unionIds.size !== allIds.size) return false;
          for (const id of allIds) {
            if (!unionIds.has(id)) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no task appears in more than one status projection simultaneously', () => {
    fc.assert(
      fc.property(
        fc.array(opArb(), { minLength: 1, maxLength: 40 }),
        (ops) => {
          const store = makeStore();
          runOps(store, ops);

          const todoIds  = new Set(store.listTasks({ status: 'todo'  }).map(t => t.id));
          const doingIds = new Set(store.listTasks({ status: 'doing' }).map(t => t.id));
          const doneIds  = new Set(store.listTasks({ status: 'done'  }).map(t => t.id));

          // Pairwise intersection must be empty
          for (const id of todoIds) {
            if (doingIds.has(id) || doneIds.has(id)) return false;
          }
          for (const id of doingIds) {
            if (doneIds.has(id)) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('projections remain consistent immediately after a mutation without an intermediate listTasks call', () => {
    fc.assert(
      fc.property(
        fc.array(taskInputArb, { minLength: 2, maxLength: 15 }),
        fc.array(
          fc.record({
            opKind: fc.constantFrom('move', 'update', 'setDate', 'create'),
            status: statusArb,
            date:   dateArb,
            title:  titleArb,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (inputs, rounds) => {
          const store = makeStore();
          const ids   = inputs.map(inp => store.createTask(inp).id);

          for (let i = 0; i < rounds.length; i++) {
            const round    = rounds[i];
            const targetId = ids[i % ids.length];

            if (round.opKind === 'create') {
              const task = store.createTask({ title: round.title });
              ids.push(task.id);
            } else if (round.opKind === 'move') {
              store.moveTask(targetId, round.status);
            } else if (round.opKind === 'update') {
              store.updateTask(targetId, { status: round.status });
            } else if (round.opKind === 'setDate') {
              store.setDueDate(targetId, round.date);
            }

            // Immediately check projections (no extra listTasks in between)
            const all = store.listTasks();
            for (const status of ['todo', 'doing', 'done']) {
              const projection = store.listTasks({ status });
              const expected   = all.filter(t => t.status === status);
              if (projection.length !== expected.length) return false;
              const projSet = new Set(projection.map(t => t.id));
              for (const t of expected) {
                if (!projSet.has(t.id)) return false;
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
