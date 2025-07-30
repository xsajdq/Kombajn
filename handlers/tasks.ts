import { state, generateId } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Comment, Task, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldType, CustomFieldValue, TaskAssignee, Tag, TaskTag, CommentReaction } from '../types.ts';
import { createNotification } from './notifications.ts';
import { showModal } from './ui.ts';
import { runAutomations } from './automations.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { parseDurationStringToHours } from '../utils.ts';

declare const gapi: any;
declare const google: any;

export function openTaskDetail(taskId: string) {
    showModal('taskDetail', { taskId });
}

export async function handleAddTaskComment(taskId: string, content: string, parentId: string | null, successCallback: () => void) {
    if (!content || !state.currentUser) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCommentPayload: Omit<Comment, 'id'|'createdAt'|'reactions'> = {
        workspaceId: task.workspaceId,
        taskId,
        content: content,
        userId: state.currentUser.id,
        parentId: parentId || undefined,
    };

    try {
        const [savedComment] = await apiPost('comments', newCommentPayload);
        state.comments.push(savedComment);
        
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
            state.taskAssignees.splice(existingIndex, 0, removed);
            updateUI(['modal', 'page']);
        }
    } else {
        const newAssignee: TaskAssignee = { taskId, userId, workspaceId: task.workspaceId };
        state.taskAssignees.push(newAssignee);
        updateUI(['modal', 'page']);
        try {
            await apiPost('task_assignees', newAssignee);
            if (userId !== state.currentUser.id) {
                await createNotification('new_assignment', { taskId, userIdToNotify: userId, actorId: state.currentUser.id });
            }
        } catch (error) {
            console.error('Failed to add assignee', error);
            state.taskAssignees.pop();
            updateUI(['modal', 'page']);
        }
    }
}

export async function handleAddSubtask(parentTaskId: string, subtaskName: string) {
    const parentTask = state.tasks.find(t => t.id === parentTaskId);
    if (!parentTask || !state.activeWorkspaceId) return;

    const subtaskPayload: Partial<Task> = {
        workspaceId: state.activeWorkspaceId,
        projectId: parentTask.projectId,
        name: subtaskName,
        status: 'todo',
        parentId: parentTaskId,
        isArchived: false,
    };

    try {
        const [newSubtask] = await apiPost('tasks', subtaskPayload);
        state.tasks.push(newSubtask);
        updateUI(['modal']);
    } catch (error) {
        console.error("Failed to add subtask:", error);
        alert("Could not add subtask.");
    }
}

export async function handleToggleSubtaskStatus(subtaskId: string) {
    const subtask = state.tasks.find(t => t.id === subtaskId);
    if (!subtask) return;

    const newStatus = subtask.status === 'done' ? 'todo' : 'done';
    const oldStatus = subtask.status;
    subtask.status = newStatus;
    updateUI(['modal']);

    try {
        await apiPut('tasks', { id: subtaskId, status: newStatus });
    } catch (error) {
        console.error("Failed to toggle subtask status:", error);
        subtask.status = oldStatus;
        updateUI(['modal']);
    }
}

export async function handleToggleProjectTaskStatus(taskId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const oldStatus = task.status;
    
    task.status = newStatus;
    updateUI(['side-panel']);

    try {
        await apiPut('tasks', { id: taskId, status: newStatus });
    } catch (error) {
        console.error('Failed to toggle project task status', error);
        task.status = oldStatus;
        updateUI(['side-panel']);
        alert('Could not update task status.');
    }
}

export async function handleDeleteSubtask(subtaskId: string) {
    const subtaskIndex = state.tasks.findIndex(t => t.id === subtaskId);
    if (subtaskIndex === -1) return;

    const [removedSubtask] = state.tasks.splice(subtaskIndex, 1);
    updateUI(['modal']);

    try {
        await apiFetch(`/api?action=data&resource=tasks`, {
            method: 'DELETE',
            body: JSON.stringify({ id: subtaskId }),
        });
    } catch (error) {
        console.error("Failed to delete subtask:", error);
        state.tasks.splice(subtaskIndex, 0, removedSubtask);
        updateUI(['modal']);
    }
}

export async function handleAddDependency(blockingTaskId: string, blockedTaskId: string) {
    const task = state.tasks.find(t => t.id === blockedTaskId);
    if (!task) return;

    const dependencyPayload: Omit<TaskDependency, 'id'> = {
        workspaceId: task.workspaceId,
        blockingTaskId,
        blockedTaskId,
    };

    try {
        const [newDependency] = await apiPost('task_dependencies', dependencyPayload);
        state.dependencies.push(newDependency);
        updateUI(['modal']);
    } catch (error) {
        console.error("Failed to add dependency:", error);
        alert("Could not add dependency.");
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
    } catch (error) {
        console.error("File upload failed:", error);
        alert("File upload failed. Please try again.");
    }
}

