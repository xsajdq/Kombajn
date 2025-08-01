import { state } from '../state.ts';
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

function renderWelcomeAndSchedule(currentUser: User) {
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
        let time = 'All day';

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
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-background flex items-center justify-center text-text-subtle">
                    <span class="material-icons-sharp text-lg">${icon}</span>
                </div>
                <div>
                    <p class="text-sm font-medium">${text}</p>
                    <p class="text-xs text-text-subtle">${time}</p>
                </div>
            </div>
        `;
    };

    return `
        <div class="space-y-6">
            <div class="bg-content p-5 rounded-lg shadow-sm">
                 <h2 class="text-2xl font-bold">${t('dashboard.welcome_message').replace('{name}', currentUser.name?.split(' ')[0] || '')}</h2>
                 <p class="text-text-subtle">${t('dashboard.welcome_sub')}</p>
            </div>

            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="font-semibold mb-3">${t('dashboard.my_day_todays_schedule')}</h4>
                <div class="space-y-3">
                    ${scheduleItems.length > 0 ? scheduleItems.map(renderScheduleItem).join('') : `<p class="text-sm text-text-subtle">${t('dashboard.my_day_no_schedule')}</p>`}
                </div>
            </div>

            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="font-semibold mb-3">${t('dashboard.my_day_quick_actions')}</h4>
                <div class="grid grid-cols-2 gap-2">
                    <button class="flex items-center justify-center gap-2 p-3 bg-background hover:bg-border-color rounded-md" data-modal-target="addTask">
                        <span class="material-icons-sharp text-lg text-primary">add_task</span>
                        <span class="text-sm font-medium">${t('tasks.new_task')}</span>
                    </button>
                    <button class="flex items-center justify-center gap-2 p-3 bg-background hover:bg-border-color rounded-md" data-modal-target="addManualTimeLog">
                         <span class="material-icons-sharp text-lg text-primary">more_time</span>
                        <span class="text-sm font-medium">${t('dashboard.my_day_log_time')}</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderMyTasks(overdue: Task[], today: Task[], thisWeek: Task[]) {
    const renderTaskGroup = (title: string, tasks: Task[]) => {
        if (tasks.length === 0) return '';
        return `
            <div>
                <h4 class="text-sm font-semibold mb-2 text-text-subtle uppercase tracking-wider">${title} (${tasks.length})</h4>
                <div class="space-y-2">
                    ${tasks.map(task => {
                        const project = state.projects.find(p => p.id === task.projectId);
                        return `
                            <div class="bg-content p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-border-color/50 transition-colors dashboard-task-item" data-task-id="${task.id}" role="button" tabindex="0">
                                <span class="material-icons-sharp text-primary">radio_button_unchecked</span>
                                <div class="flex-1">
                                    <p class="text-sm font-medium">${task.name}</p>
                                    <p class="text-xs text-text-subtle">${project?.name || ''}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    const allEmpty = overdue.length === 0 && today.length === 0 && thisWeek.length === 0;

    return `
        <div class="space-y-6">
            ${allEmpty ? `
                <div class="bg-content p-8 rounded-lg text-center text-text-subtle h-full flex flex-col justify-center items-center">
                    <span class="material-icons-sharp text-5xl">task_alt</span>
                    <p class="mt-2 font-medium">${t('dashboard.my_day_no_tasks')}</p>
                </div>
            ` : `
                ${renderTaskGroup(t('dashboard.my_day_overdue'), overdue)}
                ${renderTaskGroup(t('dashboard.my_day_today'), today)}
                ${renderTaskGroup(t('dashboard.my_day_this_week'), thisWeek)}
            `}
        </div>
    `;
}

function renderProjectsAndTimeSummary() {
    const { currentUser, activeWorkspaceId } = state;

    // Active Projects
    const myProjects = state.projects.filter(p => 
        p.workspaceId === activeWorkspaceId &&
        !p.isArchived &&
        (p.privacy === 'public' || state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === currentUser!.id))
    ).slice(0, 5);

    // Today's Time Summary
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeLogsToday = state.timeLogs.filter(log => log.workspaceId === activeWorkspaceId && log.userId === currentUser!.id && log.createdAt.startsWith(todayStr));
    const totalSecondsToday = timeLogsToday.reduce((sum, log) => sum + log.trackedSeconds, 0);

    const timeByTask: { [taskId: string]: { name: string, seconds: number } } = {};
    timeLogsToday.forEach(log => {
        if (!timeByTask[log.taskId]) {
            const task = state.tasks.find(t => t.id === log.taskId);
            timeByTask[log.taskId] = { name: task?.name || 'Unknown Task', seconds: 0 };
        }
        timeByTask[log.taskId].seconds += log.trackedSeconds;
    });
    
    const sortedTimeByTask = Object.values(timeByTask).sort((a,b) => b.seconds - a.seconds);

    return `
        <div class="space-y-6">
            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="font-semibold mb-3">${t('dashboard.my_day_active_projects')}</h4>
                <div class="space-y-3">
                    ${myProjects.length > 0 ? myProjects.map(p => {
                        const tasks = state.tasks.filter(t => t.projectId === p.id);
                        const completed = tasks.filter(t => t.status === 'done').length;
                        const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
                        return `
                            <div class="cursor-pointer dashboard-project-item" data-project-id="${p.id}" role="button" tabindex="0">
                                <div class="flex justify-between items-center text-sm mb-1">
                                    <span class="font-medium">${p.name}</span>
                                    <span class="text-text-subtle">${Math.round(progress)}%</span>
                                </div>
                                <div class="w-full bg-background rounded-full h-1.5">
                                    <div class="bg-primary h-1.5 rounded-full" style="width: ${progress}%;"></div>
                                </div>
                            </div>
                        `;
                    }).join('') : `<p class="text-sm text-text-subtle">${t('projects.no_projects_yet')}</p>`}
                </div>
            </div>

            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="font-semibold mb-3">${t('dashboard.my_day_time_summary')}</h4>
                <p class="text-3xl font-bold">${formatDuration(totalSecondsToday)}</p>
                <div class="space-y-2 mt-3">
                    ${sortedTimeByTask.map(task => `
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-text-main truncate">${task.name}</span>
                            <span class="font-medium text-text-subtle">${formatDuration(task.seconds)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderMyDayDashboard() {
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '';

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    startOfWeek.setHours(0,0,0,0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    const userTasks = state.tasks.filter(task => 
        task.workspaceId === activeWorkspaceId &&
        !task.isArchived &&
        state.taskAssignees.some(a => a.taskId === task.id && a.userId === currentUser.id)
    );

    const overdueTasks = userTasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done');
    const todayTasks = userTasks.filter(t => t.dueDate === todayStr && t.status !== 'done');
    const thisWeekTasks = userTasks.filter(t => {
        if (!t.dueDate || t.dueDate < todayStr || t.status === 'done') return false;
        const dueDate = new Date(t.dueDate);
        return dueDate > today && dueDate <= endOfWeek;
    });

    return `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div>${renderWelcomeAndSchedule(currentUser)}</div>
            <div class="lg:col-span-1">${renderMyTasks(overdueTasks, todayTasks, thisWeekTasks)}</div>
            <div>${renderProjectsAndTimeSummary()}</div>
        </div>
    `;
}

function renderOverviewDashboard() {
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
                <button class="remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>
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
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${activeTab === 'my_day' ? 'bg-background shadow-sm' : 'text-text-subtle'}" data-dashboard-tab="my_day">${t('dashboard.tab_my_day')}</button>
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${activeTab === 'overview' ? 'bg-background shadow-sm' : 'text-text-subtle'}" data-dashboard-tab="overview">${t('dashboard.tab_overview')}</button>
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
