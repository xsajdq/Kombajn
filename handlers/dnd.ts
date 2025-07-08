
import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task, Deal } from '../types.ts';
import { createNotification } from './notifications.ts';
import { runAutomations } from './automations.ts';

let draggedTaskId: string | null = null;

export function handleDragStart(e: DragEvent) {
    const itemCard = (e.target as HTMLElement).closest<HTMLElement>('.task-card');
    if (itemCard && e.dataTransfer) {
        // Use a generic attribute for any draggable item ID
        draggedTaskId = itemCard.dataset.taskId!;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);
        setTimeout(() => itemCard.classList.add('dragging'), 0);
    }
}

export function handleDragEnd(e: DragEvent) {
    const itemCard = (e.target as HTMLElement).closest('.task-card');
    if (itemCard) {
        itemCard.classList.remove('dragging');
    }
    draggedTaskId = null;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

export function handleDragOver(e: DragEvent) {
    e.preventDefault();
    const column = (e.target as HTMLElement).closest('.kanban-column');
    if (column) {
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        column.classList.add('drag-over');
    }
}

export function handleDrop(e: DragEvent) {
    e.preventDefault();
    const column = (e.target as HTMLElement).closest<HTMLElement>('.kanban-column');
    if (!column || !draggedTaskId || !state.currentUser) {
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        return;
    }

    const newStatus = column.dataset.status as Task['status'];
    const newStage = column.dataset.stage as Deal['stage'];

    const task = state.tasks.find(t => t.id === draggedTaskId);
    const deal = state.deals.find(d => d.id === draggedTaskId);

    if (task && newStatus && task.status !== newStatus) {
        task.status = newStatus;
        
        if ((newStatus === 'inreview' || newStatus === 'done') && task.assigneeId && task.assigneeId !== state.currentUser.id) {
            createNotification('status_change', { taskId: draggedTaskId, userIdToNotify: task.assigneeId, newStatus, actorId: state.currentUser.id });
        }

        saveState(); // Save before running automations
        runAutomations('statusChange', { task });
        renderApp(); // Re-render after state changes
    } else if (deal && newStage && deal.stage !== newStage) {
        deal.stage = newStage;
        saveState();
        renderApp();
    }
    
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}