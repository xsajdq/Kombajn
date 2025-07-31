


import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { DashboardWidget, Task, TimeLog, Comment, CalendarEvent, TimeOffRequest, PublicHoliday } from '../types.ts';
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

// --- WIDGET RENDERERS ---

function renderKpiMetricWidget(widget: DashboardWidget, isEditing: boolean) {
    let title = '', value = '', icon = 'help', iconBg = '#e5e7eb', iconFg = '#4b5563';

    switch (widget.config.metric) {
        case 'totalRevenue':
            const totalRevenue = state.invoices
                .filter(i => i.workspaceId === state.activeWorkspaceId && i.status === 'paid')
                .reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
            title = t('dashboard.kpi_total_revenue');
            value = formatCurrency(totalRevenue, 'PLN');
            icon = 'attach_money';
            iconBg = '#dcfce7';
            iconFg = '#22c55e';
            break;
        case 'activeProjects':
            const activeProjects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId).length;
            title = t('dashboard.kpi_active_projects');
            value = `${activeProjects}`;
            icon = 'folder';
            iconBg = '#e0e7ff';
            iconFg = '#4f46e5';
            break;
        case 'totalClients':
            const totalClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId).length;
            title = t('dashboard.kpi_total_clients');
            value = `${totalClients}`;
            icon = 'people';
            iconBg = '#f3e8ff';
            iconFg = '#9333ea';
            break;
        case 'overdueProjects':
            const overdueProjects = state.projects.filter(p => {
                const tasks = state.tasks.filter(t => t.projectId === p.id);
                return tasks.some(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');
            }).length;
            title = t('dashboard.kpi_overdue_projects');
            value = `${overdueProjects}`;
            icon = 'error';
            iconBg = '#fee2e2';
            iconFg = '#ef4444';
            break;
    }
    
    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col justify-between relative" data-widget-id="${widget.id}" draggable="${isEditing}">
            ${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-text-subtle">${title}</span>
                <span class="material-icons-sharp text-lg" style="background-color: ${iconBg}; color: ${iconFg}; border-radius: 50%; padding: 4px;">${icon}</span>
            </div>
            <p class="text-2xl font-semibold">${value}</p>
        </div>
    `;
}

function renderRecentProjectsWidget(widget: DashboardWidget, isEditing: boolean) {
    const recentProjects = state.projects
        .filter(p => p.workspaceId === state.activeWorkspaceId)
        .slice(0, 5);

    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold text-md">${t('dashboard.widget_recent_projects_title')}</h4>
                <a href="/projects" class="text-sm text-primary hover:underline">${t('dashboard.view_all')}</a>
            </div>
            <div class="space-y-3">
                ${recentProjects.length > 0 ? recentProjects.map(p => {
                    const tasks = state.tasks.filter(t => t.projectId === p.id);
                    const completed = tasks.filter(t => t.status === 'done').length;
                    const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
                    return `
                        <div>
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
    `;
}

function renderTodaysTasksWidget(widget: DashboardWidget, isEditing: boolean) {
    const today = new Date().toISOString().slice(0, 10);
    const filterUserId = widget.config.userId || state.currentUser?.id;
    
    const todaysTasks = state.tasks.filter(t => {
        const isAssigned = state.taskAssignees.some(a => a.taskId === t.id && a.userId === filterUserId);
        return isAssigned && t.dueDate === today && t.status !== 'done';
    });

    return `
         <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
            ${isEditing ? `
                <button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>
                <button class="configure-widget-btn" data-configure-widget-id="${widget.id}" title="Configure widget"><span class="material-icons-sharp text-base">settings</span></button>
            ` : ''}
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold text-md">${t('dashboard.widget_todays_tasks_title')}</h4>
                <a href="/tasks" class="text-sm text-primary hover:underline">${t('dashboard.view_all')}</a>
            </div>
            <div class="space-y-2">
                ${todaysTasks.length > 0 ? todaysTasks.map(task => `
                    <div class="flex items-center gap-2">
                        <span class="h-2 w-2 rounded-full ${task.priority === 'high' ? 'bg-danger' : task.priority === 'medium' ? 'bg-warning' : 'bg-primary/50'}"></span>
                        <span class="text-sm">${task.name}</span>
                    </div>
                `).join('') : `<p class="text-sm text-text-subtle">No tasks due today. Great job!</p>`}
            </div>
        </div>
    `;
}

function renderActivityFeedWidget(widget: DashboardWidget, isEditing: boolean) {
     const activities = [...state.comments, ...state.timeLogs]
        .filter(item => item.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
    
    const getActivityText = (item: Comment | TimeLog) => {
        const user = state.users.find(u => u.id === item.userId);
        const task = state.tasks.find(t => t.id === item.taskId);
        if (!user || !task) return { text: '...', icon: 'help', color: '' };
        
        if ('content' in item) {
            return {
                text: `<strong class="font-medium">${user.name}</strong> commented on <strong class="font-medium">${task.name}</strong>`,
                icon: 'chat_bubble',
                color: '#8B5CF6'
            };
        } else {
             return {
                text: `<strong class="font-medium">${user.name}</strong> logged <strong class="font-medium">${formatDuration(item.trackedSeconds)}</strong> on <strong class="font-medium">${task.name}</strong>`,
                icon: 'timer',
                color: '#3B82F6'
            };
        }
    };
    
    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
            ${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>` : ''}
             <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold text-md">${t('dashboard.widget_activity_feed_title')}</h4>
            </div>
            <div class="space-y-4">
                ${activities.length > 0 ? activities.map(item => {
                    const { text, icon, color } = getActivityText(item);
                    return `
                        <div class="flex items-start gap-3">
                            <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style="background-color: ${color}20; color: ${color};">
                                <span class="material-icons-sharp text-lg">${icon}</span>
                            </div>
                            <div class="flex-1">
                                <p class="text-sm">${text}</p>
                                <div class="text-xs text-text-subtle mt-0.5">${formatDate(item.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div>
                            </div>
                        </div>
                    `;
                }).join('') : `<p class="text-sm text-text-subtle">${t('dashboard.no_activity_yet')}</p>`}
            </div>
        </div>
    `;
}

function renderQuickActionsWidget(widget: DashboardWidget, isEditing: boolean) {
    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addProject"><span class="material-icons-sharp text-3xl text-indigo-500 mb-2">add_business</span><span class="text-sm font-medium">${t('dashboard.action_new_project')}</span></button>
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addClient"><span class="material-icons-sharp text-3xl text-green-500 mb-2">person_add</span><span class="text-sm font-medium">${t('dashboard.action_add_client')}</span></button>
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addInvoice"><span class="material-icons-sharp text-3xl text-red-500 mb-2">receipt_long</span><span class="text-sm font-medium">${t('dashboard.action_create_invoice')}</span></button>
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addCalendarEvent"><span class="material-icons-sharp text-3xl text-amber-500 mb-2">event</span><span class="text-sm font-medium">${t('dashboard.action_schedule_meeting')}</span></button>
            </div>
        </div>
    `;
}

