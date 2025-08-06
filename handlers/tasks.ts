

import { getState, generateId, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Comment, Task, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldType, CustomFieldValue, TaskAssignee, Tag, TaskTag, CommentReaction } from '../types.ts';
import { createNotification } from './notifications.ts';
import { showModal } from './ui.ts';
import { runAutomations } from './automations.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { parseDurationStringToHours, generateSlug } from '../utils.ts';
import { getWorkspaceKanbanWorkflow } from './main.ts';

declare const gapi: any;
declare const google: any;

export async function fetchTasksForWorkspace(workspaceId: string) {
    console.log(`Fetching task data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&tasksOnly=true`);
        if (!data) throw new Error("Task data fetch returned null.");

        setState(prevState => ({
            tasks: data.tasks || [],
            kanbanStages: data.kanbanStages || [],
            taskAssignees: data.taskAssignees || [],
            projectSections: data.projectSections || [],
            taskViews: data.taskViews || [],
            userTaskSortOrders: data.userTaskSortOrders || [],
            taskTags: data.taskTags || [],
            comments: data.comments || [],
            dependencies: data.dependencies || [],
            customFieldValues: data.customFieldValues || [],
            tags: data.tags ? [...prevState.tags.filter(t => !data.tags.some((dt: Tag) => dt.id === t.id)), ...data.tags] : prevState.tags,
            customFieldDefinitions: data.customFieldDefinitions ? [...prevState.customFieldDefinitions.filter(d => !data.customFieldDefinitions.some((dd: CustomFieldDefinition) => dd.id === d.id)), ...data.customFieldDefinitions] : prevState.customFieldDefinitions,
            ui: {
                ...prevState.ui,
                tasks: { ...prevState.ui.tasks, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched task data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch task data:", error);
        setState(prevState => ({
            ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, isLoading: false, loadedWorkspaceId: null } }
        }), ['page']);
    }
}


export function openTaskDetail(taskId: string) {
    showModal('taskDetail', { taskId });
}

export async function handleAddTaskComment(taskId: string, content: string, parentId: string | null, successCallback: () => void) {
    const state = getState();
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
        
        const updatedTask = { ...task, lastActivityAt: new Date().toISOString() };
        setState({ 
            comments: [...state.comments, savedComment],
            tasks: state.tasks.map(t => t.id === taskId ? updatedTask : t)
        }, []);
        
        await apiPut('tasks', { id: taskId, lastActivityAt: updatedTask.lastActivityAt });

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
    const state = getState();
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment || !newContent.trim() || comment.content === newContent.trim()) {
        // If no change, just re-render to exit edit mode
        updateUI(['modal']);
        return;
    }

    const originalContent = comment.content;
    const originalUpdatedAt = comment.updatedAt;

    // Optimistic update
    const updatedComment = { ...comment, content: newContent.trim(), updatedAt: new Date().toISOString() };
    const updatedComments = state.comments.map(c => c.id === commentId ? updatedComment : c);
    setState({ comments: updatedComments }, ['modal']);

    try {
        await apiPut('comments', { 
            id: commentId, 
            content: updatedComment.content,
            updatedAt: updatedComment.updatedAt 
        });
    } catch (error) {
        console.error("Failed to update comment:", error);
        alert("Could not save comment changes. Reverting.");
        // Revert on failure
        const revertedComments = state.comments.map(c => c.id === commentId ? { ...c, content: originalContent, updatedAt: originalUpdatedAt } : c);
        setState({ comments: revertedComments }, ['modal']);
    }
}

export async function handleToggleReaction(commentId: string, emoji: string) {
    const state = getState();
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment || !state.currentUser) return;

    const originalReactions = [...(comment.reactions || [])];
    let newReactions = [...originalReactions];

    const userId = state.currentUser.id;
    const existingReactionIndex = newReactions.findIndex(r => r.emoji === emoji && r.userId === userId);

    if (existingReactionIndex > -1) {
        // User is removing their reaction
        newReactions.splice(existingReactionIndex, 1);
    } else {
        // User is adding a reaction
        newReactions.push({ emoji, userId });
    }

    const updatedComments = state.comments.map(c => c.id === commentId ? { ...c, reactions: newReactions } : c);
    setState({ comments: updatedComments }, ['modal']); // Optimistic update

    try {
        await apiPut('comments', { id: commentId, reactions: newReactions });
    } catch (error) {
        console.error("Failed to toggle reaction:", error);
        alert("Could not save reaction.");
        // Revert UI change on failure
        const revertedComments = state.comments.map(c => c.id === commentId ? { ...c, reactions: originalReactions } : c);
        setState({ comments: revertedComments }, ['modal']);
    }
}


