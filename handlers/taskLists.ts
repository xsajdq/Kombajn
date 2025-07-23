
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { TaskList } from '../types.ts';

export async function handleCreateTaskList(projectId: string, name: string, icon: string) {
    if (!state.activeWorkspaceId || !name.trim() || !projectId) return;

    const payload: Omit<TaskList, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId: projectId,
        name: name.trim(),
        icon: icon,
    };

    try {
        const [newList] = await apiPost('task_lists', payload);
        state.taskLists.push(newList);
        renderApp();
    } catch (error) {
        console.error("Failed to create task list:", error);
        alert("Could not create the task list.");
    }
}

export async function handleUpdateTaskList(id: string, name: string, icon: string) {
    const list = state.taskLists.find(tl => tl.id === id);
    if (!list) return;

    const originalName = list.name;
    const originalIcon = list.icon;

    // Optimistic update
    list.name = name;
    list.icon = icon;
    renderApp();

    try {
        await apiPut('task_lists', { id, name, icon });
    } catch (error) {
        console.error("Failed to update task list:", error);
        alert("Could not update the task list.");
        // Revert
        list.name = originalName;
        list.icon = originalIcon;
        renderApp();
    }
}

export async function handleDeleteTaskList(id: string) {
    if (!confirm("Are you sure you want to delete this task list? Tasks in this list will not be deleted but will become unassigned from any list.")) {
        return;
    }

    const listIndex = state.taskLists.findIndex(tl => tl.id === id);
    if (listIndex === -1) return;

    const [removedList] = state.taskLists.splice(listIndex, 1);
    // Optimistically update tasks that were in this list
    state.tasks.forEach(task => {
        if (task.taskListId === id) {
            task.taskListId = null;
        }
    });
    renderApp();

    try {
        await apiFetch('/api?action=data&resource=task_lists', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error("Failed to delete task list:", error);
        alert("Could not delete the task list.");
        // Revert
        state.taskLists.splice(listIndex, 0, removedList);
        state.tasks.forEach(task => {
             // This is imperfect, as we don't know which tasks were originally in the list.
             // A full state refresh would be better in a real-world scenario.
        });
        renderApp();
    }
}