

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, formatDate, formatCurrency } from '../utils.ts';
import type { Task, TimeLog, Invoice, Client, User, Project, Expense, Objective } from '../types.ts';

declare const Chart: any;

let charts: { [key: string]: any } = {};

function destroyCharts() {
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
}

function getFilteredData() {
    const { activeWorkspaceId } = state;
    const { dateStart, dateEnd, projectId, userId, clientId } = state.ui.reports.filters;
    const startDate = new Date(dateStart);
    const endDate = new Date(dateEnd);
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = (item: { createdAt?: string; date?: string; issueDate?: string, dueDate?: string }) => {
        const itemDateStr = item.createdAt || item.date || item.issueDate || item.dueDate;
        if (!itemDateStr) return false;
        const itemDate = new Date(itemDateStr);
        return itemDate >= startDate && itemDate <= endDate;
    };

    const tasks = state.tasks.filter(t => t.workspaceId === activeWorkspaceId && dateFilter({ dueDate: t.dueDate }));
    const timeLogs = state.timeLogs.filter(tl => tl.workspaceId === activeWorkspaceId && dateFilter(tl));
    const invoices = state.invoices.filter(i => i.workspaceId === activeWorkspaceId && dateFilter(i));
    const expenses = state.expenses.filter(e => e.workspaceId === activeWorkspaceId && dateFilter(e));
    const objectives = state.objectives.filter(o => o.workspaceId === activeWorkspaceId && dateFilter({dueDate: o.dueDate}));

    const filterByEntity = (item: any) => {
        const itemProjectId = item.projectId || state.tasks.find(t => t.id === item.taskId)?.projectId;
        const itemClientId = item.clientId || state.projects.find(p => p.id === itemProjectId)?.clientId;
        const itemUserId = item.userId || item.ownerId;
        
        const projectMatch = projectId === 'all' || itemProjectId === projectId;
        const clientMatch = clientId === 'all' || itemClientId === clientId;
        const userMatch = userId === 'all' || itemUserId === userId;

        return projectMatch && clientMatch && userMatch;
    };

    return {
        tasks: tasks.filter(filterByEntity),
        timeLogs: timeLogs.filter(filterByEntity),
        invoices: invoices.filter(filterByEntity),
        expenses: expenses.filter(filterByEntity),
        objectives: objectives.filter(filterByEntity)
    };
}

// Chart utility
const chartColors = {
    primary: 'rgba(59, 130, 246, 0.6)',
    primaryHover: 'rgba(59, 130, 246, 1)',
    danger: 'rgba(239, 68, 68, 0.6)',
    success: 'rgba(34, 197, 94, 0.6)',
    warning: 'rgba(245, 158, 11, 0.6)',
    purple: 'rgba(139, 92, 246, 0.6)',
    teal: 'rgba(20, 184, 166, 0.6)',
    text: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151',
    grid: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
};

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: chartColors.text } } },
    scales: {
        x: { ticks: { color: chartColors.text }, grid: { color: chartColors.grid } },
        y: { ticks: { color: chartColors.text }, grid: { color: chartColors.grid } }
    }
};

const renderKpiCard = (title: string, value: string, icon: string, colorClass: string) => `
    <div class="kpi-card">
        <div class="kpi-icon ${colorClass}">
            <span class="material-icons-sharp">${icon}</span>
        </div>
        <p class="kpi-title">${title}</p>
        <strong class="kpi-value">${value}</strong>
    </div>
`;


