import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { TaskFilters, FilterView } from '../types.ts';
import { t } from '../i18n.ts';

export function applyFilterView(viewId: string) {
    const view = state.filterViews.find(v => v.id === viewId);
    if (view) {
        state.ui.tasks.filters = { ...view.filters };
        state.ui.tasks.activeFilterViewId = viewId;
        updateUI(['page']);
    }
}

export function resetFilters() {
    state.ui.tasks.filters = { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all', tagIds: [], isArchived: false };
    state.ui.tasks.activeFilterViewId = null;
    updateUI(['page']);
}

export async function saveCurrentFilterView() {
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
        state.filterViews.push(savedView);
        state.ui.tasks.activeFilterViewId = savedView.id;
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to save filter view:", error);
        alert("Could not save the filter view.");
    }
}

export async function updateActiveFilterView() {
    const viewId = state.ui.tasks.activeFilterViewId;
    if (!viewId) return;

    const viewInState = state.filterViews.find(v => v.id === viewId);
    if (!viewInState) return;
    
    const originalFilters = { ...viewInState.filters };
    viewInState.filters = { ...state.ui.tasks.filters };
    updateUI(['page']);

    try {
        await apiPut('filter_views', { id: viewId, filters: viewInState.filters });
    } catch (error) {
        console.error("Failed to update filter view:", error);
        alert("Could not update the filter view.");
        viewInState.filters = originalFilters;
        updateUI(['page']);
    }
}

export async function deleteActiveFilterView() {
    const viewId = state.ui.tasks.activeFilterViewId;
    if (!viewId) return;

    if (!confirm(t('Are you sure you want to delete this saved view?'))) return;

    const viewIndex = state.filterViews.findIndex(v => v.id === viewId);
    if (viewIndex === -1) return;

    const [removedView] = state.filterViews.splice(viewIndex, 1);
    resetFilters();

    try {
        await apiFetch('/api?action=data&resource=filter_views', {
            method: 'DELETE',
            body: JSON.stringify({ id: viewId }),
        });
    } catch (error) {
        console.error("Failed to delete filter view:", error);
        alert("Could not delete the filter view.");
        state.filterViews.splice(viewIndex, 0, removedView);
        applyFilterView(viewId);
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
        (state.ui.tasks.filters as any)[key] = value;
        state.ui.tasks.activeFilterViewId = null;
        updateUI(['page']);
    }
}
