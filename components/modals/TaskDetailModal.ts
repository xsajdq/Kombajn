import { state } from '../../state.ts';
import { t } from '../../i18n.ts';
import { formatDuration, formatDate } from '../../utils.ts';
import { can } from '../../permissions.ts';
import type { Task, User, Attachment } from '../../types.ts';

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ... (renderActivityTab, renderChecklistTab, etc. remain largely the same for now)

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

function renderSubtasksTab(task: Task) {
    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    return `
        <div class="task-detail-section">
            <form id="add-subtask-form" class="flex gap-2 mb-4" data-parent-task-id="${task.id}">
                <input type="text" class="form-control flex-1" placeholder="${t('modals.add_subtask')}" required>
                <button type="submit" class="btn btn-secondary">${t('panels.add_task')}</button>
            </form>
            <div class="subtask-list-enhanced">
            ${subtasks.map(st => {
                 const assignees = state.taskAssignees.filter(a => a.taskId === st.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
                const isDone = st.status === 'done';
                return `
                <div class="subtask-item-enhanced group" data-task-id="${st.id}" role="button" tabindex="0">
                    <div class="subtask-status-toggle">
                       <input type="checkbox" class="subtask-checkbox" data-subtask-id="${st.id}" ${isDone ? 'checked' : ''}>
                    </div>
                    <div class="subtask-name ${isDone ? 'done' : ''}">${st.name}</div>
                    <div class="subtask-meta">
                        ${st.dueDate ? `<span class="subtask-duedate">${formatDate(st.dueDate, {month:'short', day: 'numeric'})}</span>` : '<div></div>'}
                        <div class="avatar-stack">
                           ${assignees.slice(0, 2).map(u => u ? `<div class="avatar-small" title="${u.name || ''}">${u.initials}</div>` : '').join('')}
                           ${assignees.length > 2 ? `<div class="avatar-small more-avatar">+${assignees.length - 2}</div>` : ''}
                        </div>
                    </div>
                    <button class="btn-icon delete-subtask-btn" data-subtask-id="${st.id}" title="${t('modals.remove_item')}">
                        <span class="material-icons-sharp">delete_outline</span>
                    </button>
                </div>
            `}).join('')}
            </div>
        </div>
    `;
}

// These are simplified for now but can be fully redesigned later
function renderChecklistTab(task: Task) { return `<p>Checklist tab coming soon.</p>`; }
function renderDependenciesTab(task: Task) { return `<p>Dependencies tab coming soon.</p>`; }
function renderAttachmentsTab(task: Task) { return `<p>Attachments tab coming soon.</p>`; }

