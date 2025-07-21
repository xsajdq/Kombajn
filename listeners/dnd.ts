

import * as dndHandlers from '../handlers/dnd.ts';
import * as dashboardHandlers from '../handlers/dashboard.ts';

// Combine D&D handlers into one file
export function handleDragStart(e: DragEvent) {
    const taskCard = (e.target as HTMLElement).closest('.task-card');
    const dealCard = (e.target as HTMLElement).closest('.deal-card');
    const widget = (e.target as HTMLElement).closest('.widget-container');

    if (taskCard || dealCard) {
        dndHandlers.handleDragStart(e);
    } else if (widget) {
        dashboardHandlers.handleWidgetDragStart(e);
    }
}
export function handleDragEnd(e: DragEvent) {
    dndHandlers.handleDragEnd(e);
    dashboardHandlers.handleWidgetDragEnd(e);
}
export function handleDragOver(e: DragEvent) {
    dndHandlers.handleDragOver(e);
    dashboardHandlers.handleWidgetDragOver(e);
}
export function handleDrop(e: DragEvent) {
    dndHandlers.handleDrop(e);
    dashboardHandlers.handleWidgetDrop(e);
}