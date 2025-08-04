

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getUsage, PLANS, formatDate, formatCurrency, getTaskCurrentTrackedSeconds, getUserInitials } from '../utils.ts';
import { can } from '../permissions.ts';

type ProjectWithComputedData = ReturnType<typeof getFilteredAndSortedProjects>[0];

function getFilteredAndSortedProjects() {
    const { text: filterText, tagIds: filterTagIds, status: filterStatus } = state.ui.projects.filters;
    const { sortBy } = state.ui.projects;
    const today = new Date().toISOString().slice(0, 10);

    let projects = state.projects
        .filter(p => {
            if (p.workspaceId !== state.activeWorkspaceId) return false;
            if (p.privacy === 'public') return true;
            return state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === state.currentUser?.id);
        })
        .map(project => {
            const tasks = state.tasks.filter(t => t.projectId === project.id);
            const completedTasks = tasks.filter(t => t.status === 'done').length;
            const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
            const overdueTasksCount = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;
            
            let status: 'on_track' | 'at_risk' | 'completed' = 'on_track';
            if (progress === 100 && tasks.length > 0) status = 'completed';
            else if (overdueTasksCount > 0) status = 'at_risk';

            const dueDates = tasks.filter(t => t.dueDate && t.status !== 'done').map(t => new Date(t.dueDate!));
            const latestDueDate = dueDates.length > 0 ? new Date(Math.max(...dueDates.map(d => d.getTime()))) : null;

            return { ...project, computed: { progress, status, latestDueDate, overdueTasksCount } };
        });

    // Filtering
    if (filterText) {
        projects = projects.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));
    }
    if (filterTagIds.length > 0) {
        projects = projects.filter(p => {
            const projectTagIds = new Set(state.projectTags.filter(pt => pt.projectId === p.id).map(pt => pt.tagId));
            return filterTagIds.every(tagId => projectTagIds.has(tagId));
        });
    }
    if (filterStatus !== 'all') {
        projects = projects.filter(p => p.computed.status === filterStatus);
    }

    // Sorting
    const statusOrder = { at_risk: 0, on_track: 1, completed: 2 };
    projects.sort((a, b) => {
        switch (sortBy) {
            case 'name': return a.name.localeCompare(b.name);
            case 'status': return statusOrder[a.computed.status] - statusOrder[b.computed.status];
            case 'progress': return b.computed.progress - a.computed.progress;
            case 'dueDate':
                if (!a.computed.latestDueDate) return 1;
                if (!b.computed.latestDueDate) return -1;
                return a.computed.latestDueDate.getTime() - b.computed.latestDueDate.getTime();
            default: return 0;
        }
    });

    return projects;
}