export async function handleAttachGoogleDriveFile(taskId: string) {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
        const config = await apiFetch(`/api?action=token&provider=google_drive&workspaceId=${activeWorkspaceId}`);
        const { token, developerKey, clientId } = config;

        if (!token) {
            throw new Error("Could not retrieve Google Drive access token.");
        }
        
        const showPicker = () => {
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(token)
                .setDeveloperKey(developerKey)
                .setAppId(clientId)
                .setCallback(async (data: any) => {
                    if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
                        const doc = data[google.picker.Response.DOCUMENTS][0];
                        const attachmentPayload: Omit<Attachment, 'id' | 'createdAt'> = {
                            workspaceId: activeWorkspaceId,
                            projectId: task.projectId,
                            taskId: taskId,
                            fileName: doc.name,
                            fileSize: doc.sizeBytes,
                            fileType: doc.mimeType,
                            provider: 'google_drive',
                            externalUrl: doc.url,
                            fileId: doc.id,
                            iconUrl: doc.iconUrl,
                        };
                        const [savedAttachment] = await apiPost('attachments', attachmentPayload);
                        state.attachments.push(savedAttachment);
                        updateUI(['modal']);
                    }
                })
                .build();
            picker.setVisible(true);
        };
        
        gapi.load('picker', showPicker);

    } catch (error) {
        console.error("Error attaching Google Drive file:", error);
        alert("Could not connect to Google Drive. Please ensure the integration is active in Settings.");
    }
}

export async function handleRemoveAttachment(attachmentId: string) {
    const attachmentIndex = state.attachments.findIndex(a => a.id === attachmentId);
    if (attachmentIndex === -1) return;

    const [removedAttachment] = state.attachments.splice(attachmentIndex, 1);
    updateUI(['modal']);

    try {
        await apiFetch('/api?action=data&resource=attachments', {
            method: 'DELETE',
            body: JSON.stringify({ id: attachmentId }),
        });
    } catch (error) {
        console.error("Failed to remove attachment:", error);
        state.attachments.splice(attachmentIndex, 0, removedAttachment);
        updateUI(['modal']);
    }
}

export async function handleAddCustomFieldDefinition(name: string, type: CustomFieldType) {
    if (!state.activeWorkspaceId) return;
    const payload = {
        workspaceId: state.activeWorkspaceId,
        name,
        type,
    };
    try {
        const [newField] = await apiPost('custom_field_definitions', payload);
        state.customFieldDefinitions.push(newField);
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to add custom field:", error);
    }
}

export async function handleDeleteCustomFieldDefinition(fieldId: string) {
    const fieldIndex = state.customFieldDefinitions.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return;

    const [removedField] = state.customFieldDefinitions.splice(fieldIndex, 1);
    updateUI(['page']);

    try {
        await apiFetch('/api?action=data&resource=custom_field_definitions', {
            method: 'DELETE',
            body: JSON.stringify({ id: fieldId }),
        });
    } catch (error) {
        console.error("Failed to delete custom field:", error);
        state.customFieldDefinitions.splice(fieldIndex, 0, removedField);
        updateUI(['page']);
    }
}

export async function handleCustomFieldValueUpdate(taskId: string, fieldId: string, value: any) {
    const fieldDef = state.customFieldDefinitions.find(f => f.id === fieldId);
    const task = state.tasks.find(t => t.id === taskId);
    if (!fieldDef || !task) return;

    let existingValue = state.customFieldValues.find(v => v.fieldId === fieldId && v.taskId === taskId);

    if (existingValue) {
        const originalValue = existingValue.value;
        existingValue.value = value;
        updateUI(['modal']);
        try {
            await apiPut('custom_field_values', { id: existingValue.id, value: value });
        } catch (error) {
            existingValue.value = originalValue;
            updateUI(['modal']);
        }
    } else {
        const payload = {
            workspaceId: task.workspaceId,
            taskId,
            fieldId,
            value,
        };
        try {
            const [newValue] = await apiPost('custom_field_values', payload);
            state.customFieldValues.push(newValue);
            updateUI(['modal']);
        } catch (error) {
            console.error("Failed to save custom field value:", error);
        }
    }
}

