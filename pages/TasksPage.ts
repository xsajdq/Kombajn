

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import { renderTaskCard } from '../components/TaskCard.ts';
import type { Task, User } from '../types.ts';
import { can } from '../permissions.ts';
import { openTaskDetail } from '../handlers/tasks.ts';

declare const Gantt: any;

let ganttChart: any = null;

function getFilteredTasks(): Task[] {
    const { text, assigneeId, priority, projectId, status, dateRange } = state.ui.taskFilters;
    let allTasks = state.tasks.filter(task => task.workspaceId === state.activeWorkspaceId && !task.parentId);

    // --- NEW: Data Segregation for Clients ---
    // If the current user is a client, only show them tasks from projects they are a member of.
    const member = state.workspaceMembers.find(m => m.userId === state.currentUser?.id && m.workspaceId === state.activeWorkspaceId);
    if (member && member.role === 'client' && state.currentUser) {
        const clientProjectIds = new Set(state.projectMembers.filter(pm => pm.userId === state.currentUser!.id).map(pm => pm.projectId));
        allTasks = allTasks.filter(task => clientProjectIds.has(task.projectId));
    }
    // --- END of new logic ---

    if (!text && !assigneeId && !priority && !projectId && !status && dateRange === 'all') {
        return allTasks;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);


    return allTasks.filter(task => {
        const textMatch = !text || task.name.toLowerCase().includes(text.toLowerCase()) || (task.description && task.description.toLowerCase().includes(text.toLowerCase()));
        const assigneeMatch = !assigneeId || state.taskAssignees.some(a => a.taskId === task.id && a.userId === assigneeId);
        const priorityMatch = !priority || task.priority === priority;
        const projectMatch = !projectId || task.projectId === projectId;
        const statusMatch = !status || task.status === status;
        
        let dateMatch = true;
        if (dateRange !== 'all') {
            if (!task.dueDate) {
                dateMatch = false; // Tasks without a due date don't match specific date filters
            } else {
                 const dueDate = new Date(task.dueDate + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues
                 switch (dateRange) {
                    case 'today':
                        dateMatch = dueDate.getTime() === today.getTime();
                        break;
                    case 'tomorrow':
                        dateMatch = dueDate.getTime() === tomorrow.getTime();
                        break;
                    case 'yesterday':
                         dateMatch = dueDate.getTime() === yesterday.getTime();
                        break;
                    case 'this_week':
                        dateMatch = dueDate >= startOfWeek && dueDate <= endOfWeek;
                        break;
                    case 'overdue':
                        dateMatch = dueDate < today && task.status !== 'done';
                        break;
                }
            }
        }

        return textMatch && assigneeMatch && priorityMatch && projectMatch && statusMatch && dateMatch;
    });
}


function renderBoardView(filteredTasks: Task[]) {
    const isWorkflowAdvanced = state.settings.defaultKanbanWorkflow === 'advanced';
    
    const tasksByStatus: { [key in Task['status']]: Task[] } = {
        backlog: [], todo: [], inprogress: [], inreview: [], done: [],
    };

    filteredTasks.forEach(task => {
        if (tasksByStatus[task.status]) {
            tasksByStatus[task.status].push(task);
        }
    });

    const columnsToShow: Task['status'][] = isWorkflowAdvanced
        ? ['backlog', 'todo', 'inprogress', 'inreview', 'done']
        : ['todo', 'inprogress', 'done'];
        
    return `
    <div class="kanban-board ${isWorkflowAdvanced ? 'workflow-advanced' : ''}">
        ${columnsToShow.map(status => {
            const columnTasks = tasksByStatus[status];
            const totalSeconds = columnTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
            
            let columnHeaderExtras = `(${columnTasks.length})`;
            if (totalSeconds > 0) {
                 columnHeaderExtras += ` <span class="kanban-column-total-time">${formatDuration(totalSeconds)}</span>`;
            }

            return `
                <div class="kanban-column" data-status="${status}">
                    <h4>${t('tasks.' + status)} ${columnHeaderExtras}</h4>
                    <div class="kanban-tasks">
                        ${columnTasks.map(renderTaskCard).join('') || '<div class="empty-kanban-column"></div>'}
                    </div>
                </div>
                `;
        }).join('')}
    </div>
    `;
}

function renderListView(filteredTasks: Task[]) {
    if (filteredTasks.length === 0) {
        return `<div class="empty-state">
            <span class="material-icons-sharp">search_off</span>
            <h3>${t('tasks.no_tasks_match_filters')}</h3>
        </div>`;
    }

    return `
        <div class="task-list-container card">
            <div class="task-list-header">
                <div class="task-list-col">${t('tasks.col_task')}</div>
                <div class="task-list-col">${t('tasks.col_project')}</div>
                <div class="task-list-col">${t('modals.assignees')}</div>
                <div class="task-list-col">${t('tasks.col_due_date')}</div>
                <div class="task-list-col">${t('tasks.col_priority')}</div>
                <div class="task-list-col">${t('tasks.col_status')}</div>
                <div class="task-list-col">${t('tasks.col_time')}</div>
            </div>
            <div class="task-list-body">
                ${filteredTasks.map(task => {
                    const project = state.projects.find(p => p.id === task.projectId);
                    const taskAssignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
                    const isRunning = !!state.activeTimers[task.id];

                    const taskTagsIds = new Set(state.taskTags.filter(tt => tt.taskId === task.id).map(tt => tt.tagId));
                    const tags = state.tags.filter(tag => taskTagsIds.has(tag.id));

                    const subtasks = state.tasks.filter(t => t.parentId === task.id);
                    const completedSubtasks = subtasks.filter(t => t.status === 'done').length;
                    const attachments = state.attachments.filter(a => a.taskId === task.id);
                    const dependencies = state.dependencies.filter(d => d.blockedTaskId === task.id || d.blockingTaskId === task.id);

                    return `
                        <div class="task-list-row clickable" data-task-id="${task.id}" role="button" tabindex="0">
                             <div class="task-list-col" data-label="${t('tasks.col_task')}">
                                <div class="task-name-wrapper">
                                    <strong>${task.name}</strong>
                                    ${tags.length > 0 ? `
                                        <div class="tag-list" style="margin-top: 0.5rem;">
                                            ${tags.map(tag => `<div class="tag-chip" style="background-color: ${tag.color}1A; color: ${tag.color};">${tag.name}</div>`).join('')}
                                        </div>
                                    ` : ''}
                                    <div class="task-meta-icons">
                                        ${subtasks.length > 0 ? `
                                            <span title="${t('modals.subtasks')}">
                                                <span class="material-icons-sharp">checklist</span>
                                                ${t('tasks.subtask_progress').replace('{completed}', completedSubtasks.toString()).replace('{total}', subtasks.length.toString())}
                                            </span>` : ''}
                                        ${attachments.length > 0 ? `<span title="${t('modals.attachments')}"><span class="material-icons-sharp">attachment</span> ${attachments.length}</span>` : ''}
                                        ${dependencies.length > 0 ? `<span title="${t('modals.dependencies')}"><span class="material-icons-sharp">link</span> ${dependencies.length}</span>` : ''}
                                        ${task.recurrence && task.recurrence !== 'none' ? `<span title="${t('modals.repeat')}"><span class="material-icons-sharp">repeat</span></span>` : ''}
                                    </div>
                                </div>
                             </div>
                             <div class="task-list-col" data-label="${t('tasks.col_project')}">${project?.name || t('misc.not_applicable')}</div>
                             <div class="task-list-col" data-label="${t('modals.assignees')}">
                                <div class="avatar-stack">
                                    ${taskAssignees.length > 0 ? taskAssignees.map(assignee => `
                                        <div class="avatar" title="${assignee!.name || assignee!.initials}">${assignee!.initials}</div>
                                    `).join('') : `
                                        <div class="avatar-placeholder" title="${t('tasks.unassigned')}">
                                            <span class="material-icons-sharp icon-sm">person_outline</span>
                                        </div>
                                    `}
                                </div>
                             </div>
                             <div class="task-list-col" data-label="${t('tasks.col_due_date')}">${task.dueDate ? formatDate(task.dueDate) : t('misc.not_applicable')}</div>
                             <div class="task-list-col" data-label="${t('tasks.col_priority')}">${task.priority ? `<span class="priority-badge priority-${task.priority}">${t('tasks.priority_' + task.priority)}</span>` : t('tasks.priority_none')}</div>
                             <div class="task-list-col" data-label="${t('tasks.col_status')}"><span class="status-badge status-${task.status}">${t('tasks.' + task.status)}</span></div>
                             <div class="task-list-col task-time-col" data-label="${t('tasks.col_time')}">
                                 <span class="task-tracked-time">${formatDuration(getTaskCurrentTrackedSeconds(task))}</span>
                                 <button class="btn-icon timer-controls ${isRunning ? 'running' : ''}" data-timer-task-id="${task.id}" aria-label="${isRunning ? t('tasks.stop_timer') : t('tasks.start_timer')}">
                                    <span class="material-icons-sharp">${isRunning ? 'pause_circle_filled' : 'play_circle_filled'}</span>
                                </button>
                             </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderCalendarView(filteredTasks: Task[]) {
    const [year, month] = state.ui.calendarDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, 1);
    const monthName = currentDate.toLocaleString(state.settings.language, { month: 'long', year: 'numeric' });

    const tasksByDay: Record<number, Task[]> = {};
    filteredTasks.forEach(task => {
        if (task.dueDate && task.dueDate.startsWith(state.ui.calendarDate)) {
            const day = parseInt(task.dueDate.slice(8, 10), 10);
            if (!tasksByDay[day]) {
                tasksByDay[day] = [];
            }
            tasksByDay[day].push(task);
        }
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // Sunday - 0, Monday - 1
    let daysHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
        daysHtml += `<div class="calendar-day other-month"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const tasksForDay = tasksByDay[day] || [];
        daysHtml += `
            <div class="calendar-day">
                <div class="day-number">${day}</div>
                <div class="calendar-tasks">
                    ${tasksForDay.map(task => `
                        <div class="calendar-task clickable priority-${task.priority || 'low'}" data-task-id="${task.id}" role="button" tabindex="0" title="${task.name}">
                           ${task.name}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const totalCells = firstDayIndex + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        daysHtml += `<div class="calendar-day other-month"></div>`;
    }

    return `
        <div class="card">
            <div class="calendar-header">
                <button class="btn-icon" data-calendar-nav="prev" aria-label="${t('calendar.prev_month')}"><span class="material-icons-sharp">chevron_left</span></button>
                <h4 class="calendar-title">${monthName}</h4>
                <button class="btn-icon" data-calendar-nav="next" aria-label="${t('calendar.next_month')}"><span class="material-icons-sharp">chevron_right</span></button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-weekday">${t('calendar.weekdays.sun')}</div>
                <div class="calendar-weekday">${t('calendar.weekdays.mon')}</div>
                <div class="calendar-weekday">${t('calendar.weekdays.tue')}</div>
                <div class="calendar-weekday">${t('calendar.weekdays.wed')}</div>
                <div class="calendar-weekday">${t('calendar.weekdays.thu')}</div>
                <div class="calendar-weekday">${t('calendar.weekdays.fri')}</div>
                <div class="calendar-weekday">${t('calendar.weekdays.sat')}</div>
                ${daysHtml}
            </div>
        </div>
    `;
}

function renderGanttView() {
    return `<div id="gantt-chart-container"><svg id="gantt-chart"></svg></div>`;
}

export function initTasksPage() {
    if (state.ui.tasksViewMode !== 'gantt') {
        ganttChart = null; // Destroy gantt instance if we switch away
        return;
    }

    const container = document.getElementById('gantt-chart');
    if (!container) return;

    const filteredTasks = getFilteredTasks();
    const tasksForGantt = filteredTasks
        .filter(t => t.startDate && t.dueDate)
        .map(t => {
            const dependencies = state.dependencies
                .filter(d => d.blockedTaskId === t.id)
                .map(d => d.blockingTaskId);

            return {
                id: t.id,
                name: t.name,
                start: t.startDate!,
                end: t.dueDate!,
                progress: t.status === 'done' ? 100 : (t.status === 'inprogress' || t.status === 'inreview' ? 50 : 0),
                dependencies: dependencies.join(','),
                custom_class: `priority-${t.priority || 'low'}`
            };
        });

    if (tasksForGantt.length > 0) {
        ganttChart = new Gantt("#gantt-chart", tasksForGantt, {
            on_click: (task: any) => {
                openTaskDetail(task.id);
            },
            on_date_change: (task: any, start: Date, end: Date) => {
                // Optional: handle date changes from dragging in Gantt
            },
            language: state.settings.language,
        });
    } else {
        container.innerHTML = `<div class="empty-state">
            <span class="material-icons-sharp">search_off</span>
            <h3>${t('tasks.no_tasks_match_filters')}</h3>
        </div>`;
    }
}

export function TasksPage() {
    const filteredTasks = getFilteredTasks();
    const activeWorkspaceId = state.activeWorkspaceId;

    let viewContent = '';
    if (state.tasks.filter(t => t.workspaceId === activeWorkspaceId && !t.parentId).length === 0) {
        viewContent = `<div class="empty-state">
            <span class="material-icons-sharp">assignment</span>
            <h3>${t('tasks.no_tasks_found')}</h3>
            <button class="btn btn-primary" data-modal-target="addTask">${t('tasks.new_task')}</button>
        </div>`;
    } else {
        switch (state.ui.tasksViewMode) {
            case 'board': viewContent = renderBoardView(filteredTasks); break;
            case 'list': viewContent = renderListView(filteredTasks); break;
            case 'calendar': viewContent = renderCalendarView(filteredTasks); break;
            case 'gantt': viewContent = renderGanttView(); break;
        }
    }
    
    const { text, assigneeId, priority, projectId, status, dateRange } = state.ui.taskFilters;
    const filtersActive = !!(text || assigneeId || priority || projectId || status || dateRange !== 'all');

    const workspaceUsers = state.workspaceMembers
        .filter(m => m.workspaceId === activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean) as User[];
    
    const workspaceProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId);
    const statuses: Task['status'][] = ['backlog', 'todo', 'inprogress', 'inreview', 'done'];


    const filterBar = `
        <div class="tasks-filter-bar card">
            <div class="form-group search-group">
                <input type="text" id="task-filter-text" class="form-control" placeholder="${t('tasks.search_placeholder')}" value="${text || ''}">
            </div>
            <div class="form-group">
                <select id="task-filter-project" class="form-control">
                    <option value="">${t('tasks.all_projects')}</option>
                    ${workspaceProjects.map(p => `<option value="${p.id}" ${projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <select id="task-filter-assignee" class="form-control">
                    <option value="">${t('tasks.all_assignees')}</option>
                    ${workspaceUsers.map(u => `<option value="${u.id}" ${assigneeId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <select id="task-filter-priority" class="form-control">
                    <option value="">${t('tasks.all_priorities')}</option>
                    <option value="low" ${priority === 'low' ? 'selected' : ''}>${t('tasks.priority_low')}</option>
                    <option value="medium" ${priority === 'medium' ? 'selected' : ''}>${t('tasks.priority_medium')}</option>
                    <option value="high" ${priority === 'high' ? 'selected' : ''}>${t('tasks.priority_high')}</option>
                </select>
            </div>
             <div class="form-group">
                <select id="task-filter-status" class="form-control">
                    <option value="">${t('tasks.all_statuses')}</option>
                    ${statuses.map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${t('tasks.' + s)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <select id="task-filter-date-range" class="form-control">
                    <option value="all" ${dateRange === 'all' ? 'selected' : ''}>${t('tasks.date_all')}</option>
                    <option value="today" ${dateRange === 'today' ? 'selected' : ''}>${t('tasks.date_today')}</option>
                    <option value="tomorrow" ${dateRange === 'tomorrow' ? 'selected' : ''}>${t('tasks.date_tomorrow')}</option>
                    <option value="yesterday" ${dateRange === 'yesterday' ? 'selected' : ''}>${t('tasks.date_yesterday')}</option>
                    <option value="this_week" ${dateRange === 'this_week' ? 'selected' : ''}>${t('tasks.date_this_week')}</option>
                    <option value="overdue" ${dateRange === 'overdue' ? 'selected' : ''}>${t('tasks.date_overdue')}</option>
                </select>
            </div>
            ${filtersActive ? `<button class="btn-icon" id="reset-task-filters" aria-label="${t('tasks.reset_filters')}"><span class="material-icons-sharp">clear</span></button>`: ''}
        </div>
    `;

    const filterContainer = `
        <div class="tasks-filter-container ${state.ui.isTaskFilterOpen ? 'is-open' : ''}">
            ${filterBar}
        </div>
    `;

    return `
        <div>
            <div class="kanban-header">
                <h2>${t('tasks.title')}</h2>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="view-switcher">
                        <button class="btn-icon ${state.ui.tasksViewMode === 'board' ? 'active' : ''}" data-view-mode="board" aria-label="${t('tasks.board_view')}"><span class="material-icons-sharp">view_kanban</span></button>
                        <button class="btn-icon ${state.ui.tasksViewMode === 'list' ? 'active' : ''}" data-view-mode="list" aria-label="${t('tasks.list_view')}"><span class="material-icons-sharp">view_list</span></button>
                        <button class="btn-icon ${state.ui.tasksViewMode === 'calendar' ? 'active' : ''}" data-view-mode="calendar" aria-label="${t('tasks.calendar_view')}"><span class="material-icons-sharp">calendar_today</span></button>
                        <button class="btn-icon ${state.ui.tasksViewMode === 'gantt' ? 'active' : ''}" data-view-mode="gantt" aria-label="${t('tasks.gantt_view')}"><span class="material-icons-sharp">bar_chart</span></button>
                    </div>
                     <button id="toggle-filters-btn" class="btn btn-secondary">
                        <span class="material-icons-sharp">filter_list</span>
                        <span>${t('tasks.filters_button_text')}</span>
                    </button>
                    <button class="btn btn-secondary" data-modal-target="automations" ${!can('manage_automations') ? 'disabled' : ''}>
                        <span class="material-icons-sharp">smart_toy</span>
                        <span>${t('tasks.automations_button_text')}</span>
                    </button>
                    <button class="btn btn-primary" data-modal-target="addTask" ${!can('manage_tasks') ? 'disabled' : ''}>
                        <span class="material-icons-sharp">add</span> ${t('tasks.new_task')}
                    </button>
                </div>
            </div>
            ${filterContainer}
            ${viewContent}
        </div>
    `;
}