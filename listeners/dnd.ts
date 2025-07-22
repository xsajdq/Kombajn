
import * as dndHandlers from '../handlers/dnd.ts';
import * as dashboardHandlers from '../handlers/dashboard.ts';
import { state } from '../state.ts';

// Combine D&D handlers into one file
export function handleDragStart(e: DragEvent) {
    const taskCard = (e.target as HTMLElement).closest('.task-card');
    const dealCard = (e.target as HTMLElement).closest('.deal-card');
    const widget = (e.target as HTMLElement).closest('[data-widget-id]');

    if (taskCard || dealCard) {
        dndHandlers.handleDragStart(e);
    } else if (widget && state.ui.dashboard.isEditing) {
        dashboardHandlers.handleWidgetDragStart(e);
    }
}
export function handleDragEnd(e: DragEvent) {
    dndHandlers.handleDragEnd(e);
    dashboardHandlers.handleWidgetDragEnd(e);
}
export function handleDragOver(e: DragEvent) {
    const isDashboardEditing = state.ui.dashboard.isEditing;
    const isWidget = !!(e.target as HTMLElement).closest('[data-widget-id]');

    if (isDashboardEditing && isWidget) {
        dashboardHandlers.handleWidgetDragOver(e);
    } else {
        dndHandlers.handleDragOver(e);
    }
}
export function handleDrop(e: DragEvent) {
    const isDashboardEditing = state.ui.dashboard.isEditing;
    const isWidget = !!(e.target as HTMLElement).closest('[data-widget-id]');

    if (isDashboardEditing && isWidget) {
        dashboardHandlers.handleWidgetDrop(e);
    } else {
        dndHandlers.handleDrop(e);
    }
}
