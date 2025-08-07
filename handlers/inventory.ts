// handlers/inventory.ts
import { getState, setState } from '../state.ts';
import { apiFetch } from '../services/api.ts';

export async function fetchInventoryDataForWorkspace(workspaceId: string) {
    console.log(`Fetching inventory data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&inventoryOnly=true`);
        if (!data) throw new Error("Inventory data fetch returned null.");

        setState(prevState => ({
            inventoryItems: data.inventoryItems || [],
            inventoryAssignments: data.inventoryAssignments || [],
            ui: {
                ...prevState.ui,
                inventory: { ...prevState.ui.inventory, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched inventory data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch inventory data:", error);
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                inventory: { ...prevState.ui.inventory, isLoading: false, loadedWorkspaceId: null }
            }
        }), ['page']);
    }
}
