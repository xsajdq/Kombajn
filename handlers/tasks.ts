

import { state, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Comment, Task, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldType, CustomFieldValue, TaskAssignee, Tag, TaskTag } from '../types.ts';
import { createNotification } from './notifications.ts';
import { showModal } from './ui.ts';
import { runAutomations } from './automations.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { parseDurationStringToHours } from '../utils.ts';

// Declare Google API types to satisfy TypeScript
declare const gapi: any;
declare const google: any;

export function openTaskDetail(taskId: string) {
    showModal('taskDetail', { taskId });
}

export async function handleAddTaskComment(taskId: string, content: string, successCallback: () => void) {
    if (!content || !state.currentUser) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCommentPayload: Omit<Comment, 'id'|'createdAt'> = {
        workspaceId: task.workspaceId,
        taskId,
        content: content, // Content is already trimmed and parsed
        userId: state.currentUser.id,
    };

    try {
        const [savedComment] = await apiPost('comments', newCommentPayload);
        state.comments.push(savedComment);
        
        successCallback(); // Clear the input field
        renderApp();

        // Handle notifications
        const mentionRegex = /@\[([^\]]+)\]\(user:([a-fA-F0-9-]+)\)/g;
        const mentionedUserIds = new Set<string>();
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
            mentionedUserIds.add(match[2]);
        }
        
        const assignees = state.taskAssignees.filter(a => a.taskId === task.id);

        // Notify mentioned users
        for (const userId of mentionedUserIds) {
            if (userId !== state.currentUser.id) {
                 await createNotification('mention', { taskId, userIdToNotify: userId, actorId: state.currentUser.id });
            }
        }

        // Notify all assignees if they weren't the commenter or mentioned
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

export async function handleTaskDetailUpdate(taskId: string, field: keyof Task, value: any) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    let finalValue: any;

    if (field === 'estimatedHours') {
        finalValue = parseDurationStringToHours(value as string);
    } else {
        finalValue = value === '' ? null : value;
    }

    const oldValue = task[field];
    
    if (oldValue === finalValue || (oldValue === null && value === '')) {
        return;
    }
    
    // Optimistic update
    (task as any)[field] = finalValue;
    renderApp();

    try {
        // The API layer will handle converting camelCase field to snake_case for the database
        await apiPut('tasks', { id: taskId, [field]: finalValue });

        if (field === 'status') {
            const assignees = state.taskAssignees.filter(a => a.taskId === taskId);
            for (const assignee of assignees) {
                if (assignee.userId !== state.currentUser!.id) {
                    await createNotification('status_change', { taskId, userIdToNotify: assignee.userId, newStatus: finalValue, actorId: state.currentUser!.id });
                }
            }
            runAutomations('statusChange', { task });
        }
    } catch (error) {
        console.error(`Failed to update task field ${field}:`, error);
        alert(`Could not update task. Reverting change.`);
        // Revert
        (task as any)[field] = oldValue;
        renderApp();
    }
}

