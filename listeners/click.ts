
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
import * as clientHandlers from '../handlers/clients.ts';
import * as projectHandlers from '../handlers/projects.ts';
import * as userHandlers from '../handlers/user.ts';
import { TaskDetailModal } from '../components/modals/TaskDetailModal.ts';
import { apiFetch } from '../services/api.ts';
import * as projectSections from '../handlers/projectSections.ts';

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

export async function handleClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const target = e.target as Element;
    
    // --- Generic Menu Toggling ---
    const menuToggle = target.closest<HTMLElement>('[data-menu-toggle]');
    // Close menus if clicking outside
    if (!menuToggle && !target.closest('[aria-haspopup="true"] + div')) {
        document.querySelectorAll('[aria-haspopup="true"] + div').forEach(menu => menu.classList.add('hidden'));
        document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    }

    if (menuToggle) {
        const menuId = menuToggle.dataset.menuToggle!;
        const menu = document.getElementById(menuId);
        if (menu) {
            const isHidden = menu.classList.contains('hidden');
            // Close all other menus before opening a new one
            document.querySelectorAll('[aria-haspopup="true"] + div').forEach(m => m.classList.add('hidden'));
            document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
            
            if (isHidden) {
                menu.classList.remove('hidden');
                menuToggle.setAttribute('aria-expanded', 'true');
            } else {
                menu.classList.add('hidden');
                menuToggle.setAttribute('aria-expanded', 'false');
            }
        }
        return;
    }


    // --- Global Timer ---
    if (target.closest('#global-timer-toggle')) {
        if (state.ui.globalTimer.isRunning) {
            timerHandlers.stopGlobalTimer();
        } else {
            timerHandlers.startGlobalTimer();
        }
        return;
    }

    // --- FAB Logic ---
    const fabContainer = document.getElementById('fab-container');
    if (target.closest('#fab-main-btn')) {
        fabContainer?.classList.toggle('is-open');
        return;
    }
    if (fabContainer?.classList.contains('is-open') && !target.closest('.fab-container')) {
        fabContainer.classList.remove('is-open');
    }

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

    // --- Project Section management ---
    const addSectionBtn = target.closest('#add-project-section-btn');
    if (addSectionBtn) {
        const projectId = (addSectionBtn as HTMLElement).dataset.projectId;
        const sectionName = prompt("Enter new section name:");
        if (projectId && sectionName) {
            await projectSections.handleCreateProjectSection(projectId, sectionName);
        }
        return;
    }
    const renameProjectSectionBtn = target.closest<HTMLElement>('[data-rename-project-section-id]');
    if (renameProjectSectionBtn) {
        const sectionId = renameProjectSectionBtn.dataset.renameProjectSectionId!;
        const section = state.projectSections.find(ps => ps.id === sectionId);
        if (section) {
            const newName = prompt("Enter new name for the section:", section.name);
            if (newName) {
                await projectSections.handleRenameProjectSection(sectionId, newName);
            }
        }
        return;
    }
    const deleteProjectSectionBtn = target.closest<HTMLElement>('[data-delete-project-section-id]');
    if (deleteProjectSectionBtn) {
        await projectSections.handleDeleteProjectSection(deleteProjectSectionBtn.dataset.deleteProjectSectionId!);
        return;
    }


    // --- Task Detail Modal Edit Mode ---
    const startEditBtn = target.closest('[data-task-edit-start]');
    if (startEditBtn) {
        state.ui.taskDetail.isEditing = true;
        renderApp();
        return;
    }
    const cancelEditBtn = target.closest('[data-task-edit-cancel]');
    if (cancelEditBtn) {
        state.ui.taskDetail.isEditing = false;
        renderApp();
        return;
    }
    const saveEditBtn = target.closest('[data-task-edit-save]');
    if (saveEditBtn) {
        const taskId = state.ui.modal.data?.taskId;
        if (taskId) {
            const editContainer = document.getElementById('task-detail-header-edit');
            if (editContainer) {
                const fieldsToUpdate = editContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]');
                fieldsToUpdate.forEach(field => {
                    taskHandlers.handleTaskDetailUpdate(taskId, field.dataset.field as any, field.value);
                });
            }
        }
        state.ui.taskDetail.isEditing = false;
        // The last handleTaskDetailUpdate will trigger a renderApp.
        return;
    }

    // Dashboard Edit Mode
    if (target.closest('#toggle-dashboard-edit-mode')) { dashboardHandlers.toggleEditMode(); return; }
    const addWidgetBtn = target.closest<HTMLElement>('[data-add-widget-type]');
    if (addWidgetBtn) {
        const type = addWidgetBtn.dataset.addWidgetType as DashboardWidgetType;
        const metric = addWidgetBtn.dataset.metricType as any;
        dashboardHandlers.addWidget(type, metric);
        return;
    }
    const removeWidgetBtn = target.closest<HTMLElement>('.remove-widget-btn');
    if (removeWidgetBtn) {
        dashboardHandlers.removeWidget(removeWidgetBtn.dataset.removeWidgetId!);
        return;
    }
    const configureWidgetBtn = target.closest<HTMLElement>('[data-configure-widget-id]');
    if (configureWidgetBtn) {
        dashboardHandlers.showConfigureWidgetModal(configureWidgetBtn.dataset.configureWidgetId!);
        return;
    }


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
        await clientHandlers.handleDeleteClient(clientId);
        return;
    }

    const deleteProjectBtn = target.closest<HTMLElement>('[data-delete-project-id]');
    if (deleteProjectBtn) {
        if (confirm("Are you sure you want to delete this project? This will also delete all associated tasks and cannot be undone.")) {
            await projectHandlers.handleDeleteProject(deleteProjectBtn.dataset.deleteProjectId!);
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

    const toggleKanbanViewBtn = target.closest<HTMLElement>('[data-toggle-kanban-view]');
    if (toggleKanbanViewBtn) {
        userHandlers.handleToggleKanbanViewMode();
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
    const subtaskItem = target.closest<HTMLElement>('.subtask-item-enhanced');
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
    
    // Detail Panel Openers (Modified Logic)
    const taskElement = target.closest<HTMLElement>('.task-card, .task-list-row, .project-task-row');
    if (taskElement) {
        // Exclude clicks on interactive elements within the task card/row
        if (target.closest('.task-card-menu-btn, .timer-controls, a, button, .task-status-toggle')) return;

        const taskId = taskElement.dataset.taskId!;
        
        // If the task is clicked inside the project panel, just open the modal without changing the page.
        if (taskElement.matches('.project-task-row')) {
            uiHandlers.showModal('taskDetail', { taskId });
        } else {
            // Otherwise (e.g., on the main tasks page), update the URL and show the modal.
            uiHandlers.updateUrlAndShowDetail('task', taskId);
        }
        return;
    }


    const projectListItem = target.closest<HTMLElement>('[data-project-id]');
    if (projectListItem) {
        if (target.closest('a, button, [data-menu-toggle]')) return;
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
            renderApp();
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
    
    // Wiki buttons
    if (target.closest('#edit-wiki-btn')) { wikiHandlers.startWikiEdit(); return; }
    if (target.closest('#cancel-wiki-btn')) { wikiHandlers.cancelWikiEdit(); return; }
    if (target.closest('#save-wiki-btn')) { wikiHandlers.saveWikiEdit(); return; }
    if (target.closest('#wiki-history-btn')) { uiHandlers.showModal('wikiHistory', { projectId: target.closest<HTMLElement>('[data-project-id]')?.dataset.projectId }); return; }
    const restoreWikiBtn = target.closest<HTMLElement>('[data-restore-history-id]');
    if(restoreWikiBtn) { wikiHandlers.handleRestoreWikiVersion(restoreWikiBtn.dataset.restoreHistoryId!); return; }
    if (target.closest('#save-as-template-btn')) { mainHandlers.handleSaveProjectAsTemplate(target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId!); return; }


    // Global buttons that might be anywhere
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
    if (notificationTab && notificationTab.closest('.flex.border-b')) { // A bit fragile, but targets notification tabs
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
        if (confirm('--- START OF FILE listeners/change.ts ---




import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
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

    if (target.matches('[data-change-role-for-member-id]')) {
        const select = target as HTMLSelectElement;
        const memberId = select.dataset.changeRoleForMemberId!;
        const newRole = select.value as Role;
        teamHandlers.handleChangeUserRole(memberId, newRole);
        return;
    }

    const projectRoleSelect = target.closest<HTMLSelectElement>('[data-project-member-id]');
    if (projectRoleSelect) {
        const memberId = projectRoleSelect.dataset.projectMemberId!;
        const newRole = projectRoleSelect.value as ProjectRole;
        teamHandlers.handleChangeProjectMemberRole(memberId, newRole);
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
    
    // Multi-select checkbox handling for assignees in Add Task modal
    const assigneeCheckbox = target.closest<HTMLInputElement>('#taskAssigneesSelector input[type="checkbox"]');
    if (assigneeCheckbox) {
        const container = document.getElementById('taskAssigneesSelector');
        const display = container?.querySelector('.multiselect-display');
        if (container && display) {
            const checkedBoxes = container.querySelectorAll<HTMLInputElement>('input:checked');
            display.innerHTML = ''; // Clear current display
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

    // Multi-select checkbox handling for tags in Add Task modal
    const tagCheckbox = target.closest<HTMLInputElement>('#taskTagsSelector input[type="checkbox"]');
    if (tagCheckbox) {
        const container = document.getElementById('taskTagsSelector');
        const display = container?.querySelector('.multiselect-display');
        if (container && display) {
            const checkedBoxes = container.querySelectorAll<HTMLInputElement>('input:checked');
            display.innerHTML = ''; // Clear
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
                membersSection.classList.remove('hidden');
            } else {
                membersSection.classList.add('hidden');
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

            apiFetch('/api?action=save-workspace-prefs', {
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

    // Task Filter Change
    const taskFilterInput = target.closest('#task-filter-panel input, #task-filter-panel select');
    if (taskFilterInput) {
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
            renderApp();
        } else {
            filterHandlers.handleFilterChange(taskFilterInput as HTMLInputElement | HTMLSelectElement);
        }
        return;
    }

    // Automations Modal Project Selector
    if (target.id === 'automation-project-selector') {
        const projectId = (target as HTMLSelectElement).value;
        state.ui.modal.data = { ...state.ui.modal.data, selectedProjectId: projectId };
        renderApp();
        return;
    }

    // Assign Global Time Modal Project Selector
    if (target.id === 'assign-time-project-select') {
        const projectId = (target as HTMLSelectElement).value;
        state.ui.modal.data.selectedProjectId = projectId;
        renderApp();
        return;
    }

    // Add Task Modal Project Selector
    if (target.id === 'taskProject') {
        const projectId = (target as HTMLSelectElement).value;
        const project = state.projects.find(p => p.id === projectId);
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
}