function renderTimeTrackingSummaryWidget(widget: DashboardWidget, isEditing: boolean) {
    const today = new Date().toISOString().slice(0, 10);
    const timeLogsToday = state.timeLogs.filter(log => log.workspaceId === state.activeWorkspaceId && log.createdAt.startsWith(today));
    const totalSecondsToday = timeLogsToday.reduce((sum, log) => sum + log.trackedSeconds, 0);

    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold text-md">${t('dashboard.widget_time_tracking_summary_title')}</h4>
                <span class="material-icons-sharp text-lg text-blue-500">timer</span>
            </div>
            <div>
                <p class="text-xs text-text-subtle">${t('dashboard.time_today')}</p>
                <p class="text-2xl font-bold">${formatDuration(totalSecondsToday)}</p>
            </div>
        </div>
    `;
}

function renderInvoiceSummaryWidget(widget: DashboardWidget, isEditing: boolean) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingInvoices = state.invoices.filter(i => i.workspaceId === state.activeWorkspaceId && i.status === 'pending' && new Date(i.dueDate) >= today);
    const overdueInvoices = state.invoices.filter(i => i.workspaceId === state.activeWorkspaceId && i.status === 'pending' && new Date(i.dueDate) < today);

    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);

    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold text-md">${t('dashboard.widget_invoice_summary_title')}</h4>
                 <span class="material-icons-sharp text-lg text-green-500">receipt_long</span>
            </div>
            <div class="space-y-2">
                <div>
                    <p class="text-xs text-text-subtle">${t('dashboard.invoices_pending')}</p>
                    <p class="text-lg font-bold">${formatCurrency(pendingAmount, 'PLN')}</p>
                </div>
                 <div>
                    <p class="text-xs text-text-subtle">${t('dashboard.invoices_overdue')}</p>
                    <p class="text-lg font-bold text-danger">${formatCurrency(overdueAmount, 'PLN')}</p>
                </div>
            </div>
        </div>
    `;
}

