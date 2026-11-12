/**
 * src/app.js
 * Frankenboard — wiring, view switching, shortcuts, seed/import/export,
 * and the editor panel.
 *
 * Tasks 1 (stub) → Task 8 (full implementation).
 * For now this file bootstraps the shell, subscribes to the store, and
 * renders a placeholder until the view modules are wired in task 8.
 */

import { createStore } from './store.js';
import { render as renderSheet    } from './views/sheet.js';
import { render as renderBoard    } from './views/board.js';
import { render as renderCalendar } from './views/calendar.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const store = createStore('frankenboard.v1');

// Make the app shell visible (hides noscript fallback via CSS rules already set)
document.getElementById('app-shell').style.display = 'grid';

// ── State ────────────────────────────────────────────────────────────────────

let currentView = 'sheet';

// ── Toast helper ─────────────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * Show a brief status message.
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
 * @param {'sheet'|'board'|'calendar'} view
 */
function switchView(view) {
  currentView = view;

  // Update buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  // Show / hide containers
  document.querySelectorAll('.view-container').forEach(el => {
    const active = el.id === `view-${view}`;
    el.classList.toggle('active', active);
    el.setAttribute('aria-hidden', String(!active));
  });

  renderActiveView();
}

// ── Render ────────────────────────────────────────────────────────────────────

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
      const q = search.toLowerCase();
      const inTitle = t.title.toLowerCase().includes(q);
      const inNotes = (t.notes || '').toLowerCase().includes(q);
      const inTags  = (t.tags  || []).some(tag => tag.toLowerCase().includes(q));
      if (!inTitle && !inNotes && !inTags) return false;
    }
    return true;
  });
}

function renderActiveView() {
  const container = document.getElementById(`view-${currentView}`);
  if (!container) return;

  const allTasks     = store.listTasks();
  const filteredTasks = applyFilters(allTasks);

  // Views are dynamically imported once available; for now render placeholder
  // (views will be injected in task 5-7 and fully wired in task 8)
  if (currentView === 'sheet' && _sheetRender) {
    _sheetRender(container, filteredTasks, makeActions());
  } else if (currentView === 'board' && _boardRender) {
    _boardRender(container, filteredTasks, makeActions());
  } else if (currentView === 'calendar' && _calendarRender) {
    _calendarRender(container, filteredTasks, makeActions());
  } else {
    renderPlaceholder(container, currentView, filteredTasks.length);
  }
}

function renderPlaceholder(container, view, count) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🧪</div>
      <div class="empty-state-msg">
        <strong style="color:var(--clr-green)">${capitalise(view)} view</strong>
        — coming soon (task ${view === 'sheet' ? 5 : view === 'board' ? 6 : 7})
      </div>
      <div style="font-size:0.75rem;color:var(--clr-text-dim);font-family:var(--font-mono)">
        ${count} task${count !== 1 ? 's' : ''} in store
      </div>
    </div>
  `;
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Pluggable view renderers (set by view modules once implemented)
let _sheetRender    = null;
let _boardRender    = null;
let _calendarRender = null;

/** Allow view modules to register themselves (used in tasks 5-7). */
export function registerView(name, renderFn) {
  if (name === 'sheet')    _sheetRender    = renderFn;
  if (name === 'board')    _boardRender    = renderFn;
  if (name === 'calendar') _calendarRender = renderFn;
}

// Register the three view renderers (tasks 5-7)
registerView('sheet',    renderSheet);
registerView('board',    renderBoard);
registerView('calendar', renderCalendar);

// ── Actions passed to views ───────────────────────────────────────────────────

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

let _editingId = null;

export function openEditor(task = null) {
  // A partial object (e.g. from calendar "click empty day") has no .id;
  // treat it as a new-task with pre-filled fields.
  _editingId = (task && task.id) ? task.id : null;
  const panel     = document.getElementById('editor-panel');
  const overlay   = document.getElementById('editor-overlay');
  const titleEl   = document.getElementById('editor-panel-title');
  const bodyEl    = document.getElementById('editor-body');

  titleEl.textContent = _editingId ? 'Edit task' : 'New task';

  const t = task || {
    title: '', notes: '', status: 'todo', priority: 'medium',
    dueDate: null, tags: []
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
      <textarea class="field-textarea" id="ed-notes" placeholder="Optional notes…">${escHtml(t.notes || '')}</textarea>
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
      <label class="field-label" for="ed-tags">Tags <span style="color:var(--clr-text-dim)">(comma-separated)</span></label>
      <input class="field-input field-mono" id="ed-tags" type="text"
             value="${escHtml((t.tags || []).join(', '))}" placeholder="lab, haunt, potion" autocomplete="off" />
    </div>
    ${_editingId ? `
    <div style="font-size:0.72rem;color:var(--clr-text-dim);font-family:var(--font-mono);line-height:1.6">
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

  // Focus title
  setTimeout(() => document.getElementById('ed-title')?.focus(), 50);
}

