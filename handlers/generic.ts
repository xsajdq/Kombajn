

import { getState, setState } from '../state.ts';
import { updateUI, UIComponent } from '../app-renderer.ts';
import { apiFetch } from '../services/api.ts';

// A type for resource names that are safe for generic deletion.
export type ResourceName =
    | 'automations'
    | 'inventory_items'
    | 'project_sections'
    | 'task_views'
    | 'pipeline_stages'
    | 'dashboard_widgets'
    | 'filter_views'
    | 'custom_field_definitions'
    | 'project_members'
    | 'tasks'
    | 'task_dependencies'
    | 'attachments'
    | 'clients'
    | 'projects'
    | 'checklist_templates';

// A type mapping resource names to their corresponding keys in the global state.
type StateKey =
    | 'automations'
    | 'inventoryItems'
    | 'projectSections'
    | 'taskViews'
    | 'pipelineStages'
    | 'dashboardWidgets'
    | 'filterViews'
    | 'customFieldDefinitions'
    | 'projectMembers'
    | 'tasks'
    | 'dependencies'
    | 'attachments'
    | 'clients'
    | 'projects'
    | 'checklistTemplates';

const resourceToStateMap: Record<ResourceName, StateKey> = {
    'automations': 'automations',
    'inventory_items': 'inventoryItems',
    'project_sections': 'projectSections',
    'task_views': 'taskViews',
    'pipeline_stages': 'pipelineStages',
    'dashboard_widgets': 'dashboardWidgets',
    'filter_views': 'filterViews',
    'custom_field_definitions': 'customFieldDefinitions',
    'project_members': 'projectMembers',
    'tasks': 'tasks',
    'task_dependencies': 'dependencies',
    'attachments': 'attachments',
    'clients': 'clients',
    'projects': 'projects',
    'checklist_templates': 'checklistTemplates'
};

/**
 * Handles the deletion of a resource with an optimistic UI update.
 * @param resource - The name of the resource table in the database.
 * @param id - The ID of the item to delete.
 * @param confirmMessage - The message to display in the confirmation dialog.
 */
export async function handleOptimisticDelete(resource: ResourceName, id: string, confirmMessage: string) {
    if (confirmMessage && !confirm(confirmMessage)) return;

    const stateKey = resourceToStateMap[resource];
    const state = getState();
    const originalState: Partial<any> = {};
    let stateUpdate: Partial<any> = {};

    // Prepare state update and backup
    if (resource === 'clients') {
        const clientIndex = state.clients.findIndex(c => c.id === id);
        if (clientIndex === -1) return;
        
        originalState.clients = [...state.clients];
        originalState.projects = [...state.projects];
        originalState.tasks = [...state.tasks];
        originalState.invoices = [...state.invoices];

        const projectsToDelete = state.projects.filter(p => p.clientId === id).map(p => p.id);
        stateUpdate.clients = state.clients.filter(c => c.id !== id);
        stateUpdate.projects = state.projects.filter(p => p.clientId !== id);
        stateUpdate.tasks = state.tasks.filter(t => !projectsToDelete.includes(t.projectId));
        stateUpdate.invoices = state.invoices.filter(i => i.clientId !== id);

    } else if (resource === 'projects') {
        const projectIndex = state.projects.findIndex(p => p.id === id);
        if (projectIndex === -1) return;

        originalState.projects = [...state.projects];
        originalState.tasks = [...state.tasks];
        originalState.projectMembers = [...state.projectMembers];
        originalState.projectSections = [...state.projectSections];

        stateUpdate.projects = state.projects.filter(p => p.id !== id);
        stateUpdate.tasks = state.tasks.filter(t => t.projectId !== id);
        stateUpdate.projectMembers = state.projectMembers.filter(pm => pm.projectId !== id);
        stateUpdate.projectSections = state.projectSections.filter(ps => ps.projectId !== id);

    } else if (resource === 'project_sections') {
        const sectionIndex = state.projectSections.findIndex(ps => ps.id === id);
        if (sectionIndex === -1) return;

        originalState.projectSections = [...state.projectSections];
        originalState.tasks = [...state.tasks];

        stateUpdate.projectSections = state.projectSections.filter(ps => ps.id !== id);
        stateUpdate.tasks = state.tasks.map(task => 
            task.projectSectionId === id ? { ...task, projectSectionId: null } : task
        );
    } else {
        const stateArray = state[stateKey] as any[];
        const itemIndex = stateArray.findIndex((item: any) => item.id === id);
        if (itemIndex === -1) return;

        originalState[stateKey] = [...stateArray];
        stateUpdate[stateKey] = stateArray.filter((item: any) => item.id !== id);
    }
    
    // Optimistic UI update
    setState(stateUpdate, ['page', 'modal', 'side-panel']);


    try {
        await apiFetch(`/api?action=data&resource=${resource}`, {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error(`Failed to delete ${resource}:`, error);
        alert(`Could not delete item. Reverting change.`);
        setState(originalState, ['page', 'modal', 'side-panel']);
    }
}