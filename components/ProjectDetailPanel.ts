import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import type { Task, ProjectRole, Attachment } from '../types.ts';
import { getCurrentUserRole, getUserProjectRole } from '../handlers/main.ts';

declare const marked: any;
declare const DOMPurify: any;

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function ProjectDetailPanel({ projectId }: { projectId: string }) {
    const project = state.projects.find(p => p.id === projectId && p.workspaceId === state.activeWorkspaceId);
    if (!project) return '';

    const client = state.clients.find(c => c.id === project.clientId && c.workspaceId === state.activeWorkspaceId);
    const projectTasks = state.tasks.filter(t => t.projectId === project.id && t.workspaceId === state.activeWorkspaceId);
    const totalTrackedSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
    const { openedProjectTab } = state.ui;
    
    const userRole = getCurrentUserRole();
    const projectRole = getUserProjectRole(state.currentUser?.id || '', projectId);
    const canManageProject = projectRole === 'admin';
    const canEditProject = canManageProject || projectRole === 'editor';
    

    const renderTasksTab = () => {
        const tasksByStatus = {
            backlog: projectTasks.filter(t => t.status === 'backlog'),
            todo: projectTasks.filter(t => t.status === 'todo'),
            inprogress: projectTasks.filter(t => t.status === 'inprogress'),
            inreview: projectTasks.filter(t => t.status === 'inreview'),
            done: projectTasks.filter(t => t.status === 'done'),
        };

        const renderTaskList = (tasks: Task[], title: string) => `
            <div class="project-task-group">
                <h5>${title} (${tasks.length})</h5>
                ${tasks.length > 0 ? `
                    <ul class="task-list-panel">
                        ${tasks.map(task => {
                            const isRunning = !!state.activeTimers[task.id];
                            return `
                            <li class="task-item-panel clickable" data-task-id="${task.id}" role="button" tabindex="0" aria-label="View task ${task.name}">
                                <div class="task-details">
                                    <span>${task.name}</span>
                                </div>
                                 <div class="task-actions">
                                    <span class="task-tracked-time">${formatDuration(getTaskCurrentTrackedSeconds(task))}</span>
                                    <button class="btn-icon timer-controls ${isRunning ? 'running' : ''}" data-timer-task-id="${task.id}" aria-label="${isRunning ? t('tasks.stop_timer') : t('tasks.start_timer')}">
                                        <span class="material-icons-sharp">${isRunning ? 'pause_circle_filled' : 'play_circle_filled'}</span>
                                    </button>
                                </div>
                            </li>
                        `}).join('')}
                    </ul>
                ` : `<p class="empty-task-list">${t('panels.no_tasks_in_stage')}</p>`}
            </div>
        `;

        return `
            <div class="side-panel-content">
                <div class="card">
                    <h4>${t('panels.project_overview')}</h4>
                    <div class="project-stats">
                        <div>
                            <span class="stat-label">${t('panels.total_time_tracked')}</span>
                            <span class="stat-value project-total-time">${formatDuration(totalTrackedSeconds)}</span>
                        </div>
                        <div>
                            <span class="stat-label">${t('panels.tasks')}</span>
                            <span class="stat-value">${projectTasks.length}</span>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <h4>${t('panels.client_info')}</h4>
                    ${client ? `<p>${client.name}</p>` : `<p>${t('panels.client_not_found')}</p>`}
                </div>
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4>${t('panels.tasks')}</h4>
                        <button class="btn btn-secondary btn-sm" data-modal-target="addTask" data-project-id="${project.id}" ${!canEditProject ? 'disabled' : ''}>
                            <span class="material-icons-sharp" style="font-size: 1.2rem;">add</span> ${t('panels.add_task')}
                        </button>
                    </div>
                    ${renderTaskList(tasksByStatus.inprogress, t('tasks.inprogress'))}
                    ${renderTaskList(tasksByStatus.inreview, t('tasks.inreview'))}
                    ${renderTaskList(tasksByStatus.todo, t('tasks.todo'))}
                    ${renderTaskList(tasksByStatus.backlog, t('tasks.backlog'))}
                    ${renderTaskList(tasksByStatus.done, t('tasks.done'))}
                </div>
            </div>`;
    };

    const renderWikiTab = () => {
        const { isWikiEditing } = state.ui;

        const editControls = `
            <button id="cancel-wiki-edit-btn" class="btn btn-secondary btn-sm">${t('modals.cancel')}</button>
            <button id="save-wiki-btn" class="btn btn-primary btn-sm">${t('modals.save')}</button>
        `;

        const viewControls = `
            <button id="edit-wiki-btn" class="btn btn-secondary btn-sm" ${!canEditProject ? 'disabled' : ''}>
                <span class="material-icons-sharp" style="font-size:1.2rem">edit</span>
                ${t('misc.edit')}
            </button>
        `;

        return `
        <div class="project-wiki-container">
            <div style="display: flex; justify-content: flex-end; align-items:center; gap: 0.5rem; margin-bottom: 1rem;">
                <button id="wiki-history-btn" class="btn btn-secondary btn-sm" data-project-id="${project.id}">
                    <span class="material-icons-sharp" style="font-size:1.2rem">history</span>
                    ${t('panels.history')}
                </button>
                ${isWikiEditing ? editControls : viewControls}
            </div>
            ${isWikiEditing 
                ? `<textarea id="project-wiki-editor" class="form-control project-wiki-editor" aria-label="Project Wiki Editor">${project.wikiContent || ''}</textarea>`
                : `<div id="project-wiki-view" class="project-wiki-view" aria-live="polite">
                        ${project.wikiContent ? DOMPurify.sanitize(marked.parse(project.wikiContent)) : `<p class="subtle-text">${t('panels.wiki_placeholder')}</p>`}
                   </div>`
            }
            <p id="wiki-save-status" class="subtle-text" style="text-align: right; margin-top: 0.5rem; height: 1em;" aria-live="polite"></p>
        </div>`;
    };
    
    const renderFilesTab = () => {
        const files = state.attachments.filter(a => a.projectId === projectId);
        return `
            <div class="side-panel-content">
                <div class="card">
                    <div class="project-files-header">
                        <h4>${t('panels.tab_files')} (${files.length})</h4>
                        <label for="project-file-upload" class="btn btn-secondary btn-sm ${!canEditProject ? 'disabled' : ''}">
                           <span class="material-icons-sharp" style="font-size: 1.2rem;">upload_file</span>
                           ${t('panels.upload_file')}
                        </label>
                        <input type="file" id="project-file-upload" class="hidden" data-project-id="${projectId}" ${!canEditProject ? 'disabled' : ''}>
                    </div>
                     <ul class="attachment-list">
                        ${files.length > 0 ? files.map(att => `
                            <li class="attachment-item">
                                <span class="material-icons-sharp">description</span>
                                <div class="attachment-info">
                                    <strong>${att.fileName}</strong>
                                    <p class="subtle-text">${formatBytes(att.fileSize)} - ${formatDate(att.createdAt)}</p>
                                </div>
                                <button class="btn-icon delete-attachment-btn" data-attachment-id="${att.id}" aria-label="${t('modals.remove_item')} ${att.fileName}">
                                    <span class="material-icons-sharp" style="color: var(--danger-color)">delete</span>
                                </button>
                            </li>
                        `).join('') : `<p class="subtle-text">${t('panels.no_files')}</p>`}
                    </ul>
                </div>
            </div>
        `;
    };

    const renderAccessTab = () => {
        if (!canManageProject) {
            return `<div class="side-panel-content"><p>${t('hr.access_denied_desc')}</p></div>`;
        }

        const projectMembers = state.projectMembers
            .filter(pm => pm.projectId === projectId)
            .map(pm => ({ ...pm, user: state.users.find(u => u.id === pm.userId) }))
            .filter(pm => pm.user);

        const workspaceUsersNotInProject = state.workspaceMembers
            .filter(wm => wm.workspaceId === state.activeWorkspaceId && !projectMembers.some(pm => pm.userId === wm.userId))
            .map(wm => state.users.find(u => u.id === wm.userId))
            .filter(Boolean);

        const projectRoles: ProjectRole[] = ['admin', 'editor', 'commenter', 'viewer'];

        return `
        <div class="side-panel-content">
            <div class="card">
                <h4>${t('panels.project_access')}</h4>
                <div class="team-member-list">
                    ${projectMembers.map(pm => `
                        <div class="team-member-item">
                            <div class="avatar">${pm.user!.initials}</div>
                            <div class="member-info">
                                <strong>${pm.user!.name} ${pm.user!.id === state.currentUser?.id ? `(${t('hr.you')})` : ''}</strong>
                                <p>${pm.user!.email}</p>
                            </div>
                            <div class="member-actions">
                                <select class="form-control" data-project-member-id="${pm.id}" ${pm.user!.id === state.currentUser?.id ? 'disabled' : ''} aria-label="Change role for ${pm.user!.name}">
                                    ${projectRoles.map(r => `<option value="${r}" ${pm.role === r ? 'selected' : ''}>${t(`panels.role_${r}`)}</option>`).join('')}
                                </select>
                                <button class="btn-icon" data-remove-project-member-id="${pm.id}" aria-label="${t('hr.remove')} ${pm.user!.name}" ${pm.user!.id === state.currentUser?.id ? 'disabled' : ''}>
                                    <span class="material-icons-sharp" style="color: var(--danger-color);">person_remove</span>
                                </button>
                            </div>
                        </div>`).join('')}
                </div>
            </div>
            <div class="card">
                <h4>${t('panels.invite_to_project')}</h4>
                <form id="add-project-member-form" data-project-id="${projectId}">
                     <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="project-member-select">${t('hr.member')}</label>
                        <select id="project-member-select" class="form-control" ${workspaceUsersNotInProject.length === 0 ? 'disabled' : ''}>
                            ${workspaceUsersNotInProject.map(user => `<option value="${user!.id}">${user!.name}</option>`).join('')}
                        </select>
                     </div>
                     <div class="form-group" style="margin-bottom: 1rem;">
                        <label for="project-role-select">${t('hr.role')}</label>
                        <select id="project-role-select" class="form-control">
                            ${projectRoles.map(r => `<option value="${r}">${t(`panels.role_${r}`)}</option>`).join('')}
                        </select>
                     </div>
                     <button type="submit" class="btn btn-primary" ${workspaceUsersNotInProject.length === 0 ? 'disabled' : ''}>${t('hr.invite')}</button>
                </form>
            </div>
        </div>
        `;
    };

    
    let tabContent = '';
    switch(openedProjectTab) {
        case 'tasks': tabContent = renderTasksTab(); break;
        case 'wiki': tabContent = renderWikiTab(); break;
        case 'files': tabContent = renderFilesTab(); break;
        case 'access': tabContent = renderAccessTab(); break;
    }

    return `
        <div class="side-panel" role="region" aria-label="Project Details Panel">
            <div class="side-panel-header">
                <h2>${project.name}</h2>
                <div class="project-header-menu-container">
                    <button class="btn-icon" id="project-menu-toggle" aria-label="Project actions menu">
                        <span class="material-icons-sharp">more_vert</span>
                    </button>
                    <div class="project-header-menu hidden">
                        <div class="command-item" id="save-as-template-btn" data-project-id="${project.id}" role="button" tabindex="0">
                             <span class="material-icons-sharp command-icon">content_copy</span>
                             <span>${t('panels.save_as_template')}</span>
                        </div>
                    </div>
                </div>
                <button class="btn-icon btn-close-panel" aria-label="${t('panels.close')}">
                    <span class="material-icons-sharp">close</span>
                </button>
            </div>
            <div class="side-panel-tabs" role="tablist" aria-label="Project sections">
                <div class="side-panel-tab ${openedProjectTab === 'tasks' ? 'active' : ''}" data-tab="tasks" role="tab" aria-selected="${openedProjectTab === 'tasks'}">${t('panels.tab_tasks')}</div>
                <div class="side-panel-tab ${openedProjectTab === 'wiki' ? 'active' : ''}" data-tab="wiki" role="tab" aria-selected="${openedProjectTab === 'wiki'}">${t('panels.tab_wiki')}</div>
                <div class="side-panel-tab ${openedProjectTab === 'files' ? 'active' : ''}" data-tab="files" role="tab" aria-selected="${openedProjectTab === 'files'}">${t('panels.tab_files')}</div>
                ${project.privacy === 'private' ? `<div class="side-panel-tab ${openedProjectTab === 'access' ? 'active' : ''}" data-tab="access" role="tab" aria-selected="${openedProjectTab === 'access'}">${t('panels.tab_access')}</div>` : ''}
            </div>
            ${tabContent}
        </div>
    `;
}