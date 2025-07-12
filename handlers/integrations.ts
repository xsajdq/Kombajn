

import { state } from '../state.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { renderApp } from '../app-renderer.ts';
import type { Integration } from '../types.ts';

export async function connectIntegration(provider: 'slack') {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    // Check if an integration record already exists to avoid duplicates
    const existing = state.integrations.find(i => i.workspaceId === activeWorkspaceId && i.provider === provider);
    if (existing) {
        // If it exists but is inactive, activate it. Otherwise, do nothing.
        if (!existing.isActive) {
            try {
                const [updatedIntegration] = await apiPut('integrations', { id: existing.id, isActive: true });
                existing.isActive = updatedIntegration.isActive;
                renderApp();
            } catch (error) {
                console.error(`Failed to activate ${provider} integration:`, error);
                alert(`Could not activate ${provider} integration.`);
            }
        }
        return;
    }

    const payload = {
        workspaceId: activeWorkspaceId,
        provider,
        isActive: true,
        settings: {},
    };

    try {
        const [newIntegration] = await apiPost('integrations', payload);
        state.integrations.push(newIntegration);
        renderApp();
    } catch (error) {
        console.error(`Failed to connect ${provider} integration:`, error);
        alert(`Could not connect to ${provider}.`);
    }
}

export async function disconnectIntegration(provider: 'slack') {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const integration = state.integrations.find(i => i.workspaceId === activeWorkspaceId && i.provider === provider);
    if (!integration) return;

    try {
        // Instead of deleting, we'll set it to inactive. This preserves settings.
        await apiPut('integrations', { id: integration.id, isActive: false });
        integration.isActive = false; // Optimistic update
        renderApp();
    } catch (error) {
        console.error(`Failed to disconnect ${provider} integration:`, error);
        alert(`Could not disconnect ${provider}.`);
    }
}

export async function saveIntegrationSettings(provider: 'slack') {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const integration = state.integrations.find(i => i.workspaceId === activeWorkspaceId && i.provider === provider);
    if (!integration) return;

    let settings = {};
    if (provider === 'slack') {
        const webhookUrl = (document.getElementById('slack-webhook-url') as HTMLInputElement)?.value;
        settings = { webhookUrl };
    }
    
    const originalSettings = { ...integration.settings };
    integration.settings = settings; // Optimistic update
    
    try {
        await apiPut('integrations', { id: integration.id, settings });
        alert('Settings saved!');
        renderApp();
    } catch (error) {
        console.error(`Failed to save ${provider} settings:`, error);
        alert(`Could not save settings for ${provider}.`);
        integration.settings = originalSettings; // Revert
        renderApp();
    }
}