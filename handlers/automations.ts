
import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task, Automation } from '../types.ts';

export function runAutomations(triggerType: 'statusChange', data: { task: Task }) {
    if (triggerType !== 'statusChange') return;

    const { task } = data;
    const automationsForProject = state.automations.filter(a => a.projectId === task.projectId);

    let changed = false;
    automationsForProject.forEach(automation => {
        if (automation.trigger.type === 'statusChange' && automation.trigger.status === task.status) {
            if (automation.action.type === 'assignUser') {
                task.assigneeId = automation.action.userId;
                changed = true;
            }
        }
    });

    if (changed) {
        saveState();
        renderApp();
    }
}

export function handleAddAutomation(projectId: string, triggerStatus: Task['status'], actionUserId: string) {
    if (!state.activeWorkspaceId) return;

    const newAutomation: Automation = {
        id: generateId(),
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

    state.automations.push(newAutomation);
    saveState();
    renderApp();
}

export function handleDeleteAutomation(automationId: string) {
    state.automations = state.automations.filter(a => a.id !== automationId);
    saveState();
    renderApp();
}
