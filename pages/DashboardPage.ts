

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { DashboardWidget, Task, TimeLog, Comment } from '../types.ts';
import { formatDuration, camelToSnake } from '../utils.ts';
import { can } from '../permissions.ts';

declare const Chart: any;

let charts: { [key: string]: any } = {};

function destroyCharts() {
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
}

function renderMyTasksWidget(widget: DashboardWidget) {
    const myAssignedTaskIds = new Set(state.taskAssignees.filter(a => a.userId === state.currentUser?.id).map(a => a.taskId));
    const tasks = state.tasks.filter(task => myAssignedTaskIds.has(task.id) && task.status !== 'done');
    const content = tasks.length > 0
        ? `<ul class="widget-task-list">${tasks.map(task => `
            <li class="clickable" data-task-id="${task.id}" role="button" tabindex="0">
                <span>${task.name}</span>
                <span class="subtle-text">${state.projects.find(p => p.id === task.projectId)?.name}</span>
            </li>`).join('')}</ul>`
        : `<div class="empty-widget"><span class="material-icons-sharp">task_alt</span>${t('dashboard.no_tasks_assigned')}</div>`;
    return content;
}

function renderProjectStatusWidget(widget: DashboardWidget) {
    if (!widget.config.projectId) {
        return `<div class="empty-widget"><span class="material-icons-sharp">folder_special</span>${t('dashboard.select_project_for_widget')}</div>`;
    }
    return `<div class="chart-container"><canvas id="widget-chart-${widget.id}"></canvas></div>`;
}

function renderTeamWorkloadWidget(widget: DashboardWidget) {
     return `<div class="chart-container"><canvas id="widget-chart-${widget.id}"></canvas></div>`;
}

