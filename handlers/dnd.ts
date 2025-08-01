



import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Task, Deal, DashboardWidget, UserTaskSortOrder, PipelineStage } from '../types.ts';
import { createNotification } from './notifications.ts';
import { runAutomations } from './automations.ts';
import { apiPut, apiPost } from '../services/api.ts';
import { showModal } from './ui.ts';
import { handleReorderStages } from './pipeline.ts';
import { handleReorderKanbanStages } from './kanban.ts';

let draggedItemId: string | null = null;
let draggedItemType: 'task' | 'deal' | 'widget' | 'pipeline-stage' | 'kanban-stage' | null = null;

export function handleDragStart(e: DragEvent) {
    const target = e.target as HTMLElement;
    const taskCard = target.closest<HTMLElement>('.task-card');
    const dealCard = target.closest<HTMLElement>('.deal-card');
    const widget = target.closest<HTMLElement>('[data-widget-id]');
    const stageRow = target.closest<HTMLElement>('.pipeline-stage-row');
    const kanbanStageRow = target.closest<HTMLElement>('.kanban-stage-row');

    let itemCard: HTMLElement | null = null;
    let id: string | undefined;

    if (taskCard) {
        if (state.ui.tasks.sortBy !== 'manual') {
            e.preventDefault();
            return;
        }
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
    } else if (stageRow) {
        itemCard = stageRow;
        draggedItemType = 'pipeline-stage';
        id = itemCard.dataset.stageId;
    } else if (kanbanStageRow) {
        itemCard = kanbanStageRow;
        draggedItemType = 'kanban-stage';
        id = itemCard.dataset.stageId;
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
    document.querySelectorAll('[data-status], [data-stage-id]').forEach(el => el.classList.remove('bg-primary/10'));
}

export function handleDragOver(e: DragEvent) {
    e.preventDefault();
    
    if (draggedItemType === 'widget' || draggedItemType === 'pipeline-stage' || draggedItemType === 'kanban-stage') {
        let dropTargetSelector = '';
        if (draggedItemType === 'widget') dropTargetSelector = '[data-widget-id]';
        if (draggedItemType === 'pipeline-stage') dropTargetSelector = '.pipeline-stage-row';
        if (draggedItemType === 'kanban-stage') dropTargetSelector = '.kanban-stage-row';

        const dropTargetElement = (e.target as HTMLElement).closest(dropTargetSelector);
        document.querySelectorAll(`${dropTargetSelector}.drag-over`).forEach(el => el.classList.remove('drag-over'));
        
        const dropTargetId = (dropTargetElement as HTMLElement)?.dataset.widgetId || (dropTargetElement as HTMLElement)?.dataset.stageId;
        if (dropTargetElement && dropTargetId !== draggedItemId) {
            dropTargetElement.classList.add('drag-over');
        }
        return;
    }

    const column = (e.target as HTMLElement).closest<HTMLElement>('[data-status], [data-stage-id]');
    if (column) {
        const isTaskColumn = !!column.dataset.status;
        const isDealColumn = !!column.dataset.stageId;

        if ((draggedItemType === 'task' && isTaskColumn) || (draggedItemType === 'deal' && isDealColumn)) {
             document.querySelectorAll('[data-status], [data-stage-id]').forEach(el => el.classList.remove('bg-primary/10'));
            column.classList.add('bg-primary/10');
        }
    }
}

export async function handleDrop(e: DragEvent) {
    e.preventDefault();
    
    if (!draggedItemId || !draggedItemType || !state.currentUser) {
        return;
    }

    // Handle Task Drop
    const column = (e.target as HTMLElement).closest<HTMLElement>('[data-status]');
    if (column && draggedItemType === 'task') {
        if (state.ui.tasks.sortBy !== 'manual') return;

        const newStatus = column.dataset.status as Task['status'];
        const task = state.tasks.find(t => t.id === draggedItemId);
        if (!task || !newStatus) return;

        const originalTaskStatus = task.status;
        const sortOrderRecord = state.userTaskSortOrders.find(o => o.taskId === task.id && o.userId === state.currentUser!.id);
        const originalSortOrderState = sortOrderRecord ? { ...sortOrderRecord } : null;

        // --- Calculate new sortOrder ---
        const userSortOrders = state.userTaskSortOrders.filter(o => o.userId === state.currentUser!.id);
        const sortOrderMap = new Map(userSortOrders.map(o => [o.taskId, o.sortOrder]));

        const columnBody = column.querySelector('.tasks-board-column-body');
        const tasksInColumn = Array.from(columnBody?.children || [])
            .map(el => state.tasks.find(t => t.id === (el as HTMLElement).dataset.taskId))
            .filter((t): t is Task => !!t)
            .sort((a, b) => (sortOrderMap.get(a.id) || Infinity) - (sortOrderMap.get(b.id) || Infinity));

        const dropTargetElement = (e.target as HTMLElement).closest('.task-card');
        const dropIndex = dropTargetElement ? tasksInColumn.findIndex(t => t.id === (dropTargetElement as HTMLElement).dataset.taskId) : tasksInColumn.length;
        
        let newSortOrder: number;
        if (dropIndex === 0) {
            newSortOrder = (sortOrderMap.get(tasksInColumn[0]?.id) || 1) / 2;
        } else if (dropIndex === tasksInColumn.length) {
            newSortOrder = (sortOrderMap.get(tasksInColumn[tasksInColumn.length - 1]?.id) || 0) + 1;
        } else {
            const before = sortOrderMap.get(tasksInColumn[dropIndex - 1].id) || 0;
            const after = sortOrderMap.get(tasksInColumn[dropIndex].id) || 0;
            newSortOrder = (before + after) / 2;
        }

        // Optimistic update
        task.status = newStatus;
        if (sortOrderRecord) {
            sortOrderRecord.sortOrder = newSortOrder;
            sortOrderRecord.status = newStatus;
        } else {
            state.userTaskSortOrders.push({
                id: `temp-${Date.now()}`,
                userId: state.currentUser.id,
                taskId: task.id,
                workspaceId: task.workspaceId,
                status: newStatus,
                sortOrder: newSortOrder
            });
        }
        renderApp();

        try {
            await apiPut('tasks', { id: task.id, status: newStatus });
            await apiPost('user_task_sort_orders', {
                userId: state.currentUser.id,
                taskId: task.id,
                workspaceId: task.workspaceId,
                status: newStatus,
                sortOrder: newSortOrder
            });

            if (originalTaskStatus !== newStatus) {
                runAutomations('statusChange', { task, actorId: state.currentUser.id });
            }
        } catch (error) {
            console.error("Failed to update task:", error);
            alert("Failed to update task. Reverting change.");
            task.status = originalTaskStatus;
            
            // Revert sort order state
            const sortOrderIndex = state.userTaskSortOrders.findIndex(o => o.taskId === task.id && o.userId === state.currentUser!.id);
            if (sortOrderIndex > -1) {
                if (originalSortOrderState) {
                    state.userTaskSortOrders[sortOrderIndex] = originalSortOrderState;
                } else {
                    state.userTaskSortOrders.splice(sortOrderIndex, 1);
                }
            }
            renderApp();
        }
    }

    // Handle Deal Drop
    const dealColumn = (e.target as HTMLElement).closest<HTMLElement>('[data-stage-id]');
    if (dealColumn && draggedItemType === 'deal') {
        const newStageId = dealColumn.dataset.stageId!;
        const deal = state.deals.find(d => d.id === draggedItemId);
        if (deal && newStageId && deal.stageId !== newStageId) {
            const oldStageId = deal.stageId;
            const newActivityDate = new Date().toISOString();
            
            deal.stageId = newStageId; // Optimistic update
            deal.lastActivityAt = newActivityDate;
            renderApp();

            try {
                await apiPut('deals', { id: deal.id, stageId: newStageId, lastActivityAt: newActivityDate });
                const newStage = state.pipelineStages.find(s => s.id === newStageId);
                if (newStage?.category === 'won') {
                    showModal('dealWon', { dealId: deal.id, clientId: deal.clientId, dealName: deal.name });
                }
            } catch (error) {
                console.error("Failed to update deal stage:", error);
                alert("Failed to update deal stage. Reverting change.");
                deal.stageId = oldStageId;
                renderApp();
            }
        }
    }

    // Handle Widget Drop
    const dropTargetWidget = (e.target as HTMLElement).closest('[data-widget-id]');
    if (draggedItemType === 'widget' && dropTargetWidget) {
        document.querySelectorAll('[data-widget-id]').forEach(el => el.classList.remove('drag-over'));
        const dropTargetId = (dropTargetWidget as HTMLElement).dataset.widgetId!;
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
    
    // Handle Pipeline Stage Drop (in settings)
    const dropTargetStageRow = (e.target as HTMLElement).closest('.pipeline-stage-row');
    if (draggedItemType === 'pipeline-stage' && dropTargetStageRow) {
        document.querySelectorAll('.pipeline-stage-row').forEach(el => el.classList.remove('drag-over'));
        const dropTargetId = (dropTargetStageRow as HTMLElement).dataset.stageId!;
        if (draggedItemId === dropTargetId) return;

        const stageList = dropTargetStageRow.parentElement!;
        const draggedElement = stageList.querySelector(`[data-stage-id="${draggedItemId}"]`);
        
        if (draggedElement) {
            const isDraggingDown = (draggedElement.getBoundingClientRect().top - dropTargetStageRow.getBoundingClientRect().top) < 0;
            if (isDraggingDown) {
                stageList.insertBefore(draggedElement, dropTargetStageRow.nextSibling);
            } else {
                stageList.insertBefore(draggedElement, dropTargetStageRow);
            }
        }
        
        const orderedIds = Array.from(stageList.querySelectorAll<HTMLElement>('.pipeline-stage-row')).map(row => row.dataset.stageId!);
        handleReorderStages(orderedIds);
    }

    // Handle Kanban Stage Drop (in settings)
    const dropTargetKanbanStageRow = (e.target as HTMLElement).closest('.kanban-stage-row');
    if (draggedItemType === 'kanban-stage' && dropTargetKanbanStageRow) {
        document.querySelectorAll('.kanban-stage-row').forEach(el => el.classList.remove('drag-over'));
        const dropTargetId = (dropTargetKanbanStageRow as HTMLElement).dataset.stageId!;
        if (draggedItemId === dropTargetId) return;

        const stageList = dropTargetKanbanStageRow.parentElement!;
        const draggedElement = stageList.querySelector(`[data-stage-id="${draggedItemId}"]`);
        
        if (draggedElement) {
            const isDraggingDown = (draggedElement.getBoundingClientRect().top - dropTargetKanbanStageRow.getBoundingClientRect().top) < 0;
            if (isDraggingDown) {
                stageList.insertBefore(draggedElement, dropTargetKanbanStageRow.nextSibling);
            } else {
                stageList.insertBefore(draggedElement, dropTargetKanbanStageRow);
            }
        }
        
        const orderedIds = Array.from(stageList.querySelectorAll<HTMLElement>('.kanban-stage-row')).map(row => row.dataset.stageId!);
        handleReorderKanbanStages(orderedIds);
    }
}