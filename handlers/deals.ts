

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

export async function handleSendDealEmail(dealId: string, to: string, subject: string, body: string, form: HTMLFormElement) {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const sendButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';
    }

    try {
        await apiFetch('/api?action=send-deal-email', {
            method: 'POST',
            body: JSON.stringify({ workspaceId: activeWorkspaceId, to, subject, body })
        });
        
        const contact = state.clientContacts.find(c => c.email === to);
        const activityContent = `Email sent to ${contact?.name || to}\nSubject: ${subject}\n\n${body}`;
        await handleAddDealActivity(dealId, 'email', activityContent);
        
        form.reset();

    } catch (error) {
        console.error("Failed to send deal email:", error);
        alert(`Could not send email: ${(error as Error).message}`);
    } finally {
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.textContent = 'Send Email';
        }
    }
}