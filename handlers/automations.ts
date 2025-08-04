
import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Task, Automation, AutomationAction } from '../types.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { createNotification } from './notifications.ts';

export async function runAutomations(triggerType: 'statusChange', data: { task: Task, actorId: string }) {
    if (triggerType !== 'statusChange') return;

    const { task, actorId } = data;
    const automationsForProject = state.automations.filter(a => a.projectId === task.projectId);

    const applicableAutomations = automationsForProject.filter(auto => 
        auto.trigger.type === 'statusChange' && auto.trigger.status === task.status
    );

    if (applicableAutomations.length === 0) return;

    // --- Create a clone of the task state to apply changes and revert on failure ---
    const originalTask = { ...task };
    const originalAssignees = state.taskAssignees.filter(a => a.taskId === task.id);

    // --- Apply all actions optimistically ---
    let changesToPersist: { task?: Partial<Task> & { id: string }, assignees?: { toAdd: string[], toRemove: string[] } } = { task: { id: task.id } };
    
    for (const automation of applicableAutomations) {
        for (const action of automation.actions) {
            if (action.type === 'changeStatus') {
                task.status = action.status;
                changesToPersist.task!.status = action.status;
            }
            if (action.type === 'assignUser') {
                changesToPersist.assignees = { toAdd: [action.userId], toRemove: originalAssignees.map(a => a.userId) };
                state.taskAssignees = state.taskAssignees.filter(a => a.taskId !== task.id);
                state.taskAssignees.push({ taskId: task.id, userId: action.userId, workspaceId: task.workspaceId } as any);
            }
        }
    }
    
    updateUI(['page']);

    // --- Persist changes to the backend ---
    try {
        if (Object.keys(changesToPersist.task!).length > 1) {
            await apiPut('tasks', changesToPersist.task!);
        }
        if (changesToPersist.assignees) {
            for (const userId of changesToPersist.assignees.toRemove) {
                await apiFetch('/api?action=data&resource=task_assignees', { method: 'DELETE', body: JSON.stringify({ taskId: task.id, userId }) });
            }
            for (const userId of changesToPersist.assignees.toAdd) {
                await apiPost('task_assignees', { taskId: task.id, userId, workspaceId: task.workspaceId });
                if (userId !== actorId) {
                    await createNotification('new_assignment', { taskId: task.id, userIdToNotify: userId, actorId });
                }
            }
        }
    } catch (error) {
        console.error("Failed to persist automation-triggered change:", error);
        // Revert UI changes on failure
        const taskInState = state.tasks.find(t => t.id === task.id);
        if (taskInState) Object.assign(taskInState, originalTask);
        state.taskAssignees = state.taskAssignees.filter(a => a.taskId !== task.id);
        state.taskAssignees.push(...originalAssignees);
        updateUI(['page']);
        alert("An automation failed to run.");
    }
}


export async function handleSaveAutomation(automationId: string | null, projectId: string, name: string, trigger: Automation['trigger'], actions: AutomationAction[]) {
    if (!state.activeWorkspaceId) return;

    const payload: Omit<Automation, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId,
        name,
        trigger,
        actions,
    };

    try {
        if (automationId) {
            const [updatedAutomation] = await apiPut('automations', { ...payload, id: automationId });
            const index = state.automations.findIndex(a => a.id === automationId);
            if (index > -1) {
                state.automations[index] = updatedAutomation;
            }
        } else {
            const [savedAutomation] = await apiPost('automations', payload);
            state.automations.push(savedAutomation);
        }
        updateUI(['modal']);
    } catch (error) {
        console.error("Failed to save automation:", error);
        alert("Could not save automation.");
    }
}
