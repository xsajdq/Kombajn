
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { InvoiceLineItem, Task, DashboardWidget, DashboardWidgetType, WikiHistory, User, CalendarEvent, Deal, Client } from '../types.ts';
import { AddCommentToTimeLogModal } from './modals/AddCommentToTimeLogModal.ts';
import { TaskDetailModal } from './modals/TaskDetailModal.ts';
import { camelToSnake, formatCurrency, formatDate, getTaskTotalTrackedSeconds, formatDuration } from '../utils.ts';
import { can } from '../permissions.ts';
import { getWorkspaceKanbanWorkflow } from '../handlers/main.ts';

const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
const formGroupClasses = "flex flex-col gap-1.5";
const labelClasses = "text-sm font-medium text-text-subtle";
const modalFormGridClasses = "grid grid-cols-1 sm:grid-cols-2 gap-4";

function renderClientContactFormRow(contact?: any) {
    const id = contact?.id || `new-${Date.now()}`;
    return `
        <div class="grid grid-cols-[1fr,1fr,1fr,1fr,auto] gap-2 items-center" data-contact-id="${id}">
            <input type="text" class="${formControlClasses}" data-field="name" placeholder="${t('modals.contact_person')}" value="${contact?.name || ''}" required>
            <input type="email" class="${formControlClasses}" data-field="email" placeholder="${t('modals.email')}" value="${contact?.email || ''}">
            <input type="text" class="${formControlClasses}" data-field="phone" placeholder="${t('modals.phone')}" value="${contact?.phone || ''}">
            <input type="text" class="${formControlClasses}" data-field="role" placeholder="${t('modals.contact_role')}" value="${contact?.role || ''}">
            <button type="button" class="p-2 text-danger hover:bg-danger/10 rounded-full" id="remove-contact-row-btn" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
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
    const workspaceProjects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);
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
        title = t('modals.add_project_title');
        const templates = state.projectTemplates.filter(pt => pt.workspaceId === state.activeWorkspaceId);
        body = `
            <form id="projectForm" class="space-y-4">
                 <div class="${formGroupClasses}">
                    <label for="projectName" class="${labelClasses}">${t('modals.project_name')}</label>
                    <input type="text" id="projectName" class="${formControlClasses}" required>
                </div>
                <div class="${modalFormGridClasses}">
                    <div class="${formGroupClasses}">
                        <label for="projectClient" class="${labelClasses}">${t('modals.assign_to_client')}</label>
                        <select id="projectClient" class="${formControlClasses}" required>
                            <option value="">${t('modals.select_a_client')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectTemplate" class="${labelClasses}">${t('modals.create_from_template')}</label>
                        <select id="projectTemplate" class="${formControlClasses}">
                            <option value="">${t('modals.select_template')}</option>
                            ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectHourlyRate" class="${labelClasses}">${t('modals.hourly_rate')}</label>
                        <input type="number" id="projectHourlyRate" class="${formControlClasses}" placeholder="e.g. 100" min="0" step="0.01">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectBudgetHours" class="${labelClasses}">Budget (hours)</label>
                        <input type="number" id="projectBudgetHours" class="${formControlClasses}" placeholder="e.g. 100" min="0">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectBudgetCost" class="${labelClasses}">${t('modals.budget_cost')}</label>
                        <input type="number" id="projectBudgetCost" class="${formControlClasses}" placeholder="e.g. 10000" min="0">
                    </div>
                    <div class="${formGroupClasses}">
                        <label for="projectCategory" class="${labelClasses}">${t('modals.project_category')}</label>
                        <input type="text" id="projectCategory" class="${formControlClasses}" placeholder="e.g. Marketing">
                    </div>
                </div>
                
                <div class="${formGroupClasses}">
                    <label class="${labelClasses}">${t('modals.privacy')}</label>
                    <div class="grid grid-cols-2 gap-4">
                        <input type="radio" id="privacy-public" name="privacy" value="public" class="sr-only" checked>
                        <label for="privacy-public" class="flex flex-col items-center justify-center p-4 border border-border-color rounded-lg cursor-pointer transition-all has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary">
                            <span class="material-icons-sharp text-3xl mb-2">public</span>
                            <strong>${t('modals.privacy_public')}</strong>
                            <p class="text-xs text-text-subtle text-center">${t('modals.privacy_public_desc')}</p>
                        </label>
                        <input type="radio" id="privacy-private" name="privacy" value="private" class="sr-only">
                        <label for="privacy-private" class="flex flex-col items-center justify-center p-4 border border-border-color rounded-lg cursor-pointer transition-all has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary">
                            <span class="material-icons-sharp text-3xl mb-2">lock</span>
                            <strong>${t('modals.privacy_private')}</strong>
                            <p class="text-xs text-text-subtle text-center">${t('modals.privacy_private_desc')}</p>
                        </label>
                    </div>
                </div>

                <div id="project-members-section" class="form-group hidden transition-all duration-300">
                    <label class="${labelClasses}">${t('modals.invite_members')}</label>
                    <div class="max-h-40 overflow-y-auto border border-border-color rounded-lg p-2 space-y-2">
                        ${workspaceMembers.map(user => {
                            if (!user) return '';
                            const isCreator = user.id === state.currentUser?.id;
                            const initials = (user.initials || user.name?.substring(0, 2) || user.email?.substring(0, 2) || '??').toUpperCase();
                            const displayName = user.name || user.email || 'Unnamed User';

                            return `
                            <label class="flex items-center gap-2 p-1.5 rounded-md hover:bg-background">
                                <input type="checkbox" name="project_members" value="${user.id}" class="h-4 w-4 rounded text-primary focus:ring-primary" ${isCreator ? 'checked disabled' : ''}>
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

    if (state.ui.modal.type === 'addWidget') {
        title = t('modals.add_widget');
        footer = `<button class="btn-close-modal">${t('modals.cancel')}</button>`;
        const widgetTypes: { type: DashboardWidgetType, icon: string, name: string }[] = [
            { type: 'kpiMetric', icon: 'payments', name: t('dashboard.kpi_total_revenue') },
            { type: 'kpiMetric', icon: 'folder_special', name: t('dashboard.kpi_active_projects') },
            { type: 'kpiMetric', icon: 'groups', name: t('dashboard.kpi_total_clients') },
            { type: 'kpiMetric', icon: 'warning', name: t('dashboard.kpi_overdue_projects') },
            { type: 'recentProjects', icon: 'folder', name: t('dashboard.widget_recent_projects_title') },
            { type: 'todaysTasks', icon: 'checklist', name: t('dashboard.widget_todays_tasks_title') },
            { type: 'activityFeed', icon: 'history', name: t('dashboard.widget_activity_feed_title') },
            { type: 'quickActions', icon: 'bolt', name: t('dashboard.widget_quick_actions_title') },
            { type: 'schedule', icon: 'calendar_month', name: t('dashboard.widget_schedule_title') },
            { type: 'alerts', icon: 'notification_important', name: t('dashboard.widget_alerts_title') },
        ];
        body = `
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                ${widgetTypes.map(w => {
                    let metricType = '';
                    if (w.type === 'kpiMetric') {
                        if (w.name === t('dashboard.kpi_total_revenue')) metricType = 'totalRevenue';
                        if (w.name === t('dashboard.kpi_active_projects')) metricType = 'activeProjects';
                        if (w.name === t('dashboard.kpi_total_clients')) metricType = 'totalClients';
                        if (w.name === t('dashboard.kpi_overdue_projects')) metricType = 'overdueProjects';
                    }
                    return `
                    <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors text-center" data-add-widget-type="${w.type}" data-metric-type="${metricType}">
                        <span class="material-icons-sharp text-3xl text-primary mb-2">${w.icon}</span>
                        <span class="text-sm font-medium">${w.name}</span>
                    </button>
                `}).join('')}
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
        title = t('modals.automations_title');
        footer = `<button class="btn-close-modal">${t('panels.close')}</button>`;
        
        const selectedProjectId = modalData.selectedProjectId || '';
        const automations = state.automations.filter(a => a.projectId === selectedProjectId);
        const workflow = getWorkspaceKanbanWorkflow(state.activeWorkspaceId);
        const statuses = workflow === 'advanced' ? ['backlog', 'todo', 'inprogress', 'inreview', 'done'] : ['todo', 'inprogress', 'done'];
    
        body = `
            <div class="space-y-6">
                <div>
                    <label for="automation-project-selector" class="text-sm font-medium text-text-subtle block mb-1.5">${t('modals.project')}</label>
                    <select id="automation-project-selector" class="form-control">
                        <option value="">${t('modals.select_a_project')}</option>
                        ${workspaceProjects.map(p => `<option value="${p.id}" ${selectedProjectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                
                ${selectedProjectId ? `
                <div>
                    <h4 class="font-semibold mb-3">${t('panels.automations_title')}</h4>
                    <div class="bg-background rounded-lg p-3 space-y-2">
                        ${automations.length > 0 ? automations.map(auto => {
                            const user = workspaceMembers.find(u => u?.id === auto.action.userId);
                            return `
                                <div class="flex justify-between items-center p-2 rounded-md hover:bg-content">
                                    <div>
                                        <p class="text-sm"><span class="font-semibold">${t('panels.when')}</span> ${t('panels.trigger_status_change')} <span class="font-semibold">${t(`tasks.${auto.trigger.status}`)}</span></p>
                                        <p class="text-sm"><span class="font-semibold">${t('panels.then')}</span> ${t('panels.action_assign_user')} <span class="font-semibold">${user?.name || '...'}</span></p>
                                    </div>
                                    <button class="btn-icon" data-delete-automation-id="${auto.id}" title="${t('modals.remove_item')}"><span class="material-icons-sharp text-danger">delete</span></button>
                                </div>
                            `
                        }).join('') : `<p class="text-sm text-text-subtle text-center py-4">${t('panels.no_automations')}</p>`}
                    </div>
                </div>
    
                <div>
                    <h4 class="font-semibold mb-3">${t('panels.add_automation')}</h4>
                    <form id="add-automation-form" class="bg-background rounded-lg p-3 space-y-4">
                         <input type="hidden" id="automation-project" value="${selectedProjectId}">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="text-xs font-medium text-text-subtle block mb-1.5">${t('panels.when')} ${t('panels.trigger_status_change')}</label>
                                <select id="automation-trigger-status" class="form-control">
                                    ${statuses.map(s => `<option value="${s}">${t(`tasks.${s}`)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-medium text-text-subtle block mb-1.5">${t('panels.then')} ${t('panels.action_assign_user')}</label>
                                <select id="automation-action-user" class="form-control">
                                    ${workspaceMembers.map(u => u ? `<option value="${u.id}">${u.name}</option>` : '').join('')}
                                </select>
                            </div>
                        </div>
                        <div class="text-right">
                            <button type="submit" class="btn btn-primary">${t('panels.add_automation')}</button>
                        </div>
                    </form>
                </div>
                ` : ''}
            </div>
        `;
    }


    // Other modals will still work but will look unstyled until they are refactored.
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
                <p class="text-sm text-text-subtle">${t('modals.time_tracked')}: <strong class="text-base text-text-main font-semibold">${formatDuration(trackedSeconds)}</strong></p>
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