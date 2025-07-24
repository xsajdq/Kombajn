import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { DashboardWidget, Task, TimeLog, Comment } from '../types.ts';
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
    if (userWidgets.length === 0 && !state.ui.dashboard.isLoading) {
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
            // Default case for any other widget types that might not have a renderer yet
            default: return `<div class="bg-content p-4 rounded-lg shadow-sm relative" data-widget-id="${widget.id}" draggable="${isEditing}">${isEditing ? `<button class="remove-widget-btn" data-remove-widget-id="${widget.id}"><span class="material-icons-sharp text-base">close</span></button>`: ''}Widget type "${widget.type}" not found.</div>`;
        }
    };

    return `
        <div class="grid grid-cols-1 ${gridColsClass} gap-6 ${isEditing ? 'dashboard-editing' : ''}" id="dashboard-widget-area">
            ${userWidgets.map(renderWidget).join('')}
        </div>
    `;
}

export function initDashboardCharts() {
    destroyCharts();
}

export function DashboardPage() {
    // Data for dashboard widgets is now loaded during bootstrap, so no extra fetch is needed here.
    const { currentUser, activeWorkspaceId } = state;
    if (!currentUser || !activeWorkspaceId) return '<div class="flex items-center justify-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>';

    if (state.ui.dashboard.isLoading) {
        return `
            <div class="flex flex-col items-center justify-center h-full">
                <div class="w-full max-w-xs text-center p-4">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                    <p class="text-sm text-text-subtle">Loading your dashboard...</p>
                </div>
            </div>
        `;
    }
    
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) return '';
    
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
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="overview">Overview</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'projects' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="projects">Projects</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'team' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="team">Team</button>
                    <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-dashboard-tab="analytics">Analytics</button>
                </nav>
            </div>
            
            ${tabContent}
        </div>
    `;
}