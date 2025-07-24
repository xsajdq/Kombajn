
import { state, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task } from '../types.ts';
import { apiPost } from '../services/api.ts';
import { getWorkspaceKanbanWorkflow } from './main.ts';

export async function handleAddAiTask(taskIndex: number, projectId: string) {
    if (!state.ai.suggestedTasks || !state.ai.suggestedTasks[taskIndex] || !state.activeWorkspaceId || !state.currentUser) return;

    const workflow = getWorkspaceKanbanWorkflow(state.activeWorkspaceId);
    const taskToAdd = state.ai.suggestedTasks[taskIndex];
    const newAppTask: Omit<Task, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name: taskToAdd.name,
        description: taskToAdd.description,
        projectId: projectId,
        status: workflow === 'advanced' ? 'backlog' : 'todo',
        isArchived: false,
        createdAt: new Date().toISOString(),
    };
    
    try {
        const [savedTask] = await apiPost('tasks', newAppTask);
        state.tasks.push(savedTask);
        state.ai.suggestedTasks!.splice(taskIndex, 1); // Remove from suggestions
        renderApp();
    } catch (error) {
        console.error("Failed to add AI-generated task:", error);
        alert("Could not save the suggested task. Please try again.");
    }
}
