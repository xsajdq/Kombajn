
import { getState, setState } from '../state.ts';
import { apiFetch, apiPut } from '../services/api.ts';

export async function fetchGoalsForWorkspace(workspaceId: string) {
    console.log(`Fetching goals data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&goalsOnly=true`);
        if (!data) throw new Error("Goals data fetch returned null.");

        setState(prevState => ({
            objectives: [...prevState.objectives.filter(i => i.workspaceId !== workspaceId), ...(data.objectives || [])],
            keyResults: [...prevState.keyResults.filter(i => !data.objectives.some((o: any) => o.id === i.objectiveId)), ...(data.keyResults || [])],
            ui: {
                ...prevState.ui,
                goals: { ...prevState.ui.goals, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched goals data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch goals data:", error);
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                goals: { ...prevState.ui.goals, isLoading: false, loadedWorkspaceId: null }
            }
        }), ['page']);
    }
}

export function handleAddMilestone() {
    const input = document.getElementById('new-milestone-input') as HTMLInputElement;
    const container = document.getElementById('milestones-container');
    const text = input.value.trim();

    if (text && container) {
        const tempId = `new-${Date.now()}`;
        const milestoneHtml = `
            <div class="milestone-item flex items-center gap-2" data-id="${tempId}">
                <input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary milestone-checkbox" disabled>
                <input type="text" class="form-control flex-grow milestone-input" value="${text}">
                <button type="button" class="btn-icon remove-milestone-btn"><span class="material-icons-sharp text-base text-danger">delete</span></button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', milestoneHtml);
        input.value = '';
        input.focus();
    }
}

export function handleRemoveMilestone(milestoneId: string) {
    const milestoneElement = document.querySelector(`.milestone-item[data-id="${milestoneId}"]`);
    if (milestoneElement) {
        milestoneElement.remove();
    }
}

export async function handleToggleMilestone(milestoneId: string) {
    const state = getState();
    const keyResult = state.keyResults.find(kr => kr.id === milestoneId);
    if (!keyResult) return;

    const originalCompleted = keyResult.completed;
    const newCompleted = !originalCompleted;

    // Optimistic update
    setState(prevState => ({
        keyResults: prevState.keyResults.map(kr => 
            kr.id === milestoneId ? { ...kr, completed: newCompleted } : kr
        )
    }), ['page']);

    try {
        await apiPut('key_results', { id: milestoneId, completed: newCompleted });
    } catch (error) {
        console.error("Failed to toggle milestone:", error);
        alert("Could not update milestone status.");
        // Revert on failure
        setState(prevState => ({
            keyResults: prevState.keyResults.map(kr => 
                kr.id === milestoneId ? { ...kr, completed: originalCompleted } : kr
            )
        }), ['page']);
    }
}
