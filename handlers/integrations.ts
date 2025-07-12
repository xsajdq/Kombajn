


import { state } from '../state.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';
import type { Integration } from '../types.ts';

export async function connectIntegration(provider: 'slack' | 'google_drive') {
    const { activeWorkspaceId, currentUser } = state;
    if (!activeWorkspaceId || !currentUser) return;

    const existingIntegration = state.integrations.find(i => i.workspaceId === activeWorkspaceId && i.provider === provider);

    let settings = {};
    if (provider === 'slack') {
        // Simulate OAuth flow & user mapping for Slack
        const mockSlackUserId = `U${currentUser.id.substring(0, 8).toUpperCase()}`;
        const mockSlackWorkspaceName = 'Kombajn Dev';
        const mockAccessToken = `xoxb-mock-token-${Date.now()}`;
        settings = { accessToken: mockAccessToken, slackWorkspaceName: mockSlackWorkspaceName };
        
        // Map the user in our DB by updating their profile
        const [updatedProfile] = await apiPut('profiles', { id: currentUser.id, slackUserId: mockSlackUserId });
        currentUser.slackUserId = updatedProfile.slackUserId;

    } else if (provider === 'google_drive') {
        // Simulate OAuth flow for Google Drive
        const mockGoogleUserEmail = currentUser.email;
        const mockAccessToken = `ya29.mock-gdrive-token-${Date.now()}`;
        settings = { accessToken: mockAccessToken, googleUserEmail: mockGoogleUserEmail };
    }


    try {
        if (existingIntegration) {
            // Re-connecting an existing, disabled integration
            const payload = { 
                id: existingIntegration.id, 
                isActive: true, 
                settings
            };
            const [updated] = await apiPut('integrations', payload);
            existingIntegration.isActive = updated.isActive;
            existingIntegration.settings = updated.settings;
        } else {
            // Creating a new integration
            const payload = {
                workspaceId: activeWorkspaceId,
                provider,
                isActive: true,
                settings,
            };
            const [created] = await apiPost('integrations', payload);
            state.integrations.push(created);
        }

        renderApp();
    } catch (error) {
        console.error(`Failed to connect ${provider}`, error);
        alert(`Could not connect to ${provider}`);
    }
}

export async function disconnectIntegration(provider: 'slack' | 'google_drive') {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const integration = state.integrations.find(i => i.workspaceId === activeWorkspaceId && i.provider === provider);
    if (!integration) return;

    try {
        // Instead of deleting, we'll set it to inactive. This preserves settings.
        const [updatedIntegration] = await apiPut('integrations', { id: integration.id, isActive: false });
        integration.isActive = updatedIntegration.isActive; // Optimistic update
        renderApp();
    } catch (error) {
        console.error(`Failed to disconnect ${provider} integration:`, error);
        alert(`Could not disconnect ${provider}.`);
    }
}