export async function handleTaskDetailUpdate(taskId: string, field: keyof Task, value: any) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    const oldValue = task[field];
    
    // This is the simplest, most localized fix. Handle the specific case for 'status'.
    if (field === 'status') {
        const newStatus = value as Task['status'];
        if (oldValue === newStatus) return;

        const updatedTask = { ...task, status: newStatus };
        const updatedTasks = state.tasks.map(t => t.id === taskId ? updatedTask : t);
        setState({ tasks: updatedTasks }, [state.ui.modal.isOpen ? 'modal' : 'page']);
        
        try {
            await apiPut('tasks', { id: taskId, status: newStatus });
            const assignees = state.taskAssignees.filter(a => a.taskId === taskId);
            for (const assignee of assignees) {
                if (assignee.userId !== state.currentUser!.id) {
                    await createNotification('status_change', { taskId, userIdToNotify: assignee.userId, newStatus: newStatus, actorId: state.currentUser.id });
                }
            }
            runAutomations('statusChange', { task: updatedTask, actorId: state.currentUser.id });
        } catch (error) {
            console.error(`Failed to update task field status:`, error);
            alert(`Could not update task. Reverting change.`);
            const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, status: oldValue as Task['status'] } : t);
            setState({ tasks: revertedTasks }, [state.ui.modal.isOpen ? 'modal' : 'page']);
        }
        return; // Exit after handling status
    }
    
    // Handle other fields
    let finalValue: any = value === '' ? null : value;
    if (field === 'estimatedHours') {
        finalValue = parseDurationStringToHours(value as string);
    } else if (field === 'priority') {
        finalValue = (value === '' ? null : value) as Task['priority'];
    } else if (field === 'type') {
        finalValue = (value === '' ? null : value) as Task['type'];
    } else if (field === 'recurrence') {
        finalValue = value as Task['recurrence'];
    }
    
    if (oldValue === finalValue || (oldValue === null && value === '')) {
        return;
    }
    
    const updatedTaskPayload: { id: string; [key: string]: any } = { id: taskId, [field]: finalValue };

    if (field === 'name') {
        updatedTaskPayload.slug = generateSlug(finalValue, taskId);
    }

    const updatedTask = { ...task, ...updatedTaskPayload };

    const updatedTasks = state.tasks.map(t => t.id === taskId ? updatedTask as Task : t);
    setState({ tasks: updatedTasks }, [state.ui.modal.isOpen ? 'modal' : 'page']);

    try {
        await apiPut('tasks', updatedTaskPayload);
    } catch (error) {
        console.error(`Failed to update task field ${field}:`, error);
        alert(`Could not update task. Reverting change.`);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, [field]: oldValue } as Task : t);
        setState({ tasks: revertedTasks }, [state.ui.modal.isOpen ? 'modal' : 'page']);
    }
}

export async function handleTaskProgressUpdate(taskId: string, newProgress: number) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const roundedProgress = Math.round(newProgress);
    const originalProgress = task.progress;
    const originalStatus = task.status;

    let updatedTask: Task = { ...task, progress: roundedProgress };
    const workflow = getWorkspaceKanbanWorkflow(task.workspaceId);
    const doneStatus = workflow === 'simple' ? 'done' : 'done'; // Assuming 'done' for both for now

    if (roundedProgress === 100 && task.status !== doneStatus) {
        updatedTask.status = doneStatus;
    } else if (roundedProgress < 100 && task.status === doneStatus) {
        updatedTask.status = 'inprogress';
    }

    // Update UI immediately
    const updatedTasks = state.tasks.map(t => t.id === taskId ? updatedTask : t);
    setState({ tasks: updatedTasks }, ['modal', 'page']);

    try {
        const payload: { id: string, progress: number, status?: Task['status'] } = {
            id: taskId,
            progress: roundedProgress,
        };
        if (updatedTask.status !== originalStatus) {
            payload.status = updatedTask.status;
        }
        await apiPut('tasks', payload);

        // If status changed, run automations
        if (updatedTask.status !== originalStatus && state.currentUser) {
            runAutomations('statusChange', { task: updatedTask, actorId: state.currentUser.id });
        }
    } catch (error) {
        console.error('Failed to update task progress', error);
        alert('Failed to save progress.');
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, progress: originalProgress, status: originalStatus } : t);
        setState({ tasks: revertedTasks }, ['modal', 'page']);
    }
}

