

import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { generateInvoicePDF } from '../services.ts';
import type { Role, PlanId, User, DashboardWidgetType, ClientContact, ProjectRole, SortByOption, Task, TeamCalendarView, AppState, ProjectSortByOption } from '../types.ts';
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
import * as goalHandlers from '../handlers/goals.ts';
import { getWorkspaceKanbanWorkflow } from '../handlers/main.ts';
import * as pipelineHandlers from '../handlers/pipeline.ts';
import * as tagHandlers from '../handlers/tags.ts';
import * as kanbanHandlers from '../handlers/kanban.ts';
import { handleInsertSlashCommand } from '../handlers/editor.ts';

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
    const target = e.target as HTMLElement;

    // --- Projects Page UI Handlers ---
    const projectViewModeBtn = target.closest<HTMLElement>('[data-project-view-mode]');
    if (projectViewModeBtn) {
        const viewMode = projectViewModeBtn.dataset.projectViewMode as 'grid' | 'portfolio';
        if (state.ui.projects.viewMode !== viewMode) {
            state.ui.projects.viewMode = viewMode;
            updateUI(['page']);
        }
        return;
    }

    const projectSortByBtn = target.closest<HTMLElement>('[data-project-sort-by]');
    if (projectSortByBtn) {
        const sortBy = projectSortByBtn.dataset.projectSortBy as ProjectSortByOption;
        if (state.ui.projects.sortBy !== sortBy) {
            state.ui.projects.sortBy = sortBy;
            updateUI(['page']);
        }
        projectSortByBtn.closest('.dropdown-menu')?.classList.add('hidden');
        return;
    }


    // --- Time Picker Logic ---
    const timePickerOption = target.closest<HTMLElement>('.time-picker-option');
    if (timePickerOption) {
        const column = timePickerOption.parentElement!;
        const timePicker = column.parentElement!;
        const hiddenInput = timePicker.querySelector<HTMLInputElement>('#time-picker-seconds');

        if (!hiddenInput) return;

        column.querySelectorAll('.time-picker-option').forEach(opt => opt.classList.remove('selected'));
        timePickerOption.classList.add('selected');

        const selectedHourEl = timePicker.querySelector<HTMLElement>('#time-picker-hours .selected');
        const selectedMinuteEl = timePicker.querySelector<HTMLElement>('#time-picker-minutes .selected');
        
        const selectedHour = selectedHourEl ? parseInt(selectedHourEl.dataset.value!, 10) : 0;
        const selectedMinute = selectedMinuteEl ? parseInt(selectedMinuteEl.dataset.value!, 10) : 0;
        
        const totalSeconds = (selectedHour * 3600) + (selectedMinute * 60);
        hiddenInput.value = String(totalSeconds);
        return;
    }

    // --- START: Timesheet User Selector ---
    const timesheetUserToggle = target.closest<HTMLElement>('[data-timesheet-user-toggle]');
    if (timesheetUserToggle) {
        const dropdown = document.getElementById('timesheet-user-dropdown');
        dropdown?.classList.toggle('hidden');
        return;
    }

    const timesheetUserOption = target.closest<HTMLElement>('.timesheet-user-option');
    if (timesheetUserOption) {
        const userId = timesheetUserOption.dataset.timesheetUserId;
        const allUsers = timesheetUserOption.dataset.timesheetUserAll;
        const myTime = timesheetUserOption.dataset.timesheetUserMe;

        if (myTime) {
            state.ui.teamCalendarSelectedUserIds = [];
        } else if (allUsers) {
            state.ui.teamCalendarSelectedUserIds = ['all'];
        } else if (userId) {
            const checkbox = timesheetUserOption.querySelector('input[type="checkbox"]') as HTMLInputElement;
            checkbox.checked = !checkbox.checked;
            
            const selectedIds = new Set(state.ui.teamCalendarSelectedUserIds.filter(id => id !== 'all'));
            if (checkbox.checked) {
                selectedIds.add(userId);
            } else {
                selectedIds.delete(userId);
            }
            state.ui.teamCalendarSelectedUserIds = Array.from(selectedIds);
        }
        
        updateUI(['page']);
        // Don't close dropdown on multi-select
        if (myTime || allUsers) {
            document.getElementById('timesheet-user-dropdown')?.classList.add('hidden');
        }
        return;
    }

    if (!target.closest('#timesheet-user-selector-container')) {
        document.getElementById('timesheet-user-dropdown')?.classList.add('hidden');
    }
    // --- END: Timesheet User Selector ---


    // --- Dynamic Breadcrumb Switcher Handler ---
    const breadcrumbSwitcher = target.closest<HTMLElement>('[data-breadcrumb-switcher]');
    if (breadcrumbSwitcher) {
        e.stopPropagation();
        const menu = breadcrumbSwitcher.nextElementSibling as HTMLElement;
        if (menu) {
            const isHidden = menu.classList.toggle('hidden');
            breadcrumbSwitcher.setAttribute('aria-expanded', String(!isHidden));
            if (!isHidden) {
                (menu.querySelector('input') as HTMLInputElement)?.focus();
            }
        }
        return;
    }

    const switchEntityBtn = target.closest<HTMLElement>('[data-switch-entity-id]');
    if (switchEntityBtn) {
        const entityType = switchEntityBtn.dataset.entityType as 'project' | 'client' | 'deal';
        const entityId = switchEntityBtn.dataset.switchEntityId!;
        if (entityType && entityId) {
            if (entityType === 'project') uiHandlers.updateUrlAndShowDetail('project', entityId);
            if (entityType === 'client') uiHandlers.updateUrlAndShowDetail('client', entityId);
            if (entityType === 'deal') uiHandlers.updateUrlAndShowDetail('deal', entityId);
        }
        return;
    }
    // --- End Breadcrumb Switcher Handler ---

    // --- Dynamic Role Menu Handler ---
    const roleMenuButton = target.closest<HTMLElement>('[data-role-menu-for-member-id]');
    if (roleMenuButton) {
        e.stopPropagation();
        const existingMenu = document.getElementById('dynamic-role-menu');
        // If menu is already open for THIS button, close it. Otherwise, open a new one.
        if (existingMenu && existingMenu.dataset.ownerId === roleMenuButton.dataset.roleMenuForMemberId) {
            closeDynamicMenus();
            return;
        }

        closeDynamicMenus(); // Close any other open menu
        const memberId = roleMenuButton.dataset.roleMenuForMemberId!;
        const member = state.workspaceMembers.find(m => m.id === memberId);
        if (!member) return;

        const menu = document.createElement('div');
        menu.id = 'dynamic-role-menu';
        menu.dataset.ownerId = memberId;
        menu.className = 'absolute z-50 w-40 bg-content rounded-md shadow-lg border border-border-color py-1';
        const ALL_ROLES: Role[] = ['admin', 'manager', 'member', 'finance', 'client'];
        menu.innerHTML = ALL_ROLES.map(role => `
            <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background role-menu-item ${member.role === role ? 'bg-primary/10' : ''}" data-member-id="${memberId}" data-new-role="${role}">
                <span>${t(`hr.role_${role}`)}</span>
            </button>
        `).join('');
        document.body.appendChild(menu);
        const btnRect = roleMenuButton.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        menu.style.top = `${btnRect.bottom + window.scrollY + 5}px`;
        let left = btnRect.right - menuRect.width;
        if (left < 10) left = btnRect.left;
        menu.style.left = `${left}px`;
        return;
    }

    const roleMenuItem = target.closest<HTMLElement>('#dynamic-role-menu .role-menu-item');
    if (roleMenuItem) {
        const memberId = roleMenuItem.dataset.memberId!;
        const newRole = roleMenuItem.dataset.newRole as Role;
        await teamHandlers.handleChangeUserRole(memberId, newRole);
        closeDynamicMenus();
        return;
    }
    // --- End Dynamic Role Menu Handler ---


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

    const createTaskFromSelectionBtn = target.closest('#create-task-from-selection-btn');
    if (createTaskFromSelectionBtn) {
        const { selectedText, context } = state.ui.textSelectionPopover;
        if (selectedText && context) {
            const modalData: {
                taskName: string;
                projectId?: string;
                taskDescription?: string;
            } = {
                taskName: selectedText
            };
    
            if (context.type === 'project') {
                modalData.projectId = context.id;
            } else if (context.type === 'task') {
                const sourceTask = state.tasks.find(t => t.id === context.id);
                if (sourceTask) {
                    modalData.projectId = sourceTask.projectId;
                    modalData.taskDescription = `From task: [${sourceTask.name}](#/tasks/${sourceTask.id})`;
                }
            }
            
            // Hide popover first
            state.ui.textSelectionPopover.isOpen = false;
            updateUI(['text-selection-popover']);
    
            // Then show modal
            uiHandlers.showModal('addTask', modalData);
        }
        return;
    }

    const slashCommandItem = target.closest<HTMLElement>('.slash-command-item');
    if (slashCommandItem) {
        const command = slashCommandItem.dataset.command as string;
        if (command && state.ui.slashCommand.target) {
            handleInsertSlashCommand(command, state.ui.slashCommand.target);
        }
        return;
    }
    
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
    
    const editCommentBtn = target.closest<HTMLElement>('[data-edit-comment-id]');
    if (editCommentBtn) {
        const commentId = editCommentBtn.dataset.editCommentId!;
        const comment = state.comments.find(c => c.id === commentId);
        if (!comment) return;

        const commentBody = document.getElementById(`comment-body-${commentId}`);
        const commentActions = document.getElementById(`comment-actions-${commentId}`);

        if (commentBody && commentActions) {
            commentActions.classList.add('hidden');
            commentBody.innerHTML = `
                <form class="edit-comment-form" data-comment-id="${commentId}">
                    <div class="rich-text-input-container">
                        <textarea class="form-control" rows="3">${comment.content}</textarea>
                    </div>
                    <div class="flex justify-end gap-2 mt-2">
                        <button type="button" class="btn btn-secondary btn-sm" data-cancel-edit-comment-id="${commentId}">${t('modals.cancel')}</button>
                        <button type="button" class="btn btn-primary btn-sm" data-save-edit-comment-id="${commentId}">${t('modals.save')}</button>
                    </div>
                </form>
            `;
            commentBody.querySelector('textarea')?.focus();
        }
        return;
    }

    const saveCommentBtn = target.closest<HTMLElement>('[data-save-edit-comment-id]');
    if (saveCommentBtn) {
        const form = saveCommentBtn.closest('form')!;
        const commentId = form.dataset.commentId!;
        const newContent = form.querySelector('textarea')!.value;
        taskHandlers.handleUpdateTaskComment(commentId, newContent);
        return;
    }
    
    const cancelCommentBtn = target.closest<HTMLElement>('[data-cancel-edit-comment-id]');
    if (cancelCommentBtn) {
        updateUI(['modal']);
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

    const reminderBtn = target.closest<HTMLElement>('[data-set-reminder-for-task-id]');
    if (reminderBtn) {
        e.stopPropagation();
        const taskId = reminderBtn.dataset.setReminderForTaskId!;
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
    
        document.getElementById('reminder-popover')?.remove();
    
        const popover = document.createElement('div');
        popover.id = 'reminder-popover';
        popover.className = 'reminder-popover';
    
        popover.innerHTML = `
            <h5 class="text-sm font-semibold">${t('modals.set_reminder')}</h5>
            <input type="datetime-local" class="form-control" id="reminder-datetime-input">
            <div class="text-xs font-semibold text-text-subtle">${t('modals.reminder_or_preset')}</div>
            <div class="grid grid-cols-2 gap-2 text-sm">
                <button class="btn btn-secondary btn-sm" data-preset="1h">${t('modals.reminder_preset_1h')}</button>
                <button class="btn btn-secondary btn-sm" data-preset="tomorrow">${t('modals.reminder_preset_tomorrow')}</button>
                <button class="btn btn-secondary btn-sm col-span-2 ${!task.dueDate ? 'opacity-50' : ''}" data-preset="1d_before" ${!task.dueDate ? 'disabled' : ''}>${t('modals.reminder_preset_1d_before')}</button>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-border-color">
                <button class="btn-text text-danger" data-preset="clear">${t('modals.reminder_clear')}</button>
                <button class="btn btn-primary btn-sm" id="save-reminder-btn">${t('modals.save')}</button>
            </div>
        `;
        document.body.appendChild(popover);
        const btnRect = reminderBtn.getBoundingClientRect();
        popover.style.top = `${btnRect.bottom + 5}px`;
        popover.style.left = `${btnRect.left - popover.offsetWidth + btnRect.width}px`; // Align right
        
        popover.addEventListener('click', (popoverEvent) => {
            popoverEvent.stopPropagation();
            const popoverTarget = popoverEvent.target as HTMLElement;
    
            const presetBtn = popoverTarget.closest<HTMLElement>('[data-preset]');
            if (presetBtn) {
                const preset = presetBtn.dataset.preset;
                let reminderDate: Date | null = new Date();
                
                switch(preset) {
                    case '1h': reminderDate.setHours(reminderDate.getHours() + 1); break;
                    case 'tomorrow': reminderDate.setDate(reminderDate.getDate() + 1); reminderDate.setHours(9, 0, 0, 0); break;
                    case '1d_before': if (task.dueDate) { reminderDate = new Date(task.dueDate + 'T00:00:00'); reminderDate.setDate(reminderDate.getDate() - 1); reminderDate.setHours(9, 0, 0, 0); } break;
                    case 'clear': reminderDate = null; break;
                }
    
                taskHandlers.handleSetTaskReminder(taskId, reminderDate ? reminderDate.toISOString() : null);
                popover.remove();
            }
    
            if (popoverTarget.id === 'save-reminder-btn') {
                const datetimeInput = document.getElementById('reminder-datetime-input') as HTMLInputElement;
                const dateValue = datetimeInput.value;
                if (dateValue) {
                    taskHandlers.handleSetTaskReminder(taskId, new Date(dateValue).toISOString());
                }
                popover.remove();
            }
        });
        return;
    }
    
    if (!target.closest('#reminder-popover') && !target.closest('[data-set-reminder-for-task-id]')) {
        document.getElementById('reminder-popover')?.remove();
    }

    // --- END: New Handlers for Comments & Reactions ---

    const menuToggle = target.closest<HTMLElement>('[data-menu-toggle]');
    const associatedMenu = menuToggle ? document.getElementById(menuToggle.dataset.menuToggle!) : null;

    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== associatedMenu && menu.id !== 'dynamic-role-menu') {
            menu.classList.add('hidden');
            const correspondingToggle = document.querySelector(`[data-menu-toggle="${menu.id}"]`);
            if (correspondingToggle) correspondingToggle.setAttribute('aria-expanded', 'false');
        }
    });

    if (!menuToggle && !target.closest('.dropdown-menu') && !target.closest('#dynamic-role-menu')) {
         document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
         closeDynamicMenus();
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
                // Page is changing. We must update the page content, the sidebar for active state,
                // the header for breadcrumbs, and close any open side panels.
                state.ui.openedProjectId = null;
                state.ui.openedClientId = null;
                state.ui.openedDealId = null;
                updateUI(['page', 'sidebar', 'header', 'side-panel']);
            }
            if (navLink.closest('#app-sidebar')) {
                closeMobileMenu();
            }
            return;
        }
    }

    if (target.closest('#help-btn')) {
        uiHandlers.showModal('keyboardShortcuts');
        return;
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
    
    const projectCard = target.closest<HTMLElement>('.projects-grid [data-project-id], .associated-projects-list [data-project-id], .portfolio-table-row[data-project-id], .dashboard-project-item');
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
    
    const taskCardOrRow = target.closest<HTMLElement>('.modern-list-row, .task-card, .project-task-row, .task-calendar-item, .workload-task-bar, .calendar-event-bar[data-task-id], .dashboard-task-item, .timesheet-entry');
    if (taskCardOrRow && !target.closest('button, a, input, textarea, select, [contenteditable="true"], .timer-controls, .task-card-menu-btn')) {
        const taskId = taskCardOrRow.dataset.taskId;
        if (taskId) {
            uiHandlers.updateUrlAndShowDetail('task', taskId);
            return;
        }
    }

    const goalCard = target.closest<HTMLElement>('.goal-card');
    if (goalCard && !target.closest('input')) {
        const goalId = goalCard.dataset.goalId;
        if (goalId) {
            uiHandlers.showModal('addGoal', { goalId });
        }
        return;
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

    const hrTab = target.closest<HTMLElement>('[data-hr-tab]');
    if (hrTab) {
        e.preventDefault();
        teamHandlers.handleSwitchHrTab(hrTab.dataset.hrTab as any);
        return;
    }

    // --- START: Re-implemented View & Filter Handlers ---

    // Tasks Page: View switcher (Board, List, etc.)
    const viewModeBtn = target.closest<HTMLElement>('[data-view-mode]');
    if (viewModeBtn) {
        const viewMode = viewModeBtn.dataset.viewMode as 'board' | 'list' | 'calendar' | 'gantt' | 'workload';
        if (state.ui.tasks.viewMode !== viewMode) {
            state.ui.tasks.viewMode = viewMode;
            updateUI(['page']);
        }
        return;
    }

    // Clients Page: Status filter (All, Active, Archived)
    const clientFilterStatusBtn = target.closest<HTMLElement>('[data-client-filter-status]');
    if (clientFilterStatusBtn) {
        const status = clientFilterStatusBtn.dataset.clientFilterStatus as 'all' | 'active' | 'archived';
        if (state.ui.clients.filters.status !== status) {
            state.ui.clients.filters.status = status;
            updateUI(['page']);
        }
        return;
    }

    // Team Calendar Page: View switcher (Month, Week, etc.)
    const teamCalendarViewBtn = target.closest<HTMLElement>('[data-team-calendar-view]');
    if (teamCalendarViewBtn) {
        const view = teamCalendarViewBtn.dataset.teamCalendarView as TeamCalendarView;
        if (state.ui.teamCalendarView !== view) {
            state.ui.teamCalendarView = view;
            updateUI(['page']);
        }
        return;
    }

    // Team Calendar Page: Prev/Next navigation
    const teamCalendarNav = target.closest<HTMLElement>('[data-calendar-nav][data-target-calendar="team"]');
    if (teamCalendarNav) {
        const direction = teamCalendarNav.dataset.calendarNav as 'prev' | 'next';
        const currentDate = new Date(state.ui.teamCalendarDate + 'T12:00:00Z');
        
        switch (state.ui.teamCalendarView) {
            case 'month':
                currentDate.setUTCMonth(currentDate.getUTCMonth() + (direction === 'next' ? 1 : -1));
                break;
            case 'week':
            case 'workload':
            case 'timesheet':
                currentDate.setUTCDate(currentDate.getUTCDate() + (direction === 'next' ? 7 : -7));
                break;
            case 'day':
                currentDate.setUTCDate(currentDate.getUTCDate() + (direction === 'next' ? 1 : -1));
                break;
        }

        state.ui.teamCalendarDate = currentDate.toISOString().slice(0, 10);
        updateUI(['page']);
        return;
    }

    // Tasks Page: Calendar view Prev/Next navigation
    const calendarNav = target.closest<HTMLElement>('[data-calendar-nav]');
    if (calendarNav && !calendarNav.dataset.targetCalendar) {
        const direction = calendarNav.dataset.calendarNav as 'prev' | 'next';
        const [year, month] = state.ui.calendarDate.split('-').map(Number);
        const newDate = new Date(year, month - 1, 1);
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        state.ui.calendarDate = newDate.toISOString().slice(0, 7);
        updateUI(['page']);
        return;
    }

    // --- END: Re-implemented View & Filter Handlers ---

    const settingsTab = target.closest<HTMLElement>('[data-tab]');
    if (settingsTab && settingsTab.closest('#settings-nav')) { // Check if it's within the settings sidebar nav
        e.preventDefault();
        const tabId = settingsTab.dataset.tab as any;
        if (state.ui.settings.activeTab !== tabId) {
            state.ui.settings.activeTab = tabId;
            updateUI(['page']);
        }
        return;
    }

    const addMilestoneBtn = target.closest('#add-milestone-btn');
    if (addMilestoneBtn) {
        goalHandlers.handleAddMilestone();
        return;
    }

    const removeMilestoneBtn = target.closest('.remove-milestone-btn');
    if (removeMilestoneBtn) {
        const milestoneItem = removeMilestoneBtn.closest<HTMLElement>('.milestone-item');
        if (milestoneItem && milestoneItem.dataset.id) {
            goalHandlers.handleRemoveMilestone(milestoneItem.dataset.id);
        }
        return;
    }
}
