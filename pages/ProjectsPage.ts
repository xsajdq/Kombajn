
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getUsage, PLANS, formatDate, formatCurrency } from '../utils.ts';
import { can } from '../permissions.ts';
import { ProjectDetailPanel } from '../components/ProjectDetailPanel.ts';

export function ProjectsPage() {
    const { activeWorkspaceId, ui: { openedProjectId } } = state;
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) return '';

    const usage = getUsage(activeWorkspace.id);
    const planLimits = PLANS[activeWorkspace.subscription.planId];
    const canCreateProject = usage.projects < planLimits.projects;
    const isAllowedToCreate = can('create_projects');
    
    const projects = state.projects.filter(p => {
        if (p.workspaceId !== state.activeWorkspaceId) return false;
        if (p.privacy === 'public') return true;
        return state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === state.currentUser?.id);
    });
    
    const today = new Date().toISOString().slice(0, 10);

    const projectCardsHtml = projects.length > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            ${projects.map(project => {
                const client = state.clients.find(c => c.id === project.clientId);
                const tasks = state.tasks.filter(t => t.projectId === project.id);
                const completedTasks = tasks.filter(t => t.status === 'done').length;
                const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
                const members = state.projectMembers.filter(pm => pm.projectId === project.id);
                const memberUsers = members.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);
                const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;

                const description = (project.wikiContent?.split('\n')[0] || '').substring(0, 150);

                let projectStatus = 'not_started';
                let projectStatusText = 'Not Started';
                if (tasks.length > 0) {
                    const totalTasks = tasks.length;
                    const doneTasksCount = tasks.filter(t => t.status === 'done').length;
                    const inProgressTasksCount = tasks.filter(t => t.status === 'inprogress' || t.status === 'inreview').length;
                    
                    if (doneTasksCount === totalTasks) {
                        projectStatus = 'completed';
                        projectStatusText = 'Completed';
                    } else if (inProgressTasksCount > 0 || (doneTasksCount > 0 && doneTasksCount < totalTasks)) {
                        projectStatus = 'in_progress';
                        projectStatusText = 'In Progress';
                    } else {
                        projectStatus = 'not_started';
                        projectStatusText = 'Not Started';
                    }
                }

                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const prioritiesInProject = tasks.map(t => t.priority).filter(Boolean) as ('low'|'medium'|'high')[];
                let projectPriority: 'low'|'medium'|'high' | null = null;
                if (prioritiesInProject.length > 0) {
                    projectPriority = prioritiesInProject.reduce((maxP, currentP) => {
                        return priorityOrder[currentP] > priorityOrder[maxP] ? currentP : maxP;
                    });
                }

                const dueDates = tasks.filter(t => t.dueDate && t.status !== 'done').map(t => new Date(t.dueDate!));
                const latestDueDate = dueDates.length > 0 ? new Date(Math.max.apply(null, dueDates.map(d => d.getTime()))) : null;
                const projectDueDate = latestDueDate ? latestDueDate.toISOString().slice(0, 10) : null;
                
                return `
                    <div class="bg-content p-5 rounded-lg shadow-sm flex flex-col space-y-4 cursor-pointer hover:shadow-md transition-shadow" data-project-id="${project.id}" role="button" tabindex="0" aria-label="View project ${project.name}">
                        <div class="flex justify-between items-start">
                            <h3 class="font-semibold text-lg flex items-center gap-2">
                                ${project.name}
                                ${overdueTasks > 0 ? `<span class="material-icons-sharp text-danger text-base" title="${overdueTasks} overdue tasks">warning_amber</span>` : ''}
                            </h3>
                            <button class="p-1 text-text-subtle rounded-full hover:bg-background project-menu-btn" aria-label="Project actions menu">
                                <span class="material-icons-sharp text-lg">more_horiz</span>
                            </button>
                        </div>

                        ${description ? `<p class="text-sm text-text-subtle">${description}${project.wikiContent && project.wikiContent.length > 150 ? '...' : ''}</p>` : ''}
                        
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-1 text-xs font-medium rounded-full ${projectStatus === 'completed' ? 'bg-green-100 text-green-700' : projectStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">${projectStatusText}</span>
                            ${projectPriority ? `<span class="px-2 py-1 text-xs font-medium rounded-full ${projectPriority === 'high' ? 'bg-red-100 text-red-700' : projectPriority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}">${projectPriority.charAt(0).toUpperCase() + projectPriority.slice(1)}</span>` : ''}
                        </div>

                        <div>
                            <div class="flex justify-between items-center text-sm mb-1">
                                <span class="font-medium text-text-subtle">${t('panels.progress')}</span>
                                <span>${Math.round(progress)}%</span>
                            </div>
                            <div class="w-full bg-background rounded-full h-2">
                                <div class="bg-primary h-2 rounded-full" style="width: ${progress}%;"></div>
                            </div>
                        </div>
                        
                        <div class="flex flex-col gap-2 text-sm text-text-subtle border-t border-border-color pt-4">
                            ${projectDueDate ? `
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">calendar_today</span>
                                <span>Due: ${formatDate(projectDueDate)}</span>
                            </div>` : ''}
                            ${client ? `
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">business</span>
                                <span>${client.name}</span>
                            </div>` : ''}
                            ${project.budgetCost ? `
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">monetization_on</span>
                                <span>Budget: ${formatCurrency(project.budgetCost)}</span>
                            </div>` : ''}
                        </div>

                        <div class="flex justify-between items-center mt-auto pt-4 border-t border-border-color">
                            <div class="flex items-center gap-2 text-sm text-text-subtle">
                                <span class="material-icons-sharp text-base">group</span>
                                <span>${members.length} members</span>
                            </div>
                            <div class="flex -space-x-2">
                                 ${memberUsers.slice(0, 4).map(u => u ? `
                                    <div class="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold border-2 border-content" title="${u.name || u.initials}">
                                        ${u.avatarUrl ? `<img src="${u.avatarUrl}" alt="${u.name || ''}" class="w-full h-full rounded-full object-cover">` : u.initials}
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
    ` : `
        <div class="flex flex-col items-center justify-center h-full bg-content rounded-lg border-2 border-dashed border-border-color">
            <span class="material-icons-sharp text-5xl text-text-subtle">folder_off</span>
            <h3 class="text-lg font-medium mt-4">${t('projects.no_projects_yet')}</h3>
            <p class="text-sm text-text-subtle mt-1">${t('projects.no_projects_desc')}</p>
            <button class="mt-4 px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover projects-page-new-project-btn" data-modal-target="addProject" ${!isAllowedToCreate || !canCreateProject ? 'disabled' : ''}>
                ${t('modals.add_project_title')}
            </button>
        </div>
    `;

    return `
        <div class="master-detail-layout h-full ${openedProjectId ? 'has-detail' : ''}">
            <div class="master-pane">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 class="text-2xl font-bold">${t('sidebar.projects')}</h2>
                    <div class="flex items-center gap-2">
                        <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="aiProjectPlanner" ${!isAllowedToCreate || !canCreateProject ? 'disabled' : ''} title="${!canCreateProject ? t('billing.limit_reached_projects').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                            <span class="material-icons-sharp text-base">auto_awesome</span> ${t('modals.ai_planner_title')}
                        </button>
                        <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover projects-page-new-project-btn" data-modal-target="addProject" ${!isAllowedToCreate || !canCreateProject ? 'disabled' : ''} title="${!canCreateProject ? t('billing.limit_reached_projects').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                            <span class="material-icons-sharp text-base">add</span> ${t('modals.add_project_title')}
                        </button>
                    </div>
                </div>
                <div class="master-pane-list">
                    ${projectCardsHtml}
                </div>
            </div>
            <div class="detail-pane">
                ${openedProjectId ? ProjectDetailPanel({ projectId: openedProjectId }) : `
                    <div class="flex flex-col items-center justify-center h-full text-center p-4">
                        <span class="material-icons-sharp text-5xl text-text-subtle">folder_open</span>
                        <p class="mt-2 text-text-subtle">Select a project to see details</p>
                    </div>
                `}
            </div>
        </div>
    `;
}
