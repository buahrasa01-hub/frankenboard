/**
 * src/app.js
 * Frankenboard — app wiring: view switching, onChange re-render, editor panel,
 * keyboard shortcuts (n / / 1 2 3), seed / import / export.
 *
 * Requirements: 6.1, 6.3, 8.1, 8.2, 8.3, 8.4
 */

import { createStore } from './store.js';
import { render as renderSheet    } from './views/sheet.js';
import { render as renderBoard    } from './views/board.js';
import { render as renderCalendar } from './views/calendar.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const store = createStore('frankenboard.v1');

// Reveal the app shell (noscript fallback is already hidden by the <noscript>
// block in index.html; this sets an explicit grid layout).
document.getElementById('app-shell').style.display = 'grid';

// ── State ────────────────────────────────────────────────────────────────────

/** @type {'sheet'|'board'|'calendar'} */
let currentView = 'sheet';

// ── Toast helper ─────────────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * Show a brief status message in the toast bar.
 * @param {string} msg
 * @param {'info'|'success'|'error'} [type='info']
 */
export function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast visible ${type}`;
  el.setAttribute('aria-hidden', 'false');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.className = 'toast';
    el.setAttribute('aria-hidden', 'true');
  }, 3500);
}

// ── View switching ────────────────────────────────────────────────────────────

/**
 * Switch to the named view, update button states, and re-render.
 * @param {'sheet'|'board'|'calendar'} view
 */
function switchView(view) {
  currentView = view;

  // Update view-switcher button aria/active state
  document.querySelectorAll('.view-btn').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  // Show the matching container; hide the others
  document.querySelectorAll('.view-container').forEach(el => {
    const active = el.id === `view-${view}`;
    el.classList.toggle('active', active);
    el.setAttribute('aria-hidden', String(!active));
  });

  renderActiveView();
}

// ── Filter helpers ────────────────────────────────────────────────────────────

function getFilters() {
  return {
    search:   document.getElementById('search-input').value.trim(),
    status:   document.getElementById('filter-status').value,
    priority: document.getElementById('filter-priority').value,
  };
}

function applyFilters(tasks) {
  const { search, status, priority } = getFilters();
  return tasks.filter(t => {
    if (status   && t.status   !== status)   return false;
    if (priority && t.priority !== priority) return false;
    if (search) {
      const q      = search.toLowerCase();
      const inTitle = t.title.toLowerCase().includes(q);
      const inNotes = (t.notes  || '').toLowerCase().includes(q);
      const inTags  = (t.tags   || []).some(tag => tag.toLowerCase().includes(q));
      if (!inTitle && !inNotes && !inTags) return false;
    }
    return true;
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

/**
 * Re-render the currently active view.
 * Called by the store's onChange subscription and after any state change.
 * Satisfies requirement 6.1: all views reflect the same task set after each
 * mutation because only the active view is rendered per switch; switching
 * always calls renderActiveView which reads live store data.
 *
 * The search/filter bar is a Sheet-only concern: Board columns ARE the status
 * filter (showing all tasks sorted by status), and Calendar must show all
 * tasks regardless of status/priority filters.  Only the Sheet view receives
 * the filtered subset.
 */
function renderActiveView() {
  const container = document.getElementById(`view-${currentView}`);
  if (!container) return;

  const allTasks      = store.listTasks();
  const filteredTasks = applyFilters(allTasks);
  const actions       = makeActions();

  switch (currentView) {
    case 'sheet':
      renderSheet(container, filteredTasks, actions);
      break;
    case 'board':
      // Board always receives all tasks — columns ARE the status grouping
      renderBoard(container, allTasks, actions);
      break;
    case 'calendar':
      // Calendar always receives all tasks — the grid shows tasks by due date
      // regardless of status or priority filters
      renderCalendar(container, allTasks, actions);
      break;
  }
}

// ── Actions passed to views ───────────────────────────────────────────────────

/**
 * Build the actions object given to each view render call.
 * Views call these to mutate the store; they never import the store directly.
 * @returns {object}
 */
function makeActions() {
  return {
    updateTask:  (id, patch)  => { store.updateTask(id, patch);  },
    deleteTask:  (id)         => { store.deleteTask(id);         },
    moveTask:    (id, status) => { store.moveTask(id, status);   },
    setDueDate:  (id, date)   => { store.setDueDate(id, date);  },
    createTask:  (data)       => store.createTask(data),
    openEditor:  (task)       => openEditor(task),
  };
}

// ── Editor panel ─────────────────────────────────────────────────────────────

/** Id of the task currently being edited, or null for new-task mode. */
let _editingId = null;

/**
 * Open the editor panel.
 * Pass a full task object to edit an existing task.
 * Pass a partial object (e.g. { dueDate }) to pre-fill a new task.
 * Pass null / nothing to open a blank new-task form.
 *
 * Satisfies requirement 8.4: clicking a task in any view opens the editor.
 * Satisfies requirement 8.1: pressing n opens the editor for a new task.
 *
 * @param {object|null} [task]
 */
export function openEditor(task = null) {
  // A partial object (from calendar "click empty day") has no .id;
  // treat it as a new task with pre-filled fields.
  _editingId = (task && task.id) ? task.id : null;

  const panel   = document.getElementById('editor-panel');
  const overlay = document.getElementById('editor-overlay');
  const titleEl = document.getElementById('editor-panel-title');
  const bodyEl  = document.getElementById('editor-body');

  titleEl.textContent = _editingId ? 'Edit task' : 'New task';

  const t = task || {
    title: '', notes: '', status: 'todo', priority: 'medium',
    dueDate: null, tags: [],
  };

  bodyEl.innerHTML = `
    <div class="field-group">
      <label class="field-label" for="ed-title">Title</label>
      <input class="field-input" id="ed-title" type="text"
             value="${escHtml(t.title)}" placeholder="Task title…" autocomplete="off" />
      <span class="field-error" id="ed-title-err" aria-live="polite"></span>
    </div>
    <div class="field-group">
      <label class="field-label" for="ed-notes">Notes</label>
      <textarea class="field-textarea" id="ed-notes"
                placeholder="Optional notes…">${escHtml(t.notes || '')}</textarea>
    </div>
    <div class="field-group">
      <label class="field-label" for="ed-status">Status</label>
      <select class="field-select" id="ed-status">
        <option value="todo"  ${t.status === 'todo'  ? 'selected' : ''}>To do</option>
        <option value="doing" ${t.status === 'doing' ? 'selected' : ''}>Doing</option>
        <option value="done"  ${t.status === 'done'  ? 'selected' : ''}>Done</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label" for="ed-priority">Priority</label>
      <select class="field-select" id="ed-priority">
        <option value="low"    ${t.priority === 'low'    ? 'selected' : ''}>Low</option>
        <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Medium</option>
        <option value="high"   ${t.priority === 'high'   ? 'selected' : ''}>High</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label" for="ed-duedate">Due date</label>
      <input class="field-input" id="ed-duedate" type="date"
             value="${t.dueDate || ''}" />
    </div>
    <div class="field-group">
      <label class="field-label" for="ed-tags">
        Tags
        <span style="color:var(--clr-text-dim)">(comma-separated)</span>
      </label>
      <input class="field-input field-mono" id="ed-tags" type="text"
             value="${escHtml((t.tags || []).join(', '))}"
             placeholder="lab, haunt, potion" autocomplete="off" />
    </div>
    ${_editingId ? `
    <div class="field-meta">
      id: ${escHtml(t.id)}<br/>
      created: ${t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}<br/>
      updated: ${t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '—'}
    </div>` : ''}
    <span class="field-error" id="ed-global-err" aria-live="polite"></span>
  `;

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  overlay.classList.add('visible');
  overlay.setAttribute('aria-hidden', 'false');

  // Show Delete button only when editing an existing task
  const deleteBtn = document.getElementById('btn-editor-delete');
  if (deleteBtn) deleteBtn.style.display = _editingId ? '' : 'none';

  // Auto-focus the title field
  setTimeout(() => document.getElementById('ed-title')?.focus(), 50);
}

/**
 * Close the editor panel without saving.
 */
export function closeEditor() {
  _editingId = null;
  const panel   = document.getElementById('editor-panel');
  const overlay = document.getElementById('editor-overlay');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('visible');
  overlay.setAttribute('aria-hidden', 'true');
}

/** Collect all field values from the editor form. */
function collectEditorData() {
  const title    = document.getElementById('ed-title')?.value.trim() || '';
  const notes    = document.getElementById('ed-notes')?.value.trim() || '';
  const status   = document.getElementById('ed-status')?.value;
  const priority = document.getElementById('ed-priority')?.value;
  const dueDate  = document.getElementById('ed-duedate')?.value || null;
  const tagsRaw  = document.getElementById('ed-tags')?.value || '';
  const tags     = tagsRaw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  return { title, notes, status, priority, dueDate, tags };
}

/** Validate, persist, and close the editor. */
function saveEditor() {
  const data     = collectEditorData();
  const errEl    = document.getElementById('ed-title-err');
  const globalEl = document.getElementById('ed-global-err');

  if (!data.title) {
    if (errEl) errEl.textContent = 'Title is required.';
    document.getElementById('ed-title')?.focus();
    return;
  }
  if (errEl) errEl.textContent = '';

  try {
    if (_editingId) {
      store.updateTask(_editingId, data);
    } else {
      store.createTask(data);
    }
    closeEditor();
  } catch (err) {
    if (globalEl) globalEl.textContent = err.message || String(err);
  }
}

/** Delete the currently-edited task (after confirmation). */
function deleteEditing() {
  if (!_editingId) return;
  if (!confirm('Delete this task? This cannot be undone.')) return;
  store.deleteTask(_editingId);
  closeEditor();
}

// ── Import / Export ───────────────────────────────────────────────────────────

function handleExport() {
  try {
    const json = store.exportTasks();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `frankenboard-${isoDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Tasks exported ✓', 'success');
  } catch (err) {
    showToast(`Export failed: ${err.message}`, 'error');
  }
}

function handleImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target.result);
      // Accept both a plain array and the {version, tasks} envelope
      const arr = Array.isArray(raw)
        ? raw
        : (raw && Array.isArray(raw.tasks) ? raw.tasks : null);
      if (!arr) throw new Error('File must contain a JSON array of tasks.');
      store.importTasks(arr);
      showToast(`Imported ${arr.length} task${arr.length !== 1 ? 's' : ''} ✓`, 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
    // Reset so the same file can be re-imported if needed
    document.getElementById('input-import').value = '';
  };
  reader.readAsText(file);
}

function isoDateStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function handleSeed() {
  try {
    const { seedTasks } = await import('./seed.js');
    const tasks = seedTasks();
    store.importTasks(tasks);
    showToast(`Loaded ${tasks.length} demo tasks ✓`, 'success');
  } catch (err) {
    showToast(`Demo load failed: ${err.message}`, 'error');
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event wiring ──────────────────────────────────────────────────────────────

// View-switcher buttons (1 / 2 / 3 shortcuts via keydown below)
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// New task button  (shortcut: n)
document.getElementById('btn-new-task').addEventListener('click', () => openEditor());

// Editor: close via X button or overlay click
document.getElementById('btn-close-editor').addEventListener('click', closeEditor);
document.getElementById('editor-overlay').addEventListener('click', closeEditor);

// Editor: Save / Delete (delegated — body innerHTML is rebuilt on each open)
document.getElementById('editor-panel').addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'btn-editor-save')   saveEditor();
  if (t.id === 'btn-editor-delete') deleteEditing();
});

