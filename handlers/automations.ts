

import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Task, Automation, AutomationAction, TaskAssignee, AutomationTrigger, AutomationCondition } from '../types.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { createNotification } from './notifications.ts';

function checkConditions(conditions: AutomationCondition[], context: { task?: Task }): boolean {
    if (!context.task) return false;
    const { task } = context;

    for (const condition of conditions) {
        switch (condition.field) {
            case 'taskPriority':
                if (condition.operator === 'is' && task.priority !== condition.value) return false;
                if (condition.operator === 'isNot' && task.priority === condition.value) return false;
                break;
            case 'taskAssignee':
                const assignees = getState().taskAssignees.filter(a => a.taskId === task.id);
                if (condition.operator === 'isSet' && assignees.length === 0) return false;
                if (condition.operator === 'isUnset' && assignees.length > 0) return false;
                if (condition.operator === 'is' && !assignees.some(a => a.userId === condition.value)) return false;
                if (condition.operator === 'isNot' && assignees.some(a => a.userId === condition.value)) return false;
                break;
            // Add other condition checks here
            default:
                return false; // Unknown condition field
        }
    }
    return true; // All conditions passed
}

async function executeActions(actions: AutomationAction[], context: { task: Task, actorId: string }) {
    let updatedTask = { ...context.task };
    const state = getState();

    for (const action of actions) {
        switch (action.type) {
            case 'changeStatus':
                updatedTask.status = action.status;
                break;
            case 'assignUser':
                const newAssignee: Omit<TaskAssignee, 'id'> = { taskId: updatedTask.id, userId: action.userId, workspaceId: updatedTask.workspaceId };
                // Remove all other assignees and add the new one
                setState(prevState => ({
                    taskAssignees: [
                        ...prevState.taskAssignees.filter(a => a.taskId !== updatedTask.id),
                        newAssignee as TaskAssignee
                    ]
                }), []);
                await apiFetch('/api?action=data&resource=task_assignees', { method: 'DELETE', body: JSON.stringify({ taskId: updatedTask.id }) });
                await apiPost('task_assignees', newAssignee);
                break;
            case 'changePriority':
                updatedTask.priority = action.priority;
                break;
            // Add other action executions here
        }
    }

    if (JSON.stringify(updatedTask) !== JSON.stringify(context.task)) {
        setState(prevState => ({
            tasks: prevState.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
        }), ['page', 'side-panel', 'modal']);
        await apiPut('tasks', { ...updatedTask, id: updatedTask.id });
    }
}

export async function runAutomations(triggerType: AutomationTrigger['type'], context: { task: Task, actorId: string }) {
    const state = getState();
    const { task } = context;

    const relevantAutomations = state.automations.filter(a => 
        a.isEnabled &&
        a.workspaceId === state.activeWorkspaceId &&
        (a.projectId === task.projectId || a.projectId === null)
    );

    for (const auto of relevantAutomations) {
        let triggerMet = false;
        if (auto.trigger.type === 'taskStatusChanged' && triggerType === 'taskStatusChanged') {
            if (auto.trigger.to === task.status) {
                triggerMet = true;
            }
        } else if (auto.trigger.type === 'taskCreated' && triggerType === 'taskCreated') {
            triggerMet = true;
        }

        if (triggerMet) {
            const conditionsMet = checkConditions(auto.conditions, context);
            if (conditionsMet) {
                await executeActions(auto.actions, context);
            }
        }
    }
}


export async function handleSaveAutomation(automationId: string | null, projectId: string | null, name: string, trigger: Automation['trigger'], conditions: AutomationCondition[], actions: AutomationAction[]) {
    const state = getState();
    if (!state.activeWorkspaceId) return;

    const payload: Omit<Automation, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId,
        name,
        isEnabled: true,
        trigger,
        conditions,
        actions,
    };

    try {
        if (automationId) {
            const [updatedAutomation] = await apiPut('automations', { ...payload, id: automationId });
            setState(prevState => ({
                automations: prevState.automations.map(a => a.id === automationId ? updatedAutomation : a)
            }), ['page', 'modal']);
        } else {
            const [savedAutomation] = await apiPost('automations', payload);
            setState(prevState => ({
                automations: [...prevState.automations, savedAutomation]
            }), ['page', 'modal']);
        }
    } catch (error) {
        console.error("Failed to save automation:", error);
        alert("Could not save automation.");
    }
}

export async function fetchAutomationsForWorkspace(workspaceId: string) {
    console.log(`Fetching automations for workspace ${workspaceId}...`);
    try {
        const automations = await apiFetch(`/api?action=data&resource=automations&workspaceId=${workspaceId}`);
        if (automations) {
            setState({ automations }, ['page']);
        }
    } catch (error) {
        console.error("Failed to fetch automations:", error);
    }
}