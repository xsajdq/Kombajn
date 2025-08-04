import { getState, setState } from '../state.ts';
import { apiFetch } from '../services/api.ts';
import type { Client, ClientContact, Tag } from '../types.ts';

export async function fetchClientsForWorkspace(workspaceId: string) {
    console.log(`Fetching client data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&clientsOnly=true`);
        if (!data) throw new Error("Client data fetch returned null.");

        setState(prevState => ({
            clients: data.clients || [],
            clientContacts: data.clients.flatMap((c: any) => c.clientContacts || []),
            clientTags: data.clientTags || [],
            tags: data.tags ? [...prevState.tags.filter(t => !data.tags.some((dt: Tag) => dt.id === t.id)), ...data.tags] : prevState.tags,
            ui: {
                ...prevState.ui,
                clients: { ...prevState.ui.clients, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched client data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch client data:", error);
        setState(prevState => ({
            ui: { ...prevState.ui, clients: { ...prevState.ui.clients, isLoading: false, loadedWorkspaceId: null } }
        }), ['page']);
    }
}