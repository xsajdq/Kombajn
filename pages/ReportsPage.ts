
import { getState } from '../state.ts';
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
    const state = getState();
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
    primary: 'rgba(59, 130, 246, 0.8)',
    primaryHover: 'rgba(59, 130, 246, 1)',
    danger: 'rgba(239, 68, 68, 0.8)',
    success: 'rgba(34, 197, 94, 0.8)',
    warning: 'rgba(245, 158, 11, 0.8)',
    purple: 'rgba(139, 92, 246, 0.8)',
    teal: 'rgba(20, 184, 166, 0.8)',
    text: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151',
    grid: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
};

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            backgroundColor: 'rgba(var(--content-bg-rgb), 0.9)',
            titleColor: 'rgba(var(--text-color-rgb), 1)',
            bodyColor: 'rgba(var(--subtle-text-color-rgb), 1)',
            borderColor: 'rgba(var(--border-color-rgb), 1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            usePointStyle: true,
            boxPadding: 3,
        }
    },
    scales: {
        x: {
            ticks: { color: chartColors.text, font: { size: 10 } },
            grid: { drawOnChartArea: false, drawBorder: false },
        },
        y: {
            ticks: { color: chartColors.text, font: { size: 10 } },
            grid: { color: chartColors.grid, borderDash: [2, 4] },
            border: { display: false }
        }
    },
    elements: {
        bar: {
            borderRadius: 4,
        },
        line: {
            tension: 0.3,
        }
    }
};

const renderKpiCard = (title: string, value: string, icon: string, colorClass: string) => `
    <div class="bg-content p-4 rounded-lg flex items-center gap-4">
        <div class="p-3 rounded-full ${colorClass}">
            <span class="material-icons-sharp">${icon}</span>
        </div>
        <div>
            <p class="text-sm text-text-subtle">${title}</p>
            <strong class="text-2xl font-semibold">${value}</strong>
        </div>
    </div>
`;