// Inject Save / Delete buttons into the editor footer (once, at startup).
// The Delete button is hidden for new tasks (no _editingId) and shown/hidden
// each time openEditor is called.
(function injectEditorActions() {
  if (document.querySelector('.editor-actions')) return;
  const div = document.createElement('div');
  div.className = 'editor-actions';
  div.innerHTML = `
    <button class="action-btn"       id="btn-editor-save"   aria-label="Save task">Save</button>
    <button class="action-btn btn-danger" id="btn-editor-delete" aria-label="Delete task"
            style="display:none">Delete</button>
  `;
  document.getElementById('editor-panel').appendChild(div);
})();

// Seed / export / import buttons
document.getElementById('btn-seed').addEventListener('click', handleSeed);
document.getElementById('btn-export').addEventListener('click', handleExport);
document.getElementById('input-import').addEventListener('change', e => {
  handleImport(e.target.files[0]);
});

// Filter bar → re-render on change
document.getElementById('search-input').addEventListener('input',    renderActiveView);
document.getElementById('filter-status').addEventListener('change',  renderActiveView);
document.getElementById('filter-priority').addEventListener('change', renderActiveView);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  document.getElementById('search-input').value  = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-priority').value = '';
  renderActiveView();
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
// Requirement 8.1: n  → new task
// Requirement 8.2: /  → focus search box
// Requirement 8.3: 1/2/3 → switch view
// Escape → close editor (also when typing in editor fields)

document.addEventListener('keydown', e => {
  const tag     = document.activeElement?.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || document.activeElement?.isContentEditable;

  // Escape closes the editor from any context
  if (e.key === 'Escape') {
    closeEditor();
    return;
  }

  // All other shortcuts are suppressed while typing
  if (inInput) return;

  if (e.key === 'n') { e.preventDefault(); openEditor(); }
  if (e.key === '/') { e.preventDefault(); document.getElementById('search-input').focus(); }
  if (e.key === '1') switchView('sheet');
  if (e.key === '2') switchView('board');
  if (e.key === '3') switchView('calendar');
});

// ── Store subscription ────────────────────────────────────────────────────────
// Requirement 6.1: re-render after every mutation so all views stay in sync.

store.onChange(renderActiveView);

// ── Initial render ────────────────────────────────────────────────────────────

renderActiveView();
