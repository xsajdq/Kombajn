// handlers/budget.ts

import { getState, setState } from '../state.ts';
import { apiFetch } from '../services/api.ts';

export async function fetchBudgetDataForWorkspace(workspaceId: string) {
    console.log(`Fetching budget data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&budgetOnly=true`);
        if (!data) throw new Error("Budget data fetch returned null.");

        setState(prevState => ({
            budgets: [...prevState.budgets.filter(i => i.workspaceId !== workspaceId), ...(data.budgets || [])],
            expenses: [...prevState.expenses.filter(i => i.workspaceId !== workspaceId), ...(data.expenses || [])],
            ui: {
                ...prevState.ui,
                budget: { ...prevState.ui.budget, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched budget data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch budget data:", error);
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                budget: { ...prevState.ui.budget, isLoading: false, loadedWorkspaceId: null }
            }
        }), ['page']);
    }
}