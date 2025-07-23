import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { generateInvoicePDF } from '../services.ts';
import type { Role, PlanId, User, DashboardWidgetType, ClientContact, ProjectRole } from '../types.ts';
import { t } from '../i18n.ts';
import * as aiHandlers from '../handlers/ai.ts';
import * as billingHandlers from '../handlers/billing.ts';
import * as commandHandlers from '../handlers/commands.ts';
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
import * as filterHandlers from '../handlers/filters.ts';
import * as clientHandlers from '../handlers/clients.ts';
import * as projectHandlers from '../handlers/projects.ts';
import * as userHandlers from '../handlers/user.ts';
import * as projectSectionHandlers from '../handlers/projectSections.ts';
import * as taskViewHandlers from '../handlers/taskViews.ts';

// --- TASK MENU HELPERS ---
function closeAllTaskMenus() {
    document.querySelectorAll('.task-card-menu').forEach(menu => menu.remove());
}

function showTaskCardMenu(taskId: string, buttonElement: HTMLElement) {
    closeAllTaskMenus(); // Close any other open menu

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const menu = document.createElement('div');
    menu.className = 'task-card-menu';
    menu.innerHTML = `
        <button class="task-menu-item" data-edit-task-id="${taskId}">
            <span class="material-icons-sharp">edit</span>
            <span>${t('misc.edit')}</span>
        </button>
        <button class="task-menu-item" data-archive-task-id="${taskId}">
            <span class="material-icons-sharp">archive</span>
            <span>${task.isArchived ? t('tasks.unarchive') : t('tasks.archive')}</span>
        </button>
        <button class="task-menu-item danger" data-delete-task-id="${taskId}">
            <span class="material-icons-sharp">delete</span>
            <span>${t('modals.delete')}</span>
        </button>
    `;

    document.body.appendChild(menu);
    const btnRect = buttonElement.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${btnRect.bottom + window.scrollY + 5}px`;
    menu.style.left = `${btnRect.right + window.scrollX - menu.offsetWidth}px`;
}
// --- END HELPERS ---


function renderNewClientContactFormRow() {
    const id = `new-${Date.now()}`;
    const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
    return `
        <div class="grid grid-cols-[1fr,1fr,1fr,1fr,auto] gap-2 items-center contact-form-row" data-contact-id="${id}">
            <input type="text" class="${formControlClasses}" data-field="name" placeholder="Contact Person" value="" required>
            <input type="email" class="${formControlClasses}" data-field="email" placeholder="Email" value="">
            <input type="text" class="${formControlClasses}" data-field="phone" placeholder="Phone" value="">
            <input type="text" class="${formControlClasses}" data-field="role" placeholder="Role" value="">
            <button type="button" class="p-2 text-danger hover:bg-danger/10 rounded-full remove-contact-row-btn" title="Remove Item"><span class="material-icons-sharp">delete</span></button>
        </div>
    `;
}

export async function handleClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const target = e.target as Element;

    // --- Generic Menu Toggling ---
    const menuToggle = target.closest<HTMLElement>('[data-menu-toggle]');
    if (!menuToggle && !target.closest('[aria-haspopup="true"] + div')) {
        document.querySelectorAll('[aria-haspopup="true"] + div').forEach(menu => menu.classList.add('hidden'));
        document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    }
    if (menuToggle) {
        const menuId = menuToggle.dataset.menuToggle!;
        const menu = document.getElementById(menuId);
        if (menu) {
            const isHidden = menu.classList.contains('hidden');
            document.querySelectorAll('[aria-haspopup="true"] + div').forEach(m => m.classList.add('hidden'));
            document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
            if (isHidden) {
                menu.classList.remove('hidden');
                menuToggle.setAttribute('aria-expanded', 'true');
            }
        }
        return;
    }

    // --- Close any open popovers/menus on outside click ---
    if (!target.closest('.task-card-menu')) closeAllTaskMenus();
    if (!target.closest('#notification-bell') && !target.closest('.absolute.top-full.right-0.mt-2.w-80')) {
        if(state.ui.isNotificationsOpen) notificationHandlers.toggleNotificationsPopover(false);
    }
    if (!target.closest('.command-palette') && state.ui.isCommandPaletteOpen) uiHandlers.toggleCommandPalette(false);
    if (state.ui.onboarding.isActive && !target.closest('.absolute.bg-content')) onboardingHandlers.finishOnboarding();

    // --- Navigation ---
    const navLink = target.closest('a');
    if (navLink && navLink.hostname === window.location.hostname && !navLink.href.startsWith('mailto:')) {
        e.preventDefault();
        if (window.location.pathname !== navLink.pathname) {
            history.pushState({}, '', navLink.href);
            renderApp();
        }
        return;
    }

    // --- Modals ---
    const modalTarget = target.closest<HTMLElement>('[data-modal-target]');
    if (modalTarget) {
        uiHandlers.showModal(modalTarget.dataset.modalTarget as any, { ...modalTarget.dataset });
        return;
    }
    const closeModalBtn = target.closest('.btn-close-modal');
    if (closeModalBtn) { uiHandlers.closeModal(); return; }
    if (target.matches('.fixed.inset-0.bg-black\\/50')) { uiHandlers.closeModal(); return; }

    // --- Side Panels & Task Detail Modals ---
    const closePanelBtn = target.closest('.btn-close-panel, #side-panel-overlay');
    if (closePanelBtn) { uiHandlers.closeSidePanels(); return; }
    
    const projectCard = target.closest<HTMLElement>('.projects-grid [data-project-id], .associated-projects-list [data-project-id]');
    if (projectCard && !target.closest('button, a')) {
        uiHandlers.updateUrlAndShowDetail('project', projectCard.dataset.projectId!);
        return;
    }

    const clientCard = target.closest<HTMLElement>('[data-client-id]:not([data-modal-target])');
    if (clientCard && !target.closest('button, a')) {
        uiHandlers.updateUrlAndShowDetail('client', clientCard.dataset.clientId!);
        return;
    }
    
    const dealCard = target.closest<HTMLElement>('.deal-card');
    if (dealCard && !target.closest('button, a')) {
        uiHandlers.updateUrlAndShowDetail('deal', dealCard.dataset.dealId!);
        return;
    }
    
    const taskCardOrRow = target.closest<HTMLElement>('.task-list-row, .task-card');
    if (taskCardOrRow && !target.closest('button, a')) {
        const taskId = taskCardOrRow.dataset.taskId;
        if (taskId) {
            uiHandlers.updateUrlAndShowDetail('task', taskId);
            return;
        }
    }
    
    // --- Specific Actions (ordered by page/component) ---

    // Auth
    const authTab = target.closest<HTMLElement>('[data-auth-tab]');
    if (authTab) {
        const tabName = authTab.dataset.authTab;
        document.querySelectorAll('[data-auth-tab]').forEach(t => t.classList.remove('active'));
        authTab.classList.add('active');
        const container = document.getElementById('auth-form-container')!;
        if (tabName === 'login') container.innerHTML = renderLoginForm(); else container.innerHTML = renderRegisterForm();
        return;
    }
    if (target.closest<HTMLElement>('[data-logout-button]')) { auth.logout(); return; }

    // Dashboard
    if (target.closest('#toggle-dashboard-edit-mode')) { dashboardHandlers.toggleEditMode(); return; }
    if (target.closest<HTMLElement>('[data-dashboard-tab]')) { state.ui.dashboard.activeTab = target.closest<HTMLElement>('[data-dashboard-tab]')!.dataset.dashboardTab as any; renderApp(); return; }
    const addWidgetBtn = target.closest<HTMLElement>('[data-add-widget-type]');
    if (addWidgetBtn) { dashboardHandlers.addWidget(addWidgetBtn.dataset.addWidgetType as any, addWidgetBtn.dataset.metricType as any); return; }
    const removeWidgetBtn = target.closest<HTMLElement>('.remove-widget-btn');
    if (removeWidgetBtn) { dashboardHandlers.removeWidget(removeWidgetBtn.dataset.removeWidgetId!); return; }
    const configureWidgetBtn = target.closest<HTMLElement>('[data-configure-widget-id]');
    if (configureWidgetBtn) { dashboardHandlers.showConfigureWidgetModal(configureWidgetBtn.dataset.configureWidgetId!); return; }

    // Clients
    const clientFilterStatusBtn = target.closest<HTMLElement>('[data-client-filter-status]');
    if (clientFilterStatusBtn) { state.ui.clients.filters.status = clientFilterStatusBtn.dataset.clientFilterStatus as any; renderApp(); return; }
    if (target.closest<HTMLElement>('[data-delete-client-id]')) { await clientHandlers.handleDeleteClient(target.closest<HTMLElement>('[data-delete-client-id]')!.dataset.deleteClientId!); return; }
    const addContactRowBtn = target.closest('#add-contact-row-btn');
    if (addContactRowBtn) {
        const container = document.getElementById('client-contacts-container');
        if (container) {
            container.insertAdjacentHTML('beforeend', renderNewClientContactFormRow());
        }
        return;
    }
    const removeContactRowBtn = target.closest('.remove-contact-row-btn');
    if (removeContactRowBtn) {
        const row = removeContactRowBtn.closest<HTMLElement>('.contact-form-row');
        if (row) {
            const contactId = row.dataset.contactId;
            if (contactId && !contactId.startsWith('new-')) {
                const deletedIdsInput = document.getElementById('deleted-contact-ids') as HTMLInputElement;
                if (deletedIdsInput) {
                    const currentIds = deletedIdsInput.value.split(',').filter(Boolean);
                    currentIds.push(contactId);
                    deletedIdsInput.value = currentIds.join(',');
                }
            }
            row.remove();
        }
        return;
    }
    
    // Invoices
    const downloadInvoiceBtn = target.closest<HTMLElement>('[data-download-invoice-id]');
    if (downloadInvoiceBtn) { generateInvoicePDF(downloadInvoiceBtn.dataset.downloadInvoiceId!); return; }
    const sendInvoiceBtn = target.closest<HTMLElement>('[data-send-invoice-id]');
    if (sendInvoiceBtn) { invoiceHandlers.handleSendInvoiceByEmail(sendInvoiceBtn.dataset.sendInvoiceId!); return; }
    const toggleInvoiceStatusBtn = target.closest<HTMLElement>('[data-toggle-invoice-status-id]');
    if (toggleInvoiceStatusBtn) { invoiceHandlers.handleToggleInvoiceStatus(toggleInvoiceStatusBtn.dataset.toggleInvoiceStatusId!); return; }
    
    // Tasks
    if (target.closest('#toggle-filters-btn')) { uiHandlers.toggleTaskFilters(); return; }
    if (target.closest('#reset-task-filters')) { filterHandlers.resetFilters(); return; }
    const viewModeBtn = target.closest<HTMLElement>('[data-view-mode]');
    if (viewModeBtn) { state.ui.tasks.viewMode = viewModeBtn.dataset.viewMode as any; renderApp(); }
    if (target.closest('[data-toggle-kanban-view]')) { userHandlers.handleToggleKanbanViewMode(); return; }
    const taskCardMenuBtn = target.closest<HTMLElement>('.task-card-menu-btn');
    if (taskCardMenuBtn) { e.stopPropagation(); showTaskCardMenu(taskCardMenuBtn.closest<HTMLElement>('[data-task-id]')!.dataset.taskId!, taskCardMenuBtn); return; }
    const editTaskBtn = target.closest<HTMLElement>('[data-edit-task-id]');
    if (editTaskBtn) { uiHandlers.showModal('taskDetail', { taskId: editTaskBtn.dataset.editTaskId! }); return; }
    const archiveTaskBtn = target.closest<HTMLElement>('[data-archive-task-id]');
    if (archiveTaskBtn) { taskHandlers.handleToggleTaskArchive(archiveTaskBtn.dataset.archiveTaskId!); return; }
    const deleteTaskBtn = target.closest<HTMLElement>('[data-delete-task-id]');
    if (deleteTaskBtn) { taskHandlers.handleDeleteTask(deleteTaskBtn.dataset.deleteTaskId!); return; }
    const timerButton = target.closest<HTMLElement>('[data-timer-task-id]');
    if (timerButton) { const taskId = timerButton.dataset.timerTaskId!; if (state.activeTimers[taskId]) timerHandlers.stopTimer(taskId); else timerHandlers.startTimer(taskId); return; }

    // Task Detail Modal / Project Detail Panel
    const detailTab = target.closest<HTMLElement>('.side-panel-tab, .task-detail-tab');
    if (detailTab) {
        if (target.closest('.task-detail-layout')) { state.ui.taskDetail.activeTab = detailTab.dataset.tab as any; }
        else if (target.closest('.side-panel[aria-label*="Project"]')) { state.ui.openedProjectTab = detailTab.dataset.tab as any; }
        else if (target.closest('.side-panel[aria-label*="Deal"]')) { state.ui.dealDetail.activeTab = detailTab.dataset.tab as any; }
        renderApp();
        return;
    }
    if (target.closest('.delete-checklist-item-btn')) { const taskId = state.ui.modal.data.taskId; const itemId = target.closest<HTMLElement>('[data-item-id]')!.dataset.itemId!; if(taskId && itemId) taskHandlers.handleDeleteChecklistItem(taskId, itemId); return; }
    if (target.closest('.delete-subtask-btn')) { taskHandlers.handleDeleteSubtask(target.closest<HTMLElement>('[data-subtask-id]')!.dataset.subtaskId!); return; }
    if (target.closest('[data-remove-dependency-id]')) { taskHandlers.handleRemoveDependency(target.closest<HTMLElement>('[data-remove-dependency-id]')!.dataset.removeDependencyId!); return; }
    const deleteAttachmentBtn = target.closest<HTMLElement>('.delete-attachment-btn');
    if (deleteAttachmentBtn) { taskHandlers.handleRemoveAttachment(deleteAttachmentBtn.dataset.attachmentId!); return; }

    // Project Sections (in Tasks Page)
    if (target.closest('#add-project-section-btn')) { uiHandlers.showModal('addProjectSection', { projectId: target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId }); return; }
    const renameSectionBtn = target.closest<HTMLElement>('[data-rename-project-section-id]');
    if (renameSectionBtn) { const sectionId = renameSectionBtn.dataset.renameProjectSectionId!; const section = state.projectSections.find(ps => ps.id === sectionId); if (section) { const newName = prompt(t('modals.rename'), section.name); if (newName) await projectSectionHandlers.handleRenameProjectSection(sectionId, newName); } return; }
    const deleteSectionBtn = target.closest<HTMLElement>('[data-delete-project-section-id]');
    if (deleteSectionBtn) { await projectSectionHandlers.handleDeleteProjectSection(deleteSectionBtn.dataset.deleteProjectSectionId!); return; }

    // Settings
    const settingsTab = target.closest<HTMLElement>('[data-tab]');
    if (settingsTab && target.closest('.flex.gap-8.h-full')) { state.ui.settings.activeTab = settingsTab.dataset.tab as any; renderApp(); return; }
    if (target.closest('#save-workspace-settings-btn')) { teamHandlers.handleSaveWorkspaceSettings(); return; }
    if (target.closest('#remove-logo-btn')) { const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId); if (ws) ws.companyLogo = undefined; teamHandlers.handleSaveWorkspaceSettings(); return; }
    if (target.closest('[data-connect-provider]')) { integrationHandlers.connectIntegration(target.closest<HTMLElement>('[data-connect-provider]')!.dataset.connectProvider as any); return; }
    if (target.closest('[data-disconnect-provider]')) { integrationHandlers.disconnectIntegration(target.closest<HTMLElement>('[data-disconnect-provider]')!.dataset.disconnectProvider as any); return; }
    if (target.closest('.edit-task-view-btn')) { target.closest('.task-view-item')?.classList.add('editing'); return; }
    if (target.closest('.cancel-task-view-edit-btn')) { target.closest('.task-view-item')?.classList.remove('editing'); return; }
    if (target.closest('.save-task-view-btn')) { const viewItem = target.closest<HTMLElement>('.task-view-item')!; const id = viewItem.dataset.viewId!; const name = viewItem.querySelector<HTMLInputElement>('input[name="view-name"]')!.value; const icon = viewItem.querySelector<HTMLInputElement>('input[name="view-icon"]')!.value; taskViewHandlers.handleUpdateTaskView(id, name, icon); return; }
    if (target.closest('.delete-task-view-btn')) { taskViewHandlers.handleDeleteTaskView(target.closest<HTMLElement>('[data-view-id]')!.dataset.viewId!); return; }
    if (target.closest('#add-task-view-btn')) { const name = document.getElementById('new-task-view-name') as HTMLInputElement; const icon = document.getElementById('new-task-view-icon') as HTMLInputElement; if (name.value) { taskViewHandlers.handleCreateTaskView(name.value, icon.value); name.value = ''; icon.value = 'checklist'; } return; }

    // HR
    const hrTab = target.closest<HTMLElement>('[data-hr-tab]');
    if (hrTab) { teamHandlers.handleSwitchHrTab(hrTab.dataset.hrTab as any); return; }
    if (target.closest('#hr-invite-member-btn')) { document.getElementById('hr-invite-flyout')?.classList.add('is-open'); document.getElementById('hr-invite-flyout-backdrop')?.classList.add('is-open'); return; }
    if (target.closest('#hr-invite-cancel-btn, #hr-invite-flyout-backdrop')) { document.getElementById('hr-invite-flyout')?.classList.remove('is-open'); document.getElementById('hr-invite-flyout-backdrop')?.classList.remove('is-open'); return; }
    if (target.closest('[data-remove-member-id]')) { teamHandlers.handleRemoveUserFromWorkspace(target.closest<HTMLElement>('[data-remove-member-id]')!.dataset.removeMemberId!); return; }
    if (target.closest('[data-approve-join-request-id]')) { teamHandlers.handleApproveJoinRequest(target.closest<HTMLElement>('[data-approve-join-request-id]')!.dataset.approveJoinRequestId!); return; }
    if (target.closest('[data-reject-join-request-id]')) { teamHandlers.handleRejectJoinRequest(target.closest<HTMLElement>('[data-reject-join-request-id]')!.dataset.rejectJoinRequestId!); return; }
    if (target.closest('[data-approve-request-id]')) { teamHandlers.handleApproveTimeOffRequest(target.closest<HTMLElement>('[data-approve-request-id]')!.dataset.approveRequestId!); return; }
    if (target.closest('[data-reject-request-id]')) { uiHandlers.showModal('rejectTimeOffRequest', { requestId: target.closest<HTMLElement>('[data-reject-request-id]')!.dataset.rejectRequestId! }); return; }

    // Misc
    if (target.closest<HTMLElement>('[data-plan-id]')) { billingHandlers.handlePlanChange(target.closest<HTMLElement>('[data-plan-id]')!.dataset.planId as PlanId); return; }
    if (target.closest('.export-csv-btn')) { reportHandlers.handleExportCsv(e); return; }
    if (target.closest('.export-pdf-btn')) { reportHandlers.handleExportPdf(e); return; }
    if (target.closest('.report-tab')) { state.ui.reports.activeTab = target.closest<HTMLElement>('.report-tab')!.dataset.tab as any; renderApp(); }
    const addAiTaskBtn = target.closest<HTMLElement>('.add-ai-task-btn');
    if (addAiTaskBtn) { const projectSelect = document.getElementById('ai-project-select') as HTMLSelectElement; aiHandlers.handleAddAiTask(parseInt(addAiTaskBtn.dataset.taskIndex!, 10), projectSelect.value); return; }
    if (target.closest('#notification-bell')) { notificationHandlers.toggleNotificationsPopover(); return; }
    if (target.closest('.notification-item')) { notificationHandlers.handleNotificationClick(target.closest<HTMLElement>('.notification-item')!.dataset.notificationId!); return; }
    if (target.closest('#mark-all-read-btn')) { notificationHandlers.markAllNotificationsAsRead(); return; }
    
    // START FIX: Notification Tab Switching
    const notificationPopoverTab = target.closest<HTMLElement>('.absolute.top-full.right-0 [data-tab]');
    if (notificationPopoverTab) {
        const tab = notificationPopoverTab.dataset.tab as 'new' | 'read';
        if (state.ui.notifications.activeTab !== tab) {
            state.ui.notifications.activeTab = tab;
            renderApp();
        }
        return;
    }
    // END FIX

    const commandItem = target.closest<HTMLElement>('.command-item');
    if (commandItem) { commandHandlers.executeCommand(commandItem.dataset.commandId!); return; }
    if (target.closest('#edit-wiki-btn')) { wikiHandlers.startWikiEdit(); return; }
    if (target.closest('#cancel-wiki-edit-btn')) { wikiHandlers.cancelWikiEdit(); return; }
    if (target.closest('#save-wiki-btn')) { wikiHandlers.saveWikiEdit(); return; }
    if (target.closest('#wiki-history-btn')) { uiHandlers.showModal('wikiHistory', { projectId: target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId }); return; }
    if (target.closest('[data-restore-wiki-version]')) { wikiHandlers.handleRestoreWikiVersion(target.closest<HTMLElement>('[data-restore-wiki-version]')!.dataset.restoreWikiVersion!); return; }
    if (target.closest('.kr-value')) { const krItem = target.closest<HTMLElement>('.key-result-item')!; krItem.dataset.editing = 'true'; renderApp(); return; }
    if (target.closest('[data-remove-project-member-id]')) { teamHandlers.handleRemoveUserFromProject(target.closest<HTMLElement>('[data-remove-project-member-id]')!.dataset.removeProjectMemberId!); return; }
    const mentionItem = target.closest<HTMLElement>('.mention-item');
    if (mentionItem) { const userId = mentionItem.dataset.mentionId!; const user = state.users.find(u => u.id === userId); if(user) handleInsertMention(user, state.ui.mention.target as HTMLElement); return; }
    if (target.closest<HTMLElement>('[data-delete-project-id]')) {
        if (confirm('Are you sure you want to delete this project? This will also delete all associated tasks and cannot be undone.')) {
            await projectHandlers.handleDeleteProject(target.closest<HTMLElement>('[data-delete-project-id]')!.dataset.deleteProjectId!);
        }
        return;
    }
}