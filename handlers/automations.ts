import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task, Automation } from '../types.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { createNotification } from './notifications.ts';

export async function runAutomations(triggerType: 'statusChange', data: { task: Task, actorId: string }) {
    if (triggerType !== 'statusChange') return;

    const { task, actorId } = data;
    const automationsForProject = state.automations.filter(a => a.projectId === task.projectId);

    let changed = false;
    
    const existingAssignee = state.taskAssignees.find(a => a.taskId === task.id);
    let newAssigneeId: string | null = existingAssignee ? existingAssignee.userId : null;

    automationsForProject.forEach(automation => {
        if (automation.trigger.type === 'statusChange' && automation.trigger.status === task.status) {
            if (automation.action.type === 'assignUser') {
                newAssigneeId = automation.action.userId;
                changed = true;
            }
        }
    });

    if (changed && newAssigneeId) {
        const oldAssignees = state.taskAssignees.filter(a => a.taskId === task.id);
        // Optimistic update
        state.taskAssignees = state.taskAssignees.filter(a => a.taskId !== task.id);
        if (newAssigneeId) {
            state.taskAssignees.push({ taskId: task.id, userId: newAssigneeId, workspaceId: task.workspaceId });
        }
        renderApp();
        
        try {
            // Persist the change triggered by the automation
            // Delete old assignees
            for (const old of oldAssignees) {
                await apiFetch('/api?action=data&resource=task_assignees', { method: 'DELETE', body: JSON.stringify({ taskId: old.taskId, userId: old.userId }) });
            }
            // Add new assignee
            if (newAssigneeId) {
                await apiPost('task_assignees', { taskId: task.id, userId: newAssigneeId, workspaceId: task.workspaceId });
                // Create a notification for the new assignee
                if (newAssigneeId !== actorId) {
                    await createNotification('new_assignment', { taskId: task.id, userIdToNotify: newAssigneeId, actorId });
                }
            }
        } catch (error) {
            console.error("Failed to persist automation-triggered change:", error);
            // Optionally revert the state change here
            state.taskAssignees = state.taskAssignees.filter(a => a.taskId !== task.id);
            state.taskAssignees.push(...oldAssignees);
            renderApp();
        }
    }
}

export async function handleAddAutomation(projectId: string, triggerStatus: Task['status'], actionUserId: string) {
    if (!state.activeWorkspaceId) return;

    const newAutomationPayload: Omit<Automation, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId,
        trigger: {
            type: 'statusChange',
            status: triggerStatus,
        },
        action: {
            type: 'assignUser',
            userId: actionUserId,
        },
    };

    try {
        const [savedAutomation] = await apiPost('automations', newAutomationPayload);
        state.automations.push(savedAutomation);
        renderApp();
    } catch(error) {
        console.error("Failed to add automation:", error);
        alert("Could not add automation.");
    }
}

export async function handleDeleteAutomation(automationId: string) {
    const automationIndex = state.automations.findIndex(a => a.id === automationId);
    if (automationIndex === -1) return;

    const [removedAutomation] = state.automations.splice(automationIndex, 1);
    renderApp();

    try {
        await apiFetch('/api?action=data&resource=automations', {
            method: 'DELETE',
            body: JSON.stringify({ id: automationId }),
        });
    } catch (error) {
        state.automations.splice(automationIndex, 0, removedAutomation);
        renderApp();
        alert("Could not delete automation.");
    }
}