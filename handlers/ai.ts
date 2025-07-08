
import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task } from '../types.ts';

export function handleAddAiTask(taskIndex: number, projectId: string) {
    if (!state.ai.suggestedTasks || !state.ai.suggestedTasks[taskIndex] || !state.activeWorkspaceId) return;

    const taskToAdd = state.ai.suggestedTasks[taskIndex];
    const newAppTask: Task = {
        id: generateId(),
        workspaceId: state.activeWorkspaceId,
        name: taskToAdd.name,
        description: taskToAdd.description,
        projectId: projectId,
        status: state.settings.defaultKanbanWorkflow === 'advanced' ? 'backlog' : 'todo',
    };

    state.tasks.push(newAppTask);
    state.ai.suggestedTasks.splice(taskIndex, 1); // Remove from suggestions
    saveState();
    renderApp();
}
