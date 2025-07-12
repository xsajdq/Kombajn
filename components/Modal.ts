

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { InvoiceLineItem, Task, DashboardWidget, DashboardWidgetType, WikiHistory, User, CalendarEvent, Deal } from '../types.ts';
import { AddCommentToTimeLogModal } from './modals/AddCommentToTimeLogModal.ts';
import { TaskDetailModal } from './modals/TaskDetailModal.ts';
import { camelToSnake, formatDate } from '../utils.ts';

export function Modal() {
    if (!state.ui.modal.isOpen) return '';

    let title = '';
    let body = '';
    let footer = '';
    let maxWidth = '650px';
    const modalData = state.ui.modal.data || {};
    const workspaceProjects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);
    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean);
    const isOpening = state.ui.modal.justOpened;
    
    const defaultFooter = `
        <button class="btn btn-secondary btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;
    footer = defaultFooter;


    if (state.ui.modal.type === 'addClient') {
        const isEdit = !!modalData.clientId;
        const client = isEdit ? workspaceClients.find(c => c.id === modalData.clientId) : null;
        title = isEdit ? t('modals.edit_client_title') : t('modals.add_client_title');
        body = `
            <form id="clientForm">
                <input type="hidden" id="clientId" value="${client?.id || ''}">
                <div class="modal-form-grid">
                    <div class="form-group">
                        <label for="clientName">${t('modals.company_name')}</label>
                        <input type="text" id="clientName" class="form-control" required value="${client?.name || ''}">
                    </div>
                    <div class="form-group">
                        <label for="clientVatId">${t('modals.vat_id')}</label>
                        <input type="text" id="clientVatId" class="form-control" value="${client?.vatId || ''}">
                    </div>
                    <div class="form-group">
                        <label for="clientContact">${t('modals.contact_person')}</label>
                        <input type="text" id="clientContact" class="form-control" value="${client?.contactPerson || ''}">
                    </div>
                    <div class="form-group">
                        <label for="clientEmail">${t('modals.email')}</label>
                        <input type="email" id="clientEmail" class="form-control" value="${client?.email || ''}">
                    </div>
                    <div class="form-group">
                        <label for="clientPhone">${t('modals.phone')}</label>
                        <input type="tel" id="clientPhone" class="form-control" value="${client?.phone || ''}">
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addProject') {
        title = t('modals.add_project_title');
        const templates = state.projectTemplates.filter(pt => pt.workspaceId === state.activeWorkspaceId);
        body = `
            <form id="projectForm">
                 <div class="form-group">
                    <label for="projectName">${t('modals.project_name')}</label>
                    <input type="text" id="projectName" class="form-control" required>
                </div>
                <div class="modal-form-grid">
                    <div class="form-group">
                        <label for="projectClient">${t('modals.assign_to_client')}</label>
                        <select id="projectClient" class="form-control" required>
                            <option value="">${t('modals.select_a_client')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="projectTemplate">${t('modals.create_from_template')}</label>
                        <select id="projectTemplate" class="form-control">
                            <option value="">${t('modals.select_template')}</option>
                            ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="projectHourlyRate">${t('modals.hourly_rate')}</label>
                        <input type="number" id="projectHourlyRate" class="form-control" placeholder="e.g. 100" min="0" step="0.01">
                    </div>
                    <div class="form-group">
                        <label for="projectBudgetHours">Budget (hours)</label>
                        <input type="number" id="projectBudgetHours" class="form-control" placeholder="e.g. 100" min="0">
                    </div>
                </div>
                <div class="form-group" style="margin-top:1rem;">
                    <label>${t('modals.privacy')}</label>
                    <div class="form-group-inline">
                       <input type="radio" id="privacy-public" name="privacy" value="public" checked>
                       <label for="privacy-public">
                            <strong>${t('modals.privacy_public')}</strong>
                            <p class="subtle-text">${t('modals.privacy_public_desc')}</p>
                        </label>
                    </div>
                     <div class="form-group-inline">
                       <input type="radio" id="privacy-private" name="privacy" value="private">
                       <label for="privacy-private">
                            <strong>${t('modals.privacy_private')}</strong>
                            <p class="subtle-text">${t('modals.privacy_private_desc')}</p>
                       </label>
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addTask') {
        const projectIdFromPanel = modalData.projectId;

        title = t('modals.add_task_title');
        body = `
            <form id="taskForm">
                <div class="form-group full-width">
                    <label for="taskName">${t('modals.task_name')}</label>
                    <input type="text" id="taskName" class="form-control" required>
                </div>
                 <div class="form-group full-width">
                    <label for="taskDescription">${t('modals.description')}</label>
                    <textarea id="taskDescription" class="form-control" rows="3"></textarea>
                </div>
                <div class="modal-form-grid">
                    <div class="form-group">
                        <label for="taskProject">${t('modals.project')}</label>
                        <select id="taskProject" class="form-control" required>
                            <option value="">${t('modals.select_a_project')}</option>
                            ${workspaceProjects.map(p => `<option value="${p.id}" ${projectIdFromPanel === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>
                     <div class="form-group">
                        <label for="taskAssignee">${t('modals.assignee')}</label>
                        <select id="taskAssignee" class="form-control">
                            <option value="">${t('modals.unassigned')}</option>
                            ${workspaceMembers.map(u => `<option value="${u!.id}">${u!.name || u!.initials}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="taskStartDate">${t('modals.start_date')}</label>
                        <input type="date" id="taskStartDate" class="form-control" value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                    <div class="form-group">
                        <label for="taskDueDate">${t('modals.due_date')}</label>
                        <input type="date" id="taskDueDate" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="taskPriority">${t('modals.priority')}</label>
                        <select id="taskPriority" class="form-control">
                            <option value="">${t('modals.priority_none')}</option>
                            <option value="low">${t('modals.priority_low')}</option>
                            <option value="medium">${t('modals.priority_medium')}</option>
                            <option value="high">${t('modals.priority_high')}</option>
                        </select>
                    </div>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addDeal') {
        const dealStages: Deal['stage'][] = ['lead', 'contacted', 'demo', 'proposal', 'won', 'lost'];
        title = t('modals.add_deal_title');
        body = `
            <form id="dealForm">
                <div class="form-group full-width">
                    <label for="dealName">${t('modals.deal_name')}</label>
                    <input type="text" id="dealName" class="form-control" required>
                </div>
                <div class="modal-form-grid">
                     <div class="form-group">
                        <label for="dealClient">${t('modals.deal_client')}</label>
                        <select id="dealClient" class="form-control" required>
                            <option value="">${t('modals.select_a_client')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="dealValue">${t('modals.deal_value')}</label>
                        <input type="number" id="dealValue" class="form-control" required min="0" step="0.01">
                    </div>
                     <div class="form-group">
                        <label for="dealOwner">${t('modals.deal_owner')}</label>
                        <select id="dealOwner" class="form-control" required>
                            ${workspaceMembers.map(u => `<option value="${u!.id}" ${state.currentUser?.id === u!.id ? 'selected' : ''}>${u!.name || u!.initials}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="dealStage">${t('modals.deal_stage')}</label>
                        <select id="dealStage" class="form-control" required>
                            ${dealStages.map(s => `<option value="${s}">${t(`sales.stage_${s}`)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group full-width">
                    <label for="dealExpectedCloseDate">${t('modals.deal_close_date')}</label>
                    <input type="date" id="dealExpectedCloseDate" class="form-control">
                </div>
            </form>
        `;
    }
    
    if (state.ui.modal.type === 'taskDetail') {
        const task = state.tasks.find(t => t.id === modalData.taskId);
        title = task?.name || t('modals.task_details_title');
        body = TaskDetailModal({ taskId: modalData.taskId });
        footer = `<button class="btn btn-secondary btn-close-modal">${t('panels.close')}</button>`;
        maxWidth = '900px';
    }
    
    if (state.ui.modal.type === 'addCommentToTimeLog') {
        title = t('modals.add_timelog_comment_title');
        body = AddCommentToTimeLogModal({ trackedSeconds: modalData.trackedSeconds });
        footer = `
            <button class="btn btn-secondary" id="save-timelog-nocomment">${t('modals.save_without_comment')}</button>
            <button class="btn btn-primary" id="save-timelog-withcomment">${t('modals.save_log')}</button>
        `;
        maxWidth = '500px';
    }

    if (state.ui.modal.type === 'addManualTimeLog') {
        title = t('modals.add_manual_time_log_title');
        maxWidth = '500px';
        body = `
            <form id="manualTimeLogForm">
                <div class="form-group">
                    <label for="timeLogAmount">${t('modals.time_to_log')}</label>
                    <input type="text" id="timeLogAmount" class="form-control" placeholder="${t('modals.time_placeholder')}" required>
                </div>
                <div class="form-group">
                    <label for="timeLogDate">${t('modals.date_worked')}</label>
                    <input type="date" id="timeLogDate" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
                </div>
                <div class="form-group">
                    <label for="timeLogComment">${t('modals.comment_placeholder')}</label>
                    <textarea id="timeLogComment" class="form-control" rows="2"></textarea>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addInvoice') {
        title = t('modals.create_invoice_title');
        const items = modalData.items as InvoiceLineItem[] || [];
        const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const selectedClientId = modalData.clientId;
        const issueDateValue = modalData.issueDate || '';
        const dueDateValue = modalData.dueDate || '';
        maxWidth = '800px';

        body = `
            <form id="invoiceForm">
                <div class="modal-form-grid">
                    <div class="form-group">
                        <label for="invoiceClient">${t('modals.client')}</label>
                        <select id="invoiceClient" class="form-control" required>
                            <option value="">${t('modals.select_a_client')}</option>
                            ${workspaceClients.map(c => `<option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="invoiceIssueDate">${t('modals.issue_date')}</label>
                        <input type="date" id="invoiceIssueDate" class="form-control" required value="${issueDateValue}">
                    </div>
                    <div class="form-group">
                        <label for="invoiceDueDate">${t('modals.due_date')}</label>
                        <input type="date" id="invoiceDueDate" class="form-control" required value="${dueDateValue}">
                    </div>
                </div>

                ${selectedClientId ? `
                    <div style="margin: 1.5rem 0 0;">
                        <button type="button" class="btn btn-secondary" id="generate-invoice-items-btn">
                            <span class="material-icons-sharp">auto_fix_high</span>
                             ${t('modals.generate_from_time')}
                        </button>
                    </div>
                ` : ''}

                <h4 class="invoice-items-header">${t('modals.invoice_items')}</h4>
                <div class="invoice-item-editor-header">
                    <div>${t('modals.item_description')}</div>
                    <div>${t('modals.item_qty')}</div>
                    <div>${t('modals.item_price')}</div>
                    <div></div>
                </div>
                <div id="invoice-line-items-container">
                    ${items.map(item => `
                        <div class="invoice-item-editor" data-item-id="${item.id}">
                            <input type="text" class="form-control" data-field="description" value="${item.description}" placeholder="${t('modals.item_description')}">
                            <input type="number" class="form-control" data-field="quantity" value="${item.quantity}" min="0" step="0.01">
                            <input type="number" class="form-control" data-field="unitPrice" value="${item.unitPrice}" step="0.01" min="0">
                            <button type="button" class="btn-icon remove-invoice-item" title="${t('modals.remove_item')}" aria-label="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="add-invoice-item-btn">
                    <span class="material-icons-sharp">add</span> ${t('modals.add_item')}
                </button>
                <div class="invoice-totals">
                    <strong>${t('modals.total')}: ${total.toFixed(2)} PLN</strong>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'automations') {
        const workspaceAutomations = state.automations.filter(a => a.workspaceId === state.activeWorkspaceId);
        const users = state.workspaceMembers.filter(m => m.workspaceId === state.activeWorkspaceId).map(m => state.users.find(u => u.id === m.userId)!);
        const statuses: Task['status'][] = ['backlog', 'todo', 'inprogress', 'inreview', 'done'];

        title = t('modals.automations_title');
        maxWidth = '800px';
        footer = `<button class="btn btn-secondary btn-close-modal">${t('panels.close')}</button>`;
        body = `
            <div class="card">
                <h4>${t('panels.automations_title')}</h4>
                <div class="automation-list">
                    ${workspaceAutomations.length > 0 ? workspaceAutomations.map(auto => {
                        const project = workspaceProjects.find(p => p.id === auto.projectId);
                        const triggerStatus = t(`tasks.${auto.trigger.status}`);
                        const actionUser = users.find(u => u.id === auto.action.userId);
                        const actionUserName = actionUser?.name || actionUser?.initials || '';
                        return `
                            <div class="automation-list-item">
                                <span>
                                    In <strong>${project?.name || 'Unknown Project'}</strong>: When status becomes <strong>${triggerStatus}</strong>, assign to <strong>${actionUserName}</strong>.
                                </span>
                                <button class="btn-icon delete-automation-btn" data-automation-id="${auto.id}" aria-label="Remove automation"><span class="material-icons-sharp">delete</span></button>
                            </div>
                        `;
                    }).join('') : `<p class="subtle-text">${t('panels.no_automations')}</p>`}
                </div>
            </div>

            <div class="card">
                 <h4>${t('panels.add_automation')}</h4>
                <form id="add-automation-form">
                    <div class="automation-builder">
                       <div class="automation-rule">
                            <strong>${t('modals.project')}</strong>
                            <select id="automation-project" class="form-control" required>
                                 <option value="">${t('modals.select_a_project')}</option>
                                ${workspaceProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                       </div>
                       <div class="automation-rule">
                            <strong>${t('panels.when')}</strong>
                            <span>${t('panels.trigger_status_change')}</span>
                            <select id="automation-trigger-status" class="form-control">
                                ${statuses.map(s => `<option value="${s}">${t(`tasks.${s}`)}</option>`).join('')}
                            </select>
                       </div>
                        <div class="automation-rule">
                            <strong>${t('panels.then')}</strong>
                            <span>${t('panels.action_assign_user')}</span>
                            <select id="automation-action-user" class="form-control">
                                 ${users.map(u => `<option value="${u!.id}">${u!.name || u!.initials}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                     <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;">${t('panels.add_automation')}</button>
                </form>
            </div>
        `;
    }

    if (state.ui.modal.type === 'configureWidget') {
        const widget = modalData.widget as DashboardWidget;
        title = t('modals.configure_widget');
        body = `
            <form id="widgetConfigForm" data-widget-id="${widget.id}">
                ${widget.type === 'projectStatus' ? `
                    <div class="form-group">
                        <label for="widget-project-select">${t('modals.project')}</label>
                        <select id="widget-project-select" class="form-control" required>
                            <option value="">${t('modals.select_a_project')}</option>
                            ${workspaceProjects.map(p => `<option value="${p.id}" ${widget.config.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>
                ` : ''}
                <!-- Add other widget configurations here as needed -->
            </form>
        `;
    }

    if (state.ui.modal.type === 'addWidget') {
        const widgetTypes: DashboardWidgetType[] = ['myTasks', 'projectStatus', 'teamWorkload', 'recentActivity'];
        title = t('modals.add_widget');
        body = `
            <div class="item-list">
                ${widgetTypes.map(type => `
                    <div class="item-card clickable" role="button" tabindex="0" data-widget-type="${type}">
                        <span class="material-icons-sharp">widgets</span>
                        <span>${t(`dashboard.widget_${camelToSnake(type)}_title`)}</span>
                    </div>
                `).join('')}
            </div>
        `;
        footer = `<button class="btn btn-secondary btn-close-modal">${t('modals.cancel')}</button>`;
    }
    
    if (state.ui.modal.type === 'wikiHistory') {
        const history = state.wikiHistory
            .filter(h => h.projectId === modalData.projectId)
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const userMap = new Map(state.users.map(u => [u.id, u]));

        title = t('modals.wiki_history_title');
        footer = `<button class="btn btn-secondary btn-close-modal">${t('panels.close')}</button>`;
        body = `
            <ul class="wiki-history-list">
            ${history.length > 0 ? history.map(h => {
                const user = userMap.get(h.userId);
                const userName = user?.name || user?.initials || 'Unknown';
                return `
                <li class="wiki-history-item">
                    <div class="wiki-history-info">
                        <strong>${t('modals.version_from').replace('{date}', formatDate(h.createdAt, { hour: 'numeric', minute: '2-digit' })).replace('{user}', userName)}</strong>
                        <p class="subtle-text">${h.content.substring(0, 100)}...</p>
                    </div>
                    <button class="btn btn-secondary btn-sm" data-restore-wiki-version-id="${h.id}">${t('modals.restore')}</button>
                </li>
            `}).join('') : `<li class="wiki-history-item">${t('modals.no_activity')}</li>`}
            </ul>
        `;
    }

    if (state.ui.modal.type === 'employeeDetail') {
        const user = state.users.find(u => u.id === modalData.userId);
        title = t('modals.employee_detail_title');
        maxWidth = '700px';
        body = user ? `
            <form id="employeeDetailForm" data-user-id="${user.id}">
                <div class="form-group">
                    <label for="employeeName">${t('hr.member')}</label>
                    <input type="text" id="employeeName" class="form-control" value="${user.name || user.initials}" readonly>
                </div>
                <div class="form-group">
                    <label for="employeeEmail">${t('modals.email')}</label>
                    <input type="email" id="employeeEmail" class="form-control" value="${user.email || ''}" readonly>
                </div>
                <div class="form-group">
                    <label for="contractInfoNotes">${t('modals.contract_notes')}</label>
                    <textarea id="contractInfoNotes" class="form-control" rows="4">${user.contractInfoNotes || ''}</textarea>
                </div>
                 <div class="form-group">
                    <label for="employmentInfoNotes">${t('modals.employment_notes')}</label>
                    <textarea id="employmentInfoNotes" class="form-control" rows="4">${user.employmentInfoNotes || ''}</textarea>
                </div>
            </form>
        ` : `<p>User not found.</p>`;
        footer = `<button class="btn btn-secondary btn-close-modal">${t('modals.cancel')}</button>
                  <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>`;
    }

    if (state.ui.modal.type === 'addTimeOffRequest') {
        title = t('modals.add_time_off_request_title');
        maxWidth = '500px';
        body = `
            <form id="timeOffRequestForm">
                <div class="form-group">
                    <label for="leaveType">${t('modals.leave_type')}</label>
                    <select id="leaveType" class="form-control">
                        <option value="vacation">${t('modals.leave_type_vacation')}</option>
                        <option value="sick_leave">${t('modals.leave_type_sick_leave')}</option>
                        <option value="other">${t('modals.leave_type_other')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="leaveStartDate">${t('modals.start_date')}</label>
                    <input type="date" id="leaveStartDate" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="leaveEndDate">${t('modals.due_date')}</label>
                    <input type="date" id="leaveEndDate" class="form-control" required>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'rejectTimeOffRequest') {
        title = t('modals.reject_request_title');
        maxWidth = '500px';
        body = `
            <form id="rejectTimeOffForm" data-request-id="${modalData.requestId}">
                <div class="form-group">
                    <label for="rejectionReason">${t('modals.rejection_reason')}</label>
                    <textarea id="rejectionReason" class="form-control" rows="3" required></textarea>
                </div>
            </form>
        `;
    }
    
    if (state.ui.modal.type === 'addCalendarEvent') {
        title = t('team_calendar.add_event');
        maxWidth = '500px';
        body = `
            <form id="calendarEventForm">
                <div class="form-group">
                    <label for="eventTitle">${t('modals.task_name')}</label>
                    <input type="text" id="eventTitle" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="eventType">${t('modals.kr_type')}</label>
                    <select id="eventType" class="form-control">
                        <option value="event">${t('team_calendar.event')}</option>
                        <option value="on-call">${t('team_calendar.on_call')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="eventStartDate">${t('modals.start_date')}</label>
                    <input type="date" id="eventStartDate" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="eventEndDate">${t('modals.due_date')}</label>
                    <input type="date" id="eventEndDate" class="form-control" required>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'confirmPlanChange') {
        const { planId, planName } = modalData;
        title = t('billing.confirm_plan_change_title');
        maxWidth = '500px';
        body = `<p>${t('billing.confirm_plan_change_message').replace('{planName}', `<strong>${planName}</strong>`)}</p>`;
        footer = `
            <button class="btn btn-secondary btn-close-modal">${t('modals.cancel')}</button>
            <button class="btn btn-primary" id="modal-confirm-plan-change-btn" data-plan-id="${planId}">${t('billing.btn_change_plan')}</button>
        `;
    }

    if (state.ui.modal.type === 'adjustVacationAllowance') {
        const { userId, currentAllowance } = modalData;
        const user = state.users.find(u => u.id === userId);
        title = `${t('modals.adjust_vacation_title')} - ${user?.name || ''}`;
        maxWidth = '500px';
        body = `
            <form id="adjustVacationForm" data-user-id="${userId}">
                <div class="form-group">
                    <label for="vacation-allowance-hours">${t('modals.total_allowance_hours')}</label>
                    <input type="number" id="vacation-allowance-hours" class="form-control" value="${currentAllowance}" required>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addObjective') {
        title = t('modals.add_objective_title');
        body = `
            <form id="objectiveForm">
                <div class="form-group">
                    <label for="objectiveTitle">${t('modals.objective_title')}</label>
                    <input type="text" id="objectiveTitle" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="objectiveDescription">${t('modals.description')}</label>
                    <textarea id="objectiveDescription" class="form-control" rows="3"></textarea>
                </div>
            </form>
        `;
    }

    if (state.ui.modal.type === 'addKeyResult') {
        title = t('modals.add_key_result_title');
        body = `
            <form id="keyResultForm">
                <div class="form-group">
                    <label for="krTitle">${t('modals.kr_title')}</label>
                    <input type="text" id="krTitle" class="form-control" required>
                </div>
                <div class="modal-form-grid">
                    <div class="form-group">
                        <label for="krType">${t('modals.kr_type')}</label>
                        <select id="krType" class="form-control">
                            <option value="number">${t('modals.kr_type_number')}</option>
                            <option value="percentage">${t('modals.kr_type_percentage')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="krStartValue">${t('modals.kr_start')}</label>
                        <input type="number" id="krStartValue" class="form-control" value="0" required>
                    </div>
                    <div class="form-group">
                        <label for="krTargetValue">${t('modals.kr_target')}</label>
                        <input type="number" id="krTargetValue" class="form-control" required>
                    </div>
                </div>
            </form>
        `;
    }


    return `
        <div class="modal-overlay ${isOpening ? 'modal-overlay-opening' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div class="modal-content ${isOpening ? 'modal-content-opening' : ''}" style="max-width: ${maxWidth}">
                <div class="modal-header">
                    <h3 id="modal-title">${title}</h3>
                    <button class="btn-icon btn-close-modal" aria-label="${t('panels.close')}"><span class="material-icons-sharp">close</span></button>
                </div>
                <div class="modal-body">${body}</div>
                <div class="modal-footer">${footer}</div>
            </div>
        </div>
    `;
}