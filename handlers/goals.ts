import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPut } from '../services/api.ts';

export function handleAddMilestone() {
    const container = document.getElementById('milestones-container');
    const input = document.getElementById('new-milestone-input') as HTMLInputElement;
    if (!container || !input || !input.value.trim()) return;

    const text = input.value.trim();
    const id = `new-${Date.now()}`;

    const milestoneHtml = `
        <div class="flex items-center gap-2 milestone-item" data-id="${id}">
            <input type="text" class="form-control milestone-input" value="${text}" readonly>
            <button type="button" class="btn-icon remove-milestone-btn"><span class="material-icons-sharp text-base">delete</span></button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', milestoneHtml);
    input.value = '';
    input.focus();
}

export function handleRemoveMilestone(id: string) {
    const item = document.querySelector(`.milestone-item[data-id="${id}"]`);
    if (item) {
        item.remove();
    }
}

export async function handleToggleMilestone(milestoneId: string) {
    const state = getState();
    const milestone = state.keyResults.find(kr => kr.id === milestoneId);
    if (!milestone) return;

    const originalMilestone = { ...milestone };
    const objective = state.objectives.find(o => o.id === milestone.objectiveId);
    const originalObjective = objective ? { ...objective } : null;

    // Optimistic update
    setState(prevState => {
        const keyResults = prevState.keyResults.map(kr => 
            kr.id === milestoneId ? { ...kr, completed: !kr.completed } : kr
        );
        let objectives = [...prevState.objectives];

        if (objective) {
            const milestonesForObjective = keyResults.filter(kr => kr.objectiveId === objective.id);
            const completedMilestones = milestonesForObjective.filter(kr => kr.completed).length;

            if (objective.valueUnit === 'milestones' || (!objective.valueUnit && objective.targetValue === milestonesForObjective.length)) {
                objectives = objectives.map(o => 
                    o.id === objective.id ? { ...o, currentValue: completedMilestones } : o
                );
            }
        }
        
        return { keyResults, objectives };
    }, ['page']);

    try {
        await apiPut('key_results', { id: milestoneId, completed: !originalMilestone.completed });
        if (objective && (objective.valueUnit === 'milestones' || (!objective.valueUnit && getState().keyResults.filter(kr => kr.objectiveId === objective.id).length))) {
            const currentCompleted = getState().keyResults.filter(kr => kr.objectiveId === objective.id && kr.completed).length;
            await apiPut('objectives', { id: objective.id, currentValue: currentCompleted });
        }
    } catch (error) {
        console.error("Failed to update milestone:", error);
        alert("Could not update milestone status.");
        // Revert
        setState(prevState => ({
            keyResults: prevState.keyResults.map(kr => kr.id === milestoneId ? originalMilestone : kr),
            objectives: originalObjective ? prevState.objectives.map(o => o.id === originalObjective.id ? originalObjective : o) : prevState.objectives
        }), ['page']);
    }
}