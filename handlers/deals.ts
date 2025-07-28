

import { state } from '../state.ts';
import { apiFetch, apiPost, apiPut } from '../services/api.ts';
import { updateUI } from '../app-renderer.ts';
import type { Deal, Client, User, DealActivity } from '../types.ts';

export async function handleAddDealActivity(dealId: string, type: DealActivity['type'], content: string) {
    const { activeWorkspaceId, currentUser } = state;
    if (!activeWorkspaceId || !currentUser || !content.trim()) return;

    const payload: Omit<DealActivity, 'id' | 'createdAt'> = {
        workspaceId: activeWorkspaceId,
        dealId,
        userId: currentUser.id,
        type,
        content: content.trim(),
    };

    try {
        const [newActivity] = await apiPost('deal_activities', payload);
        state.dealActivities.push(newActivity);

        const deal = state.deals.find(d => d.id === dealId);
        if (deal) {
            const newActivityDate = new Date().toISOString();
            deal.lastActivityAt = newActivityDate;
            await apiPut('deals', { id: dealId, lastActivityAt: newActivityDate });
        }

        updateUI(['side-panel']);
    } catch (error) {
        console.error("Failed to add deal activity:", error);
        alert("Could not save the activity. Please try again.");
    }
}