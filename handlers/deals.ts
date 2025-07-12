
import { state } from '../state.ts';
import { apiPost } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';
import type { DealNote } from '../types.ts';

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
