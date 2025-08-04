import { state } from '../state.ts';
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
    | 'attachments';

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
    | 'attachments';

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
    'attachments': 'attachments'
};

/**
 * Handles the deletion of a resource with an optimistic UI update.
 * @param resource - The name of the resource table in the database.
 * @param id - The ID of the item to delete.
 * @param confirmMessage - The message to display in the confirmation dialog.
 */
export async function handleOptimisticDelete(resource: ResourceName, id: string, confirmMessage: string) {
    if (!confirm(confirmMessage)) return;

    const stateKey = resourceToStateMap[resource];
    const stateArray = state[stateKey] as any[];
    
    const itemIndex = stateArray.findIndex((item: any) => item.id === id);
    if (itemIndex === -1) return;

    // Optimistic UI update
    const [removedItem] = stateArray.splice(itemIndex, 1);
    
    if (resource === 'project_sections') {
        state.tasks.forEach(task => {
            if (task.projectSectionId === id) {
                task.projectSectionId = null;
            }
        });
    }

    // Determine UI scope. Project members are in side panel, others are on main page.
    const uiScope: UIComponent[] = ['page', 'modal', 'side-panel'];
    updateUI(uiScope);

    try {
        await apiFetch(`/api?action=data&resource=${resource}`, {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error(`Failed to delete ${resource}:`, error);
        alert(`Could not delete item. Reverting change.`);
        // Revert UI on failure
        stateArray.splice(itemIndex, 0, removedItem);
        updateUI(uiScope);
    }
}
