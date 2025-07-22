import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task, Deal, DashboardWidget } from '../types.ts';
import { createNotification } from './notifications.ts';
import { runAutomations } from './automations.ts';
import { apiPut } from '../services/api.ts';

let draggedItemId: string | null = null;
let draggedItemType: 'task' | 'deal' | 'widget' | null = null;

export function handleDragStart(e: DragEvent) {
    const target = e.target as HTMLElement;
    const taskCard = target.closest<HTMLElement>('.task-card');
    const dealCard = target.closest<HTMLElement>('.deal-card');
    const widget = target.closest<HTMLElement>('[data-widget-id]');

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
    } else if (widget && state.ui.dashboard.isEditing) {
        itemCard = widget;
        draggedItemType = 'widget';
        id = itemCard.dataset.widgetId;
    }

    if (itemCard && id && e.dataTransfer) {
        draggedItemId = id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedItemId);
        setTimeout(() => itemCard!.classList.add('dragging'), 0);
    }
}

export function handleDragEnd(e: DragEvent) {
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedItemId = null;
    draggedItemType = null;
    document.querySelectorAll('[data-status], [data-stage]').forEach(el => el.classList.remove('bg-primary/10'));
}

export function handleDragOver(e: DragEvent) {
    e.preventDefault();
    
    if (draggedItemType === 'widget') {
        const dropTargetElement = (e.target as HTMLElement).closest<HTMLElement>('[data-widget-id]');
        document.querySelectorAll('[data-widget-id].drag-over').forEach(el => el.classList.remove('drag-over'));
        if (dropTargetElement && dropTargetElement.dataset.widgetId !== draggedItemId) {
            dropTargetElement.classList.add('drag-over');
        }
        return;
    }

    const column = (e.target as HTMLElement).closest<HTMLElement>('[data-status], [data-stage]');
    if (column) {
        const isTaskColumn = !!column.dataset.status;
        const isDealColumn = !!column.dataset.stage;

        if ((draggedItemType === 'task' && isTaskColumn) || (draggedItemType === 'deal' && isDealColumn)) {
             document.querySelectorAll('[data-status], [data-stage]').forEach(el => el.classList.remove('bg-primary/10'));
            column.classList.add('bg-primary/10');
        }
    }
}

export async function handleDrop(e: DragEvent) {
    e.preventDefault();
    
    if (!draggedItemId || !draggedItemType || !state.currentUser) {
        return;
    }

    // Handle Task/Deal Drop
    const column = (e.target as HTMLElement).closest<HTMLElement>('[data-status], [data-stage]');
    if (column) {
        document.querySelectorAll('[data-status], [data-stage]').forEach(el => el.classList.remove('bg-primary/10'));
        if (draggedItemType === 'task') {
            const newStatus = column.dataset.status as Task['status'];
            const task = state.tasks.find(t => t.id === draggedItemId);
            
            if (task && newStatus && task.status !== newStatus) {
                const oldStatus = task.status;
                task.status = newStatus; // Optimistic update
                renderApp(); // Re-render immediately for snappy UX

                try {
                    await apiPut('tasks', { id: task.id, status: newStatus });
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

    // Handle Widget Drop
    const dropTargetWidget = (e.target as HTMLElement).closest<HTMLElement>('[data-widget-id]');
    if (draggedItemType === 'widget' && dropTargetWidget) {
        document.querySelectorAll('[data-widget-id]').forEach(el => el.classList.remove('drag-over'));
        const dropTargetId = dropTargetWidget.dataset.widgetId!;
        if (draggedItemId === dropTargetId) return;

        const originalWidgets = JSON.parse(JSON.stringify(state.dashboardWidgets));
        
        const userWidgets = state.dashboardWidgets.filter(w => w.userId === state.currentUser.id && w.workspaceId === state.activeWorkspaceId)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        const draggedIndex = userWidgets.findIndex(w => w.id === draggedItemId);
        const targetIndex = userWidgets.findIndex(w => w.id === dropTargetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [draggedItem] = userWidgets.splice(draggedIndex, 1);
        userWidgets.splice(targetIndex, 0, draggedItem);
        
        // Update sortOrder on the global state objects
        userWidgets.forEach((widget, index) => {
            const globalWidget = state.dashboardWidgets.find(w => w.id === widget.id);
            if (globalWidget) globalWidget.sortOrder = index;
        });

        renderApp();

        try {
            const updatePromises = userWidgets.map((widget, index) =>
                apiPut('dashboard_widgets', { id: widget.id, sortOrder: index })
            );
            await Promise.all(updatePromises);
        } catch (error) {
            console.error("Could not save widget order:", error);
            alert("Could not save the new widget layout.");
            state.dashboardWidgets = originalWidgets; // Revert
            renderApp();
        }
    }
}