function renderGoalProgressWidget(widget: DashboardWidget, isEditing: boolean) {
    const goals = state.objectives.filter(o => o.workspaceId === state.activeWorkspaceId && o.status === 'in_progress');
    const totalProgress = goals.reduce((sum, goal) => {
        const target = goal.targetValue ?? 1;
        const current = goal.currentValue ?? 0;
        if (target > 0) {
            return sum + Math.min(100, Math.max(0, (current / target) * 100));
        }
        return sum;
    }, 0);
    const avgProgress = goals.length > 0 ? Math.round(totalProgress / goals.length) : 0;

    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}" title="Remove widget"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold text-md">${t('dashboard.widget_goal_progress_title')}</h4>
                <span class="material-icons-sharp text-lg text-purple-500">track_changes</span>
            </div>
             <div>
                <div class="flex justify-between items-center text-sm mb-1">
                    <span class="font-medium">${t('goals.avg_progress')}</span>
                    <span class="text-text-subtle">${avgProgress}%</span>
                </div>
                <div class="w-full bg-background rounded-full h-1.5">
                    <div class="bg-primary h-1.5 rounded-full" style="width: ${avgProgress}%;"></div>
                </div>
            </div>
        </div>
    `;
}

function renderOverviewTab() {
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '';

    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    const gridCols = activeWorkspace?.dashboardGridColumns || 3;
    const gridColsClassMap: { [key: number]: string } = {
        3: 'lg:grid-cols-3',
        4: 'lg:grid-cols-4',
        5: 'lg:grid-cols-5',
        6: 'lg:grid-cols-6',
    };
    const gridColsClass = gridColsClassMap[gridCols] || 'lg:grid-cols-3';
    
    const isEditing = state.ui.dashboard.isEditing;
    const userWidgets = state.dashboardWidgets
        .filter(w => w.userId === currentUser.id && w.workspaceId === activeWorkspaceId)
        .sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    // One-time setup for users who have no widgets configured
    if (userWidgets.length === 0 && !isEditing) {
        dashboardHandlers.createDefaultWidgets();
        return `<div class="flex items-center justify-center h-full"><p>Setting up your dashboard...</p></div>`;
    }
    
    const renderWidget = (widget: DashboardWidget) => {
        switch(widget.type) {
            case 'kpiMetric': return renderKpiMetricWidget(widget, isEditing);
            case 'recentProjects': return renderRecentProjectsWidget(widget, isEditing);
            case 'todaysTasks': return renderTodaysTasksWidget(widget, isEditing);
            case 'activityFeed': return renderActivityFeedWidget(widget, isEditing);
            case 'quickActions': return renderQuickActionsWidget(widget, isEditing);
            case 'timeTrackingSummary': return renderTimeTrackingSummaryWidget(widget, isEditing);
            case 'invoiceSummary': return renderInvoiceSummaryWidget(widget, isEditing);
            case 'goalProgress': return renderGoalProgressWidget(widget, isEditing);
            default: return `<div class="bg-content p-4 rounded-lg shadow-sm relative" data-widget-id="${widget.id}" draggable="${isEditing}">${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>`: ''}Widget type "${widget.type}" not found.</div>`;
        }
    };

    return `
        <div class="grid grid-cols-1 ${gridColsClass} gap-6 ${isEditing ? 'dashboard-editing' : ''}" id="dashboard-widget-area">
            ${userWidgets.map(renderWidget).join('')}
        </div>
    `;
}

