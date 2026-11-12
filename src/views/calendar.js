/**
 * src/views/calendar.js
 * Month-grid calendar renderer — stub placeholder (implemented in task 7).
 */

/**
 * @param {HTMLElement} container
 * @param {object[]} tasks
 * @param {object} actions
 */
export function render(container, tasks, actions) {
  const today     = new Date();
  const year      = today.getFullYear();
  const month     = today.getMonth();
  const monthName = today.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Build a 6-week grid anchored to the first day of the month
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayStr = today.toISOString().slice(0, 10);

  // Map dueDate → tasks
  const byDate = {};
  for (const t of tasks) {
    if (t.dueDate) {
      if (!byDate[t.dueDate]) byDate[t.dueDate] = [];
      byDate[t.dueDate].push(t);
    }
  }
  const undated = tasks.filter(t => !t.dueDate);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let cells = '';
  // Header row
  cells += dayNames.map(d => `<div class="calendar-day-name">${d}</div>`).join('');

  // Offset cells for the first week
  for (let i = 0; i < startOffset; i++) {
    cells += `<div class="calendar-day other-month"></div>`;
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const dayTasks = byDate[dateStr] || [];

    cells += `
      <div class="calendar-day${isToday ? ' today' : ''}"
           data-date="${dateStr}"
           role="gridcell"
           aria-label="${dateStr}${isToday ? ' (today)' : ''}">
        <span class="calendar-day-num">${d}</span>
        ${dayTasks.map(t => `
          <div class="calendar-task-chip"
               data-id="${t.id}"
               draggable="true"
               role="button"
               tabindex="0"
               aria-label="${escHtml(t.title)}">${escHtml(t.title)}</div>`).join('')}
      </div>`;
  }

  // Fill trailing cells to complete the grid
  const totalCells = startOffset + daysInMonth;
  const remainder  = totalCells % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells += `<div class="calendar-day other-month"></div>`;
    }
  }

  container.innerHTML = `
    <div class="calendar-header">
      <button class="calendar-nav-btn" id="cal-prev" aria-label="Previous month">◀</button>
      <span class="calendar-month-label">${monthName}</span>
      <button class="calendar-nav-btn" id="cal-next" aria-label="Next month">▶</button>
    </div>
    <div class="calendar-grid" role="grid" aria-label="Calendar for ${monthName}">
      ${cells}
    </div>
    <div class="undated-strip">
      <div class="undated-strip-title">Undated (${undated.length})</div>
      <div class="undated-chips" id="undated-drop-zone">
        ${undated.map(t => `
          <div class="calendar-task-chip"
               data-id="${t.id}"
               draggable="true"
               role="button"
               tabindex="0"
               aria-label="${escHtml(t.title)}">${escHtml(t.title)}</div>`).join('')}
      </div>
    </div>`;

  // ── Click empty day → prompt to create task ──────────────────────────────
  container.querySelectorAll('.calendar-day[data-date]').forEach(dayEl => {
    dayEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-id]')) return; // task chip click handled below
      actions.openEditor({ dueDate: dayEl.dataset.date });
    });
  });

  // ── Click chip → open editor ──────────────────────────────────────────────
  container.querySelectorAll('.calendar-task-chip[data-id]').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const task = tasks.find(t => t.id === chip.dataset.id);
      if (task) actions.openEditor(task);
    });
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const task = tasks.find(t => t.id === chip.dataset.id);
        if (task) actions.openEditor(task);
      }
    });
  });

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  let dragId = null;

  container.querySelectorAll('.calendar-task-chip[draggable]').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      dragId = chip.dataset.id;
      chip.classList.add('dragging');
      e.dataTransfer.setData('text/plain', dragId);
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      dragId = null;
    });
  });

  container.querySelectorAll('.calendar-day[data-date]').forEach(dayEl => {
    dayEl.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dayEl.classList.add('drag-over');
    });
    dayEl.addEventListener('dragleave', e => {
      if (!dayEl.contains(e.relatedTarget)) dayEl.classList.remove('drag-over');
    });
    dayEl.addEventListener('drop', e => {
      e.preventDefault();
      dayEl.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) actions.setDueDate(id, dayEl.dataset.date);
    });
  });

  // Drop onto undated zone clears the date
  const undatedZone = container.querySelector('#undated-drop-zone');
  if (undatedZone) {
    undatedZone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      undatedZone.classList.add('drag-over');
    });
    undatedZone.addEventListener('dragleave', e => {
      if (!undatedZone.contains(e.relatedTarget)) undatedZone.classList.remove('drag-over');
    });
    undatedZone.addEventListener('drop', e => {
      e.preventDefault();
      undatedZone.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) actions.setDueDate(id, null);
    });
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
