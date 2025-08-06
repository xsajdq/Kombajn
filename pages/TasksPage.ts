
import { getState, setState } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate, getUserInitials, filterItems } from '../utils.ts';
import { renderTaskCard } from '../components/TaskCard.ts';
import type { Task, User, ProjectSection, SortByOption, KanbanStage } from '../types.ts';
import { can } from '../permissions.ts';
import { openTaskDetail, fetchTasksForWorkspace } from '../handlers/tasks.ts';
import { getWorkspaceKanbanWorkflow } from '../handlers/main.ts';
import { TaskFilterPanel } from '../components/TaskFilterPanel.ts';

declare const Gantt: any;

let ganttChart: any = null;

function getFilteredTasks(): Task[] {
    const state = getState();
    const { assigneeId, dateRange, ...restFilters } = state.ui.tasks.filters;
    let allTasks = state.tasks.filter(task => task.workspaceId === state.activeWorkspaceId && !task.parentId);
    
    // 1. Initial filters that must be applied before the generic utility
    allTasks = allTasks.filter(task => !!task.isArchived === restFilters.isArchived);

    if (state.ui.activeTaskViewId) {
        allTasks = allTasks.filter(task => task.taskViewId === state.ui.activeTaskViewId);
    }

    const member = state.workspaceMembers.find(m => m.userId === state.currentUser?.id && m.workspaceId === state.activeWorkspaceId);
    if (member && member.role === 'client' && state.currentUser) {
        const clientProjectIds = new Set(state.projectMembers.filter(pm => pm.userId === state.currentUser!.id).map(pm => pm.projectId));
        allTasks = allTasks.filter(task => clientProjectIds.has(task.projectId));
    }
    
    // 2. Custom filters (assignee and date range)
    if (assigneeId) {
        allTasks = allTasks.filter(task => state.taskAssignees.some(a => a.taskId === task.id && a.userId === assigneeId));
    }
    
    if (dateRange !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        allTasks = allTasks.filter(task => {
            if (!task.dueDate) return false;
            const dueDate = new Date(task.dueDate + 'T00:00:00Z');
            switch (dateRange) {
                case 'today': return dueDate.getTime() === today.getTime();
                case 'tomorrow': 
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return dueDate.getTime() === tomorrow.getTime();
                case 'overdue': return dueDate < today && task.status !== 'done';
                // Add other date range cases here if needed
            }
            return true;
        });
    }

    // 3. Use the generic filter for the rest
    let filtered = filterItems<Task>(
        allTasks,
        restFilters,
        ['name', 'description'],
        state.taskTags,
        'taskId'
    );
    
    // 4. Sort the final filtered tasks
    const { sortBy } = state.ui.tasks;
    const priorityOrder = { high: 3, medium: 2, low: 1 };

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'dueDate':
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            case 'priority':
                const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
                const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
                return priorityB - priorityA;
            case 'name':
                return a.name.localeCompare(b.name);
            case 'createdAt':
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'manual':
            default:
                const sortOrderMap = new Map(
                    state.userTaskSortOrders
                        .filter(o => o.userId === state.currentUser?.id)
                        .map(o => [o.taskId, o.sortOrder])
                );
                const orderA = sortOrderMap.get(a.id) ?? Infinity;
                const orderB = sortOrderMap.get(b.id) ?? Infinity;
                return orderA - orderB;
        }
    });

    return filtered;
}

