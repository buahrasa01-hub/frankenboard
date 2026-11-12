/**
 * src/views/sheet.js
 * Spreadsheet-grid renderer with inline cell editing, search filter,
 * status/priority filters, and column sorting.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * Exports one render(container, tasks, actions) function.
 * Registers itself with app.js via registerView('sheet', render).
 */

// ── Sort state (module-level, persists across re-renders) ─────────────────────
/** @type {'title'|'status'|'priority'|'dueDate'|'tags'|null} */
let _sortCol = null;
/** @type {'asc'|'desc'} */
let _sortDir = 'asc';

// ── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'title',    label: 'Title'     },
  { key: 'status',   label: 'Status'    },
  { key: 'priority', label: 'Priority'  },
  { key: 'dueDate',  label: 'Due date'  },
  { key: 'tags',     label: 'Tags'      },
];

// ── Sort comparator ───────────────────────────────────────────────────────────
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER   = { todo: 0, doing: 1, done: 2 };

function compareValues(a, b, col) {
  let va = a[col];
  let vb = b[col];
  if (col === 'tags') {
    va = (va || []).join(', ');
    vb = (vb || []).join(', ');
  } else if (col === 'priority') {
    return PRIORITY_ORDER[va] - PRIORITY_ORDER[vb];
  } else if (col === 'status') {
    return STATUS_ORDER[va] - STATUS_ORDER[vb];
  }
  va = (va ?? '').toString().toLowerCase();
  vb = (vb ?? '').toString().toLowerCase();
  return va < vb ? -1 : va > vb ? 1 : 0;
}

function sortTasks(tasks) {
  if (!_sortCol) return tasks;
  return [...tasks].sort((a, b) => {
    const cmp = compareValues(a, b, _sortCol);
    return _sortDir === 'asc' ? cmp : -cmp;
  });
}

// ── HTML escaping ─────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Cell renderers (display mode) ─────────────────────────────────────────────
function renderCellDisplay(task, col) {
  switch (col) {
    case 'title':
      return `<span class="cell-text">${escHtml(task.title)}</span>`;
    case 'status':
      return `<span class="badge badge-status-${task.status}">${escHtml(task.status)}</span>`;
    case 'priority':
      return `<span class="badge badge-priority-${task.priority}">${escHtml(task.priority)}</span>`;
    case 'dueDate': {
      if (!task.dueDate) return `<span style="color:var(--clr-text-dim)">—</span>`;
      const cls = dueDateClass(task.dueDate);
      return `<span class="${cls}" style="font-family:var(--font-mono);font-size:0.78rem">${escHtml(task.dueDate)}</span>`;
    }
    case 'tags':
      return (task.tags || [])
        .map(tag => `<span class="tag-chip">${escHtml(tag)}</span>`)
        .join(' ') || `<span style="color:var(--clr-text-dim)">—</span>`;
    default:
      return '';
  }
}

function dueDateClass(dueDate) {
  if (!dueDate) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.floor((due - today) / 86400000);
  if (diffDays < 0)  return 'overdue';
  if (diffDays <= 2) return 'due-soon';
  return '';
}

// ── Cell editors (edit mode) ───────────────────────────────────────────────────
function buildCellEditor(task, col) {
  switch (col) {
    case 'title':
      return `<input class="cell-edit" type="text" value="${escHtml(task.title)}"
                aria-label="Edit title" autocomplete="off" data-field="title" />`;
    case 'status':
      return `<select class="cell-edit-select" aria-label="Edit status" data-field="status">
        <option value="todo"  ${task.status === 'todo'  ? 'selected' : ''}>todo</option>
        <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>doing</option>
        <option value="done"  ${task.status === 'done'  ? 'selected' : ''}>done</option>
      </select>`;
    case 'priority':
      return `<select class="cell-edit-select" aria-label="Edit priority" data-field="priority">
        <option value="low"    ${task.priority === 'low'    ? 'selected' : ''}>low</option>
        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>medium</option>
        <option value="high"   ${task.priority === 'high'   ? 'selected' : ''}>high</option>
      </select>`;
    case 'dueDate':
      return `<input class="cell-edit" type="date" value="${task.dueDate || ''}"
                aria-label="Edit due date" data-field="dueDate" />`;
    case 'tags':
      return `<input class="cell-edit field-mono" type="text"
                value="${escHtml((task.tags || []).join(', '))}"
                aria-label="Edit tags (comma-separated)"
                placeholder="lab, haunt"
                data-field="tags" autocomplete="off" />`;
    default:
      return '';
  }
}

