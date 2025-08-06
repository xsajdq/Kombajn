import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import type { InvoiceLineItem, Task, DashboardWidget, DashboardWidgetType, WikiHistory, User, CalendarEvent, Deal, Client, ProjectSection, Review } from '../types.ts';
import { AddCommentToTimeLogModal } from './modals/AddCommentToTimeLogModal.ts';
import { TaskDetailModal } from './modals/TaskDetailModal.ts';
import { camelToSnake, formatCurrency, formatDate, getTaskTotalTrackedSeconds, formatDuration, parseDurationStringToSeconds, getUserInitials } from '../utils.ts';
import { can } from '../permissions.ts';
import { getWorkspaceKanbanWorkflow } from '../handlers/main.ts';

// =================================================================
// Form Control Helper Functions
// =================================================================
const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
const formGroupClasses = "flex flex-col gap-1.5";
const labelClasses = "text-sm font-medium text-text-subtle";
const modalFormGridClasses = "grid grid-cols-1 sm:grid-cols-2 gap-4";

interface ControlOptions {
    id: string;
    label: string;
    value?: string | number;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    containerClassName?: string;
    list?: string;
    dataAttributes?: Record<string, string>;
}

interface TextOptions extends ControlOptions {
    type?: 'text' | 'email' | 'number' | 'password' | 'date' | 'time';
    min?: number;
    max?: number;
    step?: number;
}

interface SelectOptions extends ControlOptions {
    options: { value: string; text: string; }[];
}

function renderTextInput(opts: TextOptions): string {
    const dataAttrString = opts.dataAttributes ? Object.entries(opts.dataAttributes).map(([key, val]) => `data-${key}="${val}"`).join(' ') : '';
    return `
        <div class="${opts.containerClassName || formGroupClasses}">
            <label for="${opts.id}" class="${labelClasses}">${opts.label}</label>
            <input 
                type="${opts.type || 'text'}" 
                id="${opts.id}" 
                name="${opts.id}"
                class="${formControlClasses} ${opts.className || ''}" 
                ${opts.required ? 'required' : ''} 
                value="${opts.value || ''}"
                placeholder="${opts.placeholder || ''}"
                ${opts.disabled ? 'disabled' : ''}
                ${opts.min !== undefined ? `min="${opts.min}"` : ''}
                ${opts.max !== undefined ? `max="${opts.max}"` : ''}
                ${opts.step !== undefined ? `step="${opts.step}"` : ''}
                ${opts.list ? `list="${opts.list}"` : ''}
                ${dataAttrString}
            >
        </div>
    `;
}

function renderTextarea(opts: ControlOptions & {rows?: number}): string {
    return `
        <div class="${opts.containerClassName || formGroupClasses}">
            <label for="${opts.id}" class="${labelClasses}">${opts.label}</label>
            <textarea
                id="${opts.id}"
                name="${opts.id}"
                class="${formControlClasses} ${opts.className || ''}"
                rows="${opts.rows || 3}"
                placeholder="${opts.placeholder || ''}"
                ${opts.required ? 'required' : ''}
            >${opts.value || ''}</textarea>
        </div>
    `;
}

function renderSelect(opts: SelectOptions): string {
    return `
        <div class="${opts.containerClassName || formGroupClasses}">
            <label for="${opts.id}" class="${labelClasses}">${opts.label}</label>
            <select id="${opts.id}" name="${opts.id}" class="${formControlClasses} ${opts.className || ''}" ${opts.required ? 'required' : ''} ${opts.disabled ? 'disabled' : ''}>
                ${opts.options.map(opt => `<option value="${opt.value}" ${opts.value === opt.value ? 'selected' : ''}>${opt.text}</option>`).join('')}
            </select>
        </div>
    `;
}

// =================================================================
// Specific Component Helpers
// =================================================================

function renderClientContactFormRow(contact?: any) {
    const id = contact?.id || `new-${Date.now()}`;
    return `
        <div class="grid grid-cols-[1fr,1fr,1fr,1fr,auto] gap-2 items-center contact-form-row" data-contact-id="${id}">
            <input type="text" class="${formControlClasses}" data-field="name" placeholder="${t('modals.contact_person')}" value="${contact?.name || ''}" required>
            <input type="email" class="${formControlClasses}" data-field="email" placeholder="${t('modals.email')}" value="${contact?.email || ''}">
            <input type="text" class="${formControlClasses}" data-field="phone" placeholder="${t('modals.phone')}" value="${contact?.phone || ''}">
            <input type="text" class="${formControlClasses}" data-field="role" placeholder="${t('modals.contact_role')}" value="${contact?.role || ''}">
            <button type="button" class="p-2 text-danger hover:bg-danger/10 rounded-full remove-contact-row-btn" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
        </div>
    `;
}

