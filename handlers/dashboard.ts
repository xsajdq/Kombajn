
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { DashboardWidget, DashboardWidgetType } from '../types.ts';
import { apiFetch, apiPost, apiPut } from '../services/api.ts';

let isCreatingDefaults = false;

export function getKpiMetrics() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) {
        return { totalRevenue: 0, activeProjects: 0, totalClients: 0, overdueProjects: 0 };
    }

    const totalRevenue = state.invoices
        .filter(i => i.workspaceId === activeWorkspaceId && i.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);

    const activeProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId && !p.isArchived).length;

    const totalClients = state.clients.filter(c => c.workspaceId === activeWorkspaceId).length;
    
    const today = new Date().toISOString().slice(0, 10);
    const overdueProjectIds = new Set<string>();
    state.tasks.forEach(task => {
        if (task.workspaceId === activeWorkspaceId && task.dueDate && task.dueDate < today && task.status !== 'done') {
            overdueProjectIds.add(task.projectId);
        }
    });
    const overdueProjects = overdueProjectIds.size;

    return { totalRevenue, activeProjects, totalClients, overdueProjects };
}

export function toggleEditMode() {
    setState(prevState => ({
        ui: {
            ...prevState.ui,
            dashboard: {
                ...prevState.ui.dashboard,
                isEditing: !prevState.ui.dashboard.isEditing
            }
        }
    }), ['page']);
}

export async function createDefaultWidgets() {
    if (isCreatingDefaults) return;
    const state = getState();
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
        setState(prevState => ({
            dashboardWidgets: [...prevState.dashboardWidgets, ...savedWidgets].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        }), ['page']);
    } catch (error) {
        console.error("Failed to create default widgets:", error);
    } finally {
        isCreatingDefaults = false;
    }
}


export async function addWidget(type: DashboardWidgetType, metricType?: DashboardWidget['config']['metric']) {
    const state = getState();
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
        setState(prevState => ({
            dashboardWidgets: [...prevState.dashboardWidgets, savedWidget].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        }), []);
        closeModal(false);
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to add widget:", error);
        alert("Could not add widget.");
    }
}

export async function removeWidget(widgetId: string) {
    const state = getState();
    const widgetIndex = state.dashboardWidgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return;
    
    const originalWidgets = [...state.dashboardWidgets];
    setState(prevState => ({
        dashboardWidgets: prevState.dashboardWidgets.filter(w => w.id !== widgetId)
    }), ['page']);

    try {
        await apiFetch(`/api?action=data&resource=dashboard_widgets`, {
            method: 'DELETE',
            body: JSON.stringify({ id: widgetId }),
        });
    } catch (error) {
        setState({ dashboardWidgets: originalWidgets }, ['page']);
        alert("Could not remove widget.");
    }
}

export function showConfigureWidgetModal(widgetId: string) {
    const state = getState();
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (widget) {
        showModal('configureWidget', { widget });
    }
}

export async function handleWidgetConfigSave(widgetId: string) {
    const state = getState();
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    const originalConfig = { ...widget.config };
    let newConfig = { ...originalConfig };

    const form = document.getElementById('configure-widget-form') as HTMLFormElement;
    if (form && widget.type === 'todaysTasks') {
        const userId = (form.elements.namedItem('userId') as HTMLSelectElement).value;
        newConfig.userId = userId;
    }
    
    // Optimistic update
    setState(prevState => ({
        dashboardWidgets: prevState.dashboardWidgets.map(w => w.id === widgetId ? { ...w, config: newConfig } : w)
    }), []);

    try {
        await apiPut('dashboard_widgets', { id: widgetId, config: newConfig });
        closeModal(false);
        updateUI(['page']);
    } catch(error) {
        alert("Failed to save widget configuration.");
        // Revert on failure
        setState(prevState => ({
            dashboardWidgets: prevState.dashboardWidgets.map(w => w.id === widgetId ? { ...w, config: originalConfig } : w)
        }), ['page']);
    }
}

export async function handleGridColumnsChange(newCount: number) {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;

    const originalCount = workspace.dashboardGridColumns;
    
    // Optimistic update
    setState(prevState => ({
        workspaces: prevState.workspaces.map(w => w.id === activeWorkspaceId ? { ...w, dashboardGridColumns: newCount } : w)
    }), ['page']);

    try {
        await apiPut('workspaces', { id: workspace.id, dashboardGridColumns: newCount });
    } catch (error) {
        console.error("Failed to update grid columns:", error);
        // Revert on failure
        setState(prevState => ({
            workspaces: prevState.workspaces.map(w => w.id === activeWorkspaceId ? { ...w, dashboardGridColumns: originalCount } : w)
        }), ['page']);
        alert("Could not save your grid preference.");
    }
}

export async function handleSwitchTaskWidgetTab(widgetId: string, filter: string) {
    const state = getState();
    const widget = state.dashboardWidgets.find(w => w.id === widgetId);
    if (!widget || widget.type !== 'todaysTasks') return;

    const originalFilter = widget.config.taskFilter;
    const newConfig = { ...widget.config, taskFilter: filter as 'overdue' | 'today' | 'tomorrow' };
    
    // Optimistic update
    setState(prevState => ({
        dashboardWidgets: prevState.dashboardWidgets.map(w => w.id === widgetId ? { ...w, config: newConfig } : w)
    }), ['page']);

    try {
        await apiPut('dashboard_widgets', { id: widgetId, config: newConfig });
    } catch (error) {
        console.error("Failed to save widget tab preference:", error);
        alert("Could not save your preference.");
         // Revert on failure
        setState(prevState => ({
            dashboardWidgets: prevState.dashboardWidgets.map(w => w.id === widgetId ? { ...w, config: { ...w.config, taskFilter: originalFilter } } : w)
        }), ['page']);
    }
}
