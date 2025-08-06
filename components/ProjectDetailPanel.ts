
import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate, formatCurrency, getUserInitials } from '../utils.ts';
import type { Task, ProjectRole, Attachment, Objective, KeyResult, Expense } from '../types.ts';
import { getUserProjectRole } from '../handlers/main.ts';
import { can } from '../permissions.ts';

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

function renderOverviewTab(project: any) {
    const state = getState();
    const projectTasks = state.tasks.filter(t => t.projectId === project.id && t.workspaceId === state.activeWorkspaceId);
    const completedTasks = projectTasks.filter(t => t.status === 'done').length;
    const progress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;
    const today = new Date().toISOString().slice(0, 10);
    const overdueTasksCount = projectTasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;
    
    const totalTrackedSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
    
    let budgetLabel = t('misc.not_applicable');
    if (project.budgetHours && project.budgetHours > 0) {
        budgetLabel = `${formatDuration(totalTrackedSeconds)} / ${project.budgetHours}h`;
    } else if (project.budgetCost && project.budgetCost > 0) {
        const actualCost = project.hourlyRate ? (totalTrackedSeconds / 3600) * project.hourlyRate : 0;
        budgetLabel = `${formatCurrency(actualCost)} / ${formatCurrency(project.budgetCost)}`;
    }

    const dueDates = projectTasks.filter(t => t.dueDate && t.status !== 'done').map(t => new Date(t.dueDate!));
    const latestDueDate = dueDates.length > 0 ? new Date(Math.max(...dueDates.map(d => d.getTime()))) : null;

    const members = state.projectMembers.filter(pm => pm.projectId === project.id);
    const memberUsers = members.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);

    const projectTags = state.projectTags.filter(pt => pt.projectId === project.id).map(pt => state.tags.find(t => t.id === pt.tagId)).filter(Boolean);

    const objectives = state.objectives.filter(o => o.projectId === project.id);

    const expenses = state.expenses.filter(e => e.projectId === project.id);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return `
        <div class="side-panel-content">
            <div class="project-overview-dashboard">
                
                <div class="bg-content p-4 rounded-lg shadow-sm project-health-section">
                    <div class="circular-progress-container">
                        <div class="circular-progress-bg"></div>
                        <div class="circular-progress-bar" style="--progress: ${progress}"></div>
                        <div class="circular-progress-text">${Math.round(progress)}%</div>
                    </div>
                    <div class="project-kpi-grid">
                        <div class="kpi-stat">
                            <span class="material-icons-sharp text-danger">warning_amber</span>
                            <div>
                                <div class="kpi-stat-value">${overdueTasksCount}</div>
                                <div class="kpi-stat-label">${t('panels.tasks_overdue')}</div>
                            </div>
                        </div>
                        <div class="kpi-stat">
                            <span class="material-icons-sharp text-primary">event</span>
                            <div>
                                <div class="kpi-stat-value">${latestDueDate ? formatDate(latestDueDate.toISOString()) : t('misc.not_applicable')}</div>
                                <div class="kpi-stat-label">${t('projects.col_due_date')}</div>
                            </div>
                        </div>
                        <div class="kpi-stat">
                            <span class="material-icons-sharp" style="color: #8b5cf6;">account_balance_wallet</span>
                            <div>
                                <div class="kpi-stat-value">${budgetLabel}</div>
                                <div class="kpi-stat-label">${t('projects.col_budget')}</div>
                            </div>
                        </div>
                         <div class="kpi-stat">
                            <span class="material-icons-sharp" style="color: #10b981;">receipt_long</span>
                            <div>
                                <div class="kpi-stat-value">${formatCurrency(totalExpenses)}</div>
                                <div class="kpi-stat-label">${t('modals.expenses')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="bg-content p-4 rounded-lg shadow-sm project-team-section">
                        <h4 class="text-sm font-semibold mb-3">${t('panels.team')} (${memberUsers.length})</h4>
                        <div class="avatar-stack">
                             ${memberUsers.slice(0, 6).map(u => u ? `
                                <div class="avatar" title="${u.name || getUserInitials(u)}">
                                    ${u.avatarUrl ? `<img src="${u.avatarUrl}" alt="${u.name || ''}" class="w-full h-full rounded-full object-cover">` : getUserInitials(u)}
                                </div>
                            ` : '').join('')}
                            ${memberUsers.length > 6 ? `
                                <div class="avatar more-avatar">+${memberUsers.length - 6}</div>
                            ` : ''}
                        </div>
                    </div>
                     <div class="bg-content p-4 rounded-lg shadow-sm">
                        <h4 class="text-sm font-semibold mb-3">${t('modals.tags')}</h4>
                        <div class="flex flex-wrap gap-1.5">
                            ${projectTags.length > 0 ? projectTags.map(tag => `<span class="tag-chip" style="background-color: ${tag!.color}20; border-color: ${tag!.color}">${tag!.name}</span>`).join('') : `<p class="text-xs text-text-subtle">No tags</p>`}
                        </div>
                    </div>
                </div>

                ${objectives.length > 0 ? `
                <div class="bg-content p-4 rounded-lg shadow-sm">
                    <h4 class="text-sm font-semibold mb-3">${t('modals.okrs')}</h4>
                    <div class="space-y-3">
                        ${objectives.map(obj => {
                            const keyResults = state.keyResults.filter(kr => kr.objectiveId === obj.id);
                            const progressValues = keyResults.map(kr => {
                                const range = kr.targetValue - kr.startValue;
                                if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
                                return Math.max(0, Math.min(((kr.currentValue - kr.startValue) / range) * 100, 100));
                            });
                            const overallProgress = progressValues.length > 0 ? progressValues.reduce((a, b) => a + b, 0) / progressValues.length : 0;
                            return `
                                <div class="project-objective-item">
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="font-medium">${obj.title}</span>
                                        <span class="text-text-subtle">${Math.round(overallProgress)}%</span>
                                    </div>
                                    <div class="progress-bar"><div class="progress-bar-inner" style="width: ${overallProgress}%;"></div></div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
};

function renderTasksTab(project: any, canEditProject: boolean) {
    const state = getState();
    const projectTasks = state.tasks.filter(t => t.projectId === project.id && t.workspaceId === state.activeWorkspaceId);

    const tasksByStatus: Record<string, Task[]> = { inprogress: [], inreview: [], todo: [], backlog: [], done: [] };
    projectTasks.forEach(task => { if (tasksByStatus[task.status]) tasksByStatus[task.status].push(task); });

    const renderTaskRow = (task: Task) => {
        const assignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
        const isDone = task.status === 'done';
        const statusIcon = isDone ? 'check_circle' : 'radio_button_unchecked';
        const iconClass = isDone ? 'done' : 'open';

        return `
            <div class="project-task-row clickable" data-task-id="${task.id}" role="button" tabindex="0">
                <button class="btn-icon task-status-toggle" data-task-id="${task.id}" aria-label="Toggle task status">
                    <span class="material-icons-sharp icon-sm ${iconClass}">${statusIcon}</span>
                </button>
                <p class="task-name ${isDone ? 'is-done' : ''}">${task.name}</p>
                <div class="task-meta">
                    ${task.dueDate ? `<span class="task-due-date">${formatDate(task.dueDate, { month: 'short', day: 'numeric' })}</span>` : '<span></span>'}
                    <div class="avatar-stack">
                        ${assignees.slice(0, 2).map(u => u ? `<div class="avatar" title="${u.name || ''}">${getUserInitials(u)}</div>` : '').join('')}
                        ${assignees.length > 2 ? `<div class="avatar more-avatar">+${assignees.length - 2}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    };

    const renderTaskSection = (title: string, tasks: Task[]) => {
        if (tasks.length === 0) return '';
        return `
            <div class="project-task-group">
                <h5 class="task-group-title">${title} (${tasks.length})</h5>
                <div class="task-group-list">${tasks.map(renderTaskRow).join('')}</div>
            </div>
        `;
    };
    
    const inProgressAndReview = [...tasksByStatus.inprogress, ...tasksByStatus.inreview];
    const todoAndBacklog = [...tasksByStatus.todo, ...tasksByStatus.backlog];
    const doneTasks = tasksByStatus.done;

    return `
        <div class="side-panel-content">
            <div class="project-tasks-header">
                <button class="btn btn-secondary btn-sm" data-modal-target="addTask" data-project-id="${project.id}" ${!canEditProject ? 'disabled' : ''}>
                    <span class="material-icons-sharp" style="font-size: 1.2rem;">add</span> ${t('panels.add_task')}
                </button>
            </div>
            <div class="project-tasks-list-modern">
                ${renderTaskSection(t('tasks.inprogress'), inProgressAndReview)}
                ${renderTaskSection(t('tasks.todo'), todoAndBacklog)}
                ${doneTasks.length > 0 ? `
                    <details class="project-task-group-collapsible">
                        <summary class="task-group-title">${t('tasks.done')} (${doneTasks.length})</summary>
                        <div class="task-group-list">${doneTasks.map(renderTaskRow).join('')}</div>
                    </details>
                ` : ''}
            </div>
        </div>
    `;
};

function renderWikiTab(project: any, canEditProject: boolean) {
    const { isWikiEditing } = getState().ui;
    const hasWikiContent = !!project.wikiContent;
    const editControls = `<button id="cancel-wiki-edit-btn" class="btn btn-secondary btn-sm">${t('modals.cancel')}</button><button id="save-wiki-btn" class="btn btn-primary btn-sm">${t('modals.save')}</button>`;
    const viewControls = `<button id="edit-wiki-btn" class="btn btn-secondary btn-sm" ${!canEditProject ? 'disabled' : ''}><span class="material-icons-sharp" style="font-size:1.2rem">edit</span> ${t('misc.edit')}</button>`;
    const toolbar = `<div class="project-wiki-toolbar"><button id="wiki-history-btn" class="btn btn-secondary btn-sm" data-project-id="${project.id}"><span class="material-icons-sharp" style="font-size:1.2rem">history</span> ${t('panels.history')}</button><div style="margin-left: auto; display: flex; gap: 0.5rem;">${isWikiEditing ? editControls : viewControls}</div></div>`;
    const editorView = `<div class="wiki-editor-layout"><textarea id="project-wiki-editor" class="form-control project-wiki-editor" aria-label="Project Wiki Editor">${project.wikiContent || ''}</textarea><div id="project-wiki-preview" class="project-wiki-view project-wiki-preview" aria-live="polite">${project.wikiContent ? DOMPurify.sanitize(marked.parse(project.wikiContent)) : `<p class="subtle-text">Live preview will appear here...</p>`}</div></div>`;
    const readView = `<div id="project-wiki-view" class="project-wiki-view ${!hasWikiContent ? 'not-prose' : ''}" aria-live="polite">${hasWikiContent ? DOMPurify.sanitize(marked.parse(project.wikiContent)) : `<p class="subtle-text">${t('panels.wiki_placeholder')}</p>`}</div>`;
    return `<div class="project-wiki-container">${toolbar}${isWikiEditing ? editorView : readView}<p id="wiki-save-status" class="subtle-text" style="text-align: right; margin-top: 0.5rem; height: 1em;" aria-live="polite"></p></div>`;
};

function renderFilesTab(project: any, canEditProject: boolean) {
    const files = getState().attachments.filter(a => a.projectId === project.id);
    return `
        <div class="side-panel-content">
            <div class="bg-content p-4 rounded-lg shadow-sm">
                <div class="project-files-header">
                    <h4>${t('panels.tab_files')} (${files.length})</h4>
                    <label for="project-file-upload" class="btn btn-secondary btn-sm ${!canEditProject ? 'disabled' : ''}"><span class="material-icons-sharp" style="font-size: 1.2rem;">upload_file</span> ${t('panels.upload_file')}</label>
                    <input type="file" id="project-file-upload" class="hidden" data-project-id="${project.id}" ${!canEditProject ? 'disabled' : ''}>
                </div>
                 <ul class="attachment-list">
                    ${files.length > 0 ? files.map(att => `
                        <li class="attachment-item">
                            <span class="material-icons-sharp">description</span>
                            <div class="attachment-info"><strong>${att.fileName}</strong><p class="subtle-text">${formatBytes(att.fileSize || 0)} - ${formatDate(att.createdAt)}</p></div>
                            <button class="btn-icon delete-attachment-btn" data-attachment-id="${att.id}" aria-label="${t('modals.remove_item')} ${att.fileName}"><span class="material-icons-sharp" style="color: var(--danger-color)">delete</span></button>
                        </li>
                    `).join('') : `<p class="subtle-text">${t('panels.no_files')}</p>`}
                </ul>
            </div>
        </div>
    `;
};

function renderAccessTab(project: any, canManageProject: boolean) {
    if (!canManageProject) {
       return `<div class="side-panel-content"><p>${t('hr.access_denied_desc')}</p></div>`;
    }
    const state = getState();
    const projectMembers = state.projectMembers.filter(pm => pm.projectId === project.id).map(pm => ({ ...pm, user: state.users.find(u => u.id === pm.userId) })).filter(pm => pm.user);
    const workspaceUsersNotInProject = state.workspaceMembers.filter(wm => wm.workspaceId === state.activeWorkspaceId && !projectMembers.some(pm => pm.userId === wm.userId)).map(wm => state.users.find(u => u.id === wm.userId)).filter(Boolean);
    const projectRoles: ProjectRole[] = ['admin', 'editor', 'commenter', 'viewer'];
    return `
       <div class="side-panel-content space-y-6">
           <div class="bg-content p-4 rounded-lg shadow-sm">
               <h4 class="text-sm font-semibold mb-3">${t('panels.project_access')} (${projectMembers.length})</h4>
               <div class="access-member-list">
                   ${projectMembers.map(pm => {
                       const userName = pm.user!.name || getUserInitials(pm.user);
                       const isSelf = pm.user!.id === state.currentUser?.id;
                       return `
                       <div class="access-member-item">
                            <div class="avatar">${getUserInitials(pm.user)}</div>
                           <div class="access-member-info">
                               <strong>${userName} ${isSelf ? `<span class="subtle-text">(${t('hr.you')})</span>` : ''}</strong>
                               <p class="text-xs text-text-subtle">${pm.user!.email}</p>
                           </div>
                           <div class="access-member-actions">
                               <select class="form-control" data-project-member-id="${pm.id}" ${isSelf ? 'disabled' : ''} aria-label="Change role for ${userName}">
                                   ${projectRoles.map(r => `<option value="${r}" ${pm.role === r ? 'selected' : ''}>${t(`panels.role_${r}`)}</option>`).join('')}
                               </select>
                               <button class="btn-icon" data-remove-project-member-id="${pm.id}" aria-label="${t('hr.remove')} ${userName}" ${isSelf ? 'disabled' : ''}>
                                   <span class="material-icons-sharp danger-icon">person_remove</span>
                               </button>
                           </div>
                       </div>`}).join('')}
               </div>
           </div>
           <div class="bg-content p-4 rounded-lg shadow-sm">
               <h4 class="text-sm font-semibold mb-3">${t('panels.invite_to_project')}</h4>
               <form id="add-project-member-form" data-project-id="${project.id}" class="access-invite-form">
                   <select id="project-member-select" class="form-control" ${workspaceUsersNotInProject.length === 0 ? 'disabled' : ''}>
                        ${workspaceUsersNotInProject.length > 0
                           ? `<option value="">${t('modals.select_a_client')}</option>` + workspaceUsersNotInProject.map(user => `<option value="${user!.id}">${user!.name || getUserInitials(user)}</option>`).join('')
                           : `<option disabled selected>All members are in the project</option>`
                        }
                   </select>
                   <select id="project-role-select" class="form-control">
                       ${projectRoles.map(r => `<option value="${r}" ${r === 'editor' ? 'selected' : ''}>${t(`panels.role_${r}`)}</option>`).join('')}
                   </select>
                    <button type="submit" class="btn btn-primary" ${workspaceUsersNotInProject.length === 0 ? 'disabled' : ''}>${t('hr.invite')}</button>
               </form>
           </div>
       </div>
       `;
};

export function ProjectDetailPanel({ projectId }: { projectId: string }) {
    const state = getState();
    const project = state.projects.find(p => p.id === projectId && p.workspaceId === state.activeWorkspaceId);
    if (!project) return '';

    const { openedProjectTab } = state.ui;
    const projectRole = getUserProjectRole(state.currentUser?.id || '', projectId);
    const canManageProject = projectRole === 'admin';
    const canEditProject = canManageProject || projectRole === 'editor';
    const client = state.clients.find(c => c.id === project.clientId);

    const tabs = [
        { id: 'overview', text: t('panels.project_overview'), content: renderOverviewTab(project) },
        { id: 'tasks', text: t('panels.tasks'), content: renderTasksTab(project, canEditProject) },
        { id: 'wiki', text: t('panels.tab_wiki'), content: renderWikiTab(project, canEditProject) },
        { id: 'files', text: t('panels.tab_files'), content: renderFilesTab(project, canEditProject) },
        { id: 'access', text: t('panels.tab_access'), content: renderAccessTab(project, canManageProject) },
    ];
    
    return `
        <div class="side-panel" role="region" aria-label="Project Details Panel">
            <div class="side-panel-header">
                <div>
                    <h2>${project.name}</h2>
                    <p class="subtle-text" style="display:flex; align-items:center; gap: 0.5rem;">
                        <span class="material-icons-sharp icon-sm">business</span>
                        ${client?.name || t('misc.no_client')}
                    </p>
                </div>
                <div class="flex items-center gap-2">
                     <div class="relative">
                        <button class="btn-icon" data-menu-toggle="project-actions-${project.id}" aria-haspopup="true" aria-expanded="false" title="Project Actions">
                            <span class="material-icons-sharp">more_vert</span>
                        </button>
                        <div id="project-actions-${project.id}" class="dropdown-menu absolute top-full right-0 mt-1 w-48 bg-content rounded-md shadow-lg border border-border-color z-10 hidden">
                            <div class="py-1">
                                <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-modal-target="addProject" data-project-id="${project.id}">
                                    <span class="material-icons-sharp text-base">edit</span>
                                    ${t('misc.edit')}
                                </button>
                                <button id="save-as-template-btn" class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-project-id="${project.id}">
                                    <span class="material-icons-sharp text-base">content_copy</span> ${t('panels.save_as_template')}
                                </button>
                                <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger/10" data-delete-resource="projects" data-delete-id="${project.id}" data-delete-confirm="Are you sure you want to delete this project and all its tasks? This is irreversible.">
                                    <span class="material-icons-sharp text-base">delete</span>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                    <button class="btn-icon btn-close-panel" aria-label="${t('panels.close')}">
                        <span class="material-icons-sharp">close</span>
                    </button>
                </div>
            </div>
            <nav class="side-panel-tabs" role="tablist" aria-label="Project sections">
                ${tabs.map(tab => `
                    <button class="side-panel-tab ${openedProjectTab === tab.id ? 'active' : ''}" data-tab-group="ui.openedProjectTab" data-tab-value="${tab.id}" role="tab" aria-selected="${openedProjectTab === tab.id}">
                        ${tab.text}
                    </button>
                `).join('')}
            </nav>
            ${tabs.find(t => t.id === openedProjectTab)?.content || ''}
        </div>
    `;
}
