
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
import * as filterHandlers from '../handlers/filters.ts';
import { TaskDetailModal } from '../components/modals/TaskDetailModal.ts';
import { apiFetch } from '../services/api.ts';

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
            <span>${t('hr.remove')}</span>
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

async function handleDeleteClient(clientId: string) {
    if (!confirm('Are you sure you want to delete this client and all associated data (projects, tasks, invoices)? This is irreversible.')) {
        return;
    }

    try {
        // The API backend should have cascading deletes.
        await apiFetch(`/api/data/clients`, {
            method: 'DELETE',
            body: JSON.stringify({ id: clientId }),
        });

        // After successful deletion, update the state.
        const originalClientCount = state.clients.length;
        state.clients = state.clients.filter(c => c.id !== clientId);

        // If a client was actually removed, proceed to clean up related data from state.
        if (state.clients.length < originalClientCount) {
            const projectsToDelete = state.projects.filter(p => p.clientId === clientId).map(p => p.id);
            state.projects = state.projects.filter(p => p.clientId !== clientId);
            state.tasks = state.tasks.filter(t => !projectsToDelete.includes(t.projectId));
            state.invoices = state.invoices.filter(i => i.clientId !== clientId);
            state.clientContacts = state.clientContacts.filter(cc => cc.clientId !== clientId);
        }
        
        renderApp();
    } catch (error) {
        console.error("Failed to delete client:", error);
        alert("Could not delete client from the server.");
    }
}


