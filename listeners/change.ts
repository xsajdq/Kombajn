


import { state, saveState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Role, Task, AppState, ProjectRole } from '../types.ts';
import * as teamHandlers from '../handlers/team.ts';
import * as taskHandlers from '../handlers/tasks.ts';
import * as dashboardHandlers from '../handlers/dashboard.ts';
import * as mainHandlers from '../handlers/main.ts';
import * as filterHandlers from '../handlers/filters.ts';
import { apiFetch, apiPost } from '../services/api.ts';
import { t } from '../i18n.ts';


export function handleChange(e: Event) {
    const target = e.target as HTMLElement;

    if (target.id === 'timesheet-user-select') {
        const selectedUserId = (target as HTMLSelectElement).value;
        state.ui.teamCalendarSelectedUserId = selectedUserId === 'current' ? state.currentUser!.id : selectedUserId;
        updateUI(['page']);
        return;
    }

    const followUpToggle = target.closest<HTMLInputElement>('[data-toggle-follow-up]');
    if (followUpToggle) {
        const taskId = followUpToggle.dataset.taskId!;
        const type = followUpToggle.dataset.toggleFollowUp as 'onInactivity' | 'onUnansweredQuestion';
        taskHandlers.handleToggleFollowUp(taskId, type);
        return;
    }

    const projectRoleSelect = target.closest<HTMLSelectElement>('[data-project-member-id]');
    if (projectRoleSelect) {
        const memberId = projectRoleSelect.dataset.projectMemberId!;
        const newRole = projectRoleSelect.value as ProjectRole;
        teamHandlers.handleChangeProjectMemberRole(memberId, newRole);
        return;
    }

    const managerSelect = target.closest<HTMLSelectElement>('[data-change-employee-manager]');
    if (managerSelect) {
        const userId = managerSelect.dataset.changeEmployeeManager!;
        const managerId = managerSelect.value;
        teamHandlers.handleUpdateEmployeeManager(userId, managerId);
        return;
    }

    if (target.matches('.task-detail-sidebar *[data-field], .subtask-detail-container *[data-field]')) {
        const modalType = state.ui.modal.type;
        if (modalType === 'taskDetail' || modalType === 'subtaskDetail') {
            let taskId = state.ui.modal.data?.taskId;
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
    
    const assigneeCheckbox = target.closest<HTMLInputElement>('#taskAssigneesSelector input[type="checkbox"]');
    if (assigneeCheckbox) {
        const container = document.getElementById('taskAssigneesSelector');
        const display = container?.querySelector('.multiselect-display');
        if (container && display) {
            const checkedBoxes = container.querySelectorAll<HTMLInputElement>('input:checked');
            display.innerHTML = ''; 
            if (checkedBoxes.length > 0) {
                checkedBoxes.forEach(cb => {
                    const user = state.users.find(u => u.id === cb.value);
                    if(user) {
                        display.innerHTML += `<div class="avatar" title="${user.name || user.initials}">${user.initials || '?'}</div>`;
                    }
                });
            } else {
                display.innerHTML = `<span class="subtle-text">Unassigned</span>`;
            }
        }
        return;
    }

    const tagCheckbox = target.closest<HTMLInputElement>('.multiselect-container input[type="checkbox"]:not([data-filter-key])');
    if (tagCheckbox) {
        const container = tagCheckbox.closest('.multiselect-container');
        const display = container?.querySelector('.multiselect-display');
        if (container && display) {
            const checkedBoxes = container.querySelectorAll<HTMLInputElement>('input:checked');
            display.innerHTML = '';
            if (checkedBoxes.length > 0) {
                checkedBoxes.forEach(cb => {
                    const tag = state.tags.find(t => t.id === cb.value);
                    if(tag) {
                        display.innerHTML += `<span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>`;
                    }
                });
            } else {
                display.innerHTML = `<span class="subtle-text">Select tags...</span>`;
            }
        }
        return;
    }
    
    if (target.closest('[data-custom-field-id]') && state.ui.modal.type === 'taskDetail') {
        const wrapper = target.closest<HTMLElement>('[data-custom-field-id]')!;
        const taskId = state.ui.modal.data.taskId;
        const fieldId = wrapper.dataset.customFieldId!;
        const value = (target as HTMLInputElement).type === 'checkbox' ? (target as HTMLInputElement).checked : (target as HTMLInputElement).value;
        taskHandlers.handleCustomFieldValueUpdate(taskId, fieldId, value);
        return;
    }

    if (target.id === 'workspace-switcher') { teamHandlers.handleWorkspaceSwitch((target as HTMLSelectElement).value); return; }
    
    if (target.id === 'avatar-upload' && (target as HTMLInputElement).files?.length) {
        const file = (target as HTMLInputElement).files![0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const avatarPreview = document.getElementById('avatar-preview');
            if (avatarPreview && event.target?.result) {
                avatarPreview.innerHTML = `<img src="${event.target.result}" alt="Avatar preview" class="w-full h-full rounded-full object-cover">`;
            }
        };
        reader.readAsDataURL(file);
        return;
    }
    
    if (target.id === 'theme-switcher') { state.settings.theme = (target as HTMLSelectElement).value as 'light' | 'dark' | 'minimal'; saveState(); updateUI(['all']); return; }
    if (target.id === 'language-switcher') { state.settings.language = (target as HTMLSelectElement).value as 'en' | 'pl'; saveState(); updateUI(['all']); return; }

    if (target.id === 'dashboard-grid-columns') {
        const newCount = parseInt((target as HTMLSelectElement).value, 10);
        if (!isNaN(newCount)) { dashboardHandlers.handleGridColumnsChange(newCount); }
        return;
    }
    
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

    if (target.matches('input[name="privacy"]') && (target as HTMLInputElement).form?.id === 'projectForm') {
        const membersSection = document.getElementById('project-members-section');
        if (membersSection) {
            if ((target as HTMLInputElement).value === 'private') {
                membersSection.classList.remove('hidden');
            } else {
                membersSection.classList.add('hidden');
            }
        }
        return;
    }
    
    const invoiceFilter = target.closest<HTMLInputElement>('#invoice-filter-date-start, #invoice-filter-date-end, #invoice-filter-client, #invoice-filter-status');
    if (invoiceFilter) {
        const key = invoiceFilter.dataset.filterKey as keyof AppState['ui']['invoiceFilters'];
        if (['dateStart', 'dateEnd', 'clientId', 'status'].includes(key)) {
            (state.ui.invoiceFilters as any)[key] = invoiceFilter.value;
            updateUI(['page']);
        }
        return;
    }
    
    const taskFilterInput = target.closest('#task-filter-panel input, #task-filter-panel select');
    if (taskFilterInput) {
        if (taskFilterInput.id === 'saved-views-select') {
            const viewId = (taskFilterInput as HTMLSelectElement).value;
            if (viewId) {
                filterHandlers.applyFilterView(viewId);
            }
            return;
        }

        if (taskFilterInput.matches('input[type="checkbox"][data-filter-key="tagIds"]')) {
            const tagId = (taskFilterInput as HTMLInputElement).value;
            const isChecked = (taskFilterInput as HTMLInputElement).checked;
            const currentTags = new Set(state.ui.tasks.filters.tagIds);
            if (isChecked) {
                currentTags.add(tagId);
            } else {
                currentTags.delete(tagId);
            }
            state.ui.tasks.filters.tagIds = Array.from(currentTags);
            state.ui.tasks.activeFilterViewId = null;
            updateUI(['page']);
        } else {
            filterHandlers.handleFilterChange(taskFilterInput as HTMLInputElement | HTMLSelectElement);
        }
        return;
    }

    if (target.id === 'automation-project-selector') {
        const projectId = (target as HTMLSelectElement).value;
        state.ui.modal.data = { ...state.ui.modal.data, selectedProjectId: projectId };
        updateUI(['modal']);
        return;
    }

    if (target.id === 'timeLogProject') {
        const projectId = (target as HTMLSelectElement).value;
        state.ui.modal.data.selectedProjectId = projectId;
        updateUI(['modal']);
        return;
    }

    if (target.id === 'assign-time-project-select') {
        const projectId = (target as HTMLSelectElement).value;
        state.ui.modal.data.selectedProjectId = projectId;
        updateUI(['modal']);
        return;
    }

    if (target.id === 'taskProject') {
        const projectId = (target as HTMLSelectElement).value;
        const projectSections = state.projectSections.filter(ps => ps.projectId === projectId);
        const projectSectionGroup = document.getElementById('project-section-group');
        const projectSectionSelect = document.getElementById('projectSection') as HTMLSelectElement;

        if (projectSectionGroup && projectSectionSelect) {
            if (projectSections.length > 0) {
                projectSectionGroup.classList.remove('hidden');
                projectSectionSelect.innerHTML = `
                    <option value="">${t('tasks.default_board')}</option>
                    ${projectSections.map(ps => `<option value="${ps.id}">${ps.name}</option>`).join('')}
                `;
            } else {
                projectSectionGroup.classList.add('hidden');
                projectSectionSelect.innerHTML = '';
            }
        }
    }

    const checklistItemCheckbox = target.closest<HTMLInputElement>('.checklist-item-checkbox');
    if (checklistItemCheckbox) {
        const taskId = state.ui.modal.data?.taskId;
        const itemId = checklistItemCheckbox.dataset.itemId;
        if (taskId && itemId) {
            taskHandlers.handleToggleChecklistItem(taskId, itemId);
        }
        return;
    }

    if (target.id === 'invoiceClient' || target.id === 'invoiceIssueDate' || target.id === 'invoiceDueDate') {
        if (state.ui.modal.type === 'addInvoice') {
            const key = (target.id).replace('invoice', '').charAt(0).toLowerCase() + (target.id).replace('invoice', '').slice(1);
            state.ui.modal.data[key] = (target as HTMLInputElement).value;
            updateUI(['modal']);
        }
        return;
    }
}