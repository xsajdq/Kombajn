

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { generateInvoicePDF } from '../services.ts';
import type { InvoiceLineItem, Role, PlanId, User, DashboardWidgetType, ClientContact } from '../types.ts';
import { t } from '../i18n.ts';
import * as aiHandlers from '../handlers/ai.ts';
import * as billingHandlers from '../handlers/billing.ts';
import * as formHandlers from '../handlers/form.ts';
import * as invoiceHandlers from '../handlers/invoices.ts';
import * as mainHandlers from '../handlers/main.ts';
import * as notificationHandlers from '../handlers/notifications.ts';
import * as reportHandlers from '../handlers/reports.ts';
import * as taskHandlers from '../handlers/tasks.ts';
import * as teamHandlers from '../handlers/team.ts';
import * as timerHandlers from '../handlers/timers.ts';
import * as uiHandlers from '../handlers/ui.ts';
import * as wikiHandlers from '../handlers/wiki.ts';
import * as automationHandlers from '../handlers/automations.ts';
import * as dashboardHandlers from '../handlers/dashboard.ts';
import * as auth from '../services/auth.ts';
import { renderLoginForm, renderRegisterForm } from '../pages/AuthPage.ts';
import * as onboardingHandlers from '../handlers/onboarding.ts';
import * as okrHandlers from '../handlers/okr.ts';
import { handleInsertMention } from './mentions.ts';
import * as integrationHandlers from '../handlers/integrations.ts';
import { TaskDetailModal } from '../components/modals/TaskDetailModal.ts';

function renderClientContactFormRow(contact?: any) {
    const id = contact?.id || `new-${Date.now()}`;
    return `
        <div class="contact-form-row" data-contact-id="${id}">
            <input type="text" class="form-control" data-field="name" placeholder="${t('modals.contact_person')}" value="${contact?.name || ''}" required>
            <input type="email" class="form-control" data-field="email" placeholder="${t('modals.email')}" value="${contact?.email || ''}">
            <input type="text" class="form-control" data-field="phone" placeholder="${t('modals.phone')}" value="${contact?.phone || ''}">
            <input type="text" class="form-control" data-field="role" placeholder="${t('modals.contact_role')}" value="${contact?.role || ''}">
            <button type="button" class="btn-icon remove-contact-row-btn" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
        </div>
    `;
}