function renderProductivityReports({ tasks }: { tasks: Task[] }) {
    const state = getState();
    const completedTasks = tasks.filter(t => t.status === 'done');
    const totalTime = completedTasks.reduce((sum, task) => sum + state.timeLogs.filter(tl => tl.taskId === task.id).reduce((s, l) => s + l.trackedSeconds, 0), 0);
    const avgCompletionSeconds = completedTasks.length > 0 ? totalTime / completedTasks.length : 0;
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${renderKpiCard(t('reports.kpi_tasks_completed'), completedTasks.length.toString(), 'check_circle', 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300')}
            ${renderKpiCard(t('reports.kpi_avg_completion_time'), formatDuration(avgCompletionSeconds), 'timer', 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300')}
        </div>
        <div class="bg-content p-4 rounded-lg shadow-sm md:col-span-2"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_task_velocity_title')}</h4></div><div class="h-64"><canvas id="taskVelocityChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_team_workload_title')}</h4></div><div class="h-64"><canvas id="teamWorkloadChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_tasks_by_priority_title')}</h4></div><div class="h-64"><canvas id="tasksByPriorityChart"></canvas></div></div>
    `;
}

function renderTimeTrackingReports({ timeLogs }: { timeLogs: TimeLog[] }) {
    const state = getState();
    const billableTime = timeLogs.filter(tl => {
        const task = state.tasks.find(t => t.id === tl.taskId);
        const project = state.projects.find(p => p.id === task?.projectId);
        return project?.hourlyRate && project.hourlyRate > 0;
    }).reduce((sum, log) => sum + log.trackedSeconds, 0);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             ${renderKpiCard(t('reports.kpi_total_time_tracked'), formatDuration(timeLogs.reduce((s,l) => s + l.trackedSeconds, 0)), 'schedule', 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300')}
             ${renderKpiCard(t('reports.kpi_billable_hours'), formatDuration(billableTime), 'attach_money', 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300')}
        </div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_time_by_project_title')}</h4></div><div class="h-64"><canvas id="timeByProjectChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_time_by_user_title')}</h4></div><div class="h-64"><canvas id="timeByUserChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm md:col-span-2"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_billable_time_title')}</h4></div><div class="h-64 flex items-center justify-center"><canvas id="billableTimeChart"></canvas></div></div>
    `;
}

function renderFinancialReports({ invoices, expenses }: { invoices: Invoice[], expenses: Expense[] }) {
     const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const outstandingRevenue = invoices.filter(i => i.status === 'pending').reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${renderKpiCard(t('reports.kpi_total_revenue'), formatCurrency(totalRevenue, 'PLN'), 'paid', 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300')}
            ${renderKpiCard(t('reports.kpi_total_expenses'), formatCurrency(totalExpenses, 'PLN'), 'receipt_long', 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300')}
            ${renderKpiCard(t('reports.kpi_net_profit'), formatCurrency(totalRevenue - totalExpenses, 'PLN'), 'trending_up', 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300')}
            ${renderKpiCard(t('reports.kpi_outstanding_revenue'), formatCurrency(outstandingRevenue, 'PLN'), 'hourglass_top', 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300')}
        </div>
        <div class="bg-content p-4 rounded-lg shadow-sm md:col-span-2 lg:col-span-4"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_revenue_cost_profit_title')}</h4></div><div class="h-64"><canvas id="revenueCostProfitChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_invoice_status_title')}</h4></div><div class="h-64 flex items-center justify-center"><canvas id="invoiceStatusChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_top_clients_title')}</h4></div><div class="h-64"><canvas id="topClientsChart"></canvas></div></div>
    `;
}

function renderGoalsReports({ objectives }: { objectives: Objective[] }) {
    const state = getState();
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
            ${renderKpiCard(t('goals.total_goals'), objectives.length.toString(), 'flag', 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300')}
            ${renderKpiCard(t('goals.avg_progress'), `${avgProgress}%`, 'trending_up', 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300')}
            ${renderKpiCard(t('reports.milestones_completed'), completedMilestones.toString(), 'task_alt', 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300')}
        </div>
        <div class="bg-content p-4 rounded-lg shadow-sm md:col-span-2 lg:col-span-4"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_progress_by_goal_title')}</h4></div><div class="h-64"><canvas id="progressByGoalChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_goal_completion_title')}</h4></div><div class="h-64 flex items-center justify-center"><canvas id="goalCompletionChart"></canvas></div></div>
        <div class="bg-content p-4 rounded-lg shadow-sm"><div class="flex justify-between items-center mb-4"><h4 class="font-semibold">${t('reports.report_milestone_status_title')}</h4></div><div class="h-64 flex items-center justify-center"><canvas id="milestoneStatusChart"></canvas></div></div>
    `;
}

export function initReportsPage() {
    const state = getState();
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
                data: { labels: Object.keys(completedByDay), datasets: [{ label: t('reports.report_task_velocity_title'), data: Object.values(completedByDay), borderColor: chartColors.primary, tension: 0.3, pointBackgroundColor: chartColors.primary, pointBorderColor: '#fff', pointHoverRadius: 6 }] },
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
                data: { labels: Object.keys(openTasksByUser), datasets: [{ data: Object.values(openTasksByUser), backgroundColor: [chartColors.primary, chartColors.purple, chartColors.teal, chartColors.warning, chartColors.danger], borderWidth: 0 }] },
                options: { ...commonChartOptions, scales: {}, cutout: '70%' }
            });
        }
        
        const priorityCtx = (document.getElementById('tasksByPriorityChart') as HTMLCanvasElement | null)?.getContext('2d');
        if (priorityCtx) {
            const completedByPriority = tasks.filter(t => t.status === 'done').reduce((acc, task) => {
                const priority = task.priority || 'none';
                acc[priority] = (acc[priority] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            const priorityColorMap: Record<string, string> = { high: chartColors.danger, medium: chartColors.warning, low: chartColors.primary, none: chartColors.purple };
            const backgroundColors = Object.keys(completedByPriority).map(p => priorityColorMap[p] || chartColors.teal);

            charts.tasksByPriority = new Chart(priorityCtx, {
                type: 'bar',
                data: { 
                    labels: Object.keys(completedByPriority).map(p => t(`tasks.priority_${p}`)), 
                    datasets: [{ 
                        label: t('reports.report_tasks_by_priority_title'), 
                        data: Object.values(completedByPriority), 
                        backgroundColor: backgroundColors
                    }] 
                },
                options: commonChartOptions
            });
        }
    } else if (activeTab === 'time') {
        // ... Time Tracking Charts
    } else if (activeTab === 'financial') {
        // ... Financial Charts
    } else if (activeTab === 'goals') {
        // ... Goals Charts
    }
}

export function ReportsPage() {
    const state = getState();
    const { activeTab, filters } = state.ui.reports;
    const { tasks, timeLogs, invoices, expenses, objectives } = getFilteredData();

    let content = `<div class="p-8 text-center text-text-subtle">${t('reports.no_data')}</div>`;
    if (activeTab === 'productivity' && tasks.length > 0) content = renderProductivityReports({ tasks });
    if (activeTab === 'time' && timeLogs.length > 0) content = renderTimeTrackingReports({ timeLogs });
    if (activeTab === 'financial' && (invoices.length > 0 || expenses.length > 0)) content = renderFinancialReports({ invoices, expenses });
    if (activeTab === 'goals' && objectives.length > 0) content = renderGoalsReports({ objectives });

    const workspaceProjects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);
    const workspaceUsers = state.workspaceMembers.filter(m => m.workspaceId === state.activeWorkspaceId).map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);
    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);

    const navItems = [
        { id: 'productivity', text: t('reports.tab_productivity') },
        { id: 'time', text: t('reports.tab_time') },
        { id: 'financial', text: t('reports.tab_financial') },
        { id: 'goals', text: t('reports.tab_goals') },
    ];
    
    return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">${t('reports.title')}</h2>
            <div class="bg-content p-4 rounded-lg shadow-sm border border-border-color">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label for="report-filter-date-start" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_date_range')}</label>
                        <div class="flex items-center gap-2">
                            <input type="date" id="report-filter-date-start" class="form-control" value="${filters.dateStart}" data-filter-key="dateStart">
                            <input type="date" id="report-filter-date-end" class="form-control" value="${filters.dateEnd}" data-filter-key="dateEnd">
                        </div>
                    </div>
                     <div>
                        <label for="report-filter-project" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_project')}</label>
                        <select id="report-filter-project" class="form-control" data-filter-key="projectId">
                            <option value="all">${t('reports.all_projects')}</option>
                            ${workspaceProjects.map(p => `<option value="${p.id}" ${filters.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="report-filter-user" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_user')}</label>
                        <select id="report-filter-user" class="form-control" data-filter-key="userId">
                            <option value="all">${t('reports.all_users')}</option>
                            ${workspaceUsers.map(u => `<option value="${u!.id}" ${filters.userId === u!.id ? 'selected' : ''}>${u!.name}</option>`).join('')}
                        </select>
                    </div>
                     <div>
                        <label for="report-filter-client" class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_client')}</label>
                        <select id="report-filter-client" class="form-control" data-filter-key="clientId">
                            <option value="all">${t('reports.all_clients')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}" ${filters.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
            <div class="border-b border-border-color">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    ${navItems.map(item => `
                        <button type="button" class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === item.id ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-tab-group="ui.reports.activeTab" data-tab-value="${item.id}">${item.text}</button>
                    `).join('')}
                </nav>
            </div>
            <div class="reports-grid">${content}</div>
        </div>
    `;
}
