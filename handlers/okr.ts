import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';
import { closeModal } from './ui.ts';
import type { Objective, KeyResult } from '../types.ts';

export async function handleCreateObjective(projectId: string, title: string, description: string) {
    const state = getState();
    if (!state.activeWorkspaceId) return;

    const payload: Omit<Objective, 'id' | 'currentValue' | 'status'> = {
        workspaceId: state.activeWorkspaceId,
        projectId,
        title,
        description,
    };

    try {
        const [newObjective] = await apiPost('objectives', {...payload, status: 'in_progress', currentValue: 0});
        setState(prevState => ({ objectives: [...prevState.objectives, newObjective] }), ['side-panel']);
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
        setState(prevState => ({ keyResults: [...prevState.keyResults, newKeyResult] }), ['side-panel']);
        closeModal(false);
        updateUI(['side-panel']);
    } catch (error) {
        console.error("Failed to add key result:", error);
        alert("Could not add key result.");
    }
}

export async function handleUpdateKeyResultValue(krId: string, value: number) {
    const state = getState();
    const keyResult = state.keyResults.find(kr => kr.id === krId);
    if (!keyResult) return;

    const originalValue = keyResult.currentValue;

    const krItem = document.querySelector(`.key-result-item[data-kr-id="${krId}"]`);
    if (krItem) {
        krItem.removeAttribute('data-editing');
    }
    
    setState(prevState => ({
        keyResults: prevState.keyResults.map(kr => kr.id === krId ? { ...kr, currentValue: value } : kr)
    }), ['side-panel']);


    try {
        await apiPut('key_results', { id: krId, currentValue: value });
    } catch (error) {
        console.error("Failed to update key result value:", error);
        alert("Could not update key result.");
        // Revert
        setState(prevState => ({
            keyResults: prevState.keyResults.map(kr => kr.id === krId ? { ...kr, currentValue: originalValue } : kr)
        }), ['side-panel']);
    }
}