function renderGridView(projects: ProjectWithComputedData[]) {
    const canManage = can('manage_projects');

    if (projects.length === 0) {
        return `<div class="flex flex-col items-center justify-center h-full bg-content rounded-lg border-2 border-dashed border-border-color">
            <span class="material-icons-sharp text-5xl text-text-subtle">folder_off</span>
            <h3 class="text-lg font-medium mt-4">${t('projects.no_projects_yet')}</h3>
            <p class="text-sm text-text-subtle mt-1">${t('projects.no_projects_desc')}</p>
            <button class="mt-4 px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover projects-page-new-project-btn" data-modal-target="addProject">
                ${t('modals.add_project_title')}
            </button>
        </div>`;
    }

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 projects-grid">
            ${projects.map(project => {
                const client = state.clients.find(c => c.id === project.clientId);
                const members = state.projectMembers.filter(pm => pm.projectId === project.id);
                const memberUsers = members.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);
                const description = (project.wikiContent?.split('\n')[0] || '').substring(0, 100);
                const projectTags = state.projectTags.filter(pt => pt.projectId === project.id).map(pt => state.tags.find(t => t.id === pt.tagId)).filter(Boolean);
                
                return `
                    <div class="bg-content p-4 rounded-lg shadow-sm flex flex-col space-y-3 cursor-pointer hover:shadow-md transition-shadow" data-project-id="${project.id}" role="button" tabindex="0" aria-label="View project ${project.name}">
                        <div class="flex justify-between items-start">
                            <h3 class="font-semibold text-base flex items-center gap-2">
                                ${project.name}
                                ${project.computed.overdueTasksCount > 0 ? `<span class="material-icons-sharp text-danger text-base" title="${project.computed.overdueTasksCount} overdue tasks">warning_amber</span>` : ''}
                            </h3>
                             ${canManage ? `
                                <div class="relative">
                                    <button class="p-1 text-text-subtle rounded-full hover:bg-background" data-menu-toggle="project-menu-${project.id}" aria-haspopup="true" aria-expanded="false" aria-label="Project actions menu">
                                        <span class="material-icons-sharp text-lg">more_horiz</span>
                                    </button>
                                    <div id="project-menu-${project.id}" class="dropdown-menu absolute top-full right-0 mt-1 w-40 bg-content rounded-md shadow-lg border border-border-color z-10 hidden">
                                        <div class="py-1">
                                            <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-modal-target="addProject" data-project-id="${project.id}">
                                                <span class="material-icons-sharp text-base">edit</span>
                                                ${t('misc.edit')}
                                            </button>
                                            <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger/10" data-delete-project-id="${project.id}">
                                                <span class="material-icons-sharp text-base">delete</span>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        ${description ? `<p class="text-sm text-text-subtle">${description}${project.wikiContent && project.wikiContent.length > 100 ? '...' : ''}</p>` : ''}
                        
                         ${projectTags.length > 0 ? `
                            <div class="flex flex-wrap gap-1.5 pt-2">
                                ${projectTags.map(tag => `<span class="tag-chip" style="background-color: ${tag!.color}20; border-color: ${tag!.color}">${tag!.name}</span>`).join('')}
                            </div>
                        ` : ''}

                        <div>
                            <div class="flex justify-between items-center text-xs mb-1">
                                <span class="font-medium text-text-subtle">${t('panels.progress')}</span>
                                <span>${Math.round(project.computed.progress)}%</span>
                            </div>
                            <div class="w-full bg-background rounded-full h-1.5"><div class="bg-primary h-1.5 rounded-full" style="width: ${project.computed.progress}%;"></div></div>
                        </div>
                        
                        <div class="flex flex-col gap-2 text-sm text-text-subtle border-t border-border-color pt-3">
                            ${client ? `
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">business</span>
                                <span>${client.name}</span>
                            </div>` : ''}
                        </div>

                        <div class="flex justify-between items-center mt-auto pt-3 border-t border-border-color">
                             <div class="flex -space-x-2">
                                 ${memberUsers.slice(0, 4).map(u => u ? `
                                    <div class="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold border-2 border-content" title="${u.name || getUserInitials(u)}">
                                        ${u.avatarUrl ? `<img src="${u.avatarUrl}" alt="${u.name || ''}" class="w-full h-full rounded-full object-cover">` : getUserInitials(u)}
                                    </div>
                                ` : '').join('')}
                                ${memberUsers.length > 4 ? `
                                    <div class="w-7 h-7 rounded-full bg-background text-text-subtle flex items-center justify-center text-xs font-semibold border-2 border-content">+${memberUsers.length - 4}</div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderPortfolioView(projects: ProjectWithComputedData[]) {
    return `
    <div class="bg-content rounded-lg shadow-sm overflow-x-auto">
        <table class="portfolio-table">
            <thead>
                <tr>
                    <th class="w-2/5">${t('sidebar.projects')}</th>
                    <th>${t('projects.col_status')}</th>
                    <th>${t('projects.col_progress')}</th>
                    <th>${t('projects.col_due_date')}</th>
                    <th>${t('projects.col_budget')}</th>
                    <th>${t('projects.col_team')}</th>
                </tr>
            </thead>
            <tbody>
                ${projects.map(project => {
                    const statusText = t(`projects.status_${project.computed.status}`);
                    const statusClass = {
                        on_track: 'status-badge-ontrack',
                        at_risk: 'status-badge-atrisk',
                        completed: 'status-badge-completed',
                    }[project.computed.status];
                    
                    const totalTrackedSeconds = state.tasks
                        .filter(t => t.projectId === project.id)
                        .reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
                    const actualCost = project.hourlyRate ? (totalTrackedSeconds / 3600) * project.hourlyRate : null;

                    const members = state.projectMembers.filter(pm => pm.projectId === project.id);
                    const memberUsers = members.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);

                    return `
                        <tr class="portfolio-table-row" data-project-id="${project.id}">
                            <td>
                                <div class="font-semibold">${project.name}</div>
                            </td>
                            <td>
                                <span class="status-badge ${statusClass}">${statusText}</span>
                            </td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <div class="progress-bar-cell">
                                        <div class="progress-bar">
                                            <div class="progress-bar-inner" style="width: ${project.computed.progress}%;"></div>
                                        </div>
                                    </div>
                                    <span class="text-xs text-text-subtle">${Math.round(project.computed.progress)}%</span>
                                </div>
                            </td>
                            <td>${project.computed.latestDueDate ? formatDate(project.computed.latestDueDate.toISOString()) : t('misc.not_applicable')}</td>
                            <td>
                                ${project.budgetCost ? `
                                    <div class="text-xs">
                                        <span>${formatCurrency(actualCost)}</span> / 
                                        <span class="text-text-subtle">${formatCurrency(project.budgetCost)}</span>
                                    </div>
                                ` : t('misc.not_applicable')}
                            </td>
                            <td>
                                <div class="avatar-stack">
                                    ${memberUsers.slice(0, 3).map(u => u ? `<div class="avatar-small" title="${u.name || getUserInitials(u)}">${getUserInitials(u)}</div>` : '').join('')}
                                    ${memberUsers.length > 3 ? `<div class="avatar-small more-avatar">+${memberUsers.length - 3}</div>` : ''}
                                </div>
                            </td>
                        </tr>
                    `;

                }).join('')}
            </tbody>
        </table>
    </div>
    `;
}

export function ProjectsPage() {
    const { activeWorkspaceId } = state;
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) return '';

    if (state.ui.projects.isLoading) {
        return `<div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>`;
    }

    const usage = getUsage(activeWorkspace.id);
    const planLimits = PLANS[activeWorkspace.subscription.planId];
    const canCreateProject = usage.projects < planLimits.projects;
    const isAllowedToCreate = can('create_projects');
    
    const { viewMode, filters, sortBy } = state.ui.projects;
    const workspaceTags = state.tags.filter(t => t.workspaceId === activeWorkspaceId);

    const sortedAndFilteredProjects = getFilteredAndSortedProjects();

    return `
        <div class="space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 class="text-2xl font-bold">${t('sidebar.projects')}</h2>
                <div class="flex items-center gap-4">
                    <div class="flex items-center p-1 bg-content border border-border-color rounded-lg">
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-text-subtle'}" data-project-view-mode="grid">${t('projects.grid_view')}</button>
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${viewMode === 'portfolio' ? 'bg-background shadow-sm' : 'text-text-subtle'}" data-project-view-mode="portfolio">${t('projects.portfolio_view')}</button>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-menu-toggle="project-sort-menu" aria-haspopup="true" aria-expanded="false">
                                <span class="material-icons-sharp text-base">sort</span>
                                <span>Sort</span>
                            </button>
                            <div id="project-sort-menu" class="dropdown-menu absolute top-full right-0 mt-1 w-48 bg-content rounded-md shadow-lg border border-border-color z-10 hidden">
                                <div class="py-1">
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-project-sort-by="name">${t('tasks.sort_name')} ${sortBy === 'name' ? '✓' : ''}</button>
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-project-sort-by="status">${t('projects.col_status')} ${sortBy === 'status' ? '✓' : ''}</button>
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-project-sort-by="progress">${t('projects.col_progress')} ${sortBy === 'progress' ? '✓' : ''}</button>
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-project-sort-by="dueDate">${t('projects.col_due_date')} ${sortBy === 'dueDate' ? '✓' : ''}</button>
                                </div>
                            </div>
                        </div>
                        <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover projects-page-new-project-btn" data-modal-target="addProject" ${!isAllowedToCreate || !canCreateProject ? 'disabled' : ''} title="${!canCreateProject ? t('billing.limit_reached_projects').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                            <span class="material-icons-sharp text-base">add</span> ${t('modals.add_project_title')}
                        </button>
                    </div>
                </div>
            </div>

             <div class="bg-content p-4 rounded-lg">
                <div class="flex flex-col sm:flex-row gap-4">
                    <div class="relative flex-grow">
                        <span class="material-icons-sharp absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">search</span>
                        <input type="text" id="project-search-input" class="w-full pl-10 pr-4 py-2 bg-background border border-border-color rounded-md" value="${filters.text}" placeholder="Search projects...">
                    </div>
                    <div class="relative">
                        <select id="project-status-filter" class="form-control" data-filter-key="status">
                            <option value="all">${t('projects.all_statuses')}</option>
                            <option value="on_track" ${filters.status === 'on_track' ? 'selected' : ''}>${t('projects.status_on_track')}</option>
                            <option value="at_risk" ${filters.status === 'at_risk' ? 'selected' : ''}>${t('projects.status_at_risk')}</option>
                            <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>${t('projects.status_completed')}</option>
                        </select>
                    </div>
                     <div class="relative" id="project-filter-tags-container">
                        <button id="project-filter-tags-toggle" class="w-full sm:w-48 form-control text-left flex justify-between items-center">
                            <span class="truncate">${filters.tagIds.length > 0 ? `${filters.tagIds.length} tags selected` : 'Filter by tag'}</span>
                            <span class="material-icons-sharp text-base">arrow_drop_down</span>
                        </button>
                        <div id="project-filter-tags-dropdown" class="multiselect-dropdown hidden">
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
            </div>

            ${viewMode === 'portfolio' ? renderPortfolioView(sortedAndFilteredProjects) : renderGridView(sortedAndFilteredProjects)}
        </div>
    `;
}