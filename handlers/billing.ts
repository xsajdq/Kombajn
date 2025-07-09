
import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { PlanId, PlanChange } from '../types.ts';
import { apiPut } from '../services/api.ts';

export async function handlePlanChange(newPlanId: PlanId) {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (workspace && workspace.subscription.planId !== newPlanId) {
        const newChange: PlanChange = { planId: newPlanId, date: new Date().toISOString() };
        
        // Ensure planHistory is an array before spreading
        const currentHistory = Array.isArray(workspace.planHistory) ? workspace.planHistory : [];
        const updatedHistory = [...currentHistory, newChange];

        const payload = {
            id: workspace.id,
            subscription_plan_id: newPlanId,
            planHistory: updatedHistory
        };
        
        try {
            const [updatedWorkspaceRaw] = await apiPut('workspaces', payload);
            const index = state.workspaces.findIndex(w => w.id === workspace.id);
            if (index !== -1) {
                // Re-transform the returned data to update local state accurately
                state.workspaces[index] = {
                    ...state.workspaces[index], // Preserve other parts of state object
                    ...updatedWorkspaceRaw,   // Overwrite with fresh data from DB
                    subscription: {           // Re-nest subscription object
                        planId: updatedWorkspaceRaw.subscription_plan_id,
                        status: updatedWorkspaceRaw.subscription_status
                    },
                    planHistory: updatedWorkspaceRaw.planHistory || []
                };
            }
            renderApp();
        } catch (error) {
            console.error("Failed to change plan:", error);
            alert("Failed to change plan. Please try again.");
            // Optionally, you could re-fetch data here to revert optimistic UI changes
        }
    }
}


export function handleCancelSubscription() {
    // Placeholder for actual subscription cancellation logic (e.g., with Stripe)
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (workspace) {
        workspace.subscription.status = 'canceled';
        // Optionally downgrade to free plan
        workspace.subscription.planId = 'free';
        saveState();
        renderApp();
    }
}