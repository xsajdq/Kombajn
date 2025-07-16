

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

    // Show top 3 checklist items, and a counter for the rest.
    const checklistPreviewItems = checklist.slice(0, 3);
    const remainingChecklistCount = checklist.length - checklistPreviewItems.length;


    return `
        <div class="task-card clickable" draggable="true" data-task-id="${task.id}" role="button" tabindex="0" aria-label="${t('tasks.col_task')}: ${task.name}">
            <div class="task-card-header">
                <p class="task-card-name">${task.name}</p>
                 <button class="btn-icon task-card-menu-btn" aria-label="Task actions menu">
                    <span class="material-icons-sharp">more_vert</span>
                </button>
            </div>
            
            ${tags.length > 0 ? `
                <div class="task-card-tags">
                    ${tags.map(tag => `<div class="tag-chip" style="background-color: ${tag.color}1A; color: ${tag.color};">${tag.name}</div>`).join('')}
                </div>
            ` : ''}

            ${checklist.length > 0 ? `
                <div class="task-card-checklist">
                    <label>${t('modals.checklist')}</label>
                    <ul class="task-card-checklist-items">
                        ${checklistPreviewItems.map(item => `
                            <li class="task-card-checklist-item ${item.completed ? 'completed' : ''}">
                                <span class="checklist-item-checkbox"></span>
                                <span class="checklist-item-text">${item.text}</span>
                            </li>
                        `).join('')}
                    </ul>
                    ${remainingChecklistCount > 0 ? `
                        <p class="checklist-more-items">+${remainingChecklistCount} more items</p>
                    ` : ''}
                </div>
            `: ''}

            <div class="task-card-footer">
                 <div class="task-card-meta">
                    ${task.priority ? `<span class="priority-label priority-${task.priority}" title="${t('tasks.priority_' + task.priority)}">${t('tasks.priority_' + task.priority)}</span>` : ''}
                    ${task.dueDate ? `<div class="stat-item" title="${t('tasks.col_due_date')}"><span class="material-icons-sharp icon-sm">event</span><span>${formatDate(task.dueDate)}</span></div>` : ''}
                    ${comments.length > 0 ? `<div class="stat-item" title="${comments.length} comments">
                         <span class="material-icons-sharp icon-sm">chat_bubble_outline</span>
                         <span>${comments.length}</span>
                    </div>` : ''}
                     ${attachments.length > 0 ? `<div class="stat-item" title="${attachments.length} attachments">
                         <span class="material-icons-sharp icon-sm">attachment</span>
                         <span>${attachments.length}</span>
                    </div>` : ''}
                 </div>
                 <div class="avatar-stack">
                    ${taskAssignees.slice(0, 3).map(assignee => `
                        <div class="avatar" title="${assignee!.name || assignee!.initials || 'Unassigned'}">${assignee!.initials || '?'}</div>
                    `).join('')}
                    ${taskAssignees.length > 3 ? `<div class="avatar more-avatar">+${taskAssignees.length - 3}</div>` : ''}
                 </div>
            </div>
        </div>
    `;
}