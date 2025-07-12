

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { PlanId, PlanChange } from '../types.ts';
import { apiPut } from '../services/api.ts';

export async function handlePlanChange(newPlanId: PlanId) {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (workspace && workspace.subscription.planId !== newPlanId) {
        const newChange: PlanChange = { planId: newPlanId, date: new Date().toISOString() };
        
        const currentHistory = Array.isArray(workspace.planHistory) ? workspace.planHistory : [];
        const updatedHistory = [...currentHistory, newChange];

        const payload = {
            id: workspace.id,
            subscriptionPlanId: newPlanId,
            planHistory: updatedHistory
        };
        
        try {
            const [updatedWorkspace] = await apiPut('workspaces', payload);
            const index = state.workspaces.findIndex(w => w.id === workspace.id);
            if (index !== -1) {
                state.workspaces[index] = {
                    ...state.workspaces[index],
                    ...updatedWorkspace,
                    subscription: {
                        planId: updatedWorkspace.subscriptionPlanId,
                        status: updatedWorkspace.subscriptionStatus
                    },
                    planHistory: updatedWorkspace.planHistory || []
                };
            }
            renderApp();
        } catch (error) {
            console.error("Failed to change plan:", error);
            alert("Failed to change plan. Please try again.");
        }
    }
}


export async function handleCancelSubscription() {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (workspace) {
        const originalStatus = workspace.subscription.status;
        const originalPlan = workspace.subscription.planId;
        
        workspace.subscription.status = 'canceled';
        workspace.subscription.planId = 'free';
        renderApp();

        try {
            await apiPut('workspaces', { 
                id: workspace.id, 
                subscriptionStatus: 'canceled', 
                subscriptionPlanId: 'free' 
            });
        } catch (error) {
            console.error("Failed to cancel subscription:", error);
            alert("Failed to cancel subscription. Please try again.");
            // Revert optimistic update
            workspace.subscription.status = originalStatus;
            workspace.subscription.planId = originalPlan;
            renderApp();
        }
    }
}