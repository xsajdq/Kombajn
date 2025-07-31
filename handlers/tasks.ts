import { state, generateId } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Comment, Task, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldType, CustomFieldValue, TaskAssignee, Tag, TaskTag, CommentReaction } from '../types.ts';
import { createNotification } from './notifications.ts';
import { showModal } from './ui.ts';
import { runAutomations } from './automations.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { parseDurationStringToHours } from '../utils.ts';
import { getWorkspaceKanbanWorkflow } from './main.ts';

declare const gapi: any;
declare const google: any;

export function openTaskDetail(taskId: string) {
    showModal('taskDetail', { taskId });
}

export async function handleAddTaskComment(taskId: string, content: string, parentId: string | null, successCallback: () => void) {
    if (!content || !state.currentUser) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCommentPayload: Omit<Comment, 'id'|'createdAt'|'reactions'|'updatedAt'> = {
        workspaceId: task.workspaceId,
        taskId,
        content: content,
        userId: state.currentUser.id,
        parentId: parentId || undefined,
    };

    try {
        const [savedComment] = await apiPost('comments', newCommentPayload);
        state.comments.push(savedComment);
        
        task.lastActivityAt = new Date().toISOString();
        await apiPut('tasks', { id: taskId, lastActivityAt: task.lastActivityAt });

        if (!parentId) { // Only clear the main draft, not for replies
            localStorage.removeItem(`comment-draft-${taskId}`);
        }
        
        successCallback();
        updateUI(['modal']);

        const mentionRegex = /@\[([^\]]+)\]\(user:([a-fA-F0-9-]+)\)/g;
        const mentionedUserIds = new Set<string>();
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
            mentionedUserIds.add(match[2]);
        }
        
        const assignees = state.taskAssignees.filter(a => a.taskId === task.id);

        for (const userId of mentionedUserIds) {
            if (userId !== state.currentUser.id) {
                 await createNotification('mention', { taskId, userIdToNotify: userId, actorId: state.currentUser.id });
            }
        }

        for (const assignee of assignees) {
             if (assignee.userId !== state.currentUser.id && !mentionedUserIds.has(assignee.userId)) {
                await createNotification('new_comment', { taskId, userIdToNotify: assignee.userId, actorId: state.currentUser.id });
            }
        }

    } catch (error) {
        console.error("Failed to add comment:", error);
        alert("Could not add comment. Please try again.");
    }
}

export async function handleUpdateTaskComment(commentId: string, newContent: string) {
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment || !newContent.trim() || comment.content === newContent.trim()) {
        // If no change, just re-render to exit edit mode
        updateUI(['modal']);
        return;
    }

    const originalContent = comment.content;
    const originalUpdatedAt = comment.updatedAt;

    // Optimistic update
    comment.content = newContent.trim();
    comment.updatedAt = new Date().toISOString();
    updateUI(['modal']);

    try {
        await apiPut('comments', { 
            id: commentId, 
            content: comment.content,
            updatedAt: comment.updatedAt 
        });
    } catch (error) {
        console.error("Failed to update comment:", error);
        alert("Could not save comment changes. Reverting.");
        // Revert on failure
        comment.content = originalContent;
        comment.updatedAt = originalUpdatedAt;
        updateUI(['modal']);
    }
}

export async function handleToggleReaction(commentId: string, emoji: string) {
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment || !state.currentUser) return;

    if (!comment.reactions) {
        comment.reactions = [];
    }

    const userId = state.currentUser.id;
    const existingReactionIndex = comment.reactions.findIndex(r => r.emoji === emoji && r.userId === userId);

    if (existingReactionIndex > -1) {
        // User is removing their reaction
        comment.reactions.splice(existingReactionIndex, 1);
    } else {
        // User is adding a reaction
        comment.reactions.push({ emoji, userId });
    }

    updateUI(['modal']); // Optimistic update

    try {
        await apiPut('comments', { id: commentId, reactions: comment.reactions });
    } catch (error) {
        console.error("Failed to toggle reaction:", error);
        alert("Could not save reaction.");
        // Revert UI change on failure
        if (existingReactionIndex > -1) {
            comment.reactions.splice(existingReactionIndex, 0, { emoji, userId });
        } else {
            comment.reactions.pop();
        }
        updateUI(['modal']);
    }
}


