

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import { renderTaskCard } from '../components/TaskCard.ts';
import type { Task, User, ProjectSection, SortByOption } from '../types.ts';
import { can } from '../permissions.ts';
import { openTaskDetail } from '../handlers/tasks.ts';
import { getWorkspaceKanbanWorkflow, fetchTasksData } from '../handlers/main.ts';
import { TaskFilterPanel } from '../components/TaskFilterPanel.ts';

declare const Gantt: any;

let ganttChart: any = null;

function getFilteredTasks(): Task[] {
    const { text, assigneeId, priority, projectId, status, dateRange, tagIds, isArchived } = state.ui.tasks.filters;
    let allTasks = state.tasks.filter(task => task.workspaceId === state.activeWorkspaceId && !task.parentId);
    
    // Filter by archived status first
    allTasks = allTasks.filter(task => !!task.isArchived === isArchived);

    // Filter by the active custom Task View if one is selected
    if (state.ui.activeTaskViewId) {
        allTasks = allTasks.filter(task => task.taskViewId === state.ui.activeTaskViewId);
    }

    const member = state.workspaceMembers.find(m => m.userId === state.currentUser?.id && m.workspaceId === state.activeWorkspaceId);
    if (member && member.role === 'client' && state.currentUser) {
        const clientProjectIds = new Set(state.projectMembers.filter(pm => pm.userId === state.currentUser!.id).map(pm => pm.projectId));
        allTasks = allTasks.filter(task => clientProjectIds.has(task.projectId));
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

    let filtered = allTasks.filter(task => {
        const textMatch = !text || task.name.toLowerCase().includes(text.toLowerCase()) || (task.description && task.description.toLowerCase().includes(text.toLowerCase()));
        const assigneeMatch = !assigneeId || state.taskAssignees.some(a => a.taskId === task.id && a.userId === assigneeId);
        const priorityMatch = !priority || task.priority === priority;
        const projectMatch = !projectId || task.projectId === projectId;
        const statusMatch = !status || task.status === status;
        
        let dateMatch = true;
        if (dateRange !== 'all') {
            if (!task.dueDate) {
                dateMatch = false;
            } else {
                 const dueDate = new Date(task.dueDate + 'T00:00:00');
                 switch (dateRange) {
                    case 'today': dateMatch = dueDate.getTime() === today.getTime(); break;
                    case 'tomorrow': dateMatch = dueDate.getTime() === tomorrow.getTime(); break;
                    case 'yesterday': dateMatch = dueDate.getTime() === yesterday.getTime(); break;
                    case 'this_week': dateMatch = dueDate >= startOfWeek && dueDate <= endOfWeek; break;
                    case 'overdue': dateMatch = dueDate < today && task.status !== 'done'; break;
                }
            }
        }

        return textMatch && assigneeMatch && priorityMatch && projectMatch && statusMatch && dateMatch;
    });

    if (tagIds && tagIds.length > 0) {
        const tasksWithMatchingTags = new Set(
            state.taskTags
                .filter(tt => tagIds.includes(tt.tagId))
                .map(tt => tt.taskId)
        );
        filtered = filtered.filter(task => tasksWithMatchingTags.has(task.id));
    }
    
    // Sort the filtered tasks
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
    const isWorkflowAdvanced = getWorkspaceKanbanWorkflow(state.activeWorkspaceId) === 'advanced';
    
    const tasksByStatus: { [key in Task['status']]: Task[] } = {
        backlog: [], todo: [], inprogress: [], inreview: [], done: [],
    };

    filteredTasks.forEach(task => {
        if (tasksByStatus[task.status]) {
            tasksByStatus[task.status].push(task);
        }
    });

    const columnsToRender: Task['status'][] = isWorkflowAdvanced
        ? ['backlog', 'todo', 'inprogress', 'inreview', 'done']
        : ['todo', 'inprogress', 'done'];
        
    const renderColumn = (status: Task['status']) => {
        const columnTasks = tasksByStatus[status];
        const totalSeconds = columnTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
        
        return `
            <div class="tasks-board-column" data-status="${status}">
                <div class="tasks-board-column-header">
                    <span>${t('tasks.' + status)} <span class="text-sm font-normal text-text-subtle">${columnTasks.length}</span></span>
                    ${totalSeconds > 0 ? `<span class="text-xs font-normal text-text-subtle">${formatDuration(totalSeconds)}</span>` : ''}
                </div>
                <div class="tasks-board-column-body">
                    ${columnTasks.map(renderTaskCard).join('') || '<div class="h-full"></div>'}
                </div>
            </div>
            `;
    };

    const boardHtml = columnsToRender.map(renderColumn).join('');
        
    return `
    <div class="flex-1 overflow-y-auto">
        <div class="tasks-board-container">
            ${boardHtml}
        </div>
    </div>
    `;
}

function renderListView(filteredTasks: Task[]) {
    if (filteredTasks.length === 0) {
        return `<div class="flex flex-col items-center justify-center h-96 bg-content rounded-lg">
            <span class="material-icons-sharp text-5xl text-text-subtle">search_off</span>
            <h3 class="text-lg font-medium mt-4">${t('tasks.no_tasks_match_filters')}</h3>
        </div>`;
    }

    const { projectId } = state.ui.tasks.filters;
    
    // If a project is selected, group by Project Sections
    if (projectId) {
        const projectSections = state.projectSections.filter(ps => ps.projectId === projectId);
        const tasksBySection: Record<string, Task[]> = { 'no-section': [] };
        projectSections.forEach(ps => tasksBySection[ps.id] = []);

        filteredTasks.forEach(task => {
            if (task.projectSectionId && tasksBySection[task.projectSectionId]) {
                tasksBySection[task.projectSectionId].push(task);
            } else {
                tasksBySection['no-section'].push(task);
            }
        });

        const renderSection = (section: ProjectSection | null, tasks: Task[]) => {
            const sectionName = section ? section.name : t('tasks.default_board');
            const sectionId = section ? section.id : 'no-section';
            if (tasks.length === 0 && !section) return ''; // Don't render "Default" if it's empty

            return `
                <details class="task-section" open>
                    <summary class="task-section-header">
                        <div class="flex items-center gap-2">
                            <span class="material-icons-sharp">keyboard_arrow_down</span>
                            <h4 class="font-semibold">${sectionName}</h4>
                            <span class="text-sm text-text-subtle">${tasks.length}</span>
                        </div>
                         ${section ? `
                            <div class="relative">
                                <button class="btn-icon task-section-menu-btn" data-menu-toggle="project-section-menu-${sectionId}">
                                    <span class="material-icons-sharp">more_horiz</span>
                                </button>
                                <div id="project-section-menu-${sectionId}" class="absolute top-full right-0 mt-1 w-40 bg-content rounded-md shadow-lg border border-border-color z-10 hidden">
                                    <div class="py-1">
                                        <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-rename-project-section-id="${sectionId}">${t('modals.rename')}</button>
                                        <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger/10" data-delete-project-section-id="${sectionId}">${t('modals.delete')}</button>
                                    </div>
                                </div>
                            </div>
                         ` : ''}
                    </summary>
                    <div class="task-section-body">
                        ${tasks.map(renderRow).join('')}
                    </div>
                </details>
            `;
        };

        return `
            <div class="bg-content rounded-lg shadow-sm">
                ${renderListHeader()}
                <div>
                    ${projectSections.map(section => renderSection(section, tasksBySection[section.id])).join('')}
                    ${renderSection(null, tasksBySection['no-section'])}
                </div>
                <button class="w-full text-left p-2 text-sm text-text-subtle hover:bg-background" id="add-project-section-btn" data-project-id="${projectId}">
                    + Add Section
                </button>
            </div>
        `;

    }

    // Default view (all projects)
    return `
        <div class="bg-content rounded-lg shadow-sm">
            ${renderListHeader()}
            <div>
                ${filteredTasks.map(renderRow).join('')}
            </div>
        </div>
    `;
}

function renderListHeader() {
    return `
        <div class="grid grid-cols-[3fr,1fr,1fr,1fr,1fr,1fr,1fr] p-3 border-b border-border-color text-xs font-semibold text-text-subtle uppercase">
            <div>${t('tasks.col_task')}</div>
            <div>${t('tasks.col_project')}</div>
            <div>${t('modals.assignees')}</div>
            <div>${t('tasks.col_due_date')}</div>
            <div>${t('tasks.col_priority')}</div>
            <div>${t('tasks.col_status')}</div>
            <div class="text-right">${t('tasks.col_time')}</div>
        </div>
    `;
}

function renderRow(task: Task) {
    const project = state.projects.find(p => p.id === task.projectId);
    const taskAssignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
    const isRunning = !!state.activeTimers[task.id];
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

    return `
        <div class="grid grid-cols-[3fr,1fr,1fr,1fr,1fr,1fr,1fr] items-center p-3 border-b border-border-color cursor-pointer hover:bg-background ${task.isArchived ? 'opacity-60' : ''} task-list-row" data-task-id="${task.id}" role="button" tabindex="0">
             <div class="font-medium flex items-center gap-2">
                ${task.isArchived ? `<span class="material-icons-sharp text-base text-text-subtle" title="${t('tasks.archive')}d">archive</span>` : ''}
                ${task.name}
            </div>
             <div>${project?.name || t('misc.not_applicable')}</div>
             <div>
                <div class="flex -space-x-2">
                    ${taskAssignees.length > 0 ? taskAssignees.map(assignee => `
                        <div class="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold border-2 border-content" title="${assignee!.name || assignee!.initials}">${assignee!.initials}</div>
                    `).join('') : `<div class="w-7 h-7 rounded-full bg-background text-text-subtle flex items-center justify-center border-2 border-content" title="${t('tasks.unassigned')}"><span class="material-icons-sharp text-base">person_outline</span></div>`}
                </div>
             </div>
             <div class="${isOverdue ? 'text-danger' : ''}">${task.dueDate ? formatDate(task.dueDate) : t('misc.not_applicable')}</div>
             <div>${task.priority ? `<span class="px-2 py-1 text-xs font-medium rounded-full capitalize ${task.priority === 'high' ? 'bg-red-100 text-red-700' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}">${t('tasks.priority_' + task.priority)}</span>` : t('tasks.priority_none')}</div>
             <div><span class="px-2 py-1 text-xs font-medium rounded-full capitalize ${task.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">${t('tasks.' + task.status)}</span></div>
             <div class="flex items-center justify-end gap-2 text-text-subtle">
                 <span class="text-sm font-mono task-tracked-time">${formatDuration(getTaskCurrentTrackedSeconds(task))}</span>
                 <button class="p-1 rounded-full text-text-subtle hover:bg-border-color timer-controls ${isRunning ? 'text-primary' : ''}" data-timer-task-id="${task.id}" aria-label="${isRunning ? t('tasks.stop_timer') : t('tasks.start_timer')}">
                    <span class="material-icons-sharp text-xl">${isRunning ? 'pause_circle' : 'play_circle_outline'}</span>
                </button>
             </div>
        </div>
    `;
};

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
    const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday = 0
    let daysHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
        daysHtml += `<div class="border-r border-b border-border-color"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const tasksForDay = tasksByDay[day] || [];
        daysHtml += `
            <div class="border-r border-b border-border-color p-2 min-h-[120px]">
                <div class="font-medium text-sm">${day}</div>
                <div class="mt-1 space-y-1">
                    ${tasksForDay.map(task => `
                        <div class="p-1.5 text-xs font-medium rounded-md truncate cursor-pointer ${task.priority === 'high' ? 'bg-red-100 text-red-800' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}" data-task-id="${task.id}" role="button" tabindex="0" title="${task.name}">
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
        daysHtml += `<div class="border-r border-b border-border-color"></div>`;
    }

    return `
        <div class="bg-content rounded-lg shadow-sm">
            <div class="flex justify-between items-center p-4 border-b border-border-color">
                <div class="flex items-center gap-2">
                    <button class="p-1 rounded-full hover:bg-background" data-calendar-nav="prev" aria-label="${t('calendar.prev_month')}"><span class="material-icons-sharp">chevron_left</span></button>
                    <button class="p-1 rounded-full hover:bg-background" data-calendar-nav="next" aria-label="${t('calendar.next_month')}"><span class="material-icons-sharp">chevron_right</span></button>
                </div>
                <h4 class="text-lg font-semibold">${monthName}</h4>
                <div></div>
            </div>
            <div class="grid grid-cols-7">
                <div class="p-2 text-center text-xs font-semibold text-text-subtle border-r border-b border-border-color">${t('calendar.weekdays.mon')}</div>
                <div class="p-2 text-center text-xs font-semibold text-text-subtle border-r border-b border-border-color">${t('calendar.weekdays.tue')}</div>
                <div class="p-2 text-center text-xs font-semibold text-text-subtle border-r border-b border-border-color">${t('calendar.weekdays.wed')}</div>
                <div class="p-2 text-center text-xs font-semibold text-text-subtle border-r border-b border-border-color">${t('calendar.weekdays.thu')}</div>
                <div class="p-2 text-center text-xs font-semibold text-text-subtle border-r border-b border-border-color">${t('calendar.weekdays.fri')}</div>
                <div class="p-2 text-center text-xs font-semibold text-text-subtle border-r border-b border-border-color">${t('calendar.weekdays.sat')}</div>
                <div class="p-2 text-center text-xs font-semibold text-text-subtle border-b border-border-color">${t('calendar.weekdays.sun')}</div>
                ${daysHtml}
            </div>
        </div>
    `;
}

function renderGanttView() {
    return `<div id="gantt-chart-container" class="bg-content rounded-lg p-4"><svg id="gantt-chart"></svg></div>`;
}

export function initTasksPage() {
    if (state.ui.tasks.viewMode !== 'gantt') {
        ganttChart = null; // Destroy gantt instance if we switch away
        return;
    }

    const container = document.getElementById('gantt-chart-container');
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
                custom_class: `gantt-priority-${t.priority || 'low'}`
            };
        });

    if (tasksForGantt.length > 0) {
        ganttChart = new Gantt("#gantt-chart", tasksForGantt, {
            on_click: (task: any) => {
                openTaskDetail(task.id);
            },
            language: state.settings.language,
        });
    } else {
        container.innerHTML = `<div class="flex items-center justify-center h-full"><p class="text-text-subtle">${t('tasks.no_tasks_match_filters')}</p></div>`;
    }
}

export function TasksPage() {
    fetchTasksData();

    if (state.ui.tasks.isLoading) {
        return `<div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>`;
    }

    const filteredTasks = getFilteredTasks();
    const activeWorkspaceId = state.activeWorkspaceId;

    let viewContent = '';
    if (state.tasks.filter(t => t.workspaceId === activeWorkspaceId && !t.parentId).length === 0) {
        viewContent = `<div class="flex flex-col items-center justify-center h-96 bg-content rounded-lg border-2 border-dashed border-border-color">
            <span class="material-icons-sharp text-5xl text-text-subtle">assignment</span>
            <h3 class="text-lg font-medium mt-4">${t('tasks.no_tasks_found')}</h3>
            <button class="mt-4 px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addTask">${t('tasks.new_task')}</button>
        </div>`;
    } else {
        switch (state.ui.tasks.viewMode) {
            case 'board': viewContent = renderBoardView(filteredTasks); break;
            case 'list': viewContent = renderListView(filteredTasks); break;
            case 'calendar': viewContent = renderCalendarView(filteredTasks); break;
            case 'gantt': viewContent = renderGanttView(); break;
        }
    }
    
    const { text } = state.ui.tasks.filters;
    const kanbanViewMode = state.currentUser?.kanbanViewMode || 'detailed';
    
    const activeTaskView = state.taskViews.find(tv => tv.id === state.ui.activeTaskViewId);
    const pageTitle = activeTaskView ? activeTaskView.name : t('tasks.title');

    return `
        <div class="h-full flex flex-col">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 class="text-2xl font-bold">${pageTitle}</h2>
                <div class="flex items-center gap-2">
                    <div class="p-1 bg-content border border-border-color rounded-lg flex items-center">
                        <button class="p-1.5 rounded-md ${state.ui.tasks.viewMode === 'board' ? 'bg-background shadow-sm' : 'text-text-subtle hover:bg-background/50'}" data-view-mode="board" aria-label="${t('tasks.board_view')}"><span class="material-icons-sharp text-xl">grid_view</span></button>
                        <button class="p-1.5 rounded-md ${state.ui.tasks.viewMode === 'list' ? 'bg-background shadow-sm' : 'text-text-subtle hover:bg-background/50'}" data-view-mode="list" aria-label="${t('tasks.list_view')}"><span class="material-icons-sharp text-xl">view_list</span></button>
                        <button class="p-1.5 rounded-md ${state.ui.tasks.viewMode === 'calendar' ? 'bg-background shadow-sm' : 'text-text-subtle hover:bg-background/50'}" data-view-mode="calendar" aria-label="${t('tasks.calendar_view')}"><span class="material-icons-sharp text-xl">calendar_today</span></button>
                        <button class="p-1.5 rounded-md ${state.ui.tasks.viewMode === 'gantt' ? 'bg-background shadow-sm' : 'text-text-subtle hover:bg-background/50'}" data-view-mode="gantt" aria-label="${t('tasks.gantt_view')}"><span class="material-icons-sharp text-xl">analytics</span></button>
                    </div>
                    ${state.ui.tasks.viewMode === 'board' ? `
                        <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-toggle-kanban-view title="Toggle card details">
                            <span class="material-icons-sharp text-base">${kanbanViewMode === 'simple' ? 'view_agenda' : 'view_day'}</span>
                        </button>
                    ` : ''}
                     <div class="relative">
                        <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-menu-toggle="sort-menu" aria-haspopup="true" aria-expanded="false">
                            <span class="material-icons-sharp text-base">sort</span>
                            <span>${t('tasks.sort_by')}: ${t(`tasks.sort_${state.ui.tasks.sortBy}`)}</span>
                        </button>
                        <div id="sort-menu" class="absolute top-full right-0 mt-1 w-48 bg-content rounded-md shadow-lg border border-border-color z-10 hidden">
                            <div class="py-1">
                                ${state.ui.tasks.viewMode === 'board' ? `<button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-sort-by="manual">${t('tasks.sort_manual')}</button>` : ''}
                                <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-sort-by="dueDate">${t('tasks.sort_due_date')}</button>
                                <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-sort-by="priority">${t('tasks.sort_priority')}</button>
                                <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-sort-by="name">${t('tasks.sort_name')}</button>
                                <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-sort-by="createdAt">${t('tasks.sort_created_at')}</button>
                            </div>
                        </div>
                    </div>
                     <button id="toggle-filters-btn" class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background">
                        <span class="material-icons-sharp text-base">filter_list</span>
                        <span>${t('tasks.filters_button_text')}</span>
                    </button>
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="automations" ${!can('manage_automations') ? 'disabled' : ''}>
                        <span class="material-icons-sharp text-base">smart_toy</span>
                        <span>${t('tasks.automations_button_text')}</span>
                    </button>
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addTask" ${!can('manage_tasks') ? 'disabled' : ''}>
                        <span class="material-icons-sharp text-base">add</span> ${t('tasks.new_task')}
                    </button>
                </div>
            </div>
            
            <div class="relative">
                <div id="task-filter-panel" class="bg-content p-4 rounded-lg border border-border-color transition-all duration-300 overflow-hidden ${state.ui.tasks.isFilterOpen ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0'}">
                     ${TaskFilterPanel()}
                </div>
            </div>

            ${viewContent}
        </div>
    `;
}