
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
    let nextY = 1;
    if (userWidgets.length > 0) {
        nextY = Math.max(...userWidgets.map(w => w.y + w.h));
    }

    const newWidgetPayload = {
        userId: state.currentUser.id,
        workspaceId: state.activeWorkspaceId,
        type,
        x: 1, 
        y: nextY, 
        w: 6, 
        h: 4, // Default size
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

    if (widget.type === 'projectStatus') {
        const select = document.getElementById('widget-project-select') as HTMLSelectElement;
        if (select) {
            newConfig.projectId = select.value;
        }
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
    if (target.classList) { // Check if target exists
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

    const draggedWidget = state.dashboardWidgets.find(w => w.id === draggedWidgetId);
    const targetWidget = state.dashboardWidgets.find(w => w.id === dropTargetId);

    if (!draggedWidget || !targetWidget || draggedWidget.id === targetWidget.id) {
        return;
    }

    // Store original positions for potential revert
    const originalDraggedPos = { x: draggedWidget.x, y: draggedWidget.y, w: draggedWidget.w, h: draggedWidget.h };
    const originalTargetPos = { x: targetWidget.x, y: targetWidget.y, w: targetWidget.w, h: targetWidget.h };

    // Optimistic swap of grid properties
    draggedWidget.x = originalTargetPos.x;
    draggedWidget.y = originalTargetPos.y;
    draggedWidget.w = originalTargetPos.w;
    draggedWidget.h = originalTargetPos.h;

    targetWidget.x = originalDraggedPos.x;
    targetWidget.y = originalDraggedPos.y;
    targetWidget.w = originalDraggedPos.w;
    targetWidget.h = originalDraggedPos.h;

    renderApp();

    try {
        // Persist changes for both widgets to the backend
        await Promise.all([
            apiPut('dashboard_widgets', {
                id: draggedWidget.id,
                x: draggedWidget.x,
                y: draggedWidget.y,
                w: draggedWidget.w,
                h: draggedWidget.h
            }),
            apiPut('dashboard_widgets', {
                id: targetWidget.id,
                x: targetWidget.x,
                y: targetWidget.y,
                w: targetWidget.w,
                h: targetWidget.h
            })
        ]);
    } catch (error) {
        console.error("Could not save widget positions:", error);
        alert("Could not save the new widget layout.");

        // Revert on failure
        draggedWidget.x = originalDraggedPos.x;
        draggedWidget.y = originalDraggedPos.y;
        draggedWidget.w = originalDraggedPos.w;
        draggedWidget.h = originalDraggedPos.h;

        targetWidget.x = originalTargetPos.x;
        targetWidget.y = originalTargetPos.y;
        targetWidget.w = originalTargetPos.w;
        targetWidget.h = originalTargetPos.h;
        
        renderApp();
    }
}

export async function handleGridColumnsChange(columns: number) {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!workspace) return;
    
    workspace.dashboardGridColumns = columns;
    renderApp();

    try {
        await apiPut('workspaces', { id: workspace.id, dashboardGridColumns: columns });
    } catch (error) {
        console.error("Failed to save grid column preference:", error);
        alert("Could not save your grid layout preference.");
    }
}
