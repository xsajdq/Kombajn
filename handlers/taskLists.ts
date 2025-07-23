

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { TaskList } from '../types.ts';

export async function handleCreateTaskList(projectId: string, name: string) {
    if (!state.activeWorkspaceId || !name.trim() || !projectId) return;

    const payload: Omit<TaskList, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId: projectId,
        name: name.trim(),
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

export async function handleRenameTaskList(id: string, newName: string) {
    const list = state.taskLists.find(tl => tl.id === id);
    if (!list || !newName.trim()) return;

    const originalName = list.name;
    list.name = newName.trim(); // Optimistic update
    renderApp();

    try {
        await apiPut('task_lists', { id, name: newName.trim() });
    } catch (error) {
        console.error("Failed to update task list:", error);
        alert("Could not update the task list.");
        list.name = originalName; // Revert
        renderApp();
    }
}

export async function handleDeleteTaskList(id: string) {
    if (!confirm("Are you sure you want to delete this section? Tasks in this section will not be deleted.")) {
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
        // This is complex to revert, so a refresh might be better
        renderApp();
    }
}