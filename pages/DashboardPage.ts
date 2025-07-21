
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { DashboardWidget, Task, TimeLog, Comment, Project, Client, Invoice, CalendarEvent, DashboardWidgetType } from '../types.ts';
import { formatDuration, camelToSnake, formatDate, formatCurrency } from '../utils.ts';
import { can } from '../permissions.ts';
import { apiFetch } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';

declare const Chart: any;

let charts: { [key: string]: any } = {};

async function fetchDashboardData() {
    if (!state.activeWorkspaceId || state.ui.dashboard.isLoading) return;

    if (state.ui.dashboard.loadedWorkspaceId === state.activeWorkspaceId) {
        initDashboardCharts();
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
        <span class="percentage ${percentageChange >= 0 ? 'positive' : 'negative'}">
            <span class="material-icons-sharp">${percentageChange >= 0 ? 'trending_up' : 'trending_down'}</span>
            ${Math.abs(percentageChange)}%
        </span>
    ` : '';

    return `
        <div class="kpi-card-v2">
            <div class="card-header">
                <span>${title}</span>
                <span class="material-icons-sharp" style="background-color: ${iconBgColor}; color: ${iconColor}; border-radius: 50%; padding: 4px;">${icon}</span>
            </div>
            <div class="card-value">${value}</div>
            <div class="card-footer">
                ${changeIndicator}
                <span class="subtle-text">${footerText}</span>
            </div>
        </div>
    `;
}

function renderRecentProjectsWidget(widget: DashboardWidget, isEditing: boolean) {
    const recentProjects = state.projects
        .filter(p => p.workspaceId === state.activeWorkspaceId)
        .sort((a,b) => (b.id > a.id ? 1 : -1)) // simple sort by creation time
        .slice(0, 5);

    return `
        <div class="widget-container" data-widget-id="${widget.id}">
             ${isEditing ? `<button class="btn-icon remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp">close</span></button>` : ''}
            <div class="widget-header">
                <h4>${t('dashboard.widget_recent_projects_title')}</h4>
                <a href="/projects" class="btn-link">${t('dashboard.view_all')}</a>
            </div>
            <div class="project-list">
                ${recentProjects.length > 0 ? recentProjects.map(p => {
                    const tasks = state.tasks.filter(t => t.projectId === p.id);
                    const completed = tasks.filter(t => t.status === 'done').length;
                    const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
                    return `
                        <div class="project-list-item">
                            <span class="project-name">${p.name}</span>
                            <div class="progress-bar">
                                <div class="progress-bar-inner" style="width: ${progress}%;"></div>
                            </div>
                            <span class="due-date">${Math.round(progress)}%</span>
                        </div>
                    `;
                }).join('') : `<p class="subtle-text">No projects yet.</p>`}
            </div>
        </div>
    `;
}

function renderTodaysTasksWidget(widget: DashboardWidget, isEditing: boolean) {
    const today = new Date().toISOString().slice(0, 10);
    const todaysTasks = state.tasks.filter(t => t.dueDate === today && t.status !== 'done');

    return `
         <div class="widget-container" data-widget-id="${widget.id}">
            ${isEditing ? `<button class="btn-icon remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp">close</span></button>` : ''}
            <div class="widget-header">
                <h4>${t('dashboard.widget_todays_tasks_title')}</h4>
                <a href="/tasks" class="btn-link">${t('dashboard.view_all')}</a>
            </div>
            <div class="task-list">
                ${todaysTasks.length > 0 ? todaysTasks.map(task => `
                    <div class="task-list-item">
                        <span class="priority-dot ${task.priority || 'low'}"></span>
                        <span class="task-name">${task.name}</span>
                    </div>
                `).join('') : `<p class="subtle-text">No tasks due today. Great job!</p>`}
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
                text: `<strong>${user.name}</strong> commented on <strong>${task.name}</strong>`,
                icon: 'chat_bubble',
                color: '#8B5CF6'
            };
        } else {
             return {
                text: `<strong>${user.name}</strong> logged <strong>${formatDuration(item.trackedSeconds)}</strong> on <strong>${task.name}</strong>`,
                icon: 'timer',
                color: '#3B82F6'
            };
        }
    };
    
    return `
        <div class="widget-container" data-widget-id="${widget.id}">
            ${isEditing ? `<button class="btn-icon remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp">close</span></button>` : ''}
             <div class="widget-header">
                <h4>${t('dashboard.widget_activity_feed_title')}</h4>
            </div>
            <div class="feed-list">
                ${activities.length > 0 ? activities.map(item => {
                    const { text, icon, color } = getActivityText(item);
                    return `
                        <div class="feed-item">
                            <div class="feed-item-icon" style="background-color: ${color}20; color: ${color};">
                                <span class="material-icons-sharp">${icon}</span>
                            </div>
                            <div class="feed-item-content">
                                <p>${text}</p>
                                <div class="time">${formatDate(item.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div>
                            </div>
                        </div>
                    `;
                }).join('') : `<p class="subtle-text">${t('dashboard.no_activity_yet')}</p>`}
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
        <div class="info-card-widget schedule" data-widget-id="${widget.id}">
            ${isEditing ? `<button class="btn-icon remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp">close</span></button>` : ''}
            <div class="card-header"><span class="material-icons-sharp">calendar_month</span> ${t('dashboard.widget_schedule_title')}</div>
            <div class="card-body"><p>You have ${meetingsToday.length} meetings scheduled for today</p></div>
            <div class="card-footer"><a href="/team-calendar" class="btn-link">View Calendar &rarr;</a></div>
        </div>
    `;
}

function renderAlertsWidget(widget: DashboardWidget, isEditing: boolean) {
     const overdueProjects = state.projects.filter(p => {
        const tasks = state.tasks.filter(t => t.projectId === p.id);
        return tasks.some(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');
    }).length;

    return `
        <div class="info-card-widget alerts" data-widget-id="${widget.id}">
             ${isEditing ? `<button class="btn-icon remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp">close</span></button>` : ''}
            <div class="card-header"><span class="material-icons-sharp">warning</span> ${t('dashboard.widget_alerts_title')}</div>
            <div class="card-body"><p>${overdueProjects} projects need attention</p></div>
            <div class="card-footer"><a href="/projects" class="btn-link">View Alerts &rarr;</a></div>
        </div>
    `;
}

function renderWeeklyPerformanceWidget(widget: DashboardWidget, isEditing: boolean) {
    // Dummy data for now
    return `
        <div class="widget-container weekly-performance-widget" data-widget-id="${widget.id}">
            ${isEditing ? `<button class="btn-icon remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp">close</span></button>` : ''}
            <div class="widget-header">
                <h4>${t('dashboard.widget_weekly_performance_title')}</h4>
                <a href="/reports" class="btn-link">Full Report</a>
            </div>
            <div class="performance-grid">
                <div class="performance-item">
                    <div class="value" style="color:#3B82F6;">94%</div>
                    <div class="label">Task Completion</div>
                    <div class="change positive">+5% from last week</div>
                </div>
                <div class="performance-item">
                    <div class="value" style="color:#A855F7;">87%</div>
                    <div class="label">Team Efficiency</div>
                    <div class="change positive">+3% from last week</div>
                </div>
                <div class="performance-item">
                    <div class="value" style="color:#10B981;">156h</div>
                    <div class="label">Hours Tracked</div>
                    <div class="change negative">Target: 160h</div>
                </div>
                 <div class="performance-item">
                    <div class="value" style="color:#F59E0B;">${formatCurrency(24500, 'PLN')}</div>
                    <div class="label">Revenue Generated</div>
                    <div class="change positive">+18% from last week</div>
                </div>
            </div>
        </div>
    `;
}

function renderQuickActionsWidget(widget: DashboardWidget, isEditing: boolean) {
    return `
        <div class="widget-container quick-actions-container" data-widget-id="${widget.id}">
             ${isEditing ? `<button class="btn-icon remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp">close</span></button>` : ''}
            <div class="quick-actions-grid">
                <button class="quick-action-btn" data-modal-target="addProject"><span class="material-icons-sharp" style="color: #6366F1;">add_business</span> ${t('dashboard.action_new_project')}</button>
                <button class="quick-action-btn" data-modal-target="addClient"><span class="material-icons-sharp" style="color: #10B981;">person_add</span> ${t('dashboard.action_add_client')}</button>
                <button class="quick-action-btn" data-modal-target="addInvoice"><span class="material-icons-sharp" style="color: #EF4444;">receipt_long</span> ${t('dashboard.action_create_invoice')}</button>
                <button class="quick-action-btn" data-modal-target="addCalendarEvent"><span class="material-icons-sharp" style="color: #F59E0B;">event</span> ${t('dashboard.action_schedule_meeting')}</button>
            </div>
        </div>
    `;
}

export function initDashboardCharts() {
    // This can be expanded later if new charts are added.
}

export function DashboardPage() {
    fetchDashboardData();
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '<div class="widget-loader"></div>';

    if (state.ui.dashboard.isLoading) {
        return `
            <div class="dashboard-page-container">
                <div class="loading-container" style="height: 60vh;">
                    <div class="loading-progress-bar"></div>
                    <p>Loading your dashboard...</p>
                </div>
            </div>
        `;
    }
    
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

    // --- CALCULATE KPIs ---
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
        <div class="dashboard-page-container">
            <div class="dashboard-header">
                <div class="header-left">
                    <h2>${t('dashboard.welcome_message').replace('{name}', currentUser.name?.split(' ')[0] || '')}</h2>
                    <p class="subtle-text">${t('dashboard.welcome_sub')}</p>
                </div>
                <div class="header-right">
                    <button id="toggle-dashboard-edit-mode" class="btn ${isEditing ? 'btn-primary' : 'btn-secondary'}">
                       <span class="material-icons-sharp">${isEditing ? 'done' : 'edit'}</span>
                       ${isEditing ? t('dashboard.done_editing') : t('dashboard.edit_dashboard')}
                    </button>
                    <button class="btn btn-primary" id="dashboard-quick-actions-btn">
                        <span class="material-icons-sharp">bolt</span> Quick Actions
                    </button>
                </div>
            </div>

            <div class="dashboard-tabs">
                <button class="dashboard-tab active">Overview</button>
                <button class="dashboard-tab">Projects</button>
                <button class="dashboard-tab">Team</button>
                <button class="dashboard-tab">Analytics</button>
            </div>

            <div class="dashboard-kpi-grid">
                ${renderKpiMetric(t('dashboard.kpi_total_revenue'), formatCurrency(totalRevenue, 'PLN'), 12.5, t('dashboard.vs_last_month'), 'attach_money', '#dcfce7', '#22c55e')}
                ${renderKpiMetric(t('dashboard.kpi_active_projects'), `${activeProjects}`, 3, t('dashboard.vs_last_month'), 'folder', '#e0e7ff', '#4f46e5')}
                ${renderKpiMetric(t('dashboard.kpi_total_clients'), `${totalClients}`, 8, t('dashboard.vs_last_month'), 'people', '#f3e8ff', '#9333ea')}
                ${renderKpiMetric(t('dashboard.kpi_overdue_projects'), `${overdueProjects}`, -5.2, t('dashboard.vs_last_month'), 'error', '#fee2e2', '#ef4444')}
            </div>

            <div class="dashboard-widget-grid ${isEditing ? 'is-editing' : ''}">
                ${userWidgets.map(renderWidget).join('')}
            </div>

            ${isEditing ? `
                <button class="fab" id="add-widget-btn" aria-label="${t('dashboard.add_widget')}" title="${t('dashboard.add_widget')}">
                    <span class="material-icons-sharp">add</span>
                </button>
            ` : ''}
        </div>
    `;
}
