

import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { PlanId, PlanChange } from '../types.ts';
import { apiPut } from '../services/api.ts';
import { t } from '../i18n.ts';
import { showToast } from './ui.ts';

export async function handlePlanChange(newPlanId: PlanId) {
    const state = getState();
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
            setState(prevState => ({
                workspaces: prevState.workspaces.map(w => {
                    if (w.id === workspace.id) {
                        return {
                            ...w,
                            ...updatedWorkspace,
                            subscription: {
                                planId: updatedWorkspace.subscriptionPlanId,
                                status: updatedWorkspace.subscriptionStatus
                            },
                            planHistory: updatedWorkspace.planHistory || []
                        };
                    }
                    return w;
                })
            }), ['page']);
        } catch (error) {
            console.error("Failed to change plan:", error);
            showToast(t('errors.plan_change_failed'), 'error');
        }
    }
}


export async function handleCancelSubscription() {
    const state = getState();
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (workspace) {
        const originalStatus = workspace.subscription.status;
        const originalPlan = workspace.subscription.planId;
        
        // Optimistic update
        setState(prevState => ({
            workspaces: prevState.workspaces.map(w => w.id === workspace.id ? {
                ...w,
                subscription: {
                    ...w.subscription,
                    status: 'canceled',
                    planId: 'free'
                }
            } : w)
        }), ['page']);

        try {
            await apiPut('workspaces', { 
                id: workspace.id, 
                subscriptionStatus: 'canceled', 
                subscriptionPlanId: 'free' 
            });
        } catch (error) {
            console.error("Failed to cancel subscription:", error);
            showToast(t('errors.subscription_cancel_failed'), 'error');
            // Revert on failure
            setState(prevState => ({
                workspaces: prevState.workspaces.map(w => w.id === workspace.id ? {
                    ...w,
                    subscription: {
                        ...w.subscription,
                        status: originalStatus,
                        planId: originalPlan
                    }
                } : w)
            }), ['page']);
        }
    }
}