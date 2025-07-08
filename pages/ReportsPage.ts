import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, formatDate } from '../utils.ts';
import type { Task, TimeLog, Invoice, Client, User, Project } from '../types.ts';

declare const Chart: any;

let charts: { [key: string]: any } = {};

function destroyCharts() {
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
}

function getFilteredData() {
    const { activeWorkspaceId } = state;
    const { dateStart, dateEnd, projectId, userId, clientId } = state.ui.reports.filters;
    const startDate = new Date(dateStart + 'T00:00:00');
    const endDate = new Date(dateEnd + 'T23:59:59');

    // 1. Filter primary data objects
    const filteredProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId && (projectId === 'all' || p.id === projectId));
    const filteredProjectIds = new Set(filteredProjects.map(p => p.id));
    
    const clientIdsFromProjects = new Set(filteredProjects.map(p => p.clientId));
    const finalClientId = clientId === 'all' ? (projectId === 'all' ? 'all' : null) : clientId;

    const filteredTasks = state.tasks.filter(t => {
        if (t.workspaceId !== activeWorkspaceId) return false;
        if (!filteredProjectIds.has(t.projectId)) return false;
        if (userId !== 'all' && t.assigneeId !== userId) return false;
        
        const client = state.projects.find(p => p.id === t.projectId)?.clientId;
        if (finalClientId && client !== finalClientId) return false;

        // Date check (optional, tasks don't always have dates)
        // For productivity, we might want to check completion date, but for simplicity, we check due date.
        if (t.dueDate) {
            const dueDate = new Date(t.dueDate);
            if (dueDate < startDate || dueDate > endDate) return false;
        }
        return true;
    });

    const filteredTimeLogs = state.timeLogs.filter(tl => {
        if (tl.workspaceId !== activeWorkspaceId) return false;
        if (userId !== 'all' && tl.userId !== userId) return false;
        
        const task = state.tasks.find(t => t.id === tl.taskId);
        if (!task || !filteredProjectIds.has(task.projectId)) return false;

        const client = state.projects.find(p => p.id === task.projectId)?.clientId;
        if (finalClientId && client !== finalClientId) return false;
        
        const createdAt = new Date(tl.createdAt);
        if (createdAt < startDate || createdAt > endDate) return false;

        return true;
    });

    const filteredInvoices = state.invoices.filter(i => {
        if (i.workspaceId !== activeWorkspaceId) return false;
        if (finalClientId && i.clientId !== finalClientId) return false;
        if (projectId !== 'all' && !clientIdsFromProjects.has(i.clientId)) return false;

        const issueDate = new Date(i.issueDate);
        if (issueDate < startDate || issueDate > endDate) return false;

        return true;
    });

    return {
        tasks: filteredTasks,
        timeLogs: filteredTimeLogs,
        invoices: filteredInvoices
    };
}


