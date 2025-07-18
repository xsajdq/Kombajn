

import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Role, Task, AppState } from '../types.ts';
import * as teamHandlers from '../handlers/team.ts';
import * as taskHandlers from '../handlers/tasks.ts';
import * as dashboardHandlers from '../handlers/dashboard.ts';
import * as mainHandlers from '../handlers/main.ts';
import { apiFetch, apiPost } from '../services/api.ts';


export function handleChange(e: Event) {
    const target = e.target as HTMLElement;

    if (target.matches('[data-change-role-for-member-id]')) {
        const select = target as HTMLSelectElement;
        const memberId = select.dataset.changeRoleForMemberId!;
        const newRole = select.value as Role;
        teamHandlers.handleChangeUserRole(memberId, newRole);
        return;
    }

    // This handles updates from the task detail sidebar AND the subtask detail properties
    if (target.matches('.task-detail-sidebar *[data-field], .subtask-detail-container *[data-field]')) {
        const modalType = state.ui.modal.type;
        if (modalType === 'taskDetail' || modalType === 'subtaskDetail') {
            let taskId = state.ui.modal.data?.taskId;
            // The element itself can specify a taskId, which is useful for subtasks
            if (target.dataset.taskId) {
                taskId = target.dataset.taskId;
            }
            const field = target.dataset.field as keyof Task;
            const value = (target as HTMLInputElement).value;

            if (taskId && field) {
                taskHandlers.handleTaskDetailUpdate(taskId, field, value);
                return;
            }
        }
    }
    
    // Multi-select checkbox handling
    const multiSelectCheckbox = target.closest<HTMLInputElement>('.multiselect-list-item input[type="checkbox"]');
    if (multiSelectCheckbox) {
        const container = multiSelectCheckbox.closest<HTMLElement>('.multiselect-container');
        if (container) {
            const type = container.dataset.type;
            const taskId = container.dataset.taskId;
            if (taskId && type === 'assignee') {
                taskHandlers.handleToggleAssignee(taskId, multiSelectCheckbox.value);
            } else if (taskId && type === 'tag') {
                taskHandlers.handleToggleTag(taskId, multiSelectCheckbox.value);
            }
        }
        return;
    }
    
    // --- Custom Fields in task detail modal ---
    if (target.closest('[data-custom-field-id]') && state.ui.modal.type === 'taskDetail') {
        const wrapper = target.closest<HTMLElement>('[data-custom-field-id]')!;
        const taskId = state.ui.modal.data.taskId;
        const fieldId = wrapper.dataset.customFieldId!;
        const value = (target as HTMLInputElement).type === 'checkbox' ? (target as HTMLInputElement).checked : (target as HTMLInputElement).value;
        taskHandlers.handleCustomFieldValueUpdate(taskId, fieldId, value);
        return;
    }

    // Workspace Switcher
    if (target.id === 'workspace-switcher') { teamHandlers.handleWorkspaceSwitch((target as HTMLSelectElement).value); return; }
    
    if (target.id === 'avatar-upload' && (target as HTMLInputElement).files?.length) {
        const file = (target as HTMLInputElement).files![0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const avatarPreview = document.getElementById('avatar-preview');
            if (avatarPreview && event.target?.result) {
                avatarPreview.innerHTML = `<img src="${event.target.result}" alt="Avatar preview">`;
            }
        };
        reader.readAsDataURL(file);
        return;
    }
    
    // Theme & Language Switchers
    if (target.id === 'theme-switcher') { state.settings.theme = (target as HTMLSelectElement).value as 'light' | 'dark' | 'minimal'; saveState(); renderApp(); return; }
    if (target.id === 'language-switcher') { state.settings.language = (target as HTMLSelectElement).value as 'en' | 'pl'; saveState(); renderApp(); return; }

    // Dashboard Grid Columns
    if (target.id === 'dashboard-grid-columns') {
        const newCount = parseInt((target as HTMLSelectElement).value, 10);
        if (!isNaN(newCount)) { dashboardHandlers.handleGridColumnsChange(newCount); }
        return;
    }
    
    // File uploads
    if (target.id === 'attachment-file-input' && (target as HTMLInputElement).files?.length) {
        const file = (target as HTMLInputElement).files![0];
        const taskId = target.dataset.taskId!;
        taskHandlers.handleAddAttachment(taskId, file);
    }
    if (target.id === 'project-file-upload' && (target as HTMLInputElement).files?.length) {
        const file = (target as HTMLInputElement).files![0];
        const projectId = target.dataset.projectId!;
        mainHandlers.handleFileUpload(projectId, file);
    }
    if (target.id === 'logo-upload' && (target as HTMLInputElement).files?.length) {
        const file = (target as HTMLInputElement).files![0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
            if (workspace) { workspace.companyLogo = event.target?.result as string; teamHandlers.handleSaveWorkspaceSettings(); }
        };
        reader.readAsDataURL(file);
    }

    // Add Project Modal - Privacy toggle
    if (target.matches('input[name="privacy"]') && (target as HTMLInputElement).form?.id === 'projectForm') {
        const membersSection = document.getElementById('project-members-section');
        if (membersSection) {
            if ((target as HTMLInputElement).value === 'private') {
                membersSection.classList.remove('collapsed');
            } else {
                membersSection.classList.add('collapsed');
            }
        }
        return;
    }
    
    // Invoice Page Filters
    const invoiceFilter = target.closest<HTMLInputElement>('#invoice-filter-date-start, #invoice-filter-date-end, #invoice-filter-client, #invoice-filter-status');
    if (invoiceFilter) {
        const key = invoiceFilter.id.split('-').pop() as keyof AppState['ui']['invoiceFilters'];
        if (['dateStart', 'dateEnd', 'clientId', 'status'].includes(key)) {
            (state.ui.invoiceFilters as any)[key] = invoiceFilter.value;
            renderApp();
        }
        return;
    }
    
    // Workspace Kanban Workflow setting
    if (target.id === 'workspace-kanban-workflow') {
        const newWorkflow = (target as HTMLSelectElement).value as 'simple' | 'advanced';
        const workspaceId = state.activeWorkspaceId;
        if (workspaceId) {
            let integration = state.integrations.find(i => i.provider === 'internal_settings' && i.workspaceId === workspaceId);
            const originalWorkflow = integration?.settings?.defaultKanbanWorkflow || 'simple';

            // Optimistic update
            if (integration) {
                integration.settings.defaultKanbanWorkflow = newWorkflow;
            } else {
                integration = {
                    id: `temp-${Date.now()}`,
                    workspaceId,
                    provider: 'internal_settings' as const,
                    isActive: false,
                    settings: { defaultKanbanWorkflow: newWorkflow }
                };
                state.integrations.push(integration);
            }

            apiFetch('/api/actions?action=save-workspace-prefs', {
                method: 'POST',
                body: JSON.stringify({ workspaceId, workflow: newWorkflow }),
            }).catch(err => {
                console.error("Failed to save kanban workflow preference:", err);
                alert("Failed to save your view preference. Please try again.");
                // Revert on failure
                if (integration) {
                    integration.settings.defaultKanbanWorkflow = originalWorkflow;
                }
                renderApp();
            });
        }
        return;
    }
}