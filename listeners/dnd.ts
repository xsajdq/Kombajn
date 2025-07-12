
import * as dndHandlers from '../handlers/dnd.ts';
import * as dashboardHandlers from '../handlers/dashboard.ts';

// Combine D&D handlers into one file
export function handleDragStart(e: DragEvent) {
    dndHandlers.handleDragStart(e);
    dashboardHandlers.handleWidgetDragStart(e);
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
