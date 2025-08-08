import { getState, setState } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import type { Objective, KeyResult, User } from '../types.ts';
import { filterItems, getUserInitials } from '../utils.ts';
import { fetchGoalsForWorkspace } from '../handlers/goals.ts';
import { html, TemplateResult } from 'lit-html';

export async function initGoalsPage() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    if (state.ui.goals.loadedWorkspaceId !== activeWorkspaceId) {
        // Set loading state and loaded ID immediately to prevent re-fetching loops.
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                goals: { ...prevState.ui.goals, isLoading: true, loadedWorkspaceId: activeWorkspaceId }
            }
        }), ['page']);
        
        await fetchGoalsForWorkspace(activeWorkspaceId);
    }
}

function renderKpiWidgets(goals: Objective[]): TemplateResult {
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

    return html`
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500"><span class="material-icons-sharp">track_changes</span></div><div><p class="text-sm text-text-subtle">${t('goals.total_goals')}</p><strong class="text-xl font-semibold">${goals.length}</strong></div></div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-500"><span class="material-icons-sharp">hourglass_top</span></div><div><p class="text-sm text-text-subtle">${t('goals.in_progress')}</p><strong class="text-xl font-semibold">${inProgress}</strong></div></div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-green-100 dark:bg-green-900/50 text-green-500"><span class="material-icons-sharp">check_circle</span></div><div><p class="text-sm text-text-subtle">${t('goals.completed')}</p><strong class="text-xl font-semibold">${completed}</strong></div></div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-500"><span class="material-icons-sharp">trending_up</span></div><div><p class="text-sm text-text-subtle">${t('goals.avg_progress')}</p><strong class="text-xl font-semibold">${avgProgress}%</strong></div></div>
        </div>
    `;
}

function renderCategoryCards(goals: Objective[]): TemplateResult {
    const categories = [...new Set(goals.map(g => g.category || 'Other'))];
    const categoryColors: Record<string, string> = {
        Financial: 'bg-green-100 text-green-700',
        Operational: 'bg-blue-100 text-blue-700',
        Performance: 'bg-purple-100 text-purple-700',
        Quality: 'bg-yellow-100 text-yellow-700',
        Other: 'bg-gray-100 text-gray-700',
    };

    return html`
        <div class="bg-content p-4 rounded-lg">
            <h4 class="font-semibold mb-3">${t('goals.goal_categories')}</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${categories.map(category => {
                    const count = goals.filter(g => (g.category || 'Other') === category).length;
                    const colorClass = categoryColors[category] || categoryColors['Other'];
                    return html`
                        <div class="border border-border-color p-3 rounded-md">
                            <span class="px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}">${category}</span>
                            <p class="font-bold text-2xl mt-2">${count}</p>
                            <p class="text-xs text-text-subtle">${t('goals.active_goals')}</p>
                        </div>
                    `;
                })}
            </div>
        </div>
    `;
}

function renderGoalCard(goal: Objective): TemplateResult {
    const state = getState();
    const milestones = state.keyResults.filter(kr => kr.objectiveId === goal.id);
    const progress = (goal.targetValue && goal.targetValue > 0) ? Math.min(100, Math.max(0, (goal.currentValue / goal.targetValue) * 100)) : 0;
    const priorityClasses: Record<string, string> = {
        high: 'bg-danger/10 text-danger',
        medium: 'bg-warning/10 text-warning',
        low: 'bg-primary/10 text-primary',
    };

    return html`
        <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col space-y-3 cursor-pointer hover:shadow-md transition-shadow goal-card" data-goal-id="${goal.id}" role="button" tabindex="0">
            <div class="flex justify-between items-start">
                <h4 class="font-semibold">${goal.title}</h4>
                ${goal.priority ? html`<span class="px-2 py-0.5 text-xs font-medium rounded-full ${priorityClasses[goal.priority]} capitalize">${goal.priority}</span>` : ''}
            </div>
            <div class="my-2">
                <div class="flex justify-between text-xs mb-1">
                    <span class="font-medium text-text-subtle">${t('goals.progress')}</span>
                    <span>${Math.round(progress)}% (${goal.currentValue} ${t('goals.of')} ${goal.targetValue || 0} ${goal.valueUnit || ''})</span>
                </div>
                <div class="w-full bg-background rounded-full h-1.5"><div class="bg-primary h-1.5 rounded-full" style="width: ${progress}%;"></div></div>
            </div>
            <div>
                <h5 class="text-xs font-semibold text-text-subtle mb-1">${t('goals.milestones')} (${milestones.filter(m => m.completed).length}/${milestones.length})</h5>
                <div class="space-y-1">
                    ${milestones.slice(0, 3).map(ms => html`
                        <div class="flex items-center gap-2 text-xs">
                            <input type="checkbox" class="h-3 w-3 rounded-sm milestone-checkbox" data-milestone-id="${ms.id}" ?checked=${ms.completed}>
                            <span class="${ms.completed ? 'line-through text-text-subtle' : ''}">${ms.title}</span>
                        </div>
                    `)}
                </div>
            </div>
        </div>
    `;
}

export function GoalsPage(): TemplateResult {
    const state = getState();
    const canManage = can('manage_goals');
    
    const { text, status, ownerId } = state.ui.goals.filters;
    const allGoals = state.objectives.filter(o => o.workspaceId === state.activeWorkspaceId);
    
    let filteredGoals = filterItems(
        allGoals,
        { text, status, ownerId },
        ['title', 'description', 'category'],
    );
    
    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u);

    return html`
        <div class="space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold">${t('goals.title')}</h2>
                    <p class="text-text-subtle">${t('goals.subtitle')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button id="goals-analytics-btn" class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-content border border-border-color hover:bg-background"><span class="material-icons-sharp text-base">analytics</span> ${t('goals.analytics')}</button>
                    ${canManage ? html`<button class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addGoal"><span class="material-icons-sharp text-base">add</span> ${t('goals.new_goal')}</button>` : ''}
                </div>
            </div>
            
            ${renderKpiWidgets(allGoals)}
            ${renderCategoryCards(allGoals)}
            
            <div class="bg-content p-4 rounded-lg">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="text" id="goal-search-input" class="form-control" placeholder="${t('goals.search_goals')}" .value=${text}>
                    <select id="goal-filter-status" class="form-control" data-filter-key="status">
                        <option value="all">${t('goals.all_statuses')}</option>
                        <option value="in_progress" ?selected=${status === 'in_progress'}>${t('goals.status_in_progress')}</option>
                        <option value="completed" ?selected=${status === 'completed'}>${t('goals.status_completed')}</option>
                        <option value="on_hold" ?selected=${status === 'on_hold'}>${t('goals.status_on_hold')}</option>
                    </select>
                     <select id="goal-filter-owner" class="form-control" data-filter-key="ownerId">
                        <option value="all">${t('goals.all_owners')}</option>
                        ${workspaceMembers.map(u => html`<option value="${u.id}" ?selected=${ownerId === u.id}>${u.name}</option>`)}
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${filteredGoals.length > 0 ? filteredGoals.map(renderGoalCard) : html`
                    <div class="lg:col-span-3 text-center py-16">
                        <span class="material-icons-sharp text-5xl text-text-subtle">flag</span>
                        <p class="mt-2 font-medium">${t('goals.no_goals')}</p>
                        <p class="text-sm text-text-subtle">${t('goals.no_goals_desc')}</p>
                    </div>
                `}
            </div>
        </div>
    `;
}
