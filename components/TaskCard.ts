import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import type { Task } from '../types.ts';

export function renderTaskCard(task: Task) {
    const taskAssignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    const completedSubtasks = subtasks.filter(s => s.status === 'done').length;
    const commentsCount = state.comments.filter(c => c.taskId === task.id).length;
    const totalTrackedSeconds = getTaskCurrentTrackedSeconds(task);
    const unknownAssignee = taskAssignees.length === 0;

    const taskTags = state.taskTags
        .filter(tt => tt.taskId === task.id)
        .map(tt => state.tags.find(tag => tag.id === tt.tagId))
        .filter(Boolean);

    const priorityClass = task.priority ? `priority-${task.priority}` : '';

    return `
        <div class="task-card" draggable="true" data-task-id="${task.id}" role="button" tabindex="0" aria-label="${t('tasks.col_task')}: ${task.name}">
            <div class="task-card-header">
                <p class="task-card-name">${task.name}</p>
                <button class="btn-icon task-card-menu-btn" aria-label="Task actions menu">
                    <span class="material-icons-sharp">more_horiz</span>
                </button>
            </div>

            <div class="flex flex-col items-start gap-2">
                ${task.priority ? `<div class="task-card-priority ${priorityClass}">${t('tasks.priority_' + task.priority)}</div>` : ''}

                ${taskTags.length > 0 ? `
                    <div class="task-card-tags">
                        ${taskTags.map(tag => `
                            <span class="tag-pill" style="background-color: ${tag!.color}20; color: ${tag!.color}; border: 1px solid ${tag!.color}50;">
                                ${tag!.name}
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            ${subtasks.length > 0 ? `
                <div class="task-card-subtasks">
                    ${subtasks.map(st => `
                        <div class="subtask-item">
                            <input type="checkbox" disabled ${st.status === 'done' ? 'checked' : ''}>
                            <span class="subtask-item-name ${st.status === 'done' ? 'done' : ''}">${st.name}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="task-card-footer">
                <div class="task-card-stats">
                    ${task.dueDate ? `
                        <div class="stat-item" title="${t('tasks.col_due_date')}">
                            <span class="material-icons-sharp">event</span>
                            <span>${formatDate(task.dueDate, { day: 'numeric', month: 'short' })}</span>
                        </div>
                    ` : ''}
                    ${totalTrackedSeconds > 0 ? `
                        <div class="stat-item" title="${t('tasks.col_time')}">
                            <span class="material-icons-sharp">schedule</span>
                            <span class="task-tracked-time">${formatDuration(totalTrackedSeconds)}</span>
                        </div>
                    ` : ''}
                    ${commentsCount > 0 ? `
                        <div class="stat-item" title="${commentsCount} comments">
                            <span class="material-icons-sharp">chat_bubble_outline</span>
                            <span>${commentsCount}</span>
                        </div>
                    ` : ''}
                    ${subtasks.length > 0 ? `
                        <div class="stat-item" title="${t('tasks.subtask_progress', { completed: completedSubtasks.toString(), total: subtasks.length.toString() })}">
                            <span class="material-icons-sharp">check_box</span>
                            <span>${completedSubtasks}/${subtasks.length}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="avatar-stack">
                    ${taskAssignees.slice(0, 2).map(assignee => `
                        <div class="avatar-small" title="${assignee!.name || assignee!.initials || 'Unassigned'}">${assignee!.initials || '?'}</div>
                    `).join('')}
                    ${taskAssignees.length > 2 ? `<div class="avatar-small more-avatar">+${taskAssignees.length - 2}</div>` : ''}
                    ${unknownAssignee ? `<div class="unknown-avatar" title="Unassigned">?</div>` : ''}
                </div>
            </div>
        </div>
    `;
}