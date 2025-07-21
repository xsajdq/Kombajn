

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { DashboardWidget, DashboardWidgetType } from '../types.ts';
import { apiFetch, apiPost, apiPut } from '../services/api.ts';

export function toggleEditMode() {
    state.ui.dashboard.isEditing = !state.ui.dashboard.isEditing;
    renderApp();
}

export async function addWidget(type: DashboardWidgetType) {
    if (!state.currentUser || !state.activeWorkspaceId) return;

    const userWidgets = state.dashboardWidgets.filter(w => 
        w.userId === state.currentUser?.id && w.workspaceId === state.activeWorkspaceId
    );
    
    const maxSortOrder = userWidgets.reduce((max, w) => Math.max(max, w.sortOrder || 0), 0);

    const newWidgetPayload: Omit<DashboardWidget, 'id' | 'config'> & { config: any } = {
        userId: state.currentUser.id,
        workspaceId: state.activeWorkspaceId,
        type,
        x: 0, // x, y, w, h are not used in the new layout, but kept for schema compatibility
        y: 0,
        w: 4, 
        h: 6,
        sortOrder: maxSortOrder + 1,
        config: {}
    };
    
    try {
        const [savedWidget] = await apiPost('dashboard_widgets', newWidgetPayload);
        state.dashboardWidgets.push(savedWidget);
        state.dashboardWidgets.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        closeModal();
    } catch (error) {
        console.error("Failed to add widget:", error);
        alert("Could not add widget.");
    }
}

export async function removeWidget(widgetId: string) {
    const widgetIndex = state.dashboardWidgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return;

    const [removedWidget] = state.dashboardWidgets.splice(widgetIndex, 1);
    renderApp();
    try {
        await apiFetch(`/api/data/dashboard_widgets`, {
            method: 'DELETE',
            body: JSON.stringify({ id: widgetId }),
        });
    } catch (error) {
        state.dashboardWidgets.splice(widgetIndex, 0, removedWidget);
        renderApp();
        alert("Could not remove widget.");
    }
}

export function showConfigureWidgetModal(widgetId: string) {
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (widget) {
        showModal('configureWidget', { widget });
    }
}

export async function handleWidgetConfigSave(widgetId: string) {
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    const originalConfig = { ...widget.config };
    let newConfig = { ...originalConfig };
    
    widget.config = newConfig;

    try {
        await apiPut('dashboard_widgets', { id: widgetId, config: newConfig });
        closeModal();
    } catch(error) {
        widget.config = originalConfig; // Revert
        alert("Failed to save widget configuration.");
        renderApp();
    }
}

// DND Handlers
let draggedWidgetId: string | null = null;

export function handleWidgetDragStart(e: DragEvent) {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.widget-container');
    if (!target || !state.ui.dashboard.isEditing) return;
    draggedWidgetId = target.dataset.widgetId!;
    setTimeout(() => target.classList.add('dragging'), 0);
    e.dataTransfer!.effectAllowed = 'move';
}

export function handleWidgetDragEnd(e: DragEvent) {
    document.querySelectorAll('.widget-container.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.widget-container.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedWidgetId = null;
}

export function handleWidgetDragOver(e: DragEvent) {
    e.preventDefault();
    if (!state.ui.dashboard.isEditing || !draggedWidgetId) return;
    const dropTargetElement = (e.target as HTMLElement).closest<HTMLElement>('.widget-container');
    if (dropTargetElement && dropTargetElement.dataset.widgetId !== draggedWidgetId) {
        document.querySelectorAll('.widget-container.drag-over').forEach(el => el.classList.remove('drag-over'));
        dropTargetElement.classList.add('drag-over');
    }
}

export async function handleWidgetDrop(e: DragEvent) {
    e.preventDefault();
    if (!state.ui.dashboard.isEditing) return;
    const dropTargetElement = (e.target as HTMLElement).closest<HTMLElement>('.widget-container');
    if (!dropTargetElement || !draggedWidgetId) return;

    const dropTargetId = dropTargetElement.dataset.widgetId!;
    dropTargetElement.classList.remove('drag-over');

    const userWidgets = state.dashboardWidgets.filter(w => w.userId === state.currentUser?.id && w.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    const draggedIndex = userWidgets.findIndex(w => w.id === draggedWidgetId);
    const targetIndex = userWidgets.findIndex(w => w.id === dropTargetId);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
        return;
    }

    const originalWidgets = JSON.parse(JSON.stringify(state.dashboardWidgets));
    
    const [draggedItem] = userWidgets.splice(draggedIndex, 1);
    userWidgets.splice(targetIndex, 0, draggedItem);
    
    userWidgets.forEach((widget, index) => {
        const globalWidget = state.dashboardWidgets.find(w => w.id === widget.id);
        if (globalWidget) {
            globalWidget.sortOrder = index;
        }
    });

    renderApp();

    try {
        await Promise.all(
            userWidgets.map((widget, index) =>
                apiPut('dashboard_widgets', {
                    id: widget.id,
                    sort_order: index, // Send snake_case to the API handler
                })
            )
        );
    } catch (error) {
        console.error("Could not save widget order:", error);
        alert("Could not save the new widget layout.");
        state.dashboardWidgets = originalWidgets;
        renderApp();
    }
}

export async function handleGridColumnsChange(newCount: number) {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!workspace) return;

    const originalCount = workspace.dashboardGridColumns;
    workspace.dashboardGridColumns = newCount;
    renderApp();

    try {
        await apiPut('workspaces', { id: workspace.id, dashboardGridColumns: newCount });
    } catch (error) {
        console.error("Failed to save grid column settings:", error);
        workspace.dashboardGridColumns = originalCount;
        renderApp();
    }
}

export async function handleWidgetResize(widgetId: string, action: 'increase' | 'decrease') {
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    const originalWidth = widget.w;
    const newWidth = action === 'increase' ? widget.w + 1 : widget.w - 1;
    
    // Some basic constraints
    if (newWidth < 1 || newWidth > 12) { // Assuming a 12-column grid
        return;
    }

    widget.w = newWidth;
    renderApp(); // Optimistic update

    try {
        await apiPut('dashboard_widgets', { id: widgetId, w: newWidth });
    } catch (error) {
        console.error("Failed to update widget width:", error);
        widget.w = originalWidth; // Revert on failure
        renderApp();
        alert("Could not resize widget.");
    }
}