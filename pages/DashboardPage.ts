

import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import type { DashboardWidget, Task, TimeLog, Comment, CalendarEvent, TimeOffRequest, PublicHoliday, User } from '../types.ts';
import { formatDuration, formatDate, formatCurrency } from '../utils.ts';
import { apiFetch } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';
import * as dashboardHandlers from '../handlers/dashboard.ts';

declare const Chart: any;
let charts: { [key: string]: any } = {};

function destroyCharts() {
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
}

function renderWelcomeCard(currentUser: User) {
    return `
        <div class="bg-content p-4 rounded-lg shadow-sm">
             <h3 class="text-xl font-bold">${t('dashboard.welcome_message').replace('{name}', currentUser.name?.split(' ')[0] || '')}</h3>
             <p class="text-sm text-text-subtle">${t('dashboard.welcome_sub')}</p>
        </div>
    `;
}

function renderQuickActions() {
    return `
        <div class="bg-content p-4 rounded-lg shadow-sm">
            <h4 class="font-semibold text-sm mb-2">${t('dashboard.my_day_quick_actions')}</h4>
            <div class="grid grid-cols-2 gap-2">
                <button class="flex items-center justify-center gap-1 p-2 bg-background hover:bg-border-color rounded-md text-sm" data-modal-target="addTask">
                    <span class="material-icons-sharp text-base text-primary">add_task</span>
                    <span>${t('tasks.new_task')}</span>
                </button>
                <button class="flex items-center justify-center gap-1 p-2 bg-background hover:bg-border-color rounded-md text-sm" data-modal-target="addManualTimeLog">
                     <span class="material-icons-sharp text-base text-primary">more_time</span>
                    <span>${t('dashboard.my_day_log_time')}</span>
                </button>
            </div>
        </div>
    `;
}

function renderTodaysSchedule() {
    const state = getState();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const todayDate = new Date(todayStr + 'T12:00:00Z');

    const scheduleItems: (CalendarEvent | TimeOffRequest | PublicHoliday)[] = [
        ...state.calendarEvents.filter(e => {
            if (e.workspaceId !== state.activeWorkspaceId) return false;
            const start = new Date(e.startDate + 'T00:00:00Z');
            const end = new Date(e.endDate + 'T23:59:59Z');
            return todayDate >= start && todayDate <= end;
        }),
        ...state.timeOffRequests.filter(to => {
            if (to.workspaceId !== state.activeWorkspaceId || to.status !== 'approved') return false;
            const start = new Date(to.startDate + 'T00:00:00Z');
            const end = new Date(to.endDate + 'T23:59:59Z');
            return todayDate >= start && todayDate <= end;
        }),
        ...state.publicHolidays.filter(h => h.date === todayStr)
    ];

    const renderScheduleItem = (item: any) => {
        let icon = 'event';
        let text = '';

        if ('userId' in item) { // TimeOffRequest
            const user = state.users.find(u => u.id === item.userId);
            icon = 'flight_takeoff';
            text = `${user?.name || 'Someone'} is on ${item.type.replace('_', ' ')}`;
        } else if ('title' in item) { // CalendarEvent
            const event = item as CalendarEvent;
            icon = event.type === 'on-call' ? 'phone_in_talk' : 'event';
            text = event.title;
        } else { // PublicHoliday
            icon = 'celebration';
            text = item.name;
        }

        return `
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-md bg-background flex items-center justify-center text-text-subtle">
                    <span class="material-icons-sharp text-sm">${icon}</span>
                </div>
                <p class="text-xs font-medium truncate">${text}</p>
            </div>
        `;
    };
    return `
         <div class="bg-content p-4 rounded-lg shadow-sm">
            <h4 class="font-semibold text-sm mb-2">${t('dashboard.my_day_todays_schedule')}</h4>
            <div class="space-y-2">
                ${scheduleItems.length > 0 ? scheduleItems.map(renderScheduleItem).join('') : `<p class="text-xs text-text-subtle">${t('dashboard.my_day_no_schedule')}</p>`}
            </div>
        </div>
    `;
}

