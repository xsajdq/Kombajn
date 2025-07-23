
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { TaskView } from '../types.ts';
import { closeModal } from './ui.ts';

export async function handleCreateTaskView(name: string, icon: string) {
    if (!state.activeWorkspaceId || !name.trim()) return;

    const payload: Omit<TaskView, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name: name.trim(),
        icon: icon || 'checklist',
    };

    try {
        const [newView] = await apiPost('task_views', payload);
        state.taskViews.push(newView);
        renderApp();
    } catch (error) {
        console.error("Failed to create task view:", error);
        alert("Could not create the task view.");
    }
}

export async function handleUpdateTaskView(id: string, name: string, icon: string) {
    const view = state.taskViews.find(tv => tv.id === id);
    if (!view || !name.trim()) return;

    const originalName = view.name;
    const originalIcon = view.icon;
    view.name = name.trim();
    view.icon = icon;
    
    // Optimistic update
    const editRow = document.querySelector(`.task-view-item[data-view-id="${id}"]`);
    if(editRow) editRow.classList.remove('editing');
    renderApp();

    try {
        await apiPut('task_views', { id, name: name.trim(), icon });
    } catch (error) {
        console.error("Failed to update task view:", error);
        alert("Could not update the task view.");
        view.name = originalName; // Revert
        view.icon = originalIcon;
        renderApp();
    }
}

export async function handleDeleteTaskView(id: string) {
    if (!confirm("Are you sure you want to delete this view? Tasks will not be deleted.")) {
        return;
    }

    const viewIndex = state.taskViews.findIndex(tv => tv.id === id);
    if (viewIndex === -1) return;

    const [removedView] = state.taskViews.splice(viewIndex, 1);
    // Optimistically update tasks that were in this view
    state.tasks.forEach(task => {
        if (task.taskViewId === id) {
            task.taskViewId = null;
        }
    });
    
    // If the active view is the one being deleted, navigate away
    if (state.ui.activeTaskViewId === id) {
        state.ui.activeTaskViewId = null;
        state.currentPage = 'tasks';
        history.pushState({}, '', '/tasks');
    }
    
    renderApp();

    try {
        await apiFetch('/api?action=data&resource=task_views', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error("Failed to delete task view:", error);
        alert("Could not delete the task view.");
        // Revert
        state.taskViews.splice(viewIndex, 0, removedView);
        renderApp();
    }
}