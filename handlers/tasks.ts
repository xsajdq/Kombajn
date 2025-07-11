


import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Comment, Task, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldType, CustomFieldValue, TaskAssignee } from '../types.ts';
import { createNotification } from './notifications.ts';
import { showModal } from './ui.ts';
import { runAutomations } from './automations.ts';
import { apiPost, apiPut } from '../services/api.ts';

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

    // Convert empty string from form inputs to null for the database
    const finalValue = value === '' ? null : value;

    const oldValue = task[field];
    // Also handle case where old value is null and new is empty string, which we consider no change
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
                if (assignee.userId !== state.currentUser.id) {
                    await createNotification('status_change', { taskId, userIdToNotify: assignee.userId, newStatus: finalValue, actorId: state.currentUser.id });
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
            await apiPost('task_assignees/delete', { taskId: taskId, userId: userId });
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
            const [saved] = await apiPost('task_assignees', { taskId, userId, workspaceId: task.workspaceId });
            // The record from the DB doesn't have a unique ID, so we just trust our optimistic one.
        } catch (error) {
            console.error('Failed to add assignee', error);
            state.taskAssignees = state.taskAssignees.filter(a => !(a.taskId === taskId && a.userId === userId)); // Revert
            renderApp();
        }
    }
}

export async function handleToggleTag(taskId: string, tagId: string, newTagName?: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // --- CREATE NEW TAG ---
    if (newTagName) {
        const workspaceId = task.workspaceId;
        const colors = ['#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#2ecc71', '#1abc9c', '#e67e22', '#34495e'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        try {
            // Create the tag first
            const [newTag] = await apiPost('tags', { name: newTagName, color, workspaceId });
            state.tags.push(newTag);
            
            // Then link it to the task
            const [newTaskTag] = await apiPost('task_tags', { taskId, tagId: newTag.id, workspaceId });
            state.taskTags.push(newTaskTag);
            renderApp();
        } catch(error) {
            console.error("Failed to create new tag", error);
        }
        return;
    }

    // --- TOGGLE EXISTING TAG ---
    const existingIndex = state.taskTags.findIndex(tt => tt.taskId === taskId && tt.tagId === tagId);

    if (existingIndex > -1) {
        // Remove
        const [removed] = state.taskTags.splice(existingIndex, 1);
        renderApp();
        try {
            await apiPost('task_tags/delete', { taskId, tagId });
        } catch (error) {
            console.error("Failed to remove tag from task", error);
            state.taskTags.splice(existingIndex, 0, removed); // Revert
            renderApp();
        }
    } else {
        // Add
        const newTaskTag = { taskId, tagId, workspaceId: task.workspaceId };
        state.taskTags.push(newTaskTag);
        renderApp();
        try {
            await apiPost('task_tags', newTaskTag);
        } catch (error) {
            console.error("Failed to add tag to task", error);
            state.taskTags = state.taskTags.filter(tt => !(tt.taskId === taskId && tt.tagId === tagId)); // Revert
            renderApp();
        }
    }
}


export async function handleAddSubtask(parentTaskId: string, subtaskName: string) {
    const parentTask = state.tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return;

    const newSubtaskPayload: Partial<Task> = {
        workspaceId: parentTask.workspaceId,
        name: subtaskName,
        projectId: parentTask.projectId,
        status: 'todo',
        parentId: parentTaskId,
    };

    try {
        const [savedSubtask] = await apiPost('tasks', newSubtaskPayload);
        state.tasks.push(savedSubtask);
        renderApp();
    } catch(error) {
        console.error("Failed to add subtask:", error);
        alert("Could not add subtask.");
    }
}

export async function handleToggleSubtaskStatus(subtaskId: string) {
    const subtask = state.tasks.find(t => t.id === subtaskId);
    if (subtask) {
        const originalStatus = subtask.status;
        const newStatus = originalStatus === 'done' ? 'todo' : 'done';
        subtask.status = newStatus; // Optimistic update
        renderApp();
        try {
            await apiPut('tasks', { id: subtaskId, status: newStatus });
        } catch (error) {
            console.error("Failed to toggle subtask status:", error);
            subtask.status = originalStatus; // Revert
            renderApp();
        }
    }
}

export async function handleDeleteSubtask(subtaskId: string) {
    const subtaskIndex = state.tasks.findIndex(t => t.id === subtaskId);
    if (subtaskIndex > -1) {
        const [removedSubtask] = state.tasks.splice(subtaskIndex, 1); // Optimistic remove
        renderApp();
        try {
            await apiPost('tasks/delete', { id: subtaskId }); // Using a generic delete endpoint pattern
        } catch (error) {
            console.error("Failed to delete subtask:", error);
            state.tasks.splice(subtaskIndex, 0, removedSubtask); // Revert
            renderApp();
            alert("Could not delete subtask.");
        }
    }
}

export async function handleAddAttachment(taskId: string, file: File) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // In a real app, this would first upload to a storage service (like Supabase Storage)
    // and then save the URL/path to the database. We'll just save metadata for now.
    const newAttachmentPayload: Omit<Attachment, 'id' | 'createdAt'> = {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: taskId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
    };

    try {
        const [savedAttachment] = await apiPost('attachments', newAttachmentPayload);
        state.attachments.push(savedAttachment);
        renderApp();
    } catch(error) {
        console.error("Failed to add attachment:", error);
        alert("Could not add attachment.");
    }
}