export async function handleToggleAssignee(taskId: string, userId: string) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    const existingIndex = state.taskAssignees.findIndex(a => a.taskId === taskId && a.userId === userId);

    if (existingIndex > -1) {
        const originalAssignees = [...state.taskAssignees];
        const updatedAssignees = originalAssignees.filter((_, index) => index !== existingIndex);
        setState({ taskAssignees: updatedAssignees }, ['modal', 'page']);
        try {
            await apiFetch('/api?action=data&resource=task_assignees', {
                method: 'DELETE',
                body: JSON.stringify({ taskId, userId }),
            });
        } catch (error) {
            console.error('Failed to remove assignee', error);
            setState({ taskAssignees: originalAssignees }, ['modal', 'page']); // Revert
        }
    } else {
        const newAssignee = { taskId, userId, workspaceId: task.workspaceId };
        const tempId = `temp-${Date.now()}`;
        setState({ taskAssignees: [...state.taskAssignees, { ...newAssignee, id: tempId } as any] }, ['modal', 'page']);
        try {
            const [saved] = await apiPost('task_assignees', newAssignee);
            setState(prevState => ({
                taskAssignees: prevState.taskAssignees.map(a => (a as any).id === tempId ? saved : a)
            }), ['modal', 'page']);
            if (userId !== state.currentUser.id) {
                await createNotification('new_assignment', { taskId, userIdToNotify: userId, actorId: state.currentUser.id });
            }
        } catch (error) {
            console.error('Failed to add assignee', error);
            setState(prevState => ({
                taskAssignees: prevState.taskAssignees.filter(a => (a as any).id !== tempId)
            }), ['modal', 'page']); // Revert
        }
    }
}

export async function handleAddChecklistItem(taskId: string, text: string) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newItem = { id: generateId(), text, completed: false };
    const newChecklist = [...(task.checklist || []), newItem];
    const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, checklist: newChecklist } : t);
    setState({ tasks: updatedTasks }, ['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, checklist: newChecklist });
    } catch (error) {
        console.error("Failed to add checklist item:", error);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, checklist: task.checklist || [] } : t);
        setState({ tasks: revertedTasks }, ['modal']);
    }
}

export async function handleDeleteChecklistItem(taskId: string, itemId: string) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    const itemIndex = task.checklist.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const originalChecklist = [...task.checklist];
    const newChecklist = originalChecklist.filter(item => item.id !== itemId);
    const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, checklist: newChecklist } : t);
    setState({ tasks: updatedTasks }, ['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, checklist: newChecklist });
    } catch (error) {
        console.error("Failed to delete checklist item:", error);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, checklist: originalChecklist } : t);
        setState({ tasks: revertedTasks }, ['modal']);
    }
}

export async function handleToggleChecklistItem(taskId: string, itemId: string) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    const item = task.checklist.find(item => item.id === itemId);
    if (!item) return;

    const originalChecklist = [...task.checklist];
    const newChecklist = originalChecklist.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i);
    const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, checklist: newChecklist } : t);
    setState({ tasks: updatedTasks }, ['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, checklist: newChecklist });
    } catch (error) {
        console.error("Failed to toggle checklist item:", error);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, checklist: originalChecklist } : t);
        setState({ tasks: revertedTasks }, ['modal']);
    }
}

export async function handleAddSubtask(parentId: string, name: string) {
    const state = getState();
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
        setState({ tasks: [...state.tasks, savedSubtask] }, ['modal']);
    } catch (error) {
        console.error("Failed to add subtask:", error);
    }
}

