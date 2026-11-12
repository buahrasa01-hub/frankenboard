/**
 * tests/store.property.test.js
 * Property-based tests for the Frankenboard store (no-drift invariant).
 *
 * Uses fast-check for random operation sequences.
 * Full implementation: task 9.
 * Stub: basic sanity checks that pass for tasks 1-2.
 *
 * Run with: node --test tests/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { createStore, createMemoryStorage } from '../src/store.js';

function makeStore() {
  return createStore('prop-test', createMemoryStorage());
}

// ── Arbitraries ──────────────────────────────────────────────────────────────

const statusArb   = fc.constantFrom('todo', 'doing', 'done');
const priorityArb = fc.constantFrom('low', 'medium', 'high');
const titleArb    = fc.string({ minLength: 1, maxLength: 60 }).filter(s => s.trim().length > 0);
const dateArb     = fc.oneof(
  fc.constant(null),
  fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).map(d => d.toISOString().slice(0, 10))
);
const tagArb      = fc.array(
  fc.stringMatching(/^[a-z]{1,12}$/),
  { minLength: 0, maxLength: 4 }
);

const taskInputArb = fc.record({
  title:    titleArb,
  status:   statusArb,
  priority: priorityArb,
  dueDate:  dateArb,
  tags:     tagArb,
});

// ── Property: count conservation ─────────────────────────────────────────────

describe('property: count conservation', () => {
  it('creates minus deletes equals final count', () => {
    fc.assert(fc.property(
      fc.array(taskInputArb, { minLength: 0, maxLength: 20 }),
      (inputs) => {
        const store = makeStore();
        for (const input of inputs) {
          store.createTask(input);
        }
        const all    = store.listTasks();
        const count  = all.length;

        // Delete every other task
        let deleted = 0;
        for (let i = 0; i < all.length; i += 2) {
          store.deleteTask(all[i].id);
          deleted++;
        }

        const remaining = store.listTasks().length;
        return remaining === count - deleted;
      }
    ), { numRuns: 50 });
  });
});

// ── Property: unique ids ──────────────────────────────────────────────────────

describe('property: unique ids', () => {
  it('all task ids are unique after N creates', () => {
    fc.assert(fc.property(
      fc.array(taskInputArb, { minLength: 1, maxLength: 30 }),
      (inputs) => {
        const store = makeStore();
        for (const input of inputs) {
          store.createTask(input);
        }
        const ids = store.listTasks().map(t => t.id);
        return ids.length === new Set(ids).size;
      }
    ), { numRuns: 50 });
  });
});

// ── Property: valid statuses ──────────────────────────────────────────────────

describe('property: valid statuses after moves', () => {
  it('every task status is one of todo|doing|done after random moves', () => {
    const validStatuses = new Set(['todo', 'doing', 'done']);

    fc.assert(fc.property(
      fc.array(taskInputArb, { minLength: 1, maxLength: 20 }),
      fc.array(statusArb, { minLength: 0, maxLength: 20 }),
      (inputs, moveStatuses) => {
        const store = makeStore();
        for (const input of inputs) {
          store.createTask(input);
        }

        const tasks = store.listTasks();
        for (let i = 0; i < moveStatuses.length && i < tasks.length; i++) {
          store.moveTask(tasks[i].id, moveStatuses[i]);
        }

        return store.listTasks().every(t => validStatuses.has(t.status));
      }
    ), { numRuns: 50 });
  });
});

// ── Property: state unchanged on validation failure ───────────────────────────

describe('property: state unchanged on bad update', () => {
  it('invalid updateTask does not mutate the store', () => {
    fc.assert(fc.property(
      taskInputArb,
      (input) => {
        const store = makeStore();
        const task  = store.createTask(input);
        const before = JSON.stringify(store.listTasks());

        try {
          store.updateTask(task.id, { status: 'not-a-status' });
        } catch {}

        const after = JSON.stringify(store.listTasks());
        return before === after;
      }
    ), { numRuns: 50 });
  });
});

// ── Property: listTasks projection equals store ───────────────────────────────

describe('property: listTasks projection equality', () => {
  it('listTasks() after mixed ops contains exactly all surviving tasks', () => {
    fc.assert(fc.property(
      fc.array(taskInputArb, { minLength: 2, maxLength: 25 }),
      fc.array(fc.nat({ max: 24 }), { minLength: 0, maxLength: 15 }),
      (inputs, deleteIdxs) => {
        const store   = makeStore();
        const created = [];

        for (const input of inputs) {
          created.push(store.createTask(input));
        }

        const toDelete = new Set(
          deleteIdxs
            .map(i => created[i % created.length]?.id)
            .filter(Boolean)
        );

        for (const id of toDelete) {
          store.deleteTask(id);
        }

        const finalIds  = new Set(store.listTasks().map(t => t.id));
        const expectIds = new Set(created.map(t => t.id).filter(id => !toDelete.has(id)));

        // Same size and same content
        if (finalIds.size !== expectIds.size) return false;
        for (const id of expectIds) {
          if (!finalIds.has(id)) return false;
        }
        return true;
      }
    ), { numRuns: 50 });
  });
});
