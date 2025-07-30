import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { generateInvoicePDF } from '../services.ts';
import type { Role, PlanId, User, DashboardWidgetType, ClientContact, ProjectRole, SortByOption, Task } from '../types.ts';
import { t } from '../i1n.ts';
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
import * as goalHandlers from '../handlers/goals.ts';
import { getWorkspaceKanbanWorkflow } from '../handlers/main.ts';
import * as pipelineHandlers from '../handlers/pipeline.ts';
import * as tagHandlers from '../handlers/tags.ts';
import * as kanbanHandlers from '../handlers/kanban.ts';

function closeDynamicMenus() {
    document.querySelectorAll('#dynamic-role-menu, .task-card-menu').forEach(menu => menu.remove());
}


function showTaskCardMenu(taskId: string, buttonElement: HTMLElement) {
    closeDynamicMenus();

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const menu = document.createElement('div');
    menu.className = 'task-card-menu dropdown-menu';
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

function closeMobileMenu() {
    document.getElementById('app-sidebar')?.classList.remove('is-mobile-menu-open');
    document.getElementById('mobile-menu-overlay')?.classList.remove('is-open');
}

export async function handleClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const target = e.target as Element;

    // --- Global Click Handlers ---
    const fabContainer = document.getElementById('fab-container');
    const mainFabButton = target.closest('#fab-main-btn');

    if (mainFabButton) {
        fabContainer?.classList.toggle('is-open');
        return;
    }
    if (fabContainer?.classList.contains('is-open') && !target.closest('#fab-container')) {
        fabContainer.classList.remove('is-open');
    }

    if (target.closest('#mobile-menu-toggle')) {
        document.getElementById('app-sidebar')?.classList.toggle('is-mobile-menu-open');
        document.getElementById('mobile-menu-overlay')?.classList.toggle('is-open');
        return;
    }

    if (target.closest('#mobile-menu-overlay')) {
        closeMobileMenu();
        return;
    }
    
    // --- START: New Handlers for Comments & Reactions ---

    // Reply button
    const replyBtn = target.closest<HTMLElement>('[data-reply-to-comment-id]');
    if (replyBtn) {
        const commentId = replyBtn.dataset.replyToCommentId!;
        const container = document.getElementById(`reply-form-container-${commentId}`);
        if (container) {
            if (container.innerHTML) { // Form is open, so close it
                container.innerHTML = '';
            } else { // Form is closed, so open it
                container.innerHTML = `
                    <form class="reply-form" data-task-id="${state.ui.modal.data.taskId}" data-parent-id="${commentId}">
                        <div class="rich-text-input-container">
                            <div class="rich-text-input" contenteditable="true" data-placeholder="${t('modals.add_comment')}"></div>
                        </div>
                        <div class="flex justify-end gap-2 mt-2">
                            <button type="button" class="btn btn-secondary btn-sm cancel-reply-btn">${t('modals.cancel')}</button>
                            <button type="submit" class="btn btn-primary btn-sm">${t('modals.reply_button')}</button>
                        </div>
                    </form>
                `;
                container.querySelector<HTMLElement>('.rich-text-input')?.focus();
            }
        }
        return;
    }
    
    // Cancel reply button
    if (target.closest('.cancel-reply-btn')) {
        target.closest('.reply-form-container')!.innerHTML = '';
        return;
    }
    
    // React button
    const reactBtn = target.closest<HTMLElement>('[data-react-to-comment-id]');
    if (reactBtn) {
        const commentId = reactBtn.dataset.reactToCommentId!;
        const picker = document.getElementById(`reaction-picker-${commentId}`);
        if(picker) {
            const isHidden = picker.classList.contains('hidden');
            // Close all other pickers
            document.querySelectorAll('.reaction-picker').forEach(p => p.classList.add('hidden'));
            if(isHidden) picker.classList.remove('hidden');
        }
        return;
    }
    
    // Close reaction pickers if clicking outside
    if (!target.closest('.reaction-picker') && !target.closest('[data-react-to-comment-id]')) {
        document.querySelectorAll('.reaction-picker').forEach(p => p.classList.add('hidden'));
    }
    
    // Emoji button in picker
    const emojiBtn = target.closest<HTMLElement>('.reaction-picker button[data-emoji]');
    if (emojiBtn) {
        const commentId = emojiBtn.closest('.reaction-picker')!.id.replace('reaction-picker-', '');
        const emoji = emojiBtn.dataset.emoji!;
        taskHandlers.handleToggleReaction(commentId, emoji);
        emojiBtn.closest('.reaction-picker')!.classList.add('hidden'); // Close picker after reaction
        return;
    }
    
    // Reaction chip button (to toggle)
    const reactionChip = target.closest<HTMLElement>('.reaction-chip');
    if (reactionChip) {
        const commentId = reactionChip.dataset.commentId!;
        const emoji = reactionChip.dataset.emoji!;
        taskHandlers.handleToggleReaction(commentId, emoji);
        return;
    }

    // --- END: New Handlers for Comments & Reactions ---

    // Handle clicks outside of dynamic menus FIRST
    if (!target.closest('[data-role-menu-for-member-id]') && !target.closest('#dynamic-role-menu')) {
        closeDynamicMenus();
    }
    
    // --- START: Dynamic Role Menu Handler ---
    const roleMenuToggle = target.closest<HTMLElement>('[data-role-menu-for-member-id]');
    if (roleMenuToggle) {
        e.stopPropagation(); // Prevent immediate closing
        const memberId = roleMenuToggle.dataset.roleMenuForMemberId!;
        const member = state.workspaceMembers.find(m => m.id === memberId);
        
        closeDynamicMenus(); // Close any existing menu

        if (!member) return;

        const menu = document.createElement('div');
        menu.id = 'dynamic-role-menu';
        // Use existing classes for styling consistency
        menu.className = 'dropdown-menu role-menu'; 
        
        const ALL_ROLES: Role[] = ['owner', 'admin', 'manager', 'member', 'finance', 'client'];
        menu.innerHTML = ALL_ROLES.filter(r => r !== 'owner').map(role => `
            <button class="role-menu-item ${member.role === role ? 'active' : ''}" data-new-role-for-member-id="${member.id}" data-role="${role}">
                ${t(`hr.role_${role}`)}
            </button>
        `).join('');

        document.body.appendChild(menu);

        const btnRect = roleMenuToggle.getBoundingClientRect();
        menu.style.position = 'absolute';
        menu.style.top = `${btnRect.bottom + window.scrollY + 5}px`;
        menu.style.left = `${btnRect.left + window.scrollX}px`;
        menu.style.zIndex = '100'; // High z-index to ensure it's on top
        
        return; // Stop further processing for this click
    }

    // Handle clicking a role item from the dynamic menu
    const roleMenuItem = target.closest<HTMLElement>('[data-new-role-for-member-id]');
    if (roleMenuItem) {
        const memberId = roleMenuItem.dataset.newRoleForMemberId!;
        const newRole = roleMenuItem.dataset.role as Role;
        teamHandlers.handleChangeUserRole(memberId, newRole);
        closeDynamicMenus();
        return;
    }
    // --- END: Dynamic Role Menu Handler ---

    const menuToggle = target.closest<HTMLElement>('[data-menu-toggle]');
    const associatedMenu = menuToggle ? document.getElementById(menuToggle.dataset.menuToggle!) : null;

    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== associatedMenu && menu.id !== 'dynamic-role-menu') {
            menu.classList.add('hidden');
            const correspondingToggle = document.querySelector(`[data-menu-toggle="${menu.id}"]`);
            if (correspondingToggle) correspondingToggle.setAttribute('aria-expanded', 'false');
        }
    });

    if (!menuToggle && !target.closest('.dropdown-menu')) {
         document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    }

    if (menuToggle && associatedMenu) {
        closeDynamicMenus();
        const isHidden = associatedMenu.classList.toggle('hidden');
        menuToggle.setAttribute('aria-expanded', String(!isHidden));
        return;
    }
    
    const multiSelectDisplay = target.closest<HTMLElement>('.multiselect-display, #task-filter-tags-toggle, #client-filter-tags-toggle, #project-filter-tags-toggle');
    if (multiSelectDisplay) {
        const container = multiSelectDisplay.closest<HTMLElement>('.multiselect-container, [id*="-filter-tags-container"]');
        const dropdown = container?.querySelector<HTMLElement>('.multiselect-dropdown');
        if (dropdown) {
            const isHidden = dropdown.classList.contains('hidden');
            document.querySelectorAll('.multiselect-dropdown').forEach(d => {
                if(d !== dropdown) d.classList.add('hidden');
            });
            if (isHidden) {
                dropdown.classList.remove('hidden');
            } else {
                dropdown.classList.add('hidden');
            }
        }
        return;
    }
    
    if (!target.closest('.multiselect-container, [id*="-filter-tags-container"]')) {
        document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.add('hidden'));
    }

    if (!target.closest('.task-card-menu-btn')) closeDynamicMenus();
    if (!target.closest('#notification-bell') && !target.closest('.absolute.top-full.right-0')) {
        if(state.ui.isNotificationsOpen) notificationHandlers.toggleNotificationsPopover(false);
    }
    if (!target.closest('.command-palette') && state.ui.isCommandPaletteOpen) uiHandlers.toggleCommandPalette(false);
    if (state.ui.onboarding.isActive && !target.closest('.absolute.bg-content')) onboardingHandlers.finishOnboarding();

    const navLink = target.closest('a');
    if (navLink && navLink.hostname === window.location.hostname && !navLink.href.startsWith('mailto:')) {
        const isPlaceholder = navLink.getAttribute('href') === '#';
        if (!isPlaceholder) {
            e.preventDefault(); 
            const isDifferentPage = window.location.pathname !== navLink.pathname || window.location.search !== navLink.search;
            if (isDifferentPage) {
                history.pushState({}, '', navLink.href);
                updateUI(['page', 'sidebar']);
            }
            if (navLink.closest('#app-sidebar')) {
                closeMobileMenu();
            }
            return;
        }
    }

    const modalTarget = target.closest<HTMLElement>('[data-modal-target]');
    if (modalTarget) {
        if (target.closest('.fab-option')) {
            fabContainer?.classList.remove('is-open');
        }
        uiHandlers.showModal(modalTarget.dataset.modalTarget as any, { ...modalTarget.dataset });
        return;
    }
    const saveModalBtn = target.closest('#modal-save-btn');
    if (saveModalBtn) {
        formHandlers.handleFormSubmit();
        return;
    }
    if (target.closest('.btn-close-modal') || target.matches('.fixed.inset-0.bg-black\\/50')) {
        uiHandlers.closeModal();
        return;
    }

    if (target.closest('.btn-close-panel, #side-panel-overlay')) { uiHandlers.closeSidePanels(); return; }
    
    const projectCard = target.closest<HTMLElement>('.projects-grid [data-project-id], .associated-projects-list [data-project-id], .portfolio-table-row[data-project-id]');
    if (projectCard && !target.closest('button, a, .multiselect-container')) {
        uiHandlers.updateUrlAndShowDetail('project', projectCard.dataset.projectId!);
        return;
    }

    const clientCard = target.closest<HTMLElement>('[data-client-id]:not([data-modal-target])');
    if (clientCard && !target.closest('button, a, .multiselect-container')) {
        uiHandlers.updateUrlAndShowDetail('client', clientCard.dataset.clientId!);
        return;
    }
    
    const dealCard = target.closest<HTMLElement>('.deal-card');
    if (dealCard && !target.closest('button, a')) {
        uiHandlers.updateUrlAndShowDetail('deal', dealCard.dataset.dealId!);
        return;
    }
    
    const taskCardOrRow = target.closest<HTMLElement>('.modern-list-row, .task-card, [data-task-id]');
    if (taskCardOrRow && !target.closest('button, a, input, textarea, select, [contenteditable="true"], .timer-controls, .task-card-menu-btn')) {
        const taskId = taskCardOrRow.dataset.taskId;
        if (taskId) {
            uiHandlers.updateUrlAndShowDetail('task', taskId);
            return;
        }
    }

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

    if (target.closest('#toggle-dashboard-edit-mode')) { dashboardHandlers.toggleEditMode(); return; }
    if (target.closest<HTMLElement>('[data-dashboard-tab]')) { state.ui.dashboard.activeTab = target.closest<HTMLElement>('[data-dashboard-tab]')!.dataset.dashboardTab as any; updateUI(['page']); return; }
    if (target.closest<HTMLElement>('[data-add-widget-type]')) { const btn = target.closest<HTMLElement>('[data-add-widget-type]')!; dashboardHandlers.addWidget(btn.dataset.addWidgetType as any, btn.dataset.metricType as any); return; }
    if (target.closest<HTMLElement>('.remove-widget-btn')) { dashboardHandlers.removeWidget(target.closest<HTMLElement>('.remove-widget-btn')!.dataset.removeWidgetId!); return; }
    if (target.closest<HTMLElement>('[data-configure-widget-id]')) { dashboardHandlers.showConfigureWidgetModal(target.closest<HTMLElement>('[data-configure-widget-id]')!.dataset.configureWidgetId!); return; }
    const taskWidgetTab = target.closest<HTMLElement>('[data-task-widget-tab]');
    if (taskWidgetTab) {
        const widgetId = taskWidgetTab.closest<HTMLElement>('[data-widget-id]')!.dataset.widgetId!;
        const filter = taskWidgetTab.dataset.taskWidgetTab!;
        dashboardHandlers.handleSwitchTaskWidgetTab(widgetId, filter);
        return;
    }

    const clientFilterStatusBtn = target.closest<HTMLElement>('[data-client-filter-status]');
    if (clientFilterStatusBtn) { state.ui.clients.filters.status = clientFilterStatusBtn.dataset.clientFilterStatus as any; updateUI(['page']); return; }
    if (target.closest<HTMLElement>('[data-delete-client-id]')) { await clientHandlers.handleDeleteClient(target.closest<HTMLElement>('[data-delete-client-id]')!.dataset.deleteClientId!); return; }
    if (target.closest('#add-contact-row-btn')) { document.getElementById('client-contacts-container')?.insertAdjacentHTML('beforeend', renderNewClientContactFormRow()); return; }
    const removeContactRowBtn = target.closest('.remove-contact-row-btn');
    if (removeContactRowBtn) {
        const row = removeContactRowBtn.closest<HTMLElement>('.contact-form-row');
        if (row) {
            const contactId = row.dataset.contactId;
            if (contactId && !contactId.startsWith('new-')) {
                const deletedIdsInput = document.getElementById('deleted-contact-ids') as HTMLInputElement;
                const currentIds = deletedIdsInput.value.split(',').filter(Boolean);
                currentIds.push(contactId);
                deletedIdsInput.value = currentIds.join(',');
            }
            row.remove();
        }
        return;
    }
    
    if (target.closest<HTMLElement>('[data-download-invoice-id]')) { generateInvoicePDF(target.closest<HTMLElement>('[data-download-invoice-id]')!.dataset.downloadInvoiceId!); return; }
    if (target.closest<HTMLElement>('[data-send-invoice-id]')) { invoiceHandlers.handleSendInvoiceByEmail(target.closest<HTMLElement>('[data-send-invoice-id]')!.dataset.sendInvoiceId!); return; }
    if (target.closest<HTMLElement>('[data-toggle-invoice-status-id]')) { invoiceHandlers.handleToggleInvoiceStatus(target.closest<HTMLElement>('[data-toggle-invoice-status-id]')!.dataset.toggleInvoiceStatusId!); return; }
    if (target.closest('#generate-invoice-items-btn')) { invoiceHandlers.handleGenerateInvoiceItems(); return; }
    if (target.closest('#add-invoice-item-btn')) { if (state.ui.modal.type === 'addInvoice') { state.ui.modal.data.items.push({ id: `new-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }); updateUI(['modal']); } return; }
    const removeInvoiceItemBtn = target.closest('.remove-invoice-item-btn');
    if (removeInvoiceItemBtn) {
        const row = removeInvoiceItemBtn.closest<HTMLElement>('.invoice-item-row');
        if (row && state.ui.modal.type === 'addInvoice') {
            const itemId = row.dataset.itemId!;
            const itemIndex = state.ui.modal.data.items.findIndex((i: any) => i.id.toString() === itemId);
            if (itemIndex > -1) { state.ui.modal.data.items.splice(itemIndex, 1); updateUI(['modal']); }
        }
        return;
    }
    
    if (target.closest('#toggle-filters-btn')) { uiHandlers.toggleTaskFilters(); return; }
    if (target.closest('#reset-task-filters')) { filterHandlers.resetFilters(); return; }
    if (target.closest<HTMLElement>('[data-view-mode]')) {
        const newMode = target.closest<HTMLElement>('[data-view-mode]')!.dataset.viewMode as any;
        if (state.ui.tasks.viewMode !== newMode) {
            state.ui.tasks.viewMode = newMode;
            state.ui.tasks.sortBy = newMode === 'board' ? 'manual' : 'createdAt';
            updateUI(['page']);
        }
        return;
    }
    const ganttViewModeBtn = target.closest<HTMLElement>('[data-gantt-view-mode]');
    if (ganttViewModeBtn) {
        const mode = ganttViewModeBtn.dataset.ganttViewMode as 'Day' | 'Week' | 'Month';
        taskHandlers.handleChangeGanttViewMode(mode);
        return;
    }
    if (target.closest<HTMLElement>('[data-project-view-mode]')) {
        const newMode = target.closest<HTMLElement>('[data-project-view-mode]')!.dataset.projectViewMode as any;
        if (state.ui.projects.viewMode !== newMode) {
            state.ui.projects.viewMode = newMode;
            updateUI(['page']);
        }
        return;
    }
    if (target.closest('[data-sort-by]')) {
        const sortBy = target.closest<HTMLElement>('[data-sort-by]')!.dataset.sortBy as SortByOption;
        state.ui.tasks.sortBy = sortBy;
        updateUI(['page']);
        return;
    }
    if (target.closest('[data-toggle-kanban-view]')) { userHandlers.handleToggleKanbanViewMode(); return; }
    const taskCardMenuBtn = target.closest<HTMLElement>('.task-card-menu-btn');
    if (taskCardMenuBtn) { e.stopPropagation(); showTaskCardMenu(taskCardMenuBtn.closest<HTMLElement>('[data-task-id]')!.dataset.taskId!, taskCardMenuBtn); return; }
    if (target.closest<HTMLElement>('[data-edit-task-id]')) { uiHandlers.showModal('taskDetail', { taskId: target.closest<HTMLElement>('[data-edit-task-id]')!.dataset.editTaskId! }); return; }
    if (target.closest<HTMLElement>('[data-archive-task-id]')) { taskHandlers.handleToggleTaskArchive(target.closest<HTMLElement>('[data-archive-task-id]')!.dataset.archiveTaskId!); return; }
    if (target.closest<HTMLElement>('[data-delete-task-id]')) { taskHandlers.handleDeleteTask(target.closest<HTMLElement>('[data-delete-task-id]')!.dataset.deleteTaskId!); return; }
    if (target.closest<HTMLElement>('[data-timer-task-id]')) { const taskId = target.closest<HTMLElement>('[data-timer-task-id]')!.dataset.timerTaskId!; if (state.activeTimers[taskId]) timerHandlers.stopTimer(taskId); else timerHandlers.startTimer(taskId); return; }
    if (target.closest<HTMLElement>('[data-calendar-nav]')) {
        const navEl = target.closest<HTMLElement>('[data-calendar-nav]')!;
        const direction = navEl.dataset.calendarNav;
        if (navEl.dataset.targetCalendar === 'team') {
            const newDate = new Date(state.ui.teamCalendarDate);
            if (state.ui.teamCalendarView === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
            else if (state.ui.teamCalendarView === 'week') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
            else newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
            state.ui.teamCalendarDate = newDate.toISOString().slice(0, 10);
        } else {
            const newCalDate = new Date(state.ui.calendarDate + '-02');
            newCalDate.setMonth(newCalDate.getMonth() + (direction === 'next' ? 1 : -1));
            state.ui.calendarDate = newCalDate.toISOString().slice(0, 7);
        }
        updateUI(['page']);
        return;
    }
    const teamCalendarViewBtn = target.closest<HTMLElement>('[data-team-calendar-view]');
    if (teamCalendarViewBtn) {
        state.ui.teamCalendarView = teamCalendarViewBtn.dataset.teamCalendarView as 'month' | 'week' | 'day';
        updateUI(['page']);
        return;
    }
    if (target.closest<HTMLElement>('.task-status-toggle')) { taskHandlers.handleToggleProjectTaskStatus(target.closest<HTMLElement>('[data-task-id]')!.dataset.taskId!); return; }

    const detailTab = target.closest<HTMLElement>('.side-panel-tab, .task-detail-tab');
    if (detailTab) {
        const tab = detailTab.dataset.tab as any;
        if (target.closest('.task-detail-layout')) { state.ui.taskDetail.activeTab = tab; updateUI(['modal']); }
        else if (target.closest('.side-panel[aria-label*="Project"]')) { state.ui.openedProjectTab = tab; updateUI(['side-panel']); }
        else if (target.closest('.side-panel[aria-label*="Deal"]')) { state.ui.dealDetail.activeTab = tab; updateUI(['side-panel']); }
        return;
    }
    if (target.closest('.delete-checklist-item-btn')) { const taskId = state.ui.modal.data.taskId; const itemId = target.closest<HTMLElement>('[data-item-id]')!.dataset.itemId!; if(taskId && itemId) taskHandlers.handleDeleteChecklistItem(taskId, itemId); return; }
    if (target.closest('.delete-subtask-btn')) { taskHandlers.handleDeleteSubtask(target.closest<HTMLElement>('[data-subtask-id]')!.dataset.subtaskId!); return; }
    if (target.closest('[data-remove-dependency-id]')) { taskHandlers.handleRemoveDependency(target.closest<HTMLElement>('[data-remove-dependency-id]')!.dataset.removeDependencyId!); return; }
    if (target.closest('.delete-attachment-btn')) { taskHandlers.handleRemoveAttachment(target.closest<HTMLElement>('[data-attachment-id]')!.dataset.attachmentId!); return; }

    if (target.closest('#add-project-section-btn')) { uiHandlers.showModal('addProjectSection', { projectId: target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId }); return; }
    if (target.closest<HTMLElement>('[data-rename-project-section-id]')) { const sectionId = target.closest<HTMLElement>('[data-rename-project-section-id]')!.dataset.renameProjectSectionId!; const section = state.projectSections.find(ps => ps.id === sectionId); if (section) { const newName = prompt(t('modals.rename'), section.name); if (newName) await projectSectionHandlers.handleRenameProjectSection(sectionId, newName); } return; }
    if (target.closest<HTMLElement>('[data-delete-project-section-id]')) { await projectSectionHandlers.handleDeleteProjectSection(target.closest<HTMLElement>('[data-delete-project-section-id]')!.dataset.deleteProjectSectionId!); return; }
    
    const milestoneCheckbox = target.closest<HTMLInputElement>('.milestone-checkbox');
    if (milestoneCheckbox) {
        goalHandlers.handleToggleMilestone(milestoneCheckbox.dataset.milestoneId!);
        return;
    }

    const settingsTab = target.closest<HTMLElement>('nav a[data-tab]');
    if (settingsTab && (target.closest('div')?.id !== 'app')) {
        state.ui.settings.activeTab = settingsTab.dataset.tab as any;
        updateUI(['page']);
        return;
    }
    if (target.closest('#save-workspace-settings-btn')) { teamHandlers.handleSaveWorkspaceSettings(); return; }
    if (target.closest('#remove-logo-btn')) { const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId); if (ws) ws.companyLogo = undefined; teamHandlers.handleSaveWorkspaceSettings(); return; }
    if (target.closest('[data-connect-provider]')) { integrationHandlers.connectIntegration(target.closest<HTMLElement>('[data-connect-provider]')!.dataset.connectProvider as any); return; }
    if (target.closest('[data-disconnect-provider]')) { integrationHandlers.disconnectIntegration(target.closest<HTMLElement>('[data-disconnect-provider]')!.dataset.disconnectProvider as any); return; }
    if (target.closest('.edit-task-view-btn')) { target.closest('.task-view-item')?.classList.add('editing'); return; }
    if (target.closest('.cancel-task-view-edit-btn')) { target.closest('.task-view-item')?.classList.remove('editing'); return; }
    if (target.closest('.save-task-view-btn')) { const viewItem = target.closest<HTMLElement>('.task-view-item')!; const id = viewItem.dataset.viewId!; const name = viewItem.querySelector<HTMLInputElement>('input[name="view-name"]')!.value; const icon = viewItem.querySelector<HTMLInputElement>('input[name="view-icon"]')!.value; taskViewHandlers.handleUpdateTaskView(id, name, icon); return; }
    if (target.closest('.delete-task-view-btn')) { taskViewHandlers.handleDeleteTaskView(target.closest<HTMLElement>('[data-view-id]')!.dataset.viewId!); return; }
    if (target.closest('#add-task-view-btn')) { const name = document.getElementById('new-task-view-name') as HTMLInputElement; const icon = document.getElementById('new-task-view-icon') as HTMLInputElement; if (name.value) { taskViewHandlers.handleCreateTaskView(name.value, icon.value); name.value = ''; icon.value = 'checklist'; } return; }
    if (target.closest('[data-delete-pipeline-stage]')) { pipelineHandlers.handleDeleteStage(target.closest<HTMLElement>('[data-delete-pipeline-stage]')!.dataset.deletePipelineStage!); return; }
    if (target.closest('[data-save-pipeline-stage]')) { const stageId = target.closest<HTMLElement>('[data-save-pipeline-stage]')!.dataset.savePipelineStage!; const input = document.querySelector(`input[data-stage-name-id="${stageId}"]`) as HTMLInputElement; pipelineHandlers.handleUpdateStage(stageId, input.value); return; }
    if (target.closest('[data-save-kanban-stage]')) { const stageId = target.closest<HTMLElement>('[data-save-kanban-stage]')!.dataset.saveKanbanStage!; const input = document.querySelector(`input[data-stage-name-id="${stageId}"]`) as HTMLInputElement; kanbanHandlers.handleUpdateKanbanStageName(stageId, input.value); return; }

    const hrTab = target.closest<HTMLElement>('a[data-hr-tab]');
    if (hrTab) {
        teamHandlers.handleSwitchHrTab(hrTab.dataset.hrTab as any);
        return;
    }

    if (target.closest('#hr-invite-member-btn')) { document.getElementById('hr-invite-flyout')?.classList.add('is-open'); document.getElementById('hr-invite-flyout-backdrop')?.classList.add('is-open'); return; }
    if (target.closest('#hr-invite-cancel-btn, #hr-invite-flyout-backdrop')) { document.getElementById('hr-invite-flyout')?.classList.remove('is-open'); document.getElementById('hr-invite-flyout-backdrop')?.classList.remove('is-open'); return; }
    if (target.closest('[data-remove-member-id]')) { teamHandlers.handleRemoveUserFromWorkspace(target.closest<HTMLElement>('[data-remove-member-id]')!.dataset.removeMemberId!); return; }
    if (target.closest('[data-approve-join-request-id]')) { teamHandlers.handleApproveJoinRequest(target.closest<HTMLElement>('[data-approve-join-request-id]')!.dataset.approveJoinRequestId!); return; }
    if (target.closest('[data-reject-join-request-id]')) { teamHandlers.handleRejectJoinRequest(target.closest<HTMLElement>('[data-reject-join-request-id]')!.dataset.rejectJoinRequestId!); return; }
    if (target.closest('[data-approve-request-id]')) { teamHandlers.handleApproveTimeOffRequest(target.closest<HTMLElement>('[data-approve-request-id]')!.dataset.approveRequestId!); return; }
    if (target.closest('[data-reject-request-id]')) { uiHandlers.showModal('rejectTimeOffRequest', { requestId: target.closest<HTMLElement>('[data-reject-request-id]')!.dataset.rejectRequestId! }); return; }

    if (target.closest<HTMLElement>('[data-plan-id]')) { billingHandlers.handlePlanChange(target.closest<HTMLElement>('[data-plan-id]')!.dataset.planId as PlanId); return; }
    if (target.closest('.export-csv-btn')) { reportHandlers.handleExportCsv(e); return; }
    if (target.closest('.export-pdf-btn')) { reportHandlers.handleExportPdf(e); return; }
    if (target.closest('.report-tab')) { state.ui.reports.activeTab = target.closest<HTMLElement>('.report-tab')!.dataset.tab as any; updateUI(['page']); }
    if (target.closest<HTMLElement>('.add-ai-task-btn')) { const projectSelect = document.getElementById('ai-project-select') as HTMLSelectElement; aiHandlers.handleAddAiTask(parseInt(target.closest<HTMLElement>('.add-ai-task-btn')!.dataset.taskIndex!, 10), projectSelect.value); return; }
    if (target.closest('#notification-bell')) { notificationHandlers.toggleNotificationsPopover(); return; }
    if (target.closest('.notification-item')) { notificationHandlers.handleNotificationClick(target.closest<HTMLElement>('.notification-item')!.dataset.notificationId!); return; }
    if (target.closest('#mark-all-read-btn')) { notificationHandlers.markAllNotificationsAsRead(); return; }
    
    const notificationPopoverTab = target.closest<HTMLElement>('.absolute.top-full.right-0 [data-tab]');
    if (notificationPopoverTab) {
        const tab = notificationPopoverTab.dataset.tab as 'new' | 'read';
        if (state.ui.notifications.activeTab !== tab) {
            state.ui.notifications.activeTab = tab;
            updateUI(['header']);
        }
        return;
    }

    const commandItem = target.closest<HTMLElement>('.command-item');
    if (commandItem) {
        commandHandlers.handleCommandPaletteSelection(commandItem);
        return;
    }
    if (target.closest('#edit-wiki-btn')) { wikiHandlers.startWikiEdit(); return; }
    if (target.closest('#cancel-wiki-edit-btn')) { wikiHandlers.cancelWikiEdit(); return; }
    if (target.closest('#save-wiki-btn')) { wikiHandlers.saveWikiEdit(); return; }
    if (target.closest('#wiki-history-btn')) { uiHandlers.showModal('wikiHistory', { projectId: target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId }); return; }
    if (target.closest('[data-restore-wiki-version]')) { wikiHandlers.handleRestoreWikiVersion(target.closest<HTMLElement>('[data-restore-wiki-version]')!.dataset.restoreWikiVersion!); return; }
    if (target.closest('.kr-value')) { const krItem = target.closest<HTMLElement>('.key-result-item')!; krItem.dataset.editing = 'true'; updateUI(['side-panel']); return; }
    if (target.closest('[data-remove-project-member-id]')) { teamHandlers.handleRemoveUserFromProject(target.closest<HTMLElement>('[data-remove-project-member-id]')!.dataset.removeProjectMemberId!); return; }
    if (target.closest('.mention-item')) { const userId = target.closest<HTMLElement>('.mention-item')!.dataset.mentionId!; const user = state.users.find(u => u.id === userId); if(user) handleInsertMention(user, state.ui.mention.target as HTMLElement); return; }
    if (target.closest<HTMLElement>('[data-delete-project-id]')) { if (confirm('Are you sure you want to delete this project?')) { await projectHandlers.handleDeleteProject(target.closest<HTMLElement>('[data-delete-project-id]')!.dataset.deleteProjectId!); } return; }
    if (target.closest('#global-timer-toggle')) { if(state.ui.globalTimer.isRunning) timerHandlers.stopGlobalTimer(); else timerHandlers.startGlobalTimer(); return; }
    if (target.closest('.onboarding-next-btn')) { onboardingHandlers.nextStep(); return; }
    if (target.closest('.onboarding-skip-btn')) { onboardingHandlers.finishOnboarding(); return; }
    const createProjectFromDealBtn = target.closest('#create-project-from-deal-btn');
    if (createProjectFromDealBtn) {
        const btn = createProjectFromDealBtn as HTMLElement;
        const clientId = btn.dataset.clientId;
        const dealName = btn.dataset.dealName;
        uiHandlers.closeModal(false);
        uiHandlers.showModal('addProject', { clientId, projectName: dealName });
        return;
    }
    if (target.closest('#add-milestone-btn')) { goalHandlers.handleAddMilestone(); return; }
    const removeMilestoneBtn = target.closest('.remove-milestone-btn');
    if (removeMilestoneBtn) {
        const id = removeMilestoneBtn.parentElement?.dataset.id;
        if(id) goalHandlers.handleRemoveMilestone(id);
        return;
    }

    const activityTab = target.closest<HTMLElement>('.activity-log-tabs button');
    if (activityTab) {
        const type = activityTab.dataset.activityType!; // 'note', 'call', 'meeting', 'email'
        const formContainer = activityTab.closest('.activity-log-container');
        if (formContainer) {
            formContainer.querySelectorAll('.activity-log-tabs button').forEach(btn => btn.classList.remove('active'));
            activityTab.classList.add('active');
    
            formContainer.querySelectorAll('.deal-activity-form').forEach(form => {
                const formEl = form as HTMLElement;
                if (formEl.dataset.formType === type) {
                    formEl.classList.remove('hidden');
                    if (type === 'note' || type === 'call' || type === 'meeting') {
                        // Set the hidden input for the generic logger form
                        const hiddenInput = formEl.querySelector('input[name="activity-type"]') as HTMLInputElement;
                        if (hiddenInput) hiddenInput.value = type;
                        const textarea = formEl.querySelector('textarea');
                        if(textarea) textarea.placeholder = t(`modals.${type === 'note' ? 'note_placeholder' : `Log ${type} details...`}`);
                    }
                } else {
                    formEl.classList.add('hidden');
                }
            });
        }
        return;
    }

    const multiSelectListItem = target.closest<HTMLElement>('.multiselect-list-item');
    if (multiSelectListItem) {
        // Allow the default checkbox behavior to toggle the input
        // The API call logic is now conditional
        const checkbox = multiSelectListItem.querySelector<HTMLInputElement>('input[type="checkbox"]');
        const container = multiSelectListItem.closest<HTMLElement>('.multiselect-container');
        
        if (checkbox && container) {
            const entityType = container.dataset.entityType as 'project' | 'client' | 'task';
            const entityId = container.dataset.entityId; // This can be undefined
            const tagId = checkbox.value;

            // ONLY call the handler if we have an entityId (i.e., we are editing an existing entity)
            if (entityId) {
                tagHandlers.handleToggleTag(entityType, entityId, tagId);
            }
        }
        return;
    }

    const removeTagBtn = target.closest<HTMLElement>('.remove-tag-btn');
    if(removeTagBtn) {
        const multiselect = removeTagBtn.closest<HTMLElement>('.multiselect-container');
        if(multiselect) {
            const entityType = multiselect.dataset.entityType as 'project' | 'client' | 'task';
            const entityId = multiselect.dataset.entityId;
            const tagId = removeTagBtn.dataset.tagId;
            if(entityId && entityType && tagId) {
                tagHandlers.handleToggleTag(entityType, entityId, tagId);
            }
        }
        return;
    }
}