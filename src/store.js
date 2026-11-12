/**
 * src/store.js
 * Frankenboard — single task store.
 *
 * Pure functions over an in-memory array + localStorage persistence.
 * No DOM code. All mutations fire onChange subscribers.
 *
 * Requirements: 1.1–1.4, 2.1–2.4
 */

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES   = /** @type {const} */ (['todo', 'doing', 'done']);
const VALID_PRIORITIES = /** @type {const} */ (['low', 'medium', 'high']);
const STORAGE_VERSION  = 1;

// ── Errors ───────────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {string} [field]
   */
  constructor(message, field) {
    super(message);
    this.name  = 'ValidationError';
    this.field = field;
  }
}

// ── ID generation ─────────────────────────────────────────────────────────────

let _idCounter = 0;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + counter + random
  _idCounter += 1;
  return `${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a YYYY-MM-DD date string.
 * @param {string} date
 * @returns {boolean}
 */
function isValidISODate(date) {
  if (typeof date !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  // Parse as UTC midnight so the round-trip is timezone-independent.
  // Local midnight (no 'Z') shifts to previous day in UTC+ zones, breaking
  // the slice(0,10) comparison (e.g. in UTC+7, 2026-11-12T00:00:00 local
  // becomes 2026-11-11T17:00:00Z → toISOString returns "2026-11-11").
  const d = new Date(date + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  // Round-trip check (catches Feb 30 etc.)
  return d.toISOString().slice(0, 10) === date;
}

/**
 * Validate and normalise a full task patch.
 * Throws ValidationError on the first bad field.
 *
 * @param {object} patch — may contain any subset of task fields
 * @returns {object} — normalised copy of the patch
 */
export function validatePatch(patch) {
  const out = {};

  if ('title' in patch) {
    const title = patch.title;
    if (typeof title !== 'string' || title.trim() === '') {
      throw new ValidationError('Title must be a non-empty string.', 'title');
    }
    out.title = title.trim();
  }

  if ('notes' in patch) {
    if (typeof patch.notes !== 'string') {
      throw new ValidationError('Notes must be a string.', 'notes');
    }
    out.notes = patch.notes;
  }

  if ('status' in patch) {
    if (!VALID_STATUSES.includes(patch.status)) {
      throw new ValidationError(
        `Status must be one of: ${VALID_STATUSES.join(', ')}.`, 'status'
      );
    }
    out.status = patch.status;
  }

  if ('priority' in patch) {
    if (!VALID_PRIORITIES.includes(patch.priority)) {
      throw new ValidationError(
        `Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`, 'priority'
      );
    }
    out.priority = patch.priority;
  }

  if ('dueDate' in patch) {
    if (patch.dueDate !== null && !isValidISODate(patch.dueDate)) {
      throw new ValidationError(
        'Due date must be a valid YYYY-MM-DD string or null.', 'dueDate'
      );
    }
    out.dueDate = patch.dueDate;
  }

  if ('tags' in patch) {
    if (!Array.isArray(patch.tags)) {
      throw new ValidationError('Tags must be an array of strings.', 'tags');
    }
    // Normalise: lowercase, trim, dedup
    const tags = [...new Set(
      patch.tags.map(t => {
        if (typeof t !== 'string') {
          throw new ValidationError('Each tag must be a string.', 'tags');
        }
        return t.trim().toLowerCase();
      }).filter(Boolean)
    )];
    out.tags = tags;
  }

  return out;
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * @param {object} storage — a localStorage-compatible object
 * @param {string} key
 * @returns {object[]}
 */
function loadFromStorage(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.version !== STORAGE_VERSION ||
      !Array.isArray(parsed.tasks)
    ) {
      return [];
    }
    return parsed.tasks;
  } catch {
    return [];
  }
}

/**
 * @param {object} storage
 * @param {string} key
 * @param {object[]} tasks
 */
function saveToStorage(storage, key, tasks) {
  storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, tasks }));
}

// ── Store factory ─────────────────────────────────────────────────────────────

/**
 * Create a new store bound to the given storage key.
 *
 * @param {string} [storageKey='frankenboard.v1']
 * @param {object} [storage=localStorage]  — injectable for tests
 */
export function createStore(
  storageKey = 'frankenboard.v1',
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  // Use an in-memory fallback if no storage is available (e.g. test environments
  // that pass a custom storage object).
  const _storage = storage || createMemoryStorage();

  /** @type {object[]} */
  let _tasks = loadFromStorage(_storage, storageKey);

  /** @type {Function[]} */
  const _listeners = [];

  // ── Internal helpers ──────────────────────────────────────────────────────

  function _save() {
    saveToStorage(_storage, storageKey, _tasks);
  }

  function _notify() {
    _listeners.forEach(fn => fn());
  }

  function _commit() {
    _save();
    _notify();
  }

  function _findIndex(id) {
    const idx = _tasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error(`Task not found: ${id}`);
    return idx;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * List all tasks, optionally filtered.
   * @param {{ status?: string, priority?: string }} [filter]
   * @returns {object[]}
   */
  function listTasks(filter) {
    let tasks = _tasks.slice();
    if (filter) {
      if (filter.status)   tasks = tasks.filter(t => t.status   === filter.status);
      if (filter.priority) tasks = tasks.filter(t => t.priority === filter.priority);
    }
    return tasks;
  }

  /**
   * Get a single task by id.
   * @param {string} id
   * @returns {object|undefined}
   */
  function getTask(id) {
    return _tasks.find(t => t.id === id);
  }

  /**
   * Create a new task.
   * Validates the data; throws ValidationError on bad input.
   *
   * @param {{ title: string, notes?: string, status?: string,
   *            priority?: string, dueDate?: string|null, tags?: string[] }} data
   * @returns {object} the created task
   */
  function createTask(data) {
    if (!data || typeof data.title !== 'string' || data.title.trim() === '') {
      throw new ValidationError('Title is required.', 'title');
    }

    // Validate provided fields
    const validated = validatePatch({
      title:    data.title,
      notes:    data.notes    ?? '',
      status:   data.status   ?? 'todo',
      priority: data.priority ?? 'medium',
      dueDate:  data.dueDate  ?? null,
      tags:     data.tags     ?? [],
    });

    const now  = new Date().toISOString();
    const task = {
      id:        generateId(),
      title:     validated.title,
      notes:     validated.notes,
      status:    validated.status,
      priority:  validated.priority,
      dueDate:   validated.dueDate,
      tags:      validated.tags,
      createdAt: now,
      updatedAt: now,
    };

    _tasks = [..._tasks, task];
    _commit();
    return task;
  }

  /**
   * Update fields of an existing task.
   * Only the supplied fields are changed.
   * Throws ValidationError for invalid values; state is unchanged on error.
   *
   * @param {string} id
   * @param {object} patch
   * @returns {object} the updated task
   */
  function updateTask(id, patch) {
    const idx = _findIndex(id);

    // Validate BEFORE mutating
    const validated = validatePatch(patch);

    const updated = {
      ..._tasks[idx],
      ...validated,
      updatedAt: new Date().toISOString(),
    };

    const nextTasks = _tasks.slice();
    nextTasks[idx]  = updated;
    _tasks = nextTasks;
    _commit();
    return updated;
  }

  /**
   * Delete a task by id.
   * @param {string} id
   */
  function deleteTask(id) {
    const idx = _findIndex(id);
    _tasks = _tasks.filter((_, i) => i !== idx);
    _commit();
  }

  /**
   * Move a task to a new status column.
   * Equivalent to updateTask(id, { status }).
   *
   * @param {string} id
   * @param {'todo'|'doing'|'done'} status
   * @returns {object} updated task
   */
  function moveTask(id, status) {
    return updateTask(id, { status });
  }

  /**
   * Set (or clear) a task's due date.
   *
   * @param {string} id
   * @param {string|null} date  — 'YYYY-MM-DD' or null
   * @returns {object} updated task
   */
  function setDueDate(id, date) {
    return updateTask(id, { dueDate: date });
  }

  /**
   * Replace all tasks with a validated array.
   * Throws if the array contains invalid tasks; original data is preserved.
   *
   * @param {object[]} tasks
   */
  function importTasks(tasks) {
    if (!Array.isArray(tasks)) {
      throw new ValidationError('Import data must be an array of tasks.');
    }

    const validated = tasks.map((raw, idx) => {
      if (typeof raw !== 'object' || raw === null) {
        throw new ValidationError(`Task at index ${idx} must be an object.`);
      }
      if (typeof raw.title !== 'string' || raw.title.trim() === '') {
        throw new ValidationError(`Task at index ${idx} is missing a title.`);
      }

      const patch = validatePatch({
        title:    raw.title,
        notes:    raw.notes    ?? '',
        status:   raw.status   ?? 'todo',
        priority: raw.priority ?? 'medium',
        dueDate:  raw.dueDate  ?? null,
        tags:     raw.tags     ?? [],
      });

      const now = new Date().toISOString();
      return {
        id:        typeof raw.id === 'string' && raw.id ? raw.id : generateId(),
        title:     patch.title,
        notes:     patch.notes,
        status:    patch.status,
        priority:  patch.priority,
        dueDate:   patch.dueDate,
        tags:      patch.tags,
        createdAt: raw.createdAt || now,
        updatedAt: raw.updatedAt || now,
      };
    });

    // Deduplicate ids (last one wins)
    const seen  = new Map();
    for (const t of validated) seen.set(t.id, t);

    _tasks = [...seen.values()];
    _commit();
  }

  /**
   * Export all tasks as a JSON string.
   * @returns {string}
   */
  function exportTasks() {
    return JSON.stringify({ version: STORAGE_VERSION, tasks: _tasks }, null, 2);
  }

  /**
   * Clear all tasks (used for tests / reset).
   */
  function clearAll() {
    _tasks = [];
    _commit();
  }

  /**
   * Register a callback fired after every mutation.
   * @param {Function} fn
   * @returns {Function} unsubscribe
   */
  function onChange(fn) {
    _listeners.push(fn);
    return () => {
      const idx = _listeners.indexOf(fn);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  }

  return {
    listTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    setDueDate,
    importTasks,
    exportTasks,
    clearAll,
    onChange,
  };
}

// ── In-memory storage (test helper, also exported for use in tests) ───────────

/**
 * Create a simple in-memory storage object compatible with the localStorage API.
 * @returns {{ getItem, setItem, removeItem, clear }}
 */
export function createMemoryStorage() {
  const _store = new Map();
  return {
    getItem:    (key)        => _store.has(key) ? _store.get(key) : null,
    setItem:    (key, value) => _store.set(key, String(value)),
    removeItem: (key)        => _store.delete(key),
    clear:      ()           => _store.clear(),
  };
}
