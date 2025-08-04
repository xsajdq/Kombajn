// handlers/pipeline.ts
import { getState, setState } from '../state.ts';
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
        setState(prevState => ({ pipelineStages: [...prevState.pipelineStages, ...newStages] }), []);
        return newStages;
    } catch (error) {
        console.error("Failed to create default pipeline stages:", error);
        return [];
    }
}

export async function handleCreateStage(name: string) {
    const state = getState();
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
        setState(prevState => ({ pipelineStages: [...prevState.pipelineStages, newStage] }), ['page']);
    } catch (error) {
        console.error("Failed to create pipeline stage:", error);
        alert("Could not create stage.");
    }
}

export async function handleUpdateStage(id: string, name: string) {
    const state = getState();
    const stage = state.pipelineStages.find(s => s.id === id);
    if (!stage || !name.trim()) return;

    const originalName = stage.name;
    
    setState(prevState => ({
        pipelineStages: prevState.pipelineStages.map(s => s.id === id ? { ...s, name: name.trim() } : s)
    }), ['page']);


    try {
        await apiPut('pipeline_stages', { id, name: name.trim() });
    } catch (error) {
        console.error("Failed to update stage:", error);
        alert("Could not update stage name.");
        setState(prevState => ({
            pipelineStages: prevState.pipelineStages.map(s => s.id === id ? { ...s, name: originalName } : s)
        }), ['page']);
    }
}

export async function handleDeleteStage(id: string) {
    const state = getState();
    const stage = state.pipelineStages.find(s => s.id === id);
    if (!stage || stage.category !== 'open') return;

    const dealsInStage = state.deals.some(d => d.stage === id);
    if (dealsInStage) {
        alert(t('settings.deals_in_stage_warning'));
        return;
    }

    if (!confirm(`Are you sure you want to delete the "${stage.name}" stage?`)) return;

    const originalStages = [...state.pipelineStages];
    setState(prevState => ({
        pipelineStages: prevState.pipelineStages.filter(s => s.id !== id)
    }), ['page']);


    try {
        await apiFetch('/api?action=data&resource=pipeline_stages', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error("Failed to delete stage:", error);
        alert("Could not delete stage.");
        setState({ pipelineStages: originalStages }, ['page']);
    }
}

export async function handleReorderStages(orderedIds: string[]) {
    const state = getState();
    const originalOrder = [...state.pipelineStages];
    
    // Optimistic update
    const reorderedStages = state.pipelineStages.map(stage => {
        const newIndex = orderedIds.indexOf(stage.id);
        // Keep non-open stages at the end
        if (stage.category !== 'open') return { ...stage, sortOrder: orderedIds.length + (stage.category === 'won' ? 0 : 1) };
        return { ...stage, sortOrder: newIndex };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
    
    setState({ pipelineStages: reorderedStages }, ['page']);

    try {
        const updatePromises = orderedIds.map((id, index) => 
            apiPut('pipeline_stages', { id, sortOrder: index })
        );
        await Promise.all(updatePromises);
    } catch (error) {
        console.error("Failed to reorder stages:", error);
        alert("Could not save the new stage order.");
        setState({ pipelineStages: originalOrder }, ['page']); // Revert on failure
    }
}