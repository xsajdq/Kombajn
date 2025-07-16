

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import type { Task } from '../types.ts';

export function renderTaskCard(task: Task) {
    const project = state.projects.find(p => p.id === task.projectId && p.workspaceId === state.activeWorkspaceId);
    const taskAssignees = state.taskAssignees.filter(a => a.taskId === task.id).map(a => state.users.find(u => u.id === a.userId)).filter(Boolean);
    const isRunning = !!state.activeTimers[task.id];
    const isAdvanced = state.ui.tasksKanbanMode === 'advanced';
    
    const taskTagsIds = new Set(state.taskTags.filter(tt => tt.taskId === task.id).map(tt => tt.tagId));
    const tags = state.tags.filter(tag => taskTagsIds.has(tag.id));

    const subtasks = state.tasks.filter(t => t.parentId === task.id);
    const completedSubtasks = subtasks.filter(t => t.status === 'done').length;
    const checklist = task.checklist || [];
    const completedChecklistItems = checklist.filter(c => c.completed).length;
    const attachments = state.attachments.filter(a => a.taskId === task.id);
    const dependencies = state.dependencies.filter(d => d.blockedTaskId === task.id || d.blockingTaskId === task.id);

    const descriptionSnippet = task.description
        ? (task.description.length > 100 ? task.description.substring(0, 97) + '...' : task.description)
        : '';

    return `
        <div class="task-card clickable" draggable="true" data-task-id="${task.id}" role="button" tabindex="0" aria-label="${t('tasks.col_task')}: ${task.name}, Project: ${project?.name || ''}">
            <div class="task-card-header">
                <p class="task-card-name">${task.name}</p>
                ${task.priority ? `<span class="priority-badge priority-${task.priority}" title="${t('tasks.col_priority')}: ${t('tasks.priority_' + task.priority)}">${t('tasks.priority_' + task.priority)}</span>` : ''}
            </div>
            <p class="subtle-text task-card-project">${project ? project.name : t('misc.no_project')}</p>
            
            ${tags.length > 0 ? `
                <div class="task-card-tags tag-list">
                    ${tags.map(tag => `<div class="tag-chip" style="background-color: ${tag.color}1A; color: ${tag.color};">${tag.name}</div>`).join('')}
                </div>
            ` : ''}

            ${isAdvanced && descriptionSnippet ? `<p class="task-card-description subtle-text">${descriptionSnippet}</p>` : ''}
            
            <div class="task-meta-icons">
                 ${checklist.length > 0 ? `
                    <span title="${t('modals.checklist')}">
                        <span class="material-icons-sharp">checklist_rtl</span>
                        ${completedChecklistItems}/${checklist.length}
                    </span>` : ''}
                 ${subtasks.length > 0 ? `
                    <span title="${t('modals.subtasks')}">
                        <span class="material-icons-sharp">checklist</span>
                        ${t('tasks.subtask_progress').replace('{completed}', completedSubtasks.toString()).replace('{total}', subtasks.length.toString())}
                    </span>` : ''}
                ${attachments.length > 0 ? `<span title="${t('modals.attachments')}"><span class="material-icons-sharp">attachment</span> ${attachments.length}</span>` : ''}
                ${dependencies.length > 0 ? `<span title="${t('modals.dependencies')}"><span class="material-icons-sharp">link</span> ${dependencies.length}</span>` : ''}
                ${task.recurrence && task.recurrence !== 'none' ? `<span title="${t('modals.repeat')}"><span class="material-icons-sharp">repeat</span></span>` : ''}
            </div>

            <div class="task-card-footer">
                 <div class="task-meta">
                    ${task.dueDate ? `
                        <div class="task-card-duedate">
                            <span class="material-icons-sharp icon-sm">event</span>
                            <span>${formatDate(task.dueDate)}</span>
                        </div>
                    `: ''}
                    <div class="avatar-stack">
                        ${taskAssignees.length > 0 ? taskAssignees.map(assignee => `
                            <div class="avatar" title="${assignee!.name || assignee!.initials || 'Unassigned'}">${assignee!.initials || '?'}</div>
                        `).join('') : `
                            <div class="avatar-placeholder" title="${t('tasks.unassigned')}">
                                <span class="material-icons-sharp icon-sm">person_outline</span>
                            </div>
                        `}
                    </div>
                 </div>
                 <div class="task-actions">
                    <span class="task-tracked-time">${formatDuration(getTaskCurrentTrackedSeconds(task))}</span>
                    <button class="btn-icon timer-controls ${isRunning ? 'running' : ''}" data-timer-task-id="${task.id}" aria-label="${isRunning ? t('tasks.stop_timer') : t('tasks.start_timer')}">
                        <span class="material-icons-sharp">${isRunning ? 'pause_circle_filled' : 'play_circle_filled'}</span>
                    </button>
                 </div>
            </div>
        </div>
    `;
}