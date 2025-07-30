import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { DashboardWidget, DashboardWidgetType } from '../types.ts';
import { apiFetch, apiPost, apiPut } from '../services/api.ts';

let isCreatingDefaults = false;

export function toggleEditMode() {
    state.ui.dashboard.isEditing = !state.ui.dashboard.isEditing;
    updateUI(['page']);
}

export async function createDefaultWidgets() {
    if (isCreatingDefaults) return;
    if (!state.currentUser || !state.activeWorkspaceId) return;

    isCreatingDefaults = true;

    try {
        const defaultWidgets: Omit<DashboardWidget, 'id'>[] = [
            { userId: state.currentUser.id, workspaceId: state.activeWorkspaceId, type: 'kpiMetric', config: { metric: 'activeProjects' }, sortOrder: 0, x: 0, y: 0, w: 1, h: 1 },
            { userId: state.currentUser.id, workspaceId: state.activeWorkspaceId, type: 'timeTrackingSummary', config: { }, sortOrder: 1, x: 0, y: 0, w: 1, h: 1 },
            { userId: state.currentUser.id, workspaceId: state.activeWorkspaceId, type: 'invoiceSummary', config: { }, sortOrder: 2, x: 0, y: 0, w: 1, h: 1 },
            { userId: state.currentUser.id, workspaceId: state.activeWorkspaceId, type: 'todaysTasks', config: { taskFilter: 'today' }, sortOrder: 3, x: 0, y: 0, w: 1, h: 1 },
            { userId: state.currentUser.id, workspaceId: state.activeWorkspaceId, type: 'recentProjects', config: {}, sortOrder: 4, x: 0, y: 0, w: 1, h: 1 },
            { userId: state.currentUser.id, workspaceId: state.activeWorkspaceId, type: 'activityFeed', config: {}, sortOrder: 5, x: 0, y: 0, w: 1, h: 1 },
        ];

        const savedWidgets = await apiPost('dashboard_widgets', defaultWidgets);
        state.dashboardWidgets.push(...savedWidgets);
        state.dashboardWidgets.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to create default widgets:", error);
    } finally {
        isCreatingDefaults = false;
    }
}


export async function addWidget(type: DashboardWidgetType, metricType?: DashboardWidget['config']['metric']) {
    if (!state.currentUser || !state.activeWorkspaceId) return;

    const userWidgets = state.dashboardWidgets.filter(w => 
        w.userId === state.currentUser?.id && w.workspaceId === state.activeWorkspaceId
    );
    
    const maxSortOrder = userWidgets.reduce((max, w) => Math.max(max, w.sortOrder || 0), 0);

    const newWidgetPayload: Omit<DashboardWidget, 'id'> = {
        userId: state.currentUser.id,
        workspaceId: state.activeWorkspaceId,
        type,
        x: 0, 
        y: 0,
        w: 1, 
        h: 1,
        sortOrder: maxSortOrder + 1,
        config: type === 'kpiMetric' ? { metric: metricType } : {}
    };
    
    try {
        const [savedWidget] = await apiPost('dashboard_widgets', newWidgetPayload);
        state.dashboardWidgets.push(savedWidget);
        state.dashboardWidgets.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        closeModal(false);
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to add widget:", error);
        alert("Could not add widget.");
    }
}

export async function removeWidget(widgetId: string) {
    const widgetIndex = state.dashboardWidgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return;

    const [removedWidget] = state.dashboardWidgets.splice(widgetIndex, 1);
    updateUI(['page']);
    try {
        await apiFetch(`/api?action=data&resource=dashboard_widgets`, {
            method: 'DELETE',
            body: JSON.stringify({ id: widgetId }),
        });
    } catch (error) {
        state.dashboardWidgets.splice(widgetIndex, 0, removedWidget);
        updateUI(['page']);
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

    const form = document.getElementById('configure-widget-form') as HTMLFormElement;
    if (form && widget.type === 'todaysTasks') {
        const userId = (form.elements.namedItem('userId') as HTMLSelectElement).value;
        newConfig.userId = userId;
    }
    
    widget.config = newConfig;

    try {
        await apiPut('dashboard_widgets', { id: widgetId, config: newConfig });
        closeModal(false);
        updateUI(['page']);
    } catch(error) {
        widget.config = originalConfig;
        alert("Failed to save widget configuration.");
        updateUI(['page']);
    }
}

export async function handleGridColumnsChange(newCount: number) {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;

    const originalCount = workspace.dashboardGridColumns;
    workspace.dashboardGridColumns = newCount;
    updateUI(['page']);

    try {
        await apiPut('workspaces', { id: workspace.id, dashboardGridColumns: newCount });
    } catch (error) {
        console.error("Failed to update grid columns:", error);
        workspace.dashboardGridColumns = originalCount;
        updateUI(['page']);
        alert("Could not save your grid preference.");
    }
}

export async function handleSwitchTaskWidgetTab(widgetId: string, filter: string) {
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (!widget || widget.type !== 'todaysTasks') return;

    const originalFilter = widget.config.taskFilter;
    widget.config.taskFilter = filter as 'overdue' | 'today' | 'tomorrow';
    updateUI(['page']);

    try {
        await apiPut('dashboard_widgets', { id: widgetId, config: widget.config });
    } catch (error) {
        console.error("Failed to save widget tab preference:", error);
        widget.config.taskFilter = originalFilter;
        updateUI(['page']);
        alert("Could not save your preference.");
    }
}