export async function handleDeleteSubtask(subtaskId: string) {
    const state = getState();
    const subtaskIndex = state.tasks.findIndex(t => t.id === subtaskId);
    if (subtaskIndex === -1) return;

    const originalTasks = [...state.tasks];
    const updatedTasks = originalTasks.filter(t => t.id !== subtaskId);
    setState({ tasks: updatedTasks }, ['modal']);

    try {
        await apiFetch('/api?action=data&resource=tasks', {
            method: 'DELETE',
            body: JSON.stringify({ id: subtaskId }),
        });
    } catch (error) {
        console.error("Failed to delete subtask:", error);
        setState({ tasks: originalTasks }, ['modal']);
    }
}

export async function handleToggleSubtaskStatus(subtaskId: string) {
    const state = getState();
    const subtask = state.tasks.find(t => t.id === subtaskId);
    if (!subtask) return;

    const newStatus: Task['status'] = subtask.status === 'done' ? 'todo' : 'done';
    const originalStatus = subtask.status;
    const updatedTasks = state.tasks.map(t => t.id === subtaskId ? { ...t, status: newStatus } : t);
    setState({ tasks: updatedTasks }, ['modal']);

    try {
        await apiPut('tasks', { id: subtaskId, status: newStatus });
    } catch (error) {
        console.error("Failed to toggle subtask status:", error);
        const revertedTasks = state.tasks.map(t => t.id === subtaskId ? { ...t, status: originalStatus } : t);
        setState({ tasks: revertedTasks }, ['modal']);
    }
}

export async function handleAddDependency(blockingTaskId: string, blockedTaskId: string) {
    const state = getState();
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
        setState({ dependencies: [...state.dependencies, savedDependency] }, ['modal']);
    } catch (error) {
        console.error("Failed to add dependency:", error);
    }
}

export async function handleRemoveDependency(dependencyId: string) {
    const state = getState();
    const depIndex = state.dependencies.findIndex(d => d.id === dependencyId);
    if (depIndex === -1) return;

    const originalDependencies = [...state.dependencies];
    const updatedDependencies = originalDependencies.filter(d => d.id !== dependencyId);
    setState({ dependencies: updatedDependencies }, ['modal']);

    try {
        await apiFetch('/api?action=data&resource=task_dependencies', {
            method: 'DELETE',
            body: JSON.stringify({ id: dependencyId }),
        });
    } catch (error) {
        console.error("Failed to remove dependency:", error);
        setState({ dependencies: originalDependencies }, ['modal']);
    }
}

export async function handleAddAttachment(taskId: string, file: File) {
    const state = getState();
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
        setState({ attachments: [...state.attachments, savedAttachment] }, ['modal']);
    } catch(error) {
        console.error("File upload failed:", error);
        alert("File upload failed. Please try again.");
    }
}

export async function handleRemoveAttachment(attachmentId: string) {
    const state = getState();
    const attIndex = state.attachments.findIndex(a => a.id === attachmentId);
    if (attIndex === -1) return;

    const originalAttachments = [...state.attachments];
    const updatedAttachments = originalAttachments.filter(a => a.id !== attachmentId);
    setState({ attachments: updatedAttachments }, ['modal']);

    try {
        await apiFetch('/api?action=data&resource=attachments', {
            method: 'DELETE',
            body: JSON.stringify({ id: attachmentId }),
        });
    } catch (error) {
        console.error("Failed to remove attachment:", error);
        setState({ attachments: originalAttachments }, ['modal']);
    }
}

