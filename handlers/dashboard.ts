

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

    const newWidgetPayload = {
        userId: state.currentUser.id,
        workspaceId: state.activeWorkspaceId,
        type,
        x: 0,
        y: 0,
        w: 4, 
        h: 6,
        sortOrder: maxSortOrder + 1,
        config: {}
    };
    
    try {
        const [savedWidget] = await apiPost('dashboard_widgets', newWidgetPayload);
        state.dashboardWidgets.push(savedWidget);
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

    if (widget.type === 'recentProjects') { // Example for future config
        // const select = document.getElementById('widget-project-select') as HTMLSelectElement;
        // if (select) {
        //     newConfig.projectId = select.value;
        // }
    }
    
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
    const target = e.target as HTMLElement;
    if (!target.classList.contains('widget-card') || !state.ui.dashboard.isEditing) return;
    draggedWidgetId = target.dataset.widgetId!;
    target.classList.add('dragging');
    e.dataTransfer!.effectAllowed = 'move';
}

export function handleWidgetDragEnd(e: DragEvent) {
    const target = e.target as HTMLElement;
    if (target.classList) {
        target.classList.remove('dragging');
    }
    document.querySelectorAll('.widget-card.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedWidgetId = null;
}

export function handleWidgetDragOver(e: DragEvent) {
    e.preventDefault();
    if (!state.ui.dashboard.isEditing) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('.widget-card');
    if (target && target.dataset.widgetId !== draggedWidgetId) {
        document.querySelectorAll('.widget-card.drag-over').forEach(el => el.classList.remove('drag-over'));
        target.classList.add('drag-over');
    }
}

export async function handleWidgetDrop(e: DragEvent) {
    e.preventDefault();
    if (!state.ui.dashboard.isEditing) return;
    const dropTargetElement = (e.target as HTMLElement).closest<HTMLElement>('.widget-card');
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
                    sortOrder: index,
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

export async function handleGridColumnsChange(columns: number) {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!workspace) return;
    
    const originalColumns = workspace.dashboardGridColumns;
    workspace.dashboardGridColumns = columns;
    renderApp();

    try {
        await apiPut('workspaces', { id: workspace.id, dashboardGridColumns: columns });
    } catch (error) {
        console.error("Failed to save grid column preference:", error);
        workspace.dashboardGridColumns = originalColumns;
        renderApp();
        alert("Could not save your grid layout preference.");
    }
}

export async function handleWidgetResize(widgetId: string, direction: 'increase' | 'decrease') {
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!widget || !workspace) return;
    
    const gridCols = workspace.dashboardGridColumns || 12;
    const originalWidth = widget.w;
    
    let newWidth = widget.w + (direction === 'increase' ? 1 : -1);
    newWidth = Math.max(1, Math.min(newWidth, gridCols)); // Clamp between 1 and max columns

    if (newWidth === originalWidth) return;

    widget.w = newWidth;
    renderApp();

    try {
        await apiPut('dashboard_widgets', { id: widget.id, w: newWidth });
    } catch (error) {
        console.error("Failed to save widget width:", error);
        alert("Could not save widget size.");
        widget.w = originalWidth;
        renderApp();
    }
}