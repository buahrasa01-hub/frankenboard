/**
 * src/views/board.js
 * Kanban board renderer — stub placeholder (implemented in task 6).
 */

/**
 * @param {HTMLElement} container
 * @param {object[]} tasks
 * @param {object} actions
 */
export function render(container, tasks, actions) {
  const columns = [
    { status: 'todo',  label: 'To do' },
    { status: 'doing', label: 'Doing' },
    { status: 'done',  label: 'Done'  },
  ];

  container.innerHTML = `
    <div class="board-columns">
      ${columns.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        return `
          <div class="board-column" data-status="${col.status}">
            <div class="board-column-header">
              <span class="board-column-title">${col.label}</span>
              <span class="board-column-count">${colTasks.length}</span>
            </div>
            <div class="board-cards" data-status="${col.status}">
              ${colTasks.length === 0
                ? `<div class="empty-state" style="min-height:60px;padding:var(--sp-m)">
                     <div class="empty-state-msg" style="font-size:0.75rem">No tasks</div>
                   </div>`
                : colTasks.map(t => `
                    <div class="board-card" data-id="${t.id}" draggable="true"
                         tabindex="0" role="button" aria-label="Task: ${escHtml(t.title)}">
                      <div class="board-card-title">${escHtml(t.title)}</div>
                      <div class="board-card-meta">
                        <span class="badge badge-priority-${t.priority}">${t.priority}</span>
                        ${t.dueDate ? `<span style="font-size:0.65rem;font-family:var(--font-mono);color:var(--clr-text-dim)">${t.dueDate}</span>` : ''}
                        ${(t.tags || []).slice(0, 2).map(tag => `<span class="tag-chip">${escHtml(tag)}</span>`).join('')}
                      </div>
                    </div>`).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;

  // Click card → open editor
  container.querySelectorAll('.board-card').forEach(card => {
    card.addEventListener('click', () => {
      const task = tasks.find(t => t.id === card.dataset.id);
      if (task) actions.openEditor(task);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const task = tasks.find(t => t.id === card.dataset.id);
        if (task) actions.openEditor(task);
      }
    });
  });

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  let dragId = null;

  container.querySelectorAll('.board-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', dragId);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragId = null;
    });
  });

  container.querySelectorAll('.board-cards').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.closest('.board-column').classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) {
        zone.closest('.board-column').classList.remove('drag-over');
      }
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.closest('.board-column').classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) actions.moveTask(id, zone.dataset.status);
    });
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
