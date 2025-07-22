
import { state } from '../state.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';
import type { Integration } from '../types.ts';

export function connectIntegration(provider: 'slack' | 'google_drive') {
    const { activeWorkspaceId, currentUser } = state;
    if (!activeWorkspaceId || !currentUser) return;
    
    // The backend will handle the redirect to the provider's auth page.
    const connectUrl = `/api?action=auth-connect-${provider}&workspaceId=${activeWorkspaceId}`;

    const authWindow = window.open(connectUrl, '_blank', 'width=600,height=700,popup=true');

    // Listen for messages from the popup
    const messageListener = async (event: MessageEvent) => {
        // Ensure the message is from our popup
        if (event.source !== authWindow) {
            return;
        }

        const { success, error, provider: returnedProvider } = event.data;
        if (returnedProvider !== provider) return;

        if (success) {
            // Refetch integrations to get the new connected status
            const integrations = await apiFetch(`/api?action=data&resource=integrations`);
            state.integrations = integrations;
            renderApp();
        } else if (error) {
            alert(`Failed to connect with ${provider}: ${error}`);
        }

        // Clean up
        window.removeEventListener('message', messageListener);
        if (authWindow) {
            authWindow.close();
        }
    };

    window.addEventListener('message', messageListener);
}


export async function disconnectIntegration(provider: 'slack' | 'google_drive') {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const integration = state.integrations.find(i => i.workspaceId === activeWorkspaceId && i.provider === provider);
    if (!integration) return;

    try {
        // Instead of deleting, we'll set it to inactive. This preserves settings.
        const [updatedIntegration] = await apiPut('integrations', { id: integration.id, isActive: false, settings: {} });
        integration.isActive = updatedIntegration.isActive;
        integration.settings = updatedIntegration.settings;
        renderApp();
    } catch (error) {
        console.error(`Failed to disconnect ${provider} integration:`, error);
        alert(`Could not disconnect ${provider}.`);
    }
}