/**
 * src/views/calendar.js
 * Month-grid calendar renderer with prev/next navigation, tasks on due-date
 * cells, drag between days, click empty day to create a task, and an
 * "Undated" strip for tasks without due dates.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 *
 * Exports one render(container, tasks, actions) function.
 */

// ── Month cursor (module-level, persists across re-renders) ──────────────────
const _today  = new Date();
let _curYear  = _today.getFullYear();
let _curMonth = _today.getMonth(); // 0-based

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isoDate(year, month1, day) {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayStr() {
  return isoDate(_today.getFullYear(), _today.getMonth() + 1, _today.getDate());
}

function chipHtml(t) {
  return `
    <div class="calendar-task-chip"
         data-id="${t.id}"
         draggable="true"
         role="button"
         tabindex="0"
         aria-label="${escHtml(t.title)} — ${t.status}, ${t.priority} priority. Drag to reschedule."
         title="${escHtml(t.title)}">${escHtml(t.title)}</div>`;
}

/**
 * @param {HTMLElement} container
 * @param {object[]}    tasks   — all tasks (calendar uses all, not just filtered)
 * @param {object}      actions — { updateTask, deleteTask, moveTask, setDueDate,
 *                                  openEditor, createTask }
 */
export function render(container, tasks, actions) {
  const year      = _curYear;
  const month0    = _curMonth;      // 0-based
  const month1    = month0 + 1;     // 1-based for display / ISO
  const monthName = new Date(year, month0, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOfWeek = new Date(year, month0, 1).getDay(); // 0=Sun
  const daysInMonth    = new Date(year, month0 + 1, 0).getDate();
  const today          = todayStr();

  // Build dueDate → tasks map for this month
  /** @type {Map<string, object[]>} */
  const byDate = new Map();
  for (const t of tasks) {
    if (t.dueDate) {
      if (!byDate.has(t.dueDate)) byDate.set(t.dueDate, []);
      byDate.get(t.dueDate).push(t);
    }
  }

  const undated = tasks.filter(t => !t.dueDate);

  // ── Build grid HTML ───────────────────────────────────────────────────────
  const dayNameCells = DAY_NAMES
    .map(d => `<div class="calendar-day-name" aria-hidden="true">${d}</div>`)
    .join('');

  let dayCells = '';

  // Leading blank cells
  for (let i = 0; i < firstDayOfWeek; i++) {
    dayCells += `<div class="calendar-day other-month" aria-hidden="true"></div>`;
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = isoDate(year, month1, d);
    const isToday  = dateStr === today;
    const dayTasks = byDate.get(dateStr) || [];

    dayCells += `
      <div class="calendar-day${isToday ? ' today' : ''}"
           data-date="${dateStr}"
           role="gridcell"
           tabindex="0"
           aria-label="${dateStr}${isToday ? ' (today)' : ''}${dayTasks.length ? `, ${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}` : ''}">
        <span class="calendar-day-num" aria-hidden="true">${d}</span>
        ${dayTasks.map(chipHtml).join('')}
      </div>`;
  }

  // Trailing blank cells to complete the last week row
  const totalUsed = firstDayOfWeek + daysInMonth;
  const remainder = totalUsed % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      dayCells += `<div class="calendar-day other-month" aria-hidden="true"></div>`;
    }
  }

  // ── Render HTML ───────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="calendar-header">
      <button class="calendar-nav-btn" id="cal-prev"
              aria-label="Previous month">◀</button>
      <span class="calendar-month-label" aria-live="polite">${monthName}</span>
      <button class="calendar-nav-btn" id="cal-next"
              aria-label="Next month">▶</button>
    </div>
    <div class="calendar-grid" role="grid" aria-label="Calendar for ${monthName}">
      ${dayNameCells}
      ${dayCells}
    </div>
    <div class="undated-strip">
      <div class="undated-strip-title" id="undated-label">
        Undated (${undated.length})
      </div>
      <div class="undated-chips" id="undated-drop-zone"
           role="list"
           aria-label="Undated tasks — drag onto a day to assign a due date">
        ${undated.map(chipHtml).join('')}
      </div>
    </div>`;

  // ── Month navigation ──────────────────────────────────────────────────────
  container.querySelector('#cal-prev').addEventListener('click', () => {
    _curMonth--;
    if (_curMonth < 0) { _curMonth = 11; _curYear--; }
    render(container, tasks, actions);
  });

  container.querySelector('#cal-next').addEventListener('click', () => {
    _curMonth++;
    if (_curMonth > 11) { _curMonth = 0; _curYear++; }
    render(container, tasks, actions);
  });

  // ── Click empty day → open editor pre-filled with that due date ───────────
  container.querySelectorAll('.calendar-day[data-date]').forEach(dayEl => {
    dayEl.addEventListener('click', (e) => {
      // Chip clicks are handled below; don't double-fire
      if (e.target.closest('[data-id]')) return;
      // Open editor with dueDate pre-set (task 5.4 — req: offer to create a task due that day)
      actions.openEditor({ dueDate: dayEl.dataset.date, title: '', notes: '',
                           status: 'todo', priority: 'medium', tags: [] });
    });
    dayEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dayEl.click();
      }
    });
  });

  // ── Click chip → open editor ──────────────────────────────────────────────
  container.querySelectorAll('.calendar-task-chip[data-id]').forEach(chip => {
    const openChip = (e) => {
      e.stopPropagation();
      const task = tasks.find(t => t.id === chip.dataset.id);
      if (task) actions.openEditor(task);
    };
    chip.addEventListener('click',   openChip);
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openChip(e);
      }
    });
  });

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  let _dragId = null;

  container.querySelectorAll('.calendar-task-chip[draggable]').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      _dragId = chip.dataset.id;
      chip.classList.add('dragging');
      e.dataTransfer.setData('text/plain', _dragId);
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      _dragId = null;
    });
  });

  // Drop onto a day cell → update due date
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
      const id = e.dataTransfer.getData('text/plain') || _dragId;
      if (id) {
        try {
          actions.setDueDate(id, dayEl.dataset.date);
        } catch {
          // no-op on invalid date
        }
      }
      _dragId = null;
    });
  });

  // Drop onto undated zone → clear due date
  const undatedZone = container.querySelector('#undated-drop-zone');
  if (undatedZone) {
    undatedZone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      undatedZone.classList.add('drag-over');
    });
    undatedZone.addEventListener('dragleave', e => {
      if (!undatedZone.contains(e.relatedTarget)) {
        undatedZone.classList.remove('drag-over');
      }
    });
    undatedZone.addEventListener('drop', e => {
      e.preventDefault();
      undatedZone.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain') || _dragId;
      if (id) {
        try {
          actions.setDueDate(id, null);
        } catch {
          // no-op
        }
      }
      _dragId = null;
    });
  }
}
