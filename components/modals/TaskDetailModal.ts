
import { state } from '../../state.ts';
import { t } from '../../i18n.ts';
import { formatDuration, formatDate } from '../../utils.ts';
import { can } from '../../permissions.ts';
import type { Task, User, Attachment, CustomFieldDefinition } from '../../types.ts';

function formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
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
        <div class="flex justify-end mb-4">
            <button class="btn btn-secondary btn-sm" data-modal-target="addManualTimeLog" data-task-id="${task.id}">
                <span class="material-icons-sharp" style="font-size: 1.2rem;">add_alarm</span>
                ${t('modals.add_time_log_button')}
            </button>
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
                                    <span>${t('modals.logged')} <strong>${formatDuration(item.trackedSeconds)}</strong></span>
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
        <form id="add-comment-form" data-task-id="${task.id}" class="add-comment-form">
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

function renderChecklistTab(task: Task) {
    const checklist = task.checklist || [];
    const completedItems = checklist.filter(item => item.completed).length;
    const progress = checklist.length > 0 ? (completedItems / checklist.length) * 100 : 0;

    return `
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h4 class="font-semibold">${t('modals.checklist')} (${completedItems}/${checklist.length})</h4>
            </div>
            ${checklist.length > 0 ? `
            <div class="w-full bg-background rounded-full h-1.5">
                <div class="bg-primary h-1.5 rounded-full" style="width: ${progress}%;"></div>
            </div>
            ` : ''}
            <div class="checklist-items space-y-2">
                ${checklist.map(item => `
                    <div class="checklist-item group">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary checklist-item-checkbox" data-item-id="${item.id}" ${item.completed ? 'checked' : ''}>
                            <span class="flex-1 text-sm ${item.completed ? 'line-through text-text-subtle' : ''}">${item.text}</span>
                        </label>
                        <button class="btn-icon delete-checklist-item-btn opacity-0 group-hover:opacity-100" data-item-id="${item.id}">
                            <span class="material-icons-sharp text-base">delete</span>
                        </button>
                    </div>
                `).join('')}
            </div>
            <form id="add-checklist-item-form" class="flex gap-2" data-task-id="${task.id}">
                <input type="text" class="form-control" placeholder="${t('modals.add_checklist_item')}" required>
                <button type="submit" class="btn btn-secondary">${t('modals.add_item')}</button>
            </form>
        </div>
    `;
}

