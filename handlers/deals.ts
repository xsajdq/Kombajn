

import { state } from '../state.ts';
import { apiFetch, apiPost } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';
import type { Deal, Client, User, DealNote } from '../types.ts';

export async function fetchSalesData() {
    if (!state.activeWorkspaceId || state.ui.sales.isLoading) return;

    if (state.ui.sales.loadedWorkspaceId === state.activeWorkspaceId) {
        return; // Data already loaded for this workspace
    }

    state.ui.sales.isLoading = true;
    renderApp(); // Show loader

    try {
        const data = await apiFetch(`/api/sales-data?workspaceId=${state.activeWorkspaceId}`);
        
        // This endpoint returns deals, clients, and owners (users)
        state.deals = data.deals || [];
        
        // Merge clients to avoid duplicates
        const existingClientIds = new Set(state.clients.map(c => c.id));
        const newClients = (data.clients || []).filter((c: Client) => !existingClientIds.has(c.id));
        state.clients.push(...newClients);

        // Merge users to avoid duplicates
        const existingUserIds = new Set(state.users.map(u => u.id));
        const newUsers = (data.users || []).filter((u: User) => !existingUserIds.has(u.id));
        state.users.push(...newUsers);
        
        state.ui.sales.loadedWorkspaceId = state.activeWorkspaceId;
    } catch (error) {
        console.error("Failed to fetch sales data:", error);
        state.ui.sales.loadedWorkspaceId = null; // Allow retry
    } finally {
        state.ui.sales.isLoading = false;
        renderApp(); // Re-render with data or to remove loader on error
    }
}


export async function handleAddDealNote(dealId: string, content: string) {
    const { activeWorkspaceId, currentUser } = state;
    if (!activeWorkspaceId || !currentUser || !content.trim()) return;

    const payload: Omit<DealNote, 'id' | 'createdAt'> = {
        workspaceId: activeWorkspaceId,
        dealId,
        userId: currentUser.id,
        content: content.trim(),
    };

    try {
        const [newNote] = await apiPost('deal_notes', payload);
        state.dealNotes.push(newNote);
        renderApp();
    } catch (error) {
        console.error("Failed to add deal note:", error);
        alert("Could not save the note. Please try again.");
    }
}