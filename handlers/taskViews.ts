import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { TaskView } from '../types.ts';
import { closeModal } from './ui.ts';
import { handleCreateDefaultKanbanStagesForView } from './kanban.ts';

export async function handleCreateTaskView(name: string, icon: string) {
    const state = getState();
    if (!state.activeWorkspaceId || !name.trim()) return;

    const payload: Omit<TaskView, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name: name.trim(),
        icon: icon || 'checklist',
    };

    try {
        const [newView] = await apiPost('task_views', payload);
        await handleCreateDefaultKanbanStagesForView(state.activeWorkspaceId, newView.id);
        setState(prevState => ({ taskViews: [...prevState.taskViews, newView] }), ['page', 'sidebar']);
    } catch (error) {
        console.error("Failed to create task view:", error);
        alert("Could not create the task view.");
    }
}

export async function handleUpdateTaskView(id: string, name: string, icon: string) {
    const state = getState();
    const view = state.taskViews.find(tv => tv.id === id);
    if (!view || !name.trim()) return;

    const originalName = view.name;
    const originalIcon = view.icon;
    
    const editRow = document.querySelector(`.task-view-item[data-view-id="${id}"]`);
    if(editRow) {
        editRow.querySelector('.view-mode')?.classList.remove('hidden');
        editRow.querySelector('.edit-mode')?.classList.add('hidden');
    }

    setState(prevState => ({
        taskViews: prevState.taskViews.map(tv => tv.id === id ? { ...tv, name: name.trim(), icon } : tv)
    }), ['page', 'sidebar']);
    

    try {
        await apiPut('task_views', { id, name: name.trim(), icon });
    } catch (error) {
        console.error("Failed to update task view:", error);
        alert("Could not update the task view.");
        setState(prevState => ({
            taskViews: prevState.taskViews.map(tv => tv.id === id ? { ...tv, name: originalName, icon: originalIcon } : tv)
        }), ['page', 'sidebar']);
    }
}

export async function handleDeleteTaskView(id: string) {
    if (!confirm("Are you sure you want to delete this view? Tasks will not be deleted.")) {
        return;
    }
    
    const state = getState();
    const viewIndex = state.taskViews.findIndex(tv => tv.id === id);
    if (viewIndex === -1) return;

    const originalState: Partial<any> = {};
    const stateUpdate: Partial<any> = {};

    originalState.taskViews = [...state.taskViews];
    originalState.tasks = state.tasks.map(t => ({ id: t.id, taskViewId: t.taskViewId }));
    originalState.kanbanStages = [...state.kanbanStages];

    stateUpdate.taskViews = state.taskViews.filter(tv => tv.id !== id);
    stateUpdate.tasks = state.tasks.map(task => task.taskViewId === id ? { ...task, taskViewId: null } : task);
    stateUpdate.kanbanStages = state.kanbanStages.filter(ks => ks.taskViewId !== id);

    if (state.ui.activeTaskViewId === id) {
        stateUpdate.ui = { ...state.ui, activeTaskViewId: null };
        stateUpdate.currentPage = 'tasks';
        history.pushState({}, '', '/tasks');
    }
    
    setState(stateUpdate, ['page', 'sidebar']);

    try {
        await apiFetch('/api?action=data&resource=kanban_stages', {
            method: 'DELETE',
            body: JSON.stringify({ task_view_id: id }),
        });
        await apiFetch('/api?action=data&resource=task_views', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error("Failed to delete task view:", error);
        alert("Could not delete the task view.");
        setState(prevState => ({
            taskViews: originalState.taskViews,
            kanbanStages: originalState.kanbanStages,
            tasks: prevState.tasks.map(task => {
                const original = originalState.tasks.find((ot: any) => ot.id === task.id);
                return original ? { ...task, taskViewId: original.taskViewId } : task;
            })
        }), ['page', 'sidebar']);
    }
}