function renderSubtasksTab(task: Task) {
    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    return `
        <div class="space-y-4">
            <h4 class="font-semibold">${t('modals.subtasks')} (${subtasks.length})</h4>
            <div class="subtask-list space-y-2">
                ${subtasks.map(subtask => {
                    const assignees = state.taskAssignees.filter(a => a.taskId === subtask.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
                    return `
                        <div class="subtask-item group flex items-center gap-2 p-2 rounded-md hover:bg-background">
                            <input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary subtask-checkbox" data-subtask-id="${subtask.id}" ${subtask.status === 'done' ? 'checked' : ''}>
                            <span class="flex-1 text-sm ${subtask.status === 'done' ? 'line-through text-text-subtle' : ''}">${subtask.name}</span>
                            <div class="avatar-stack">
                                ${assignees.slice(0, 2).map(u => u ? `<div class="avatar-small" title="${u.name || ''}">${u.initials}</div>` : '').join('')}
                                ${assignees.length > 2 ? `<div class="avatar-small more-avatar">+${assignees.length - 2}</div>` : ''}
                            </div>
                            <button class="btn-icon delete-subtask-btn opacity-0 group-hover:opacity-100" data-subtask-id="${subtask.id}">
                                <span class="material-icons-sharp text-base">delete</span>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
            <form id="add-subtask-form" class="flex gap-2" data-parent-task-id="${task.id}">
                <input type="text" class="form-control" placeholder="${t('modals.add_subtask')}" required>
                <button type="submit" class="btn btn-secondary">${t('modals.add_item')}</button>
            </form>
        </div>
    `;
}

function renderAttachmentsTab(task: Task) {
    const attachments = state.attachments.filter(a => a.taskId === task.id);
    const googleDriveIntegration = state.integrations.find(i => i.provider === 'google_drive' && i.isActive && i.workspaceId === state.activeWorkspaceId);

    return `
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h4 class="font-semibold">${t('modals.attachments')} (${attachments.length})</h4>
                <div class="flex items-center gap-2">
                    ${googleDriveIntegration ? `<button class="btn btn-secondary btn-sm" id="attach-google-drive-btn" data-task-id="${task.id}">${t('modals.attach_from_drive')}</button>` : ''}
                    <label class="btn btn-secondary btn-sm cursor-pointer">
                        ${t('modals.add_attachment')}
                        <input type="file" id="attachment-file-input" class="hidden" data-task-id="${task.id}">
                    </label>
                </div>
            </div>
            <ul class="attachment-list">
                ${attachments.length > 0 ? attachments.map(att => `
                    <li class="attachment-item">
                        ${att.provider === 'google_drive' && att.iconUrl ? `<img src="${att.iconUrl}" class="w-6 h-6">` : `<span class="material-icons-sharp">description</span>`}
                        <div class="attachment-info">
                            <a href="${att.externalUrl || '#'}" target="_blank" rel="noopener noreferrer" class="font-medium hover:underline">${att.fileName}</a>
                            <p class="subtle-text">${formatBytes(att.fileSize || 0)} - ${formatDate(att.createdAt)}</p>
                        </div>
                        <button class="btn-icon delete-attachment-btn" data-attachment-id="${att.id}">
                            <span class="material-icons-sharp text-base">delete</span>
                        </button>
                    </li>
                `).join('') : `<p class="subtle-text">${t('panels.no_files')}</p>`}
            </ul>
        </div>
    `;
}

function renderDependenciesTab(task: Task) {
    const dependencies = state.dependencies.filter(d => d.blockedTaskId === task.id || d.blockingTaskId === task.id);
    const blockingTasks = dependencies.filter(d => d.blockedTaskId === task.id).map(d => state.tasks.find(t => t.id === d.blockingTaskId)).filter(Boolean);
    const blockedTasks = dependencies.filter(d => d.blockingTaskId === task.id).map(d => state.tasks.find(t => t.id === d.blockedTaskId)).filter(Boolean);
    
    const availableTasksForDependency = state.tasks.filter(t => t.id !== task.id && t.projectId === task.projectId);

    return `
         <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
                <h4 class="font-semibold">${t('modals.blocked_by')}</h4>
                <div class="space-y-2">
                    ${blockingTasks.length > 0 ? blockingTasks.map(t => {
                        const dep = state.dependencies.find(d => d.blockingTaskId === t.id && d.blockedTaskId === task.id)!;
                        return `
                        <div class="dependency-item">
                            <span>${t.name}</span>
                            <button class="btn-icon" data-remove-dependency-id="${dep.id}"><span class="material-icons-sharp text-base">link_off</span></button>
                        </div>
                    `}).join('') : `<p class="subtle-text">No blocking tasks.</p>`}
                </div>
                <form id="add-dependency-form" class="flex gap-2" data-blocked-task-id="${task.id}">
                    <select class="form-control">
                        <option value="">${t('modals.select_task')}</option>
                        ${availableTasksForDependency.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                    <button type="submit" class="btn btn-secondary">${t('modals.add_item')}</button>
                </form>
            </div>
            <div class="space-y-4">
                <h4 class="font-semibold">${t('modals.blocking')}</h4>
                <div class="space-y-2">
                     ${blockedTasks.length > 0 ? blockedTasks.map(t => {
                         const dep = state.dependencies.find(d => d.blockedTaskId === t.id && d.blockingTaskId === task.id)!;
                         return `
                         <div class="dependency-item">
                             <span>${t.name}</span>
                            <button class="btn-icon" data-remove-dependency-id="${dep.id}"><span class="material-icons-sharp text-base">link_off</span></button>
                         </div>
                     `}).join('') : `<p class="subtle-text">Not blocking any tasks.</p>`}
                </div>
            </div>
         </div>
    `;
}

function renderSidebar(task: Task) {
    const project = state.projects.find(p => p.id === task.projectId);
    const assignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean) as User[];
    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === task.workspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean);
    
    const customFields = state.customFieldDefinitions.filter(cf => cf.workspaceId === task.workspaceId);

    const renderCustomField = (field: CustomFieldDefinition) => {
        const value = state.customFieldValues.find(v => v.fieldId === field.id && v.taskId === task.id)?.value;
        let inputHtml = '';
        switch (field.type) {
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
                inputHtml = `<input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" ${value ? 'checked' : ''}>`;
                break;
        }
        return `
            <div class="sidebar-item" data-custom-field-id="${field.id}">
                <label>${field.name}</label>
                ${inputHtml}
            </div>
        `;
    };

    return `
        <div class="task-detail-sidebar">
            <div class="sidebar-item">
                <label>${t('modals.status')}</label>
                <select class="form-control" data-field="status">
                    <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>${t('modals.status_backlog')}</option>
                    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>${t('modals.status_todo')}</option>
                    <option value="inprogress" ${task.status === 'inprogress' ? 'selected' : ''}>${t('modals.status_inprogress')}</option>
                    <option value="inreview" ${task.status === 'inreview' ? 'selected' : ''}>${t('modals.status_inreview')}</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>${t('modals.status_done')}</option>
                </select>
            </div>
             <div class="sidebar-item">
                <label>${t('modals.assignees')}</label>
                <div class="assignee-list">
                    ${assignees.map(user => `
                        <div class="assignee-item">
                            <div class="avatar">${user.initials}</div>
                            <span>${user.name}</span>
                            <button class="btn-icon remove-assignee" data-user-id="${user.id}"><span class="material-icons-sharp text-base">close</span></button>
                        </div>
                    `).join('')}
                    <div class="relative">
                        <button class="add-assignee-btn">${t('modals.assignees')}</button>
                        <div class="assignee-dropdown">
                            ${workspaceMembers.map(user => `
                                <div class="assignee-dropdown-item" data-user-id="${user!.id}">
                                    <div class="avatar">${user!.initials}</div>
                                    <span>${user!.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="sidebar-item">
                <label>${t('modals.priority')}</label>
                <select class="form-control" data-field="priority">
                    <option value="" ${!task.priority ? 'selected' : ''}>${t('modals.priority_none')}</option>
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>${t('modals.priority_low')}</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>${t('modals.priority_medium')}</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>${t('modals.priority_high')}</option>
                </select>
            </div>
            <div class="sidebar-item">
                <label>${t('modals.start_date')}</label>
                <input type="date" class="form-control" data-field="startDate" value="${task.startDate || ''}">
            </div>
            <div class="sidebar-item">
                <label>${t('modals.due_date')}</label>
                <input type="date" class="form-control" data-field="dueDate" value="${task.dueDate || ''}">
            </div>
            ${customFields.length > 0 ? `
                <div class="sidebar-divider"></div>
                <h5 class="sidebar-heading">${t('modals.custom_fields')}</h5>
                ${customFields.map(renderCustomField).join('')}
            ` : ''}
        </div>
    `;
}

export function TaskDetailModal({ taskId }: { taskId: string }): string {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return `
        <div class="p-8 text-center text-text-subtle">
            Task not found. It may have been deleted.
        </div>
    `;

    const { activeTab, isEditing } = state.ui.taskDetail;
    const project = state.projects.find(p => p.id === task.projectId);

    let tabContent = '';
    switch(activeTab) {
        case 'activity': tabContent = renderActivityTab(task); break;
        case 'checklist': tabContent = renderChecklistTab(task); break;
        case 'subtasks': tabContent = renderSubtasksTab(task); break;
        case 'dependencies': tabContent = renderDependenciesTab(task); break;
        case 'attachments': tabContent = renderAttachmentsTab(task); break;
    }

    const tabs = ['activity', 'checklist', 'subtasks', 'dependencies', 'attachments'];
    const canManage = can('manage_tasks');

    return `
        <div class="task-detail-layout">
            <div class="task-detail-main">
                <div class="task-detail-description">
                    <h4 class="font-semibold mb-2">${t('modals.description')}</h4>
                    <div class="prose dark:prose-invert max-w-none text-sm">
                        <textarea class="form-control" data-field="description" rows="4">${task.description || ''}</textarea>
                    </div>
                </div>
                <nav class="side-panel-tabs mt-6" role="tablist">
                    ${tabs.map(tab => `
                        <button class="side-panel-tab task-detail-tab ${activeTab === tab ? 'active' : ''}" data-tab="${tab}" role="tab" aria-selected="${activeTab === tab}">
                            ${t(`modals.${tab}`)}
                        </button>
                    `).join('')}
                </nav>
                <div class="mt-4">
                    ${tabContent}
                </div>
            </div>
            ${renderSidebar(task)}
        </div>
    `;
}
