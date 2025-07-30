
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { InvoiceLineItem, Task, DashboardWidget, DashboardWidgetType, WikiHistory, User, CalendarEvent, Deal, Client, ProjectSection, Review } from '../types.ts';
import { AddCommentToTimeLogModal } from './modals/AddCommentToTimeLogModal.ts';
import { TaskDetailModal } from './modals/TaskDetailModal.ts';
import { camelToSnake, formatCurrency, formatDate, getTaskTotalTrackedSeconds, formatDuration, parseDurationStringToSeconds } from '../utils.ts';
import { can } from '../permissions.ts';
import { getWorkspaceKanbanWorkflow } from '../handlers/main.ts';

const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
const formGroupClasses = "flex flex-col gap-1.5";
const labelClasses = "text-sm font-medium text-text-subtle";
const modalFormGridClasses = "grid grid-cols-1 sm:grid-cols-2 gap-4";

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


export function Modal() {
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


    if (state.ui.modal.type === 'addClient') {
        const isEdit = !!modalData.clientId;
        const client = isEdit ? workspaceClients.find(c => c.id === modalData.clientId) : null;
        const contacts = client?.contacts || [];
        title = isEdit ? t('modals.edit_client_title') : t('modals.add_client_title');
        body = `
            <form id="clientForm" class="space-y-4">
                <input type="hidden" id="clientId" value="${client?.id || ''}">
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="clientName" class="${labelClasses}">${t('modals.company_name')}</label>
                        <input type="text" id="clientName" class="${formControlClasses}" required value="${client?.name || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="clientVatId" class="${labelClasses}">${t('modals.vat_id')}</label>
                        <input type="text" id="clientVatId" class="${formControlClasses}" value="${client?.vatId || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="clientCategory" class="${labelClasses}">${t('modals.category')}</label>
                        <input type="text" id="clientCategory" class="${formControlClasses}" value="${client?.category || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="clientHealthStatus" class="${labelClasses}">${t('modals.health_status')}</label>
                        <select id="clientHealthStatus" class="${formControlClasses}">
                            <option value="" ${!client?.healthStatus ? 'selected' : ''}>--</option>
                            <option value="good" ${client?.healthStatus === 'good' ? 'selected' : ''}>${t('modals.health_status_good')}</option>
                            <option value="at_risk" ${client?.healthStatus === 'at_risk' ? 'selected' : ''}>${t('modals.health_status_at_risk')}</option>
                            <option value="neutral" ${client?.healthStatus === 'neutral' ? 'selected' : ''}>${t('modals.health_status_neutral')}</option>
                        </select>
                    </div>
                     <div class="${formGroupClasses}">
                        <label for="clientStatus" class="${labelClasses}">${t('modals.status')}</label>
                        <select id="clientStatus" class="${formControlClasses}">
                            <option value="active" ${(!client?.status || client?.status === 'active') ? 'selected' : ''}>Active</option>
                            <option value="archived" ${client?.status === 'archived' ? 'selected' : ''}>Archived</option>
                        </select>
                    </div>
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
                 <div class="${formGroupClasses}">
                    <label for="projectName" class="${labelClasses}">${t('modals.project_name')}</label>
                    <input type="text" id="projectName" class="${formControlClasses}" required value="${project?.name || projectNameFromDeal || ''}">
                </div>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="projectClient" class="${labelClasses}">${t('modals.assign_to_client')}</label>
                        <select id="projectClient" class="${formControlClasses}" required>
                            <option value="">${t('modals.select_a_client')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}" ${project?.clientId === c.id || modalData.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectTemplate" class="${labelClasses}">${t('modals.create_from_template')}</label>
                        <select id="projectTemplate" class="${formControlClasses}" ${isEdit ? 'disabled' : ''}>
                            <option value="">${t('modals.select_template')}</option>
                            ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectHourlyRate" class="${labelClasses}">${t('modals.hourly_rate')}</label>
                        <input type="number" id="projectHourlyRate" class="${formControlClasses}" placeholder="e.g. 100" min="0" step="0.01" value="${project?.hourlyRate || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectBudgetHours" class="${labelClasses}">Budget (hours)</label>
                        <input type="number" id="projectBudgetHours" class="${formControlClasses}" placeholder="e.g. 100" min="0" value="${project?.budgetHours || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectBudgetCost" class="${labelClasses}">${t('modals.budget_cost')}</label>
                        <input type="number" id="projectBudgetCost" class="${formControlClasses}" placeholder="e.g. 10000" min="0" value="${project?.budgetCost || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectCategory" class="${labelClasses}">${t('modals.project_category')}</label>
                        <input type="text" id="projectCategory" class="${formControlClasses}" placeholder="e.g. Marketing" value="${project?.category || ''}">
                    </div>
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
                        <input type="radio" id="privacy-public" name="privacy" value="public" class="sr-only" ${project?.privacy === 'public' || !isEdit ? 'checked' : ''}>
                        <label for="privacy-public" class="flex flex-col items-center justify-center p-4 border border-border-color rounded-lg cursor-pointer transition-all has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary">
                            <span class="material-icons-sharp text-3xl mb-2">public</span>
                            <strong>${t('modals.privacy_public')}</strong>
                            <p class="text-xs text-text-subtle text-center">${t('modals.privacy_public_desc')}</p>
                        </label>
                        <input type="radio" id="privacy-private" name="privacy" value="private" class="sr-only" ${project?.privacy === 'private' ? 'checked' : ''}>
                        <label for="privacy-private" class="flex flex-col items-center justify-center p-4 border border-border-color rounded-lg cursor-pointer transition-all has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary">
                            <span class="material-icons-sharp text-3xl mb-2">lock</span>
                            <strong>${t('modals.privacy_private')}</strong>
                            <p class="text-xs text-text-subtle text-center">${t('modals.privacy_private_desc')}</p>
                        </label>
                    </div>
                </div>

                <div id="project-members-section" class="form-group ${project?.privacy !== 'private' && isEdit ? 'hidden' : ''} transition-all duration-300">
                    <label class="${labelClasses}">${t('modals.invite_members')}</label>
                    <div class="max-h-40 overflow-y-auto border border-border-color rounded-lg p-2 space-y-2">
                        ${workspaceMembers.map(user => {
                            if (!user) return '';
                            const isCreator = user.id === state.currentUser?.id;
                            const isExistingMember = isEdit && existingMemberIds.has(user.id);
                            const initials = (user.initials || user.name?.substring(0, 2) || user.email?.substring(0, 2) || '??').toUpperCase();
                            const displayName = user.name || user.email || 'Unnamed User';

                            return `
                            <label class="flex items-center gap-2 p-1.5 rounded-md hover:bg-background">
                                <input type="checkbox" name="project_members" value="${user.id}" class="h-4 w-4 rounded text-primary focus:ring-primary" ${isCreator ? 'checked disabled' : (isExistingMember ? 'checked' : '')}>
                                <div class="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">${initials}</div>
                                <span class="text-sm">${displayName} ${isCreator ? `(${t('hr.you')})` : ''}</span>
                            </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            </form>
        `;
    }

    // ... (other modal types will be refactored in subsequent steps)
    if (state.ui.modal.type === 'aiProjectPlanner') {
        title = t('modals.ai_planner_title');
        footer = `
            <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
            <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.create_project')}</button>
        `;
        body = `
            <form id="aiProjectForm" class="space-y-4">
                <div class="${formGroupClasses}">
                    <label for="aiProjectName" class="${labelClasses}">${t('modals.project_name')}</label>
                    <input type="text" id="aiProjectName" class="${formControlClasses}" required>
                </div>
                <div class="${formGroupClasses}">
                    <label for="aiProjectClient" class="${labelClasses}">${t('modals.assign_to_client')}</label>
                    <select id="aiProjectClient" class="${formControlClasses}" required>
                        <option value="">${t('modals.select_a_client')}</option>
                        ${workspaceClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="${formGroupClasses}">
                    <label for="aiProjectGoal" class="${labelClasses}">${t('modals.ai_planner_goal_label')}</label>
                    <textarea id="aiProjectGoal" class="${formControlClasses}" rows="4" placeholder="${t('modals.ai_planner_goal_placeholder')}" required></textarea>
                </div>
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
                <div class="${formGroupClasses}">
                    <label for="taskName" class="${labelClasses}">${t('modals.task_name')}</label>
                    <input type="text" id="taskName" class="${formControlClasses}" required>
                </div>
                <div class="${formGroupClasses}">
                    <label for="taskDescription" class="${labelClasses}">${t('modals.description')}</label>
                    <textarea id="taskDescription" class="${formControlClasses}" rows="3"></textarea>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    <div class="${formGroupClasses}">
                        <label for="taskProject" class="${labelClasses}">${t('modals.project')}</label>
                        <select id="taskProject" class="${formControlClasses}" required>
                            <option value="">${t('modals.select_a_project')}</option>
                            ${workspaceProjects.map(p => `<option value="${p.id}" ${projectIdFromPanel === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>
                     <div class="${formGroupClasses} ${projectSectionsForSelectedProject.length > 0 ? '' : 'hidden'}" id="project-section-group">
                        <label for="projectSection" class="${labelClasses}">${t('modals.project_section')}</label>
                        <select id="projectSection" class="${formControlClasses}">
                            <option value="">${t('tasks.default_board')}</option>
                            ${projectSectionsForSelectedProject.map((ps: ProjectSection) => `<option value="${ps.id}">${ps.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="taskView" class="${labelClasses}">${t('modals.task_view')}</label>
                        <select id="taskView" class="${formControlClasses}">
                            <option value="">-- No View --</option>
                            ${taskViews.map(tv => `<option value="${tv.id}">${tv.name}</option>`).join('')}
                        </select>
                    </div>
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
                                        <div class="avatar">${user!.initials || '?'}</div>
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
                             <input type="date" id="taskStartDate" class="${formControlClasses}" value="${new Date().toISOString().slice(0, 10)}" title="${t('modals.start_date')}">
                             <input type="date" id="taskDueDate" class="${formControlClasses}" title="${t('modals.due_date')}">
                        </div>
                    </div>
                     <div class="${formGroupClasses}">
                        <label for="taskPriority" class="${labelClasses}">${t('modals.priority')}</label>
                        <select id="taskPriority" class="${formControlClasses}">
                            <option value="">${t('modals.priority_none')}</option>
                            <option value="low">${t('modals.priority_low')}</option>
                            <option value="medium" selected>${t('modals.priority_medium')}</option>
                            <option value="high">${t('modals.priority_high')}</option>
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="taskEstimatedHours" class="${labelClasses}">${t('modals.estimated_hours')}</label>
                        <input type="text" id="taskEstimatedHours" class="${formControlClasses}" placeholder="e.g., 4h, 30m, 1.5h">
                    </div>
                     <div class="${formGroupClasses}">
                        <label for="taskType" class="${labelClasses}">${t('modals.task_type')}</label>
                        <select id="taskType" class="${formControlClasses}">
                            <option value="">--</option>
                            <option value="feature">${t('modals.task_type_feature')}</option>
                            <option value="bug">${t('modals.task_type_bug')}</option>
                            <option value="chore">${t('modals.task_type_chore')}</option>
                        </select>
                    </div>
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
                    <div class="${formGroupClasses}">
                        <label for="invoiceClient" class="${labelClasses}">${t('modals.client')}</label>
                        <select id="invoiceClient" class="${formControlClasses}" required>
                            <option value="">${t('modals.select_a_client')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}" ${clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="invoiceIssueDate" class="${labelClasses}">${t('modals.issue_date')}</label>
                        <input type="date" id="invoiceIssueDate" class="${formControlClasses}" value="${issueDate}" required>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="invoiceDueDate" class="${labelClasses}">${t('modals.due_date')}</label>
                        <input type="date" id="invoiceDueDate" class="${formControlClasses}" value="${dueDate}" required>
                    </div>
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
        const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        const subject = t('invoices.email_template_subject').replace('{invoiceNumber}', invoice?.invoiceNumber || '').replace('{companyName}', workspace?.companyName || '');
        const bodyText = t('invoices.email_template_body').replace('{invoiceNumber}', invoice?.invoiceNumber || '').replace('{companyName}', workspace?.companyName || '');
        title = `Send Invoice ${invoice?.invoiceNumber}`;
        body = `
            <form id="send-invoice-email-form" data-invoice-id="${invoice?.id}" class="space-y-4">
                <div class="${formGroupClasses}">
                    <label for="email-to" class="${labelClasses}">To:</label>
                    <input type="email" id="email-to" class="${formControlClasses}" value="${client?.email || ''}" required>
                </div>
                <div class="${formGroupClasses}">
                    <label for="email-subject" class="${labelClasses}">Subject:</label>
                    <input type="text" id="email-subject" class="${formControlClasses}" value="${subject}" required>
                </div>
                <div class="${formGroupClasses}">
                    <label for="email-body" class="${labelClasses}">Body:</label>
                    <textarea id="email-body" class="${formControlClasses}" rows="8" required>${bodyText}</textarea>
                </div>
                <div class="flex items-center gap-2 text-sm bg-background p-2 rounded-md">
                    <span class="material-icons-sharp text-text-subtle">attachment</span>
                    <span class="font-medium">Invoice-${invoice?.invoiceNumber}.pdf</span>
                </div>
            </form>
        `;
        footer = `
            <button class="btn-close-modal">${t('modals.cancel')}</button>
            <button class="btn btn-primary" id="modal-save-btn" type="submit" form="send-invoice-email-form">Send Email</button>
        `;
    }

    if (state.ui.modal.type === 'addWidget') {
        title = t('modals.add_widget');
        footer = `<button class="btn-close-modal">${t('modals.cancel')}</button>`;
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
                    <div class="${formGroupClasses}">
                        <label for="widget-user-select" class="${labelClasses}">Show tasks for:</label>
                        <select id="widget-user-select" name="userId" class="${formControlClasses}">
                            ${workspaceMembers.map(user => `<option value="${user!.id}" ${currentUserId === user!.id ? 'selected' : ''}>${user!.name || user!.email}</option>`).join('')}
                        </select>
                    </div>
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
                                <button class="btn-icon" data-delete-automation-id="${auto.id}" title="${t('modals.delete')}"><span class="material-icons-sharp text-base text-danger">delete</span></button>
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
        title = t('modals.add_manual_time_log_title');
        body = `
            <form id="manualTimeLogForm" class="space-y-4">
                <div class="${formGroupClasses}">
                    <label for="timeLogAmount" class="${labelClasses}">${t('modals.time_to_log')}</label>
                    <input type="text" id="timeLogAmount" class="${formControlClasses}" required placeholder="${t('modals.time_placeholder')}">
                </div>
                <div class="${formGroupClasses}">
                    <label for="timeLogDate" class="${labelClasses}">${t('modals.date_worked')}</label>
                    <input type="date" id="timeLogDate" class="${formControlClasses}" required value="${new Date().toISOString().slice(0, 10)}">
                </div>
                <div class="${formGroupClasses}">
                    <label for="timeLogComment" class="${labelClasses}">${t('modals.comment_placeholder')}</label>
                    <textarea id="timeLogComment" class="${formControlClasses}" rows="2"></textarea>
                </div>
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
                    <label for="global-timelog-amount" class="${labelClasses}">${t('modals.time_to_log')}</label>
                    <input type="text" id="global-timelog-amount" class="${formControlClasses}" value="${formatDuration(trackedSeconds)}" placeholder="${t('modals.time_placeholder')}" required>
                </div>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="assign-time-project-select" class="${labelClasses}">${t('modals.project')}</label>
                        <select id="assign-time-project-select" class="${formControlClasses}" required>
                            <option value="">${t('modals.select_a_project')}</option>
                            ${workspaceProjects.map(p => `<option value="${p.id}" ${selectedProjectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="assign-time-task-select" class="${labelClasses}">${t('tasks.col_task')}</label>
                        <select id="assign-time-task-select" class="${formControlClasses}" required ${!selectedProjectId ? 'disabled' : ''}>
                            <option value="">Select a task</option>
                            ${filteredTasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="${formGroupClasses}">
                    <label for="global-timelog-comment" class="${labelClasses}">${t('modals.comment_placeholder')}</label>
                    <textarea id="global-timelog-comment" class="${formControlClasses}" rows="3"></textarea>
                </div>
            </form>
        `;
    }
    
    if (state.ui.modal.type === 'addTimeOffRequest') {
        title = t('modals.add_time_off_request_title');
        body = `
            <form id="timeOffRequestForm" class="space-y-4">
                <div class="${formGroupClasses}">
                    <label for="leaveType" class="${labelClasses}">${t('modals.leave_type')}</label>
                    <select id="leaveType" class="${formControlClasses}">
                        <option value="vacation">${t('modals.leave_type_vacation')}</option>
                        <option value="sick_leave">${t('modals.leave_type_sick_leave')}</option>
                        <option value="other">${t('modals.leave_type_other')}</option>
                    </select>
                </div>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="leaveStartDate" class="${labelClasses}">${t('modals.start_date')}</label>
                        <input type="date" id="leaveStartDate" class="${formControlClasses}" required value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="leaveEndDate" class="${labelClasses}">${t('modals.due_date')}</label>
                        <input type="date" id="leaveEndDate" class="${formControlClasses}" required value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addReview') {
        const employeeId = modalData.employeeId as string;
        const employee = state.users.find(u => u.id === employeeId);
        title = t('modals.add_review_title');
        body = `
            <form id="addReviewForm" class="space-y-4" data-employee-id="${employeeId}">
                <p class="font-medium">${t('modals.review_for', {name: employee?.name || 'Employee'})}</p>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="reviewDate" class="${labelClasses}">${t('reports.col_date')}</label>
                        <input type="date" id="reviewDate" class="${formControlClasses}" required value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="reviewRating" class="${labelClasses}">${t('modals.rating')}</label>
                        <input type="number" id="reviewRating" class="${formControlClasses}" required min="1" max="5" value="3">
                    </div>
                </div>
                <div class="${formGroupClasses}">
                    <label for="reviewNotes" class="${labelClasses}">${t('modals.review_notes')}</label>
                    <textarea id="reviewNotes" class="${formControlClasses}" rows="5" required></textarea>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addCalendarEvent') {
        title = t('team_calendar.add_event');
        body = `
            <form id="calendarEventForm" class="space-y-4">
                <div class="${formGroupClasses}">
                    <label for="eventTitle" class="${labelClasses}">${t('modals.task_name')}</label>
                    <input type="text" id="eventTitle" class="${formControlClasses}" required>
                </div>
                <div class="${formGroupClasses}">
                    <label for="eventType" class="${labelClasses}">${t('modals.task_type')}</label>
                    <select id="eventType" class="${formControlClasses}">
                        <option value="event">${t('team_calendar.event')}</option>
                        <option value="on-call">${t('team_calendar.on_call')}</option>
                    </select>
                </div>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="eventStartDate" class="${labelClasses}">${t('modals.start_date')}</label>
                        <input type="date" id="eventStartDate" class="${formControlClasses}" required value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="eventEndDate" class="${labelClasses}">${t('modals.due_date')}</label>
                        <input type="date" id="eventEndDate" class="${formControlClasses}" required value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addObjective') {
        title = t('modals.add_objective_title');
        body = `
            <form id="addObjectiveForm" class="space-y-4" data-project-id="${modalData.projectId}">
                <div class="${formGroupClasses}">
                    <label for="objectiveTitle" class="${labelClasses}">${t('modals.objective_title')}</label>
                    <input type="text" id="objectiveTitle" class="${formControlClasses}" required>
                </div>
                <div class="${formGroupClasses}">
                    <label for="objectiveDescription" class="${labelClasses}">${t('modals.description')}</label>
                    <textarea id="objectiveDescription" class="${formControlClasses}" rows="3"></textarea>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addKeyResult') {
        title = t('modals.add_key_result_title');
        body = `
            <form id="addKeyResultForm" class="space-y-4" data-objective-id="${modalData.objectiveId}">
                <div class="${formGroupClasses}">
                    <label for="krTitle" class="${labelClasses}">${t('modals.kr_title')}</label>
                    <input type="text" id="krTitle" class="${formControlClasses}" required>
                </div>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="krType" class="${labelClasses}">${t('modals.kr_type')}</label>
                        <select id="krType" class="${formControlClasses}">
                            <option value="number">${t('modals.kr_type_number')}</option>
                            <option value="percentage">${t('modals.kr_type_percentage')}</option>
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="krStartValue" class="${labelClasses}">${t('modals.kr_start')}</label>
                        <input type="number" id="krStartValue" class="${formControlClasses}" value="0" required>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="krTargetValue" class="${labelClasses}">${t('modals.kr_target')}</label>
                        <input type="number" id="krTargetValue" class="${formControlClasses}" required>
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addProjectSection') {
        title = t('modals.add_project_section_title');
        body = `
            <form id="addProjectSectionForm" data-project-id="${modalData.projectId}">
                <div class="${formGroupClasses}">
                    <label for="projectSectionName" class="${labelClasses}">${t('modals.project_section')}</label>
                    <input type="text" id="projectSectionName" class="${formControlClasses}" required>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addDeal') {
        const isEdit = !!modalData.dealId;
        const deal = isEdit ? state.deals.find(d => d.id === modalData.dealId) : null;
        title = isEdit ? t('modals.edit_deal_title') : t('modals.add_deal_title');
        const stages = state.pipelineStages.filter(s => s.workspaceId === state.activeWorkspaceId && s.category === 'open').sort((a, b) => a.sortOrder - b.sortOrder);
        body = `
            <form id="dealForm" class="space-y-4">
                <input type="hidden" id="dealId" value="${deal?.id || ''}">
                <div class="${formGroupClasses}">
                    <label for="dealName" class="${labelClasses}">${t('modals.deal_name')}</label>
                    <input type="text" id="dealName" class="${formControlClasses}" required value="${deal?.name || ''}">
                </div>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="dealClient" class="${labelClasses}">${t('modals.deal_client')}</label>
                        <select id="dealClient" class="${formControlClasses}" required>
                            <option value="">${t('modals.select_a_client')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}" ${deal?.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="dealValue" class="${labelClasses}">${t('modals.deal_value')}</label>
                        <input type="number" id="dealValue" class="${formControlClasses}" required value="${deal?.value || ''}" min="0">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="dealOwner" class="${labelClasses}">${t('modals.deal_owner')}</label>
                        <select id="dealOwner" class="${formControlClasses}" required>
                            ${workspaceMembers.map(u => u ? `<option value="${u.id}" ${deal?.ownerId === u.id ? 'selected' : ''}>${u.name || u.initials}</option>` : '').join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="dealStage" class="${labelClasses}">${t('modals.deal_stage')}</label>
                        <select id="dealStage" class="${formControlClasses}" required>
                            ${stages.map(s => `<option value="${s.id}" ${deal?.stageId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses} sm:col-span-2">
                        <label for="dealExpectedCloseDate" class="${labelClasses}">${t('modals.deal_close_date')}</label>
                        <input type="date" id="dealExpectedCloseDate" class="${formControlClasses}" value="${deal?.expectedCloseDate || ''}">
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'dealWon') {
        const { dealName, clientId } = modalData;
        maxWidth = 'max-w-md';
        title = `Deal "${dealName}" Won!`;
        body = `<p class="text-text-subtle">Congratulations! What would you like to do next?</p>`;
        footer = `
            <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">Not Now</button>
            <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="create-project-from-deal-btn" data-client-id="${clientId}" data-deal-name="${dealName}">${t('dashboard.action_new_project')}</button>
        `;
    }

    if (state.ui.modal.type === 'addExpense') {
        title = t('modals.add_expense_title');
        body = `
            <form id="addExpenseForm" class="space-y-4">
                <div class="${formGroupClasses}">
                    <label for="expenseDescription" class="${labelClasses}">${t('modals.expense_description')}</label>
                    <input type="text" id="expenseDescription" class="${formControlClasses}" required>
                </div>
                 <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="expenseProject" class="${labelClasses}">${t('budget.modal_expense_project')}</label>
                        <select id="expenseProject" class="${formControlClasses}">
                            <option value="">-- ${t('misc.no_project')} --</option>
                            ${workspaceProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="expenseCategory" class="${labelClasses}">${t('budget.modal_expense_category')}</label>
                        <input type="text" id="expenseCategory" class="${formControlClasses}" required list="expense-categories">
                        <datalist id="expense-categories">
                            ${[...new Set(state.expenses.map(e => e.category).filter(Boolean))].map(c => `<option value="${c}"></option>`).join('')}
                        </datalist>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="expenseAmount" class="${labelClasses}">${t('modals.expense_amount')}</label>
                        <input type="number" id="expenseAmount" class="${formControlClasses}" required min="0" step="0.01">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="expenseDate" class="${labelClasses}">${t('modals.expense_date')}</label>
                        <input type="date" id="expenseDate" class="${formControlClasses}" required value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'setBudgets') {
        const period = modalData.period as string;
        const existingBudgets = state.budgets.filter(b => b.period === period);
        const categories = [...new Set([...existingBudgets.map(b => b.category), ...state.expenses.map(e => e.category).filter(Boolean)])];

        title = t('budget.modal_set_budgets_title');
        maxWidth = 'max-w-xl';
        body = `
            <form id="setBudgetsForm" class="space-y-4" data-period="${period}">
                <p class="text-sm text-text-subtle">Set your spending limits for ${formatDate(period, { year: 'numeric', month: 'long' })}.</p>
                <div id="budget-items-container" class="space-y-2 max-h-96 overflow-y-auto">
                    ${(categories.length > 0 ? categories : ['']).map(cat => {
                        const budget = existingBudgets.find(b => b.category === cat);
                        return `
                            <div class="grid grid-cols-[2fr,1fr,auto] gap-2 items-center budget-item-row">
                                <input type="text" class="${formControlClasses}" name="category" placeholder="${t('budget.modal_category')}" value="${cat}" required>
                                <input type="number" class="${formControlClasses}" name="amount" placeholder="${t('budget.modal_amount')}" value="${budget?.amount || ''}" min="0" step="0.01" required>
                                <button type="button" class="p-2 text-danger hover:bg-danger/10 rounded-full remove-budget-row-btn"><span class="material-icons-sharp">delete</span></button>
                            </div>
                        `;
                    }).join('')}
                </div>
                <button type="button" id="add-budget-category-btn" class="btn btn-secondary btn-sm">
                    <span class="material-icons-sharp text-base">add</span> ${t('budget.modal_add_category')}
                </button>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addGoal') {
        title = t('modals.add_goal_title');
        maxWidth = 'max-w-3xl';
        body = `
            <form id="addGoalForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="${formGroupClasses} md:col-span-2">
                        <label for="goalTitle" class="${labelClasses}">${t('modals.goal_title')}</label>
                        <input type="text" id="goalTitle" class="${formControlClasses}" required>
                    </div>
                    <div class="${formGroupClasses} md:col-span-2">
                        <label for="goalDescription" class="${labelClasses}">${t('modals.goal_description')}</label>
                        <textarea id="goalDescription" rows="2" class="${formControlClasses}"></textarea>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="goalOwner" class="${labelClasses}">${t('modals.goal_owner')}</label>
                        <select id="goalOwner" class="${formControlClasses}">
                            <option value="">${t('modals.unassigned')}</option>
                            ${workspaceMembers.map(u => `<option value="${u!.id}">${u!.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="goalDueDate" class="${labelClasses}">${t('modals.goal_due_date')}</label>
                        <input type="date" id="goalDueDate" class="${formControlClasses}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="goalCategory" class="${labelClasses}">${t('modals.goal_category')}</label>
                        <input type="text" id="goalCategory" class="${formControlClasses}" list="goal-categories">
                        <datalist id="goal-categories">
                             ${[...new Set(state.objectives.map(o => o.category).filter(Boolean))].map(c => `<option value="${c}"></option>`).join('')}
                        </datalist>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="goalPriority" class="${labelClasses}">${t('modals.goal_priority')}</label>
                        <select id="goalPriority" class="${formControlClasses}">
                             <option value="medium">${t('modals.priority_medium')}</option>
                             <option value="high">${t('modals.priority_high')}</option>
                             <option value="low">${t('modals.priority_low')}</option>
                        </select>
                    </div>
                     <div class="${formGroupClasses}">
                        <label for="goalStatus" class="${labelClasses}">${t('modals.goal_status')}</label>
                        <select id="goalStatus" class="${formControlClasses}">
                             <option value="in_progress">${t('goals.status_in_progress')}</option>
                             <option value="completed">${t('goals.status_completed')}</option>
                             <option value="on_hold">${t('goals.status_on_hold')}</option>
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="goalTargetValue" class="${labelClasses}">${t('modals.goal_target_value')}</label>
                        <input type="number" id="goalTargetValue" class="${formControlClasses}" min="0">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="goalCurrentValue" class="${labelClasses}">${t('modals.goal_current_value')}</label>
                        <input type="number" id="goalCurrentValue" class="${formControlClasses}" value="0" min="0">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="goalValueUnit" class="${labelClasses}">${t('modals.goal_value_unit')}</label>
                        <input type="text" id="goalValueUnit" class="${formControlClasses}" placeholder="e.g., $, %, projects, milestones">
                    </div>
                </div>
                <div class="pt-4 border-t border-border-color">
                    <h4 class="font-semibold text-md mb-2">${t('goals.milestones')}</h4>
                    <div id="milestones-container" class="space-y-2"></div>
                    <div class="flex items-center gap-2">
                        <input type="text" id="new-milestone-input" class="${formControlClasses}" placeholder="${t('modals.add_milestone')}">
                        <button type="button" id="add-milestone-btn" class="btn btn-secondary">Add</button>
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addInventoryItem') {
        const isEdit = !!modalData.itemId;
        const item = isEdit ? state.inventoryItems.find(i => i.id === modalData.itemId) : null;
        title = isEdit ? t('inventory.edit_item_title') : t('inventory.add_item_title');
        body = `
            <form id="inventoryItemForm" class="space-y-4" data-item-id="${item?.id || ''}">
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses} sm:col-span-2">
                        <label for="itemName" class="${labelClasses}">${t('inventory.item_name')}</label>
                        <input type="text" id="itemName" class="${formControlClasses}" value="${item?.name || ''}" required>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="itemCategory" class="${labelClasses}">${t('inventory.item_category')}</label>
                        <input type="text" id="itemCategory" class="${formControlClasses}" value="${item?.category || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="itemSku" class="${labelClasses}">${t('inventory.item_sku')}</label>
                        <input type="text" id="itemSku" class="${formControlClasses}" value="${item?.sku || ''}">
                    </div>
                     <div class="${formGroupClasses} sm:col-span-2">
                        <label for="itemLocation" class="${labelClasses}">${t('inventory.item_location')}</label>
                        <input type="text" id="itemLocation" class="${formControlClasses}" value="${item?.location || ''}">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="itemCurrentStock" class="${labelClasses}">${t('inventory.item_current_stock')}</label>
                        <input type="number" id="itemCurrentStock" class="${formControlClasses}" value="${item?.currentStock ?? ''}" required>
                    </div>
                     <div class="${formGroupClasses}">
                        <label for="itemTargetStock" class="${labelClasses}">${t('inventory.item_target_stock')}</label>
                        <input type="number" id="itemTargetStock" class="${formControlClasses}" value="${item?.targetStock ?? ''}" required>
                    </div>
                     <div class="${formGroupClasses}">
                        <label for="itemLowStockThreshold" class="${labelClasses}">${t('inventory.item_low_stock_threshold')}</label>
                        <input type="number" id="itemLowStockThreshold" class="${formControlClasses}" value="${item?.lowStockThreshold ?? ''}" required>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="itemUnitPrice" class="${labelClasses}">${t('inventory.item_unit_price')}</label>
                        <input type="number" id="itemUnitPrice" class="${formControlClasses}" value="${item?.unitPrice ?? ''}" required step="0.01">
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'assignInventoryItem') {
        const item = state.inventoryItems.find(i => i.id === modalData.itemId);
        title = t('inventory.assign_item_title');
        body = item ? `
            <form id="assignInventoryItemForm" class="space-y-4" data-item-id="${item.id}">
                <p>${t('inventory.col_item')}: <strong>${item.name}</strong></p>
                <div class="${formGroupClasses}">
                    <label for="employeeId" class="${labelClasses}">${t('inventory.assign_to_employee')}</label>
                    <select id="employeeId" class="${formControlClasses}" required>
                        <option value="">${t('inventory.select_employee')}</option>
                        ${workspaceMembers.map(u => `<option value="${u!.id}">${u!.name}</option>`).join('')}
                    </select>
                </div>
                <div class="${formGroupClasses}">
                    <label for="assignmentDate" class="${labelClasses}">${t('inventory.assignment_date')}</label>
                    <input type="date" id="assignmentDate" class="${formControlClasses}" value="${new Date().toISOString().slice(0,10)}" required>
                </div>
                <div class="${formGroupClasses}">
                    <label for="serialNumber" class="${labelClasses}">${t('inventory.serial_number')}</label>
                    <input type="text" id="serialNumber" class="${formControlClasses}">
                </div>
                <div class="${formGroupClasses}">
                    <label for="notes" class="${labelClasses}">${t('inventory.notes')}</label>
                    <textarea id="notes" class="${formControlClasses}" rows="3"></textarea>
                </div>
            </form>
        ` : 'Item not found.';
    }


    return `
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div class="bg-content rounded-lg shadow-xl w-full flex flex-col max-h-[90vh] ${maxWidth}">
                <div class="flex justify-between items-center p-4 border-b border-border-color shrink-0">
                    <h3 id="modal-title" class="text-lg font-semibold">${title}</h3>
                    <button class="p-1 rounded-full text-text-subtle hover:bg-background btn-close-modal" aria-label="${t('panels.close')}"><span class="material-icons-sharp">close</span></button>
                </div>
                <div class="p-4 sm:p-6 overflow-y-auto">${body}</div>
                <div class="flex justify-end items-center gap-3 p-4 border-t border-border-color bg-background/50 rounded-b-lg shrink-0">${footer}</div>
            </div>
        </div>
    `;
}
