import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getUsage, PLANS, formatDate, formatCurrency } from '../utils.ts';
import { can } from '../permissions.ts';

export function ProjectsPage() {
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
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

    return `
    <div>
        <h2>
            <span>${t('projects.title')}</span>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button class="btn btn-secondary" data-modal-target="aiProjectPlanner" ${!isAllowedToCreate || !canCreateProject ? 'disabled' : ''} title="${!canCreateProject ? t('billing.limit_reached_projects').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                    <span class="material-icons-sharp">auto_awesome</span> ${t('projects.plan_with_ai')}
                </button>
                <button class="btn btn-primary projects-page-new-project-btn" data-modal-target="addProject" ${!isAllowedToCreate || !canCreateProject ? 'disabled' : ''} title="${!canCreateProject ? t('billing.limit_reached_projects').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                    <span class="material-icons-sharp">add</span> ${t('projects.new_project')}
                </button>
            </div>
        </h2>
        ${projects.length > 0 ? `
            <div class="project-grid">
                ${projects.map(project => {
                    const client = state.clients.find(c => c.id === project.clientId);
                    const tasks = state.tasks.filter(t => t.projectId === project.id);
                    const completedTasks = tasks.filter(t => t.status === 'done').length;
                    const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
                    const members = state.projectMembers.filter(pm => pm.projectId === project.id);
                    const memberUsers = members.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);
                    const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;

                    // DERIVED DATA FOR NEW CARD LAYOUT
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
                        <div class="project-card clickable" data-project-id="${project.id}" role="button" tabindex="0" aria-label="View project ${project.name}">
                            <div class="project-card-top">
                                <div class="project-title-group">
                                    <h3>${project.name}</h3>
                                    ${overdueTasks > 0 ? `<span class="material-icons-sharp project-alert-icon" title="${overdueTasks} overdue tasks">warning_amber</span>` : ''}
                                </div>
                                <button class="btn-icon project-menu-btn" aria-label="Project actions menu">
                                    <span class="material-icons-sharp">more_horiz</span>
                                </button>
                            </div>

                            ${description ? `<p class="project-card-description">${description}${project.wikiContent && project.wikiContent.length > 150 ? '...' : ''}</p>` : ''}
                            
                            <div class="project-card-tags">
                                <span class="tag-badge status-${projectStatus.replace('_', '-')}">${projectStatusText}</span>
                                ${projectPriority ? `<span class="tag-badge priority-${projectPriority}">${projectPriority.charAt(0).toUpperCase() + projectPriority.slice(1)}</span>` : ''}
                            </div>

                            <div class="project-card-progress-section">
                                <div class="progress-label-group">
                                    <span>${t('panels.progress')}</span>
                                    <span>${Math.round(progress)}%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-bar-inner" style="width: ${progress}%;"></div>
                                </div>
                            </div>
                            
                            <div class="project-card-details">
                                ${projectDueDate ? `
                                <div class="detail-item">
                                    <span class="material-icons-sharp">calendar_today</span>
                                    <span>Due: ${formatDate(projectDueDate)}</span>
                                </div>` : ''}
                                ${client ? `
                                <div class="detail-item">
                                    <span class="material-icons-sharp">business</span>
                                    <span>${client.name}</span>
                                </div>` : ''}
                                ${project.budgetCost ? `
                                <div class="detail-item">
                                    <span class="material-icons-sharp">monetization_on</span>
                                    <span>Budget: ${formatCurrency(project.budgetCost)}</span>
                                </div>` : ''}
                            </div>

                            <div class="project-card-members">
                                <div class="detail-item">
                                    <span class="material-icons-sharp">group</span>
                                    <span>${members.length} members</span>
                                </div>
                                <div class="avatar-stack">
                                     ${memberUsers.slice(0, 4).map(u => u ? `
                                        <div class="avatar" title="${u.name || u.initials}">
                                            ${u.avatarUrl ? `<img src="${u.avatarUrl}" alt="${u.name || ''}">` : u.initials}
                                        </div>
                                    ` : '').join('')}
                                    ${memberUsers.length > 4 ? `
                                        <div class="avatar more-avatar">+${memberUsers.length - 4}</div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `
            <div class="empty-state">
                <span class="material-icons-sharp">folder_off</span>
                <h3>${t('projects.no_projects_yet')}</h3>
                <p>${t('projects.no_projects_desc')}</p>
                <button class="btn btn-primary projects-page-new-project-btn" data-modal-target="addProject" ${!isAllowedToCreate || !canCreateProject ? 'disabled' : ''}>
                    ${t('projects.create_project')}
                </button>
            </div>
        `}
    </div>
    `;
}