export function closeEditor() {
  _editingId = null;
  const panel   = document.getElementById('editor-panel');
  const overlay = document.getElementById('editor-overlay');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('visible');
  overlay.setAttribute('aria-hidden', 'true');
}

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

function saveEditor() {
  const data = collectEditorData();
  const errEl = document.getElementById('ed-title-err');
  const globalErr = document.getElementById('ed-global-err');

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
    if (globalErr) globalErr.textContent = err.message || String(err);
  }
}

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
    a.download = `frankenboard-${isoDate()}.json`;
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
      const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.tasks) ? raw.tasks : null);
      if (!arr) throw new Error('File must contain a JSON array of tasks.');
      store.importTasks(arr);
      showToast(`Imported ${arr.length} task${arr.length !== 1 ? 's' : ''} ✓`, 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
    // reset file input so the same file can be re-imported
    document.getElementById('input-import').value = '';
  };
  reader.readAsText(file);
}

function isoDate() {
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

// ── Event wiring ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// View buttons
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// New task
document.getElementById('btn-new-task').addEventListener('click', () => openEditor());

// Close editor
document.getElementById('btn-close-editor').addEventListener('click', closeEditor);
document.getElementById('editor-overlay').addEventListener('click', closeEditor);

// Editor save / delete (delegated, since body is re-rendered)
document.getElementById('editor-panel').addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'btn-editor-save')   saveEditor();
  if (t.id === 'btn-editor-delete') deleteEditing();
});

// Inject Save / Delete buttons into editor actions (once)
(function injectEditorActions() {
  const existing = document.querySelector('.editor-actions');
  if (existing) return;
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'editor-actions';
  actionsDiv.innerHTML = `
    <button class="action-btn" id="btn-editor-save" aria-label="Save task">Save</button>
    <button class="action-btn btn-danger" id="btn-editor-delete" aria-label="Delete task">Delete</button>
  `;
  document.getElementById('editor-panel').appendChild(actionsDiv);
})();

// Seed / export / import
document.getElementById('btn-seed').addEventListener('click', handleSeed);
document.getElementById('btn-export').addEventListener('click', handleExport);
document.getElementById('input-import').addEventListener('change', e => {
  handleImport(e.target.files[0]);
});

// Filters
document.getElementById('search-input').addEventListener('input', renderActiveView);
document.getElementById('filter-status').addEventListener('change', renderActiveView);
document.getElementById('filter-priority').addEventListener('change', renderActiveView);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-priority').value = '';
  renderActiveView();
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  // Ignore shortcuts when typing in inputs
  const tag = document.activeElement?.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || document.activeElement?.isContentEditable;

  if (e.key === 'Escape') {
    closeEditor();
    return;
  }

  if (!inInput) {
    if (e.key === 'n') { e.preventDefault(); openEditor(); }
    if (e.key === '/') { e.preventDefault(); document.getElementById('search-input').focus(); }
    if (e.key === '1') switchView('sheet');
    if (e.key === '2') switchView('board');
    if (e.key === '3') switchView('calendar');
  }
});

// ── Store subscription ────────────────────────────────────────────────────────

store.onChange(renderActiveView);

// ── Initial render ────────────────────────────────────────────────────────────

renderActiveView();
