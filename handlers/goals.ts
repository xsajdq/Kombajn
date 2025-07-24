import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPut } from '../services/api.ts';

export async function handleToggleMilestone(milestoneId: string) {
    const milestone = state.keyResults.find(kr => kr.id === milestoneId);
    if (!milestone) return;

    const originalStatus = milestone.completed;
    milestone.completed = !milestone.completed; // Optimistic update

    // Also update the parent objective's current value based on milestones
    const objective = state.objectives.find(o => o.id === milestone.objectiveId);
    if (objective) {
        const milestonesForObjective = state.keyResults.filter(kr => kr.objectiveId === objective.id);
        const completedMilestones = milestonesForObjective.filter(kr => kr.completed).length;

        // If the objective's value is based on number of milestones, update it
        if (objective.valueUnit === 'milestones' || (!objective.valueUnit && objective.targetValue === milestonesForObjective.length)) {
            const originalObjectiveValue = objective.currentValue;
            objective.currentValue = completedMilestones;
            
            updateUI(['page']);

            try {
                await apiPut('key_results', { id: milestoneId, completed: milestone.completed });
                await apiPut('objectives', { id: objective.id, currentValue: completedMilestones });
            } catch (error) {
                console.error("Failed to update milestone:", error);
                alert("Could not update milestone status.");
                milestone.completed = originalStatus; // Revert milestone
                objective.currentValue = originalObjectiveValue; // Revert objective
                updateUI(['page']);
            }
        } else {
            // If it's not milestone-based, just update the milestone
            updateUI(['page']);
            try {
                await apiPut('key_results', { id: milestoneId, completed: milestone.completed });
            } catch (error) {
                console.error("Failed to update milestone:", error);
                alert("Could not update milestone status.");
                milestone.completed = originalStatus;
                updateUI(['page']);
            }
        }
    } else {
        // If no objective is found, still try to update the milestone
        updateUI(['page']);
        try {
            await apiPut('key_results', { id: milestoneId, completed: milestone.completed });
        } catch (error) {
            console.error("Failed to update milestone:", error);
            alert("Could not update milestone status.");
            milestone.completed = originalStatus;
            updateUI(['page']);
        }
    }
}
