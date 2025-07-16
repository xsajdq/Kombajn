


import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getUsage, PLANS } from '../utils.ts';
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

                    return `
                        <div class="project-card clickable" data-project-id="${project.id}" role="button" tabindex="0" aria-label="View project ${project.name}">
                            <div class="project-card-header">
                                <h3>${project.name}</h3>
                                <p class="subtle-text">${client?.name || t('misc.no_client')}</p>
                            </div>
                            <div class="project-card-progress">
                                <div class="progress-bar">
                                    <div class="progress-bar-inner" style="width: ${progress}%;"></div>
                                </div>
                                <span class="progress-text">${Math.round(progress)}%</span>
                            </div>
                            <div class="project-card-footer">
                                <div class="project-card-stats">
                                    <div class="stat-item" title="${t('projects.members')}">
                                        <span class="material-icons-sharp icon-sm">group</span>
                                        <span>${members.length}</span>
                                    </div>
                                    ${overdueTasks > 0 ? `
                                        <div class="stat-item overdue" title="${t('projects.overdue_tasks')}">
                                            <span class="material-icons-sharp icon-sm">error_outline</span>
                                            <span>${overdueTasks}</span>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="avatar-stack">
                                    ${memberUsers.slice(0, 3).map(u => u ? `
                                        <div class="avatar" title="${u.name || u.initials}">
                                            ${u.avatarUrl ? `<img src="${u.avatarUrl}" alt="${u.name || ''}">` : u.initials}
                                        </div>
                                    ` : '').join('')}
                                    ${memberUsers.length > 3 ? `
                                        <div class="avatar more-avatar">+${memberUsers.length - 3}</div>
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