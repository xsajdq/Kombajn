// handlers/pipeline.ts
import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { PipelineStage } from '../types.ts';
import { t } from '../i18n.ts';

export async function handleCreateDefaultStages(workspaceId: string) {
    const defaultStages = [
        { name: 'Lead In', category: 'open', sortOrder: 0 },
        { name: 'Contact Made', category: 'open', sortOrder: 1 },
        { name: 'Demo Scheduled', category: 'open', sortOrder: 2 },
        { name: 'Proposal Made', category: 'open', sortOrder: 3 },
        { name: 'Won', category: 'won', sortOrder: 4 },
        { name: 'Lost', category: 'lost', sortOrder: 5 },
    ];

    const payloads = defaultStages.map(stage => ({
        workspaceId,
        ...stage,
    }));

    try {
        const newStages = await apiPost('pipeline_stages', payloads);
        state.pipelineStages.push(...newStages);
        return newStages;
    } catch (error) {
        console.error("Failed to create default pipeline stages:", error);
        return [];
    }
}

export async function handleCreateStage(name: string) {
    if (!state.activeWorkspaceId) return;

    const openStages = state.pipelineStages.filter(s => s.workspaceId === state.activeWorkspaceId && s.category === 'open');
    const maxSortOrder = openStages.reduce((max, s) => Math.max(max, s.sortOrder), -1);

    const payload: Omit<PipelineStage, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name,
        category: 'open',
        sortOrder: maxSortOrder + 1,
    };

    try {
        const [newStage] = await apiPost('pipeline_stages', payload);
        state.pipelineStages.push(newStage);
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to create pipeline stage:", error);
        alert("Could not create stage.");
    }
}

export async function handleUpdateStage(id: string, name: string) {
    const stage = state.pipelineStages.find(s => s.id === id);
    if (!stage || !name.trim()) return;

    const originalName = stage.name;
    stage.name = name.trim();
    updateUI(['page']);

    try {
        await apiPut('pipeline_stages', { id, name: name.trim() });
    } catch (error) {
        console.error("Failed to update stage:", error);
        alert("Could not update stage name.");
        stage.name = originalName;
        updateUI(['page']);
    }
}

export async function handleDeleteStage(id: string) {
    const stage = state.pipelineStages.find(s => s.id === id);
    if (!stage || stage.category !== 'open') return;

    const dealsInStage = state.deals.some(d => d.stageId === id);
    if (dealsInStage) {
        alert(t('settings.deals_in_stage_warning'));
        return;
    }

    if (!confirm(`Are you sure you want to delete the "${stage.name}" stage?`)) return;

    const stageIndex = state.pipelineStages.findIndex(s => s.id === id);
    const [removedStage] = state.pipelineStages.splice(stageIndex, 1);
    updateUI(['page']);

    try {
        await apiFetch('/api?action=data&resource=pipeline_stages', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error("Failed to delete stage:", error);
        alert("Could not delete stage.");
        state.pipelineStages.splice(stageIndex, 0, removedStage);
        updateUI(['page']);
    }
}

export async function handleReorderStages(orderedIds: string[]) {
    const originalOrder = [...state.pipelineStages];
    
    // Optimistic update
    orderedIds.forEach((id, index) => {
        const stage = state.pipelineStages.find(s => s.id === id);
        if (stage) {
            stage.sortOrder = index;
        }
    });
    // Sort the state array based on the new order
    state.pipelineStages.sort((a, b) => a.sortOrder - b.sortOrder);
    updateUI(['page']);

    try {
        const updatePromises = orderedIds.map((id, index) => 
            apiPut('pipeline_stages', { id, sortOrder: index })
        );
        await Promise.all(updatePromises);
    } catch (error) {
        console.error("Failed to reorder stages:", error);
        alert("Could not save the new stage order.");
        state.pipelineStages = originalOrder; // Revert on failure
        updateUI(['page']);
    }
}