function renderTaskDetailHeader(task: Task) {
    const { isEditing } = state.ui.taskDetail;
    const canManage = can('manage_tasks');

    const assignedUserIds = new Set(state.taskAssignees.filter(a => a.taskId === task.id).map(a => a.userId));
    const assignedUsers = state.users.filter(u => assignedUserIds.has(u.id));
    
    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean) as User[];
    
    if (isEditing) {
        return `
            <div id="task-detail-header-edit" class="task-detail-header-edit-grid">
                <div class="task-detail-header-item">
                    <label class="task-detail-header-label">${t('modals.status')}</label>
                    <select class="form-control" data-field="status">
                        <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>${t('modals.status_backlog')}</option>
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>${t('modals.status_todo')}</option>
                        <option value="inprogress" ${task.status === 'inprogress' ? 'selected' : ''}>${t('modals.status_inprogress')}</option>
                        <option value="inreview" ${task.status === 'inreview' ? 'selected' : ''}>${t('modals.status_inreview')}</option>
                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>${t('modals.status_done')}</option>
                    </select>
                </div>
                <div class="task-detail-header-item">
                    <label class="task-detail-header-label">${t('modals.assignees')}</label>
                    <div class="multiselect-container" data-type="assignee" data-task-id="${task.id}">
                        <div class="multiselect-display">
                             ${assignedUsers.length > 0 ? assignedUsers.map(user => user ? `<div class="avatar" title="${user.name || user.initials}">${user.initials || '?'}</div>` : '').join('') : `<span class="subtle-text">${t('modals.unassigned')}</span>`}
                        </div>
                        <div class="multiselect-dropdown hidden">
                            <div class="multiselect-list">
                            ${workspaceMembers.map(user => `
                                <label class="multiselect-list-item">
                                    <input type="checkbox" value="${user.id}" ${assignedUserIds.has(user.id) ? 'checked' : ''}>
                                    <div class="avatar">${user.initials || '?'}</div>
                                    <span>${user.name || user.email}</span>
                                </label>
                            `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="task-detail-header-item">
                    <label class="task-detail-header-label">${t('modals.due_date')}</label>
                    <input type="date" class="form-control" data-field="dueDate" value="${task.dueDate || ''}">
                </div>
                <div class="task-detail-header-item">
                    <label class="task-detail-header-label">${t('modals.priority')}</label>
                    <select class="form-control" data-field="priority">
                        <option value="">${t('modals.priority_none')}</option>
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>${t('modals.priority_low')}</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>${t('modals.priority_medium')}</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>${t('modals.priority_high')}</option>
                    </select>
                </div>
            </div>
        `;
    }

    // View Mode
    return `
        <div id="task-detail-header-view" class="task-detail-header-view-grid">
            <div class="task-detail-header-item">
                <label class="task-detail-header-label">${t('modals.status')}</label>
                <div class="task-detail-header-value">${t(`modals.status_${task.status}`)}</div>
            </div>
            <div class="task-detail-header-item">
                <label class="task-detail-header-label">${t('modals.assignees')}</label>
                <div class="task-detail-header-value">
                     ${assignedUsers.length > 0 ? assignedUsers.map(user => user ? `<div class="avatar" title="${user.name || user.initials}">${user.initials || '?'}</div>` : '').join('') : t('modals.unassigned')}
                </div>
            </div>
            <div class="task-detail-header-item">
                <label class="task-detail-header-label">${t('modals.due_date')}</label>
                <div class="task-detail-header-value">${task.dueDate ? formatDate(task.dueDate) : t('misc.not_applicable')}</div>
            </div>
            <div class="task-detail-header-item">
                <label class="task-detail-header-label">${t('modals.priority')}</label>
                <div class="task-detail-header-value">${task.priority ? t(`modals.priority_${task.priority}`) : t('modals.priority_none')}</div>
            </div>
        </div>
    `;
}

export function TaskDetailModal({ taskId }: { taskId: string }): string {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return '';

    const project = state.projects.find(p => p.id === task.projectId);
    const canManage = can('manage_tasks');
    const { activeTab, isEditing } = state.ui.taskDetail;
    
    let tabContent = '';
    switch(activeTab) {
        case 'activity': tabContent = renderActivityTab(task); break;
        case 'checklist': tabContent = renderChecklistTab(task); break;
        case 'subtasks': tabContent = renderSubtasksTab(task); break;
        case 'dependencies': tabContent = renderDependenciesTab(task); break;
        case 'attachments': tabContent = renderAttachmentsTab(task); break;
    }

    return `
        <div>
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="subtle-text" style="margin-bottom: 0.5rem;">${project?.name || t('misc.no_project')}</p>
                    <h3 class="task-detail-title">${task.name}</h3>
                </div>
                <div class="flex items-center gap-2">
                    ${isEditing ? `
                        <button class="btn btn-secondary" data-task-edit-cancel>${t('modals.cancel')}</button>
                        <button class="btn btn-primary" data-task-edit-save>${t('modals.save')}</button>
                    ` : `
                        <button class="btn btn-secondary" data-task-edit-start ${!canManage ? 'disabled' : ''}>
                           <span class="material-icons-sharp text-base">edit</span> ${t('misc.edit')}
                        </button>
                    `}
                </div>
            </div>

            <div class="bg-background p-4 rounded-lg mb-4">
                ${renderTaskDetailHeader(task)}
            </div>
            
            <div class="task-detail-tabs">
                <button class="task-detail-tab ${activeTab === 'activity' ? 'active' : ''}" data-tab="activity">${t('modals.activity')}</button>
                <button class="task-detail-tab ${activeTab === 'checklist' ? 'active' : ''}" data-tab="checklist">${t('modals.checklist')}</button>
                <button class="task-detail-tab ${activeTab === 'subtasks' ? 'active' : ''}" data-tab="subtasks">${t('modals.subtasks')}</button>
                <button class="task-detail-tab ${activeTab === 'dependencies' ? 'active' : ''}" data-tab="dependencies">${t('modals.dependencies')}</button>
                <button class="task-detail-tab ${activeTab === 'attachments' ? 'active' : ''}" data-tab="attachments">${t('modals.attachments')}</button>
            </div>

            <div class="task-detail-tab-content">
                ${tabContent}
            </div>
        </div>
    `;
}