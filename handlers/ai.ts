



import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Task } from '../types.ts';
import { apiPost } from '../services/api.ts';
import { getWorkspaceKanbanWorkflow } from './main.ts';
import { t } from '../i18n.ts';
import { showToast } from './ui.ts';

export async function handleAddAiTask(taskIndex: number, projectId: string) {
    const state = getState();
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
        isMilestone: false,
    };
    
    try {
        const [savedTask] = await apiPost('tasks', newAppTask);
        setState(prevState => ({
          tasks: [...prevState.tasks, savedTask],
          ai: {
            ...prevState.ai,
            suggestedTasks: prevState.ai.suggestedTasks!.filter((_, i) => i !== taskIndex),
          }
        }), ['page']);
    } catch (error) {
        console.error("Failed to add AI-generated task:", error);
        showToast(t('errors.ai_task_save_failed'), 'error');
    }
}