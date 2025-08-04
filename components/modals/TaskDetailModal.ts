import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { formatDuration, formatDate, getUserInitials } from '../../utils.ts';
import { can } from '../../permissions.ts';
import type { Task, User, Attachment, CustomFieldDefinition, CustomFieldType, CustomFieldValue, TaskAssignee, Tag, TaskTag, CommentReaction, Comment, TimeLog } from '../../types.ts';
import { getUserProjectRole } from '../../handlers/main.ts';

function formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderCommentBody(content: string) {
    const mentionRegex = /@\[([^\]]+)\]\(user:([a-fA-F0-9-]+)\)/g;
    return content.replace(mentionRegex, `<strong class="mention-chip">@$1</strong>`);
};

function renderComment(comment: Comment) {
    const state = getState();
    const user = state.users.find(u => u.id === comment.userId);
    const userName = user?.name || getUserInitials(user) || 'User';
    const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

    const reactionsByEmoji = (comment.reactions || []).reduce((acc, reaction) => {
        if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = [];
        }
        acc[reaction.emoji].push(reaction.userId);
        return acc;
    }, {} as Record<string, string[]>);

    const reactionsHtml = Object.entries(reactionsByEmoji).map(([emoji, userIds]) => {
        const isReactedByUser = userIds.includes(state.currentUser!.id);
        const userNames = userIds.map(id => state.users.find(u => u.id === id)?.name || 'Someone').join(', ');
        return `
            <button class="reaction-chip ${isReactedByUser ? 'reacted-by-user' : ''}" data-comment-id="${comment.id}" data-emoji="${emoji}" title="${userNames} reacted with ${emoji}">
                <span>${emoji}</span>
                <span>${userIds.length}</span>
            </button>
        `;
    }).join('');

    const isOwnComment = comment.userId === state.currentUser?.id;
    const task = state.tasks.find(t => t.id === comment.taskId);
    const projectRole = task ? getUserProjectRole(state.currentUser?.id || '', task.projectId) : null;
    const isProjectAdmin = projectRole === 'admin';

    const timeSinceCreation = (new Date().getTime() - new Date(comment.createdAt).getTime()) / (1000 * 60); // in minutes
    const canEdit = isProjectAdmin || (isOwnComment && timeSinceCreation < 15);

    const isEdited = comment.updatedAt && (new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000); // Check if updated more than a second after creation

    return `
        <div class="activity-item comment-container" data-comment-id="${comment.id}">
            <div class="avatar">${getUserInitials(user)}</div>
            <div class="activity-content">
                <div class="activity-header">
                    <strong>${userName}</strong>
                    <span class="activity-time">
                        ${formatDate(comment.createdAt, {hour: 'numeric', minute: 'numeric'})}
                        ${isEdited ? `<em class="text-xs ml-1">(edited)</em>` : ''}
                    </span>
                </div>
                <div class="activity-body prose prose-sm dark:prose-invert max-w-none" id="comment-body-${comment.id}">
                    ${renderCommentBody(comment.content)}
                </div>
                <div class="comment-actions" id="comment-actions-${comment.id}">
                    <button class="btn-text" data-reply-to-comment-id="${comment.id}">${t('modals.reply_button')}</button>
                    ${canEdit ? `<button class="btn-text" data-edit-comment-id="${comment.id}">${t('misc.edit')}</button>` : ''}
                    <div class="relative">
                         <button class="btn-text" data-react-to-comment-id="${comment.id}">😊</button>
                         <div id="reaction-picker-${comment.id}" class="reaction-picker hidden">
                            ${EMOJI_REACTIONS.map(emoji => `<button data-emoji="${emoji}">${emoji}</button>`).join('')}
                         </div>
                    </div>
                </div>
                ${reactionsHtml ? `<div class="reaction-chips">${reactionsHtml}</div>` : ''}
                <div id="reply-form-container-${comment.id}" class="reply-form-container"></div>
            </div>
        </div>
    `;
}

