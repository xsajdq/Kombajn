


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
        if (tasksBySection[sectionId]) {
            tasksBySection[sectionId].push(task);
        } else {
            tasksBySection[sectionId] = [task];
        }
    });

    const renderTaskRow = (task: Task) => {
        const project = state.projects.find(p => p.id === task.projectId);
        const assignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
        const trackedSeconds = getTaskCurrentTrackedSeconds(task);
        const priorityText = task.priority ? t(`tasks.priority_${task.priority}`) : t('tasks.priority_none');
        
        return `
            <tr class="modern-list-row task-list-grid" data-task-id="${task.id}">
                <td>${task.name}</td>
                <td class="text-text-subtle">${project?.name || ''}</td>
                <td>
                    <div class="avatar-stack">
                         ${assignees.map(u => u ? `<div class="avatar-small" title="${u.name}">${getUserInitials(u)}</div>` : '').join('')}
                    </div>
                </td>
                <td class="text-text-subtle">${task.dueDate ? formatDate(task.dueDate) : ''}</td>
                <td>${priorityText}</td>
                <td class="task-tracked-time">${trackedSeconds > 0 ? formatDuration(trackedSeconds) : ''}</td>
            </tr>
        `;
    };
    
    let sectionsHtml = '';
    
    projectSections.forEach(section => {
        const tasks = tasksBySection[section.id];
        if (tasks && tasks.length > 0) {
            sectionsHtml += `
                <details class="task-section" open>
                    <summary class="task-section-header">
                        <div class="flex items-center gap-2">
                            <h4 class="font-semibold">${section.name}</h4>
                            <span class="text-sm text-text-subtle">${tasks.length}</span>
                        </div>
                        <button class="btn-icon" data-delete-resource="project_sections" data-delete-id="${section.id}" data-delete-confirm="Are you sure you want to delete this section? Tasks in this section will not be deleted."><span class="material-icons-sharp text-base">delete</span></button>
                    </summary>
                    <div class="task-list-modern">
                        ${tasks.map(renderTaskRow).join('')}
                    </div>
                </details>
            `;
        }
    });

    if (tasksBySection['no-section'].length > 0) {
         sectionsHtml += `
            <div class="task-section">
                <div class="task-section-header">
                    <div class="flex items-center gap-2">
                        <h4 class="font-semibold">${t('tasks.default_board')}</h4>
                        <span class="text-sm text-text-subtle">${tasksBySection['no-section'].length}</span>
                    </div>
                </div>
                <div class="task-list-modern">
                    ${tasksBySection['no-section'].map(renderTaskRow).join('')}
                </div>
            </div>
        `;
    }


    return `
        <div class="bg-content rounded-lg shadow-sm">
             <div class="task-list-modern-header">
                <div>${t('tasks.col_task')}</div>
                <div>${t('tasks.col_project')}</div>
                <div>${t('tasks.col_assignee')}</div>
                <div>${t('tasks.col_due_date')}</div>
                <div>${t('tasks.col_priority')}</div>
                <div>${t('tasks.col_time')}</div>
            </div>
            <div class="space-y-4">
               ${sectionsHtml}
            </div>
        </div>
    `;
}

function renderCalendarView(filteredTasks: Task[]) {
    return `<div>Calendar View Placeholder</div>`;
}

function renderGanttView(filteredTasks: Task[]) {
    return `<div>Gantt View Placeholder</div>`;
}

function renderWorkloadView(filteredTasks: Task[]) {
    return `<div>Workload View Placeholder</div>`;
}

export async function initTasksPage() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    if (state.ui.tasks.loadedWorkspaceId !== activeWorkspaceId) {
        // Set loading state and loaded ID immediately to prevent re-fetching loops.
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                tasks: { ...prevState.ui.tasks, isLoading: true, loadedWorkspaceId: activeWorkspaceId }
            }
        }), ['page']);
        
        await fetchTasksForWorkspace(activeWorkspaceId);
    }
    
    if (getState().ui.tasks.viewMode === 'gantt') {
        // initGanttChart(getFilteredTasks());
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
                        <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-menu-toggle="task-sort-menu">
                            <span class="material-icons-sharp text-base">sort</span>
                            <span>${t('tasks.sort_by')}: ${sortOptions.find(s => s.id === sortBy)?.text}</span>
                        </button>
                        <div id="task-sort-menu" class="dropdown-menu">
                             ${sortOptions.map(opt => `<button class="dropdown-menu-item" data-sort-by="${opt.id}">${opt.text} ${sortBy === opt.id ? '✓' : ''}</button>`).join('')}
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