export async function handleTaskDetailUpdate(taskId: string, field: keyof Task, value: any) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    let finalValue: any = value === '' ? null : value;
    if (field === 'estimatedHours') {
        finalValue = parseDurationStringToHours(value as string);
    }

    const oldValue = task[field];
    
    if (oldValue === finalValue || (oldValue === null && value === '')) {
        return;
    }
    
    (task as any)[field] = finalValue;
    updateUI(state.ui.modal.isOpen ? ['modal'] : ['page']);

    try {
        await apiPut('tasks', { id: taskId, [field]: finalValue });

        if (field === 'status') {
            const assignees = state.taskAssignees.filter(a => a.taskId === taskId);
            for (const assignee of assignees) {
                if (assignee.userId !== state.currentUser!.id) {
                    await createNotification('status_change', { taskId, userIdToNotify: assignee.userId, newStatus: finalValue, actorId: state.currentUser!.id });
                }
            }
            runAutomations('statusChange', { task, actorId: state.currentUser.id });
        }
    } catch (error) {
        console.error(`Failed to update task field ${field}:`, error);
        alert(`Could not update task. Reverting change.`);
        (task as any)[field] = oldValue;
        updateUI(state.ui.modal.isOpen ? ['modal'] : ['page']);
    }
}

export async function handleTaskProgressUpdate(taskId: string, newProgress: number) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const roundedProgress = Math.round(newProgress);
    const originalProgress = task.progress;
    const originalStatus = task.status;

    task.progress = roundedProgress;

    const workflow = getWorkspaceKanbanWorkflow(task.workspaceId);
    const doneStatus = workflow === 'simple' ? 'done' : 'done'; // Assuming 'done' for both for now

    if (roundedProgress === 100 && task.status !== doneStatus) {
        task.status = doneStatus;
    } else if (roundedProgress < 100 && task.status === doneStatus) {
        task.status = 'inprogress';
    }

    // Update UI immediately
    updateUI(['modal', 'page']);

    try {
        const payload: { id: string, progress: number, status?: Task['status'] } = {
            id: taskId,
            progress: roundedProgress,
        };
        if (task.status !== originalStatus) {
            payload.status = task.status;
        }
        await apiPut('tasks', payload);

        // If status changed, run automations
        if (task.status !== originalStatus && state.currentUser) {
            runAutomations('statusChange', { task, actorId: state.currentUser.id });
        }
    } catch (error) {
        console.error('Failed to update task progress', error);
        alert('Failed to save progress.');
        task.progress = originalProgress;
        task.status = originalStatus;
        updateUI(['modal', 'page']);
    }
}

export async function handleToggleAssignee(taskId: string, userId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    const existingIndex = state.taskAssignees.findIndex(a => a.taskId === taskId && a.userId === userId);

    if (existingIndex > -1) {
        const [removed] = state.taskAssignees.splice(existingIndex, 1);
        updateUI(['modal', 'page']);
        try {
            await apiFetch('/api?action=data&resource=task_assignees', {
                method: 'DELETE',
                body: JSON.stringify({ taskId, userId }),
            });
        } catch (error) {
            console.error('Failed to remove assignee', error);
            state.taskAssignees.splice(existingIndex, 0, removed); // Revert
            updateUI(['modal', 'page']);
        }
    } else {
        const newAssignee = { taskId, userId, workspaceId: task.workspaceId };
        // Optimistic update with a temporary ID
        const tempId = `temp-${Date.now()}`;
        state.taskAssignees.push({ ...newAssignee, id: tempId } as any);
        updateUI(['modal', 'page']);
        try {
            const [saved] = await apiPost('task_assignees', newAssignee);
            // Replace temporary with real one
            const tempIndex = state.taskAssignees.findIndex(a => (a as any).id === tempId);
            if (tempIndex > -1) {
                state.taskAssignees[tempIndex] = saved;
            }
            if (userId !== state.currentUser.id) {
                await createNotification('new_assignment', { taskId, userIdToNotify: userId, actorId: state.currentUser.id });
            }
        } catch (error) {
            console.error('Failed to add assignee', error);
            const tempIndex = state.taskAssignees.findIndex(a => (a as any).id === tempId);
            if (tempIndex > -1) {
                state.taskAssignees.splice(tempIndex, 1); // Revert
            }
            updateUI(['modal', 'page']);
        }
    }
}

export async function handleAddChecklistItem(taskId: string, text: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.checklist) task.checklist = [];
    
    const newItem = { id: generateId(), text, completed: false };
    task.checklist.push(newItem);
    updateUI(['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, checklist: task.checklist });
    } catch (error) {
        console.error("Failed to add checklist item:", error);
        task.checklist.pop();
        updateUI(['modal']);
    }
}

