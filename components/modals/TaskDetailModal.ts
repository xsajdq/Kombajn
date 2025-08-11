import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { formatDuration, formatDate, getUserInitials, getTaskCurrentTrackedSeconds } from '../../utils.ts';
import type { Task, User, CustomFieldDefinition, Comment, TimeLog, TaskDetailModalData, TaskAssignee, Tag, SubtaskDetailModalData, DependencyType } from '../../types.ts';
import { getUserProjectRole } from '../../handlers/main.ts';
import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { formControlClasses, formGroupClasses, labelClasses, renderMultiUserSelect, renderSelect, renderTextInput, renderTextarea } from './formControls.ts';
import { can } from '../../permissions.ts';

// Re-importing necessary functions that were previously in the same file.
function formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderCommentBody(content: string): TemplateResult {
    const mentionRegex = /@\[([^\]]+)\]\(user:([a-fA-F0-9-]+)\)/g;
    const sanitizedContent = content.replace(mentionRegex, `<strong class="mention-chip" data-user-id="$2">@$1</strong>`);
    return html`<p>${unsafeHTML(sanitizedContent)}</p>`;
};

function renderComment(comment: Comment): TemplateResult {
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
        return html`
            <button class="reaction-chip ${isReactedByUser ? 'reacted-by-user' : ''}" data-comment-id="${comment.id}" data-emoji="${emoji}" title="${userNames} reacted with ${emoji}">
                <span>${emoji}</span>
                <span>${userIds.length}</span>
            </button>
        `;
    });

    const isOwnComment = comment.userId === state.currentUser?.id;
    const task = state.tasks.find(t => t.id === comment.taskId);
    const projectRole = task ? getUserProjectRole(state.currentUser?.id || '', task.projectId) : null;
    const isProjectAdmin = projectRole === 'admin';

    const timeSinceCreation = (new Date().getTime() - new Date(comment.createdAt).getTime()) / (1000 * 60); // in minutes
    const canEdit = isProjectAdmin || (isOwnComment && timeSinceCreation < 15);

    const isEdited = comment.updatedAt && (new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000); // Check if updated more than a second after creation

    return html`
        <div class="activity-item comment-container" data-comment-id="${comment.id}">
            <div class="avatar">${getUserInitials(user)}</div>
            <div class="activity-content">
                <div class="activity-header">
                    <strong>${userName}</strong>
                    <span class="activity-time">
                        ${formatDate(comment.createdAt, {hour: 'numeric', minute: 'numeric'})}
                        ${isEdited ? html`<em class="text-xs ml-1">(edited)</em>` : ''}
                    </span>
                </div>
                <div class="activity-body prose prose-sm dark:prose-invert max-w-none" id="comment-body-${comment.id}">
                    ${renderCommentBody(comment.content)}
                </div>
                <div class="comment-actions" id="comment-actions-${comment.id}">
                    <button class="btn-text" data-reply-to-comment-id="${comment.id}">${t('modals.reply_button')}</button>
                    ${canEdit ? html`<button class="btn-text" data-edit-comment-id="${comment.id}">${t('misc.edit')}</button>` : ''}
                    <div class="relative">
                         <button class="btn-text" data-react-to-comment-id="${comment.id}">😊</button>
                         <div id="reaction-picker-${comment.id}" class="reaction-picker hidden">
                            ${EMOJI_REACTIONS.map(emoji => html`<button data-emoji="${emoji}">${emoji}</button>`)}
                         </div>
                    </div>
                </div>
                ${reactionsHtml.length > 0 ? html`<div class="reaction-chips">${reactionsHtml}</div>` : ''}
                <div id="reply-form-container-${comment.id}" class="reply-form-container"></div>
            </div>
        </div>
    `;
}

