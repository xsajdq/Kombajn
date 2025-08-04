import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { TaskFilters, FilterView } from '../types.ts';
import { t } from '../i18n.ts';

export function applyFilterView(viewId: string) {
    const state = getState();
    const view = state.filterViews.find(v => v.id === viewId);
    if (view) {
        setState(prevState => ({
            ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, filters: { ...view.filters }, activeFilterViewId: viewId } }
        }), ['page']);
    }
}

export function resetFilters() {
    setState(prevState => ({
        ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, filters: { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all', tagIds: [], isArchived: false }, activeFilterViewId: null } }
    }), ['page']);
}

export async function saveCurrentFilterView() {
    const state = getState();
    const name = prompt("Enter a name for this filter view:");
    if (!name || !state.activeWorkspaceId || !state.currentUser) return;

    const newView: Omit<FilterView, 'id'> = {
        name,
        workspaceId: state.activeWorkspaceId,
        userId: state.currentUser.id,
        filters: { ...state.ui.tasks.filters },
    };

    try {
        const [savedView] = await apiPost('filter_views', newView);
        setState(prevState => ({
            filterViews: [...prevState.filterViews, savedView],
            ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, activeFilterViewId: savedView.id } }
        }), ['page']);
    } catch (error) {
        console.error("Failed to save filter view:", error);
        alert("Could not save the filter view.");
    }
}

export async function updateActiveFilterView() {
    const state = getState();
    const viewId = state.ui.tasks.activeFilterViewId;
    if (!viewId) return;

    const viewInState = state.filterViews.find(v => v.id === viewId);
    if (!viewInState) return;
    
    const originalFilters = { ...viewInState.filters };
    
    setState(prevState => ({
        filterViews: prevState.filterViews.map(v => v.id === viewId ? { ...v, filters: { ...prevState.ui.tasks.filters } } : v)
    }), ['page']);

    try {
        await apiPut('filter_views', { id: viewId, filters: state.ui.tasks.filters });
    } catch (error) {
        console.error("Failed to update filter view:", error);
        alert("Could not update the filter view.");
        setState(prevState => ({
            filterViews: prevState.filterViews.map(v => v.id === viewId ? { ...v, filters: originalFilters } : v)
        }), ['page']);
    }
}

export async function deleteActiveFilterView() {
    const state = getState();
    const viewId = state.ui.tasks.activeFilterViewId;
    if (!viewId) return;

    if (!confirm(t('Are you sure you want to delete this saved view?'))) return;

    const viewIndex = state.filterViews.findIndex(v => v.id === viewId);
    if (viewIndex === -1) return;

    const originalViews = [...state.filterViews];
    
    setState(prevState => ({
        filterViews: prevState.filterViews.filter(v => v.id !== viewId),
        ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, filters: { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all', tagIds: [], isArchived: false }, activeFilterViewId: null } }
    }), ['page']);


    try {
        await apiFetch('/api?action=data&resource=filter_views', {
            method: 'DELETE',
            body: JSON.stringify({ id: viewId }),
        });
    } catch (error) {
        console.error("Failed to delete filter view:", error);
        alert("Could not delete the filter view.");
        setState({ filterViews: originalViews, ui: { ...state.ui, tasks: { ...state.ui.tasks, activeFilterViewId: viewId } } }, ['page']);
    }
}


export function handleFilterChange(element: HTMLInputElement | HTMLSelectElement) {
    const key = element.dataset.filterKey as keyof TaskFilters;
    let value: string | boolean;

    if (element.type === 'checkbox') {
        value = (element as HTMLInputElement).checked;
    } else {
        value = element.value;
    }

    if (key) {
        setState(prevState => ({
            ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, filters: { ...prevState.ui.tasks.filters, [key]: value }, activeFilterViewId: null } }
        }), ['page']);
    }
}