/**
 * src/views/board.js
 * Kanban board renderer — three columns (To do / Doing / Done) with
 * HTML5 drag-and-drop between columns and click-to-edit fallback.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 *
 * Exports one render(container, tasks, actions) function.
 */

const COLUMNS = [
  { status: 'todo',  label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done',  label: 'Done'  },
];

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dueDateLabel(dueDate) {
  if (!dueDate) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.floor((due - today) / 86400000);
  let cls = 'font-size:0.65rem;font-family:var(--font-mono);color:var(--clr-text-dim)';
  if (diffDays < 0)       cls = 'font-size:0.65rem;font-family:var(--font-mono);color:var(--clr-red);font-weight:600';
  else if (diffDays <= 2) cls = 'font-size:0.65rem;font-family:var(--font-mono);color:var(--clr-orange);font-weight:600';
  return `<span style="${cls}">${escHtml(dueDate)}</span>`;
}

function renderCard(t) {
  return `
    <div class="board-card"
         data-id="${t.id}"
         draggable="true"
         tabindex="0"
         role="button"
         aria-label="Task: ${escHtml(t.title)}. Priority: ${t.priority}. Click to edit.">
      <div class="board-card-title">${escHtml(t.title)}</div>
      <div class="board-card-meta">
        <span class="badge badge-priority-${t.priority}" title="Priority: ${t.priority}">${t.priority}</span>
        ${dueDateLabel(t.dueDate)}
        ${(t.tags || []).slice(0, 2).map(tag => `<span class="tag-chip">${escHtml(tag)}</span>`).join('')}
        ${(t.tags || []).length > 2 ? `<span class="tag-chip" title="${escHtml((t.tags).slice(2).join(', '))}">+${t.tags.length - 2}</span>` : ''}
      </div>
    </div>`;
}

function renderColumn(col, colTasks) {
  const colStatusLabel = { todo: 'To do', doing: 'Doing', done: 'Done' }[col.status];
  return `
    <div class="board-column" data-status="${col.status}" role="region"
         aria-label="${colStatusLabel} column, ${colTasks.length} task${colTasks.length !== 1 ? 's' : ''}">
      <div class="board-column-header">
        <span class="board-column-title">${col.label}</span>
        <span class="board-column-count" aria-hidden="true">${colTasks.length}</span>
      </div>
      <div class="board-cards" data-status="${col.status}" role="list"
           aria-label="Drop tasks here to move to ${colStatusLabel}">
        ${colTasks.length === 0
          ? `<div class="empty-state" style="min-height:60px;padding:var(--sp-m)">
               <div class="empty-state-msg" style="font-size:0.75rem">No tasks here</div>
             </div>`
          : colTasks.map(renderCard).join('')}
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {object[]} tasks   — all tasks (not filtered; board uses all)
 * @param {object}   actions — { updateTask, deleteTask, moveTask, setDueDate, openEditor }
 */
export function render(container, tasks, actions) {
  container.innerHTML = `
    <div class="board-columns">
      ${COLUMNS.map(col => renderColumn(col, tasks.filter(t => t.status === col.status))).join('')}
    </div>`;

  // ── Click / keyboard → open editor ───────────────────────────────────────
  container.querySelectorAll('.board-card').forEach(card => {
    const openCard = () => {
      const task = tasks.find(t => t.id === card.dataset.id);
      if (task) actions.openEditor(task);
    };
    card.addEventListener('click', openCard);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCard();
      }
    });
  });

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  // Track drag id as a module-local variable so it survives cross-browser
  // dataTransfer quirks.
  let _dragId = null;

  container.querySelectorAll('.board-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => {
      _dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', _dragId);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      _dragId = null;
    });
  });

  container.querySelectorAll('.board-cards').forEach(zone => {
    const column = zone.closest('.board-column');

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', e => {
      // Only remove highlight when leaving the column entirely
      if (!column.contains(e.relatedTarget)) {
        column.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      column.classList.remove('drag-over');
      const id     = e.dataTransfer.getData('text/plain') || _dragId;
      const status = zone.dataset.status;
      if (id && status) {
        try {
          actions.moveTask(id, status);
        } catch {
          // Invalid target — no-op (req 4.2: drag to invalid = no-op)
        }
      }
      _dragId = null;
    });
  });
}