export async function handleCustomFieldValueUpdate(taskId: string, fieldId: string, value: any) {
    const state = getState();
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
        const updatedValues = state.customFieldValues.map(v => v.id === existingValue.id ? { ...v, value } : v);
        setState({ customFieldValues: updatedValues }, ['modal']);
        try {
            await apiPut('custom_field_values', { ...payload, id: existingValue.id });
        } catch (error) {
            const revertedValues = state.customFieldValues.map(v => v.id === existingValue.id ? { ...v, value: originalValue } : v);
            setState({ customFieldValues: revertedValues }, ['modal']); // Revert
            alert("Could not update custom field.");
        }
    } else {
        const tempId = `temp-${Date.now()}`;
        setState({ customFieldValues: [...state.customFieldValues, { ...payload, id: tempId } as any] }, ['modal']);
        try {
            const [savedValue] = await apiPost('custom_field_values', payload);
            setState(prevState => ({
                customFieldValues: prevState.customFieldValues.map(v => v.id === tempId ? savedValue : v)
            }), ['modal']);
        } catch (error) {
            setState(prevState => ({
                customFieldValues: prevState.customFieldValues.filter(v => v.id !== tempId)
            }), ['modal']); // Revert
            alert("Could not save custom field value.");
        }
    }
}

export async function handleAddCustomFieldDefinition(name: string, type: CustomFieldType) {
    const state = getState();
    if (!state.activeWorkspaceId) return;

    const payload: Omit<CustomFieldDefinition, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name,
        type,
    };

    try {
        const [savedField] = await apiPost('custom_field_definitions', payload);
        setState({ customFieldDefinitions: [...state.customFieldDefinitions, savedField] }, ['page']);
    } catch (error) {
        console.error("Failed to add custom field:", error);
        alert("Could not add custom field.");
    }
}

export async function handleSetTaskReminder(taskId: string, reminderDate: string | null) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalReminder = task.reminderAt;
    const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, reminderAt: reminderDate } : t);
    setState({ tasks: updatedTasks }, ['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, reminderAt: reminderDate });
    } catch (error) {
        console.error("Failed to set reminder:", error);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, reminderAt: originalReminder } : t);
        setState({ tasks: revertedTasks }, ['modal']); // Revert
        alert("Could not save the reminder.");
    }
}

export async function handleToggleFollowUp(taskId: string, type: 'onInactivity' | 'onUnansweredQuestion') {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalConfig = { ...(task.followUpConfig || {}) };
    const newConfig = { ...originalConfig, [type]: !originalConfig[type] };
    const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, followUpConfig: newConfig } : t);
    setState({ tasks: updatedTasks }, ['modal']); // Optimistic update

    try {
        await apiPut('tasks', { id: taskId, followUpConfig: newConfig });
    } catch (error) {
        console.error("Failed to toggle follow-up:", error);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, followUpConfig: originalConfig } : t);
        setState({ tasks: revertedTasks }, ['modal']); // Revert
        alert("Could not save follow-up preference.");
    }
}

export async function handleDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task permanently?")) return;
    
    const state = getState();
    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const originalTasks = [...state.tasks];
    const updatedTasks = originalTasks.filter(t => t.id !== taskId);
    setState({ tasks: updatedTasks }, ['page']);

    try {
        await apiFetch('/api?action=data&resource=tasks', {
            method: 'DELETE',
            body: JSON.stringify({ id: taskId }),
        });
    } catch (error) {
        console.error("Failed to delete task:", error);
        setState({ tasks: originalTasks }, ['page']);
    }
}

export async function handleToggleTaskArchive(taskId: string) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalStatus = task.isArchived;
    const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, isArchived: !t.isArchived } : t);
    setState({ tasks: updatedTasks }, ['page']);

    try {
        await apiPut('tasks', { id: taskId, isArchived: !task.isArchived });
    } catch (error) {
        console.error("Failed to update task archive status:", error);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, isArchived: originalStatus } : t);
        setState({ tasks: revertedTasks }, ['page']);
    }
}

export async function handleChangeGanttViewMode(mode: 'Day' | 'Week' | 'Month') {
    setState(prevState => ({ ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, ganttViewMode: mode } } }), ['page']);
}


export async function handleToggleProjectTaskStatus(taskId: string) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalStatus = task.status;
    const newStatus: Task['status'] = task.status === 'done' ? 'todo' : 'done';
    
    const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
    setState({ tasks: updatedTasks }, ['side-panel']);

    try {
        await apiPut('tasks', { id: taskId, status: newStatus });
    } catch (error) {
        console.error("Failed to update task status:", error);
        const revertedTasks = state.tasks.map(t => t.id === taskId ? { ...t, status: originalStatus } : t);
        setState({ tasks: revertedTasks }, ['side-panel']);
        alert("Could not update task status.");
    }
}