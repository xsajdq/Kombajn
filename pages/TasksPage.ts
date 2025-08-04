
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate, getUserInitials } from '../utils.ts';
import { renderTaskCard } from '../components/TaskCard.ts';
import type { Task, User, ProjectSection, SortByOption, KanbanStage } from '../types.ts';
import { can } from '../permissions.ts';
import { openTaskDetail } from '../handlers/tasks.ts';
import { getWorkspaceKanbanWorkflow } from '../handlers/main.ts';
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
    const kanbanStages = state.kanbanStages
        .filter(s => s.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    if (kanbanStages.length === 0) {
        return `<div class="flex flex-col items-center justify-center h-full bg-content rounded-lg border-2 border-dashed border-border-color">
            <span class="material-icons-sharp text-5xl text-text-subtle">view_week</span>
            <h3 class="text-lg font-medium mt-4">No Kanban Board Columns</h3>
            <p class="text-sm text-text-subtle mt-1">Please configure your Kanban board columns in Settings.</p>
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
                            <h4 class="font-semibold">${sectionName}</h4>
                            <span class="text-sm text-text-subtle">${tasks.length}</span>
                        </div>
                    </summary>
                    <div class="task-list-modern">
                        ${tasks.map(renderTaskRow).join('')}
                    </div>
                </details>
            `;
        };
        
        const renderTaskRow = (task: Task) => {
             const assignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
             const trackedSeconds = getTaskCurrentTrackedSeconds(task);
             return `
                <div class="modern-list-row" data-task-id="${task.id}">
                    <div>${task.name}</div>
                    <div class="text-text-subtle">${task.dueDate ? formatDate(task.dueDate) : ''}</div>
                    <div>
                        <div class="avatar-stack">
                             ${assignees.map(u => u ? `<div class="avatar-small" title="${u.name}">${getUserInitials(u)}</div>` : '').join('')}
                        </div>
                    </div>
                    <div>${trackedSeconds > 0 ? formatDuration(trackedSeconds) : ''}</div>
                </div>
            `;
        };

        return `
            <div class="space-y-4">
                ${projectSections.map(section => renderSection(section, tasksBySection[section.id])).join('')}
                ${renderSection(null, tasksBySection['no-section'])}
            </div>
        `;
    }

    // Default list view (no project selected)
    return `
        <div class="bg-content rounded-lg shadow-sm">
            <div class="overflow-x-auto">
                <table class="w-full text-sm responsive-table">
                    <thead class="text-xs text-text-subtle uppercase bg-background">
                        <tr>
                            <th class="px-4 py-2 text-left">${t('tasks.col_task')}</th>
                            <th class="px-4 py-2 text-left">${t('tasks.col_project')}</th>
                            <th class="px-4 py-2 text-left">${t('tasks.col_assignee')}</th>
                            <th class="px-4 py-2 text-left">${t('tasks.col_due_date')}</th>
                            <th class="px-4 py-2 text-left">${t('tasks.col_priority')}</th>
                            <th class="px-4 py-2 text-left">${t('tasks.col_time')}</th>
                            <th class="px-4 py-2 text-left">${t('tasks.col_status')}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-border-color">
                        ${filteredTasks.map(task => {
                            const project = state.projects.find(p => p.id === task.projectId);
                            const assignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
                            const trackedSeconds = getTaskCurrentTrackedSeconds(task);
                            const priorityText = task.priority ? t(`tasks.priority_${task.priority}`) : t('tasks.priority_none');
                            
                            return `
                                <tr class="hover:bg-background cursor-pointer" data-task-id="${task.id}">
                                    <td data-label="${t('tasks.col_task')}" class="px-4 py-3 font-medium">${task.name}</td>
                                    <td data-label="${t('tasks.col_project')}" class="px-4 py-3">${project?.name || ''}</td>
                                    <td data-label="${t('tasks.col_assignee')}" class="px-4 py-3">
                                        <div class="avatar-stack">
                                             ${assignees.map(u => u ? `<div class="avatar-small" title="${u.name}">${getUserInitials(u)}</div>` : '').join('')}
                                        </div>
                                    </td>
                                    <td data-label="${t('tasks.col_due_date')}" class="px-4 py-3">${task.dueDate ? formatDate(task.dueDate) : ''}</td>
                                    <td data-label="${t('tasks.col_priority')}" class="px-4 py-3">${priorityText}</td>
                                    <td data-label="${t('tasks.col_time')}" class="px-4 py-3 task-tracked-time">${trackedSeconds > 0 ? formatDuration(trackedSeconds) : ''}</td>
                                    <td data-label="${t('tasks.col_status')}" class="px-4 py-3"><span class="px-2 py-1 text-xs font-semibold rounded-full capitalize bg-background">${t(`tasks.${task.status}`)}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderCalendarView(filteredTasks: Task[]) {
    const [year, month] = state.ui.calendarDate.split('-').map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStartDate = new Date(year, month - 1, 1);
    
    const calendarStartDate = new Date(monthStartDate);
    calendarStartDate.setDate(calendarStartDate.getDate() - (monthStartDate.getDay() + 6) % 7);

    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    for (let i = 0; i < 42; i++) { // Render 6 weeks to be safe
        if (i > 0 && i % 7 === 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        const day = new Date(calendarStartDate);
        day.setDate(day.getDate() + i);
        currentWeek.push(day);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const tasksByDate: { [key: string]: Task[] } = {};
    filteredTasks.forEach(task => {
        if (task.dueDate) {
            const dateStr = task.dueDate;
            if (!tasksByDate[dateStr]) {
                tasksByDate[dateStr] = [];
            }
            tasksByDate[dateStr].push(task);
        }
    });

    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    return `
        <div class="bg-content rounded-lg shadow-sm border border-border-color flex flex-col h-full">
            <div class="grid grid-cols-7 border-b border-border-color">
                ${weekdays.map(day => `<div class="p-2 text-center text-xs font-semibold text-text-subtle">${t(`calendar.weekdays.${day}`)}</div>`).join('')}
            </div>
            <div class="grid grid-cols-7 grid-rows-6 flex-1">
                ${weeks.flat().map(day => {
                    const dayStr = day.toISOString().slice(0, 10);
                    const isCurrentMonth = day.getMonth() === month - 1;
                    const isToday = day.getTime() === today.getTime();
                    const tasksForDay = tasksByDate[dayStr] || [];
                    return `
                        <div class="border-r border-b border-border-color p-2 flex flex-col ${isCurrentMonth ? '' : 'bg-background/50 text-text-subtle'} ${isToday ? 'bg-primary/5' : ''}">
                            <div class="text-sm text-right ${isToday ? 'text-primary font-bold' : ''}">${day.getDate()}</div>
                            <div class="flex-1 overflow-y-auto space-y-1 mt-1">
                                ${tasksForDay.map(task => `
                                    <div class="p-1.5 text-xs font-medium rounded-md truncate bg-blue-500 text-white cursor-pointer task-calendar-item" data-task-id="${task.id}" title="${task.name}">${task.name}</div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderGanttView(filteredTasks: Task[]) {
    if (filteredTasks.length === 0) {
        return `<div class="flex flex-col items-center justify-center h-96 bg-content rounded-lg">
            <span class="material-icons-sharp text-5xl text-text-subtle">bar_chart</span>
            <h3 class="text-lg font-medium mt-4">${t('tasks.no_tasks_match_filters')}</h3>
        </div>`;
    }
    return `<div class="p-4 bg-content rounded-lg h-full"><svg id="gantt-chart"></svg></div>`;
}

function renderWorkloadView(filteredTasks: Task[]) {
    return `<div class="p-8 text-center bg-content rounded-lg">
        <h3 class="font-semibold">Workload View</h3>
        <p class="text-text-subtle">This view is currently under construction.</p>
    </div>`;
}

function initGanttChart(tasks: Task[]) {
    const ganttContainer = document.getElementById('gantt-chart');
    if (!ganttContainer) return;
    ganttContainer.innerHTML = ''; // Clear previous chart

    const ganttTasks = tasks
        .filter(task => task.startDate && task.dueDate)
        .map(task => {
            const progress = task.progress ?? (task.status === 'done' ? 100 : 0);
            return {
                id: task.id,
                name: task.name,
                start: task.startDate!,
                end: task.dueDate!,
                progress: progress,
            };
        });

    if (ganttTasks.length === 0) {
        if(ganttContainer.parentElement) {
            ganttContainer.parentElement.innerHTML = `<div class="flex flex-col items-center justify-center h-full">
                <span class="material-icons-sharp text-5xl text-text-subtle">bar_chart</span>
                <p class="mt-2 text-text-subtle">No tasks with start and end dates to display.</p>
            </div>`;
        }
        return;
    }

    ganttChart = new Gantt("#gantt-chart", ganttTasks, {
        view_mode: state.ui.tasks.ganttViewMode,
        on_click: (task: any) => {
            if (task.id) {
                openTaskDetail(task.id);
            }
        },
        on_date_change: async (task: any, start: Date, end: Date) => {
            const startDate = start.toISOString().slice(0, 10);
            const endDate = end.toISOString().slice(0, 10);
            await taskHandlers.handleTaskDetailUpdate(task.id, 'startDate', startDate);
            await taskHandlers.handleTaskDetailUpdate(task.id, 'dueDate', endDate);
        },
        on_progress_change: (task: any, progress: number) => {
            taskHandlers.handleTaskProgressUpdate(task.id, progress);
        },
        bar_height: 20,
        bar_corner_radius: 3,
        padding: 18,
    });
}

export function initTasksPage() {
    if (state.ui.tasks.viewMode === 'gantt') {
        initGanttChart(getFilteredTasks());
    }
}

export function TasksPage() {
    const { isFilterOpen, viewMode: globalViewMode, ganttViewMode } = state.ui.tasks;
    const canManage = can('manage_tasks');
    const filteredTasks = getFilteredTasks();
    
    let content = '';
    const viewMode = state.ui.activeTaskViewId ? 'board' : globalViewMode;

    switch (viewMode) {
        case 'board':
            content = renderBoardView(filteredTasks);
            break;
        case 'list':
            content = renderListView(filteredTasks);
            break;
        case 'calendar':
            content = renderCalendarView(filteredTasks);
            break;
        case 'gantt':
            content = renderGanttView(filteredTasks);
            break;
        case 'workload':
            content = renderWorkloadView(filteredTasks);
            break;
        default:
            content = renderBoardView(filteredTasks);
    }

    const navItems = [
        { id: 'board', icon: 'view_kanban', text: t('tasks.board_view') },
        { id: 'list', icon: 'view_list', text: t('tasks.list_view') },
        { id: 'calendar', icon: 'calendar_month', text: t('tasks.calendar_view') },
        { id: 'gantt', icon: 'bar_chart', text: t('tasks.gantt_view') },
        { id: 'workload', icon: 'groups', text: t('tasks.workload_view') },
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
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="addTask" ${!canManage ? 'disabled' : ''}>
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
