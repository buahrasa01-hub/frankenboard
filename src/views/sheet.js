/**
 * src/views/sheet.js
 * Spreadsheet-grid renderer — stub placeholder (implemented in task 5).
 */

/**
 * @param {HTMLElement} container
 * @param {object[]} tasks
 * @param {object} actions
 */
export function render(container, tasks, actions) {
  // Stub: renders a simple list until full implementation in task 5
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-msg">No tasks yet. Press <kbd>n</kbd> to create one.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="sheet-table-wrapper">
      <table class="sheet-table" role="grid" aria-label="Task sheet">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Due date</th>
            <th scope="col">Tags</th>
            <th scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => `
            <tr data-id="${t.id}" style="cursor:pointer">
              <td>${escHtml(t.title)}</td>
              <td><span class="badge badge-status-${t.status}">${t.status}</span></td>
              <td><span class="badge badge-priority-${t.priority}">${t.priority}</span></td>
              <td style="font-family:var(--font-mono);font-size:0.78rem">${t.dueDate || '—'}</td>
              <td>${(t.tags || []).map(tag => `<span class="tag-chip">${escHtml(tag)}</span>`).join(' ')}</td>
              <td>
                <button class="row-delete-btn" data-delete="${t.id}" aria-label="Delete ${escHtml(t.title)}">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  // Click row → open editor
  container.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete]')) return;
      const task = tasks.find(t => t.id === row.dataset.id);
      if (task) actions.openEditor(task);
    });
  });

  // Delete buttons
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.deleteTask(btn.dataset.delete);
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
