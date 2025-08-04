
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

export function ProjectDetailPanel({ projectId }: { projectId: string }) {
    const state = getState();
    const project = state.projects.find(p => p.id === projectId && p.workspaceId === state.activeWorkspaceId);
    if (!project) return '';

    const { openedProjectTab } = state.ui;
    const projectRole = getUserProjectRole(state.currentUser?.id || '', projectId);
    const canManageProject = projectRole === 'admin';
    const canEditProject = canManageProject || projectRole === 'editor';

    const renderOverviewTab = () => {
        const projectTasks = state.tasks.filter(t => t.projectId === project.id && t.workspaceId === state.activeWorkspaceId);
        const totalTrackedSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
        const today = new Date().toISOString().slice(0, 10);
        const overdueTasksCount = projectTasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;

        const budgetHours = project.budgetHours;
        const totalBudgetSeconds = budgetHours ? budgetHours * 3600 : 0;
        
        const budgetCost = project.budgetCost;
        const actualCost = project.hourlyRate ? (totalTrackedSeconds / 3600) * project.hourlyRate : null;
        const profitability = (budgetCost && actualCost != null) ? budgetCost - actualCost : null;

        const profitabilityClass = profitability === null ? '' : (profitability >= 0 ? 'positive' : 'negative');
        const hasWikiContent = !!project.wikiContent;
        
        return `
            <div class="side-panel-content">
                <div class="project-overview-grid">
                    ${(budgetHours ?? 0) > 0 ? `
                        <div class="kpi-card">
                            <div class="kpi-label">${t('panels.budget_time')}</div>
                            <div class="kpi-value">${formatDuration(totalTrackedSeconds)} / ${formatDuration(totalBudgetSeconds)}</div>
                            <div class="kpi-progress-bar">
                                <div class="kpi-progress-bar-inner" style="width: ${totalBudgetSeconds > 0 ? Math.min((totalTrackedSeconds / totalBudgetSeconds) * 100, 100) : 0}%;"></div>
                            </div>
                        </div>
                    ` : ''}
                     ${(budgetCost ?? 0) > 0 ? `
                        <div class="kpi-card">
                            <div class="kpi-label">${t('panels.budget_cost')}</div>
                            <div class="kpi-value">${formatCurrency(actualCost)} / ${formatCurrency(budgetCost)}</div>
                            <div class="kpi-progress-bar">
                                <div class="kpi-progress-bar-inner cost-bar" style="width: ${(budgetCost && actualCost) ? Math.min((actualCost / budgetCost) * 100, 100) : 0}%;"></div>
                            </div>
                        </div>
                     ` : ''}
                     ${profitability !== null ? `
                        <div class="kpi-card">
                            <div class="kpi-label">${t('panels.profitability')}</div>
                            <div class="kpi-value ${profitabilityClass}">${formatCurrency(profitability)}</div>
                        </div>
                     ` : ''}
                     <div class="kpi-card">
                        <div class="kpi-label">${t('panels.tasks_overdue')}</div>
                        <div class="kpi-value overdue">${overdueTasksCount}</div>
                    </div>
                </div>
                <div class="card" style="margin-top: 1.5rem;">
                    <h4>Project Wiki Preview</h4>
                    <div class="project-wiki-view ${!hasWikiContent ? 'not-prose' : ''}">
                         ${hasWikiContent ? DOMPurify.sanitize(marked.parse(project.wikiContent.substring(0, 500) + (project.wikiContent.length > 500 ? '...' : ''))) : `<p class="subtle-text">${t('panels.wiki_placeholder')}</p>`}
                    </div>
                </div>
            </div>
        `;
    };

    const renderTasksTab = () => {
        const projectTasks = state.tasks.filter(t => t.projectId === project.id && t.workspaceId === state.activeWorkspaceId);

        // Group tasks by status
        const tasksByStatus: Record<string, Task[]> = {
            inprogress: [], inreview: [], todo: [], backlog: [], done: []
        };
        projectTasks.forEach(task => {
            if (tasksByStatus[task.status]) {
                tasksByStatus[task.status].push(task);
            }
        });

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
                    <div class="task-group-list">
                        ${tasks.map(renderTaskRow).join('')}
                    </div>
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
                            <div class="task-group-list">
                                ${doneTasks.map(renderTaskRow).join('')}
                            </div>
                        </details>
                    ` : ''}
                </div>
            </div>
        `;
    };

    const renderWikiTab = () => {
        const { isWikiEditing } = state.ui;
        const hasWikiContent = !!project.wikiContent;

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

        const toolbar = `
            <div class="project-wiki-toolbar">
                <button id="wiki-history-btn" class="btn btn-secondary btn-sm" data-project-id="${project.id}">
                    <span class="material-icons-sharp" style="font-size:1.2rem">history</span>
                    ${t('panels.history')}
                </button>
                <div style="margin-left: auto; display: flex; gap: 0.5rem;">
                    ${isWikiEditing ? editControls : viewControls}
                </div>
            </div>
        `;

        const editorView = `
            <div class="wiki-editor-layout">
                <textarea id="project-wiki-editor" class="form-control project-wiki-editor" aria-label="Project Wiki Editor">${project.wikiContent || ''}</textarea>
                <div id="project-wiki-preview" class="project-wiki-view project-wiki-preview" aria-live="polite">
                     ${project.wikiContent ? DOMPurify.sanitize(marked.parse(project.wikiContent)) : `<p class="subtle-text">Live preview will appear here...</p>`}
                </div>
            </div>
        `;

        const readView = `
            <div id="project-wiki-view" class="project-wiki-view ${!hasWikiContent ? 'not-prose' : ''}" aria-live="polite">
                ${hasWikiContent ? DOMPurify.sanitize(marked.parse(project.wikiContent)) : `<p class="subtle-text">${t('panels.wiki_placeholder')}</p>`}
            </div>
        `;

        return `
            <div class="project-wiki-container">
                ${toolbar}
                ${isWikiEditing ? editorView : readView}
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
                                    <p class="subtle-text">${formatBytes(att.fileSize || 0)} - ${formatDate(att.createdAt)}</p>
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
                <h4>${t('panels.project_access')} (${projectMembers.length})</h4>
                <div class="team-member-list">
                    ${projectMembers.map(pm => {
                        const userName = pm.user!.name || getUserInitials(pm.user);
                        const isSelf = pm.user!.id === state.currentUser?.id;
                        return `
                        <div class="team-member-item">
                            <div class="avatar">${getUserInitials(pm.user)}</div>
                            <div class="member-info">
                                <strong>${userName} ${isSelf ? `<span class="subtle-text">(${t('hr.you')})</span>` : ''}</strong>
                                <p class="subtle-text">${pm.user!.email}</p>
                            </div>
                            <div class="member-actions">
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
            <div class="card" style="margin-top: 1.5rem;">
                <h4>${t('panels.invite_to_project')}</h4>
                <form id="add-project-member-form" data-project-id="${projectId}">
                     <div class="invite-form-grid">
                        <div class="form-group">
                            <label for="project-member-select">${t('hr.member')}</label>
                            <select id="project-member-select" class="form-control" ${workspaceUsersNotInProject.length === 0 ? 'disabled' : ''}>
                                 ${workspaceUsersNotInProject.length > 0
                                    ? workspaceUsersNotInProject.map(user => `<option value="${user!.id}">${user!.name || getUserInitials(user)}</option>`).join('')
                                    : `<option disabled selected>All members are in the project</option>`
                                 }
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="project-role-select">${t('hr.role')}</label>
                            <select id="project-role-select" class="form-control">
                                ${projectRoles.map(r => `<option value="editor" ${r === 'editor' ? 'selected' : ''}>${t(`panels.role_${r}`)}</option>`).join('')}
                            </select>
                        </div>
                     </div>
                     <button type="submit" class="btn btn-primary" ${workspaceUsersNotInProject.length === 0 ? 'disabled' : ''} style="margin-top: 1.5rem;">${t('hr.invite')}</button>
                </form>
            </div>
        </div>
        `;
    };

    const renderOkrsTab = () => {
        const objectives = state.objectives.filter(o => o.projectId === projectId);
        if (objectives.length === 0 && canEditProject) {
            return `<div class="side-panel-content">
                <div class="empty-state">
                    <span class="material-icons-sharp">track_changes</span>
                    <h3>${t('panels.no_okrs_yet')}</h3>
                    <button class="btn btn-primary" data-modal-target="addObjective" data-project-id="${projectId}">${t('modals.add_objective_title')}</button>
                </div>
            </div>`;
        }

        return `<div class="side-panel-content">
            ${canEditProject ? `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 1.5rem;">
                    <button class="btn btn-primary" data-modal-target="addObjective" data-project-id="${projectId}">${t('modals.add_objective_title')}</button>
                </div>
            ` : ''}
            ${objectives.map(obj => {
                const keyResults = state.keyResults.filter(kr => kr.objectiveId === obj.id);
                const progressValues = keyResults.map(kr => {
                    const range = kr.targetValue - kr.startValue;
                    if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
                    return Math.max(0, Math.min(((kr.currentValue - kr.startValue) / range) * 100, 100));
                });
                const overallProgress = progressValues.length > 0 ? progressValues.reduce((a, b) => a + b, 0) / progressValues.length : 0;

                return `
                <div class="okr-card">
                    <div class="okr-objective-header">
                        <div class="okr-objective-icon">
                            <span class="material-icons-sharp">flag</span>
                        </div>
                        <div class="okr-objective-details">
                            <h4>${obj.title}</h4>
                            ${obj.description ? `<p>${obj.description}</p>` : ''}
                        </div>
                        <div class="okr-objective-progress">
                             <div class="kpi-progress-bar">
                                <div class="kpi-progress-bar-inner" style="width: ${overallProgress}%; background-color: var(--success-color);"></div>
                            </div>
                            <div class="progress-percentage">${Math.round(overallProgress)}%</div>
                        </div>
                    </div>

                    <div class="key-results-list">
                        ${keyResults.map(kr => {
                            const range = kr.targetValue - kr.startValue;
                            const progress = range === 0 ? (kr.currentValue >= kr.targetValue ? 100 : 0) : Math.max(0, Math.min(((kr.currentValue - kr.startValue) / range) * 100, 100));
                            const isEditing = (document.querySelector(`.key-result-item[data-kr-id="${kr.id}"]`) as HTMLElement)?.dataset.editing === 'true';
                            const valueSuffix = kr.type === 'percentage' ? '%' : '';

                            return `
                                <div class="key-result-item" data-kr-id="${kr.id}" ${isEditing ? 'data-editing="true"' : ''}>
                                    <p class="kr-title">${kr.title}</p>
                                    <div class="kr-progress">
                                        <div class="kr-progress-bar">
                                            <div class="kr-progress-bar-inner" style="width: ${progress}%;"></div>
                                        </div>
                                        ${isEditing ? `
                                            <form id="update-kr-form" class="kr-current-value-edit" data-kr-id="${kr.id}">
                                                <input type="number" class="form-control" value="${kr.currentValue}" step="any" required>
                                                <button type="submit" class="btn-icon"><span class="material-icons-sharp">check</span></button>
                                            </form>
                                        ` : `
                                            <span class="kr-value" title="Click to update">${kr.currentValue}${valueSuffix}</span>
                                        `}
                                        <span class="kr-progress-text"> / ${kr.targetValue}${valueSuffix}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                     ${canEditProject ? `
                        <button class="btn btn-secondary btn-sm" data-modal-target="addKeyResult" data-objective-id="${obj.id}" style="margin-top: 1rem;">
                            <span class="material-icons-sharp" style="font-size: 1.1rem">add</span>
                            ${t('panels.add_key_result')}
                        </button>
                     ` : ''}
                </div>
            `;
            }).join('')}
        </div>`;
    };

    const renderExpensesTab = () => {
        const expenses = state.expenses.filter(e => e.projectId === projectId);
        return `
            <div class="side-panel-content">
                <div class="card">
                    <div class="flex justify-between items-center mb-4">
                        <h4>${t('modals.expenses')} (${expenses.length})</h4>
                        <button class="btn btn-secondary btn-sm" data-modal-target="addExpense" data-project-id="${projectId}">
                            <span class="material-icons-sharp" style="font-size: 1.2rem;">add</span>
                            ${t('modals.add_expense_title')}
                        </button>
                    </div>
                    <div class="divide-y divide-border-color">
                        ${expenses.length > 0 ? expenses.map(exp => `
                            <div class="flex justify-between items-center py-2">
                                <div>
                                    <p class="font-medium">${exp.description}</p>
                                    <p class="text-xs text-text-subtle">${formatDate(exp.date)}</p>
                                </div>
                                <p class="font-semibold">${formatCurrency(exp.amount)}</p>
                            </div>
                        `).join('') : `<p class="subtle-text">No expenses logged for this project.</p>`}
                    </div>
                </div>
            </div>
        `;
    };

    const renderTagsTab = () => {
        const projectTags = state.projectTags.filter(pt => pt.projectId === project.id).map(pt => state.tags.find(t => t.id === pt.tagId)).filter(Boolean);
        const workspaceTags = state.tags.filter(t => t.workspaceId === state.activeWorkspaceId);
    
        return `
            <div class="side-panel-content">
                <div class="card">
                    <h4>${t('modals.tags')}</h4>
                    <div id="project-tags-selector" class="multiselect-container mt-4" data-entity-type="project" data-entity-id="${project.id}">
                        <div class="multiselect-display">
                            ${projectTags.length > 0 ? projectTags.map(tag => `
                                <div class="selected-tag-item" style="background-color: ${tag!.color}20; border-color: ${tag!.color}80;">
                                    <span>${tag!.name}</span>
                                    <button class="remove-tag-btn" data-tag-id="${tag!.id}">&times;</button>
                                </div>
                            `).join('') : `<span class="subtle-text">No tags</span>`}
                        </div>
                        <div class="multiselect-dropdown hidden">
                            <div class="multiselect-list">
                                ${workspaceTags.map(tag => {
                                    const isSelected = projectTags.some(pt => pt!.id === tag.id);
                                    return `
                                    <label class="multiselect-list-item ${isSelected ? 'bg-primary/10' : ''}">
                                        <input type="checkbox" value="${tag.id}" ${isSelected ? 'checked' : ''}>
                                        <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                                    </label>
                                `}).join('')}
                            </div>
                            <div class="multiselect-add-new">
                                <input type="text" class="form-control" placeholder="Create new tag...">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };


    const client = state.clients.find(c => c.id === project.clientId);
    const tabs = [
        { id: 'overview', text: t('panels.project_overview'), content: renderOverviewTab() },
        { id: 'tasks', text: t('panels.tasks'), content: renderTasksTab() },
        { id: 'wiki', text: t('panels.tab_wiki'), content: renderWikiTab() },
        { id: 'files', text: t('panels.tab_files'), content: renderFilesTab() },
        { id: 'tags', text: t('panels.tab_tags'), content: renderTagsTab() },
        { id: 'expenses', text: t('panels.tab_expenses'), content: renderExpensesTab() },
        { id: 'okrs', text: t('panels.tab_okrs'), content: renderOkrsTab() },
        { id: 'access', text: t('panels.tab_access'), content: renderAccessTab() },
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