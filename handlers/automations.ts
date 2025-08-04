
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Task, Automation, AutomationAction, TaskAssignee } from '../types.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { createNotification } from './notifications.ts';

export async function runAutomations(triggerType: 'statusChange', data: { task: Task, actorId: string }) {
    if (triggerType !== 'statusChange') return;

    const state = getState();
    const { task, actorId } = data;
    const automationsForProject = state.automations.filter(a => a.projectId === task.projectId);

    const applicableAutomations = automationsForProject.filter(auto => 
        auto.trigger.type === 'statusChange' && auto.trigger.status === task.status
    );

    if (applicableAutomations.length === 0) return;
    
    let updatedTask = { ...task };
    let newAssignees: TaskAssignee[] | null = null;
    
    for (const automation of applicableAutomations) {
        for (const action of automation.actions) {
            if (action.type === 'changeStatus') {
                updatedTask.status = action.status;
            }
            if (action.type === 'assignUser') {
                newAssignees = [{ taskId: task.id, userId: action.userId, workspaceId: task.workspaceId } as TaskAssignee];
            }
        }
    }
    
    // Optimistic Update
    const originalTask = state.tasks.find(t => t.id === task.id);
    const originalAssignees = state.taskAssignees.filter(a => a.taskId === task.id);
    
    setState(prevState => {
        const newTasks = prevState.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
        let newTaskAssignees = prevState.taskAssignees;
        if (newAssignees) {
            newTaskAssignees = [
                ...prevState.taskAssignees.filter(a => a.taskId !== task.id),
                ...newAssignees
            ];
        }
        return { tasks: newTasks, taskAssignees: newTaskAssignees };
    }, ['page']);


    // Persist changes
    try {
        if (updatedTask.status !== originalTask?.status) {
            await apiPut('tasks', { id: updatedTask.id, status: updatedTask.status });
        }
        if (newAssignees) {
            // Remove old
            for (const assignee of originalAssignees) {
                 await apiFetch('/api?action=data&resource=task_assignees', { method: 'DELETE', body: JSON.stringify({ taskId: assignee.taskId, userId: assignee.userId }) });
            }
            // Add new
            for (const assignee of newAssignees) {
                 const [saved] = await apiPost('task_assignees', { taskId: assignee.taskId, userId: assignee.userId, workspaceId: assignee.workspaceId });
                 // update temp id if needed
            }
        }
    } catch (error) {
        console.error("Failed to persist automation-triggered change:", error);
        setState(prevState => ({
            tasks: prevState.tasks.map(t => t.id === originalTask?.id ? originalTask : t),
            taskAssignees: [
                ...prevState.taskAssignees.filter(a => a.taskId !== task.id),
                ...originalAssignees
            ]
        }), ['page']);
        alert("An automation failed to run.");
    }
}


export async function handleSaveAutomation(automationId: string | null, projectId: string, name: string, trigger: Automation['trigger'], actions: AutomationAction[]) {
    const state = getState();
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
            setState(prevState => ({
                automations: prevState.automations.map(a => a.id === automationId ? updatedAutomation : a)
            }), ['modal']);
        } else {
            const [savedAutomation] = await apiPost('automations', payload);
            setState(prevState => ({
                automations: [...prevState.automations, savedAutomation]
            }), ['modal']);
        }
    } catch (error) {
        console.error("Failed to save automation:", error);
        alert("Could not save automation.");
    }
}
