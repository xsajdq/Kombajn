
import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import type { User, Project, Tag, FilterView } from '../types.ts';
import { getUserInitials } from '../utils.ts';

export function TaskFilterPanel() {
    const state = getState();
    const { filters, activeFilterViewId } = state.ui.tasks;
    const { activeWorkspaceId, currentUser } = state;

    if (!activeWorkspaceId || !currentUser) return '';

    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u);

    const workspaceProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId);
    const workspaceTags = state.tags.filter(t => t.workspaceId === activeWorkspaceId);
    const savedViews = state.filterViews.filter(v => v.userId === currentUser.id && v.workspaceId === activeWorkspaceId);

    const dateRanges = ['all', 'today', 'tomorrow', 'yesterday', 'this_week', 'overdue'];
    const activeView = savedViews.find(v => v.id === activeFilterViewId);
    const selectedAssignee = filters.assigneeId ? workspaceMembers.find(u => u.id === filters.assigneeId) : null;

    return `
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="lg:col-span-3">
                    <label for="task-filter-text" class="sr-only">${t('tasks.search_placeholder')}</label>
                    <div class="relative">
                        <span class="material-icons-sharp absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">search</span>
                        <input type="text" id="task-filter-text" class="pl-10 pr-4 py-2 w-full bg-background border-border-color rounded-md text-sm" placeholder="${t('tasks.search_placeholder')}" value="${filters.text}" data-filter-key="text">
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-medium text-text-subtle">${t('modals.assignees')}</label>
                    <div class="relative custom-select-container" data-filter-key="assigneeId" data-current-value="${filters.assigneeId}">
                         <input type="hidden" id="task-assignee-filter-value" value="${filters.assigneeId}">
                        <button type="button" class="form-control text-left flex justify-between items-center custom-select-toggle">
                            <span class="custom-select-display flex items-center gap-2">
                                ${selectedAssignee
                                    ? `<div class="avatar-small">${getUserInitials(selectedAssignee)}</div><span>${selectedAssignee.name || selectedAssignee.initials}</span>`
                                    : `<span>${t('tasks.all_assignees')}</span>`
                                }
                            </span>
                            <span class="material-icons-sharp text-base">expand_more</span>
                        </button>
                        <div class="custom-select-dropdown hidden">
                            <div class="custom-select-list">
                                <div class="custom-select-option ${!filters.assigneeId ? 'bg-primary/10' : ''}" data-value="">
                                    <span>${t('tasks.all_assignees')}</span>
                                </div>
                                ${workspaceMembers.map(u => `
                                    <div class="custom-select-option ${filters.assigneeId === u.id ? 'bg-primary/10' : ''}" data-value="${u.id}">
                                        <div class="avatar-small">${getUserInitials(u)}</div>
                                        <span>${u.name || u.initials}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label for="task-filter-priority" class="text-xs font-medium text-text-subtle">${t('modals.priority')}</label>
                    <select id="task-filter-priority" class="form-control" data-filter-key="priority">
                        <option value="">${t('tasks.all_priorities')}</option>
                        <option value="low" ${filters.priority === 'low' ? 'selected' : ''}>${t('tasks.priority_low')}</option>
                        <option value="medium" ${filters.priority === 'medium' ? 'selected' : ''}>${t('tasks.priority_medium')}</option>
                        <option value="high" ${filters.priority === 'high' ? 'selected' : ''}>${t('tasks.priority_high')}</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label for="task-filter-project" class="text-xs font-medium text-text-subtle">${t('modals.project')}</label>
                    <select id="task-filter-project" class="form-control" data-filter-key="projectId">
                        <option value="">${t('tasks.all_projects')}</option>
                        ${workspaceProjects.map(p => `<option value="${p.id}" ${filters.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label for="task-filter-date" class="text-xs font-medium text-text-subtle">${t('tasks.filter_by_date')}</label>
                    <select id="task-filter-date" class="form-control" data-filter-key="dateRange">
                        ${dateRanges.map(dr => `<option value="${dr}" ${filters.dateRange === dr ? 'selected' : ''}>${t(`tasks.date_${dr}`)}</option>`).join('')}
                    </select>
                </div>
                <div class="flex flex-col gap-1.5 relative" id="task-filter-tags-container">
                    <label for="task-filter-tags-toggle" class="text-xs font-medium text-text-subtle">${t('modals.tags')}</label>
                    <button id="task-filter-tags-toggle" class="form-control text-left flex justify-between items-center">
                        <span class="truncate">${filters.tagIds.length > 0 ? `${filters.tagIds.length} selected` : 'All Tags'}</span>
                        <span class="material-icons-sharp text-base">arrow_drop_down</span>
                    </button>
                    <div id="task-filter-tags-dropdown" class="multiselect-dropdown hidden">
                        <div class="multiselect-list">
                        ${workspaceTags.map(tag => `
                            <label class="multiselect-list-item">
                                <input type="checkbox" value="${tag.id}" data-filter-key="tagIds" ${filters.tagIds.includes(tag.id) ? 'checked' : ''}>
                                <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                            </label>
                        `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="pt-4 border-t border-border-color flex flex-wrap justify-between items-center gap-4">
                <div class="flex items-center gap-2">
                    <label class="flex items-center gap-2 text-sm text-text-subtle cursor-pointer">
                        <input type="checkbox" id="task-filter-archived" class="h-4 w-4 rounded text-primary focus:ring-primary" ${filters.isArchived ? 'checked' : ''} data-filter-key="isArchived">
                        ${t('tasks.show_archived')}
                    </label>
                </div>
                <div class="flex items-center gap-2">
                    <button id="reset-task-filters" class="px-3 py-1.5 text-sm font-medium rounded-md bg-background border border-border-color hover:bg-border-color">${t('tasks.reset_filters')}</button>
                </div>
            </div>
        </div>
    `;
}
