/**
 * src/seed.js
 * Demo dataset — 10 varied tasks for Frankenboard.
 * Statuses, priorities, due dates, and tags are spread for all three views.
 */

/**
 * Return 10 demo tasks (without ids — the store assigns them on import).
 * Dates are relative to 2026-11-12 (Kiroween build date) so the calendar
 * view has tasks on recognisable days.
 *
 * @returns {object[]}
 */
export function seedTasks() {
  return [
    {
      title:    'Stitch the monster together',
      notes:    'Combine all three views into one coherent dataset.',
      status:   'doing',
      priority: 'high',
      dueDate:  '2026-11-12',
      tags:     ['lab', 'core'],
    },
    {
      title:    'Brew the green potion',
      notes:    'Mix localStorage persistence with live re-renders.',
      status:   'done',
      priority: 'high',
      dueDate:  '2026-11-10',
      tags:     ['lab', 'potion'],
    },
    {
      title:    'Haunt the spreadsheet',
      notes:    'Implement inline editing for the sheet view.',
      status:   'doing',
      priority: 'medium',
      dueDate:  '2026-11-14',
      tags:     ['haunt', 'sheet'],
    },
    {
      title:    'Raise the kanban board',
      notes:    'Drag cards between To do, Doing, Done columns.',
      status:   'todo',
      priority: 'medium',
      dueDate:  '2026-11-16',
      tags:     ['board'],
    },
    {
      title:    'Summon the calendar grid',
      notes:    'Month grid with due-date cells and undated strip.',
      status:   'todo',
      priority: 'medium',
      dueDate:  '2026-11-18',
      tags:     ['calendar'],
    },
    {
      title:    'Bolt on keyboard shortcuts',
      notes:    'n = new task, / = search, 1/2/3 = view switch.',
      status:   'todo',
      priority: 'low',
      dueDate:  '2026-11-20',
      tags:     ['ux'],
    },
    {
      title:    'Write property-based tests',
      notes:    'fast-check: no drift invariant over random op sequences.',
      status:   'todo',
      priority: 'high',
      dueDate:  '2026-11-22',
      tags:     ['lab', 'tests'],
    },
    {
      title:    'Apply graveyard palette',
      notes:    'Near-black, bone, monster-green, bruise-purple, warning-orange.',
      status:   'done',
      priority: 'low',
      dueDate:  null,
      tags:     ['design'],
    },
    {
      title:    'Ship to GitHub Pages',
      notes:    'Static host, zero deps, works offline after first load.',
      status:   'todo',
      priority: 'medium',
      dueDate:  '2026-11-30',
      tags:     ['deploy'],
    },
    {
      title:    'Survive the judges',
      notes:    'Demo all three faces, show no-drift in real time.',
      status:   'todo',
      priority: 'high',
      dueDate:  null,
      tags:     ['haunt', 'demo'],
    },
  ];
}
