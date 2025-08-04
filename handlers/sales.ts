// handlers/sales.ts
import { getState, setState } from '../state.ts';
import { apiFetch } from '../services/api.ts';

export async function fetchSalesDataForWorkspace(workspaceId: string) {
    console.log(`Fetching sales data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&salesOnly=true`);
        if (!data) throw new Error("Sales data fetch returned null.");

        setState(prevState => ({
            deals: data.deals || [],
            dealActivities: data.dealActivities || [],
            pipelineStages: data.pipelineStages || [],
            ui: {
                ...prevState.ui,
                sales: { ...prevState.ui.sales, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched sales data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch sales data:", error);
        setState(prevState => ({
            ui: { ...prevState.ui, sales: { ...prevState.ui.sales, isLoading: false, loadedWorkspaceId: null } }
        }), ['page']);
    }
}