function renderMyDayTab() {
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '';

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // --- 1. Get Tasks ---
    const userTasks = state.tasks.filter(task => 
        task.workspaceId === activeWorkspaceId &&
        !task.isArchived &&
        state.taskAssignees.some(a => a.taskId === task.id && a.userId === currentUser.id)
    );

    const overdueTasks = userTasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'done');
    const todayTasks = userTasks.filter(t => t.dueDate === todayStr && t.status !== 'done');
    const tomorrowTasks = userTasks.filter(t => t.dueDate === tomorrowStr && t.status !== 'done');

    const renderTaskGroup = (title: string, tasks: Task[]) => {
        if (tasks.length === 0) {
            return '';
        }
        return `
            <div>
                <h4 class="text-sm font-semibold mb-2 text-text-subtle uppercase tracking-wider">${title}</h4>
                <div class="space-y-2">
                    ${tasks.map(task => {
                        const project = state.projects.find(p => p.id === task.projectId);
                        return `
                            <div class="bg-content p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-background" data-task-id="${task.id}">
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

    // --- 2. Get Schedule ---
    const todayDate = new Date(todayStr + 'T12:00:00Z');
    const scheduleItems: (CalendarEvent | TimeOffRequest | PublicHoliday)[] = [
        ...state.calendarEvents.filter(e => {
            if (e.workspaceId !== activeWorkspaceId) return false;
            const start = new Date(e.startDate + 'T00:00:00Z');
            const end = new Date(e.endDate + 'T23:59:59Z');
            return todayDate >= start && todayDate <= end;
        }),
        ...state.timeOffRequests.filter(to => {
            if (to.workspaceId !== activeWorkspaceId || to.status !== 'approved') return false;
            const start = new Date(to.startDate + 'T00:00:00Z');
            const end = new Date(to.endDate + 'T23:59:59Z');
            return todayDate >= start && todayDate <= end;
        }),
        ...state.publicHolidays.filter(h => h.date === todayStr)
    ];

    const renderScheduleItem = (item: any) => {
        let icon = 'event';
        let text = '';
        let time = '';

        if ('userId' in item) { // TimeOffRequest
            const user = state.users.find(u => u.id === item.userId);
            icon = 'flight_takeoff';
            text = `${user?.name || 'Someone'} is on ${item.type.replace('_', ' ')}`;
            time = 'All day';
        } else if ('title' in item) { // CalendarEvent
            const event = item as CalendarEvent;
            icon = event.type === 'on-call' ? 'phone_in_talk' : 'event';
            text = event.title;
            time = 'All day';
        } else { // PublicHoliday
            icon = 'celebration';
            text = item.name;
            time = 'All day';
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


    // --- 3. Get Notifications ---
    const userNotifications = state.notifications.filter(n => 
        n.userId === currentUser.id && 
        n.workspaceId === activeWorkspaceId &&
        !n.isRead
    ).slice(0, 5);


    return `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div class="lg:col-span-2 space-y-6">
                ${renderTaskGroup(t('dashboard.my_day_overdue'), overdueTasks)}
                ${renderTaskGroup(t('dashboard.my_day_today'), todayTasks)}
                ${renderTaskGroup(t('dashboard.my_day_tomorrow'), tomorrowTasks)}
                 ${overdueTasks.length === 0 && todayTasks.length === 0 && tomorrowTasks.length === 0 ? `<div class="bg-content p-8 rounded-lg text-center text-text-subtle">${t('dashboard.my_day_no_tasks')}</div>` : ''}
            </div>
            <div class="space-y-6">
                <div class="bg-content p-4 rounded-lg">
                    <h4 class="font-semibold mb-3">${t('dashboard.my_day_todays_schedule')}</h4>
                    <div class="space-y-3">
                        ${scheduleItems.length > 0 ? scheduleItems.map(renderScheduleItem).join('') : `<p class="text-sm text-text-subtle">${t('dashboard.my_day_no_schedule')}</p>`}
                    </div>
                </div>
                <div class="bg-content p-4 rounded-lg">
                    <h4 class="font-semibold mb-3">${t('dashboard.my_day_for_you')}</h4>
                     <div class="space-y-3">
                        ${userNotifications.length > 0 ? userNotifications.map(n => `
                            <div class="flex items-start gap-3 cursor-pointer notification-item" data-notification-id="${n.id}">
                                <div class="mt-1"><span class="material-icons-sharp text-primary text-lg">info</span></div>
                                <p class="text-sm">${n.text}</p>
                            </div>
                        `).join('') : `<p class="text-sm text-text-subtle">${t('dashboard.my_day_no_notifications')}</p>`}
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function initDashboardCharts() {
    destroyCharts();
}

export function DashboardPage() {
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '';
    
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) return '';
    
    const { isEditing, activeTab } = state.ui.dashboard;

    let tabContent = '';
    switch (activeTab) {
        case 'my_day': tabContent = renderMyDayTab(); break;
        case 'overview': tabContent = renderOverviewTab(); break;
        case 'projects': tabContent = '<div class="flex items-center justify-center h-64"><p class="text-text-subtle">Projects dashboard coming soon.</p></div>'; break;
        case 'team': tabContent = '<div class="flex items-center justify-center h-64"><p class="text-text-subtle">Team dashboard coming soon.</p></div>'; break;
        case 'analytics': tabContent = '<div class="flex items-center justify-center h-64"><p class="text-text-subtle">Analytics dashboard coming soon.</p></div>'; break;
    }

    return `
        <div class="space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold">${t('dashboard.welcome_message').replace('{name}', currentUser.name?.split(' ')[0] || '')}</h2>
                    <p class="text-text-subtle">${t('dashboard.welcome_sub')}</p>
                </div>
                <div class="flex items-center gap-4">
                     ${isEditing ? `
                        <div class="flex items-center gap-2">
                            <label for="dashboard-grid-columns" class="text-sm font-medium text-text-subtle">${t('dashboard.grid_columns')}</label>
                            <select id="dashboard-grid-columns" class="bg-content border border-border-color rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary outline-none">
                                ${[3, 4, 5, 6].map(c => `<option value="${c}" ${(activeWorkspace.dashboardGridColumns || 3) === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                         ${activeTab === 'overview' ? `
                            <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="addWidget">
                               <span class="material-icons-sharp text-base">add</span>
                               ${t('dashboard.add_widget')}
                            </button>
                        ` : ''}
                    ` : ''}
                    <button id="toggle-dashboard-edit-mode" class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md ${isEditing ? 'bg-primary text-white' : 'bg-content border border-border-color hover:bg-background'}">
                       <span class="material-icons-sharp text-base">${isEditing ? 'done' : 'edit'}</span>
                       ${isEditing ? t('dashboard.done_editing') : t('dashboard.edit_dashboard')}
                    </button>
                </div>
            </div>

            <div class="border-b border-border-color">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'my_day' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="my_day">${t('dashboard.tab_my_day')}</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="overview">${t('dashboard.tab_overview')}</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'projects' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="projects">${t('dashboard.tab_projects')}</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'team' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="team">${t('dashboard.tab_team')}</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="analytics">${t('dashboard.tab_analytics')}</button>
                </nav>
            </div>
            
            ${tabContent}
        </div>
    `;
}