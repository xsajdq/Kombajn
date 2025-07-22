import * as dndHandlers from '../handlers/dnd.ts';

// Combine D&D handlers into one file
export function handleDragStart(e: DragEvent) {
    dndHandlers.handleDragStart(e);
}
export function handleDragEnd(e: DragEvent) {
    dndHandlers.handleDragEnd(e);
}
export function handleDragOver(e: DragEvent) {
    dndHandlers.handleDragOver(e);
}
export function handleDrop(e: DragEvent) {
    dndHandlers.handleDrop(e);
}