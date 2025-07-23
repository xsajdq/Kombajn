
import { state } from '../state.ts';
import { apiFetch } from '../services/api.ts';
import { closeSidePanels } from './ui.ts';
import { renderApp } from '../app-renderer.ts';

export async function handleDeleteClient(clientId: string) {
    if (!confirm('Are you sure you want to delete this client and all associated data (projects, tasks, invoices)? This is irreversible.')) {
        return;
    }

    const clientIndex = state.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;

    // Optimistic update
    const [removedClient] = state.clients.splice(clientIndex, 1);
    const projectsToDelete = state.projects.filter(p => p.clientId === clientId).map(p => p.id);
    state.projects = state.projects.filter(p => p.clientId !== clientId);
    state.tasks = state.tasks.filter(t => !projectsToDelete.includes(t.projectId));
    state.invoices = state.invoices.filter(i => i.clientId !== clientId);

    closeSidePanels(); // This calls renderApp internally

    try {
        // Corrected URL
        await apiFetch(`/api?action=data&resource=clients`, {
            method: 'DELETE',
            body: JSON.stringify({ id: clientId }),
        });
        // The backend should cascade delete, so on next full data load, everything will be correct.
    } catch (error) {
        console.error("Failed to delete client:", error);
        alert("Could not delete client from the server. Reverting changes.");
        // Revert state by re-adding the client; related items will be out of sync until next bootstrap
        state.clients.splice(clientIndex, 0, removedClient);
        renderApp(); // re-render to show the reverted state
    }
}
