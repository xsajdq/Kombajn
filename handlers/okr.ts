import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';
import { closeModal } from './ui.ts';
import type { Objective, KeyResult } from '../types.ts';

export async function handleCreateObjective(projectId: string, title: string, description: string) {
    if (!state.activeWorkspaceId) return;

    const payload: Omit<Objective, 'id' | 'currentValue' | 'status'> = {
        workspaceId: state.activeWorkspaceId,
        projectId,
        title,
        description,
    };

    try {
        const [newObjective] = await apiPost('objectives', {...payload, status: 'in_progress', currentValue: 0});
        state.objectives.push(newObjective);
        closeModal(false);
        updateUI(['side-panel']);
    } catch (error) {
        console.error("Failed to create objective:", error);
        alert("Could not create objective.");
    }
}

export async function handleAddKeyResult(objectiveId: string, title: string, type: 'number' | 'percentage', startValue: number, targetValue: number) {
    const payload: Omit<KeyResult, 'id' | 'completed' | 'currentValue'> = {
        objectiveId,
        title,
        type,
        startValue,
        targetValue,
    };

    try {
        const [newKeyResult] = await apiPost('key_results', {...payload, completed: false, currentValue: startValue});
        state.keyResults.push(newKeyResult);
        closeModal(false);
        updateUI(['side-panel']);
    } catch (error) {
        console.error("Failed to add key result:", error);
        alert("Could not add key result.");
    }
}

export async function handleUpdateKeyResultValue(krId: string, value: number) {
    const keyResult = state.keyResults.find(kr => kr.id === krId);
    if (!keyResult) return;

    const originalValue = keyResult.currentValue;
    keyResult.currentValue = value;

    // After updating, we need to remove the editing state from the UI
    const krItem = document.querySelector(`.key-result-item[data-kr-id="${krId}"]`);
    if (krItem) {
        krItem.removeAttribute('data-editing');
    }
    updateUI(['side-panel']);

    try {
        await apiPut('key_results', { id: krId, currentValue: value });
    } catch (error) {
        console.error("Failed to update key result value:", error);
        alert("Could not update key result.");
        keyResult.currentValue = originalValue; // Revert
        updateUI(['side-panel']);
    }
}