function renderBoardView(filteredTasks: Task[]) {
    const state = getState();
    const kanbanStages = state.kanbanStages
        .filter(s => s.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    if (kanbanStages.length === 0) {
        return `<div class="flex flex-col items-center justify-center h-full bg-content rounded-lg border-2 border-dashed border-border-color">
            <span class="material-icons-sharp text-5xl text-text-subtle">view_week</span>
            <h3 class="text-lg font-medium mt-4">${t('tasks.no_kanban_columns_title')}</h3>
            <p class="text-sm text-text-subtle mt-1">${t('tasks.no_kanban_columns_desc')}</p>
        </div>`;
    }

    const tasksByStatus: { [key in Task['status']]?: Task[] } = {};

    filteredTasks.forEach(task => {
        if (!tasksByStatus[task.status]) {
            tasksByStatus[task.status] = [];
        }
        tasksByStatus[task.status]!.push(task);
    });

    const renderColumn = (stage: KanbanStage) => {
        const columnTasks = tasksByStatus[stage.status] || [];
        const totalSeconds = columnTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
        
        return `
            <div class="tasks-board-column" data-status="${stage.status}">
                <div class="tasks-board-column-header">
                    <span>${stage.name} <span class="text-sm font-normal text-text-subtle">${columnTasks.length}</span></span>
                    ${totalSeconds > 0 ? `<span class="text-xs font-normal text-text-subtle">${formatDuration(totalSeconds)}</span>` : ''}
                </div>
                <div class="tasks-board-column-body">
                    ${columnTasks.map(renderTaskCard).join('') || '<div class="h-full"></div>'}
                </div>
            </div>
        `;
    };

    const boardHtml = kanbanStages.map(renderColumn).join('');
        
    return `
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
            <div class="tasks-board-container" style="grid-template-columns: repeat(${kanbanStages.length}, minmax(0, 1fr));">
                ${boardHtml}
            </div>
        </div>
    `;
}

function renderListView(filteredTasks: Task[], projectSections: ProjectSection[]) {
    if (filteredTasks.length === 0) {
        return `<div class="flex flex-col items-center justify-center h-96 bg-content rounded-lg">
            <span class="material-icons-sharp text-5xl text-text-subtle">search_off</span>
            <h3 class="text-lg font-medium mt-4">${t('tasks.no_tasks_match_filters')}</h3>
        </div>`;
    }

    const state = getState();
    const tasksBySection: Record<string, Task[]> = { 'no-section': [] };
    projectSections.forEach(ps => tasksBySection[ps.id] = []);

    filteredTasks.forEach(task => {
        const sectionId = task.projectSectionId || 'no-section';
        tasksBySection[sectionId] = tasksBySection[sectionId] || [];
        tasksBySection[sectionId].push(task);
    });

    const renderTaskRow = (task: Task) => {
        const project = state.projects.find(p => p.id === task.projectId);
        const assignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
        const trackedSeconds = getTaskCurrentTrackedSeconds(task);
        const priorityText = task.priority ? t(`tasks.priority_${task.priority}`) : t('tasks.priority_none');
        
        return `
            <tr data-task-id="${task.id}" class="cursor-pointer">
                <td data-label="${t('tasks.col_task')}" class="px-4 py-3 font-medium">${task.name}</td>
                <td data-label="${t('tasks.col_project')}" class="px-4 py-3 text-text-subtle">${project?.name || ''}</td>
                <td data-label="${t('tasks.col_assignee')}" class="px-4 py-3">
                    <div class="avatar-stack justify-end md:justify-start">
                         ${assignees.map(u => u ? `<div class="avatar-small" title="${u.name}">${getUserInitials(u)}</div>` : '').join('')}
                    </div>
                </td>
                <td data-label="${t('tasks.col_due_date')}" class="px-4 py-3 text-text-subtle">${task.dueDate ? formatDate(task.dueDate) : ''}</td>
                <td data-label="${t('tasks.col_priority')}" class="px-4 py-3">${priorityText}</td>
                <td data-label="${t('tasks.col_time')}" class="px-4 py-3 task-tracked-time">${trackedSeconds > 0 ? formatDuration(trackedSeconds) : ''}</td>
            </tr>
        `;
    };
    
    let tableRowsHtml = '';
    
    projectSections.forEach(section => {
        const tasks = tasksBySection[section.id];
        if (tasks && tasks.length > 0) {
            tableRowsHtml += `
                <tr class="task-section-header-row">
                    <th colspan="6">
                        <div class="flex items-center gap-2">
                           <h4 class="font-semibold">${section.name}</h4>
                           <span class="text-sm font-normal text-text-subtle">${tasks.length}</span>
                        </div>
                    </th>
                </tr>
                ${tasks.map(renderTaskRow).join('')}
            `;
        }
    });

    if (tasksBySection['no-section'] && tasksBySection['no-section'].length > 0) {
         tableRowsHtml += `
            <tr class="task-section-header-row">
                <th colspan="6">
                    <div class="flex items-center gap-2">
                        <h4 class="font-semibold">${t('tasks.default_board')}</h4>
                        <span class="text-sm font-normal text-text-subtle">${tasksBySection['no-section'].length}</span>
                    </div>
                </th>
            </tr>
            ${tasksBySection['no-section'].map(renderTaskRow).join('')}
        `;
    }


    return `
        <div class="bg-content rounded-lg shadow-sm overflow-x-auto">
             <table class="w-full text-sm responsive-table">
                <thead class="text-xs text-text-subtle uppercase bg-background">
                    <tr>
                        <th class="px-4 py-2 text-left">${t('tasks.col_task')}</th>
                        <th class="px-4 py-2 text-left">${t('tasks.col_project')}</th>
                        <th class="px-4 py-2 text-left">${t('tasks.col_assignee')}</th>
                        <th class="px-4 py-2 text-left">${t('tasks.col_due_date')}</th>
                        <th class="px-4 py-2 text-left">${t('tasks.col_priority')}</th>
                        <th class="px-4 py-2 text-left">${t('tasks.col_time')}</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-border-color">
                   ${tableRowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function renderCalendarView(filteredTasks: Task[]) {
    const state = getState();
    const calendarDate = new Date(state.ui.calendarDate + '-15T12:00:00Z');
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const calendarStartDate = new Date(firstDayOfMonth);
    calendarStartDate.setDate(calendarStartDate.getDate() - (firstDayOfMonth.getDay() + 6) % 7);

    const weeks: Date[][] = [];
    let currentDateIterator = new Date(calendarStartDate);
    while(currentDateIterator <= lastDayOfMonth || (weeks.length < 6 && weeks[weeks.length-1].length < 7)) {
        const week: Date[] = [];
        for (let j = 0; j < 7; j++) {
            week.push(new Date(currentDateIterator));
            currentDateIterator.setDate(currentDateIterator.getDate() + 1);
        }
        weeks.push(week);
        if(weeks.length === 6 && week[6] >= lastDayOfMonth) break;
    }

    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    return `
        <div class="bg-content rounded-lg shadow-sm flex flex-col h-full">
            <div class="p-3 border-b border-border-color flex justify-between items-center">
                <h4 class="font-semibold">${firstDayOfMonth.toLocaleString(state.settings.language, { month: 'long', year: 'numeric' })}</h4>
                <div class="flex items-center">
                    <button class="p-1.5 rounded-full hover:bg-background text-text-subtle" data-calendar-nav="prev" aria-label="${t('calendar.prev_month')}"><span class="material-icons-sharp">chevron_left</span></button>
                    <button class="p-1.5 rounded-full hover:bg-background text-text-subtle" data-calendar-nav="next" aria-label="${t('calendar.next_month')}"><span class="material-icons-sharp">chevron_right</span></button>
                </div>
            </div>
            <div class="grid grid-cols-7 flex-grow">
                ${weekdays.map(day => `<div class="py-2 text-center text-xs font-semibold text-text-subtle border-b border-r border-border-color">${t(`calendar.weekdays.${day}`)}</div>`).join('')}
                ${weeks.flat().map(day => {
                    const dayStr = day.toISOString().slice(0, 10);
                    const tasksForDay = filteredTasks.filter(t => t.dueDate === dayStr);
                    const isCurrentMonth = day.getMonth() === month;
                    const isToday = day.getTime() === today.getTime();
                    
                    return `
                        <div class="border-r border-b border-border-color p-2 ${isCurrentMonth ? '' : 'bg-background/50 text-text-subtle'} ${isToday ? 'bg-primary/5' : ''}">
                            <div class="text-sm text-right font-semibold ${isToday ? 'text-primary' : ''}">${day.getDate()}</div>
                            <div class="space-y-1 mt-1">
                                ${tasksForDay.map(task => `<div class="p-1 text-xs bg-primary/10 text-primary rounded truncate cursor-pointer" data-task-id="${task.id}">${task.name}</div>`).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderGanttView(filteredTasks: Task[]) {
    return `<div class="gantt-container bg-content rounded-lg shadow-sm" id="gantt-chart"></div>`;
}

function renderWorkloadView(filteredTasks: Task[]) {
    const state = getState();
    const users = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u);
    
    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
    });

    return `
        <div class="bg-content rounded-lg shadow-sm overflow-x-auto">
            <div class="workload-grid-container">
                <div class="workload-header workload-user-header"></div>
                ${dates.map(d => `<div class="workload-header">${d.toLocaleDateString(state.settings.language, { weekday: 'short' })} ${d.getDate()}</div>`).join('')}

                ${users.map(user => {
                    const userRow = `<div class="workload-user-cell">${user.name}</div>`;
                    const dayCells = dates.map(date => {
                        const dateStr = date.toISOString().slice(0, 10);
                        const tasksForDay = filteredTasks.filter(task => 
                            task.dueDate === dateStr &&
                            state.taskAssignees.some(a => a.taskId === task.id && a.userId === user.id)
                        );
                        const taskCount = tasksForDay.length;
                        let cellClass = '';
                        if (taskCount > 3) cellClass = 'bg-danger/10';
                        else if (taskCount > 1) cellClass = 'bg-warning/10';
                        
                        return `
                            <div class="workload-day-cell ${cellClass}">
                                ${tasksForDay.map(t => `<div class="workload-task-item" data-task-id="${t.id}">${t.name}</div>`).join('')}
                            </div>
                        `;
                    }).join('');
                    return userRow + dayCells;
                }).join('')}
            </div>
        </div>
    `;
}

function destroyGanttChart() {
    if (ganttChart) {
        ganttChart.clear();
        ganttChart = null;
    }
    const container = document.getElementById('gantt-chart');
    if (container) container.innerHTML = '';
}

export async function initTasksPage() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    destroyGanttChart();

    if (state.ui.tasks.loadedWorkspaceId !== activeWorkspaceId) {
        setState(prevState => ({
            ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, isLoading: true, loadedWorkspaceId: activeWorkspaceId } }
        }), ['page']);
        await fetchTasksForWorkspace(activeWorkspaceId);
    }
    
    // Check state again after potential async operation
    const currentState = getState();
    if (currentState.ui.tasks.viewMode === 'gantt' && !currentState.ui.tasks.isLoading) {
        const ganttContainer = document.getElementById('gantt-chart');
        if (ganttContainer) {
            const tasksForGantt = getFilteredTasks()
                .filter(t => t.startDate && t.dueDate)
                .map(t => ({
                    id: t.id,
                    name: t.name,
                    start: t.startDate!,
                    end: t.dueDate!,
                    progress: t.progress || 0,
                }));
            
            if (tasksForGantt.length > 0) {
                ganttChart = new Gantt("#gantt-chart", tasksForGantt, {
                    on_click: (task: any) => openTaskDetail(task.id),
                    bar_height: 20,
                    bar_corner_radius: 4,
                    view_mode: currentState.ui.tasks.ganttViewMode,
                    language: currentState.settings.language,
                });
            }
        }
    }
}

export function TasksPage() {
    const state = getState();
    const { isFilterOpen, viewMode: globalViewMode, ganttViewMode, sortBy, isLoading } = state.ui.tasks;
    const canManage = can('manage_tasks');

    if (isLoading) {
        return `<div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>`;
    }

    const filteredTasks = getFilteredTasks();
    const { projectId } = state.ui.tasks.filters;
    const projectSections = state.projectSections.filter(ps => !projectId || ps.projectId === projectId);

    
    let content = '';
    const viewMode = state.ui.activeTaskViewId ? 'board' : globalViewMode;

    switch (viewMode) {
        case 'board': content = renderBoardView(filteredTasks); break;
        case 'list': content = renderListView(filteredTasks, projectSections); break;
        case 'calendar': content = renderCalendarView(filteredTasks); break;
        case 'gantt': content = renderGanttView(filteredTasks); break;
        case 'workload': content = renderWorkloadView(filteredTasks); break;
        default: content = renderBoardView(filteredTasks);
    }

    const navItems = [
        { id: 'board', icon: 'view_kanban', text: t('tasks.board_view') },
        { id: 'list', icon: 'view_list', text: t('tasks.list_view') },
        { id: 'calendar', icon: 'calendar_month', text: t('tasks.calendar_view') },
        { id: 'gantt', icon: 'bar_chart', text: t('tasks.gantt_view') },
        { id: 'workload', icon: 'groups', text: t('tasks.workload_view') },
    ];
    
    const sortOptions: { id: SortByOption, text: string }[] = [
        { id: 'manual', text: t('tasks.sort_manual') },
        { id: 'dueDate', text: t('tasks.sort_due_date') },
        { id: 'priority', text: t('tasks.sort_priority') },
        { id: 'name', text: t('tasks.sort_name') },
        { id: 'createdAt', text: t('tasks.sort_created_at') },
    ];

    return `
        <div class="h-full flex flex-col">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 class="text-2xl font-bold">${state.ui.activeTaskViewId ? state.taskViews.find(tv => tv.id === state.ui.activeTaskViewId)?.name : t('tasks.title')}</h2>
                <div class="flex items-center gap-2">
                    <div class="p-1 bg-content border border-border-color rounded-lg flex items-center">
                         ${navItems.map(item => `
                             <button class="px-3 py-1 text-sm font-medium rounded-md ${viewMode === item.id ? 'bg-background shadow-sm' : 'text-text-subtle'}" data-view-mode="${item.id}">${item.text}</button>
                        `).join('')}
                    </div>
                     <div class="relative">
                        <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-menu-toggle="task-sort-menu" aria-haspopup="true" aria-expanded="false">
                            <span class="material-icons-sharp text-base">sort</span>
                            <span>${t('tasks.sort_by')}: ${sortOptions.find(s => s.id === sortBy)?.text}</span>
                        </button>
                        <div id="task-sort-menu" class="dropdown-menu absolute top-full right-0 mt-1 w-48 bg-content rounded-md shadow-lg border border-border-color z-10 hidden">
                             <div class="py-1">
                                ${sortOptions.map(opt => `
                                    <button class="w-full text-left flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-background" data-sort-by="${opt.id}">
                                        <span>${opt.text}</span>
                                        ${sortBy === opt.id ? '<span class="material-icons-sharp text-base">check</span>' : ''}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-toggle-task-filters>
                        <span class="material-icons-sharp text-base">filter_list</span>
                        <span>${t('tasks.filters_button_text')}</span>
                    </button>
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="automations">
                        <span class="material-icons-sharp text-base">smart_toy</span>
                        <span>${t('tasks.automations_button_text')}</span>
                    </button>
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addTask" ${!canManage ? 'disabled' : ''}>
                        <span class="material-icons-sharp text-base">add</span> ${t('tasks.new_task')}
                    </button>
                </div>
            </div>
            
            <div id="task-filter-panel" class="bg-content p-4 rounded-lg shadow-sm border border-border-color mb-4 ${isFilterOpen ? '' : 'hidden'}">
                ${TaskFilterPanel()}
            </div>

            ${content}
        </div>
    `;
}