export async function handleToggleAssignee(taskId: string, userId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    const existingIndex = state.taskAssignees.findIndex(a => a.taskId === taskId && a.userId === userId);

    if (existingIndex > -1) {
        // --- REMOVE ASSIGNEE ---
        const [removed] = state.taskAssignees.splice(existingIndex, 1);
        renderApp(); // Optimistic update
        try {
            await apiFetch('/api/data/task_assignees', {
                method: 'DELETE',
                body: JSON.stringify({ taskId, userId }),
            });
        } catch (error) {
            console.error('Failed to remove assignee', error);
            state.taskAssignees.splice(existingIndex, 0, removed); // Revert
            renderApp();
        }
    } else {
        // --- ADD ASSIGNEE ---
        const newAssignee: TaskAssignee = { taskId, userId, workspaceId: task.workspaceId };
        state.taskAssignees.push(newAssignee);
        renderApp(); // Optimistic update
        try {
            await apiPost('task_assignees', newAssignee);
            if (userId !== state.currentUser.id) {
                await createNotification('new_assignment', { taskId, userIdToNotify: userId, actorId: state.currentUser.id });
            }
        } catch (error) {
            console.error('Failed to add assignee', error);
            state.taskAssignees.pop(); // Revert
            renderApp();
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
    };

    try {
        const [newSubtask] = await apiPost('tasks', subtaskPayload);
        state.tasks.push(newSubtask);
        renderApp();
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
    subtask.status = newStatus; // Optimistic update
    renderApp();

    try {
        await apiPut('tasks', { id: subtaskId, status: newStatus });
    } catch (error) {
        console.error("Failed to toggle subtask status:", error);
        subtask.status = oldStatus; // Revert
        renderApp();
    }
}

export async function handleToggleProjectTaskStatus(taskId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const oldStatus = task.status;
    
    // Optimistic update
    task.status = newStatus;
    renderApp();

    try {
        await apiPut('tasks', { id: taskId, status: newStatus });
    } catch (error) {
        console.error('Failed to toggle project task status', error);
        // Revert on failure
        task.status = oldStatus;
        renderApp();
        alert('Could not update task status.');
    }
}

export async function handleDeleteSubtask(subtaskId: string) {
    const subtaskIndex = state.tasks.findIndex(t => t.id === subtaskId);
    if (subtaskIndex === -1) return;

    const [removedSubtask] = state.tasks.splice(subtaskIndex, 1);
    renderApp();

    try {
        await apiFetch(`/api/data/tasks`, {
            method: 'DELETE',
            body: JSON.stringify({ id: subtaskId }),
        });
    } catch (error) {
        console.error("Failed to delete subtask:", error);
        state.tasks.splice(subtaskIndex, 0, removedSubtask); // Revert
        renderApp();
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
        renderApp();
    } catch (error) {
        console.error("Failed to add dependency:", error);
        alert("Could not add dependency.");
    }
}

export async function handleRemoveDependency(dependencyId: string) {
    const depIndex = state.dependencies.findIndex(d => d.id === dependencyId);
    if (depIndex === -1) return;

    const [removedDep] = state.dependencies.splice(depIndex, 1);
    renderApp();

    try {
        await apiFetch('/api/data/task_dependencies', {
            method: 'DELETE',
            body: JSON.stringify({ id: dependencyId }),
        });
    } catch (error) {
        console.error("Failed to remove dependency:", error);
        state.dependencies.splice(depIndex, 0, removedDep);
        renderApp();
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
        renderApp();
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
        const config = await apiFetch(`/api/app-config?action=token&provider=google_drive&workspaceId=${activeWorkspaceId}`);
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
                        renderApp();
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
    renderApp();

    try {
        await apiFetch('/api/data/attachments', {
            method: 'DELETE',
            body: JSON.stringify({ id: attachmentId }),
        });
    } catch (error) {
        console.error("Failed to remove attachment:", error);
        state.attachments.splice(attachmentIndex, 0, removedAttachment);
        renderApp();
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
        renderApp();
    } catch (error) {
        console.error("Failed to add custom field:", error);
    }
}

export async function handleDeleteCustomFieldDefinition(fieldId: string) {
    const fieldIndex = state.customFieldDefinitions.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return;

    const [removedField] = state.customFieldDefinitions.splice(fieldIndex, 1);
    renderApp();

    try {
        await apiFetch('/api/data/custom_field_definitions', {
            method: 'DELETE',
            body: JSON.stringify({ id: fieldId }),
        });
    } catch (error) {
        console.error("Failed to delete custom field:", error);
        state.customFieldDefinitions.splice(fieldIndex, 0, removedField);
        renderApp();
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
        renderApp();
        try {
            await apiPut('custom_field_values', { id: existingValue.id, value: value });
        } catch (error) {
            existingValue.value = originalValue;
            renderApp();
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
            renderApp();
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
            renderApp();
            await apiFetch('/api/data/task_tags', {
                method: 'DELETE',
                body: JSON.stringify({ taskId: taskId, tagId: finalTagId }),
            });
        } else {
            const newLink = { taskId, tagId: finalTagId, workspaceId: task.workspaceId };
            state.taskTags.push(newLink);
            renderApp();
            await apiPost('task_tags', newLink);
        }
    } catch (error) {
        console.error("Failed to toggle tag:", error);
        renderApp();
    }
}

export async function handleToggleTaskArchive(taskId: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const isArchiving = !task.isArchived;
    const originalValue = task.isArchived;

    // Optimistic update
    task.isArchived = isArchiving;
    renderApp();

    try {
        await apiPut('tasks', { id: taskId, isArchived: isArchiving });
    } catch (error) {
        console.error('Failed to update task archive status:', error);
        alert('Could not update task. Please try again.');
        task.isArchived = originalValue; // Revert
        renderApp();
    }
}

export async function handleDeleteTask(taskId: string) {
    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    if (!confirm('Are you sure you want to permanently delete this task and all its related data (comments, time logs, etc)? This action cannot be undone.')) {
        return;
    }

    const [removedTask] = state.tasks.splice(taskIndex, 1);
    // Remove related data from state
    state.taskAssignees = state.taskAssignees.filter(a => a.taskId !== taskId);
    state.comments = state.comments.filter(c => c.taskId !== taskId);
    state.timeLogs = state.timeLogs.filter(l => l.taskId !== taskId);
    state.dependencies = state.dependencies.filter(d => d.blockedTaskId !== taskId && d.blockingTaskId !== taskId);
    state.taskTags = state.taskTags.filter(tt => tt.taskId !== taskId);
    state.customFieldValues = state.customFieldValues.filter(cfv => cfv.taskId !== taskId);
    // Subtasks are also tasks, so they need to be removed as well.
    state.tasks = state.tasks.filter(t => t.parentId !== taskId);

    renderApp();

    try {
        // The backend should have cascading deletes set up for this to work properly.
        await apiFetch(`/api/data/tasks`, {
            method: 'DELETE',
            body: JSON.stringify({ id: taskId }),
        });
    } catch (error) {
        console.error("Failed to delete task:", error);
        alert('Could not delete the task from the server. The page may need to be refreshed to see the correct state.');
        // Reverting is very complex here because of all the related data.
    }
}