function renderMyTasks(currentUser: User) {
    const state = getState();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const userTasks = state.tasks.filter(task => 
        task.workspaceId === state.activeWorkspaceId &&
        !task.isArchived &&
        state.taskAssignees.some(a => a.taskId === task.id && a.userId === currentUser.id) &&
        task.status !== 'done'
    ).sort((a,b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1) || (a.dueDate || 'z').localeCompare(b.dueDate || 'z'));

    const overdueTasks = userTasks.filter(t => t.dueDate && t.dueDate < todayStr);
    const todayTasks = userTasks.filter(t => t.dueDate === todayStr);
    const tomorrowTasks = userTasks.filter(t => t.dueDate === tomorrowStr);
    
    const allTasksCount = overdueTasks.length + todayTasks.length + tomorrowTasks.length;

    const renderTaskRow = (task: Task) => {
        const project = state.projects.find(p => p.id === task.projectId);
        const isOverdue = task.dueDate && task.dueDate < todayStr;
        return `
            <div class="p-2.5 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-background transition-colors dashboard-task-item" data-task-id="${task.id}" role="button" tabindex="0">
                <span class="material-icons-sharp text-lg text-text-subtle">radio_button_unchecked</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate ${isOverdue ? 'text-danger' : ''}">${task.name}</p>
                    <p class="text-xs text-text-subtle truncate">${project?.name || ''}</p>
                </div>
            </div>
        `;
    };

    const renderTaskSection = (title: string, tasks: Task[]) => {
        if (tasks.length === 0) return '';
        return `
            <div class="space-y-1">
                <h5 class="px-2.5 text-xs font-bold text-text-subtle uppercase tracking-wider mb-1">${title} (${tasks.length})</h5>
                ${tasks.map(renderTaskRow).join('')}
            </div>
        `;
    };
    
    let content;
    if (allTasksCount === 0) {
        content = `
            <div class="text-center py-8 text-text-subtle">
                <span class="material-icons-sharp text-4xl">task_alt</span>
                <p class="mt-2 text-sm font-medium">${t('dashboard.my_day_no_tasks')}</p>
            </div>
        `;
    } else {
        content = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                ${renderTaskSection(t('dashboard.my_day_overdue'), overdueTasks)}
                ${renderTaskSection(t('dashboard.my_day_today'), todayTasks)}
                ${renderTaskSection(t('dashboard.my_day_tomorrow'), tomorrowTasks)}
            </div>
        `;
    }

    return `
        <div class="bg-content p-4 rounded-lg shadow-sm">
            <h4 class="font-semibold text-sm mb-4">${t('dashboard.my_day_my_tasks')}</h4>
            ${content}
        </div>
    `;
}

function renderProjectsAndSummary(currentUser: User) {
    const state = getState();
    // Active Projects
    const myProjects = state.projects.filter(p => 
        p.workspaceId === state.activeWorkspaceId &&
        (p.privacy === 'public' || state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === currentUser!.id))
    ).slice(0, 5);

    // Today's Time Summary
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeLogsToday = state.timeLogs.filter(log => log.workspaceId === state.activeWorkspaceId && log.userId === currentUser!.id && log.createdAt.startsWith(todayStr));
    const totalSecondsToday = timeLogsToday.reduce((sum, log) => sum + log.trackedSeconds, 0);

    return `
        <div class="space-y-4">
            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="font-semibold text-sm mb-3">${t('dashboard.my_day_active_projects')}</h4>
                <div class="space-y-3">
                    ${myProjects.map(p => {
                        const tasks = state.tasks.filter(t => t.projectId === p.id);
                        const completed = tasks.filter(t => t.status === 'done').length;
                        const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
                        return `
                            <div class="cursor-pointer dashboard-project-item" data-project-id="${p.id}" role="button" tabindex="0">
                                <div class="flex justify-between items-center text-xs mb-1">
                                    <span class="font-medium">${p.name}</span>
                                    <span class="text-text-subtle">${Math.round(progress)}%</span>
                                </div>
                                <div class="w-full bg-background rounded-full h-1.5">
                                    <div class="bg-primary h-1.5 rounded-full" style="width: ${progress}%;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="font-semibold text-sm mb-2">${t('dashboard.my_day_time_summary')}</h4>
                <p class="text-2xl font-bold">${formatDuration(totalSecondsToday)}</p>
            </div>
        </div>
    `;
}


function renderMyDayDashboard() {
    const { currentUser } = getState();
    if (!currentUser) return '';

    return `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div class="lg:col-span-2 space-y-6">
                ${renderWelcomeCard(currentUser)}
                ${renderMyTasks(currentUser)}
            </div>
            <div class="lg:col-span-1 space-y-6">
                ${renderQuickActions()}
                ${renderTodaysSchedule()}
                ${renderProjectsAndSummary(currentUser)}
            </div>
        </div>
    `;
}


function renderOverviewDashboard() {
    const state = getState();
    const { currentUser, activeWorkspaceId, dashboardWidgets } = state;
    if (!currentUser || !activeWorkspaceId) return '';

    const userWidgets = dashboardWidgets.filter(w => w.userId === currentUser.id && w.workspaceId === activeWorkspaceId)
        .sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
    const gridColumns = state.workspaces.find(w => w.id === activeWorkspaceId)?.dashboardGridColumns || 3;

    if (userWidgets.length === 0) {
        return `
            <div class="text-center p-8">
                <p>${t('dashboard.no_activity_yet')}</p>
                <button id="create-default-widgets-btn" class="mt-4 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">Add Default Widgets</button>
            </div>
        `;
    }

    return `
        <div class="dashboard-widget-grid" style="grid-template-columns: repeat(${gridColumns}, minmax(0, 1fr));">
            ${userWidgets.map(widget => renderWidget(widget)).join('')}
        </div>
    `;
}

function renderWidget(widget: DashboardWidget) {
    const state = getState();
    const isEditing = state.ui.dashboard.isEditing;
    const { type, config } = widget;
    let content = '';

    switch (type) {
        case 'kpiMetric':
            const { totalRevenue, activeProjects, totalClients, overdueProjects } = dashboardHandlers.getKpiMetrics();
            const metricMap = {
                totalRevenue: { value: formatCurrency(totalRevenue), label: t('dashboard.kpi_total_revenue'), icon: 'payments' },
                activeProjects: { value: activeProjects, label: t('dashboard.kpi_active_projects'), icon: 'folder_special' },
                totalClients: { value: totalClients, label: t('dashboard.kpi_total_clients'), icon: 'groups' },
                overdueProjects: { value: overdueProjects, label: t('dashboard.kpi_overdue_projects'), icon: 'warning' },
            };
            const metric = metricMap[config.metric as keyof typeof metricMap];
            content = `<div class="p-4 bg-content rounded-lg h-full flex flex-col justify-center">
                <div class="flex items-center gap-4">
                    <div class="p-3 rounded-full bg-primary/10 text-primary"><span class="material-icons-sharp">${metric.icon}</span></div>
                    <div>
                        <p class="text-sm text-text-subtle">${metric.label}</p>
                        <strong class="text-2xl font-semibold">${metric.value}</strong>
                    </div>
                </div>
            </div>`;
            break;
        case 'recentProjects':
             const recentProjects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId).slice(0, 5);
             content = `<div class="p-4 bg-content rounded-lg h-full">
                <h4 class="font-semibold mb-3">${t('dashboard.widget_recent_projects_title')}</h4>
                <div class="space-y-2">
                    ${recentProjects.map(p => `<div class="text-sm p-2 rounded-md hover:bg-background cursor-pointer dashboard-project-item" data-project-id="${p.id}">${p.name}</div>`).join('')}
                </div>
             </div>`;
             break;
        case 'todaysTasks':
             const taskFilter = config.taskFilter || 'today';
             content = `<div class="p-4 bg-content rounded-lg h-full flex flex-col">...</div>`; // simplified
             break;
        case 'activityFeed':
            const activities = [...state.comments, ...state.timeLogs]
                .filter(a => a.workspaceId === state.activeWorkspaceId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5);
            content = `<div class="p-4 bg-content rounded-lg h-full">...</div>`; // simplified
            break;
        default:
            content = `<div class="p-4 bg-content rounded-lg h-full"><p>${type}</p></div>`;
    }

    return `
        <div class="relative" data-widget-id="${widget.id}" draggable="${isEditing}">
            ${isEditing ? `
                <button class="remove-widget-btn" data-delete-resource="dashboard_widgets" data-delete-id="${widget.id}" data-delete-confirm="Are you sure you want to remove this widget?"><span class="material-icons-sharp text-base">close</span></button>
                <button class="configure-widget-btn" data-configure-widget-id="${widget.id}"><span class="material-icons-sharp text-base">settings</span></button>
            ` : ''}
            ${content}
        </div>
    `;
}


export function initDashboardCharts() {
    destroyCharts();
}

export function DashboardPage() {
    const state = getState();
    const { currentUser, activeWorkspaceId, ui: { dashboard: { isLoading, isEditing, activeTab } } } = state;
    if (!currentUser || !activeWorkspaceId) return '';
    
    if (isLoading) {
        return `<div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>`;
    }

    let content = '';
    if (activeTab === 'my_day') {
        content = renderMyDayDashboard();
    } else {
        content = renderOverviewDashboard();
    }

    return `
        <div class="space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 class="text-2xl font-bold">${t('dashboard.title')}</h2>
                <div class="flex items-center gap-2">
                    <div class="p-1 bg-content border border-border-color rounded-lg flex items-center">
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${activeTab === 'my_day' ? 'bg-background shadow-sm' : 'text-text-subtle'}" data-tab-group="ui.dashboard.activeTab" data-tab-value="my_day">${t('dashboard.tab_my_day')}</button>
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${activeTab === 'overview' ? 'bg-background shadow-sm' : 'text-text-subtle'}" data-tab-group="ui.dashboard.activeTab" data-tab-value="overview">${t('dashboard.tab_overview')}</button>
                    </div>
                    ${activeTab === 'overview' ? `
                        <button id="toggle-dashboard-edit-mode" class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md ${isEditing ? 'bg-primary text-white' : 'bg-content border border-border-color hover:bg-background'}">
                            <span class="material-icons-sharp text-base">${isEditing ? 'done' : 'edit'}</span>
                            ${isEditing ? t('dashboard.done_editing') : t('dashboard.edit_dashboard')}
                        </button>
                        ${isEditing ? `<button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white" data-modal-target="addWidget"><span class="material-icons-sharp text-base">add</span> ${t('dashboard.add_widget')}</button>` : ''}
                    ` : ''}
                </div>
            </div>
            ${content}
        </div>
    `;
}