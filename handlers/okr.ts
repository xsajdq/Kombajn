import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';
import { closeModal } from './ui.ts';
import type { Objective, KeyResult } from '../types.ts';

export async function handleCreateObjective(projectId: string, title: string, description: string) {
    if (!state.activeWorkspaceId) return;

    const payload: Omit<Objective, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId,
        title,
        description,
    };

    try {
        const [newObjective] = await apiPost('objectives', payload);
        state.objectives.push(newObjective);
        closeModal(false);
        updateUI(['side-panel']);
    } catch (error) {
        console.error("Failed to create objective:", error);
        alert("Could not create objective.");
    }
}

export async function handleAddKeyResult(objectiveId: string, title: string, type: 'number' | 'percentage', startValue: number, targetValue: number) {
    const payload: Omit<KeyResult, 'id'> = {
        objectiveId,
        title,
        type,
        startValue,
        targetValue,
        currentValue: startValue,
    };

    try {
        const [newKeyResult] = await apiPost('key_results', payload);
        state.keyResults.push(newKeyResult);
        closeModal(false);
        updateUI(['side-panel']);
    } catch (error) {
        console.error("Failed to add key result:", error);
        alert("Could not add key result.");
    }
}

export async function handleUpdateKeyResultValue(keyResultId: string, newValue: number) {
    const kr = state.keyResults.find(k => k.id === keyResultId);
    if (!kr) return;

    const krItemEl = document.querySelector(`.key-result-item[data-kr-id="${keyResultId}"]`);
    if (krItemEl) {
        delete (krItemEl as HTMLElement).dataset.editing;
    }

    const originalValue = kr.currentValue;
    kr.currentValue = newValue;
    updateUI(['side-panel']);

    try {
        await apiPut('key_results', { id: keyResultId, currentValue: newValue });
    } catch (error) {
        console.error("Failed to update key result:", error);
        kr.currentValue = originalValue;
        updateUI(['side-panel']);
        alert("Could not update key result value.");
    }
}
