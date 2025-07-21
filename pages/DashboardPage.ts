

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { DashboardWidget, Task, TimeLog, Comment } from '../types.ts';
import { formatDuration, formatDate, formatCurrency } from '../utils.ts';
import { apiFetch } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';

declare const Chart: any;
let charts: { [key: string]: any } = {};

async function fetchDashboardData() {
    if (!state.activeWorkspaceId || state.ui.dashboard.isLoading) return;

    if (state.ui.dashboard.loadedWorkspaceId === state.activeWorkspaceId) {
        initDashboardCharts(); // Re-initialize charts if data is already present
        return;
    }

    state.ui.dashboard.isLoading = true;
    renderApp(); 

    try {
        const data = await apiFetch(`/api/dashboard-data?workspaceId=${state.activeWorkspaceId}`);
        
        state.projects = data.projects || [];
        state.tasks = data.tasks || [];
        state.taskAssignees = data.taskAssignees || [];
        state.timeLogs = data.timeLogs || [];
        state.comments = data.comments || [];
        state.clients = data.clients || [];
        state.invoices = data.invoices || [];
        state.calendarEvents = data.calendarEvents || [];
        
        state.ui.dashboard.loadedWorkspaceId = state.activeWorkspaceId;
        
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        state.ui.dashboard.loadedWorkspaceId = null;
    } finally {
        state.ui.dashboard.isLoading = false;
        renderApp();
    }
}

function destroyCharts() {
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
}

// --- KPI & WIDGET RENDERERS ---

function renderKpiMetric(
    title: string, value: string, percentageChange: number | null, footerText: string,
    icon: string, iconBgColor: string, iconColor: string
) {
    const changeIndicator = percentageChange !== null ? `
        <span class="flex items-center text-xs ${percentageChange >= 0 ? 'text-success' : 'text-danger'}">
            <span class="material-icons-sharp text-sm">${percentageChange >= 0 ? 'trending_up' : 'trending_down'}</span>
            ${Math.abs(percentageChange)}%
        </span>
    ` : '';

    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col justify-between">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-text-subtle">${title}</span>
                <span class="material-icons-sharp text-lg" style="background-color: ${iconBgColor}; color: ${iconColor}; border-radius: 50%; padding: 4px;">${icon}</span>
            </div>
            <p class="text-2xl font-semibold">${value}</p>
            <div class="flex items-center gap-1 text-xs text-text-subtle mt-1">
                ${changeIndicator}
                <span>${footerText}</span>
            </div>
        </div>
    `;
}

function renderRecentProjectsWidget(widget: DashboardWidget, isEditing: boolean) {
    const recentProjects = state.projects
        .filter(p => p.workspaceId === state.activeWorkspaceId)
        .slice(0, 5);

    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="absolute top-2 right-2 p-1 rounded-full text-text-subtle hover:bg-background hover:text-danger" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>` : ''}
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
    const todaysTasks = state.tasks.filter(t => t.dueDate === today && t.status !== 'done');

    return `
         <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
            ${isEditing ? `<button class="absolute top-2 right-2 p-1 rounded-full text-text-subtle hover:bg-background hover:text-danger" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>` : ''}
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
            ${isEditing ? `<button class="absolute top-2 right-2 p-1 rounded-full text-text-subtle hover:bg-background hover:text-danger" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>` : ''}
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

function renderScheduleWidget(widget: DashboardWidget, isEditing: boolean) {
    const today = new Date();
    const meetingsToday = state.calendarEvents.filter(e => {
        const startDate = new Date(e.startDate);
        return startDate.getFullYear() === today.getFullYear() &&
               startDate.getMonth() === today.getMonth() &&
               startDate.getDate() === today.getDate();
    });
    return `
        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
            ${isEditing ? `<button class="absolute top-2 right-2 p-1 rounded-full text-text-subtle hover:bg-background hover:text-danger" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex items-center gap-2 mb-2"><span class="material-icons-sharp text-blue-500">calendar_month</span><h4 class="font-semibold text-md text-blue-800 dark:text-blue-200">${t('dashboard.widget_schedule_title')}</h4></div>
            <p class="text-sm text-blue-700 dark:text-blue-300 flex-grow">You have ${meetingsToday.length} meetings scheduled for today</p>
            <a href="/team-calendar" class="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline self-start mt-2">View Calendar &rarr;</a>
        </div>
    `;
}

