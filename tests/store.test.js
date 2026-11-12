/**
 * tests/store.test.js
 * Unit tests for src/store.js using Node built-in test runner.
 *
 * Run with: node --test tests/
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createStore,
  createMemoryStorage,
  validatePatch,
  ValidationError,
} from '../src/store.js';

import { seedTasks } from '../src/seed.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStore() {
  return createStore('test.v1', createMemoryStorage());
}

// ── validatePatch ────────────────────────────────────────────────────────────

describe('validatePatch', () => {
  it('passes a valid full patch', () => {
    const patch = {
      title: '  Hello  ',
      notes: 'Some notes',
      status: 'doing',
      priority: 'high',
      dueDate: '2026-11-12',
      tags: ['lab', 'Lab', ' potion '],
    };
    const out = validatePatch(patch);
    assert.equal(out.title, 'Hello');
    assert.equal(out.status, 'doing');
    assert.equal(out.priority, 'high');
    assert.equal(out.dueDate, '2026-11-12');
    // Tags normalised, deduped
    assert.deepEqual(out.tags, ['lab', 'potion']);
  });

  it('rejects empty title', () => {
    assert.throws(() => validatePatch({ title: '  ' }), ValidationError);
  });

  it('rejects non-string title', () => {
    assert.throws(() => validatePatch({ title: 42 }), ValidationError);
  });

  it('rejects invalid status', () => {
    assert.throws(() => validatePatch({ status: 'pending' }), ValidationError);
  });

  it('rejects invalid priority', () => {
    assert.throws(() => validatePatch({ priority: 'urgent' }), ValidationError);
  });

  it('rejects bad dueDate format', () => {
    assert.throws(() => validatePatch({ dueDate: '12-11-2026' }), ValidationError);
  });

  it('rejects impossible date (Feb 30)', () => {
    assert.throws(() => validatePatch({ dueDate: '2026-02-30' }), ValidationError);
  });

  it('accepts null dueDate', () => {
    const out = validatePatch({ dueDate: null });
    assert.equal(out.dueDate, null);
  });

  it('rejects non-array tags', () => {
    assert.throws(() => validatePatch({ tags: 'lab' }), ValidationError);
  });

  it('rejects non-string tag elements', () => {
    assert.throws(() => validatePatch({ tags: [1, 2] }), ValidationError);
  });

  it('allows partial patch (only title)', () => {
    const out = validatePatch({ title: 'Only title' });
    assert.equal(out.title, 'Only title');
    assert.equal('status' in out, false);
  });
});

// ── createTask ───────────────────────────────────────────────────────────────

describe('store.createTask', () => {
  it('creates a task with defaults', () => {
    const store = makeStore();
    const task  = store.createTask({ title: 'Test task' });

    assert.ok(task.id, 'has id');
    assert.equal(task.title, 'Test task');
    assert.equal(task.status, 'todo');
    assert.equal(task.priority, 'medium');
    assert.equal(task.dueDate, null);
    assert.deepEqual(task.tags, []);
    assert.ok(task.createdAt, 'has createdAt');
    assert.ok(task.updatedAt, 'has updatedAt');
  });

  it('assigns unique ids to two tasks', () => {
    const store = makeStore();
    const a = store.createTask({ title: 'A' });
    const b = store.createTask({ title: 'B' });
    assert.notEqual(a.id, b.id);
  });

  it('throws ValidationError for empty title', () => {
    const store = makeStore();
    assert.throws(() => store.createTask({ title: '' }), ValidationError);
  });

  it('throws ValidationError for missing title', () => {
    const store = makeStore();
    assert.throws(() => store.createTask({}), ValidationError);
  });

  it('does not add task to store on validation failure', () => {
    const store = makeStore();
    try { store.createTask({ title: '' }); } catch {}
    assert.equal(store.listTasks().length, 0);
  });

  it('stores the task in listTasks', () => {
    const store = makeStore();
    store.createTask({ title: 'Stored' });
    assert.equal(store.listTasks().length, 1);
  });

  it('accepts all optional fields', () => {
    const store = makeStore();
    const task  = store.createTask({
      title: 'Full task',
      notes: 'Notes here',
      status: 'doing',
      priority: 'high',
      dueDate: '2026-12-01',
      tags: ['alpha', 'beta'],
    });
    assert.equal(task.notes, 'Notes here');
    assert.equal(task.status, 'doing');
    assert.equal(task.priority, 'high');
    assert.equal(task.dueDate, '2026-12-01');
    assert.deepEqual(task.tags, ['alpha', 'beta']);
  });
});

// ── updateTask ───────────────────────────────────────────────────────────────

describe('store.updateTask', () => {
  it('updates specified fields', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'Original' });
    const updated = store.updateTask(id, { title: 'Updated', status: 'done' });
    assert.equal(updated.title, 'Updated');
    assert.equal(updated.status, 'done');
  });

  it('refreshes updatedAt on update', () => {
    const store = makeStore();
    const { id, updatedAt: before } = store.createTask({ title: 'T' });
    // Small sleep to ensure timestamp differs
    const updated = store.updateTask(id, { title: 'T2' });
    assert.ok(updated.updatedAt >= before);
  });

  it('does not mutate state on validation failure', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'Safe' });
    try { store.updateTask(id, { status: 'invalid-status' }); } catch {}
    const task = store.getTask(id);
    assert.equal(task.title, 'Safe');
    assert.equal(task.status, 'todo');
  });

  it('throws for unknown id', () => {
    const store = makeStore();
    assert.throws(() => store.updateTask('no-such-id', { title: 'X' }));
  });

  it('leaves other tasks untouched', () => {
    const store = makeStore();
    const a = store.createTask({ title: 'A' });
    store.createTask({ title: 'B' });
    store.updateTask(a.id, { title: 'A modified' });
    const tasks = store.listTasks();
    assert.equal(tasks.find(t => t.title === 'B')?.title, 'B');
  });
});

// ── deleteTask ───────────────────────────────────────────────────────────────

describe('store.deleteTask', () => {
  it('removes the task', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'To delete' });
    store.deleteTask(id);
    assert.equal(store.listTasks().length, 0);
    assert.equal(store.getTask(id), undefined);
  });

  it('leaves other tasks intact', () => {
    const store = makeStore();
    store.createTask({ title: 'Keep A' });
    const { id } = store.createTask({ title: 'Delete' });
    store.createTask({ title: 'Keep B' });
    store.deleteTask(id);
    const tasks = store.listTasks();
    assert.equal(tasks.length, 2);
    assert.ok(tasks.every(t => t.id !== id));
  });

  it('throws for unknown id', () => {
    const store = makeStore();
    assert.throws(() => store.deleteTask('no-such-id'));
  });
});

// ── moveTask ─────────────────────────────────────────────────────────────────

describe('store.moveTask', () => {
  it('changes status and refreshes updatedAt', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'Move me' });
    const moved  = store.moveTask(id, 'done');
    assert.equal(moved.status, 'done');
    assert.ok(moved.updatedAt);
  });

  it('throws ValidationError for invalid status', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'T' });
    assert.throws(() => store.moveTask(id, 'archived'), ValidationError);
  });
});

// ── setDueDate ───────────────────────────────────────────────────────────────

describe('store.setDueDate', () => {
  it('sets a valid due date', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'T' });
    store.setDueDate(id, '2027-01-15');
    assert.equal(store.getTask(id).dueDate, '2027-01-15');
  });

  it('clears due date with null', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'T', dueDate: '2027-01-15' });
    store.setDueDate(id, null);
    assert.equal(store.getTask(id).dueDate, null);
  });

  it('rejects invalid date format', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'T' });
    assert.throws(() => store.setDueDate(id, '01/15/2027'), ValidationError);
  });
});

// ── listTasks with filter ─────────────────────────────────────────────────────

describe('store.listTasks (filter)', () => {
  it('filters by status', () => {
    const store = makeStore();
    store.createTask({ title: 'A', status: 'todo'  });
    store.createTask({ title: 'B', status: 'doing' });
    store.createTask({ title: 'C', status: 'done'  });
    const doing = store.listTasks({ status: 'doing' });
    assert.equal(doing.length, 1);
    assert.equal(doing[0].title, 'B');
  });

  it('filters by priority', () => {
    const store = makeStore();
    store.createTask({ title: 'Lo', priority: 'low'  });
    store.createTask({ title: 'Hi', priority: 'high' });
    const high = store.listTasks({ priority: 'high' });
    assert.equal(high.length, 1);
    assert.equal(high[0].title, 'Hi');
  });
});

// ── Persistence round-trip ───────────────────────────────────────────────────

describe('persistence round-trip', () => {
  it('restores tasks from storage', () => {
    const mem = createMemoryStorage();
    const s1  = createStore('key', mem);
    s1.createTask({ title: 'Persistent' });

    const s2 = createStore('key', mem);
    const tasks = s2.listTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Persistent');
  });

  it('starts empty when storage key is missing', () => {
    const store = createStore('fresh-key', createMemoryStorage());
    assert.equal(store.listTasks().length, 0);
  });

  it('falls back to empty list on corrupt JSON', () => {
    const mem = createMemoryStorage();
    mem.setItem('corrupt-key', '{{not valid json}}');
    const store = createStore('corrupt-key', mem);
    assert.equal(store.listTasks().length, 0);
  });

  it('falls back when version is wrong', () => {
    const mem = createMemoryStorage();
    mem.setItem('v-key', JSON.stringify({ version: 99, tasks: [{ id: 'x', title: 'Old' }] }));
    const store = createStore('v-key', mem);
    assert.equal(store.listTasks().length, 0);
  });

  it('falls back when tasks field is not an array', () => {
    const mem = createMemoryStorage();
    mem.setItem('bad-key', JSON.stringify({ version: 1, tasks: null }));
    const store = createStore('bad-key', mem);
    assert.equal(store.listTasks().length, 0);
  });
});

// ── importTasks ──────────────────────────────────────────────────────────────

describe('store.importTasks', () => {
  it('replaces tasks with valid import', () => {
    const store = makeStore();
    store.createTask({ title: 'Original' });
    store.importTasks([{ title: 'Imported', status: 'done' }]);
    const tasks = store.listTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Imported');
  });

  it('throws and keeps original data on invalid array item', () => {
    const store = makeStore();
    store.createTask({ title: 'Keep me' });
    assert.throws(() => store.importTasks([{ title: '' }]), ValidationError);
    assert.equal(store.listTasks().length, 1);
    assert.equal(store.listTasks()[0].title, 'Keep me');
  });

  it('throws for non-array argument', () => {
    const store = makeStore();
    assert.throws(() => store.importTasks('not an array'), ValidationError);
  });

  it('deduplicates ids (last wins)', () => {
    const store = makeStore();
    store.importTasks([
      { id: 'dup', title: 'First',  status: 'todo' },
      { id: 'dup', title: 'Second', status: 'done' },
    ]);
    const tasks = store.listTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Second');
  });
});

// ── exportTasks ──────────────────────────────────────────────────────────────

describe('store.exportTasks', () => {
  it('returns valid JSON containing all tasks', () => {
    const store = makeStore();
    store.createTask({ title: 'Export me' });
    const json = store.exportTasks();
    const parsed = JSON.parse(json);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.tasks[0].title, 'Export me');
  });

  it('returns empty tasks array when store is empty', () => {
    const store = makeStore();
    const parsed = JSON.parse(store.exportTasks());
    assert.deepEqual(parsed.tasks, []);
  });
});

// ── clearAll ─────────────────────────────────────────────────────────────────

describe('store.clearAll', () => {
  it('removes all tasks', () => {
    const store = makeStore();
    store.createTask({ title: 'A' });
    store.createTask({ title: 'B' });
    store.clearAll();
    assert.equal(store.listTasks().length, 0);
  });
});

// ── onChange subscription ────────────────────────────────────────────────────

describe('store.onChange', () => {
  it('fires after createTask', () => {
    const store = makeStore();
    let callCount = 0;
    store.onChange(() => { callCount++; });
    store.createTask({ title: 'T' });
    assert.equal(callCount, 1);
  });

  it('fires after updateTask', () => {
    const store = makeStore();
    let callCount = 0;
    const { id } = store.createTask({ title: 'T' });
    store.onChange(() => { callCount++; });
    store.updateTask(id, { title: 'T2' });
    assert.equal(callCount, 1);
  });

  it('fires after deleteTask', () => {
    const store = makeStore();
    let callCount = 0;
    const { id } = store.createTask({ title: 'T' });
    store.onChange(() => { callCount++; });
    store.deleteTask(id);
    assert.equal(callCount, 1);
  });

  it('does NOT fire when mutation throws', () => {
    const store = makeStore();
    let callCount = 0;
    store.onChange(() => { callCount++; });
    try { store.createTask({ title: '' }); } catch {}
    assert.equal(callCount, 0);
  });

  it('unsubscribe stops receiving events', () => {
    const store = makeStore();
    let callCount = 0;
    const unsub = store.onChange(() => { callCount++; });
    store.createTask({ title: 'First' });
    unsub();
    store.createTask({ title: 'Second' });
    assert.equal(callCount, 1);
  });
});

// ── getTask ───────────────────────────────────────────────────────────────────

describe('store.getTask', () => {
  it('returns the task for a known id', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'Find me' });
    const task = store.getTask(id);
    assert.ok(task);
    assert.equal(task.id, id);
    assert.equal(task.title, 'Find me');
  });

  it('returns undefined for an unknown id', () => {
    const store = makeStore();
    assert.equal(store.getTask('no-such-id'), undefined);
  });

  it('returns undefined after the task has been deleted', () => {
    const store = makeStore();
    const { id } = store.createTask({ title: 'Gone' });
    store.deleteTask(id);
    assert.equal(store.getTask(id), undefined);
  });
});

// ── importTasks (validation edge cases) ──────────────────────────────────────

describe('store.importTasks (validation edge cases)', () => {
  it('throws and preserves data when a task has an invalid status', () => {
    const store = makeStore();
    store.createTask({ title: 'Keep me' });
    assert.throws(
      () => store.importTasks([{ title: 'Bad', status: 'archived' }]),
      ValidationError
    );
    assert.equal(store.listTasks().length, 1);
    assert.equal(store.listTasks()[0].title, 'Keep me');
  });

  it('throws and preserves data when a task has an invalid priority', () => {
    const store = makeStore();
    store.createTask({ title: 'Keep me' });
    assert.throws(
      () => store.importTasks([{ title: 'Bad', priority: 'urgent' }]),
      ValidationError
    );
    assert.equal(store.listTasks()[0].title, 'Keep me');
  });

  it('throws and preserves data when a task has an invalid dueDate', () => {
    const store = makeStore();
    store.createTask({ title: 'Keep me' });
    assert.throws(
      () => store.importTasks([{ title: 'Bad', dueDate: '12/31/2026' }]),
      ValidationError
    );
    assert.equal(store.listTasks()[0].title, 'Keep me');
  });
});

// ── createMemoryStorage ───────────────────────────────────────────────────────

describe('createMemoryStorage', () => {
  it('returns null for a key that was never set', () => {
    const mem = createMemoryStorage();
    assert.equal(mem.getItem('missing'), null);
  });

  it('round-trips a string value via setItem / getItem', () => {
    const mem = createMemoryStorage();
    mem.setItem('k', 'hello');
    assert.equal(mem.getItem('k'), 'hello');
  });

  it('removes a key with removeItem', () => {
    const mem = createMemoryStorage();
    mem.setItem('k', 'v');
    mem.removeItem('k');
    assert.equal(mem.getItem('k'), null);
  });

  it('clears all keys with clear', () => {
    const mem = createMemoryStorage();
    mem.setItem('a', '1');
    mem.setItem('b', '2');
    mem.clear();
    assert.equal(mem.getItem('a'), null);
    assert.equal(mem.getItem('b'), null);
  });
});

// ── seedTasks (src/seed.js) ───────────────────────────────────────────────────

describe('seedTasks', () => {
  it('returns exactly 10 tasks', () => {
    assert.equal(seedTasks().length, 10);
  });

  it('every task has a non-empty title string', () => {
    for (const t of seedTasks()) {
      assert.ok(
        typeof t.title === 'string' && t.title.trim().length > 0,
        `expected non-empty title, got: ${JSON.stringify(t.title)}`
      );
    }
  });

  it('every task status is one of todo|doing|done', () => {
    const valid = new Set(['todo', 'doing', 'done']);
    for (const t of seedTasks()) {
      assert.ok(valid.has(t.status), `unexpected status: ${t.status}`);
    }
  });

  it('every task priority is one of low|medium|high', () => {
    const valid = new Set(['low', 'medium', 'high']);
    for (const t of seedTasks()) {
      assert.ok(valid.has(t.priority), `unexpected priority: ${t.priority}`);
    }
  });

  it('dueDate is null or a valid YYYY-MM-DD string on every task', () => {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const t of seedTasks()) {
      if (t.dueDate !== null) {
        assert.match(t.dueDate, dateRe);
      }
    }
  });

  it('tags is an array of strings on every task', () => {
    for (const t of seedTasks()) {
      assert.ok(Array.isArray(t.tags));
      for (const tag of t.tags) {
        assert.equal(typeof tag, 'string');
      }
    }
  });

  it('all 10 tasks are importable by the store without errors', () => {
    const store = makeStore();
    assert.doesNotThrow(() => store.importTasks(seedTasks()));
    assert.equal(store.listTasks().length, 10);
  });
});
