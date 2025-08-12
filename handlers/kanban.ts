// handlers/kanban.ts
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';
import type { KanbanStage } from '../types.ts';

export async function handleUpdateKanbanStageName(id: string, name: string) {
    const state = getState();
    const stage = state.kanbanStages.find(s => s.id === id);
    if (!stage || !name.trim()) return;

    const originalName = stage.name;
    
    setState(prevState => ({
        kanbanStages: prevState.kanbanStages.map(s => s.id === id ? { ...s, name: name.trim() } : s)
    }), ['page']);


    try {
        await apiPut('kanban_stages', { id, name: name.trim() });
    } catch (error) {
        console.error("Failed to update Kanban stage name:", error);
        alert("Could not update stage name.");
        setState(prevState => ({
            kanbanStages: prevState.kanbanStages.map(s => s.id === id ? { ...s, name: originalName } : s)
        }), ['page']);
    }
}

export async function handleReorderKanbanStages(orderedIds: string[]) {
    const state = getState();
    const originalOrder = [...state.kanbanStages];
    
    // Optimistic update
    const reorderedStages = state.kanbanStages.map(stage => {
        const newIndex = orderedIds.indexOf(stage.id);
        return { ...stage, sortOrder: newIndex };
    }).sort((a, b) => a.sortOrder - b.sortOrder);

    setState({ kanbanStages: reorderedStages }, ['page']);

    try {
        const updatePromises = orderedIds.map((id, index) => 
            apiPut('kanban_stages', { id, sortOrder: index })
        );
        await Promise.all(updatePromises);
    } catch (error) {
        console.error("Failed to reorder Kanban stages:", error);
        alert("Could not save the new stage order.");
        setState({ kanbanStages: originalOrder }, ['page']); // Revert on failure
    }
}

export async function handleCreateDefaultKanbanStagesForView(workspaceId: string, taskViewId: string) {
    const defaultStages: Omit<KanbanStage, 'id' | 'workspaceId'>[] = [
        { name: 'Backlog', status: 'backlog', sortOrder: 0, taskViewId },
        { name: 'To Do', status: 'todo', sortOrder: 1, taskViewId },
        { name: 'In Progress', status: 'inprogress', sortOrder: 2, taskViewId },
        { name: 'In Review', status: 'inreview', sortOrder: 3, taskViewId },
        { name: 'Done', status: 'done', sortOrder: 4, taskViewId },
    ];

    const payloads = defaultStages.map(stage => ({
        workspaceId,
        ...stage,
    }));

    try {
        const newStages = await apiPost('kanban_stages', payloads);
        setState(prevState => ({ kanbanStages: [...prevState.kanbanStages, ...newStages] }), []);
        return newStages;
    } catch (error) {
        console.error("Failed to create default kanban stages for view:", error);
        return [];
    }
}