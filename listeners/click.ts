

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { generateInvoicePDF } from '../services.ts';
import type { InvoiceLineItem, Role, PlanId, User, DashboardWidgetType, ClientContact, ProjectRole } from '../types.ts';
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
import * as filterHandlers from '../handlers/filters.ts';
import * as clientHandlers from '../handlers/clients.ts';
import * as projectHandlers from '../handlers/projects.ts';
import * as userHandlers from '../handlers/user.ts';
import * as projectSectionHandlers from '../handlers/projectSections.ts';
import * as taskViewHandlers from '../handlers/taskViews.ts';

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

// --- NEW TASK MENU HELPERS ---
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
    const menuHeight = menu.offsetHeight;
    const menuWidth = menu.offsetWidth;
    
    let top = btnRect.bottom + window.scrollY + 5;
    let left = btnRect.right + window.scrollX - menuWidth;

    // Adjust if menu goes off-screen
    if (top + menuHeight > window.innerHeight + window.scrollY) {
        top = btnRect.top + window.scrollY - menuHeight - 5;
    }
    if (left < 0) {
        left = btnRect.left + window.scrollX;
    }

    menu.style.position = 'absolute';
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}
// --- END NEW HELPERS ---

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

    if (target.closest('#global-timer-toggle')) {
        if (state.ui.globalTimer.isRunning) timerHandlers.stopGlobalTimer(); else timerHandlers.startGlobalTimer();
        return;
    }

    const fabContainer = document.getElementById('fab-container');
    if (target.closest('#fab-main-btn')) {
        fabContainer?.classList.toggle('is-open');
        return;
    }
    if (fabContainer?.classList.contains('is-open') && !target.closest('.fab-container')) {
        fabContainer.classList.remove('is-open');
    }

    const menuBtn = target.closest<HTMLElement>('.task-card-menu-btn');
    if (menuBtn) {
        e.preventDefault(); e.stopPropagation();
        const taskId = menuBtn.closest<HTMLElement>('[data-task-id]')!.dataset.taskId!;
        showTaskCardMenu(taskId, menuBtn);
        return;
    }
    if (!target.closest('.task-card-menu')) closeAllTaskMenus();
    
    const editTaskBtn = target.closest<HTMLElement>('[data-edit-task-id]');
    if (editTaskBtn) { uiHandlers.showModal('taskDetail', { taskId: editTaskBtn.dataset.editTaskId! }); closeAllTaskMenus(); return; }
    const archiveTaskBtn = target.closest<HTMLElement>('[data-archive-task-id]');
    if (archiveTaskBtn) { taskHandlers.handleToggleTaskArchive(archiveTaskBtn.dataset.archiveTaskId!); closeAllTaskMenus(); return; }
    const deleteTaskBtn = target.closest<HTMLElement>('[data-delete-task-id]');
    if (deleteTaskBtn) { taskHandlers.handleDeleteTask(deleteTaskBtn.dataset.deleteTaskId!); closeAllTaskMenus(); return; }

    const addSectionBtn = target.closest('#add-project-section-btn');
    if (addSectionBtn) { uiHandlers.showModal('addProjectSection', { projectId: (addSectionBtn as HTMLElement).dataset.projectId }); return; }
    const renameProjectSectionBtn = target.closest<HTMLElement>('[data-rename-project-section-id]');
    if (renameProjectSectionBtn) {
        const sectionId = renameProjectSectionBtn.dataset.renameProjectSectionId!;
        const section = state.projectSections.find(ps => ps.id === sectionId);
        if (section) {
            const newName = prompt(t('modals.rename'), section.name);
            if (newName) await projectSectionHandlers.handleRenameProjectSection(sectionId, newName);
        }
        return;
    }
    const deleteProjectSectionBtn = target.closest<HTMLElement>('[data-delete-project-section-id]');
    if (deleteProjectSectionBtn) { await projectSectionHandlers.handleDeleteProjectSection(deleteProjectSectionBtn.dataset.deleteProjectSectionId!); return; }

    if (target.closest('[data-task-edit-start]')) { state.ui.taskDetail.isEditing = true; renderApp(); return; }
    if (target.closest('[data-task-edit-cancel]')) { state.ui.taskDetail.isEditing = false; renderApp(); return; }
    if (target.closest('[data-task-edit-save]')) {
        const taskId = state.ui.modal.data?.taskId;
        if (taskId) {
            const editContainer = document.getElementById('task-detail-header-edit');
            if (editContainer) {
                const fieldsToUpdate = editContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]');
                fieldsToUpdate.forEach(field => taskHandlers.handleTaskDetailUpdate(taskId, field.dataset.field as any, field.value));
            }
        }
        state.ui.taskDetail.isEditing = false;
        return;
    }

    if (target.closest('#toggle-dashboard-edit-mode')) { dashboardHandlers.toggleEditMode(); return; }
    const addWidgetBtn = target.closest<HTMLElement>('[data-add-widget-type]');
    if (addWidgetBtn) { dashboardHandlers.addWidget(addWidgetBtn.dataset.addWidgetType as any, addWidgetBtn.dataset.metricType as any); return; }
    if (target.closest<HTMLElement>('.remove-widget-btn')) { dashboardHandlers.removeWidget(target.closest<HTMLElement>('.remove-widget-btn')!.dataset.removeWidgetId!); return; }
    if (target.closest<HTMLElement>('[data-configure-widget-id]')) { dashboardHandlers.showConfigureWidgetModal(target.closest<HTMLElement>('[data-configure-widget-id]')!.dataset.configureWidgetId!); return; }

    if (target.closest('#add-contact-row-btn')) { document.getElementById('client-contacts-container')?.insertAdjacentHTML('beforeend', renderClientContactFormRow()); return; }
    if (target.closest('.remove-contact-row-btn')) {
        const row = target.closest('.contact-form-row') as HTMLElement;
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
    if (target.closest<HTMLElement>('[data-delete-client-id]')) { await clientHandlers.handleDeleteClient(target.closest<HTMLElement>('[data-delete-client-id]')!.dataset.deleteClientId!); return; }
    if (target.closest<HTMLElement>('[data-delete-project-id]')) {
        if (confirm(t('Are you sure you want to delete this project? This will also delete all associated tasks and cannot be undone.'))) {
            await projectHandlers.handleDeleteProject(target.closest<HTMLElement>('[data-delete-project-id]')!.dataset.deleteProjectId!);
        }
        return;
    }

    if (target.closest<HTMLElement>('.multiselect-display')) { target.closest<HTMLElement>('.multiselect-display')!.nextElementSibling?.classList.toggle('hidden'); }
    else if (!target.closest('.multiselect-container')) { document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.add('hidden')); }

    if (target.closest('#task-filter-tags-toggle')) { document.getElementById('task-filter-tags-dropdown')?.classList.toggle('hidden'); return; }
    if (target.closest('.multiselect-dropdown-item') && target.closest('#task-filter-tags-dropdown')) {
        const checkbox = target.closest('.multiselect-dropdown-item')!.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox && e.target !== checkbox) { checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change', { bubbles: true })); }
    } else if (!target.closest('#task-filter-tags-container')) {
        document.getElementById('task-filter-tags-dropdown')?.classList.add('hidden');
    }

    if (target.closest('.onboarding-next-btn')) { onboardingHandlers.nextStep(); return; }
    if (target.closest('.onboarding-skip-btn')) { onboardingHandlers.finishOnboarding(); return; }

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

    if (!target.closest('#notification-bell') && state.ui.isNotificationsOpen) { notificationHandlers.toggleNotificationsPopover(false); }
    if (!target.closest('.command-palette') && state.ui.isCommandPaletteOpen) { uiHandlers.toggleCommandPalette(false); }

    const navLink = target.closest('a');
    if (navLink && !navLink.href.startsWith('mailto:') && navLink.pathname !== window.location.pathname) {
        e.preventDefault();
        history.pushState({}, '', navLink.href);
        renderApp();
        return;
    }
    
    const copyLinkBtn = target.closest<HTMLElement>('[data-copy-link]');
    if (copyLinkBtn) {
        const path = copyLinkBtn.dataset.copyLink;
        if (path) {
            navigator.clipboard.writeText(`${window.location.origin}/${path}`).then(() => {
                const icon = copyLinkBtn.querySelector('.material-icons-sharp');
                const originalText = icon?.textContent;
                if (icon) icon.textContent = 'check';
                setTimeout(() => { if(icon) icon.textContent = originalText || 'link'; }, 2000);
            });
        }
        return;
    }

    const timerButton = target.closest<HTMLElement>('[data-timer-task-id]');
    if (timerButton) {
        const taskId = timerButton.dataset.timerTaskId!;
        if (!!state.activeTimers[taskId]) timerHandlers.stopTimer(taskId); else timerHandlers.startTimer(taskId);
        return;
    }

    if (target.closest<HTMLElement>('[data-view-mode]')) { state.ui.tasks.viewMode = target.closest<HTMLElement>('[data-view-mode]')!.dataset.viewMode as any; renderApp(); return; }
    if (target.closest<HTMLElement>('[data-toggle-kanban-view]')) { userHandlers.handleToggleKanbanViewMode(); return; }
    if (target.closest<HTMLElement>('.task-status-toggle')) { taskHandlers.handleToggleProjectTaskStatus(target.closest<HTMLElement>('.task-status-toggle')!.dataset.taskId!); return; }
    
    const taskElement = target.closest<HTMLElement>('.task-card, .task-list-row, .project-task-row');
    if (taskElement) {
        if (target.closest('.task-card-menu-btn, .timer-controls, a, button, .task-status-toggle')) return;
        const taskId = taskElement.dataset.taskId!;
        if (taskElement.matches('.project-task-row')) uiHandlers.showModal('taskDetail', { taskId });
        else uiHandlers.updateUrlAndShowDetail('task', taskId);
        return;
    }

    if (target.closest<HTMLElement>('[data-project-id]')) { if (!target.closest('a, button, [data-menu-toggle]')) uiHandlers.updateUrlAndShowDetail('project', target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId!); return; }
    if (target.closest<HTMLElement>('[data-client-id]')) { if (!target.closest('a, button')) uiHandlers.updateUrlAndShowDetail('client', target.closest<HTMLElement>('[data-client-id]')!.dataset.clientId!); return; }
    if (target.closest<HTMLElement>('[data-deal-id].deal-card')) { uiHandlers.updateUrlAndShowDetail('deal', target.closest<HTMLElement>('[data-deal-id]')!.dataset.dealId!); return; }
    
    const calendarNav = target.closest<HTMLElement>('[data-calendar-nav]');
    if (calendarNav) {
        const targetCalendar = calendarNav.dataset.targetCalendar || 'main';
        if (targetCalendar === 'team') {
            const view = state.ui.teamCalendarView;
            const d = new Date(state.ui.teamCalendarDate + 'T12:00:00Z');
            if (calendarNav.dataset.calendarNav==='prev') { if(view==='month')d.setMonth(d.getMonth()-1);else if(view==='week')d.setDate(d.getDate()-7);else d.setDate(d.getDate()-1); }
            else { if(view==='month')d.setMonth(d.getMonth()+1);else if(view==='week')d.setDate(d.getDate()+7);else d.setDate(d.getDate()+1); }
            state.ui.teamCalendarDate=d.toISOString().slice(0,10);
        } else {
            const [y,m]=state.ui.calendarDate.split('-').map(Number);const d=new Date(y,m-1,1);
            if(calendarNav.dataset.calendarNav==='prev')d.setMonth(d.getMonth()-1);else d.setMonth(d.getMonth()+1);
            state.ui.calendarDate=`${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
        }
        renderApp(); return;
    }
    if (target.closest<HTMLElement>('[data-team-calendar-view]')) { state.ui.teamCalendarView = target.closest<HTMLElement>('[data-team-calendar-view]')!.dataset.teamCalendarView as any; renderApp(); return; }
    
    const sidePanelTab = target.closest<HTMLElement>('.side-panel-tab[data-tab]');
    if(sidePanelTab) {
        if(state.ui.openedProjectId) state.ui.openedProjectTab = sidePanelTab.dataset.tab as any;
        else if(state.ui.openedDealId) state.ui.dealDetail.activeTab = sidePanelTab.dataset.tab as any;
        renderApp(); return;
    }

    const settingsTab = target.closest<HTMLElement>('[data-tab]');
    if(settingsTab&&settingsTab.closest('nav')) { state.ui.settings.activeTab=settingsTab.dataset.tab as any; renderApp(); return; }
    if (target.closest<HTMLElement>('[data-hr-tab]')) { teamHandlers.handleSwitchHrTab(target.closest<HTMLElement>('[data-hr-tab]')!.dataset.hrTab as any); return; }

    if (target.closest('#hr-invite-member-btn')) {
        document.getElementById('hr-invite-flyout')?.classList.add('translate-x-0');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.add('opacity-100','pointer-events-auto');
        return;
    }
    if (target.closest('#hr-invite-cancel-btn')||target.matches('#hr-invite-flyout-backdrop')) {
        document.getElementById('hr-invite-flyout')?.classList.remove('translate-x-0');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.remove('opacity-100','pointer-events-auto');
        return;
    }
    
    if (target.closest<HTMLElement>('[data-approve-request-id]')) { teamHandlers.handleApproveTimeOffRequest(target.closest<HTMLElement>('[data-approve-request-id]')!.dataset.approveRequestId!); return; }
    if (target.closest<HTMLElement>('[data-reject-request-id]')) { uiHandlers.showModal('rejectTimeOffRequest',{requestId:target.closest<HTMLElement>('[data-reject-request-id]')!.dataset.rejectRequestId!}); return; }
    if (target.closest<HTMLElement>('[data-approve-join-request-id]')) { teamHandlers.handleApproveJoinRequest(target.closest<HTMLElement>('[data-approve-join-request-id]')!.dataset.approveJoinRequestId!); return; }
    if (target.closest<HTMLElement>('[data-reject-join-request-id]')) { teamHandlers.handleRejectJoinRequest(target.closest<HTMLElement>('[data-reject-join-request-id]')!.dataset.rejectJoinRequestId!); return; }

    if (target.closest('.btn-close-panel') || target.matches('#side-panel-overlay')) { uiHandlers.closeSidePanels(); return; }

    const modalTrigger = target.closest<HTMLElement>('[data-modal-target]');
    if (modalTrigger) {
        const modalType = modalTrigger.dataset.modalTarget as any;
        const data: Record<string, any> = {};
        for (const key in modalTrigger.dataset) if (key !== 'modalTarget') data[key.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = modalTrigger.dataset[key];
        if (modalType === 'taskDetail' && data.taskId) uiHandlers.updateUrlAndShowDetail('task', data.taskId);
        else uiHandlers.showModal(modalType, data);
        return;
    }
    
    if(target.closest<HTMLElement>('.add-ai-task-btn')) { aiHandlers.handleAddAiTask(parseInt(target.closest<HTMLElement>('.add-ai-task-btn')!.dataset.taskIndex!,10),(document.getElementById('ai-project-select') as HTMLSelectElement).value); return; }
    if(target.closest<HTMLElement>('[data-download-invoice-id]')) { generateInvoicePDF(target.closest<HTMLElement>('[data-download-invoice-id]')!.dataset.downloadInvoiceId!); return; }
    if(target.closest<HTMLElement>('[data-send-invoice-id]')) { invoiceHandlers.handleSendInvoiceByEmail(target.closest<HTMLElement>('[data-send-invoice-id]')!.dataset.sendInvoiceId!); return; }
    if(target.closest<HTMLElement>('[data-toggle-invoice-status-id]')) { invoiceHandlers.handleToggleInvoiceStatus(target.closest<HTMLElement>('[data-toggle-invoice-status-id]')!.dataset.toggleInvoiceStatusId!); return; }
    if (target.closest<HTMLElement>('#add-invoice-item-btn')) { state.ui.modal.data.items.push({ id:Date.now().toString(),invoiceId:'',description:'',quantity:1,unitPrice:0 }); renderApp(); return; }
    if (target.closest<HTMLElement>('.remove-invoice-item')) { state.ui.modal.data.items = state.ui.modal.data.items.filter((i: InvoiceLineItem) => i.id !== target.closest<HTMLElement>('.invoice-item-editor')!.dataset.itemId!); renderApp(); return; }
    if (target.closest<HTMLElement>('#generate-invoice-items-btn')) { invoiceHandlers.handleGenerateInvoiceItems(); return; }

    const taskDetailTab = target.closest<HTMLElement>('.task-detail-tab[data-tab]');
    if (taskDetailTab) { state.ui.taskDetail.activeTab = taskDetailTab.dataset.tab as any; renderApp(); return; }

    const mentionItem = target.closest<HTMLElement>('.mention-item');
    if (mentionItem) { const u=state.users.find(u=>u.id===mentionItem.dataset.mentionId!); if(u&&state.ui.mention.target) handleInsertMention(u, state.ui.mention.target as HTMLElement); return; }
    
    const krValue = target.closest<HTMLElement>('.kr-value');
    if (krValue) {
        const krItem = krValue.closest<HTMLElement>('.key-result-item')!;
        if (krItem.dataset.editing !== 'true') {
            krItem.dataset.editing = 'true';
            renderApp();
            const input = krItem.querySelector('input');
            input?.focus(); input?.select();
        }
        return;
    }
    
    if (target.closest<HTMLInputElement>('.subtask-checkbox')) { taskHandlers.handleToggleSubtaskStatus(target.closest<HTMLInputElement>('.subtask-checkbox')!.dataset.subtaskId!); return; }
    if (target.closest<HTMLElement>('.delete-subtask-btn')) { taskHandlers.handleDeleteSubtask(target.closest<HTMLElement>('.delete-subtask-btn')!.dataset.subtaskId!); return; }
    if (target.closest<HTMLInputElement>('.checklist-item-checkbox')) { const taskId=state.ui.modal.data?.taskId, itemId=target.closest('li')?.dataset.itemId; if(taskId&&itemId) taskHandlers.handleToggleChecklistItem(taskId,itemId); return; }
    
    if (target.closest('#edit-wiki-btn')) { wikiHandlers.startWikiEdit(); return; }
    if (target.closest('#cancel-wiki-edit-btn')) { wikiHandlers.cancelWikiEdit(); return; }
    if (target.closest('#save-wiki-btn')) { wikiHandlers.saveWikiEdit(); return; }
    if (target.closest('#wiki-history-btn')) { uiHandlers.showModal('wikiHistory', { projectId: target.closest<HTMLElement>('[data-project-id]')?.dataset.projectId }); return; }
    if (target.closest<HTMLElement>('[data-restore-history-id]')) { wikiHandlers.handleRestoreWikiVersion(target.closest<HTMLElement>('[data-restore-history-id]')!.dataset.restoreHistoryId!); return; }
    if (target.closest('#save-as-template-btn')) { mainHandlers.handleSaveProjectAsTemplate(target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId!); return; }

    if (target.closest('.btn-close-modal') || (target.closest<HTMLElement>('[role="dialog"]') && e.target === target.closest<HTMLElement>('[role="dialog"]'))) { uiHandlers.closeModal(); return; }
    if(target.closest('#modal-save-btn')) { formHandlers.handleFormSubmit(); return; }
    if (target.closest('#modal-confirm-plan-change-btn')) { billingHandlers.handlePlanChange((target.closest('#modal-confirm-plan-change-btn') as HTMLElement).dataset.planId as PlanId); uiHandlers.closeModal(); return; }

    if (target.closest('#notification-bell')) { notificationHandlers.toggleNotificationsPopover(); return; }
    if (target.closest<HTMLElement>('.notification-item')) { notificationHandlers.handleNotificationClick(target.closest<HTMLElement>('.notification-item')!.dataset.notificationId!); return; }
    if (target.closest('#mark-all-read-btn')) { notificationHandlers.markAllNotificationsAsRead(); return; }
    const notificationTab = target.closest<HTMLElement>('[data-tab]');
    if (notificationTab && notificationTab.closest('.flex.border-b')) { state.ui.notifications.activeTab = notificationTab.dataset.tab as 'new'|'read'; renderApp(); return; }
    
    if (target.closest<HTMLElement>('[data-remove-member-id]')) {
        if(confirm('Are you sure you want to remove this member?')) teamHandlers.handleRemoveUserFromWorkspace(target.closest<HTMLElement>('[data-remove-member-id]')!.dataset.removeMemberId!);
        return;
    }
    const removeProjectMemberBtn = target.closest<HTMLElement>('[data-remove-project-member-id]');
    if (removeProjectMemberBtn) {
        if (confirm('Are you sure you want to remove this member from the project?')) {
            teamHandlers.handleRemoveUserFromProject(removeProjectMemberBtn.dataset.removeProjectMemberId!);
        }
        return;
    }

    const dashboardTab = target.closest<HTMLElement>('[data-dashboard-tab]');
    if (dashboardTab) {
        state.ui.dashboard.activeTab = dashboardTab.dataset.dashboardTab as any;
        renderApp();
        return;
    }

    const reportTab = target.closest<HTMLElement>('.report-tab');
    if (reportTab) {
        state.ui.reports.activeTab = reportTab.dataset.tab as any;
        renderApp();
        return;
    }

    if (target.closest('#save-workspace-settings-btn')) { teamHandlers.handleSaveWorkspaceSettings(); return; }
    if (target.closest('#remove-logo-btn')) {
        const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (workspace) { workspace.companyLogo = ''; teamHandlers.handleSaveWorkspaceSettings(); }
        return;
    }

    const connectProviderBtn = target.closest<HTMLElement>('[data-connect-provider]');
    if (connectProviderBtn) {
        integrationHandlers.connectIntegration(connectProviderBtn.dataset.connectProvider as any);
        return;
    }
    const disconnectProviderBtn = target.closest<HTMLElement>('[data-disconnect-provider]');
    if (disconnectProviderBtn) {
        integrationHandlers.disconnectIntegration(disconnectProviderBtn.dataset.disconnectProvider as any);
        return;
    }

    if (target.closest('.export-csv-btn')) { reportHandlers.handleExportCsv(e); return; }
    if (target.closest('.export-pdf-btn')) { reportHandlers.handleExportPdf(e); return; }

    const editTaskViewBtn = target.closest<HTMLElement>('.edit-task-view-btn');
    if (editTaskViewBtn) {
        const row = editTaskViewBtn.closest<HTMLElement>('.task-view-item')!;
        row.classList.add('editing');
        (row.querySelector('input[name="view-name"]') as HTMLInputElement).focus();
        return;
    }

    const cancelTaskViewEditBtn = target.closest<HTMLElement>('.cancel-task-view-edit-btn');
    if (cancelTaskViewEditBtn) {
        cancelTaskViewEditBtn.closest<HTMLElement>('.task-view-item')!.classList.remove('editing');
        return;
    }

    const saveTaskViewBtn = target.closest<HTMLElement>('.save-task-view-btn');
    if (saveTaskViewBtn) {
        const row = saveTaskViewBtn.closest<HTMLElement>('.task-view-item')!;
        const viewId = row.dataset.viewId!;
        const name = (row.querySelector('input[name="view-name"]') as HTMLInputElement).value;
        const icon = (row.querySelector('input[name="view-icon"]') as HTMLInputElement).value;
        await taskViewHandlers.handleUpdateTaskView(viewId, name, icon);
        return;
    }

    const deleteTaskViewBtn = target.closest<HTMLElement>('.delete-task-view-btn');
    if (deleteTaskViewBtn) {
        await taskViewHandlers.handleDeleteTaskView(deleteTaskViewBtn.dataset.viewId!);
        return;
    }

    const addTaskViewBtn = target.closest<HTMLElement>('#add-task-view-btn');
    if (addTaskViewBtn) {
        const nameInput = document.getElementById('new-task-view-name') as HTMLInputElement;
        const iconInput = document.getElementById('new-task-view-icon') as HTMLInputElement;
        if (nameInput && iconInput && nameInput.value.trim()) {
            await taskViewHandlers.handleCreateTaskView(nameInput.value.trim(), iconInput.value.trim());
            nameInput.value = '';
            iconInput.value = 'checklist';
        }
        return;
    }
}