export async function handleClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const target = e.target as Element;

    // Client Modal: Add/Remove Contact Rows
    const addContactBtn = target.closest('#add-contact-row-btn');
    if (addContactBtn) {
        const container = document.getElementById('client-contacts-container');
        if (container) {
            const newRowHtml = renderClientContactFormRow();
            container.insertAdjacentHTML('beforeend', newRowHtml);
        }
        return;
    }
    const removeContactBtn = target.closest('.remove-contact-row-btn');
    if (removeContactBtn) {
        const row = removeContactBtn.closest('.contact-form-row') as HTMLElement;
        if (row) {
            const contactId = row.dataset.contactId;
            if (contactId && !contactId.startsWith('new-')) {
                const hiddenInput = document.getElementById('deleted-contact-ids') as HTMLInputElement;
                hiddenInput.value = hiddenInput.value ? `${hiddenInput.value},${contactId}` : contactId;
            }
            row.remove();
        }
        return;
    }


    // Handle multiselect dropdowns
    const multiselectDisplay = target.closest<HTMLElement>('.multiselect-display');
    if (multiselectDisplay) {
        const dropdown = multiselectDisplay.nextElementSibling;
        dropdown?.classList.toggle('hidden');
    } else if (!target.closest('.multiselect-container')) {
        // Close all dropdowns if clicking outside
        document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.add('hidden'));
    }

    // Handle Tags Filter Dropdown
    const tagsFilterToggle = target.closest('#task-filter-tags-toggle');
    if (tagsFilterToggle) {
        const dropdown = document.getElementById('task-filter-tags-dropdown');
        dropdown?.classList.toggle('hidden');
        return;
    }
    const tagsFilterItem = target.closest('.multiselect-dropdown-item');
    if (tagsFilterItem && target.closest('#task-filter-tags-dropdown')) {
        const checkbox = tagsFilterItem.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox && e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
        }
        const tagId = checkbox.value;
        const selectedTagIds = new Set(state.ui.taskFilters.tagIds);
        if (checkbox.checked) {
            selectedTagIds.add(tagId);
        } else {
            selectedTagIds.delete(tagId);
        }
        state.ui.taskFilters.tagIds = Array.from(selectedTagIds);
        renderApp();
        // Do not return, let other logic handle closing if needed.
    } else if (!target.closest('#task-filter-tags-container')) {
        document.getElementById('task-filter-tags-dropdown')?.classList.add('hidden');
    }

    // Onboarding
    if (target.closest('.onboarding-next-btn')) { onboardingHandlers.nextStep(); return; }
    if (target.closest('.onboarding-skip-btn')) { onboardingHandlers.finishOnboarding(); return; }

    // Auth Page
    const authTab = target.closest<HTMLElement>('.auth-tab');
    if (authTab) {
        const tabName = authTab.dataset.authTab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        authTab.classList.add('active');
        const container = document.getElementById('auth-form-container')!;
        if (tabName === 'login') container.innerHTML = renderLoginForm();
        else container.innerHTML = renderRegisterForm();
        return;
    }
    
    if (target.closest<HTMLElement>('[data-logout-button]')) { auth.logout(); return; }

    // Close popovers if click is outside
    if (!target.closest('.notification-wrapper') && state.ui.isNotificationsOpen) { notificationHandlers.toggleNotificationsPopover(false); }
    if (!target.closest('.command-palette') && state.ui.isCommandPaletteOpen) { uiHandlers.toggleCommandPalette(false); }
    if (!target.closest('.project-header-menu-container') && document.querySelector('.project-header-menu')) { mainHandlers.closeProjectMenu(); }

    const navLink = target.closest('a');
    if (navLink && navLink.pathname !== window.location.pathname) {
        e.preventDefault();
        history.pushState({}, '', navLink.href);
        renderApp();
        return;
    }
    
    // Copy link button
    const copyLinkBtn = target.closest<HTMLElement>('[data-copy-link]');
    if (copyLinkBtn) {
        const path = copyLinkBtn.dataset.copyLink;
        if (path) {
            const url = `${window.location.origin}/${path}`;
            navigator.clipboard.writeText(url).then(() => {
                const icon = copyLinkBtn.querySelector('.material-icons-sharp');
                const originalText = icon?.textContent;
                copyLinkBtn.title = t('misc.copied');
                if (icon) icon.textContent = 'check';
                setTimeout(() => {
                    copyLinkBtn.title = t('misc.copy_link');
                    if(icon) icon.textContent = originalText || 'link';
                }, 2000);
            });
        }
        return;
    }

    const timerButton = target.closest<HTMLElement>('[data-timer-task-id]');
    if (timerButton) {
        const taskId = timerButton.dataset.timerTaskId!;
        const isRunning = timerButton.classList.contains('running');
        if (isRunning) { timerHandlers.stopTimer(taskId); } else { timerHandlers.startTimer(taskId); }
        return;
    }

    const viewSwitcher = target.closest<HTMLElement>('[data-view-mode]');
    if(viewSwitcher) { 
        state.ui.tasksViewMode = viewSwitcher.dataset.viewMode as any; 
        renderApp(); 
        return; 
    }

    const taskStatusCheckbox = target.closest<HTMLInputElement>('.task-status-checkbox');
    if (taskStatusCheckbox) {
        e.stopPropagation(); // Prevent opening the task detail modal.
        const taskId = taskStatusCheckbox.dataset.taskId!;
        taskHandlers.handleToggleProjectTaskStatus(taskId);
        return;
    }

    // New Archive handlers
    const archiveTaskBtn = target.closest<HTMLElement>('[data-archive-task-id]');
    if (archiveTaskBtn) {
        taskHandlers.handleToggleTaskArchive(archiveTaskBtn.dataset.archiveTaskId!);
        return;
    }
    const unarchiveTaskBtn = target.closest<HTMLElement>('[data-unarchive-task-id]');
    if (unarchiveTaskBtn) {
        taskHandlers.handleToggleTaskArchive(unarchiveTaskBtn.dataset.unarchiveTaskId!);
        return;
    }

    // New: handler for breadcrumb link in subtask modal
    const openParentBtn = target.closest<HTMLElement>('[data-open-parent-task-id]');
    if (openParentBtn) {
        const taskId = openParentBtn.dataset.openParentTaskId;
        if (taskId) {
            uiHandlers.showModal('taskDetail', { taskId: taskId });
        }
        return;
    }
    
    // Modified: handler for subtask click in task detail modal
    const subtaskItem = target.closest<HTMLElement>('.subtask-item-enhanced.clickable');
    if (subtaskItem) {
        // This check prevents the click handler from firing when an interactive element inside is clicked.
        if (target.closest('.subtask-checkbox, .delete-subtask-btn, a, button')) {
            return;
        }
        const subtaskId = subtaskItem.dataset.taskId;
        const parentTaskId = state.ui.modal.data?.taskId; // Get parent from current modal state
        if (subtaskId && parentTaskId) {
            uiHandlers.showModal('subtaskDetail', { taskId: subtaskId, parentTaskId: parentTaskId });
        }
        return;
    }

    const taskElement = target.closest<HTMLElement>('[data-task-id].clickable');
    if (taskElement) {
        uiHandlers.updateUrlAndShowDetail('task', taskElement.dataset.taskId!);
        return;
    }
    
    const dealCard = target.closest<HTMLElement>('[data-deal-id].deal-card');
    if (dealCard) {
        uiHandlers.updateUrlAndShowDetail('deal', dealCard.dataset.dealId!);
        return;
    }

    const calendarNav = target.closest<HTMLElement>('[data-calendar-nav]');
    if (calendarNav) {
        const targetCalendar = calendarNav.dataset.targetCalendar || 'main';

        if (targetCalendar === 'team') {
            const view = state.ui.teamCalendarView;
            const current_date = new Date(state.ui.teamCalendarDate + 'T12:00:00Z');
            
            if (calendarNav.dataset.calendarNav === 'prev') {
                if (view === 'month') current_date.setMonth(current_date.getMonth() - 1);
                else if (view === 'week') current_date.setDate(current_date.getDate() - 7);
                else current_date.setDate(current_date.getDate() - 1);
            } else {
                if (view === 'month') current_date.setMonth(current_date.getMonth() + 1);
                else if (view === 'week') current_date.setDate(current_date.getDate() + 7);
                else current_date.setDate(current_date.getDate() + 1);
            }
            state.ui.teamCalendarDate = current_date.toISOString().slice(0, 10);
        } else { // 'main' calendar (task calendar)
            const [year, month] = state.ui.calendarDate.split('-').map(Number);
            const currentDate = new Date(year, month - 1, 1);
            if (calendarNav.dataset.calendarNav === 'prev') {
                currentDate.setMonth(currentDate.getMonth() - 1);
            } else {
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
            const newYear = currentDate.getFullYear();
            const newMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            state.ui.calendarDate = `${newYear}-${newMonth}`;
        }

        renderApp();
        return;
    }

    const teamCalendarViewBtn = target.closest<HTMLElement>('[data-team-calendar-view]');
    if (teamCalendarViewBtn) {
        const view = teamCalendarViewBtn.dataset.teamCalendarView as 'month' | 'week' | 'day';
        if (view) { state.ui.teamCalendarView = view; renderApp(); }
        return;
    }
    
    const sidePanelTab = target.closest<HTMLElement>('.side-panel-tab[data-tab]');
    if(sidePanelTab) {
        if (state.ui.openedProjectId) {
            state.ui.openedProjectTab = sidePanelTab.dataset.tab as any;
            if (state.ui.openedProjectTab === 'wiki') { state.ui.isWikiEditing = false; }
        } else if (state.ui.openedDealId) {
            state.ui.dealDetail.activeTab = sidePanelTab.dataset.tab as any;
        }
        renderApp();
        return;
    }

    const settingsTab = target.closest<HTMLElement>('.settings-nav-item[data-tab]');
    if (settingsTab) { state.ui.settings.activeTab = settingsTab.dataset.tab as any; renderApp(); return; }

    const hrTab = target.closest<HTMLElement>('.hr-nav-item[data-hr-tab]');
    if (hrTab) {
        teamHandlers.handleSwitchHrTab(hrTab.dataset.hrTab as any);
        return;
    }

    const inviteMemberBtn = target.closest('#hr-invite-member-btn');
    if (inviteMemberBtn) {
        document.getElementById('hr-invite-flyout')?.classList.add('is-open');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.add('is-open');
        return;
    }

    const closeFlyoutBtn = target.closest('#hr-invite-cancel-btn') || target.matches('#hr-invite-flyout-backdrop');
    if (closeFlyoutBtn) {
        document.getElementById('hr-invite-flyout')?.classList.remove('is-open');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.remove('is-open');
        return;
    }
    
    const approveRequestBtn = target.closest<HTMLElement>('[data-approve-request-id]');
    if (approveRequestBtn) { teamHandlers.handleApproveTimeOffRequest(approveRequestBtn.dataset.approveRequestId!); return; }

    const rejectRequestBtn = target.closest<HTMLElement>('[data-reject-request-id]');
    if (rejectRequestBtn) { uiHandlers.showModal('rejectTimeOffRequest', { requestId: rejectRequestBtn.dataset.rejectRequestId! }); return; }

    const approveJoinRequestBtn = target.closest<HTMLElement>('[data-approve-join-request-id]');
    if (approveJoinRequestBtn) { teamHandlers.handleApproveJoinRequest(approveJoinRequestBtn.dataset.approveJoinRequestId!); return; }
    
    const rejectJoinRequestBtn = target.closest<HTMLElement>('[data-reject-join-request-id]');
    if (rejectJoinRequestBtn) { teamHandlers.handleRejectJoinRequest(rejectJoinRequestBtn.dataset.rejectJoinRequestId!); return; }

    const projectCard = target.closest<HTMLElement>('[data-project-id][role="button"]');
    if (projectCard && !projectCard.closest('.side-panel') && !projectCard.closest('[data-modal-target]')) {
        const insidePanel = target.closest('.side-panel');
        if (!insidePanel) { uiHandlers.updateUrlAndShowDetail('project', projectCard.dataset.projectId!); }
        return;
    }

    const clientCard = target.closest<HTMLElement>('[data-client-id][role="button"]');
    if (clientCard && !clientCard.closest('[data-modal-target]')) { 
        uiHandlers.updateUrlAndShowDetail('client', clientCard.dataset.clientId!); 
        return; 
    }

    if (target.closest('.btn-close-panel') || target.matches('.side-panel-overlay')) { uiHandlers.closeSidePanels(); return; }

    const modalTrigger = target.closest<HTMLElement>('[data-modal-target]');
    if (modalTrigger) {
        const modalType = modalTrigger.dataset.modalTarget as any;
        const data: Record<string, any> = {};
        for (const key in modalTrigger.dataset) {
            if (key !== 'modalTarget') {
                const dataKey = key.replace(/-(\w)/g, (_, c) => c.toUpperCase());
                data[dataKey] = modalTrigger.dataset[key];
            }
        }
        // Special case for task detail modal to update URL
        if (modalType === 'taskDetail' && data.taskId) {
            uiHandlers.updateUrlAndShowDetail('task', data.taskId);
        } else {
            uiHandlers.showModal(modalType, data);
        }
        return;
    }
    
    const addAiTaskBtn = target.closest<HTMLElement>('.add-ai-task-btn');
    if(addAiTaskBtn) {
        const taskIndex = parseInt(addAiTaskBtn.dataset.taskIndex!, 10);
        const projectId = (document.getElementById('ai-project-select') as HTMLSelectElement).value;
        if(!isNaN(taskIndex) && projectId) { aiHandlers.handleAddAiTask(taskIndex, projectId); }
        return;
    }

    const downloadBtn = target.closest<HTMLElement>('[data-download-invoice-id]');
    if(downloadBtn) { generateInvoicePDF(downloadBtn.dataset.downloadInvoiceId!); return; }
    
    const sendInvoiceBtn = target.closest<HTMLElement>('[data-send-invoice-id]');
    if (sendInvoiceBtn) { invoiceHandlers.handleSendInvoiceByEmail(sendInvoiceBtn.dataset.sendInvoiceId!); return; }
    
    const toggleInvoiceStatusBtn = target.closest<HTMLElement>('[data-toggle-invoice-status-id]');
    if (toggleInvoiceStatusBtn) { invoiceHandlers.handleToggleInvoiceStatus(toggleInvoiceStatusBtn.dataset.toggleInvoiceStatusId!); return; }

    const addInvoiceItemBtn = target.closest<HTMLElement>('#add-invoice-item-btn');
    if (addInvoiceItemBtn) {
        state.ui.modal.data.items.push({ id: Date.now().toString(), invoiceId: '', description: '', quantity: 1, unitPrice: 0 });
        renderApp();
        return;
    }

    const removeInvoiceItemBtn = target.closest<HTMLElement>('.remove-invoice-item');
    if (removeInvoiceItemBtn) {
        const itemEditor = removeInvoiceItemBtn.closest<HTMLElement>('.invoice-item-editor');
        if(itemEditor) {
            const itemId = itemEditor.dataset.itemId!;
            state.ui.modal.data.items = state.ui.modal.data.items.filter((i: InvoiceLineItem) => i.id !== itemId);
            renderApp();
        }
        return;
    }
    
    if (target.closest<HTMLElement>('#generate-invoice-items-btn')) { invoiceHandlers.handleGenerateInvoiceItems(); return; }
    
    const taskDetailTab = target.closest<HTMLElement>('.task-detail-tab[data-tab]');
    if (taskDetailTab) {
        const tab = taskDetailTab.dataset.tab as any;
        if (tab && state.ui.taskDetail.activeTab !== tab) {
            state.ui.taskDetail.activeTab = tab;
            const modalBody = document.querySelector('.modal-body');
            if (modalBody && state.ui.modal.data?.taskId) {
                modalBody.innerHTML = TaskDetailModal({ taskId: state.ui.modal.data.taskId });
            }
        }
        return;
    }
    const mentionItem = target.closest<HTMLElement>('.mention-item');
    if (mentionItem) {
        const userId = mentionItem.dataset.mentionId!;
        const user = state.users.find(u => u.id === userId);
        if(user && state.ui.mention.target) {
            handleInsertMention(user, state.ui.mention.target as HTMLElement);
        }
        return;
    }

    const krValue = target.closest<HTMLElement>('.kr-value');
    if (krValue) {
        const krItem = krValue.closest<HTMLElement>('.key-result-item')!;
        if (krItem.dataset.editing !== 'true') {
            krItem.dataset.editing = 'true';
            renderApp();
            const input = krItem.querySelector('input');
            input?.focus();
            input?.select();
        }
        return;
    }
    
    const subtaskCheckbox = target.closest<HTMLInputElement>('.subtask-checkbox');
    if (subtaskCheckbox) {
        taskHandlers.handleToggleSubtaskStatus(subtaskCheckbox.dataset.subtaskId!);
        return;
    }

    const deleteSubtaskBtn = target.closest<HTMLElement>('.delete-subtask-btn');
    if (deleteSubtaskBtn) {
        taskHandlers.handleDeleteSubtask(deleteSubtaskBtn.dataset.subtaskId!);
        return;
    }
    
    const checklistItemCheckbox = target.closest<HTMLInputElement>('.checklist-item-checkbox');
    if (checklistItemCheckbox) {
        const taskId = state.ui.modal.data?.taskId;
        const itemId = checklistItemCheckbox.closest('li')?.dataset.itemId;
        if (taskId && itemId) {
            const task = state.tasks.find(t => t.id === taskId);
            const item = task?.checklist?.find(i => i.id === itemId);
            if (item) {
                // Not implemented in handlers yet, but this is where it would go.
                console.log('Checklist item toggled, handler to be implemented.');
            }
        }
        return;
    }

    // Global buttons that might be anywhere
    if (target.closest('#fab-new-task')) { uiHandlers.showModal('addTask'); return; }
    if (target.closest('.btn-close-modal')) { uiHandlers.closeModal(); return; }
    if (target.matches('.modal-overlay')) { uiHandlers.closeModal(); return; }

    if(target.closest('#modal-save-btn')) { formHandlers.handleFormSubmit(); return; }
    
    const confirmPlanChangeBtn = target.closest('#modal-confirm-plan-change-btn');
    if (confirmPlanChangeBtn) {
        const planId = (confirmPlanChangeBtn as HTMLElement).dataset.planId as PlanId;
        if (planId) { billingHandlers.handlePlanChange(planId); uiHandlers.closeModal(); }
        return;
    }

    // Notifications
    if (target.closest('#notification-bell')) { notificationHandlers.toggleNotificationsPopover(); return; }
    const notificationItem = target.closest<HTMLElement>('.notification-item');
    if (notificationItem) { notificationHandlers.handleNotificationClick(notificationItem.dataset.notificationId!); return; }
    if (target.closest('#mark-all-read-btn')) { notificationHandlers.markAllNotificationsAsRead(); return; }
    const notificationTab = target.closest<HTMLElement>('.notification-tab');
    if (notificationTab) {
        state.ui.notifications.activeTab = notificationTab.dataset.tab as 'new' | 'read';
        renderApp();
        return;
    }
    
    // Member management
    const removeMemberBtn = target.closest<HTMLElement>('[data-remove-member-id]');
    if (removeMemberBtn) {
        if (confirm('Are you sure you want to remove this member?')) {
            teamHandlers.handleRemoveUserFromWorkspace(removeMemberBtn.dataset.removeMemberId!);
        }
        return;
    }
    const removeProjectMemberBtn = target.closest<HTMLElement>('[data-remove-project-member-id]');
    if (removeProjectMemberBtn) {
        if (confirm('Are you sure?')) {
            teamHandlers.handleRemoveUserFromProject(removeProjectMemberBtn.dataset.removeProjectMemberId!);
        }
        return;
    }

    // Task Filters
    if (target.closest('#toggle-filters-btn')) { uiHandlers.toggleTaskFilters(); return; }
    if (target.closest('#reset-task-filters')) {
        state.ui.taskFilters = { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all', tagIds: [] };
        renderApp();
        return;
    }
    
    // Custom Fields
    const deleteCustomFieldBtn = target.closest<HTMLElement>('.delete-custom-field-btn');
    if (deleteCustomFieldBtn) { taskHandlers.handleDeleteCustomFieldDefinition(deleteCustomFieldBtn.dataset.fieldId!); return; }

    // Attachments
    const deleteAttachmentBtn = target.closest<HTMLElement>('.delete-attachment-btn');
    if(deleteAttachmentBtn) { taskHandlers.handleRemoveAttachment(deleteAttachmentBtn.dataset.attachmentId!); return; }
    const attachGoogleDriveBtn = target.closest<HTMLElement>('#attach-google-drive-btn');
    if (attachGoogleDriveBtn) {
        const taskId = attachGoogleDriveBtn.dataset.taskId!;
        taskHandlers.handleAttachGoogleDriveFile(taskId);
        return;
    }


    // Dependencies
    const deleteDependencyBtn = target.closest<HTMLElement>('.delete-dependency-btn');
    if (deleteDependencyBtn) { taskHandlers.handleRemoveDependency(deleteDependencyBtn.dataset.dependencyId!); return; }
    
    // Billing
    const planButton = target.closest<HTMLElement>('[data-plan-id]');
    if (planButton && !planButton.hasAttribute('disabled')) {
        const planId = planButton.dataset.planId as PlanId;
        const planName = t(`billing.plan_${planId}`);
        uiHandlers.showModal('confirmPlanChange', { planId, planName });
        return;
    }
    
    // Reports
    const reportTab = target.closest<HTMLElement>('.report-tab');
    if (reportTab) { state.ui.reports.activeTab = reportTab.dataset.tab as any; renderApp(); return; }
    
    if (target.closest('.export-csv-btn')) { reportHandlers.handleExportCsv(e); return; }
    if (target.closest('.export-pdf-btn')) { reportHandlers.handleExportPdf(e); return; }

    // Wiki
    if (target.closest('#edit-wiki-btn')) { wikiHandlers.startWikiEdit(); return; }
    if (target.closest('#cancel-wiki-edit-btn')) { wikiHandlers.cancelWikiEdit(); return; }
    if (target.closest('#save-wiki-btn')) { wikiHandlers.saveWikiEdit(); return; }
    if (target.closest('#wiki-history-btn')) { uiHandlers.showModal('wikiHistory', { projectId: target.closest<HTMLElement>('#wiki-history-btn')?.dataset.projectId }); return; }
    const restoreWikiBtn = target.closest<HTMLElement>('[data-restore-wiki-version-id]');
    if (restoreWikiBtn) { wikiHandlers.handleRestoreWikiVersion(restoreWikiBtn.dataset.restoreWikiVersionId!); return; }

    // Automations
    const deleteAutomationBtn = target.closest<HTMLElement>('.delete-automation-btn');
    if(deleteAutomationBtn) { automationHandlers.handleDeleteAutomation(deleteAutomationBtn.dataset.automationId!); return; }
    
    // Project Menu
    if (target.closest('#project-menu-toggle')) { mainHandlers.toggleProjectMenu(); return; }
    if (target.closest('#save-as-template-btn')) {
        const projectId = (target.closest('#save-as-template-btn') as HTMLElement).dataset.projectId!;
        mainHandlers.handleSaveProjectAsTemplate(projectId);
        return;
    }

    // Dashboard
    if (target.closest('#toggle-dashboard-edit-mode')) { dashboardHandlers.toggleEditMode(); return; }
    if (target.closest('#add-widget-btn')) { uiHandlers.showModal('addWidget'); return; }
    const configureWidgetBtn = target.closest<HTMLElement>('[data-configure-widget-id]');
    if (configureWidgetBtn) { dashboardHandlers.showConfigureWidgetModal(configureWidgetBtn.dataset.configureWidgetId!); return; }
    const removeWidgetBtn = target.closest<HTMLElement>('[data-remove-widget-id]');
    if (removeWidgetBtn) { dashboardHandlers.removeWidget(removeWidgetBtn.dataset.removeWidgetId!); return; }
    const widgetCard = target.closest<HTMLElement>('[data-widget-type]');
    if (widgetCard) { dashboardHandlers.addWidget(widgetCard.dataset.widgetType as DashboardWidgetType); return; }
    const resizeWidgetBtn = target.closest<HTMLElement>('[data-resize-action]');
    if (resizeWidgetBtn) {
        const widgetId = resizeWidgetBtn.dataset.widgetId!;
        const action = resizeWidgetBtn.dataset.resizeAction as 'increase' | 'decrease';
        dashboardHandlers.handleWidgetResize(widgetId, action);
        return;
    }

    // CHAT
    const channelItem = target.closest<HTMLElement>('.channel-item');
    if (channelItem) { mainHandlers.handleSwitchChannel(channelItem.dataset.channelId!); return; }
    
    // Workspace Settings
    const saveWorkspaceBtn = target.closest<HTMLElement>('#save-workspace-settings-btn');
    if (saveWorkspaceBtn) { teamHandlers.handleSaveWorkspaceSettings(); return; }
    
    const removeLogoBtn = target.closest<HTMLElement>('#remove-logo-btn');
    if (removeLogoBtn) {
        const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (workspace) { workspace.companyLogo = undefined; teamHandlers.handleSaveWorkspaceSettings(); }
        return;
    }
    
    // Time Log Saving
    const saveTimeLogNoCommentBtn = target.closest('#save-timelog-nocomment');
    if (saveTimeLogNoCommentBtn) {
        const { taskId, trackedSeconds } = state.ui.modal.data;
        await timerHandlers.handleSaveTimeLogAndComment(taskId, trackedSeconds);
        return;
    }
    const saveTimeLogWithCommentBtn = target.closest('#save-timelog-withcomment');
    if (saveTimeLogWithCommentBtn) {
        const { taskId, trackedSeconds } = state.ui.modal.data;
        const comment = (document.getElementById('timelog-comment') as HTMLTextAreaElement).value.trim();
        await timerHandlers.handleSaveTimeLogAndComment(taskId, trackedSeconds, comment);
        return;
    }
    
    // Integrations
    const connectIntegrationBtn = target.closest<HTMLElement>('[data-connect-provider]');
    if (connectIntegrationBtn) {
        const provider = connectIntegrationBtn.dataset.connectProvider as 'slack' | 'google_drive';
        if (provider) { await integrationHandlers.connectIntegration(provider); }
        return;
    }
    const disconnectIntegrationBtn = target.closest<HTMLElement>('[data-disconnect-provider]');
    if (disconnectIntegrationBtn) {
        const provider = disconnectIntegrationBtn.dataset.disconnectProvider as 'slack' | 'google_drive';
        if (provider) { await integrationHandlers.disconnectIntegration(provider); }
        return;
    }
}