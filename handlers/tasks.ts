

import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Comment, Task, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldType, CustomFieldValue } from '../types.ts';
import { createNotification } from './notifications.ts';
import { showModal } from './ui.ts';
import { runAutomations } from './automations.ts';

export function openTaskDetail(taskId: string) {
    showModal('taskDetail', { taskId });
}

export function handleAddTaskComment(taskId: string, input: HTMLInputElement) {
    const content = input.value;
    const trimmedContent = content.trim();
    if (!trimmedContent || !state.currentUser) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newComment: Comment = {
        id: generateId(),
        workspaceId: task.workspaceId,
        taskId,
        content: trimmedContent,
        userId: state.currentUser.id,
        createdAt: new Date().toISOString(),
    };
    state.comments.push(newComment);
    
    // Notify assignee if they are not the one commenting
    if (task.assigneeId && task.assigneeId !== state.currentUser.id) {
        createNotification('new_comment', { taskId, userIdToNotify: task.assigneeId, actorId: state.currentUser.id });
    }

    // Handle mentions
    const mentionRegex = /@\[([^\]]+)\]\(user:([a-zA-Z0-9]+)\)/g;
    let match;
    const notifiedUsers = new Set<string>();
    notifiedUsers.add(state.currentUser.id); // Don't notify self
    if (task.assigneeId) notifiedUsers.add(task.assigneeId); // Don't double-notify assignee

    while ((match = mentionRegex.exec(trimmedContent)) !== null) {
        const mentionedUserId = match[2];
        if (!notifiedUsers.has(mentionedUserId)) {
            createNotification('mention', { taskId, userIdToNotify: mentionedUserId, actorId: state.currentUser.id });
            notifiedUsers.add(mentionedUserId);
        }
    }

    saveState();
    input.value = ''; // Clear the input field
    state.ui.mention = { query: null, target: null, activeIndex: 0 }; // Reset mention state
    renderApp();
}

export function handleTaskDetailUpdate(taskId: string, field: keyof Task, value: any) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task && state.currentUser) {
        const oldValue = task[field];
        if (oldValue === value) return; // No change

        // @ts-ignore
        task[field] = value;
        
        // Create notifications for specific changes
        if (field === 'assigneeId' && value && value !== state.currentUser.id) {
            createNotification('new_assignment', { taskId, userIdToNotify: value, actorId: state.currentUser.id });
        } else if (field === 'status') {
             if (task.assigneeId && task.assigneeId !== state.currentUser.id) {
                 createNotification('status_change', { taskId, userIdToNotify: task.assigneeId, newStatus: value, actorId: state.currentUser.id });
            }
            runAutomations('statusChange', { task });
        }

        saveState();
        renderApp();
    }
}

export function handleAddSubtask(parentTaskId: string, subtaskName: string) {
    const parentTask = state.tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return;

    const newSubtask: Task = {
        id: generateId(),
        workspaceId: parentTask.workspaceId,
        name: subtaskName,
        projectId: parentTask.projectId,
        status: 'todo',
        parentId: parentTaskId,
    };
    state.tasks.push(newSubtask);
    saveState();
    renderApp();
}

export function handleToggleSubtaskStatus(subtaskId: string) {
    const subtask = state.tasks.find(t => t.id === subtaskId);
    if (subtask) {
        subtask.status = subtask.status === 'done' ? 'todo' : 'done';
        saveState();
        renderApp();
    }
}

export function handleDeleteSubtask(subtaskId: string) {
    state.tasks = state.tasks.filter(t => t.id !== subtaskId);
    saveState();
    renderApp();
}

export function handleAddAttachment(taskId: string, file: File) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newAttachment: Attachment = {
        id: generateId(),
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: taskId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        createdAt: new Date().toISOString(),
    };
    state.attachments.push(newAttachment);
    saveState();
    renderApp();
}

export function handleRemoveAttachment(attachmentId: string) {
    state.attachments = state.attachments.filter(a => a.id !== attachmentId);
    saveState();
    renderApp();
}

// --- Dependencies ---
export function handleAddDependency(blockingTaskId: string, blockedTaskId: string) {
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return;

    // Prevent circular dependencies
    if (blockingTaskId === blockedTaskId) return;

    const newDependency: TaskDependency = {
        id: generateId(),
        workspaceId,
        blockingTaskId,
        blockedTaskId,
    };
    state.dependencies.push(newDependency);
    saveState();
    renderApp();
}

export function handleRemoveDependency(dependencyId: string) {
    state.dependencies = state.dependencies.filter(d => d.id !== dependencyId);
    saveState();
    renderApp();
}

// --- Custom Fields ---
export function handleAddCustomFieldDefinition(name: string, type: CustomFieldType) {
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId || !name) return;

    const newField: CustomFieldDefinition = {
        id: generateId(),
        workspaceId,
        name,
        type,
    };
    state.customFieldDefinitions.push(newField);
    saveState();
    renderApp();
}

export function handleDeleteCustomFieldDefinition(fieldId: string) {
    state.customFieldDefinitions = state.customFieldDefinitions.filter(f => f.id !== fieldId);
    // Also remove all values associated with this definition
    state.customFieldValues = state.customFieldValues.filter(v => v.fieldId !== fieldId);
    saveState();
    renderApp();
}

export function handleCustomFieldValueUpdate(taskId: string, fieldId: string, value: any) {
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return;

    let existingValue = state.customFieldValues.find(v => v.taskId === taskId && v.fieldId === fieldId);

    if (existingValue) {
        existingValue.value = value;
    } else {
        const newValue: CustomFieldValue = {
            id: generateId(),
            workspaceId,
            taskId,
            fieldId,
            value,
        };
        state.customFieldValues.push(newValue);
    }
    saveState();
    renderApp();
}