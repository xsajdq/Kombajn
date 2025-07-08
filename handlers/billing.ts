
import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { PlanId, PlanChange } from '../types.ts';

export function handlePlanChange(newPlanId: PlanId) {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (workspace && workspace.subscription.planId !== newPlanId) {
        workspace.subscription.planId = newPlanId;
        const newChange: PlanChange = { planId: newPlanId, date: new Date().toISOString() };
        if (!workspace.planHistory) {
            workspace.planHistory = [];
        }
        workspace.planHistory.push(newChange);
        saveState();
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