export async function handleToggleTag(taskId: string, tagId: string, newTagName?: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    let finalTagId = tagId;

    try {
        if (newTagName) {
            const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            const [newTag] = await apiPost('tags', { workspaceId: task.workspaceId, name: newTagName, color });
            state.tags.push(newTag);
            finalTagId = newTag.id;
        }

        const existingLinkIndex = state.taskTags.findIndex(tt => tt.taskId === taskId && tt.tagId === finalTagId);

        if (existingLinkIndex > -1) {
            const [removedLink] = state.taskTags.splice(existingLinkIndex, 1);
            updateUI(['modal']);
            await apiFetch('/api?action=data&resource=task_tags', {
                method: 'DELETE',
                body: JSON.stringify({ taskId: taskId, tagId: finalTagId }),
            });
        } else {
            const newLink = { taskId, tagId: finalTagId, workspaceId: task.workspaceId };
            state.taskTags.push(newLink);
            updateUI(['modal']);
            await apiPost('task_tags', newLink);
        }
    } catch (error) {
        console.error("Failed to toggle tag:", error);
        updateUI(['modal']);
    }
}

export async function handleToggleTaskArchive(taskId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const isArchiving = !task.isArchived;
    const originalValue = task.isArchived;
    task.isArchived = isArchiving;
    updateUI(['page']);

    try {
        await apiPut('tasks', { id: taskId, isArchived: isArchiving });
    } catch (error) {
        console.error('Failed to update task archive status:', error);
        alert('Could not update task. Please try again.');
        task.isArchived = originalValue;
        updateUI(['page']);
    }
}

export async function handleDeleteTask(taskId: string) {
    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    if (!confirm('Are you sure you want to permanently delete this task and all its related data? This action cannot be undone.')) {
        return;
    }

    const [removedTask] = state.tasks.splice(taskIndex, 1);
    state.taskAssignees = state.taskAssignees.filter(a => a.taskId !== taskId);
    state.comments = state.comments.filter(c => c.taskId !== taskId);
    state.timeLogs = state.timeLogs.filter(l => l.taskId !== taskId);
    state.dependencies = state.dependencies.filter(d => d.blockedTaskId !== taskId && d.blockingTaskId !== taskId);
    state.taskTags = state.taskTags.filter(tt => tt.taskId !== taskId);
    state.customFieldValues = state.customFieldValues.filter(cfv => cfv.taskId !== taskId);
    state.tasks = state.tasks.filter(t => t.parentId !== taskId);
    updateUI(['page']);

    try {
        await apiFetch(`/api?action=data&resource=tasks`, {
            method: 'DELETE',
            body: JSON.stringify({ id: taskId }),
        });
    } catch (error) {
        console.error("Failed to delete task:", error);
        alert('Could not delete the task from the server.');
    }
}

export async function handleAddChecklistItem(taskId: string, text: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newItem = { id: generateId(), text, completed: false };
    if (!task.checklist) task.checklist = [];
    task.checklist.push(newItem);
    updateUI(['modal']);

    try {
        await apiPut('tasks', { id: taskId, checklist: task.checklist });
    } catch (error) {
        console.error("Failed to add checklist item:", error);
        alert("Could not add checklist item.");
        task.checklist.pop();
        updateUI(['modal']);
    }
}

export async function handleToggleChecklistItem(taskId: string, itemId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    const item = task.checklist.find(i => i.id === itemId);
    if (!item) return;

    const originalStatus = item.completed;
    item.completed = !item.completed;
    updateUI(['modal']);

    try {
        await apiPut('tasks', { id: taskId, checklist: task.checklist });
    } catch (error) {
        console.error("Failed to toggle checklist item:", error);
        alert("Could not update checklist item.");
        item.completed = originalStatus;
        updateUI(['modal']);
    }
}

export async function handleDeleteChecklistItem(taskId: string, itemId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    const itemIndex = task.checklist.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const [removedItem] = task.checklist.splice(itemIndex, 1);
    updateUI(['modal']);

    try {
        await apiPut('tasks', { id: taskId, checklist: task.checklist });
    } catch (error) {
        console.error("Failed to delete checklist item:", error);
        alert("Could not delete checklist item.");
        task.checklist.splice(itemIndex, 0, removedItem);
        updateUI(['modal']);
    }
}

export function handleChangeGanttViewMode(mode: 'Day' | 'Week' | 'Month') {
    if (state.ui.tasks.ganttViewMode !== mode) {
        state.ui.tasks.ganttViewMode = mode;
        updateUI(['page']);
    }
}