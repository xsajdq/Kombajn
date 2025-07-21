

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import type { Task } from '../types.ts';

export function renderTaskCard(task: Task) {
    const project = state.projects.find(p => p.id === task.projectId && p.workspaceId === state.activeWorkspaceId);
    const taskAssignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
    
    const taskTagsIds = new Set(state.taskTags.filter(tt => tt.taskId === task.id).map(tt => tt.tagId));
    const tags = state.tags.filter(tag => taskTagsIds.has(tag.id));

    const checklist = task.checklist || [];
    const attachments = state.attachments.filter(a => a.taskId === task.id);
    const comments = state.comments.filter(c => c.taskId === task.id);
    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    const totalTrackedSeconds = getTaskCurrentTrackedSeconds(task);

    return `
        <div class="task-card clickable" draggable="true" data-task-id="${task.id}" role="button" tabindex="0" aria-label="${t('tasks.col_task')}: ${task.name}">
            <div class="task-card-header">
                <p class="task-card-name">${task.name}</p>
                 <button class="btn-icon task-card-menu-btn" aria-label="Task actions menu">
                    <span class="material-icons-sharp">more_vert</span>
                </button>
            </div>

            ${checklist.length > 0 ? `
                <div class="task-card-checklist">
                    <ul class="task-card-checklist-items">
                        ${checklist.map(item => `
                            <li class="task-card-checklist-item ${item.completed ? 'completed' : ''}">
                                <span class="material-icons-sharp icon-sm">${item.completed ? 'check_box' : 'check_box_outline_blank'}</span>
                                <span class="checklist-item-text">${item.text}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `: ''}

            <div class="task-card-body">
                ${task.priority ? `<div class="task-card-priority priority-${task.priority}">${t('tasks.priority_' + task.priority)}</div>` : ''}
            </div>

            <div class="task-card-footer">
                <div class="task-card-stats">
                    ${task.dueDate ? `<div class="stat-item" title="${t('tasks.col_due_date')}"><span class="material-icons-sharp icon-sm">event</span><span>${formatDate(task.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>` : ''}
                    ${totalTrackedSeconds > 0 ? `<div class="stat-item" title="${t('tasks.col_time')}"><span class="material-icons-sharp icon-sm">schedule</span><span class="task-tracked-time">${formatDuration(totalTrackedSeconds)}</span></div>` : ''}
                    ${comments.length > 0 ? `<div class="stat-item" title="${comments.length} comments"><span class="material-icons-sharp icon-sm">chat_bubble_outline</span><span>${comments.length}</span></div>` : ''}
                </div>
                <div class="avatar-stack">
                    ${taskAssignees.slice(0, 3).map(assignee => `
                        <div class="avatar-small" title="${assignee!.name || assignee!.initials || 'Unassigned'}">${assignee!.initials || '?'}</div>
                    `).join('')}
                    ${taskAssignees.length > 3 ? `<div class="avatar-small more-avatar">+${taskAssignees.length - 3}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}