

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import type { Task } from '../types.ts';

export function renderTaskCard(task: Task) {
    const taskAssignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);

    const checklist = task.checklist || [];
    const completedChecklistItems = checklist.filter(item => item.completed).length;

    const comments = state.comments.filter(c => c.taskId === task.id);
    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    const completedSubtasks = subtasks.filter(s => s.status === 'done').length;

    const totalTrackedSeconds = getTaskCurrentTrackedSeconds(task);

    return `
        <div class="task-card" draggable="true" data-task-id="${task.id}" role="button" tabindex="0" aria-label="${t('tasks.col_task')}: ${task.name}">
            <div class="task-card-header">
                <p class="task-card-name">${task.name}</p>
                <button class="btn-icon task-card-menu-btn" aria-label="Task actions menu">
                    <span class="material-icons-sharp">more_vert</span>
                </button>
            </div>

            ${checklist.length > 0 ? `
                <div class="task-card-checklist">
                    ${checklist.slice(0, 3).map(item => `
                        <div class="task-card-checklist-item ${item.completed ? 'completed' : ''}">
                            <span class="material-icons-sharp icon-sm">${item.completed ? 'check_box' : 'check_box_outline_blank'}</span>
                            <span class="checklist-item-text">${item.text}</span>
                        </div>
                    `).join('')}
                    ${checklist.length > 3 ? `<div class="text-xs text-text-subtle ml-7">+${checklist.length - 3} more</div>` : ''}
                </div>
            ` : ''}

            ${task.priority ? `<div class="task-card-priority">${t('tasks.priority_' + task.priority)}</div>` : ''}

            <div class="task-card-footer">
                <div class="task-card-stats">
                    ${checklist.length > 0 ? `<div class="stat-item" title="${t('tasks.subtask_progress', { completed: completedChecklistItems.toString(), total: checklist.length.toString() })}"><span class="material-icons-sharp">checklist</span><span>${completedChecklistItems}/${checklist.length}</span></div>` : ''}
                    ${task.dueDate ? `<div class="stat-item" title="${t('tasks.col_due_date')}"><span class="material-icons-sharp">event</span><span>${formatDate(task.dueDate, { day: 'numeric', month: 'short' })}</span></div>` : ''}
                    ${totalTrackedSeconds > 0 ? `<div class="stat-item" title="${t('tasks.col_time')}"><span class="material-icons-sharp">schedule</span><span class="task-tracked-time">${formatDuration(totalTrackedSeconds)}</span></div>` : ''}
                    ${comments.length > 0 ? `<div class="stat-item" title="${comments.length} comments"><span class="material-icons-sharp">chat_bubble_outline</span><span>${comments.length}</span></div>` : ''}
                    ${subtasks.length > 0 ? `<div class="stat-item" title="Subtasks"><span class="material-icons-sharp">subdirectory_arrow_right</span><span>${completedSubtasks}/${subtasks.length}</span></div>` : ''}
                </div>
                <div class="avatar-stack">
                    ${taskAssignees.slice(0, 2).map(assignee => `
                        <div class="avatar-small" title="${assignee!.name || assignee!.initials || 'Unassigned'}">${assignee!.initials || '?'}</div>
                    `).join('')}
                    ${taskAssignees.length > 2 ? `<div class="avatar-small more-avatar">+${taskAssignees.length - 2}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}