// ── Main render function ──────────────────────────────────────────────────────

/**
 * @param {HTMLElement} container
 * @param {object[]} tasks   — already filtered by app.js
 * @param {object}   actions — { updateTask, deleteTask, moveTask, setDueDate, openEditor }
 */
export function render(container, tasks, actions) {
  const sorted = sortTasks(tasks);

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-msg">No tasks match your filters. Press <kbd>n</kbd> to create one.</div>
      </div>`;
    return;
  }

  // Build header cells
  const headerCells = COLUMNS.map(col => {
    const isSorted = _sortCol === col.key;
    const sortClass = isSorted
      ? (_sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc')
      : '';
    return `<th scope="col" class="${sortClass}" data-sort="${col.key}"
              aria-sort="${isSorted ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}"
              title="Sort by ${col.label}">
              ${escHtml(col.label)}
              <span class="sort-indicator" aria-hidden="true"></span>
            </th>`;
  }).join('');

  // Build data rows
  const rows = sorted.map(t => {
    const cells = COLUMNS.map(col =>
      `<td data-col="${col.key}" data-id="${t.id}" role="gridcell"
           aria-label="${escHtml(col.label)}: ${escHtml(col === 'tags' ? (t.tags || []).join(', ') : String(t[col.key] ?? '—'))}"
           tabindex="0">
         ${renderCellDisplay(t, col.key)}
       </td>`
    ).join('');

    return `<tr data-id="${t.id}">
      ${cells}
      <td>
        <button class="row-delete-btn" data-delete="${t.id}"
                aria-label="Delete task: ${escHtml(t.title)}"
                title="Delete task">✕</button>
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="sheet-table-wrapper">
      <table class="sheet-table" role="grid" aria-label="Task sheet — ${sorted.length} task${sorted.length !== 1 ? 's' : ''}">
        <thead>
          <tr>
            ${headerCells}
            <th scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;

  // ── Column sort ───────────────────────────────────────────────────────────
  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (_sortCol === col) {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        _sortCol = col;
        _sortDir = 'asc';
      }
      // Re-render with new sort (actions.rerender if available, else direct call)
      render(container, tasks, actions);
    });
    th.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        th.click();
      }
    });
    th.setAttribute('tabindex', '0');
    th.style.cursor = 'pointer';
  });

  // ── Inline cell editing ───────────────────────────────────────────────────
  container.querySelectorAll('td[data-col][data-id]').forEach(td => {
    const startEditing = (e) => {
      // Don't trigger if already in edit mode
      if (td.querySelector('input, select')) return;

      const id  = td.dataset.id;
      const col = td.dataset.col;
      const task = sorted.find(t => t.id === id);
      if (!task) return;

      // Replace display content with editor
      td.innerHTML = buildCellEditor(task, col);
      const editor = td.querySelector('input, select');
      if (!editor) return;
      editor.focus();
      if (editor.tagName === 'INPUT' && editor.type === 'text') {
        editor.select();
      }

      // Commit on blur or Enter; cancel on Escape
      const commit = () => {
        const field = editor.dataset.field;
        let value   = editor.value;

        // Parse tags string to array
        if (field === 'tags') {
          value = value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        }
        // dueDate: empty string → null
        if (field === 'dueDate' && value === '') {
          value = null;
        }

        try {
          actions.updateTask(id, { [field]: value });
          // Store re-renders via onChange → no need to do it here
        } catch (err) {
          // On validation error restore display and show nothing
          td.innerHTML = renderCellDisplay(task, col);
        }
      };

      const cancel = () => {
        td.innerHTML = renderCellDisplay(task, col);
      };

      editor.addEventListener('blur', commit, { once: true });
      editor.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          editor.removeEventListener('blur', commit);
          commit();
        }
        if (ke.key === 'Escape') {
          ke.preventDefault();
          editor.removeEventListener('blur', commit);
          cancel();
        }
      });
    };

    td.addEventListener('click',   startEditing);
    td.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startEditing(e);
      }
    });
  });

  // ── Delete buttons ────────────────────────────────────────────────────────
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.deleteTask(btn.dataset.delete);
    });
  });
}