export async function handleDeleteChecklistItem(taskId: string, itemId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    const itemIndex = task.checklist.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const [removedItem] = task.checklist.splice(itemIndex, 1);
    updateUI(['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, checklist: task.checklist });
    } catch (error) {
        console.error("Failed to delete checklist item:", error);
        task.checklist.splice(itemIndex, 0, removedItem);
        updateUI(['modal']);
    }
}

export async function handleToggleChecklistItem(taskId: string, itemId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    const item = task.checklist.find(item => item.id === itemId);
    if (!item) return;

    item.completed = !item.completed; // Optimistic update
    updateUI(['modal']);

    try {
        await apiPut('tasks', { id: taskId, checklist: task.checklist });
    } catch (error) {
        console.error("Failed to toggle checklist item:", error);
        item.completed = !item.completed;
        updateUI(['modal']);
    }
}

export async function handleAddSubtask(parentId: string, name: string) {
    const parentTask = state.tasks.find(t => t.id === parentId);
    if (!parentTask || !state.activeWorkspaceId) return;

    const newSubtaskPayload: Omit<Task, 'id' | 'createdAt'> = {
        workspaceId: state.activeWorkspaceId,
        name,
        projectId: parentTask.projectId,
        status: 'todo',
        parentId: parentId,
        isArchived: false,
    };
    try {
        const [savedSubtask] = await apiPost('tasks', newSubtaskPayload);
        state.tasks.push(savedSubtask);
        updateUI(['modal']);
    } catch (error) {
        console.error("Failed to add subtask:", error);
    }
}

export async function handleDeleteSubtask(subtaskId: string) {
    const subtaskIndex = state.tasks.findIndex(t => t.id === subtaskId);
    if (subtaskIndex === -1) return;

    const [removedSubtask] = state.tasks.splice(subtaskIndex, 1);
    updateUI(['modal']);

    try {
        await apiFetch('/api?action=data&resource=tasks', {
            method: 'DELETE',
            body: JSON.stringify({ id: subtaskId }),
        });
    } catch (error) {
        console.error("Failed to delete subtask:", error);
        state.tasks.splice(subtaskIndex, 0, removedSubtask);
        updateUI(['modal']);
    }
}

export async function handleToggleSubtaskStatus(subtaskId: string) {
    const subtask = state.tasks.find(t => t.id === subtaskId);
    if (!subtask) return;

    const newStatus = subtask.status === 'done' ? 'todo' : 'done';
    const originalStatus = subtask.status;
    subtask.status = newStatus;
    updateUI(['modal']);

    try {
        await apiPut('tasks', { id: subtaskId, status: newStatus });
    } catch (error) {
        console.error("Failed to toggle subtask status:", error);
        subtask.status = originalStatus;
        updateUI(['modal']);
    }
}

export async function handleAddDependency(blockingTaskId: string, blockedTaskId: string) {
    const blockingTask = state.tasks.find(t => t.id === blockingTaskId);
    const blockedTask = state.tasks.find(t => t.id === blockedTaskId);
    if (!blockingTask || !blockedTask || !state.activeWorkspaceId) return;

    const newDependencyPayload: Omit<TaskDependency, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        blockingTaskId,
        blockedTaskId,
    };
    try {
        const [savedDependency] = await apiPost('task_dependencies', newDependencyPayload);
        state.dependencies.push(savedDependency);
        updateUI(['modal']);
    } catch (error) {
        console.error("Failed to add dependency:", error);
    }
}

export async function handleRemoveDependency(dependencyId: string) {
    const depIndex = state.dependencies.findIndex(d => d.id === dependencyId);
    if (depIndex === -1) return;

    const [removedDep] = state.dependencies.splice(depIndex, 1);
    updateUI(['modal']);

    try {
        await apiFetch('/api?action=data&resource=task_dependencies', {
            method: 'DELETE',
            body: JSON.stringify({ id: dependencyId }),
        });
    } catch (error) {
        console.error("Failed to remove dependency:", error);
        state.dependencies.splice(depIndex, 0, removedDep);
        updateUI(['modal']);
    }
}

export async function handleAddAttachment(taskId: string, file: File) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.activeWorkspaceId) return;

    const newAttachmentPayload: Omit<Attachment, 'id' | 'createdAt'> = {
        workspaceId: state.activeWorkspaceId,
        projectId: task.projectId,
        taskId: taskId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        provider: 'native',
    };
    
    try {
        const [savedAttachment] = await apiPost('attachments', newAttachmentPayload);
        state.attachments.push(savedAttachment);
        updateUI(['modal']);
    } catch(error) {
        console.error("File upload failed:", error);
        alert("File upload failed. Please try again.");
    }
}