function renderProductivityReports({ tasks }: { tasks: Task[] }) {
    const completedTasks = tasks.filter(t => t.status === 'done');
    const totalTime = completedTasks.reduce((sum, task) => sum + state.timeLogs.filter(tl => tl.taskId === task.id).reduce((s, l) => s + l.trackedSeconds, 0), 0);
    const avgCompletionSeconds = completedTasks.length > 0 ? totalTime / completedTasks.length : 0;
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${renderKpiCard(t('reports.kpi_tasks_completed'), completedTasks.length.toString(), 'check_circle', 'bg-green-100 text-green-700')}
            ${renderKpiCard(t('reports.kpi_avg_completion_time'), formatDuration(avgCompletionSeconds), 'timer', 'bg-blue-100 text-blue-700')}
        </div>
        <div class="card col-span-1 md:col-span-2 lg:col-span-4"><h4 class="font-semibold mb-4">${t('reports.report_task_velocity_title')}</h4><div class="h-64"><canvas id="taskVelocityChart"></canvas></div></div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_team_workload_title')}</h4><div class="h-64"><canvas id="teamWorkloadChart"></canvas></div></div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_tasks_by_priority_title')}</h4><div class="h-64"><canvas id="tasksByPriorityChart"></canvas></div></div>
    `;
}

function renderTimeTrackingReports({ timeLogs }: { timeLogs: TimeLog[] }) {
    const billableTime = timeLogs.filter(tl => {
        const task = state.tasks.find(t => t.id === tl.taskId);
        const project = state.projects.find(p => p.id === task?.projectId);
        return project?.hourlyRate && project.hourlyRate > 0;
    }).reduce((sum, log) => sum + log.trackedSeconds, 0);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             ${renderKpiCard(t('reports.kpi_total_time_tracked'), formatDuration(timeLogs.reduce((s,l) => s + l.trackedSeconds, 0)), 'schedule', 'bg-purple-100 text-purple-700')}
             ${renderKpiCard(t('reports.kpi_billable_hours'), formatDuration(billableTime), 'attach_money', 'bg-green-100 text-green-700')}
        </div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_time_by_project_title')}</h4><div class="h-64"><canvas id="timeByProjectChart"></canvas></div></div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_time_by_user_title')}</h4><div class="h-64"><canvas id="timeByUserChart"></canvas></div></div>
        <div class="card col-span-1 md:col-span-2 lg:col-span-4"><h4 class="font-semibold mb-4">${t('reports.report_billable_time_title')}</h4><div class="h-64"><canvas id="billableTimeChart"></canvas></div></div>
    `;
}

