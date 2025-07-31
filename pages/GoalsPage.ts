
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import type { Objective, KeyResult } from '../types.ts';

function renderKpiWidgets(goals: Objective[]) {
    const inProgress = goals.filter(g => g.status === 'in_progress').length;
    const completed = goals.filter(g => g.status === 'completed').length;
    
    const totalProgress = goals.reduce((sum, goal) => {
        const target = goal.targetValue ?? 1;
        const current = goal.currentValue ?? 0;
        if (target > 0) {
            const progress = (current / target) * 100;
            return sum + Math.min(100, Math.max(0, progress));
        }
        return sum;
    }, 0);

    const avgProgress = goals.length > 0 ? Math.round(totalProgress / goals.length) : 0;

    return `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500"><span class="material-icons-sharp">track_changes</span></div><div><p class="text-sm text-text-subtle">${t('goals.total_goals')}</p><strong class="text-xl font-semibold">${goals.length}</strong></div></div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-500"><span class="material-icons-sharp">hourglass_top</span></div><div><p class="text-sm text-text-subtle">${t('goals.in_progress')}</p><strong class="text-xl font-semibold">${inProgress}</strong></div></div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-green-100 dark:bg-green-900/50 text-green-500"><span class="material-icons-sharp">check_circle</span></div><div><p class="text-sm text-text-subtle">${t('goals.completed')}</p><strong class="text-xl font-semibold">${completed}</strong></div></div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-500"><span class="material-icons-sharp">trending_up</span></div><div><p class="text-sm text-text-subtle">${t('goals.avg_progress')}</p><strong class="text-xl font-semibold">${avgProgress}%</strong></div></div>
        </div>
    `;
}

function renderCategoryCards(goals: Objective[]) {
    const categories = [...new Set(goals.map(g => g.category || 'Other'))];
    const categoryColors: Record<string, string> = {
        Financial: 'bg-green-100 text-green-700',
        Operational: 'bg-blue-100 text-blue-700',
        Performance: 'bg-purple-100 text-purple-700',
        Quality: 'bg-yellow-100 text-yellow-700',
        Other: 'bg-gray-100 text-gray-700',
    };

    return `
        <div class="bg-content p-4 rounded-lg">
            <h4 class="font-semibold mb-3">${t('goals.goal_categories')}</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${categories.map(category => {
                    const count = goals.filter(g => (g.category || 'Other') === category).length;
                    const colorClass = categoryColors[category] || categoryColors['Other'];
                    return `
                        <div class="border border-border-color p-3 rounded-md">
                            <span class="px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}">${category}</span>
                            <p class="font-bold text-2xl mt-2">${count}</p>
                            <p class="text-xs text-text-subtle">${t('goals.active_goals')}</p>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderGoalCard(goal: Objective) {
    const milestones = state.keyResults.filter(kr => kr.objectiveId === goal.id);
    const progress = (goal.targetValue && goal.targetValue > 0) ? Math.min(100, Math.max(0, (goal.currentValue / goal.targetValue) * 100)) : 0;
    const priorityClasses: Record<string, string> = {
        high: 'bg-danger/10 text-danger',
        medium: 'bg-warning/10 text-warning',
        low: 'bg-primary/10 text-primary',
    };
    
    const formatValue = (value: number, unit?: string) => {
        const formatter = new Intl.NumberFormat('en-US');
        return `${formatter.format(value)}${unit || ''}`;
    };

    return `
        <div class="bg-content p-5 rounded-lg shadow-sm flex flex-col space-y-3 cursor-pointer hover:shadow-md transition-shadow" data-goal-id="${goal.id}">
            <h4 class="font-bold">${goal.title}</h4>
            <p class="text-sm text-text-subtle flex-grow">${goal.description || ''}</p>
            <div class="flex flex-wrap items-center gap-2">
                ${goal.priority ? `<span class="px-2 py-0.5 text-xs font-semibold rounded-full ${priorityClasses[goal.priority]}">${goal.priority}</span>` : ''}
                <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">${t(`goals.status_${goal.status}`)}</span>
                ${goal.category ? `<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">${goal.category}</span>` : ''}
            </div>
            <div>
                <div class="flex justify-between items-baseline mb-1">
                    <span class="text-sm font-medium text-text-subtle">${t('goals.progress')}</span>
                    <span class="text-sm font-semibold">${formatValue(goal.currentValue, goal.valueUnit)} <span class="text-text-subtle">${t('goals.of')} ${formatValue(goal.targetValue || 0, goal.valueUnit)}</span></span>
                </div>
                <div class="w-full bg-background rounded-full h-2"><div class="bg-primary h-2 rounded-full" style="width: ${progress}%;"></div></div>
            </div>
            <div>
                <h5 class="text-sm font-semibold mb-2">${t('goals.milestones')}</h5>
                <div class="space-y-1.5">
                    ${milestones.map(ms => `
                        <label class="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary milestone-checkbox" data-milestone-id="${ms.id}" ${ms.completed ? 'checked' : ''}>
                            <span class="${ms.completed ? 'line-through text-text-subtle' : ''}">${ms.title}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

export function GoalsPage() {
    const filterText = state.ui.goals.filters.text.toLowerCase();
    let goals = state.objectives.filter(o => o.workspaceId === state.activeWorkspaceId && o.status !== 'archived');
    
    if (filterText) {
        goals = goals.filter(g => 
            g.title.toLowerCase().includes(filterText) ||
            (g.description || '').toLowerCase().includes(filterText)
        );
    }

    const canManage = can('manage_goals');

    const content = goals.length > 0 ? `
        ${renderCategoryCards(goals)}
        <div class="bg-content p-4 rounded-lg">
            <div class="flex items-center gap-4">
                 <div class="relative flex-grow">
                    <span class="material-icons-sharp absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">search</span>
                    <input type="text" id="goal-search-input" class="w-full pl-10 pr-4 py-2 bg-background border border-border-color rounded-md" placeholder="${t('goals.search_goals')}" value="${state.ui.goals.filters.text}">
                </div>
                <button class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-content border border-border-color hover:bg-background">
                    <span class="material-icons-sharp text-base">filter_list</span>
                    ${t('goals.filter')}
                </button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${goals.map(renderGoalCard).join('')}
        </div>
    ` : `
        <div class="flex flex-col items-center justify-center h-96 bg-content rounded-lg border-2 border-dashed border-border-color">
            <span class="material-icons-sharp text-5xl text-text-subtle">track_changes</span>
            <h3 class="text-lg font-medium mt-4">${t('goals.no_goals')}</h3>
            <p class="text-sm text-text-subtle mt-1">${t('goals.no_goals_desc')}</p>
             <button class="mt-4 px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addGoal" ${!canManage ? 'disabled' : ''}>
                ${t('goals.new_goal')}
            </button>
        </div>
    `;

    return `
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-bold">${t('goals.title')}</h2>
                    <p class="text-text-subtle">${t('goals.subtitle')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button id="goals-analytics-btn" class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-content border border-border-color hover:bg-background">
                        <span class="material-icons-sharp text-base">analytics</span>
                        ${t('goals.analytics')}
                    </button>
                     <button class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addGoal" ${!canManage ? 'disabled' : ''}>
                        <span class="material-icons-sharp text-base">add</span>
                        ${t('goals.new_goal')}
                    </button>
                </div>
            </div>
            ${renderKpiWidgets(goals)}
            ${content}
        </div>
    `;
}