function renderAlertsWidget(widget: DashboardWidget, isEditing: boolean) {
     const overdueProjects = state.projects.filter(p => {
        const tasks = state.tasks.filter(t => t.projectId === p.id);
        return tasks.some(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');
    }).length;

    return `
        <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="absolute top-2 right-2 p-1 rounded-full text-text-subtle hover:bg-background hover:text-danger" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex items-center gap-2 mb-2"><span class="material-icons-sharp text-amber-500">warning</span><h4 class="font-semibold text-md text-amber-800 dark:text-amber-200">${t('dashboard.widget_alerts_title')}</h4></div>
            <p class="text-sm text-amber-700 dark:text-amber-300 flex-grow">${overdueProjects} projects need attention</p>
            <a href="/projects" class="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline self-start mt-2">View Alerts &rarr;</a>
        </div>
    `;
}

function renderWeeklyPerformanceWidget(widget: DashboardWidget, isEditing: boolean) {
    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
            ${isEditing ? `<button class="absolute top-2 right-2 p-1 rounded-full text-text-subtle hover:bg-background hover:text-danger" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold text-md">${t('dashboard.widget_weekly_performance_title')}</h4>
                <a href="/reports" class="text-sm text-primary hover:underline">Full Report</a>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div class="flex flex-col">
                    <div class="text-3xl font-bold text-primary">94%</div>
                    <div class="text-sm text-text-subtle">Task Completion</div>
                    <div class="text-xs text-success mt-1">+5% from last week</div>
                </div>
                <div class="flex flex-col">
                    <div class="text-3xl font-bold text-purple-500">87%</div>
                    <div class="text-sm text-text-subtle">Team Efficiency</div>
                    <div class="text-xs text-success mt-1">+3% from last week</div>
                </div>
                <div class="flex flex-col">
                    <div class="text-3xl font-bold text-green-500">156h</div>
                    <div class="text-sm text-text-subtle">Hours Tracked</div>
                    <div class="text-xs text-danger mt-1">Target: 160h</div>
                </div>
                 <div class="flex flex-col">
                    <div class="text-3xl font-bold text-amber-500">${formatCurrency(24500, 'PLN')}</div>
                    <div class="text-sm text-text-subtle">Revenue Generated</div>
                    <div class="text-xs text-success mt-1">+18% from last week</div>
                </div>
            </div>
        </div>
    `;
}

function renderQuickActionsWidget(widget: DashboardWidget, isEditing: boolean) {
    return `
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col relative" data-widget-id="${widget.id}" draggable="${isEditing}">
             ${isEditing ? `<button class="absolute top-2 right-2 p-1 rounded-full text-text-subtle hover:bg-background hover:text-danger" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>` : ''}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addProject"><span class="material-icons-sharp text-3xl text-indigo-500 mb-2">add_business</span><span class="text-sm font-medium">${t('dashboard.action_new_project')}</span></button>
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addClient"><span class="material-icons-sharp text-3xl text-green-500 mb-2">person_add</span><span class="text-sm font-medium">${t('dashboard.action_add_client')}</span></button>
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addInvoice"><span class="material-icons-sharp text-3xl text-red-500 mb-2">receipt_long</span><span class="text-sm font-medium">${t('dashboard.action_create_invoice')}</span></button>
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors" data-modal-target="addCalendarEvent"><span class="material-icons-sharp text-3xl text-amber-500 mb-2">event</span><span class="text-sm font-medium">${t('dashboard.action_schedule_meeting')}</span></button>
            </div>
        </div>
    `;
}

function renderOverviewTab() {
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '';
    
    const isEditing = state.ui.dashboard.isEditing;
    const userWidgets = state.dashboardWidgets.filter(w => w.userId === currentUser.id && w.workspaceId === activeWorkspaceId);
    
    const renderWidget = (widget: DashboardWidget) => {
        switch(widget.type) {
            case 'recentProjects': return renderRecentProjectsWidget(widget, isEditing);
            case 'todaysTasks': return renderTodaysTasksWidget(widget, isEditing);
            case 'activityFeed': return renderActivityFeedWidget(widget, isEditing);
            case 'schedule': return renderScheduleWidget(widget, isEditing);
            case 'alerts': return renderAlertsWidget(widget, isEditing);
            case 'weeklyPerformance': return renderWeeklyPerformanceWidget(widget, isEditing);
            case 'quickActions': return renderQuickActionsWidget(widget, isEditing);
            default: return ``;
        }
    };

    const totalRevenue = state.invoices
        .filter(i => i.workspaceId === activeWorkspaceId && i.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
    const activeProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId).length;
    const totalClients = state.clients.filter(c => c.workspaceId === activeWorkspaceId).length;
    const overdueProjects = state.projects.filter(p => {
        const tasks = state.tasks.filter(t => t.projectId === p.id);
        return tasks.some(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');
    }).length;

    return `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            ${renderKpiMetric(t('dashboard.kpi_total_revenue'), formatCurrency(totalRevenue, 'PLN'), 12.5, t('dashboard.vs_last_month'), 'attach_money', '#dcfce7', '#22c55e')}
            ${renderKpiMetric(t('dashboard.kpi_active_projects'), `${activeProjects}`, 3, t('dashboard.vs_last_month'), 'folder', '#e0e7ff', '#4f46e5')}
            ${renderKpiMetric(t('dashboard.kpi_total_clients'), `${totalClients}`, 8, t('dashboard.vs_last_month'), 'people', '#f3e8ff', '#9333ea')}
            ${renderKpiMetric(t('dashboard.kpi_overdue_projects'), `${overdueProjects}`, -5.2, t('dashboard.vs_last_month'), 'error', '#fee2e2', '#ef4444')}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 ${isEditing ? 'border-2 border-dashed border-border-color p-2 rounded-lg' : ''}" id="dashboard-widget-area">
            ${userWidgets.map(renderWidget).join('')}
        </div>
    `;
}

export function initDashboardCharts() {
    destroyCharts();
}

export function DashboardPage() {
    fetchDashboardData();
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '<div class="flex items-center justify-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>';

    if (state.ui.dashboard.isLoading) {
        return `
            <div class="flex flex-col items-center justify-center h-full">
                <div class="w-full max-w-xs text-center p-4">
                    <div class="w-full bg-border-color rounded-full h-1.5 mb-4 overflow-hidden">
                        <div class="bg-primary h-1.5 rounded-full animate-pulse" style="width: 75%"></div>
                    </div>
                    <p class="text-sm text-text-subtle">Loading your dashboard...</p>
                </div>
            </div>
        `;
    }
    
    const { isEditing, activeTab } = state.ui.dashboard;

    let tabContent = '';
    switch (activeTab) {
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
                <div class="flex items-center gap-2">
                    <button id="toggle-dashboard-edit-mode" class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md ${isEditing ? 'bg-primary text-white' : 'bg-content border border-border-color hover:bg-background'}">
                       <span class="material-icons-sharp text-base">${isEditing ? 'done' : 'edit'}</span>
                       ${isEditing ? t('dashboard.done_editing') : t('dashboard.edit_dashboard')}
                    </button>
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" id="dashboard-quick-actions-btn">
                        <span class="material-icons-sharp text-base">bolt</span> Quick Actions
                    </button>
                </div>
            </div>

            <div class="border-b border-border-color">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="overview">Overview</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'projects' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="projects">Projects</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'team' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="team">Team</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="analytics">Analytics</button>
                </nav>
            </div>
            
            ${tabContent}

            ${isEditing && activeTab === 'overview' ? `
                <button class="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary-hover transition-transform transform hover:scale-105" id="add-widget-btn" aria-label="${t('dashboard.add_widget')}" title="${t('dashboard.add_widget')}">
                    <span class="material-icons-sharp">add</span>
                </button>
            ` : ''}
        </div>
    `;
}
