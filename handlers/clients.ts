import { state } from '../state.ts';
import { apiFetch } from '../services/api.ts';
import { closeSidePanels } from './ui.ts';
import { updateUI } from '../app-renderer.ts';

export async function handleDeleteClient(clientId: string) {
    if (!confirm('Are you sure you want to delete this client and all associated data (projects, tasks, invoices)? This is irreversible.')) {
        return;
    }

    const clientIndex = state.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;

    const [removedClient] = state.clients.splice(clientIndex, 1);
    const projectsToDelete = state.projects.filter(p => p.clientId === clientId).map(p => p.id);
    state.projects = state.projects.filter(p => p.clientId !== clientId);
    state.tasks = state.tasks.filter(t => !projectsToDelete.includes(t.projectId));
    state.invoices = state.invoices.filter(i => i.clientId !== clientId);

    closeSidePanels(false);
    updateUI(['page']);

    try {
        await apiFetch(`/api?action=data&resource=clients`, {
            method: 'DELETE',
            body: JSON.stringify({ id: clientId }),
        });
    } catch (error) {
        console.error("Failed to delete client:", error);
        alert("Could not delete client from the server. Reverting changes.");
        state.clients.splice(clientIndex, 0, removedClient);
        updateUI(['page']);
    }
}
