// handlers/kanban.ts
import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPut } from '../services/api.ts';

export async function handleUpdateKanbanStageName(id: string, name: string) {
    const stage = state.kanbanStages.find(s => s.id === id);
    if (!stage || !name.trim()) return;

    const originalName = stage.name;
    stage.name = name.trim();
    updateUI(['page']);

    try {
        await apiPut('kanban_stages', { id, name: name.trim() });
    } catch (error) {
        console.error("Failed to update Kanban stage name:", error);
        alert("Could not update stage name.");
        stage.name = originalName;
        updateUI(['page']);
    }
}

export async function handleReorderKanbanStages(orderedIds: string[]) {
    const originalOrder = [...state.kanbanStages];
    
    // Optimistic update
    orderedIds.forEach((id, index) => {
        const stage = state.kanbanStages.find(s => s.id === id);
        if (stage) {
            stage.sortOrder = index;
        }
    });
    
    state.kanbanStages.sort((a, b) => a.sortOrder - b.sortOrder);
    updateUI(['page']);

    try {
        const updatePromises = orderedIds.map((id, index) => 
            apiPut('kanban_stages', { id, sortOrder: index })
        );
        await Promise.all(updatePromises);
    } catch (error) {
        console.error("Failed to reorder Kanban stages:", error);
        alert("Could not save the new stage order.");
        state.kanbanStages = originalOrder; // Revert on failure
        updateUI(['page']);
    }
}