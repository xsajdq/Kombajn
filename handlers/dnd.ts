
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task, Deal } from '../types.ts';
import { createNotification } from './notifications.ts';
import { runAutomations } from './automations.ts';
import { apiPut } from '../services/api.ts';

let draggedItemId: string | null = null;
let draggedItemType: 'task' | 'deal' | null = null;

export function handleDragStart(e: DragEvent) {
    const target = e.target as HTMLElement;
    const taskCard = target.closest<HTMLElement>('.task-card');
    const dealCard = target.closest<HTMLElement>('.deal-card');

    let itemCard: HTMLElement | null = null;
    let id: string | undefined;

    if (taskCard) {
        itemCard = taskCard;
        draggedItemType = 'task';
        id = itemCard.dataset.taskId;
    } else if (dealCard) {
        itemCard = dealCard;
        draggedItemType = 'deal';
        id = itemCard.dataset.dealId;
    }

    if (itemCard && id && e.dataTransfer) {
        draggedItemId = id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedItemId);
        setTimeout(() => itemCard!.classList.add('dragging'), 0);
    }
}

export function handleDragEnd(e: DragEvent) {
    const itemCard = (e.target as HTMLElement).closest('.task-card, .deal-card');
    if (itemCard) {
        itemCard.classList.remove('dragging');
    }
    draggedItemId = null;
    draggedItemType = null;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

export function handleDragOver(e: DragEvent) {
    e.preventDefault();
    const column = (e.target as HTMLElement).closest<HTMLElement>('.kanban-column');
    if (column) {
        // Only allow dropping tasks on status columns and deals on stage columns
        const isTaskColumn = !!column.dataset.status;
        const isDealColumn = !!column.dataset.stage;

        if ((draggedItemType === 'task' && isTaskColumn) || (draggedItemType === 'deal' && isDealColumn)) {
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            column.classList.add('drag-over');
        } else {
             document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        }
    }
}

export async function handleDrop(e: DragEvent) {
    e.preventDefault();
    const column = (e.target as HTMLElement).closest<HTMLElement>('.kanban-column');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    if (!column || !draggedItemId || !draggedItemType || !state.currentUser) {
        return;
    }

    if (draggedItemType === 'task') {
        const newStatus = column.dataset.status as Task['status'];
        const task = state.tasks.find(t => t.id === draggedItemId);
        
        if (task && newStatus && task.status !== newStatus) {
            const oldStatus = task.status;
            task.status = newStatus; // Optimistic update
            renderApp(); // Re-render immediately for snappy UX

            try {
                // Persist the change to the backend
                await apiPut('tasks', { id: task.id, status: newStatus });
                
                const assignees = state.taskAssignees.filter(a => a.taskId === task.id);
                if ((newStatus === 'inreview' || newStatus === 'done') && assignees.length > 0) {
                    for (const assignee of assignees) {
                        if (assignee.userId !== state.currentUser.id) {
                            createNotification('status_change', { taskId: draggedItemId, userIdToNotify: assignee.userId, newStatus, actorId: state.currentUser.id });
                        }
                    }
                }
                
                runAutomations('statusChange', { task });

            } catch (error) {
                console.error("Failed to update task status:", error);
                alert("Failed to update task status. Reverting change.");
                task.status = oldStatus;
                renderApp();
            }
        }
    } else if (draggedItemType === 'deal') {
        const newStage = column.dataset.stage as Deal['stage'];
        const deal = state.deals.find(d => d.id === draggedItemId);

        if (deal && newStage && deal.stage !== newStage) {
            const oldStage = deal.stage;
            deal.stage = newStage; // Optimistic update
            renderApp(); // Re-render immediately

            try {
                await apiPut('deals', { id: deal.id, stage: newStage });
            } catch (error) {
                console.error("Failed to update deal stage:", error);
                alert("Failed to update deal stage. Reverting change.");
                deal.stage = oldStage;
                renderApp();
            }
        }
    }
}
