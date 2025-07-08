import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { DashboardWidget, DashboardWidgetType } from '../types.ts';

export function toggleEditMode() {
    state.ui.dashboard.isEditing = !state.ui.dashboard.isEditing;
    renderApp();
}

export function addWidget(type: DashboardWidgetType) {
    const newWidget: DashboardWidget = {
        id: generateId(),
        type,
        x: 0, y: 0, w: 6, h: 4, // Default size
        config: {}
    };
    state.dashboardWidgets.push(newWidget);
    closeModal(); // This saves and renders
}

export function removeWidget(widgetId: string) {
    state.dashboardWidgets = state.dashboardWidgets.filter(w => w.id !== widgetId);
    saveState();
    renderApp();
}

export function showConfigureWidgetModal(widgetId: string) {
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (widget) {
        showModal('configureWidget', { widget });
    }
}

export function handleWidgetConfigSave(widgetId: string) {
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    if (widget.type === 'projectStatus') {
        const select = document.getElementById('widget-project-select') as HTMLSelectElement;
        if (select) {
            widget.config.projectId = select.value;
        }
    }
    // Add other widget config savings here
    closeModal();
}

// DND Handlers
let draggedWidgetId: string | null = null;

export function handleWidgetDragStart(e: DragEvent) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('widget-card')) return;
    draggedWidgetId = target.dataset.widgetId!;
    target.classList.add('dragging');
    e.dataTransfer!.effectAllowed = 'move';
}

export function handleWidgetDragEnd(e: DragEvent) {
    (e.target as HTMLElement).classList.remove('dragging');
    document.querySelectorAll('.widget-card.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedWidgetId = null;
}

export function handleWidgetDragOver(e: DragEvent) {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest<HTMLElement>('.widget-card');
    if (target && target.dataset.widgetId !== draggedWidgetId) {
        document.querySelectorAll('.widget-card.drag-over').forEach(el => el.classList.remove('drag-over'));
        target.classList.add('drag-over');
    }
}

export function handleWidgetDrop(e: DragEvent) {
    e.preventDefault();
    const dropTarget = (e.target as HTMLElement).closest<HTMLElement>('.widget-card');
    if (!dropTarget || !draggedWidgetId) return;

    const dropTargetId = dropTarget.dataset.widgetId!;
    dropTarget.classList.remove('drag-over');

    const draggedIndex = state.dashboardWidgets.findIndex(w => w.id === draggedWidgetId);
    const targetIndex = state.dashboardWidgets.findIndex(w => w.id === dropTargetId);

    if (draggedIndex > -1 && targetIndex > -1 && draggedIndex !== targetIndex) {
        const [draggedItem] = state.dashboardWidgets.splice(draggedIndex, 1);
        state.dashboardWidgets.splice(targetIndex, 0, draggedItem);
        saveState();
        renderApp();
    }
}