function renderFinancialReports({ invoices, expenses }: { invoices: Invoice[], expenses: Expense[] }) {
     const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const outstandingRevenue = invoices.filter(i => i.status === 'pending').reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${renderKpiCard(t('reports.kpi_total_revenue'), formatCurrency(totalRevenue, 'PLN'), 'paid', 'bg-green-100 text-green-700')}
            ${renderKpiCard(t('reports.kpi_total_expenses'), formatCurrency(totalExpenses, 'PLN'), 'receipt_long', 'bg-red-100 text-red-700')}
            ${renderKpiCard(t('reports.kpi_net_profit'), formatCurrency(totalRevenue - totalExpenses, 'PLN'), 'trending_up', 'bg-blue-100 text-blue-700')}
            ${renderKpiCard(t('reports.kpi_outstanding_revenue'), formatCurrency(outstandingRevenue, 'PLN'), 'hourglass_top', 'bg-yellow-100 text-yellow-700')}
        </div>
        <div class="card col-span-1 md:col-span-2 lg:col-span-4"><h4 class="font-semibold mb-4">${t('reports.report_revenue_cost_profit_title')}</h4><div class="h-64"><canvas id="revenueCostProfitChart"></canvas></div></div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_invoice_status_title')}</h4><div class="h-64"><canvas id="invoiceStatusChart"></canvas></div></div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_top_clients_title')}</h4><div class="h-64"><canvas id="topClientsChart"></canvas></div></div>
    `;
}

function renderGoalsReports({ objectives }: { objectives: Objective[] }) {
    const totalProgress = objectives.reduce((sum, goal) => {
        const target = goal.targetValue ?? 1;
        const current = goal.currentValue ?? 0;
        if (target > 0) {
            const progress = (current / target) * 100;
            return sum + Math.min(100, Math.max(0, progress));
        }
        return sum;
    }, 0);
    const avgProgress = objectives.length > 0 ? Math.round(totalProgress / objectives.length) : 0;
    const completedMilestones = state.keyResults.filter(kr => objectives.some(o => o.id === kr.objectiveId) && kr.completed).length;

    return `
         <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${renderKpiCard(t('goals.total_goals'), objectives.length.toString(), 'flag', 'bg-purple-100 text-purple-700')}
            ${renderKpiCard(t('goals.avg_progress'), `${avgProgress}%`, 'trending_up', 'bg-blue-100 text-blue-700')}
            ${renderKpiCard(t('reports.milestones_completed'), completedMilestones.toString(), 'task_alt', 'bg-green-100 text-green-700')}
        </div>
        <div class="card col-span-1 md:col-span-2 lg:col-span-4"><h4 class="font-semibold mb-4">${t('reports.report_progress_by_goal_title')}</h4><div class="h-64"><canvas id="progressByGoalChart"></canvas></div></div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_goal_completion_title')}</h4><div class="h-64"><canvas id="goalCompletionChart"></canvas></div></div>
        <div class="card lg:col-span-2"><h4 class="font-semibold mb-4">${t('reports.report_milestone_status_title')}</h4><div class="h-64"><canvas id="milestoneStatusChart"></canvas></div></div>
    `;
}

// ... initReportsPage remains similar but with new chart logic ...
export function initReportsPage() {
    destroyCharts();
    const { tasks, timeLogs, invoices, expenses, objectives } = getFilteredData();
    const activeTab = state.ui.reports.activeTab;

    if (activeTab === 'productivity') {
        const velocityCtx = (document.getElementById('taskVelocityChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (velocityCtx) {
            const completedByDay = tasks.filter(t => t.status === 'done' && t.dueDate).reduce((acc, task) => {
                const date = task.dueDate!.slice(0, 10);
                acc[date] = (acc[date] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            charts.taskVelocity = new Chart(velocityCtx, {
                type: 'line',
                data: { labels: Object.keys(completedByDay), datasets: [{ label: t('reports.report_task_velocity_title'), data: Object.values(completedByDay), borderColor: chartColors.primary, tension: 0.1 }] },
                options: commonChartOptions
            });
        }

        const workloadCtx = (document.getElementById('teamWorkloadChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (workloadCtx) {
            const openTasksByUser = tasks.filter(t => t.status !== 'done').flatMap(t => state.taskAssignees.filter(a => a.taskId === t.id)).reduce((acc, assignee) => {
                const user = state.users.find(u => u.id === assignee.userId);
                if (user) acc[user.name || user.initials] = (acc[user.name || user.initials] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            charts.teamWorkload = new Chart(workloadCtx, {
                type: 'doughnut',
                data: { labels: Object.keys(openTasksByUser), datasets: [{ data: Object.values(openTasksByUser), backgroundColor: [chartColors.primary, chartColors.purple, chartColors.teal, chartColors.warning, chartColors.danger] }] },
                options: { ...commonChartOptions, scales: {} }
            });
        }
        
        const priorityCtx = (document.getElementById('tasksByPriorityChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (priorityCtx) {
            const completedByPriority = tasks.filter(t => t.status === 'done').reduce((acc, task) => {
                const priority = task.priority || 'none';
                acc[priority] = (acc[priority] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            charts.tasksByPriority = new Chart(priorityCtx, {
                type: 'bar',
                data: { labels: Object.keys(completedByPriority).map(p => t(`tasks.priority_${p}`)), datasets: [{ label: t('reports.report_tasks_by_priority_title'), data: Object.values(completedByPriority), backgroundColor: chartColors.success }] },
                options: commonChartOptions
            });
        }
    }

    if (activeTab === 'time') {
        const timeByProjectCtx = (document.getElementById('timeByProjectChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (timeByProjectCtx) {
            const timeByProject = timeLogs.reduce((acc, log) => {
                const task = state.tasks.find(t => t.id === log.taskId);
                const project = state.projects.find(p => p.id === task?.projectId);
                if (project) acc[project.name] = (acc[project.name] || 0) + log.trackedSeconds;
                return acc;
            }, {} as Record<string, number>);
            charts.timeByProject = new Chart(timeByProjectCtx, {
                type: 'bar',
                data: { labels: Object.keys(timeByProject), datasets: [{ label: t('reports.report_time_by_project_title'), data: Object.values(timeByProject).map(s => s / 3600), backgroundColor: chartColors.primary }] },
                options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, title: { display: true, text: 'Hours' } } } }
            });
        }

        const timeByUserCtx = (document.getElementById('timeByUserChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (timeByUserCtx) {
            const timeByUser = timeLogs.reduce((acc, log) => {
                const user = state.users.find(u => u.id === log.userId);
                if (user) acc[user.name || user.initials] = (acc[user.name || user.initials] || 0) + log.trackedSeconds;
                return acc;
            }, {} as Record<string, number>);
            charts.timeByUser = new Chart(timeByUserCtx, {
                type: 'bar',
                data: { labels: Object.keys(timeByUser), datasets: [{ label: t('reports.report_time_by_user_title'), data: Object.values(timeByUser).map(s => s / 3600), backgroundColor: chartColors.purple }] },
                options: { ...commonChartOptions, scales: { ...commonChartOptions.scales, y: { ...commonChartOptions.scales.y, title: { display: true, text: 'Hours' } } } }
            });
        }

        const billableTimeCtx = (document.getElementById('billableTimeChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (billableTimeCtx) {
            const totalTime = timeLogs.reduce((sum, log) => sum + log.trackedSeconds, 0);
            const billableTime = timeLogs.filter(tl => {
                const task = state.tasks.find(t => t.id === tl.taskId);
                const project = state.projects.find(p => p.id === task?.projectId);
                return project?.hourlyRate && project.hourlyRate > 0;
            }).reduce((sum, log) => sum + log.trackedSeconds, 0);
            charts.billableTime = new Chart(billableTimeCtx, {
                type: 'pie',
                data: { labels: [t('reports.billable'), t('reports.non_billable')], datasets: [{ data: [billableTime, totalTime - billableTime], backgroundColor: [chartColors.success, chartColors.danger] }] },
                options: { ...commonChartOptions, scales: {} }
            });
        }
    }

    if (activeTab === 'financial') {
        const revenueCostProfitCtx = (document.getElementById('revenueCostProfitChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (revenueCostProfitCtx) {
            const dataByMonth = ([...invoices, ...expenses] as (Invoice | Expense)[]).reduce((acc, item) => {
                const date = new Date('issueDate' in item ? item.issueDate : item.date);
                const month = date.toLocaleString('default', { month: 'short', year: '2-digit' });
                if (!acc[month]) acc[month] = { revenue: 0, expenses: 0 };
                if ('invoiceNumber' in item) { // Type guard for Invoice
                    acc[month].revenue += item.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                } else { // It must be an Expense
                    acc[month].expenses += item.amount;
                }
                return acc;
            }, {} as Record<string, { revenue: number, expenses: number }>);
            const labels = Object.keys(dataByMonth);
            charts.revenueCostProfit = new Chart(revenueCostProfitCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { type: 'bar', label: t('reports.revenue'), data: labels.map(l => dataByMonth[l].revenue), backgroundColor: chartColors.success },
                        { type: 'bar', label: t('reports.expenses'), data: labels.map(l => dataByMonth[l].expenses), backgroundColor: chartColors.danger },
                        { type: 'line', label: t('reports.profit'), data: labels.map(l => dataByMonth[l].revenue - dataByMonth[l].expenses), borderColor: chartColors.primary, tension: 0.1, fill: false }
                    ]
                },
                options: commonChartOptions
            });
        }

        const invoiceStatusCtx = (document.getElementById('invoiceStatusChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (invoiceStatusCtx) {
            const statusCounts = invoices.reduce((acc, inv) => {
                acc[inv.status] = (acc[inv.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
             charts.invoiceStatus = new Chart(invoiceStatusCtx, {
                type: 'pie',
                data: { labels: Object.keys(statusCounts).map(s => t(`invoices.status_${s}`)), datasets: [{ data: Object.values(statusCounts), backgroundColor: [chartColors.warning, chartColors.success, chartColors.danger] }] },
                options: { ...commonChartOptions, scales: {} }
            });
        }

        const topClientsCtx = (document.getElementById('topClientsChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (topClientsCtx) {
            const revenueByClient = invoices.reduce((acc, inv) => {
                const client = state.clients.find(c => c.id === inv.clientId);
                if (client) {
                    const total = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                    acc[client.name] = (acc[client.name] || 0) + total;
                }
                return acc;
            }, {} as Record<string, number>);
             charts.topClients = new Chart(topClientsCtx, {
                type: 'bar',
                data: { labels: Object.keys(revenueByClient), datasets: [{ label: t('reports.report_top_clients_title'), data: Object.values(revenueByClient), backgroundColor: chartColors.primary }] },
                options: { ...commonChartOptions, indexAxis: 'y' }
            });
        }
    }
    
    if (activeTab === 'goals') {
        const progressByGoalCtx = (document.getElementById('progressByGoalChart') as HTMLCanvasElement | null)?.getContext('2d');
        if(progressByGoalCtx) {
            const goalData = objectives.map(goal => {
                const target = goal.targetValue ?? 1;
                const current = goal.currentValue ?? 0;
                return target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
            });
            charts.progressByGoal = new Chart(progressByGoalCtx, {
                type: 'bar',
                data: { labels: objectives.map(g => g.title), datasets: [{ label: t('goals.progress'), data: goalData, backgroundColor: chartColors.primary }]},
                options: commonChartOptions
            });
        }
        
        const goalCompletionCtx = (document.getElementById('goalCompletionChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (goalCompletionCtx) {
            const statusCounts = objectives.reduce((acc, goal) => {
                acc[goal.status] = (acc[goal.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            charts.goalCompletion = new Chart(goalCompletionCtx, {
                type: 'doughnut',
                data: { labels: Object.keys(statusCounts).map(s => t(`goals.status_${s}`)), datasets: [{ data: Object.values(statusCounts), backgroundColor: [chartColors.primary, chartColors.success, chartColors.warning] }] },
                options: { ...commonChartOptions, scales: {} }
            });
        }

        const milestoneStatusCtx = (document.getElementById('milestoneStatusChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (milestoneStatusCtx) {
            const allMilestones = state.keyResults.filter(kr => objectives.some(o => o.id === kr.objectiveId));
            const completed = allMilestones.filter(kr => kr.completed).length;
            const remaining = allMilestones.length - completed;
             charts.milestoneStatus = new Chart(milestoneStatusCtx, {
                type: 'pie',
                data: { labels: [t('reports.milestones_completed'), t('reports.milestones_remaining')], datasets: [{ data: [completed, remaining], backgroundColor: [chartColors.success, chartColors.danger] }] },
                options: { ...commonChartOptions, scales: {} }
            });
        }
    }
}


export function ReportsPage() { 
    const { activeTab, filters } = state.ui.reports;
    const { tasks, timeLogs, invoices, expenses, objectives } = getFilteredData();
    const { activeWorkspaceId } = state;

    const workspaceUsers = state.workspaceMembers.filter(m => m.workspaceId === activeWorkspaceId).map(m => state.users.find(u => u.id === m.userId)!);
    const workspaceProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId);
    const workspaceClients = state.clients.filter(c => c.workspaceId === activeWorkspaceId);

    let tabContent = '';
    switch (activeTab) {
        case 'productivity':
            tabContent = renderProductivityReports({ tasks });
            break;
        case 'time':
            tabContent = renderTimeTrackingReports({ timeLogs });
            break;
        case 'financial':
            tabContent = renderFinancialReports({ invoices, expenses });
            break;
        case 'goals':
            tabContent = renderGoalsReports({ objectives });
            break;
    }
    
    const navItems = [
        { id: 'productivity', text: t('reports.tab_productivity') },
        { id: 'time', text: t('reports.tab_time') },
        { id: 'financial', text: t('reports.tab_financial') },
        { id: 'goals', text: t('reports.tab_goals') },
    ];

    return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">${t('reports.title')}</h2>
            <div class="border-b border-border-color">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    ${navItems.map(item => `
                        <button class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === item.id ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'} report-tab" data-tab="${item.id}">${item.text}</button>
                    `).join('')}
                </nav>
            </div>
            <div id="reports-filters" class="bg-content p-4 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="report-filter-date-start" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_date_range')}</label>
                    <div class="flex items-center gap-2">
                        <input type="date" id="report-filter-date-start" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${filters.dateStart}">
                        <span>-</span>
                        <input type="date" id="report-filter-date-end" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${filters.dateEnd}">
                    </div>
                </div>
                 <div>
                    <label for="report-filter-project" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_project')}</label>
                    <select id="report-filter-project" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                        <option value="all">${t('reports.all_projects')}</option>
                        ${workspaceProjects.map(p => `<option value="${p.id}" ${filters.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                 <div>
                    <label for="report-filter-user" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_user')}</label>
                    <select id="report-filter-user" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                        <option value="all">${t('reports.all_users')}</option>
                         ${workspaceUsers.map(u => `<option value="${u.id}" ${filters.userId === u.id ? 'selected' : ''}>${u.name || u.initials}</option>`).join('')}
                    </select>
                </div>
                 <div>
                    <label for="report-filter-client" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_client')}</label>
                    <select id="report-filter-client" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                        <option value="all">${t('reports.all_clients')}</option>
                        ${workspaceClients.map(c => `<option value="${c.id}" ${filters.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                ${tabContent}
            </div>
        </div>
    `; 
}