export async function handleClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const target = e.target as Element;

    // --- START TASK MENU LOGIC ---
    const menuBtn = target.closest<HTMLElement>('.task-card-menu-btn');
    if (menuBtn) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = menuBtn.closest<HTMLElement>('[data-task-id]')!.dataset.taskId!;
        showTaskCardMenu(taskId, menuBtn);
        return;
    }

    // Close menu if clicking outside. This needs to be near the top.
    if (!target.closest('.task-card-menu')) {
        closeAllTaskMenus();
    }
    
    const editTaskBtn = target.closest<HTMLElement>('[data-edit-task-id]');
    if (editTaskBtn) {
        uiHandlers.showModal('taskDetail', { taskId: editTaskBtn.dataset.editTaskId! });
        closeAllTaskMenus();
        return;
    }

    const archiveTaskBtn = target.closest<HTMLElement>('[data-archive-task-id]');
    if (archiveTaskBtn) {
        taskHandlers.handleToggleTaskArchive(archiveTaskBtn.dataset.archiveTaskId!);
        closeAllTaskMenus();
        return;
    }
    
    const deleteTaskBtn = target.closest<HTMLElement>('[data-delete-task-id]');
    if (deleteTaskBtn) {
        taskHandlers.handleDeleteTask(deleteTaskBtn.dataset.deleteTaskId!);
        closeAllTaskMenus();
        return;
    }
    // --- END TASK MENU LOGIC ---

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

    const deleteClientBtn = target.closest<HTMLElement>('[data-delete-client-id]');
    if (deleteClientBtn) {
        const clientId = deleteClientBtn.dataset.deleteClientId!;
        await handleDeleteClient(clientId);
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
            // Manually dispatch change event
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Do not return, let other logic handle closing if needed.
    } else if (!target.closest('#task-filter-tags-container')) {
        document.getElementById('task-filter-tags-dropdown')?.classList.add('hidden');
    }

    // Onboarding
    if (target.closest('.onboarding-next-btn')) { onboardingHandlers.nextStep(); return; }
    if (target.closest('.onboarding-skip-btn')) { onboardingHandlers.finishOnboarding(); return; }

    // Auth Page
    const authTab = target.closest<HTMLElement>('[data-auth-tab]');
    if (authTab) {
        const tabName = authTab.dataset.authTab;
        document.querySelectorAll('[data-auth-tab]').forEach(t => t.classList.remove('active'));
        authTab.classList.add('active');
        const container = document.getElementById('auth-form-container')!;
        if (tabName === 'login') container.innerHTML = renderLoginForm();
        else container.innerHTML = renderRegisterForm();
        return;
    }
    
    if (target.closest<HTMLElement>('[data-logout-button]')) { auth.logout(); return; }

    // Close popovers if click is outside
    if (!target.closest('#notification-bell') && state.ui.isNotificationsOpen) { notificationHandlers.toggleNotificationsPopover(false); }
    if (!target.closest('.command-palette') && state.ui.isCommandPaletteOpen) { uiHandlers.toggleCommandPalette(false); }
    if (!target.closest('.project-menu-btn') && !target.closest('.project-header-menu')) { mainHandlers.closeProjectMenu(); }


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
        const isRunning = timerButton.classList.contains('text-primary'); // Check for active class
        if (isRunning) { timerHandlers.stopTimer(taskId); } else { timerHandlers.startTimer(taskId); }
        return;
    }

    const viewSwitcher = target.closest<HTMLElement>('[data-view-mode]');
    if(viewSwitcher) { 
        state.ui.tasks.viewMode = viewSwitcher.dataset.viewMode as any; 
        renderApp(); 
        return; 
    }

    const statusToggleBtn = target.closest<HTMLElement>('.task-status-toggle');
    if (statusToggleBtn) {
        const taskId = statusToggleBtn.dataset.taskId!;
        taskHandlers.handleToggleProjectTaskStatus(taskId);
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

    // Detail Panel Openers (Reverted Logic)
    const taskElement = target.closest<HTMLElement>('[data-task-id].task-card, [data-task-id].grid, .task-list-row[data-task-id]');
    if (taskElement) {
        if (target.closest('.task-card-menu-btn, .timer-controls, a, button')) return;
        uiHandlers.updateUrlAndShowDetail('task', taskElement.dataset.taskId!);
        return;
    }

    const projectListItem = target.closest<HTMLElement>('[data-project-id]');
    if (projectListItem) {
        if (target.closest('a, button, .project-menu-btn')) return;
        uiHandlers.updateUrlAndShowDetail('project', projectListItem.dataset.projectId!);
        return;
    }

    const clientListItem = target.closest<HTMLElement>('[data-client-id]');
    if (clientListItem) {
        if (target.closest('a, button')) return;
        uiHandlers.updateUrlAndShowDetail('client', clientListItem.dataset.clientId!);
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

    const settingsTab = target.closest<HTMLElement>('[data-tab]');
    if (settingsTab && settingsTab.closest('nav')) {
        const tab = settingsTab.dataset.tab;
        if (tab && state.ui.settings.activeTab !== tab) {
            state.ui.settings.activeTab = tab as any;
            renderApp();
        }
        return;
    }

    const hrTab = target.closest<HTMLElement>('[data-hr-tab]');
    if (hrTab) {
        teamHandlers.handleSwitchHrTab(hrTab.dataset.hrTab as any);
        return;
    }

    const inviteMemberBtn = target.closest('#hr-invite-member-btn');
    if (inviteMemberBtn) {
        document.getElementById('hr-invite-flyout')?.classList.add('translate-x-0');
        document.getElementById('hr-invite-flyout')?.classList.remove('translate-x-full');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.add('opacity-100', 'pointer-events-auto');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.remove('opacity-0', 'pointer-events-none');
        return;
    }

    const closeFlyoutBtn = target.closest('#hr-invite-cancel-btn') || target.matches('#hr-invite-flyout-backdrop');
    if (closeFlyoutBtn) {
        document.getElementById('hr-invite-flyout')?.classList.remove('translate-x-0');
        document.getElementById('hr-invite-flyout')?.classList.add('translate-x-full');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.remove('opacity-100', 'pointer-events-auto');
        document.getElementById('hr-invite-flyout-backdrop')?.classList.add('opacity-0', 'pointer-events-none');
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


    if (target.closest('.btn-close-panel') || target.matches('#side-panel-overlay')) { uiHandlers.closeSidePanels(); return; }


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
            const modalContent = document.querySelector('.modal-content .p-4, .modal-content .sm\\:p-6');
            if (modalContent && state.ui.modal.data?.taskId) {
                modalContent.innerHTML = TaskDetailModal({ taskId: state.ui.modal.data.taskId });
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
    const modal = target.closest<HTMLElement>('[role="dialog"]');
    if (modal && e.target === modal) {
        uiHandlers.closeModal(); return;
    }

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
    const notificationTab = target.closest<HTMLElement>('[data-tab]');
    if (notificationTab && notificationTab.closest('.notification-tabs')) {
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

    // Task Filters & Saved Views
    if (target.closest('#toggle-filters-btn')) { uiHandlers.toggleTaskFilters(); return; }
    const applyFilterViewBtn = target.closest<HTMLElement>('[data-apply-filter-view-id]');
    if (applyFilterViewBtn) {
        filterHandlers.applyFilterView(applyFilterViewBtn.dataset.applyFilterViewId!);
        return;
    }
    if (target.closest('#save-task-filter-view-btn')) { filterHandlers.saveCurrentFilterView(); return; }
    if (target.closest('#update-task-filter-view-btn')) { filterHandlers.updateActiveFilterView(); return; }
    if (target.closest('#delete-task-filter-view-btn')) { filterHandlers.deleteActiveFilterView(); return; }
    if (target.closest('#reset-task-filters')) {
        filterHandlers.resetFilters();
        return;
    }
    
    // Custom Fields
    const deleteCustomFieldBtn = target.closest<HTMLElement>('[data-field-id]');
    if (deleteCustomFieldBtn && deleteCustomFieldBtn.closest('#custom-fields-list')) {
        taskHandlers.handleDeleteCustomFieldDefinition(deleteCustomFieldBtn.dataset.fieldId!); return;
    }

    // Attachments
    const deleteAttachmentBtn = target.closest<HTMLElement>('.delete-attachment-btn');
    if(deleteAttachmentBtn) { taskHandlers.handleRemoveAttachment(deleteAttachmentBtn.dataset.attachmentId!); return; }
    const attachGoogleDriveBtn = target.closest<HTMLElement>('#attach-google-drive-btn');
    if (attachGoogleDriveBtn) {
        const taskId = attachGoogleDriveBtn.dataset.taskId!;
        taskHandlers.handleAttachGoogleDriveFile(taskId);
        return;
    }
}