function renderTimePicker(initialSeconds: number = 0) {
    const hours = Math.floor(initialSeconds / 3600);
    const minutes = Math.floor((initialSeconds % 3600) / 60);

    const hoursOptions = Array.from({ length: 24 }, (_, i) => `<div class="time-picker-option ${i === hours ? 'selected' : ''}" data-value="${i}">${String(i).padStart(2, '0')}</div>`).join('');
    const minutesOptions = Array.from({ length: 12 }, (_, i) => {
        const minute = i * 5;
        return `<div class="time-picker-option ${minute === minutes ? 'selected' : ''}" data-value="${minute}">${String(minute).padStart(2, '0')}</div>`;
    }).join('');

    return `
        <div class="time-picker">
            <input type="hidden" id="time-picker-seconds" value="${initialSeconds}">
            <div class="time-picker-column" id="time-picker-hours">${hoursOptions}</div>
            <div class="time-picker-column" id="time-picker-minutes">${minutesOptions}</div>
        </div>
    `;
}

// =================================================================
// Main Modal Component
// =================================================================
export function Modal() {
    const state = getState();
    if (!state.ui.modal.isOpen) return '';

    let title = '';
    let body = '';
    let footer = '';
    let maxWidth = 'max-w-2xl'; // Default width
    const modalData = state.ui.modal.data || {};

    const workspaceProjects = state.projects.filter(p => {
        if (p.workspaceId !== state.activeWorkspaceId || p.isArchived) return false;
        if (p.privacy === 'public') return true;
        return state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === state.currentUser?.id);
    });

    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean);
    
    const defaultFooter = `
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;
    footer = defaultFooter;


    if (state.ui.modal.type === 'keyboardShortcuts') {
        title = t('shortcuts.title');
        maxWidth = 'max-w-lg';
        footer = `<button class="btn btn-primary btn-close-modal">Got it</button>`;

        const renderShortcutRow = (keys: string, description: string) => `
            <div class="flex justify-between items-center py-2">
                <p class="text-sm">${description}</p>
                <div class="flex gap-1">
                    ${keys.split('+').map(key => `<kbd class="px-2 py-1 text-xs font-semibold bg-background border border-border-color rounded-md">${key.trim()}</kbd>`).join('')}
                </div>
            </div>
        `;

        body = `
            <div class="space-y-4">
                <div>
                    <h4 class="font-semibold mb-2">${t('shortcuts.global_title')}</h4>
                    <div class="divide-y divide-border-color">
                        ${renderShortcutRow('Ctrl + K', t('shortcuts.global_desc_palette'))}
                        ${renderShortcutRow('n', t('shortcuts.global_desc_new_task'))}
                        ${renderShortcutRow('?', t('shortcuts.global_desc_help'))}
                    </div>
                </div>
                <div>
                    <h4 class="font-semibold mb-2">${t('shortcuts.nav_title')}</h4>
                    <p class="text-xs text-text-subtle mb-2">${t('shortcuts.nav_desc_prefix')}</p>
                    <div class="divide-y divide-border-color">
                        ${renderShortcutRow('g + d', t('shortcuts.nav_desc_dashboard'))}
                        ${renderShortcutRow('g + p', t('shortcuts.nav_desc_projects'))}
                        ${renderShortcutRow('g + t', t('shortcuts.nav_desc_tasks'))}
                        ${renderShortcutRow('g + h', t('shortcuts.nav_desc_hr'))}
                        ${renderShortcutRow('g + s', t('shortcuts.nav_desc_settings'))}
                    </div>
                </div>
                <div>
                    <h4 class="font-semibold mb-2">${t('shortcuts.context_title')}</h4>
                    <div class="divide-y divide-border-color">
                        ${renderShortcutRow('e', t('shortcuts.context_desc_edit'))}
                        ${renderShortcutRow('m', t('shortcuts.context_desc_assign'))}
                        ${renderShortcutRow('Ctrl + Enter', t('shortcuts.context_desc_comment'))}
                    </div>
                </div>
            </div>
        `;
    }

    if (state.ui.modal.type === 'addClient') {
        const isEdit = !!modalData.clientId;
        const client = isEdit ? workspaceClients.find(c => c.id === modalData.clientId) : null;
        const contacts = client?.contacts || [];
        title = isEdit ? t('modals.edit_client_title') : t('modals.add_client_title');
        body = `
            <form id="clientForm" class="space-y-4">
                <input type="hidden" id="clientId" value="${client?.id || ''}">
                <div class="${modalFormGridClasses}">
                    ${renderTextInput({ id: 'clientName', label: t('modals.company_name'), value: client?.name, required: true })}
                    ${renderTextInput({ id: 'clientVatId', label: t('modals.vat_id'), value: client?.vatId })}
                    ${renderTextInput({ id: 'clientCategory', label: t('modals.category'), value: client?.category })}
                    ${renderSelect({
                        id: 'clientHealthStatus', label: t('modals.health_status'), value: client?.healthStatus || undefined,
                        options: [
                            { value: '', text: '--' },
                            { value: 'good', text: t('modals.health_status_good') },
                            { value: 'at_risk', text: t('modals.health_status_at_risk') },
                            { value: 'neutral', text: t('modals.health_status_neutral') },
                        ]
                    })}
                     ${renderSelect({
                        id: 'clientStatus', label: t('modals.status'), value: client?.status || 'active',
                        options: [ { value: 'active', text: 'Active' }, { value: 'archived', text: 'Archived' } ]
                    })}
                </div>

                <h4 class="text-md font-semibold pt-4 mt-4 border-t border-border-color">${t('modals.contacts')}</h4>
                <div id="client-contacts-container" class="space-y-2">
                    ${contacts.map(renderClientContactFormRow).join('')}
                </div>
                <button type="button" id="add-contact-row-btn" class="mt-2 px-3 py-1.5 text-sm font-medium text-text-main bg-background border border-border-color rounded-md hover:bg-border-color transition-colors flex items-center gap-1">
                    <span class="material-icons-sharp text-base">add</span> ${t('modals.add_contact')}
                </button>
                <input type="hidden" id="deleted-contact-ids" value="">
            </form>
        `;
    }

    if (state.ui.modal.type === 'addProject') {
        const isEdit = !!modalData.projectId;
        const project = isEdit ? workspaceProjects.find(p => p.id === modalData.projectId) : null;
        title = isEdit ? `Edit Project` : t('modals.add_project_title');
        const templates = state.projectTemplates.filter(pt => pt.workspaceId === state.activeWorkspaceId);
        
        const existingMemberIds = isEdit ? new Set(state.projectMembers.filter(pm => pm.projectId === project!.id).map(pm => pm.userId)) : new Set([state.currentUser?.id]);
        const projectNameFromDeal = modalData.projectName;
        const workspaceTags = state.tags.filter(t => t.workspaceId === state.activeWorkspaceId);
        const projectTagIds = isEdit ? new Set(state.projectTags.filter(pt => pt.projectId === project!.id).map(pt => pt.tagId)) : new Set();


        body = `
            <form id="projectForm" class="space-y-4">
                 <input type="hidden" id="projectId" value="${project?.id || ''}">
                 ${renderTextInput({ id: 'projectName', label: t('modals.project_name'), value: project?.name || projectNameFromDeal, required: true, containerClassName: formGroupClasses })}
                <div class="${modalFormGridClasses}">
                    ${renderSelect({
                        id: 'projectClient', label: t('modals.assign_to_client'), value: project?.clientId || modalData.clientId, required: true,
                        options: [ { value: '', text: t('modals.select_a_client') }, ...workspaceClients.map(c => ({ value: c.id, text: c.name })) ]
                    })}
                    ${renderSelect({
                        id: 'projectTemplate', label: t('modals.create_from_template'), disabled: isEdit,
                        options: [ { value: '', text: t('modals.select_template') }, ...templates.map(t => ({ value: t.id, text: t.name })) ]
                    })}
                    ${renderTextInput({ id: 'projectHourlyRate', label: t('modals.hourly_rate'), value: project?.hourlyRate, type: 'number', placeholder: 'e.g. 100', min: 0, step: 0.01 })}
                    ${renderTextInput({ id: 'projectBudgetHours', label: 'Budget (hours)', value: project?.budgetHours, type: 'number', placeholder: 'e.g. 100', min: 0 })}
                    ${renderTextInput({ id: 'projectBudgetCost', label: t('modals.budget_cost'), value: project?.budgetCost, type: 'number', placeholder: 'e.g. 10000', min: 0 })}
                    ${renderTextInput({ id: 'projectCategory', label: t('modals.project_category'), value: project?.category, placeholder: 'e.g. Marketing' })}
                </div>
                 <div class="${formGroupClasses}">
                    <label class="${labelClasses}">${t('modals.tags')}</label>
                    <div id="projectTagsSelector" class="multiselect-container" data-entity-type="project" ${isEdit ? `data-entity-id="${project!.id}"` : ''}>
                        <div class="multiselect-display">
                            <span class="subtle-text">Select tags...</span>
                        </div>
                        <div class="multiselect-dropdown hidden">
                            <div class="multiselect-list">
                                ${workspaceTags.map(tag => `
                                    <label class="multiselect-list-item">
                                        <input type="checkbox" name="project_tags" value="${tag.id}" ${projectTagIds.has(tag.id) ? 'checked' : ''}>
                                        <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="${formGroupClasses}">
                    <label class="${labelClasses}">${t('modals.privacy')}</label>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <input type="radio" id="privacy-public" name="privacy" value="public" class="sr-only peer" ${project?.privacy === 'public' || !isEdit ? 'checked' : ''}>
                            <label for="privacy-public" class="flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all h-full border-border-color peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary">
                                <span class="material-icons-sharp text-3xl mb-2">public</span>
                                <strong>${t('modals.privacy_public')}</strong>
                                <p class="text-xs text-text-subtle text-center">${t('modals.privacy_public_desc')}</p>
                            </label>
                        </div>
                        <div>
                            <input type="radio" id="privacy-private" name="privacy" value="private" class="sr-only peer" ${project?.privacy === 'private' ? 'checked' : ''}>
                            <label for="privacy-private" class="flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all h-full border-border-color peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary">
                                <span class="material-icons-sharp text-3xl mb-2">lock</span>
                                <strong>${t('modals.privacy_private')}</strong>
                                <p class="text-xs text-text-subtle text-center">${t('modals.privacy_private_desc')}</p>
                            </label>
                        </div>
                    </div>
                </div>

                <div id="project-members-section" class="form-group ${project?.privacy !== 'private' && isEdit ? 'hidden' : ''} transition-all duration-300">
                    <label class="${labelClasses}">${t('modals.invite_members')}</label>
                    <div class="max-h-40 overflow-y-auto border border-border-color rounded-lg p-2 space-y-2">
                        ${workspaceMembers.map(user => {
                            if (!user) return '';
                            const isCreator = user.id === state.currentUser?.id;
                            const isExistingMember = isEdit && existingMemberIds.has(user.id);
                            const displayName = user.name || user.email || 'Unnamed User';

                            return `
                            <label class="flex items-center gap-2 p-1.5 rounded-md hover:bg-background">
                                <input type="checkbox" name="project_members" value="${user.id}" class="h-4 w-4 rounded text-primary focus:ring-primary" ${isCreator ? 'checked disabled' : (isExistingMember ? 'checked' : '')}>
                                <div class="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">${getUserInitials(user)}</div>
                                <span class="text-sm">${displayName} ${isCreator ? `(${t('hr.you')})` : ''}</span>
                            </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'aiProjectPlanner') {
        title = t('modals.ai_planner_title');
        footer = `
            <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
            <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.create_project')}</button>
        `;
        body = `
            <form id="aiProjectForm" class="space-y-4">
                ${renderTextInput({ id: 'aiProjectName', label: t('modals.project_name'), required: true, containerClassName: formGroupClasses })}
                ${renderSelect({
                    id: 'aiProjectClient', label: t('modals.assign_to_client'), required: true,
                    options: [{value: '', text: t('modals.select_a_client')}, ...workspaceClients.map(c => ({value: c.id, text: c.name}))]
                })}
                ${renderTextarea({ id: 'aiProjectGoal', label: t('modals.ai_planner_goal_label'), required: true, placeholder: t('modals.ai_planner_goal_placeholder'), rows: 4 })}
            </form>
        `;
    }

    if (state.ui.modal.type === 'addTask') {
        const projectIdFromPanel = modalData.projectId;
        const workspaceTags = state.tags.filter(t => t.workspaceId === state.activeWorkspaceId);
        const projectSectionsForSelectedProject: ProjectSection[] = projectIdFromPanel 
            ? state.projectSections.filter(ps => ps.projectId === projectIdFromPanel) 
            : [];
        const taskViews = state.taskViews.filter(tv => tv.workspaceId === state.activeWorkspaceId);

        title = t('modals.add_task_title');
        body = `
            <form id="taskForm" class="space-y-4">
                ${renderTextInput({ id: 'taskName', label: t('modals.task_name'), required: true, containerClassName: formGroupClasses })}
                ${renderTextarea({ id: 'taskDescription', label: t('modals.description'), containerClassName: formGroupClasses, rows: 3 })}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    ${renderSelect({
                        id: 'taskProject', label: t('modals.project'), required: true, value: projectIdFromPanel,
                        options: [{value: '', text: t('modals.select_a_project')}, ...workspaceProjects.map(p => ({value: p.id, text: p.name}))]
                    })}
                     <div class="${formGroupClasses} ${projectSectionsForSelectedProject.length > 0 ? '' : 'hidden'}" id="project-section-group">
                        <label for="projectSection" class="${labelClasses}">${t('modals.project_section')}</label>
                        <select id="projectSection" class="${formControlClasses}">
                            <option value="">${t('tasks.default_board')}</option>
                            ${projectSectionsForSelectedProject.map((ps: ProjectSection) => `<option value="${ps.id}">${ps.name}</option>`).join('')}
                        </select>
                    </div>
                    ${renderSelect({
                        id: 'taskView', label: t('modals.task_view'),
                        options: [{value: '', text: '-- No View --'}, ...taskViews.map(tv => ({value: tv.id, text: tv.name}))]
                    })}
                    <div class="${formGroupClasses}">
                        <label class="${labelClasses}">${t('modals.people')}</label>
                        <div id="taskAssigneesSelector" class="multiselect-container" data-type="assignee">
                            <div class="multiselect-display">
                                <span class="subtle-text">${t('modals.unassigned')}</span>
                            </div>
                            <div class="multiselect-dropdown hidden">
                                <div class="multiselect-list">
                                ${workspaceMembers.map(user => `
                                    <label class="multiselect-list-item">
                                        <input type="checkbox" name="taskAssignees" value="${user!.id}">
                                        <div class="avatar">${getUserInitials(user)}</div>
                                        <span>${user!.name || user!.email}</span>
                                    </label>
                                `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="${formGroupClasses}">
                        <label class="${labelClasses}">${t('modals.dates')}</label>
                        <div class="grid grid-cols-2 gap-2">
                             ${renderTextInput({ id: 'taskStartDate', label: '', value: new Date().toISOString().slice(0, 10), type: 'date', containerClassName: '' })}
                             ${renderTextInput({ id: 'taskDueDate', label: '', type: 'date', containerClassName: '' })}
                        </div>
                    </div>
                     ${renderSelect({
                        id: 'taskPriority', label: t('modals.priority'), value: 'medium',
                        options: [
                            { value: '', text: t('modals.priority_none') },
                            { value: 'low', text: t('modals.priority_low') },
                            { value: 'medium', text: t('modals.priority_medium') },
                            { value: 'high', text: t('modals.priority_high') },
                        ]
                     })}
                    ${renderTextInput({ id: 'taskEstimatedHours', label: t('modals.estimated_hours'), placeholder: 'e.g., 4h, 30m, 1.5h' })}
                     ${renderSelect({
                        id: 'taskType', label: t('modals.task_type'),
                        options: [
                            { value: '', text: '--' },
                            { value: 'feature', text: t('modals.task_type_feature') },
                            { value: 'bug', text: t('modals.task_type_bug') },
                            { value: 'chore', text: t('modals.task_type_chore') },
                        ]
                     })}
                    <div class="${formGroupClasses} sm:col-span-2">
                        <label class="${labelClasses}">${t('modals.tags')}</label>
                        <div id="taskTagsSelector" class="multiselect-container" data-type="tag">
                             <div class="multiselect-display">
                                <span class="subtle-text">Select tags...</span>
                            </div>
                            <div class="multiselect-dropdown hidden">
                                <div class="multiselect-list">
                                ${workspaceTags.map(tag => `
                                    <label class="multiselect-list-item">
                                        <input type="checkbox" name="taskTags" value="${tag.id}">
                                        <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                                    </label>
                                `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        `;
        maxWidth = 'max-w-3xl';
    }

    if (state.ui.modal.type === 'addCommentToTimeLog') {
        title = t('modals.add_timelog_comment_title');
        body = AddCommentToTimeLogModal({ trackedSeconds: modalData.trackedSeconds });
        footer = `
            <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
            <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save_log')}</button>
        `;
    }

    if (state.ui.modal.type === 'addInvoice') {
        const { clientId = '', issueDate, dueDate, items = [] } = state.ui.modal.data;
        const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    
        title = t('modals.create_invoice_title');
        maxWidth = 'max-w-4xl';
        body = `
            <form id="invoiceForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${renderSelect({
                        id: 'invoiceClient', label: t('modals.client'), required: true, value: clientId,
                        options: [{value: '', text: t('modals.select_a_client')}, ...workspaceClients.map(c => ({value: c.id, text: c.name}))]
                    })}
                    ${renderTextInput({ id: 'invoiceIssueDate', label: t('modals.issue_date'), type: 'date', required: true, value: issueDate })}
                    ${renderTextInput({ id: 'invoiceDueDate', label: t('modals.due_date'), type: 'date', required: true, value: dueDate })}
                </div>
    
                <div class="pt-4 border-t border-border-color">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-semibold">${t('modals.invoice_items')}</h4>
                        <button type="button" id="generate-invoice-items-btn" class="px-3 py-1.5 text-sm font-medium flex items-center gap-1 rounded-md bg-content border border-border-color hover:bg-background" ${!clientId ? 'disabled' : ''}>
                            <span class="material-icons-sharp text-base">auto_awesome</span> ${t('modals.generate_from_time')}
                        </button>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="text-xs text-text-subtle uppercase bg-background">
                                <tr>
                                    <th class="px-3 py-2 text-left w-full">${t('modals.item_description')}</th>
                                    <th class="px-3 py-2 text-right">${t('modals.item_qty')}</th>
                                    <th class="px-3 py-2 text-right">${t('modals.item_price')}</th>
                                    <th class="px-3 py-2 text-right">${t('invoices.total_price')}</th>
                                    <th class="px-3 py-2 text-right"></th>
                                </tr>
                            </thead>
                            <tbody id="invoice-items-body">
                                ${items.map((item: any) => `
                                    <tr class="invoice-item-row" data-item-id="${item.id}">
                                        <td><input type="text" class="${formControlClasses}" data-field="description" value="${item.description}" required></td>
                                        <td><input type="number" class="${formControlClasses} text-right" data-field="quantity" value="${item.quantity}" required min="0" step="0.01"></td>
                                        <td><input type="number" class="${formControlClasses} text-right" data-field="unitPrice" value="${item.unitPrice}" required min="0" step="0.01"></td>
                                        <td class="px-3 py-2 text-right font-medium whitespace-nowrap">${formatCurrency(item.quantity * item.unitPrice, 'PLN')}</td>
                                        <td><button type="button" class="p-1 text-danger hover:bg-danger/10 rounded-full remove-invoice-item-btn"><span class="material-icons-sharp">delete</span></button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" id="add-invoice-item-btn" class="mt-2 px-3 py-1.5 text-sm font-medium flex items-center gap-1 rounded-md bg-content border border-border-color hover:bg-background">
                        <span class="material-icons-sharp text-base">add</span> ${t('modals.add_item')}
                    </button>
                </div>
    
                <div class="pt-4 border-t border-border-color flex justify-end">
                    <div class="w-full max-w-xs space-y-2">
                        <div class="flex justify-between items-center text-lg font-semibold">
                            <span>${t('modals.total')}</span>
                            <span id="invoice-total">${formatCurrency(total, 'PLN')}</span>
                        </div>
                    </div>
                </div>
            </form>
        `;
        footer = defaultFooter;
    }

    if (state.ui.modal.type === 'sendInvoiceEmail') {
        const invoice = state.invoices.find(i => i.id === modalData.invoiceId);
        const client = invoice ? state.clients.find(c => c.id === invoice.clientId) : null;
        const primaryContact = client?.contacts?.[0];
        const clientEmail = primaryContact?.email || client?.email;
        const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        const subject = t('invoices.email_template_subject').replace('{invoiceNumber}', invoice?.invoiceNumber || '').replace('{companyName}', workspace?.companyName || '');
        const bodyText = t('invoices.email_template_body').replace('{invoiceNumber}', invoice?.invoiceNumber || '').replace('{companyName}', workspace?.companyName || '');
        title = `Send Invoice ${invoice?.invoiceNumber}`;
        body = `
            <form id="send-invoice-email-form" data-invoice-id="${invoice?.id}" class="space-y-4">
                ${renderTextInput({ id: 'email-to', label: 'To:', type: 'email', value: clientEmail || '', required: true })}
                ${renderTextInput({ id: 'email-subject', label: 'Subject:', value: subject, required: true })}
                ${renderTextarea({ id: 'email-body', label: 'Body:', value: bodyText, required: true, rows: 8 })}
                <div class="flex items-center gap-2 text-sm bg-background p-2 rounded-md">
                    <span class="material-icons-sharp text-text-subtle">attachment</span>
                    <span class="font-medium">Invoice-${invoice?.invoiceNumber}.pdf</span>
                </div>
            </form>
        `;
        footer = `
            <button class="btn-close-modal">${t('modals.cancel')}</button>
            <button class="btn btn-primary" id="modal-save-btn" type="submit" form="send-invoice-email-form">${t('modals.send_email_button')}</button>
        `;
    }

    if (state.ui.modal.type === 'addWidget') {
        title = t('modals.add_widget');
        footer = `<button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>`;
        const widgetTypes: { type: DashboardWidgetType, icon: string, name: string, metric?: string }[] = [
            { type: 'kpiMetric', icon: 'payments', name: t('dashboard.kpi_total_revenue'), metric: 'totalRevenue' },
            { type: 'kpiMetric', icon: 'folder_special', name: t('dashboard.kpi_active_projects'), metric: 'activeProjects' },
            { type: 'kpiMetric', icon: 'groups', name: t('dashboard.kpi_total_clients'), metric: 'totalClients' },
            { type: 'kpiMetric', icon: 'warning', name: t('dashboard.kpi_overdue_projects'), metric: 'overdueProjects' },
            { type: 'recentProjects', icon: 'folder', name: t('dashboard.widget_recent_projects_title') },
            { type: 'todaysTasks', icon: 'checklist', name: t('dashboard.widget_todays_tasks_title') },
            { type: 'activityFeed', icon: 'history', name: t('dashboard.widget_activity_feed_title') },
            { type: 'quickActions', icon: 'bolt', name: t('dashboard.widget_quick_actions_title') },
            { type: 'timeTrackingSummary', icon: 'timer', name: t('dashboard.widget_time_tracking_summary_title') },
            { type: 'invoiceSummary', icon: 'receipt_long', name: t('dashboard.widget_invoice_summary_title') },
            { type: 'goalProgress', icon: 'track_changes', name: t('dashboard.widget_goal_progress_title') },
        ];
        body = `
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                ${widgetTypes.map(w => `
                    <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors text-center" data-add-widget-type="${w.type}" data-metric-type="${w.metric || ''}">
                        <span class="material-icons-sharp text-3xl text-primary mb-2">${w.icon}</span>
                        <span class="text-sm font-medium">${w.name}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    if (state.ui.modal.type === 'configureWidget') {
        const widget = modalData.widget as DashboardWidget;
        title = t('modals.configure_widget');
        let configBody = '';

        if (widget.type === 'todaysTasks') {
            const currentUserId = widget.config?.userId || state.currentUser?.id;
            configBody = `
                <form id="configure-widget-form" data-widget-id="${widget.id}">
                    ${renderSelect({
                        id: 'widget-user-select', label: 'Show tasks for:', value: currentUserId,
                        options: workspaceMembers.map(user => ({ value: user!.id, text: user!.name || user!.email! }))
                    })}
                </form>
            `;
        } else {
            configBody = `<p class="text-text-subtle">This widget is not configurable.</p>`;
            footer = `<button class="btn-close-modal">${t('panels.close')}</button>`;
        }
        body = configBody;
    }

    if (state.ui.modal.type === 'automations') {
        const projectId = modalData.projectId;
        const project = state.projects.find(p => p.id === projectId);
        title = t('modals.automations_title', { projectName: project?.name || 'Project' });
        maxWidth = 'max-w-4xl';
    
        const automations = state.automations.filter(a => a.projectId === projectId);
    
        body = `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h4 class="font-semibold">${t('panels.automations_title')}</h4>
                    <button id="show-add-automation-form-btn" class="btn btn-primary btn-sm">
                        <span class="material-icons-sharp text-base">add</span>
                        ${t('panels.add_automation')}
                    </button>
                </div>
    
                <div id="automations-list" class="space-y-2">
                    ${automations.length > 0 ? automations.map(auto => `
                        <div class="bg-background p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p class="font-semibold">${auto.name}</p>
                                <p class="text-xs text-text-subtle">When status changes to <strong>${t(`tasks.${auto.trigger.status}`)}</strong>, perform ${auto.actions.length} action(s).</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button class="btn-icon" data-edit-automation-id="${auto.id}" title="${t('misc.edit')}"><span class="material-icons-sharp text-base">edit</span></button>
                                <button class="btn-icon" data-delete-resource="automations" data-delete-id="${auto.id}" data-delete-confirm="Are you sure you want to delete this automation?" title="${t('modals.delete')}"><span class="material-icons-sharp text-base text-danger">delete</span></button>
                            </div>
                        </div>
                    `).join('') : `<p class="text-sm text-center text-text-subtle py-8">${t('panels.no_automations')}</p>`}
                </div>
    
                <div id="add-automation-view" class="hidden">
                    <!-- Form will be rendered here by click handler -->
                </div>
            </div>
        `;
        footer = `<button class="btn-close-modal">${t('panels.close')}</button>`;
    }

    if (state.ui.modal.type === 'taskDetail') {
        const task = state.tasks.find(t => t.id === modalData.taskId);
        title = task?.name || t('modals.task_details_title');
        body = TaskDetailModal({ taskId: modalData.taskId });
        footer = `<button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('panels.close')}</button>`;
        maxWidth = 'max-w-4xl';
    }

    if (state.ui.modal.type === 'addManualTimeLog') {
        const { selectedProjectId } = modalData;
        const filteredTasks = selectedProjectId ? state.tasks.filter(t => t.projectId === selectedProjectId && !t.isArchived) : [];

        title = t('modals.add_manual_time_log_title');
        body = `
            <form id="manualTimeLogForm" class="space-y-4">
                 <div class="${modalFormGridClasses}">
                    ${renderSelect({
                        id: 'timeLogProject', label: t('modals.project'), required: true, value: selectedProjectId,
                        options: [{value: '', text: t('modals.select_a_project')}, ...workspaceProjects.map(p => ({value: p.id, text: p.name}))]
                    })}
                     ${renderSelect({
                        id: 'timeLogTask', label: t('tasks.col_task'), required: true, disabled: !selectedProjectId,
                        options: [{value: '', text: 'Select a task'}, ...filteredTasks.map(t => ({value: t.id, text: t.name}))]
                     })}
                </div>
                <div class="${formGroupClasses}">
                    <label for="timeLogAmount" class="${labelClasses}">${t('modals.time_to_log')}</label>
                    ${renderTimePicker()}
                </div>
                <div class="grid grid-cols-2 gap-4">
                    ${renderTextInput({ id: 'timeLogDate', label: t('modals.date_worked'), type: 'date', required: true, value: new Date().toISOString().slice(0, 10) })}
                    ${renderTextInput({ id: 'timeLogStartTime', label: t('modals.start_time'), type: 'time', value: new Date().toTimeString().slice(0,5) })}
                </div>
                ${renderTextarea({ id: 'timeLogComment', label: t('modals.comment_placeholder'), rows: 2 })}
            </form>
        `;
    }

    if (state.ui.modal.type === 'assignGlobalTime') {
        title = t('modals.add_timelog_comment_title');
        const { trackedSeconds, selectedProjectId } = modalData;
        const filteredTasks = selectedProjectId ? state.tasks.filter(t => t.projectId === selectedProjectId) : [];

        body = `
            <form id="assignGlobalTimeForm" class="space-y-4">
                <div class="${formGroupClasses}">
                    <label for="global-timelog-amount" class="${labelClasses}">Time Tracked: <strong>${formatDuration(trackedSeconds)}</strong></label>
                </div>
                 <div class="${modalFormGridClasses}">
                    ${renderSelect({
                        id: 'assign-time-project-select', label: t('modals.project'), required: true, value: selectedProjectId,
                        options: [{value: '', text: t('modals.select_a_project')}, ...workspaceProjects.map(p => ({value: p.id, text: p.name}))]
                    })}
                     ${renderSelect({
                        id: 'assign-time-task-select', label: t('tasks.col_task'), required: true, disabled: !selectedProjectId,
                        options: [{value: '', text: 'Select a task'}, ...filteredTasks.map(t => ({value: t.id, text: t.name}))]
                     })}
                </div>
                ${renderTextarea({ id: 'assign-time-comment', label: t('modals.comment_placeholder'), rows: 2 })}
            </form>
        `;
    }
    
    // ... add stubs for other modals
     if (state.ui.modal.type === 'addProjectSection') {
        title = t('modals.add_project_section_title');
        body = `
            <form id="add-project-section-form" data-project-id="${modalData.projectId}">
                ${renderTextInput({ id: 'project-section-name', label: 'Section Name', required: true })}
            </form>
        `;
    }
    
    if (state.ui.modal.type === 'addReview') {
        const { employeeId } = modalData;
        const employee = state.users.find(u => u.id === employeeId);
        title = t('modals.add_review_title', { name: employee?.name || '' });
        body = `
            <form id="addReviewForm" data-employee-id="${employeeId}" class="space-y-4">
                ${renderSelect({
                    id: 'reviewRating', label: t('modals.rating'), required: true,
                    options: [1, 2, 3, 4, 5].map(n => ({ value: n.toString(), text: `${n} star${n > 1 ? 's' : ''}`}))
                })}
                ${renderTextarea({ id: 'reviewNotes', label: t('modals.review_notes'), rows: 5, required: true })}
            </form>
        `;
    }

    if (state.ui.modal.type === 'dealWon') {
        title = 'Deal Won!';
        body = `
            <p>Congratulations on winning the deal: <strong>${modalData.dealName}</strong>.</p>
            <p class="mt-4">Would you like to create a new project for this client?</p>
        `;
        footer = `
            <button class="btn-close-modal">${t('modals.cancel')}</button>
            <button class="btn btn-primary" id="create-project-from-deal-btn" data-client-id="${modalData.clientId}" data-deal-name="${modalData.dealName}">${t('modals.create_project')}</button>
        `;
    }

    return `
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" id="modal-backdrop">
            <div id="modal-content" class="bg-content rounded-lg shadow-xl w-full ${maxWidth} transition-all transform scale-95 opacity-0" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="flex justify-between items-center p-4 border-b border-border-color">
                    <h3 class="text-lg font-semibold" id="modal-title">${title}</h3>
                    <button class="p-1 rounded-full hover:bg-background btn-close-modal" aria-label="Close modal">
                        <span class="material-icons-sharp">close</span>
                    </button>
                </div>
                <div class="p-4 sm:p-6">${body}</div>
                <div class="px-4 py-3 bg-background rounded-b-lg flex justify-end items-center gap-3">
                    ${footer}
                </div>
            </div>
        </div>
    `;
}