function renderTimeLog(item: TimeLog): TemplateResult {
    const state = getState();
    const user = state.users.find(u => u.id === item.userId);
    const userName = user?.name || getUserInitials(user) || 'User';
    return html`
        <div class="activity-item">
            <div class="avatar">${getUserInitials(user)}</div>
            <div class="activity-content">
                <div class="activity-header">
                    <strong>${userName}</strong>
                    <span>${t('modals.logged')} <strong>${formatDuration(item.trackedSeconds)}</strong></span>
                    <span class="activity-time">${formatDate(item.createdAt, {hour: 'numeric', minute: 'numeric'})}</span>
                </div>
                ${item.comment ? html`
                <div class="activity-body">
                    <p class="timelog-comment">${item.comment}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderActivityTab(task: Task): TemplateResult {
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

    const renderRepliesFor = (parentId: string): TemplateResult | '' => {
        const replies = repliesByParentId.get(parentId);
        if (!replies || replies.length === 0) return '';
        return html`
            <div class="reply-container">
                ${replies.map(renderFullComment)}
            </div>
        `;
    };

    const renderFullComment = (comment: Comment): TemplateResult => {
        return html`
            <div>
                ${renderComment(comment)}
                ${renderRepliesFor(comment.id)}
            </div>
        `;
    };
    
    const topLevelActivity = allActivity.filter(item => !('parentId' in item && item.parentId));
    const savedDraft = localStorage.getItem(`comment-draft-${task.id}`) || '';

    return html`
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
            }) : html`<p class="subtle-text">${t('modals.no_activity')}</p>`}
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
                >${unsafeHTML(savedDraft)}</div>
            </div>
             <div class="flex justify-end items-center gap-2 mt-2">
                 <button type="submit" id="submit-comment-btn" class="btn btn-primary">${t('modals.comment_button')}</button>
             </div>
        </form>
    `;
}

function renderChecklistTab(task: Task): TemplateResult {
    const checklist = task.checklist || [];
    const completed = checklist.filter(i => i.completed).length;
    const progress = checklist.length > 0 ? (completed / checklist.length) * 100 : 0;
    
    return html`
         <div class="space-y-2">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-full bg-background rounded-full h-1.5 w-40">
                        <div class="bg-primary h-1.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-xs text-text-subtle">${Math.round(progress)}%</span>
                </div>
                 <div class="relative">
                    <button id="apply-checklist-template-btn" class="btn btn-secondary btn-sm">Apply Template</button>
                </div>
            </div>
            ${checklist.map(item => html`
                <div class="checklist-item p-2 rounded-md hover:bg-background">
                    <label class="flex items-center gap-3 flex-1 cursor-pointer">
                        <input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary checklist-item-checkbox" data-item-id="${item.id}" .checked=${item.completed}>
                        <span class="${item.completed ? 'line-through text-text-subtle' : ''}">${item.text}</span>
                    </label>
                    <button class="btn-icon delete-checklist-item-btn" data-item-id="${item.id}"><span class="material-icons-sharp text-base">close</span></button>
                </div>
            `)}
            <form id="add-checklist-item-form" data-task-id="${task.id}" class="flex gap-2">
                <input type="text" class="form-control" placeholder="${t('modals.add_checklist_item')}" required>
            </form>
        </div>
    `;
}

function renderSubtasksTab(task: Task): TemplateResult {
    const state = getState();
    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    return html`
        <div class="space-y-2">
             ${subtasks.map(subtask => html`
                <div class="flex items-center gap-3 p-2 rounded-md hover:bg-background subtask-row" data-subtask-id="${subtask.id}">
                    <input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary subtask-checkbox" data-subtask-id="${subtask.id}" .checked=${subtask.status === 'done'}>
                    <span class="flex-1 cursor-pointer subtask-name ${subtask.status === 'done' ? 'line-through text-text-subtle' : ''}">${subtask.name}</span>
                    <button class="btn-icon" data-delete-subtask-id="${subtask.id}"><span class="material-icons-sharp text-base">close</span></button>
                </div>
            `)}
            <form id="add-subtask-form" data-parent-task-id="${task.id}" class="flex gap-2">
                <input type="text" class="form-control" placeholder="${t('modals.add_subtask')}" required>
            </form>
        </div>
    `;
}

function renderDependenciesTab(task: Task): TemplateResult {
    const state = getState();
    const blockedBy = state.dependencies.filter(d => d.blockedTaskId === task.id).map(d => state.tasks.find(t => t.id === d.blockingTaskId));
    const blocking = state.dependencies.filter(d => d.blockingTaskId === task.id).map(d => state.tasks.find(t => t.id === d.blockedTaskId));
    const allTasks = state.tasks.filter(t => t.id !== task.id && t.workspaceId === state.activeWorkspaceId);

    return html`
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h5 class="font-semibold mb-2">${t('modals.blocked_by')}</h5>
                <div class="space-y-2">
                    ${blockedBy.map(t => t ? html`
                        <div class="dependency-item">
                            <span>${t.name}</span>
                            <button class="btn-icon" data-remove-dependency-id="${state.dependencies.find(d => d.blockedTaskId === task.id && d.blockingTaskId === t.id)?.id}"><span class="material-icons-sharp text-base">close</span></button>
                        </div>
                    ` : '')}
                </div>
                <form id="add-dependency-form" data-blocked-task-id="${task.id}" class="mt-2 flex gap-2">
                    <select class="form-control">
                        <option value="">${t('modals.select_task')}</option>
                        ${allTasks.map(t => html`<option value="${t.id}">${t.name}</option>`)}
                    </select>
                </form>
            </div>
            <div>
                <h5 class="font-semibold mb-2">${t('modals.blocking')}</h5>
                <div class="space-y-2">
                    ${blocking.map(t => t ? html`
                         <div class="dependency-item">
                            <span>${t.name}</span>
                            <button class="btn-icon" data-remove-dependency-id="${state.dependencies.find(d => d.blockingTaskId === task.id && d.blockedTaskId === t.id)?.id}"><span class="material-icons-sharp text-base">close</span></button>
                        </div>
                    ` : '')}
                </div>
            </div>
        </div>
    `;
}

function renderAttachmentsTab(task: Task): TemplateResult {
    const state = getState();
    const attachments = state.attachments.filter(a => a.taskId === task.id);
    return html`
        <div class="space-y-4">
            <div class="flex justify-end gap-2">
                <button id="attach-from-drive-btn" data-task-id="${task.id}" class="btn btn-secondary btn-sm"><span class="material-icons-sharp text-base">add_to_drive</span> ${t('modals.attach_from_drive')}</button>
                <label for="attachment-file-input" class="btn btn-secondary btn-sm cursor-pointer"><span class="material-icons-sharp text-base">upload_file</span> ${t('modals.add_attachment')}</label>
                <input type="file" id="attachment-file-input" class="hidden" data-task-id="${task.id}">
            </div>
            <ul class="space-y-2">
                 ${attachments.map(att => html`
                    <li class="attachment-item">
                        <span class="material-icons-sharp">description</span>
                        <div class="attachment-info"><strong>${att.fileName}</strong><p class="subtle-text">${formatBytes(att.fileSize || 0)} - ${formatDate(att.createdAt)}</p></div>
                        <button class="btn-icon delete-attachment-btn" data-attachment-id="${att.id}" aria-label="${t('modals.remove_item')} ${att.fileName}"><span class="material-icons-sharp" style="color: var(--danger-color)">delete</span></button>
                    </li>
                `)}
            </ul>
        </div>
    `;
}

export function TaskDetailModal() {
    const modalData = (getState().ui.modal.data || {}) as TaskDetailModalData;
    const task = getState().tasks.find(t => t.id === modalData.taskId);
    if (!task) return null;

    const state = getState();
    const project = state.projects.find(p => p.id === task.projectId);
    const projectRole = getUserProjectRole(state.currentUser?.id || '', task.projectId);
    const canEdit = projectRole === 'admin' || projectRole === 'editor' || can('manage_tasks');
    const { activeTab } = state.ui.taskDetail;

    const projectMembers = state.projectMembers
        .filter(pm => pm.projectId === task.projectId)
        .map(pm => state.users.find(u => u.id === pm.userId))
        .filter((u): u is User => !!u);
        
    const assignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => a.userId);
    const totalTrackedSeconds = getTaskCurrentTrackedSeconds(task);
    const customFields = state.customFieldDefinitions.filter(cf => cf.workspaceId === state.activeWorkspaceId);
    
    const tabs = [
        { id: 'activity', text: t('modals.activity'), content: renderActivityTab(task) },
        { id: 'checklist', text: t('modals.checklist'), content: renderChecklistTab(task) },
        { id: 'subtasks', text: t('modals.subtasks'), content: renderSubtasksTab(task) },
        { id: 'dependencies', text: t('modals.dependencies'), content: renderDependenciesTab(task) },
        { id: 'attachments', text: t('modals.attachments'), content: renderAttachmentsTab(task) },
    ];
    
    const title = html`
        <div class="flex items-center gap-2">
            <input type="text" class="text-lg font-semibold bg-transparent border-none p-0 focus:ring-0" value="${task.name}" data-field="name" ?disabled=${!canEdit}>
            <span class="text-sm text-text-subtle">• ${project?.name || ''}</span>
        </div>
    `;
    const body = html`
        <div class="task-detail-layout">
            <div class="task-detail-main">
                <div class="prose prose-sm dark:prose-invert max-w-none">
                    <textarea class="form-control" data-field="description" placeholder="Add a description..." rows="4" ?disabled=${!canEdit}>${task.description || ''}</textarea>
                </div>
                 <nav class="side-panel-tabs mt-4">
                    ${tabs.map(tab => html`<button class="side-panel-tab ${activeTab === tab.id ? 'active' : ''}" data-tab-group="ui.taskDetail.activeTab" data-tab-value="${tab.id}">${tab.text}</button>`)}
                </nav>
                <div class="py-4">${tabs.find(t => t.id === activeTab)?.content}</div>
            </div>
            <aside class="task-detail-sidebar">
                <div class="bg-background p-4 rounded-lg space-y-4">
                    ${renderSelect({ id: '', label: t('modals.status'), value: task.status, options: [
                        {value: 'backlog', text: t('modals.status_backlog')}, {value: 'todo', text: t('modals.status_todo')},
                        {value: 'inprogress', text: t('modals.status_inprogress')}, {value: 'inreview', text: t('modals.status_inreview')},
                        {value: 'done', text: t('modals.status_done')},
                    ], disabled: !canEdit, containerClassName: 'sidebar-item', dataField: 'status' })}

                    ${renderMultiUserSelect({ id: 'task-assignees-sidebar', label: t('modals.assignees'), users: projectMembers, selectedUserIds: assignees, unassignedText: t('modals.unassigned'), containerClassName: 'sidebar-item' })}

                    <div class="sidebar-item">
                        <label class="${labelClasses}">${t('modals.dates')}</label>
                        <div class="grid grid-cols-2 gap-2">
                            ${renderTextInput({ id: '', label: '', type: 'date', value: task.startDate, dataField: 'startDate', containerClassName: '' })}
                            ${renderTextInput({ id: '', label: '', type: 'date', value: task.dueDate, dataField: 'dueDate', containerClassName: '' })}
                        </div>
                    </div>
                     ${renderSelect({ id: '', label: t('modals.priority'), value: task.priority || '', options: [
                        {value: '', text: t('modals.priority_none')}, {value: 'low', text: t('modals.priority_low')},
                        {value: 'medium', text: t('modals.priority_medium')}, {value: 'high', text: t('modals.priority_high')},
                     ], disabled: !canEdit, containerClassName: 'sidebar-item', dataField: 'priority' })}
                </div>

                <div class="bg-background p-4 rounded-lg space-y-4">
                    <div class="sidebar-item">
                        <label class="${labelClasses}">Time</label>
                        <div class="flex justify-between text-sm"><span>${formatDuration(totalTrackedSeconds)}</span><span class="text-text-subtle">${task.estimatedHours ? `/ ${task.estimatedHours}h` : ''}</span></div>
                        ${task.estimatedHours ? html`<div class="task-progress-bar-container" id="task-progress-bar" data-task-id="${task.id}" title="${task.progress || 0}%">
                            <div class="task-progress-bar-track"><div id="task-progress-fill" class="task-progress-bar-fill" style="width: ${task.progress || 0}%"></div></div>
                            <div id="task-progress-thumb" class="task-progress-bar-thumb" style="left: ${task.progress || 0}%"></div>
                        </div>` : ''}
                    </div>
                </div>

                <div class="bg-background p-4 rounded-lg space-y-2">
                     <div class="sidebar-heading">${t('modals.reminders')}</div>
                     <button class="w-full text-left text-sm p-2 rounded-md hover:bg-content border border-dashed border-border-color" data-set-reminder-for-task-id="${task.id}">
                        ${task.reminderAt ? `Set for ${formatDate(task.reminderAt, {dateStyle: 'medium', timeStyle: 'short'})}` : t('modals.set_reminder')}
                     </button>
                </div>

                ${customFields.length > 0 ? html`
                <div class="bg-background p-4 rounded-lg space-y-4">
                    <div class="sidebar-heading">${t('modals.custom_fields')}</div>
                    ${customFields.map(field => {
                        const fieldValue = state.customFieldValues.find(v => v.fieldId === field.id && v.taskId === task.id)?.value;
                        return html`
                            <div class="sidebar-item" data-custom-field-id="${field.id}">
                                <label class="${labelClasses}">${field.name}</label>
                                ${field.type === 'checkbox'
                                    ? html`<input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary" .checked=${!!fieldValue}>`
                                    : html`<input type="${field.type}" class="${formControlClasses}" .value="${fieldValue || ''}">`
                                }
                            </div>
                        `;
                    })}
                </div>
                ` : ''}
            </aside>
        </div>
    `;
    const footer = html`<button class="btn-close-modal">${t('panels.close')}</button>`;
    
    return { title, body, footer, maxWidth: 'max-w-6xl' };
}