function renderTimeLog(item: TimeLog) {
    const state = getState();
    const user = state.users.find(u => u.id === item.userId);
    const userName = user?.name || getUserInitials(user) || 'User';
    return `
        <div class="activity-item">
            <div class="avatar">${getUserInitials(user)}</div>
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

function renderActivityTab(task: Task) {
    const state = getState();
    const comments = state.comments.filter(c => c.taskId === task.id);
    const timeLogs = state.timeLogs.filter(tl => tl.taskId === task.id);
    
    const allActivity = [...comments, ...timeLogs].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const repliesByParentId = new Map<string, Comment[]>();
    comments.forEach(comment => {
        if (comment.parentId) {
            if (!repliesByParentId.has(comment.parentId)) {
                repliesByParentId.set(comment.parentId, []);
            }
            repliesByParentId.get(comment.parentId)!.push(comment);
        }
    });

    const renderRepliesFor = (parentId: string): string => {
        const replies = repliesByParentId.get(parentId);
        if (!replies || replies.length === 0) return '';
        return `
            <div class="reply-container">
                ${replies.map(renderFullComment).join('')}
            </div>
        `;
    };

    const renderFullComment = (comment: Comment): string => {
        return `
            <div>
                ${renderComment(comment)}
                ${renderRepliesFor(comment.id)}
            </div>
        `;
    };
    
    const topLevelActivity = allActivity.filter(item => !('parentId' in item && item.parentId));
    const savedDraft = localStorage.getItem(`comment-draft-${task.id}`) || '';

    return `
        <div class="flex justify-end mb-4">
            <button class="btn btn-secondary btn-sm" data-modal-target="addManualTimeLog" data-task-id="${task.id}">
                <span class="material-icons-sharp" style="font-size: 1.2rem;">add_alarm</span>
                ${t('modals.add_time_log_button')}
            </button>
        </div>
        <div class="activity-feed">
            ${topLevelActivity.length > 0 ? topLevelActivity.map(item => {
                if ('content' in item) { // Comment
                    return renderFullComment(item as Comment);
                } else { // TimeLog
                    return renderTimeLog(item as TimeLog);
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
                >${savedDraft}</div>
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
    const state = getState();
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
                                ${assignees.slice(0, 2).map(u => u ? `<div class="avatar-small" title="${u.name || ''}">${getUserInitials(u)}</div>` : '').join('')}
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
    const state = getState();
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
                        <button class="btn-icon delete-attachment-btn" data-delete-resource="attachments" data-delete-id="${att.id}" data-delete-confirm="Are you sure you want to delete this attachment?">
                            <span class="material-icons-sharp text-base">delete</span>
                        </button>
                    </li>
                `).join('') : `<p class="subtle-text">${t('panels.no_files')}</p>`}
            </ul>
        </div>
    `;
}

function renderDependenciesTab(task: Task) {
    const state = getState();
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
                            <button class="btn-icon" data-delete-resource="task_dependencies" data-delete-id="${dep.id}" data-delete-confirm="Are you sure you want to remove this dependency?"><span class="material-icons-sharp text-base">link_off</span></button>
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
                            <button class="btn-icon" data-delete-resource="task_dependencies" data-delete-id="${dep.id}" data-delete-confirm="Are you sure you want to remove this dependency?"><span class="material-icons-sharp text-base">link_off</span></button>
                         </div>
                     `}).join('') : `<p class="subtle-text">Not blocking any tasks.</p>`}
                </div>
            </div>
         </div>
    `;
}

function renderSidebar(task: Task) {
    const state = getState();
    const assignees = state.taskAssignees
        .filter(a => a.taskId === task.id)
        .map(a => state.users.find(u => u.id === a.userId))
        .filter((u): u is User => !!u);
        
    const assigneeIds = new Set(assignees.map(u => u.id));

    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === task.workspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u);
    
    const customFields = state.customFieldDefinitions.filter(cf => cf.workspaceId === task.workspaceId);
    const taskTags = state.taskTags.filter(tt => tt.taskId === task.id).map(tt => state.tags.find(t => t.id === tt.tagId)).filter(Boolean);
    const workspaceTags = state.tags.filter(t => t.workspaceId === task.workspaceId);
    const progress = task.progress ?? 0;


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
                <div class="flex justify-between items-center">
                    <label>${t('modals.progress')}</label>
                    <span class="text-xs font-semibold" id="task-progress-label">${Math.round(progress)}%</span>
                </div>
                <div class="task-progress-bar-container" id="task-progress-bar" data-task-id="${task.id}">
                    <div class="task-progress-bar-track">
                        <div class="task-progress-bar-fill" id="task-progress-fill" style="width: ${progress}%;"></div>
                    </div>
                    <div class="task-progress-bar-thumb" id="task-progress-thumb" style="left: ${progress}%;"></div>
                </div>
            </div>
             <div class="sidebar-item">
                <label>${t('modals.assignees')}</label>
                <div class="relative">
                    <button class="form-control text-left flex items-center justify-between" data-menu-toggle="assignee-dropdown" aria-haspopup="true" aria-expanded="false">
                        <div class="flex items-center gap-1 -space-x-2 overflow-hidden">
                            ${assignees.length > 0 ? assignees.map(user => `
                                <div class="avatar-small" title="${user.name || getUserInitials(user)}">${getUserInitials(user)}</div>
                            `).join('') : `<span class="text-text-subtle text-sm px-1">${t('modals.unassigned')}</span>`}
                        </div>
                         ${assignees.length > 0 ? `<span class="text-sm text-text-subtle">${assignees.length} assigned</span>` : ''}
                    </button>
                    <div id="assignee-dropdown" class="assignee-dropdown dropdown-menu hidden">
                        ${workspaceMembers.map(user => {
                            const isAssigned = assigneeIds.has(user.id);
                            return `
                                <div class="assignee-dropdown-item" data-user-id="${user.id}">
                                    <div class="avatar">${getUserInitials(user)}</div>
                                    <span>${user.name || user.initials || 'Unnamed'}</span>
                                    ${isAssigned ? `<span class="material-icons-sharp text-primary ml-auto">check</span>` : ''}
                                </div>
                            `;
                        }).join('')}
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

            <div class="sidebar-item">
                <label>${t('modals.tags')}</label>
                <div id="task-tags-selector" class="multiselect-container" data-entity-type="task" data-entity-id="${task.id}">
                    <div class="multiselect-display">
                        ${taskTags.length > 0 ? taskTags.map(tag => `
                            <div class="selected-tag-item" style="background-color: ${tag!.color}20; border-color: ${tag!.color}80;">
                                <span>${tag!.name}</span>
                                <button class="remove-tag-btn" data-tag-id="${tag!.id}">&times;</button>
                            </div>
                        `).join('') : `<span class="subtle-text">No tags</span>`}
                    </div>
                    <div class="multiselect-dropdown hidden">
                        <div class="multiselect-list">
                            ${workspaceTags.map(tag => {
                                const isSelected = taskTags.some(tt => tt!.id === tag.id);
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

            <div class="sidebar-item">
                <div class="flex justify-between items-center">
                    <label>${t('modals.reminders')}</label>
                    <button class="btn-icon" data-set-reminder-for-task-id="${task.id}" title="${t('modals.set_reminder')}">
                        <span class="material-icons-sharp text-base">${task.reminderAt ? 'notifications_active' : 'notifications_none'}</span>
                    </button>
                </div>
                ${task.reminderAt ? `<p class="text-xs text-primary">${formatDate(task.reminderAt, {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>` : ''}
                <div class="mt-2 pt-2 border-t border-border-color space-y-2">
                    <h5 class="text-xs font-bold text-text-subtle">${t('modals.automated_follow_ups')}</h5>
                    <label class="flex justify-between items-center cursor-pointer">
                        <span class="text-sm">${t('modals.nudge_on_inactivity')}</span>
                        <input type="checkbox" class="toggle-switch" data-toggle-follow-up="onInactivity" data-task-id="${task.id}" ${task.followUpConfig?.onInactivity ? 'checked' : ''}>
                    </label>
                    <label class="flex justify-between items-center cursor-pointer">
                        <span class="text-sm">${t('modals.nudge_on_unanswered_question')}</span>
                        <input type="checkbox" class="toggle-switch" data-toggle-follow-up="onUnansweredQuestion" data-task-id="${task.id}" ${task.followUpConfig?.onUnansweredQuestion ? 'checked' : ''}>
                    </label>
                </div>
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
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return `
        <div class="p-8 text-center text-text-subtle">
            Task not found. It may have been deleted.
        </div>
    `;

    const { activeTab } = state.ui.taskDetail;

    let tabContent = '';
    switch(activeTab) {
        case 'activity': tabContent = renderActivityTab(task); break;
        case 'checklist': tabContent = renderChecklistTab(task); break;
        case 'subtasks': tabContent = renderSubtasksTab(task); break;
        case 'dependencies': tabContent = renderDependenciesTab(task); break;
        case 'attachments': tabContent = renderAttachmentsTab(task); break;
    }

    const tabs = ['activity', 'checklist', 'subtasks', 'dependencies', 'attachments'];

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
                        <button class="side-panel-tab task-detail-tab ${activeTab === tab ? 'active' : ''}" data-tab-group="ui.taskDetail.activeTab" data-tab-value="${tab}" role="tab" aria-selected="${activeTab === tab}">
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