export async function handleRemoveAttachment(attachmentId: string) {
    const attIndex = state.attachments.findIndex(a => a.id === attachmentId);
    if (attIndex > -1) {
        const [removedAttachment] = state.attachments.splice(attIndex, 1);
        renderApp();
        try {
             await apiPost('attachments/delete', { id: attachmentId });
        } catch(error) {
            state.attachments.splice(attIndex, 0, removedAttachment);
            renderApp();
            alert("Could not remove attachment.");
        }
    }
}

// --- Dependencies ---
export async function handleAddDependency(blockingTaskId: string, blockedTaskId: string) {
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId || blockingTaskId === blockedTaskId) return;

    const newDependencyPayload: Omit<TaskDependency, 'id'> = {
        workspaceId,
        blockingTaskId,
        blockedTaskId,
    };
    try {
        const [savedDep] = await apiPost('task_dependencies', newDependencyPayload);
        state.dependencies.push(savedDep);
        renderApp();
    } catch(error) {
        console.error("Failed to add dependency:", error);
        alert("Could not add dependency.");
    }
}

export async function handleRemoveDependency(dependencyId: string) {
    const depIndex = state.dependencies.findIndex(d => d.id === dependencyId);
    if (depIndex > -1) {
        const [removedDep] = state.dependencies.splice(depIndex, 1);
        renderApp();
        try {
            await apiPost('task_dependencies/delete', { id: dependencyId });
        } catch(error) {
            state.dependencies.splice(depIndex, 0, removedDep);
            renderApp();
            alert("Could not remove dependency.");
        }
    }
}

// --- Custom Fields ---
export async function handleAddCustomFieldDefinition(name: string, type: CustomFieldType) {
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId || !name) return;

    const payload = { workspaceId, name, type };
    try {
        const [savedField] = await apiPost('custom_field_definitions', payload);
        state.customFieldDefinitions.push(savedField);
        renderApp();
    } catch(error) {
        alert("Failed to add custom field.");
    }
}

export async function handleDeleteCustomFieldDefinition(fieldId: string) {
    // This is destructive. We need to remove the definition and all values.
    const originalDef = state.customFieldDefinitions.find(f => f.id === fieldId);
    const originalValues = state.customFieldValues.filter(v => v.fieldId === fieldId);
    if (!originalDef) return;

    state.customFieldDefinitions = state.customFieldDefinitions.filter(f => f.id !== fieldId);
    state.customFieldValues = state.customFieldValues.filter(v => v.fieldId !== fieldId);
    renderApp();

    try {
        await apiPost('custom_field_definitions/delete', { id: fieldId });
        // The backend should cascade delete the values.
    } catch(error) {
        state.customFieldDefinitions.push(originalDef);
        state.customFieldValues.push(...originalValues);
        renderApp();
        alert("Failed to delete custom field.");
    }
}

export async function handleCustomFieldValueUpdate(taskId: string, fieldId: string, value: any) {
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return;

    const existingValue = state.customFieldValues.find(v => v.taskId === taskId && v.fieldId === fieldId);
    
    try {
        if (existingValue) {
            const [updatedValue] = await apiPut('custom_field_values', { id: existingValue.id, value });
            existingValue.value = updatedValue.value;
        } else {
            const payload = { workspaceId, taskId, fieldId, value };
            const [newValue] = await apiPost('custom_field_values', payload);
            state.customFieldValues.push(newValue);
        }
        renderApp();
    } catch(error) {
        alert("Failed to update custom field value.");
        renderApp(); // Re-render to show original state
    }
}
