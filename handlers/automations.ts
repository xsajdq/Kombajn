

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task, Automation } from '../types.ts';
import { apiPost, apiPut } from '../services/api.ts';

export async function runAutomations(triggerType: 'statusChange', data: { task: Task }) {
    if (triggerType !== 'statusChange') return;

    const { task } = data;
    const automationsForProject = state.automations.filter(a => a.projectId === task.projectId);

    let changed = false;
    let newAssigneeId = task.assigneeId;

    automationsForProject.forEach(automation => {
        if (automation.trigger.type === 'statusChange' && automation.trigger.status === task.status) {
            if (automation.action.type === 'assignUser') {
                newAssigneeId = automation.action.userId;
                changed = true;
            }
        }
    });

    if (changed) {
        task.assigneeId = newAssigneeId;
        renderApp();
        try {
            // Persist the change triggered by the automation
            await apiPut('tasks', { id: task.id, assigneeId: newAssigneeId });
        } catch (error) {
            console.error("Failed to persist automation-triggered change:", error);
            // Optionally revert the state change here
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
        await apiPost('automations/delete', { id: automationId });
    } catch (error) {
        state.automations.splice(automationIndex, 0, removedAutomation);
        renderApp();
        alert("Could not delete automation.");
    }
}