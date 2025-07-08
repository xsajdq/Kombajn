import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getUsage, PLANS } from '../utils.ts';
import { getCurrentUserRole } from '../handlers/main.ts';

export function ProjectsPage() {
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return '';

    const usage = getUsage(activeWorkspace.id);
    const planLimits = PLANS[activeWorkspace.subscription.planId];
    const canCreateProject = usage.projects < planLimits.projects;
    const userRole = getCurrentUserRole();
    const canManage = (userRole === 'owner' || userRole === 'manager') && canCreateProject;
    
    const projects = state.projects.filter(p => {
        if (p.workspaceId !== state.activeWorkspaceId) return false;
        if (p.privacy === 'public') return true;
        // If private, check if current user is a member of that project
        return state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === state.currentUser?.id);
    });
    
    return `
    <div>
        <h2>
            <span>${t('projects.title')}</span>
            <button class="btn btn-primary" data-modal-target="addProject" ${!canManage ? 'disabled' : ''} title="${!canCreateProject ? t('billing.limit_reached_projects').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                <span class="material-icons-sharp">add</span> ${t('projects.new_project')}
            </button>
        </h2>
        ${projects.length > 0 ? `
            <div class="item-grid">
                ${projects.map(project => {
                    const client = state.clients.find(c => c.id === project.clientId);
                    return `
                        <div class="item-card clickable" data-project-id="${project.id}" role="button" tabindex="0" aria-label="View project ${project.name}">
                            <span class="material-icons-sharp">folder</span>
                            <div style="flex-grow: 1;">
                                <strong>${project.name}</strong>
                                <div class="subtle-text">${client ? client.name : t('misc.no_client')}</div>
                            </div>
                            ${project.privacy === 'private' ? `<span class="material-icons-sharp privacy-icon" title="${t('projects.project_is_private')}">lock</span>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `
            <div class="empty-state">
                <span class="material-icons-sharp">folder_off</span>
                <h3>${t('projects.no_projects_yet')}</h3>
                <p>${t('projects.no_projects_desc')}</p>
                <button class="btn btn-primary" data-modal-target="addProject" ${!canManage ? 'disabled' : ''}>
                    ${t('projects.create_project')}
                </button>
            </div>
        `}
    </div>
    `;
}