export async function handleRemoveAttachment(attachmentId: string) {
    const attIndex = state.attachments.findIndex(a => a.id === attachmentId);
    if (attIndex === -1) return;

    const [removedAttachment] = state.attachments.splice(attIndex, 1);
    updateUI(['modal']);

    try {
        await apiFetch('/api?action=data&resource=attachments', {
            method: 'DELETE',
            body: JSON.stringify({ id: attachmentId }),
        });
    } catch (error) {
        console.error("Failed to remove attachment:", error);
        state.attachments.splice(attIndex, 0, removedAttachment);
        updateUI(['modal']);
    }
}

export async function handleCustomFieldValueUpdate(taskId: string, fieldId: string, value: any) {
    if (!state.activeWorkspaceId) return;

    const existingValue = state.customFieldValues.find(v => v.taskId === taskId && v.fieldId === fieldId);
    const payload = {
        workspaceId: state.activeWorkspaceId,
        taskId,
        fieldId,
        value,
    };
    
    if (existingValue) {
        const originalValue = existingValue.value;
        existingValue.value = value;
        updateUI(['modal']);
        try {
            await apiPut('custom_field_values', { ...payload, id: existingValue.id });
        } catch (error) {
            existingValue.value = originalValue; // Revert
            updateUI(['modal']);
            alert("Could not update custom field.");
        }
    } else {
        const tempId = `temp-${Date.now()}`;
        state.customFieldValues.push({ ...payload, id: tempId } as any);
        updateUI(['modal']);
        try {
            const [savedValue] = await apiPost('custom_field_values', payload);
            const tempIndex = state.customFieldValues.findIndex(v => v.id === tempId);
            if (tempIndex > -1) {
                state.customFieldValues[tempIndex] = savedValue;
            }
        } catch (error) {
            const tempIndex = state.customFieldValues.findIndex(v => v.id === tempId);
            if (tempIndex > -1) {
                state.customFieldValues.splice(tempIndex, 1);
            }
            updateUI(['modal']);
            alert("Could not save custom field value.");
        }
    }
}

export async function handleAddCustomFieldDefinition(name: string, type: CustomFieldType) {
    if (!state.activeWorkspaceId) return;

    const payload: Omit<CustomFieldDefinition, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name,
        type,
    };

    try {
        const [savedField] = await apiPost('custom_field_definitions', payload);
        state.customFieldDefinitions.push(savedField);
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to add custom field:", error);
        alert("Could not add custom field.");
    }
}

export async function handleSetTaskReminder(taskId: string, reminderDate: string | null) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalReminder = task.reminderAt;
    task.reminderAt = reminderDate;
    updateUI(['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, reminderAt: reminderDate });
    } catch (error) {
        console.error("Failed to set reminder:", error);
        task.reminderAt = originalReminder; // Revert
        updateUI(['modal']);
        alert("Could not save the reminder.");
    }
}

export async function handleToggleFollowUp(taskId: string, type: 'onInactivity' | 'onUnansweredQuestion') {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalConfig = { ...(task.followUpConfig || {}) };
    if (!task.followUpConfig) {
        task.followUpConfig = {};
    }

    task.followUpConfig[type] = !task.followUpConfig[type];
    updateUI(['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, followUpConfig: task.followUpConfig });
    } catch (error) {
        console.error("Failed to toggle follow-up:", error);
        task.followUpConfig = originalConfig; // Revert
        updateUI(['modal']);
        alert("Could not save follow-up preference.");
    }
}

export async function handleDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task permanently?")) return;
    
    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const [removedTask] = state.tasks.splice(taskIndex, 1);
    updateUI(['page']);

    try {
        await apiFetch('/api?action=data&resource=tasks', {
            method: 'DELETE',
            body: JSON.stringify({ id: taskId }),
        });
    } catch (error) {
        console.error("Failed to delete task:", error);
        state.tasks.splice(taskIndex, 0, removedTask);
        updateUI(['page']);
    }
}

export async function handleToggleTaskArchive(taskId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalStatus = task.isArchived;
    task.isArchived = !task.isArchived;
    updateUI(['page']);

    try {
        await apiPut('tasks', { id: taskId, isArchived: task.isArchived });
    } catch (error) {
        console.error("Failed to update task archive status:", error);
        task.isArchived = originalStatus;
        updateUI(['page']);
    }
}

export async function handleChangeGanttViewMode(mode: 'Day' | 'Week' | 'Month') {
    state.ui.tasks.ganttViewMode = mode;
    updateUI(['page']);
}


export async function handleToggleProjectTaskStatus(taskId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalStatus = task.status;
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    task.status = newStatus;
    updateUI(['side-panel']);

    try {
        await apiPut('tasks', { id: taskId, status: newStatus });
    } catch (error) {
        console.error("Failed to update task status:", error);
        task.status = originalStatus;
        updateUI(['side-panel']);
        alert("Could not update task status.");
    }
}