function renderRecentActivityWidget(widget: DashboardWidget) {
    const activities = [...state.comments, ...state.timeLogs]
        .filter(item => item.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
    
    if (activities.length === 0) {
        return `<div class="empty-widget"><span class="material-icons-sharp">history</span>${t('dashboard.no_activity_yet')}</div>`;
    }

    return `<ul class="widget-task-list">${activities.map(item => {
        const user = state.users.find(u => u.id === item.userId);
        const task = state.tasks.find(t => t.id === item.taskId);
        if ('content' in item) { // Comment
             return `<li class="clickable" data-task-id="${item.taskId}" role="button" tabindex="0"><span><strong>${user?.name}</strong> commented on ${task?.name || ''}</span><span class="subtle-text"></span></li>`;
        } else { // TimeLog
             return `<li class="clickable" data-task-id="${item.taskId}" role="button" tabindex="0"><span><strong>${user?.name}</strong> logged ${formatDuration(item.trackedSeconds)} on ${task?.name || ''}</span></li>`;
        }
    }).join('')}</ul>`;
}


function renderWidget(widget: DashboardWidget) {
    let content = '';
    let title = t(`dashboard.widget_${camelToSnake(widget.type)}_title`);
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    const gridCols = workspace?.dashboardGridColumns || 12;

    switch (widget.type) {
        case 'myTasks':
            content = renderMyTasksWidget(widget);
            break;
        case 'projectStatus':
            const project = state.projects.find(p => p.id === widget.config.projectId);
            if (project) title = `${t('dashboard.widget_project_status_title')}: ${project.name}`;
            content = renderProjectStatusWidget(widget);
            break;
        case 'teamWorkload':
            content = renderTeamWorkloadWidget(widget);
            break;
        case 'recentActivity':
            content = renderRecentActivityWidget(widget);
            break;
    }

    const isEditing = state.ui.dashboard.isEditing;

    return `
        <div class="widget-card" 
            draggable="${isEditing}" 
            data-widget-id="${widget.id}" 
            style="grid-column: span ${widget.w}; grid-row: span ${widget.h};">
            <div class="widget-header">
                <h4>${title}</h4>
                ${isEditing ? `
                    <div class="widget-controls">
                        <button class="btn-icon" data-resize-action="decrease" data-widget-id="${widget.id}" title="${t('dashboard.decrease_width')}" ${widget.w <= 1 ? 'disabled' : ''}>
                            <span class="material-icons-sharp">remove</span>
                        </button>
                        <button class="btn-icon" data-resize-action="increase" data-widget-id="${widget.id}" title="${t('dashboard.increase_width')}" ${widget.w >= gridCols ? 'disabled' : ''}>
                            <span class="material-icons-sharp">add</span>
                        </button>
                        <button class="btn-icon" data-configure-widget-id="${widget.id}" title="${t('modals.configure_widget')}"><span class="material-icons-sharp">settings</span></button>
                        <button class="btn-icon" data-remove-widget-id="${widget.id}" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
                    </div>
                ` : ''}
            </div>
            <div class="widget-content">
                ${content}
            </div>
        </div>
    `;
}

export function initDashboardCharts() {
    destroyCharts();

    const userWidgets = state.dashboardWidgets.filter(w =>
        w.userId === state.currentUser?.id && w.workspaceId === state.activeWorkspaceId
    );

    userWidgets.forEach(widget => {
        const chartCanvas = document.getElementById(`widget-chart-${widget.id}`) as HTMLCanvasElement;
        if (!chartCanvas) return;

        if (widget.type === 'projectStatus' && widget.config.projectId) {
            const tasks = state.tasks.filter(t => t.projectId === widget.config.projectId);
            const statusCounts = tasks.reduce((acc, task) => {
                acc[task.status] = (acc[task.status] || 0) + 1;
                return acc;
            }, {} as Record<Task['status'], number>);
            
            charts[widget.id] = new Chart(chartCanvas.getContext('2d')!, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(statusCounts).map(s => t(`tasks.${s}`)),
                    datasets: [{
                        data: Object.values(statusCounts),
                        backgroundColor: ['#636e72', '#f39c12', '#4a90e2', '#8e44ad', '#2ecc71'],
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }}}
            });
        }
         if (widget.type === 'teamWorkload') {
            const tasks = state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && t.status !== 'done');
            const workload = tasks.reduce((acc, task) => {
                const assignees = state.taskAssignees.filter(a => a.taskId === task.id);
                assignees.forEach(assignee => {
                    acc[assignee.userId] = (acc[assignee.userId] || 0) + 1;
                });
                return acc;
            }, {} as Record<string, number>);

            const userNames = Object.keys(workload).map(userId => state.users.find(u => u.id === userId)?.name || 'Unknown');

            charts[widget.id] = new Chart(chartCanvas.getContext('2d')!, {
                type: 'bar',
                data: {
                    labels: userNames,
                    datasets: [{
                        label: 'Active Tasks',
                        data: Object.values(workload),
                        backgroundColor: 'rgba(74, 144, 226, 0.6)',
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }}}
            });
        }
    });
}


export function DashboardPage() {
    const { isEditing } = state.ui.dashboard;
    const userWidgets = state.dashboardWidgets
        .filter(w => w.userId === state.currentUser?.id && w.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    const gridCols = workspace?.dashboardGridColumns || 12;
    
    const canManage = can('manage_workspace_settings');

    return `
        <div>
            <div class="dashboard-header">
                <h2>${t('dashboard.title')}</h2>
                <div>
                    ${isEditing && canManage ? `
                        <div class="grid-columns-control">
                            <label for="dashboard-grid-columns">${t('dashboard.grid_columns')}:</label>
                            <select id="dashboard-grid-columns" class="form-control">
                                ${[4, 6, 8, 10, 12].map(c => `<option value="${c}" ${gridCols === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}
                     <button id="add-widget-btn" class="btn btn-secondary" style="${isEditing ? '' : 'display: none;'}">
                        <span class="material-icons-sharp">add</span> ${t('dashboard.add_widget')}
                    </button>
                    <button id="toggle-dashboard-edit-mode" class="btn btn-primary">
                       <span class="material-icons-sharp">${isEditing ? 'done' : 'edit'}</span>
                       ${isEditing ? t('dashboard.done_editing') : t('dashboard.edit_dashboard')}
                    </button>
                </div>
            </div>
            <div class="dashboard-grid ${isEditing ? 'editing' : ''}" style="grid-template-columns: repeat(${gridCols}, 1fr); grid-auto-flow: dense;">
                ${userWidgets.map(widget => renderWidget(widget)).join('')}
            </div>
        </div>
    `;
}