function renderProductivityReports(tasks: Task[], timeLogs: TimeLog[]) {
    const workspaceUsers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId)!)
        .filter(Boolean);

    // User Activity Data
    const userActivity = workspaceUsers.map(user => {
        const completedTasks = tasks.filter(t => t.assigneeId === user.id && t.status === 'done');
        const trackedTime = timeLogs
            .filter(tl => tl.userId === user.id)
            .reduce((sum, log) => sum + log.trackedSeconds, 0);
        return {
            user,
            completedCount: completedTasks.length,
            trackedTimeSeconds: trackedTime
        };
    }).sort((a, b) => b.completedCount - a.completedCount);

    return `
        <div class="card">
            <h4>${t('reports.report_task_status_title')}</h4>
            <div class="chart-container">
                <canvas id="taskStatusChart"></canvas>
            </div>
        </div>
        <div class="card">
             <div class="report-card-header">
                <h4>${t('reports.report_user_activity_title')}</h4>
            </div>
            <div class="report-table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>${t('reports.col_user')}</th>
                            <th>${t('reports.col_tasks_completed')}</th>
                            <th>${t('reports.col_time_tracked')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userActivity.length > 0 ? userActivity.map(data => `
                            <tr>
                                <td>${data.user.name || data.user.initials}</td>
                                <td>${data.completedCount}</td>
                                <td>${formatDuration(data.trackedTimeSeconds)}</td>
                            </tr>
                        `).join('') : `<tr><td colspan="3">${t('reports.no_data')}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderTimeTrackingReports(timeLogs: TimeLog[]) {
    const logsWithDetails = timeLogs.map(log => {
        const user = state.users.find(u => u.id === log.userId);
        const task = state.tasks.find(t => t.id === log.taskId);
        const project = state.projects.find(p => p.id === task?.projectId);
        const client = state.clients.find(c => c.id === project?.clientId);
        return { log, user, task, project, client };
    }).sort((a,b) => new Date(b.log.createdAt).getTime() - new Date(a.log.createdAt).getTime());

    return `
        <div class="card" style="grid-column: 1 / -1;">
            <div class="report-card-header">
                <h4>${t('reports.report_time_tracking_title')}</h4>
                <div class="export-buttons">
                    <button class="btn-icon export-csv-btn" title="${t('reports.export_csv')}"><span class="material-icons-sharp">description</span></button>
                    <button class="btn-icon export-pdf-btn" title="${t('reports.export_pdf')}"><span class="material-icons-sharp">picture_as_pdf</span></button>
                </div>
            </div>
            <div class="report-table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                           <th>${t('reports.col_date')}</th>
                           <th>${t('reports.col_user')}</th>
                           <th>${t('reports.col_project')}</th>
                           <th>${t('reports.col_task')}</th>
                           <th>${t('reports.col_time')}</th>
                           <th>${t('reports.col_comment')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logsWithDetails.length > 0 ? logsWithDetails.map(({ log, user, task, project }) => `
                            <tr>
                                <td>${formatDate(log.createdAt)}</td>
                                <td>${user?.name || user?.initials || ''}</td>
                                <td>${project?.name || ''}</td>
                                <td>${task?.name || ''}</td>
                                <td>${formatDuration(log.trackedSeconds)}</td>
                                <td>${log.comment || ''}</td>
                            </tr>
                        `).join('') : `<tr><td colspan="6">${t('reports.no_data')}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderFinancialReports(invoices: Invoice[]) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const overdueInvoices = invoices.filter(inv => {
        const dueDate = new Date(inv.dueDate);
        return inv.status === 'pending' && dueDate < today;
    }).map(inv => {
        const client = state.clients.find(c => c.id === inv.clientId);
        const total = inv.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const daysOverdue = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24));
        return { invoice: inv, client, total, daysOverdue };
    }).sort((a,b) => b.daysOverdue - a.daysOverdue);

    return `
        <div class="card">
            <h4>${t('reports.report_revenue_by_client_title')}</h4>
            <div class="chart-container">
                <canvas id="revenueByClientChart"></canvas>
            </div>
        </div>
        <div class="card">
            <div class="report-card-header">
                <h4>${t('reports.report_overdue_invoices_title')}</h4>
            </div>
            <div class="report-table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>${t('reports.col_invoice_number')}</th>
                            <th>${t('reports.col_client')}</th>
                            <th>${t('reports.col_due_date')}</th>
                            <th>${t('reports.col_amount')}</th>
                            <th>${t('reports.col_days_overdue')}</th>
                        </tr>
                    </thead>
                    <tbody>
                         ${overdueInvoices.length > 0 ? overdueInvoices.map(({ invoice, client, total, daysOverdue }) => `
                            <tr>
                                <td>${invoice.invoiceNumber}</td>
                                <td>${client?.name || ''}</td>
                                <td>${formatDate(invoice.dueDate)}</td>
                                <td>${total.toFixed(2)}</td>
                                <td>${daysOverdue}</td>
                            </tr>
                        `).join('') : `<tr><td colspan="5">${t('reports.no_data')}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initReportsPage() {
    destroyCharts();
    const { tasks, invoices } = getFilteredData();

    // Init Task Status Chart
    const taskStatusCtx = (document.getElementById('taskStatusChart') as HTMLCanvasElement | null)?.getContext('2d');
    if (taskStatusCtx) {
        const statusCounts = tasks.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
        }, {} as Record<Task['status'], number>);
        
        charts.taskStatus = new Chart(taskStatusCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCounts).map(status => t(`tasks.${status}`)),
                datasets: [{
                    label: t('reports.report_task_status_title'),
                    data: Object.values(statusCounts),
                    backgroundColor: [ '#636e72', '#f39c12', '#4a90e2', '#8e44ad', '#2ecc71' ],
                    hoverOffset: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Init Revenue by Client Chart
    const revenueCtx = (document.getElementById('revenueByClientChart') as HTMLCanvasElement | null)?.getContext('2d');
    if (revenueCtx) {
        const revenueByClient = invoices.reduce((acc, invoice) => {
            const client = state.clients.find(c => c.id === invoice.clientId);
            if(client) {
                const total = invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                acc[client.name] = (acc[client.name] || 0) + total;
            }
            return acc;
        }, {} as Record<string, number>);

        charts.revenueByClient = new Chart(revenueCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(revenueByClient),
                datasets: [{
                    label: t('reports.report_revenue_by_client_title'),
                    data: Object.values(revenueByClient),
                    backgroundColor: 'rgba(74, 144, 226, 0.6)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });
    }
}

export function ReportsPage() { 
    const { activeTab, filters } = state.ui.reports;
    const { tasks, timeLogs, invoices } = getFilteredData();
    const { activeWorkspaceId } = state;

    const workspaceUsers = state.workspaceMembers.filter(m => m.workspaceId === activeWorkspaceId).map(m => state.users.find(u => u.id === m.userId)!);
    const workspaceProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId);
    const workspaceClients = state.clients.filter(c => c.workspaceId === activeWorkspaceId);

    let tabContent = '';
    switch (activeTab) {
        case 'productivity':
            tabContent = renderProductivityReports(tasks, timeLogs);
            break;
        case 'time':
            tabContent = renderTimeTrackingReports(timeLogs);
            break;
        case 'financial':
            tabContent = renderFinancialReports(invoices);
            break;
    }
    
    return `
        <div>
            <h2>${t('reports.title')}</h2>
            <div class="reports-tabs">
                <div class="report-tab ${activeTab === 'productivity' ? 'active' : ''}" data-tab="productivity">${t('reports.tab_productivity')}</div>
                <div class="report-tab ${activeTab === 'time' ? 'active' : ''}" data-tab="time">${t('reports.tab_time')}</div>
                <div class="report-tab ${activeTab === 'financial' ? 'active' : ''}" data-tab="financial">${t('reports.tab_financial')}</div>
            </div>
            <div id="reports-filters" class="reports-filter-bar card">
                <div class="form-group">
                    <label for="report-filter-date-start">${t('reports.filter_date_range')}</label>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="date" id="report-filter-date-start" class="form-control" value="${filters.dateStart}">
                        <span>-</span>
                        <input type="date" id="report-filter-date-end" class="form-control" value="${filters.dateEnd}">
                    </div>
                </div>
                 <div class="form-group">
                    <label for="report-filter-project">${t('reports.filter_project')}</label>
                    <select id="report-filter-project" class="form-control">
                        <option value="all">${t('reports.all_projects')}</option>
                        ${workspaceProjects.map(p => `<option value="${p.id}" ${filters.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                 <div class="form-group">
                    <label for="report-filter-user">${t('reports.filter_user')}</label>
                    <select id="report-filter-user" class="form-control">
                        <option value="all">${t('reports.all_users')}</option>
                         ${workspaceUsers.map(u => `<option value="${u.id}" ${filters.userId === u.id ? 'selected' : ''}>${u.name || u.initials}</option>`).join('')}
                    </select>
                </div>
                 <div class="form-group">
                    <label for="report-filter-client">${t('reports.filter_client')}</label>
                    <select id="report-filter-client" class="form-control">
                        <option value="all">${t('reports.all_clients')}</option>
                        ${workspaceClients.map(c => `<option value="${c.id}" ${filters.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="reports-grid">
                ${tabContent}
            </div>
        </div>
    `; 
}