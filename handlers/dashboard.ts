


import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { DashboardWidget, DashboardWidgetType } from '../types.ts';
import { apiPost, apiPut } from '../services/api.ts';

export function toggleEditMode() {
    state.ui.dashboard.isEditing = !state.ui.dashboard.isEditing;
    renderApp();
}

export async function addWidget(type: DashboardWidgetType) {
    if (!state.currentUser || !state.activeWorkspaceId) return;

    const newWidgetPayload = {
        userId: state.currentUser.id,
        workspaceId: state.activeWorkspaceId,
        type,
        x: 0, y: 0, w: 6, h: 4, // Default size
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
        await apiPost('dashboard_widgets/delete', { id: widgetId });
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
    const dropTarget = (e.target as HTMLElement).closest<HTMLElement>('.widget-card');
    if (!dropTarget || !draggedWidgetId) return;

    const dropTargetId = dropTarget.dataset.widgetId!;
    dropTarget.classList.remove('drag-over');

    const draggedIndex = state.dashboardWidgets.findIndex(w => w.id === draggedWidgetId);
    const targetIndex = state.dashboardWidgets.findIndex(w => w.id === dropTargetId);

    if (draggedIndex > -1 && targetIndex > -1 && draggedIndex !== targetIndex) {
        const originalOrder = [...state.dashboardWidgets];
        const [draggedItem] = state.dashboardWidgets.splice(draggedIndex, 1);
        state.dashboardWidgets.splice(targetIndex, 0, draggedItem);
        renderApp();
        
        try {
            // This is a simplification. A real implementation would update an 'order' field.
            // For now, we assume the D&D is for visual purposes and don't persist order changes.
            // To persist, you would need to add an `order` property to widgets and update them all.
        } catch(error) {
            state.dashboardWidgets = originalOrder;
            renderApp();
            alert("Could not reorder widgets.");
        }
    }
}