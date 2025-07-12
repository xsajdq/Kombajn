



import { state } from '../../state.ts';
import { t } from '../../i18n.ts';
import { formatDuration, formatDate } from '../../utils.ts';
import { can } from '../../permissions.ts';
import type { Task, CustomFieldValue, CustomFieldDefinition, User, Attachment } from '../../types.ts';

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderActivityTab(task: Task) {
    const comments = state.comments.filter(c => c.taskId === task.id);
    const timeLogs = state.timeLogs.filter(tl => tl.taskId === task.id);

    const activityItems = [...comments, ...timeLogs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const renderActivityBody = (content: string) => {
        const mentionRegex = /@\[([^\]]+)\]\(user:([a-fA-F0-9-]+)\)/g;
        const html = content.replace(mentionRegex, `<strong class="mention-chip">@$1</strong>`);
        return `<p>${html}</p>`;
    };
    
    return `
        <div class="task-detail-section">
            <div class="task-detail-section-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                <h4 style="margin:0">${t('modals.activity')}</h4>
                <button class="btn btn-secondary btn-sm" data-modal-target="addManualTimeLog" data-task-id="${task.id}">
                    <span class="material-icons-sharp" style="font-size: 1.2rem">add_alarm</span>
                    ${t('modals.add_time_log_button')}
                </button>
            </div>
        </div>
        <div class="activity-feed">
            ${activityItems.length > 0 ? activityItems.map(item => {
                const user = state.users.find(u => u.id === item.userId);
                const userName = user?.name || user?.initials || 'User';
                if ('content' in item) { // It's a Comment
                    return `
                        <div class="activity-item">
                            <div class="avatar">${user?.initials || '?'}</div>
                            <div class="activity-content">
                                <div class="activity-header">
                                    <strong>${userName}</strong>
                                    <span class="activity-time">${formatDate(item.createdAt, {hour: 'numeric', minute: 'numeric'})}</span>
                                </div>
                                <div class="activity-body">
                                    ${renderActivityBody(item.content)}
                                </div>
                            </div>
                        </div>
                    `;
                } else { // It's a TimeLog
                     return `
                        <div class="activity-item">
                            <div class="avatar">${user?.initials || '?'}</div>
                            <div class="activity-content">
                                <div class="activity-header">
                                    <strong>${userName}</strong>
                                    <span>${t('misc.logged')} <strong>${formatDuration(item.trackedSeconds)}</strong></span>
                                    <span class="activity-time">${formatDate(item.createdAt, {hour: 'numeric', minute: 'numeric'})}</span>
                                </div>
                                ${item.comment ? `
                                <div class="activity-body">
                                    <p class="timelog-comment">${item.comment}</p>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
            }).join('') : `<p class="subtle-text">${t('modals.no_activity')}</p>`}
        </div>
        <form id="add-comment-form" class="add-comment-form">
            <div class="rich-text-input-container">
                <div
                    id="task-comment-input"
                    class="rich-text-input"
                    contenteditable="true"
                    role="textbox"
                    aria-multiline="true"
                    data-placeholder="${t('modals.add_comment')}"
                ></div>
            </div>
            <button type="submit" id="submit-comment-btn" class="btn btn-primary">${t('modals.comment_button')}</button>
        </form>
    `;
}

function renderSubtasksTab(task: Task) {
    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    return `
        <div class="task-detail-section">
            <form id="add-subtask-form" class="add-subtask-form" data-parent-task-id="${task.id}">
                <input type="text" class="form-control" placeholder="${t('modals.add_subtask')}" required>
            </form>
            <ul class="subtask-list">
            ${subtasks.map(st => `
                <li class="subtask-item ${st.status === 'done' ? 'done' : ''}">
                    <input type="checkbox" class="form-control subtask-checkbox" data-subtask-id="${st.id}" ${st.status === 'done' ? 'checked' : ''} style="width: auto;">
                    <span class="subtask-name">${st.name}</span>
                    <button class="btn-icon delete-subtask-btn" data-subtask-id="${st.id}" title="${t('modals.remove_item')}">
                        <span class="material-icons-sharp">delete_outline</span>
                    </button>
                </li>
            `).join('')}
            </ul>
        </div>
    `;
}

function renderDependenciesTab(task: Task) {
    const dependencies = state.dependencies.filter(d => d.blockedTaskId === task.id || d.blockingTaskId === task.id);
    const blockingTasks = dependencies.filter(d => d.blockedTaskId === task.id).map(d => state.tasks.find(t => t.id === d.blockingTaskId));
    const blockedTasks = dependencies.filter(d => d.blockingTaskId === task.id).map(d => state.tasks.find(t => t.id === d.blockedTaskId));
    const allProjectTasks = state.tasks.filter(t => t.projectId === task.projectId && t.id !== task.id);

    return `
         <div class="task-detail-section">
            <strong>${t('modals.blocked_by')}:</strong>
            <ul class="dependency-list">
                ${blockingTasks.map(blockingTask => {
                    if (!blockingTask) return '';
                    const dep = dependencies.find(d => d.blockingTaskId === blockingTask.id && d.blockedTaskId === task.id);
                    return `<li class="dependency-item">
                                <span class="dependency-name">${blockingTask.name}</span>
                                <button class="btn-icon delete-dependency-btn" data-dependency-id="${dep!.id}" title="${t('modals.remove_item')}"><span class="material-icons-sharp">link_off</span></button>
                             </li>`;
                }).join('') || `<p class="subtle-text">None</p>`}
            </ul>
            <strong style="margin-top: 1rem; display: block;">${t('modals.blocking')}:</strong>
            <ul class="dependency-list">
                ${blockedTasks.map(blockedTaskItem => {
                     if (!blockedTaskItem) return '';
                    const dep = dependencies.find(d => d.blockedTaskId === blockedTaskItem.id && d.blockingTaskId === task.id);
                    return `<li class="dependency-item">
                                    <span class="dependency-name">${blockedTaskItem.name}</span>
                                    <button class="btn-icon delete-dependency-btn" data-dependency-id="${dep!.id}" title="${t('modals.remove_item')}"><span class="material-icons-sharp">link_off</span></button>
                                 </li>`;
                }).join('') || `<p class="subtle-text">None</p>`}
            </ul>
            <form id="add-dependency-form" class="add-dependency-form" data-blocked-task-id="${task.id}" style="margin-top: 1rem;">
                <select class="form-control">
                    <option value="">${t('modals.select_task')}</option>
                    ${allProjectTasks.map(taskItem => `<option value="${taskItem.id}">${taskItem.name}</option>`).join('')}
                </select>
                <button type="submit" class="btn btn-secondary btn-sm">${t('modals.add_dependency')}</button>
            </form>
        </div>
    `;
}

function renderAttachmentsTab(task: Task) {
    const attachments = state.attachments.filter(a => a.taskId === task.id);
    const canManage = can('manage_tasks');
    const googleDriveIntegration = state.integrations.find(i => i.provider === 'google_drive' && i.isActive && i.workspaceId === task.workspaceId);

    return `
        <div class="task-detail-section">
            <div class="attachment-controls">
                <label for="attachment-file-input" class="btn btn-secondary btn-sm" ${!canManage ? 'disabled' : ''}>
                    <span class="material-icons-sharp" style="font-size: 1.2rem;">add</span>
                    ${t('modals.add_attachment')}
                </label>
                <input type="file" id="attachment-file-input" class="hidden" data-task-id="${task.id}">
                 <button id="attach-google-drive-btn" class="btn btn-secondary btn-sm" data-task-id="${task.id}" ${!googleDriveIntegration ? 'disabled' : ''} title="${!googleDriveIntegration ? 'Connect Google Drive in Settings' : ''}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 0.5rem;"><path d="M19.46 8.19L12.02 16.32L9.24 13.31L14.77 7.14H9.42V5H17.77V13.79H15.77V8.54L10.39 14.56L12.02 16.32L21.46 6.19L19.46 8.19Z"></path><path d="M8.28,11.47,4.8,15.24h14.4l-3.05-4.07-2.6,3.47-3.87-5.16Z"></path></svg>
                    ${t('modals.attach_from_drive')}
                </button>
            </div>
            <ul class="attachment-list">
            ${attachments.map(att => {
                if (att.provider === 'google_drive') {
                    return `
                        <li class="attachment-item">
                            <img src="${att.iconUrl}" class="attachment-icon-external" alt="Google Drive file">
                            <div class="attachment-info">
                                <a href="${att.externalUrl}" target="_blank" rel="noopener noreferrer"><strong>${att.fileName}</strong></a>
                                <p class="subtle-text">Google Drive</p>
                            </div>
                            <button class="btn-icon delete-attachment-btn" data-attachment-id="${att.id}" title="${t('modals.remove_item')}">
                                <span class="material-icons-sharp" style="color: var(--danger-color)">delete</span>
                            </button>
                        </li>
                    `;
                } else { // native
                     return `
                        <li class="attachment-item">
                            <span class="material-icons-sharp">description</span>
                            <div class="attachment-info">
                                <strong>${att.fileName}</strong>
                                <p class="subtle-text">${att.fileSize ? formatBytes(att.fileSize) : ''}</p>
                            </div>
                            <button class="btn-icon delete-attachment-btn" data-attachment-id="${att.id}" title="${t('modals.remove_item')}">
                                <span class="material-icons-sharp" style="color: var(--danger-color)">delete</span>
                            </button>
                        </li>
                    `;
                }
            }).join('')}
            </ul>
        </div>
    `;
}


export function TaskDetailModal({ taskId }: { taskId: string }): string {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return '';

    const project = state.projects.find(p => p.id === task.projectId);
    const customFieldsForWorkspace = state.customFieldDefinitions.filter(cf => cf.workspaceId === task.workspaceId);
    const customFieldValues = state.customFieldValues.filter(cfv => cfv.taskId === taskId);
    const canManage = can('manage_tasks');
    const activeTab = state.ui.taskDetail.activeTab;
    
    const assignedUserIds = new Set(state.taskAssignees.filter(a => a.taskId === task.id).map(a => a.userId));
    const assignedUsers = state.users.filter(u => assignedUserIds.has(u.id));
    
    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean) as User[];

    const assignedTagIds = new Set(state.taskTags.filter(tt => tt.taskId === task.id).map(tt => tt.tagId));
    const assignedTags = state.tags.filter(t => assignedTagIds.has(t.id));
    const availableTags = state.tags.filter(t => t.workspaceId === task.workspaceId);


    const renderCustomField = (fieldDef: CustomFieldDefinition) => {
        const fieldValue = customFieldValues.find(v => v.fieldId === fieldDef.id);
        const value = fieldValue ? fieldValue.value : '';

        let inputHtml = '';
        switch (fieldDef.type) {
            case 'text':
                inputHtml = `<input type="text" class="form-control" value="${value || ''}">`;
                break;
            case 'number':
                inputHtml = `<input type="number" class="form-control" value="${value || ''}">`;
                break;
            case 'date':
                inputHtml = `<input type="date" class="form-control" value="${value || ''}">`;
                break;
            case 'checkbox':
                inputHtml = `<input type="checkbox" class="form-control" style="width: auto; height: auto;" ${value ? 'checked' : ''}>`;
                break;
        }

        return `
            <div class="form-group">
                <label>${fieldDef.name}</label>
                <div data-custom-field-id="${fieldDef.id}">
                    ${inputHtml}
                </div>
            </div>
        `;
    };

    let tabContent = '';
    switch(activeTab) {
        case 'activity': tabContent = renderActivityTab(task); break;
        case 'subtasks': tabContent = renderSubtasksTab(task); break;
        case 'dependencies': tabContent = renderDependenciesTab(task); break;
        case 'attachments': tabContent = renderAttachmentsTab(task); break;
    }

    return `
        <div class="task-detail-modal-layout">
            <div class="task-detail-main">
                <div class="task-detail-main-header">
                    <div>
                        <p class="subtle-text" style="margin-bottom: 0.5rem;">${project?.name || t('misc.no_project')}</p>
                        <h3 class="task-detail-title" style="margin-bottom: 1rem;">${task.name}</h3>
                    </div>
                     <button class="btn-icon" data-copy-link="tasks/${task.id}" title="${t('misc.copy_link')}">
                        <span class="material-icons-sharp">link</span>
                    </button>
                </div>
                ${task.description ? `<p class="task-detail-description">${task.description}</p>` : ''}

                <div class="task-detail-tabs">
                    <button class="task-detail-tab ${activeTab === 'activity' ? 'active' : ''}" data-tab="activity">${t('modals.activity')}</button>
                    <button class="task-detail-tab ${activeTab === 'subtasks' ? 'active' : ''}" data-tab="subtasks">${t('modals.subtasks')}</button>
                    <button class="task-detail-tab ${activeTab === 'dependencies' ? 'active' : ''}" data-tab="dependencies">${t('modals.dependencies')}</button>
                    <button class="task-detail-tab ${activeTab === 'attachments' ? 'active' : ''}" data-tab="attachments">${t('modals.attachments')}</button>
                </div>

                <div class="task-detail-tab-content">
                    ${tabContent}
                </div>
                
            </div>
            <aside class="task-detail-sidebar">
                <h4>${t('modals.details')}</h4>
                <div class="form-group">
                    <label>${t('modals.status')}</label>
                    <select class="form-control" data-field="status" onchange="this.dispatchEvent(new Event('change', { bubbles: true }))" ${!canManage ? 'disabled' : ''}>
                        <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>${t('modals.status_backlog')}</option>
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>${t('modals.status_todo')}</option>
                        <option value="inprogress" ${task.status === 'inprogress' ? 'selected' : ''}>${t('modals.status_inprogress')}</option>
                        <option value="inreview" ${task.status === 'inreview' ? 'selected' : ''}>${t('modals.status_inreview')}</option>
                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>${t('modals.status_done')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${t('modals.assignees')}</label>
                    <div class="multiselect-container" data-type="assignee" data-task-id="${task.id}">
                        <div class="multiselect-display">
                            ${assignedUsers.length > 0 ? assignedUsers.map(user => `
                                <div class="avatar" title="${user.name || user.initials}">${user.initials}</div>
                            `).join('') : `<span class="subtle-text">${t('modals.unassigned')}</span>`}
                        </div>
                        <div class="multiselect-dropdown hidden">
                            ${workspaceMembers.map(user => `
                                <label class="multiselect-list-item">
                                    <input type="checkbox" value="${user.id}" ${assignedUserIds.has(user.id) ? 'checked' : ''}>
                                    <div class="avatar">${user.initials}</div>
                                    <span>${user.name || user.email}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>${t('modals.tags')}</label>
                     <div class="multiselect-container" data-type="tag" data-task-id="${task.id}">
                        <div class="multiselect-display tag-list">
                            ${assignedTags.length > 0 ? assignedTags.map(tag => `
                                <div class="tag-chip" style="background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;">${tag.name}</div>
                            `).join('') : `<span class="subtle-text">No tags</span>`}
                        </div>
                        <div class="multiselect-dropdown hidden">
                            <form id="add-new-tag-form" class="multiselect-add-new" data-task-id="${task.id}">
                                <input type="text" class="form-control" placeholder="Create a new tag...">
                            </form>
                            <div class="multiselect-list">
                            ${availableTags.map(tag => `
                                <label class="multiselect-list-item">
                                    <input type="checkbox" value="${tag.id}" ${assignedTagIds.has(tag.id) ? 'checked' : ''}>
                                    <div class="tag-chip" style="background-color: ${tag.color}20; color: ${tag.color};">${tag.name}</div>
                                </label>
                            `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>${t('modals.priority')}</label>
                    <select class="form-control" data-field="priority" onchange="this.dispatchEvent(new Event('change', { bubbles: true }))" ${!canManage ? 'disabled' : ''}>
                        <option value="">${t('modals.priority_none')}</option>
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>${t('modals.priority_low')}</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>${t('modals.priority_medium')}</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>${t('modals.priority_high')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${t('modals.start_date')}</label>
                    <input type="date" class="form-control" data-field="startDate" value="${task.startDate || ''}" onchange="this.dispatchEvent(new Event('change', { bubbles: true }))" ${!canManage ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label>${t('modals.due_date')}</label>
                    <input type="date" class="form-control" data-field="dueDate" value="${task.dueDate || ''}" onchange="this.dispatchEvent(new Event('change', { bubbles: true }))" ${!canManage ? 'disabled' : ''}>
                </div>
                 <div class="form-group">
                    <label>${t('modals.repeat')}</label>
                    <select class="form-control" data-field="recurrence" onchange="this.dispatchEvent(new Event('change', { bubbles: true }))" ${!canManage ? 'disabled' : ''}>
                        <option value="none" ${!task.recurrence || task.recurrence === 'none' ? 'selected' : ''}>${t('modals.repeat_none')}</option>
                        <option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>${t('modals.repeat_daily')}</option>
                        <option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>${t('modals.repeat_weekly')}</option>
                        <option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>${t('modals.repeat_monthly')}</option>
                    </select>
                </div>
                ${customFieldsForWorkspace.length > 0 ? `
                    <h4 style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">${t('modals.custom_fields')}</h4>
                    ${customFieldsForWorkspace.map(renderCustomField).join('')}
                ` : ''}
            </aside>
        </div>
    `;
}