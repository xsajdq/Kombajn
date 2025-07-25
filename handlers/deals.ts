
import { state } from '../state.ts';
import { apiFetch, apiPost, apiPut } from '../services/api.ts';
import { updateUI } from '../app-renderer.ts';
import type { Deal, Client, User, DealActivity } from '../types.ts';

export async function fetchSalesData() {
    if (!state.activeWorkspaceId || state.ui.sales.isLoading) return;

    if (state.ui.sales.loadedWorkspaceId === state.activeWorkspaceId) {
        return;
    }

    state.ui.sales.isLoading = true;
    updateUI(['page']);

    try {
        const data = await apiFetch(`/api?action=sales-data&workspaceId=${state.activeWorkspaceId}`);
        
        state.deals = data.deals || [];
        
        const existingClientIds = new Set(state.clients.map(c => c.id));
        const newClients = (data.clients || []).filter((c: Client) => !existingClientIds.has(c.id));
        state.clients.push(...newClients);

        const existingUserIds = new Set(state.users.map(u => u.id));
        const newUsers = (data.users || []).filter((u: User) => !existingUserIds.has(u.id));
        state.users.push(...newUsers);
        
        state.ui.sales.loadedWorkspaceId = state.activeWorkspaceId;
    } catch (error) {
        console.error("Failed to fetch sales data:", error);
        state.ui.sales.loadedWorkspaceId = null;
    } finally {
        state.ui.sales.isLoading = false;
        updateUI(['page']);
    }
}


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