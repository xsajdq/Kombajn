import { getState, setState } from '../state.ts';
import { updateUI, UIComponent } from '../app-renderer.ts';
import { generateInvoicePDF } from '../services.ts';
import type { Role, PlanId, User, DashboardWidgetType, ClientContact, ProjectRole, SortByOption, Task, TeamCalendarView, AppState, ProjectSortByOption, TaskDetailModalData } from '../types.ts';
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
import * as dashboardHandlers from '../handlers/dashboard.ts';
import * as auth from '../services/auth.ts';
import { renderLoginForm, renderRegisterForm } from '../pages/AuthPage.ts';
import * as onboardingHandlers from '../handlers/onboarding.ts';
import * as okrHandlers from '../handlers/okr.ts';
import { handleInsertMention } from './mentions.ts';
import * as integrationHandlers from '../handlers/integrations.ts';
import * as filterHandlers from '../handlers/filters.ts';
import * as projectHandlers from '../handlers/projects.ts';
import * as userHandlers from '../handlers/user.ts';
import * as taskViewHandlers from '../handlers/taskViews.ts';
import * as goalHandlers from '../handlers/goals.ts';
import * as pipelineHandlers from '../handlers/pipeline.ts';
import * as tagHandlers from '../handlers/tags.ts';
import type { TaggableEntity } from '../handlers/tags.ts';
import * as kanbanHandlers from '../handlers/kanban.ts';
import { handleInsertSlashCommand } from '../handlers/editor.ts';
import { handleOptimisticDelete, ResourceName } from '../handlers/generic.ts';
import { html, render } from 'lit-html';

function closeDynamicMenus() {
    document.querySelectorAll('#dynamic-role-menu, .task-card-menu, .dropdown-menu, .reaction-picker, .breadcrumb-switcher-menu, #reminder-popover, .custom-select-dropdown').forEach(menu => menu.classList.add('hidden'));
    document.querySelectorAll('[data-menu-toggle], [data-breadcrumb-switcher]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}


function showTaskCardMenu(taskId: string, buttonElement: HTMLElement) {
    closeDynamicMenus();

    const task = getState().tasks.find(t => t.id === taskId);
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
        <button class="task-menu-item danger" data-delete-resource="tasks" data-delete-id="${taskId}" data-delete-confirm="Are you sure you want to delete this task permanently?">
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
    const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
    const id = `new-${Date.now()}`;
    return `
        <div class="grid grid-cols-[1fr,1fr,1fr,1fr,auto] gap-2 items-center contact-form-row" data-contact-id="${id}">
            <input type="text" class="${formControlClasses}" data-field="name" placeholder="${t('modals.contact_person')}" value="" required>
            <input type="email" class="${formControlClasses}" data-field="email" placeholder="${t('modals.email')}" value="">
            <input type="text" class="${formControlClasses}" data-field="phone" placeholder="${t('modals.phone')}" value="">
            <input type="text" class="${formControlClasses}" data-field="role" placeholder="${t('modals.contact_role')}" value="">
            <button type="button" class="p-2 text-danger hover:bg-danger/10 rounded-full remove-contact-row-btn" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
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

    // This handler has top priority to ensure modal buttons always work,
    // even if they are inside another clickable element (like a card).
    const modalTarget = target.closest<HTMLElement>('[data-modal-target]');
    if (modalTarget) {
        // If the modal was triggered from the FAB menu, close the menu.
        if (target.closest('.fab-option')) {
            document.getElementById('fab-container')?.classList.remove('is-open');
        }
        uiHandlers.showModal(modalTarget.dataset.modalTarget as any, { ...modalTarget.dataset });
        return;
    }

    // --- Notification Bell Handler ---
    const notificationBell = target.closest('#notification-bell');
    if (notificationBell) {
        notificationHandlers.toggleNotificationsPopover();
        return;
    }

    // --- Generic Tab Switching Handler ---
    const tabButton = target.closest<HTMLElement>('[data-tab-group]');
    if (tabButton) {
        e.preventDefault();
        const groupPath = tabButton.dataset.tabGroup!.split('.');
        const tabValue = tabButton.dataset.tabValue!;

        // Special handler for project tasks tab to pre-fetch data
        if (groupPath.join('.') === 'ui.openedProjectTab' && tabValue === 'tasks') {
            const projectId = getState().ui.openedProjectId;
            if (projectId) {
                await projectHandlers.fetchTasksForProject(projectId);
            }
        }

        // Determine the correct UI component to update based on context
        let componentToUpdate: UIComponent = 'page'; // Default to 'page'
        if (tabButton.closest('#modal-container')) {
            componentToUpdate = 'modal';
        } else if (tabButton.closest('#side-panel-container')) {
            componentToUpdate = 'side-panel';
        } else if (tabButton.closest('header')) {
            componentToUpdate = 'header';
        }

        setState(prevState => {
            const newState = { ...prevState };
            let currentStateSlice = newState as any;
            for (let i = 0; i < groupPath.length - 1; i++) {
                currentStateSlice = currentStateSlice[groupPath[i]];
            }
            const finalKey = groupPath[groupPath.length - 1];
            if (currentStateSlice[finalKey] !== tabValue) {
                currentStateSlice[finalKey] = tabValue;
            }
            return newState;
        }, [componentToUpdate]);
        
        return;
    }


    // --- Generic Optimistic Delete Handler ---
    const deleteButton = target.closest<HTMLElement>('[data-delete-resource]');
    if (deleteButton) {
        const { deleteResource, deleteId, deleteConfirm } = deleteButton.dataset;
        if (deleteResource && deleteId) {
            handleOptimisticDelete(deleteResource as ResourceName, deleteId, deleteConfirm || `Are you sure you want to delete this item?`);
        }
        return;
    }

    // --- START: Task Page UI Handlers ---
    if (target.closest('[data-toggle-task-filters]')) {
        uiHandlers.toggleTaskFilters();
        return;
    }
    const sortByBtn = target.closest<HTMLElement>('[data-sort-by]');
    if (sortByBtn) {
        setState(prevState => ({ ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, sortBy: sortByBtn.dataset.sortBy as SortByOption } } }), ['page']);
        sortByBtn.closest('.dropdown-menu')?.classList.add('hidden');
        return;
    }
     const viewModeBtn = target.closest<HTMLElement>('[data-view-mode]');
    if(viewModeBtn){
        setState(prevState => ({ ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, viewMode: viewModeBtn.dataset.viewMode as any } } }), ['page']);
        return;
    }
    // --- END: Task Page UI Handlers ---

    // --- Dashboard Task Widget Tab Handler ---
    const taskWidgetTab = target.closest<HTMLElement>('[data-task-widget-tab]');
    if (taskWidgetTab) {
        const widgetId = taskWidgetTab.dataset.widgetId!;
        const filter = taskWidgetTab.dataset.taskWidgetTab!;
        dashboardHandlers.handleSwitchTaskWidgetTab(widgetId, filter);
        return;
    }

    // --- Projects Page UI Handlers ---
    const projectViewModeBtn = target.closest<HTMLElement>('[data-project-view-mode]');
    if (projectViewModeBtn) {
        const viewMode = projectViewModeBtn.dataset.projectViewMode as 'grid' | 'portfolio';
        setState(prevState => ({ ui: { ...prevState.ui, projects: { ...prevState.ui.projects, viewMode: viewMode } } }), ['page']);
        return;
    }

    const projectSortByBtn = target.closest<HTMLElement>('[data-project-sort-by]');
    if (projectSortByBtn) {
        const sortBy = projectSortByBtn.dataset.projectSortBy as ProjectSortByOption;
        setState(prevState => ({ ui: { ...prevState.ui, projects: { ...prevState.ui.projects, sortBy: sortBy } } }), ['page']);
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
    
    // --- Custom Select Dropdown Logic ---
    const customSelectToggle = target.closest<HTMLElement>('.custom-select-toggle');
    if (customSelectToggle) {
        const dropdown = customSelectToggle.nextElementSibling as HTMLElement;
        if (dropdown) {
            const isHidden = dropdown.classList.toggle('hidden');
            // Close other custom dropdowns
            document.querySelectorAll('.custom-select-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.add('hidden');
            });
        }
        return;
    }

    const customSelectOption = target.closest<HTMLElement>('.custom-select-option');
    if (customSelectOption) {
        const container = customSelectOption.closest<HTMLElement>('.custom-select-container')!;
        const value = customSelectOption.dataset.value!;

        const display = container.querySelector('.custom-select-display')!;
        display.innerHTML = customSelectOption.innerHTML;

        const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
        if(hiddenInput) hiddenInput.value = value;
        
        const key = container.dataset.fieldKey;
        if (key && container.closest('#addGoalForm')) {
            // This is a specific handler until we refactor modals to not need this
        } else if (container.closest('#task-filter-panel')) {
             filterHandlers.handleFilterChange({ dataset: { filterKey: 'assigneeId' }, value } as any);
        } else if (container.closest('#report-filter-panel')) {
            setState(prevState => ({
                ui: { ...prevState.ui, reports: { ...prevState.ui.reports, filters: { ...prevState.ui.reports.filters, userId: value } } }
            }), ['page']);
        } else if (container.closest('#configure-widget-form')) {
            setState(prevState => ({
                ui: { ...prevState.ui, modal: { ...prevState.ui.modal, data: { ...(prevState.ui.modal.data as any), widget: { ...(prevState.ui.modal.data as any).widget, config: { ...(prevState.ui.modal.data as any).widget.config, userId: value } } } } }
            }), ['modal']);
        }
        
        const dropdown = customSelectOption.closest<HTMLElement>('.custom-select-dropdown')!;
        dropdown.classList.add('hidden');
        return;
    }
    
    
    if (!target.closest('.custom-select-container')) {
        document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
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
        const allUsers = timesheetUserOption.dataset.timesheetUserAll === 'true';
        const myTime = timesheetUserOption.dataset.timesheetUserMe === 'true';

        setState(prevState => {
            if (myTime) {
                return { ui: { ...prevState.ui, teamCalendar: { ...prevState.ui.teamCalendar, selectedUserIds: [] } } };
            }
            if (allUsers) {
                return { ui: { ...prevState.ui, teamCalendar: { ...prevState.ui.teamCalendar, selectedUserIds: ['all'] } } };
            }
            const checkbox = timesheetUserOption.querySelector('input[type="checkbox"]') as HTMLInputElement;
            checkbox.checked = !checkbox.checked;
            const userId = checkbox.value;
            const selectedIds = new Set(prevState.ui.teamCalendar.selectedUserIds.filter(id => id !== 'all'));
            if (checkbox.checked) {
                selectedIds.add(userId);
            } else {
                selectedIds.delete(userId);
            }
            return { ui: { ...prevState.ui, teamCalendar: { ...prevState.ui.teamCalendar, selectedUserIds: Array.from(selectedIds) } } };
        }, ['page']);

        if (myTime || allUsers) {
            document.getElementById('timesheet-user-dropdown')?.classList.add('hidden');
        }
        return;
    }

    if (!target.closest('#timesheet-user-selector-container')) {
        document.getElementById('timesheet-user-dropdown')?.classList.add('hidden');
    }
    // --- END: Timesheet User Selector ---

    // --- START: Invoice Settings Handlers ---
    const templateCard = target.closest<HTMLElement>('.template-card');
    if (templateCard) {
        const templateName = templateCard.dataset.templateName;
        const input = document.getElementById('invoice-template-input') as HTMLInputElement | null;
        if (templateName && input) {
            input.value = templateName;
            document.querySelectorAll('.template-card').forEach(card => card.classList.remove('selected'));
            templateCard.classList.add('selected');
        }
        return;
    }
    
    if (target.closest('#save-invoice-settings-btn')) {
        invoiceHandlers.handleSaveInvoiceSettings();
        return;
    }
    // --- END: Invoice Settings Handlers ---

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
        if (existingMenu && existingMenu.dataset.ownerId === roleMenuButton.dataset.roleMenuForMemberId) {
            closeDynamicMenus();
            return;
        }

        closeDynamicMenus();
        const memberId = roleMenuButton.dataset.roleMenuForMemberId!;
        const member = getState().workspaceMembers.find(m => m.id === memberId);
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

    // --- Client Modal Contact Handlers ---
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
                    const currentIds = deletedIdsInput.value ? deletedIdsInput.value.split(',') : [];
                    currentIds.push(contactId);
                    deletedIdsInput.value = currentIds.join(',');
                }
            }
            row.remove();
        }
        return;
    }
    // --- End Client Modal Contact Handlers ---
    
    // --- Budget Modal Handler ---
    if (target.id === 'add-budget-category-btn') {
        const container = document.getElementById('budgets-container');
        if (container) {
            const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
            const newRowHtml = `
                <div class="grid grid-cols-[1fr,auto] gap-2 items-center">
                    <input type="text" class="${formControlClasses}" name="budget_category_new_${Date.now()}" placeholder="${t('budget.modal_category')}" required>
                    <input type="number" class="${formControlClasses} w-32 text-right" name="budget_amount_new_${Date.now()}" value="0.00" min="0" step="0.01" required>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', newRowHtml);
            (container.lastElementChild?.querySelector('input') as HTMLInputElement)?.focus();
        }
        return;
    }


    // --- Invoice Page Handlers ---
    const downloadInvoiceBtn = target.closest<HTMLElement>('[data-download-invoice-id]');
    if (downloadInvoiceBtn) {
        generateInvoicePDF(downloadInvoiceBtn.dataset.downloadInvoiceId!);
        return;
    }

    const toggleInvoiceStatusBtn = target.closest<HTMLElement>('[data-toggle-invoice-status-id]');
    if (toggleInvoiceStatusBtn) {
        invoiceHandlers.handleToggleInvoiceStatus(toggleInvoiceStatusBtn.dataset.toggleInvoiceStatusId!);
        return;
    }

    const sendInvoiceBtn = target.closest<HTMLElement>('[data-send-invoice-id]');
    if (sendInvoiceBtn) {
        invoiceHandlers.handleSendInvoiceByEmail(sendInvoiceBtn.dataset.sendInvoiceId!);
        return;
    }

    if (target.closest('#generate-invoice-items-btn')) { invoiceHandlers.handleGenerateInvoiceItems(); return; }

    const addInvoiceItemBtn = target.closest('#add-invoice-item-btn');
    if (addInvoiceItemBtn) {
        setState(prevState => {
            if (prevState.ui.modal.type === 'addInvoice') {
                const newItem = { id: Date.now().toString(), invoiceId: '', description: '', quantity: 1, unitPrice: 0 };
                const newItems = [...((prevState.ui.modal.data as any).items || []), newItem];
                return { ui: { ...prevState.ui, modal: { ...prevState.ui.modal, data: { ...(prevState.ui.modal.data as any), items: newItems } } } };
            }
            return prevState;
        }, ['modal']);
        return;
    }

    const removeInvoiceItemBtn = target.closest('.remove-invoice-item-btn');
    if (removeInvoiceItemBtn) {
        const itemId = removeInvoiceItemBtn.closest<HTMLElement>('.invoice-item-row')?.dataset.itemId;
        setState(prevState => {
            if (prevState.ui.modal.type === 'addInvoice' && itemId) {
                const newItems = (prevState.ui.modal.data as any).items.filter((item: any) => item.id.toString() !== itemId);
                return { ui: { ...prevState.ui, modal: { ...prevState.ui.modal, data: { ...(prevState.ui.modal.data as any), items: newItems } } } };
            }
            return prevState;
        }, ['modal']);
        return;
    }
    // --- End Invoice Page Handlers ---

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
        const { selectedText, context } = getState().ui.textSelectionPopover;
        if (selectedText && context) {
            const modalData: any = { taskName: selectedText };
    
            if (context.type === 'project') {
                modalData.projectId = context.id;
            } else if (context.type === 'task') {
                const sourceTask = getState().tasks.find(t => t.id === context.id);
                if (sourceTask) {
                    modalData.projectId = sourceTask.projectId;
                    modalData.taskDescription = `From task: [${sourceTask.name}](#/tasks/${sourceTask.id})`;
                }
            }
            
            setState(prevState => ({ ui: { ...prevState.ui, textSelectionPopover: { ...prevState.ui.textSelectionPopover, isOpen: false } } }), ['text-selection-popover']);
            uiHandlers.showModal('addTask', modalData);
        }
        return;
    }

    const slashCommandItem = target.closest<HTMLElement>('.slash-command-item');
    if (slashCommandItem) {
        const command = slashCommandItem.dataset.command as string;
        if (command && getState().ui.slashCommand.target) {
            handleInsertSlashCommand(command, getState().ui.slashCommand.target);
        }
        return;
    }
    
    // Reply button
    const replyBtn = target.closest<HTMLElement>('[data-reply-to-comment-id]');
    if (replyBtn) {
        const commentId = replyBtn.dataset.replyToCommentId!;
        const container = document.getElementById(`reply-form-container-${commentId}`);
        if (container) {
            if (container.innerHTML) {
                container.innerHTML = '';
            } else {
                render(html`
                    <form class="reply-form" data-task-id="${(getState().ui.modal.data as TaskDetailModalData).taskId}" data-parent-id="${commentId}">
                        <div class="rich-text-input-container">
                            <div class="rich-text-input" contenteditable="true" data-placeholder="${t('modals.add_comment')}"></div>
                        </div>
                        <div class="flex justify-end gap-2 mt-2">
                            <button type="button" class="btn btn-secondary btn-sm cancel-reply-btn">${t('modals.cancel')}</button>
                            <button type="submit" class="btn btn-primary btn-sm">${t('modals.reply_button')}</button>
                        </div>
                    </form>
                `, container);
                container.querySelector<HTMLElement>('.rich-text-input')?.focus();
            }
        }
        return;
    }
    
    const editCommentBtn = target.closest<HTMLElement>('[data-edit-comment-id]');
    if (editCommentBtn) {
        const commentId = editCommentBtn.dataset.editCommentId!;
        const comment = getState().comments.find(c => c.id === commentId);
        if (!comment) return;

        const commentBody = document.getElementById(`comment-body-${commentId}`);
        const commentActions = document.getElementById(`comment-actions-${commentId}`);

        if (commentBody && commentActions) {
            commentActions.classList.add('hidden');
            render(html`
                <form class="edit-comment-form" data-comment-id="${commentId}">
                    <div class="rich-text-input-container">
                        <textarea class="form-control" rows="3">${comment.content}</textarea>
                    </div>
                    <div class="flex justify-end gap-2 mt-2">
                        <button type="button" class="btn btn-secondary btn-sm" data-cancel-edit-comment-id="${commentId}">${t('modals.cancel')}</button>
                        <button type="button" class="btn btn-primary btn-sm" data-save-edit-comment-id="${commentId}">${t('modals.save')}</button>
                    </div>
                </form>
            `, commentBody);
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
    
    if (target.closest('.cancel-reply-btn')) {
        target.closest('.reply-form-container')!.innerHTML = '';
        return;
    }
    
    const reactBtn = target.closest<HTMLElement>('[data-react-to-comment-id]');
    if (reactBtn) {
        const commentId = reactBtn.dataset.reactToCommentId!;
        const picker = document.getElementById(`reaction-picker-${commentId}`);
        if(picker) {
            const isHidden = picker.classList.contains('hidden');
            document.querySelectorAll('.reaction-picker').forEach(p => p.classList.add('hidden'));
            if(isHidden) picker.classList.remove('hidden');
        }
        return;
    }
    
    
    const emojiBtn = target.closest<HTMLElement>('.reaction-picker button[data-emoji]');
    if (emojiBtn) {
        const commentId = emojiBtn.closest('.reaction-picker')!.id.replace('reaction-picker-', '');
        const emoji = emojiBtn.dataset.emoji!;
        taskHandlers.handleToggleReaction(commentId, emoji);
        emojiBtn.closest('.reaction-picker')!.classList.add('hidden');
        return;
    }
    
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
        const task = getState().tasks.find(t => t.id === taskId);
        if (!task) return;
    
        document.getElementById('reminder-popover')?.remove();
    
        const popover = document.createElement('div');
        popover.id = 'reminder-popover';
        popover.className = 'reminder-popover';
    
        render(html`
            <h5 class="text-sm font-semibold">${t('modals.set_reminder')}</h5>
            <input type="datetime-local" class="form-control" id="reminder-datetime-input">
            <div class="text-xs font-semibold text-text-subtle">${t('modals.reminder_or_preset')}</div>
            <div class="grid grid-cols-2 gap-2 text-sm">
                <button class="btn btn-secondary btn-sm" data-preset="1h">${t('modals.reminder_preset_1h')}</button>
                <button class="btn btn-secondary btn-sm" data-preset="tomorrow">${t('modals.reminder_preset_tomorrow')}</button>
                <button class="btn btn-secondary btn-sm col-span-2 ${!task.dueDate ? 'opacity-50' : ''}" data-preset="1d_before" ?disabled=${!task.dueDate}>${t('modals.reminder_preset_1d_before')}</button>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-border-color">
                <button class="btn-text text-danger" data-preset="clear">${t('modals.reminder_clear')}</button>
                <button class="btn btn-primary btn-sm" id="save-reminder-btn">${t('modals.save')}</button>
            </div>
        `, popover);
        document.body.appendChild(popover);
        const btnRect = reminderBtn.getBoundingClientRect();
        popover.style.top = `${btnRect.bottom + 5}px`;
        popover.style.left = `${btnRect.left - popover.offsetWidth + btnRect.width}px`;
        
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
    
    const menuToggle = target.closest<HTMLElement>('[data-menu-toggle]');
    const associatedMenu = menuToggle ? document.getElementById(menuToggle.dataset.menuToggle!) : null;

    if (!target.closest('[data-menu-toggle], .dropdown-menu, #dynamic-role-menu, .breadcrumb-switcher-menu, #reminder-popover, .custom-select-container')) {
        closeDynamicMenus();
    }
    
    if (menuToggle && associatedMenu) {
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

    const state = getState();
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
                setState(prevState => ({
                    ui: { ...prevState.ui, openedProjectId: null, openedClientId: null, openedDealId: null }
                }), ['page', 'sidebar', 'header', 'side-panel']);
            }
            if (navLink.closest('#app-sidebar')) {
                closeMobileMenu();
            }
            return;
        }
    }

    if (target.closest('#help-btn')) { uiHandlers.showModal('keyboardShortcuts'); return; }
    const saveModalBtn = target.closest('#modal-save-btn');
    if (saveModalBtn) { formHandlers.handleFormSubmit(); return; }
    if (target.closest('.btn-close-modal') || (target.id === 'modal-backdrop' && !target.closest('#modal-content'))) { uiHandlers.closeModal(); return; }
    if (target.closest('.btn-close-panel, #side-panel-overlay')) { uiHandlers.closeSidePanels(); return; }
    
    const projectCard = target.closest<HTMLElement>('.projects-grid [data-project-id], .associated-projects-list [data-project-id], .portfolio-table-row[data-project-id], .dashboard-project-item');
    if (projectCard && !target.closest('button, a, .multiselect-container')) { uiHandlers.updateUrlAndShowDetail('project', projectCard.dataset.projectId!); return; }
    const clientCard = target.closest<HTMLElement>('[data-client-id]:not([data-modal-target])');
    if (clientCard && !target.closest('button, a, .multiselect-container')) { uiHandlers.updateUrlAndShowDetail('client', clientCard.dataset.clientId!); return; }
    const dealCard = target.closest<HTMLElement>('.deal-card');
    if (dealCard && !target.closest('button, a')) { uiHandlers.updateUrlAndShowDetail('deal', dealCard.dataset.dealId!); return; }
    
    const taskCardOrRow = target.closest<HTMLElement>('.modern-list-row, .task-card, .project-task-row, .task-calendar-item, .workload-task-bar, .calendar-event-bar[data-task-id], .dashboard-task-item, .timesheet-entry');
    if (taskCardOrRow && !target.closest('button, a, input, textarea, select, [contenteditable="true"], .timer-controls, .task-card-menu-btn')) {
        const taskId = taskCardOrRow.dataset.taskId;
        if (taskId) { uiHandlers.updateUrlAndShowDetail('task', taskId); return; }
    }

    const goalCard = target.closest<HTMLElement>('.goal-card');
    if (goalCard && !target.closest('input')) {
        const goalId = goalCard.dataset.goalId;
        if (goalId) { uiHandlers.showModal('addGoal', { goalId }); }
        return;
    }
    if (target.closest('#goals-analytics-btn')) {
        alert('Analytics feature coming soon!');
        return;
    }

    const authTab = target.closest<HTMLElement>('[data-auth-tab]');
    if (authTab) {
        const tabName = authTab.dataset.authTab;
        document.querySelectorAll('[data-auth-tab]').forEach(t => t.classList.remove('active'));
        authTab.classList.add('active');
        const container = document.getElementById('auth-form-container')!;
        if (tabName === 'login') render(renderLoginForm(), container); else render(renderRegisterForm(), container);
        return;
    }
    if (target.closest<HTMLElement>('[data-logout-button]')) { auth.logout(); return; }
    if (target.closest<HTMLElement>('[data-add-widget-type]')) { const btn = target.closest<HTMLElement>('[data-add-widget-type]')!; dashboardHandlers.addWidget(btn.dataset.addWidgetType as any, btn.dataset.metricType as any); return; }
    if (target.closest<HTMLElement>('[data-approve-join-request-id]')) { teamHandlers.handleApproveJoinRequest(target.closest<HTMLElement>('[data-approve-join-request-id]')!.dataset.approveJoinRequestId!); return; }
    if (target.closest<HTMLElement>('[data-reject-join-request-id]')) { teamHandlers.handleRejectJoinRequest(target.closest<HTMLElement>('[data-reject-join-request-id]')!.dataset.rejectJoinRequestId!); return; }
    const timerControls = target.closest<HTMLElement>('.timer-controls');
    if (timerControls) {
        const taskId = timerControls.dataset.timerTaskId!;
        if (state.activeTimers[taskId]) timerHandlers.stopTimer(taskId); else timerHandlers.startTimer(taskId);
        return;
    }
    if (target.closest('#global-timer-toggle')) {
        if (state.ui.globalTimer.isRunning) timerHandlers.stopGlobalTimer(); else timerHandlers.startGlobalTimer();
        return;
    }
    if (target.closest<HTMLElement>('[data-toggle-kanban-view]')) { userHandlers.handleToggleKanbanViewMode(); return; }
    if (target.closest('#edit-wiki-btn')) { wikiHandlers.startWikiEdit(); return; }
    if (target.closest('#cancel-wiki-edit-btn')) { wikiHandlers.cancelWikiEdit(); return; }
    if (target.closest('#save-wiki-btn')) { wikiHandlers.saveWikiEdit(); return; }
    if (target.closest('#wiki-history-btn')) { uiHandlers.showModal('wikiHistory', { projectId: target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId }); return; }
    if (target.closest<HTMLElement>('[data-restore-version-id]')) { wikiHandlers.handleRestoreWikiVersion(target.closest<HTMLElement>('[data-restore-version-id]')!.dataset.restoreVersionId!); return; }
    if (target.closest<HTMLElement>('[data-channel-id]')) { mainHandlers.handleSwitchChannel(target.closest<HTMLElement>('[data-channel-id]')!.dataset.channelId!); return; }
    if (target.closest<HTMLElement>('[data-approve-request-id]')) { teamHandlers.handleApproveTimeOffRequest(target.closest<HTMLElement>('[data-approve-request-id]')!.dataset.approveRequestId!); return; }
    if (target.closest<HTMLElement>('[data-reject-request-id]')) { uiHandlers.showModal('rejectTimeOffRequest', { requestId: target.closest<HTMLElement>('[data-reject-request-id]')!.dataset.rejectRequestId! }); return; }
    const ganttViewModeBtn = target.closest<HTMLElement>('[data-gantt-view-mode]');
    if (ganttViewModeBtn) { taskHandlers.handleChangeGanttViewMode(ganttViewModeBtn.dataset.ganttViewMode as any); return; }
    const taskStatusToggle = target.closest<HTMLElement>('.task-status-toggle');
    if (taskStatusToggle) { taskHandlers.handleToggleProjectTaskStatus(taskStatusToggle.dataset.taskId!); return; }
    if (target.closest('#restart-onboarding-btn')) { onboardingHandlers.startOnboarding(); return; }
    if (target.closest('.onboarding-next-btn')) { onboardingHandlers.nextStep(); return; }
    if (target.closest('.onboarding-skip-btn')) { onboardingHandlers.finishOnboarding(); return; }
    const mentionItem = target.closest<HTMLElement>('.mention-item');
    if (mentionItem) {
        const userId = mentionItem.dataset.mentionId!;
        const user = state.users.find(u => u.id === userId);
        if (user && state.ui.mention.target) { handleInsertMention(user, state.ui.mention.target); }
        return;
    }
    if (target.closest<HTMLElement>('[data-connect-provider]')) { integrationHandlers.connectIntegration(target.closest<HTMLElement>('[data-connect-provider]')!.dataset.connectProvider as any); return; }
    if (target.closest<HTMLElement>('[data-disconnect-provider]')) { integrationHandlers.disconnectIntegration(target.closest<HTMLElement>('[data-disconnect-provider]')!.dataset.disconnectProvider as any); return; }
    if (target.closest('#reset-task-filters')) { filterHandlers.resetFilters(); return; }
    if (target.closest('#save-filter-view-btn')) { filterHandlers.saveCurrentFilterView(); return; }
    if (target.closest('#update-filter-view-btn')) { filterHandlers.updateActiveFilterView(); return; }
    if (target.closest('#remove-logo-btn')) {
        setState(prevState => ({
            workspaces: prevState.workspaces.map(w => w.id === prevState.activeWorkspaceId ? { ...w, companyLogo: '' } : w)
        }), []);
        teamHandlers.handleSaveWorkspaceSettings();
        return;
    }
    if (target.closest('#save-workspace-settings-btn')) { teamHandlers.handleSaveWorkspaceSettings(); return; }
    const krValue = target.closest<HTMLElement>('.kr-value');
    if (krValue) {
        const krItem = krValue.closest<HTMLElement>('.key-result-item')!;
        krItem.dataset.editing = 'true';
        updateUI(['side-panel']);
        krItem.querySelector('input')?.focus();
        return;
    }
    const checklistItemCheckbox = target.closest<HTMLElement>('.checklist-item-checkbox');
    if (checklistItemCheckbox) {
        const taskId = (getState().ui.modal.data as TaskDetailModalData)?.taskId;
        const itemId = (checklistItemCheckbox as HTMLInputElement).dataset.itemId!;
        if (taskId && itemId) { taskHandlers.handleToggleChecklistItem(taskId, itemId); }
        return;
    }
    const deleteChecklistItemBtn = target.closest<HTMLElement>('.delete-checklist-item-btn');
    if (deleteChecklistItemBtn) {
        const taskId = (getState().ui.modal.data as TaskDetailModalData)?.taskId;
        const itemId = deleteChecklistItemBtn.dataset.itemId!;
        if (taskId && itemId) { taskHandlers.handleDeleteChecklistItem(taskId, itemId); }
        return;
    }
    const subtaskCheckbox = target.closest<HTMLElement>('.subtask-checkbox');
    if (subtaskCheckbox) {
        const subtaskId = (subtaskCheckbox as HTMLInputElement).dataset.subtaskId!;
        if (subtaskId) { taskHandlers.handleToggleSubtaskStatus(subtaskId); }
        return;
    }
    if (target.closest<HTMLElement>('[data-copy-link]')) {
        const path = target.closest<HTMLElement>('[data-copy-link]')!.dataset.copyLink!;
        const url = `${window.location.origin}/${path}`;
        navigator.clipboard.writeText(url);
        const originalText = target.closest<HTMLElement>('[data-copy-link]')!.title;
        target.closest<HTMLElement>('[data-copy-link]')!.title = t('misc.copied');
        setTimeout(() => { target.closest<HTMLElement>('[data-copy-link]')!.title = originalText; }, 1500);
        return;
    }
    if (target.closest('#add-project-section-btn')) { uiHandlers.showModal('addProjectSection', { projectId: target.closest<HTMLElement>('[data-project-id]')!.dataset.projectId }); return; }
    const editTaskViewBtn = target.closest<HTMLElement>('.edit-task-view-btn');
    if (editTaskViewBtn) {
        const item = editTaskViewBtn.closest<HTMLElement>('.task-view-item')!;
        item.querySelector('.view-mode')?.classList.add('hidden');
        item.querySelector('.edit-mode')?.classList.remove('hidden');
        return;
    }
    const cancelEditTaskViewBtn = target.closest<HTMLElement>('.cancel-task-view-edit-btn');
    if (cancelEditTaskViewBtn) {
        const item = cancelEditTaskViewBtn.closest<HTMLElement>('.task-view-item')!;
        item.querySelector('.view-mode')?.classList.remove('hidden');
        item.querySelector('.edit-mode')?.classList.add('hidden');
        return;
    }
    if (target.closest<HTMLElement>('.save-task-view-btn')) {
        const item = target.closest<HTMLElement>('.task-view-item')!;
        const viewId = item.dataset.viewId!;
        const name = item.querySelector<HTMLInputElement>('input[name="view-name"]')!.value;
        const icon = item.querySelector<HTMLInputElement>('input[name="view-icon"]')!.value;
        taskViewHandlers.handleUpdateTaskView(viewId, name, icon);
        return;
    }
    if (target.closest('#add-task-view-btn')) {
        const name = (document.getElementById('new-task-view-name') as HTMLInputElement).value;
        const icon = (document.getElementById('new-task-view-icon') as HTMLInputElement).value;
        taskViewHandlers.handleCreateTaskView(name, icon);
        (document.getElementById('new-task-view-name') as HTMLInputElement).value = '';
        return;
    }
    const milestoneCheckbox = target.closest<HTMLInputElement>('.milestone-checkbox');
    if (milestoneCheckbox) {
        const milestoneId = milestoneCheckbox.dataset.milestoneId!;
        if (milestoneId) { goalHandlers.handleToggleMilestone(milestoneId); }
        return;
    }
    const savePipelineStageBtn = target.closest<HTMLElement>('[data-save-pipeline-stage]');
    if (savePipelineStageBtn) {
        const stageId = savePipelineStageBtn.dataset.savePipelineStage!;
        const input = document.querySelector<HTMLInputElement>(`input[data-stage-name-id="${stageId}"]`);
        if (input) { pipelineHandlers.handleUpdateStage(stageId, input.value); }
        return;
    }
    const saveKanbanStageBtn = target.closest<HTMLElement>('[data-save-kanban-stage]');
    if (saveKanbanStageBtn) {
        const stageId = saveKanbanStageBtn.dataset.saveKanbanStage!;
        const input = document.querySelector<HTMLInputElement>(`input[data-stage-name-id="${stageId}"]`);
        if (input) { kanbanHandlers.handleUpdateKanbanStageName(stageId, input.value); }
        return;
    }

    const removeTagBtn = target.closest<HTMLElement>('.remove-tag-btn');
    if (removeTagBtn) {
        const container = removeTagBtn.closest<HTMLElement>('.multiselect-container')!;
        const tagId = removeTagBtn.dataset.tagId!;
        const entityType = container.dataset.entityType as TaggableEntity;
        const entityId = container.dataset.entityId!;
        if (entityType && entityId && tagId) { tagHandlers.handleToggleTag(entityType, entityId, tagId); }
        return;
    }
    if (target.closest('#create-project-from-deal-btn')) {
        const btn = target.closest<HTMLElement>('#create-project-from-deal-btn')!;
        uiHandlers.closeModal(false);
        uiHandlers.showModal('addProject', { clientId: btn.dataset.clientId, projectName: btn.dataset.dealName });
        return;
    }
    const taskCardMenuBtn = target.closest<HTMLElement>('.task-card-menu-btn');
    if (taskCardMenuBtn) {
        e.stopPropagation();
        const taskId = taskCardMenuBtn.closest<HTMLElement>('.task-card')!.dataset.taskId!;
        showTaskCardMenu(taskId, taskCardMenuBtn);
        return;
    }
    if (target.closest<HTMLElement>('[data-edit-task-id]')) {
        const taskId = target.closest<HTMLElement>('[data-edit-task-id]')!.dataset.editTaskId!;
        taskHandlers.openTaskDetail(taskId);
        closeDynamicMenus();
        return;
    }
    if (target.closest<HTMLElement>('[data-archive-task-id]')) {
        const taskId = target.closest<HTMLElement>('[data-archive-task-id]')!.dataset.archiveTaskId!;
        taskHandlers.handleToggleTaskArchive(taskId);
        closeDynamicMenus();
        return;
    }
    if (target.closest<HTMLElement>('[data-remove-member-id]')) {
        const memberId = target.closest<HTMLElement>('[data-remove-member-id]')!.dataset.removeMemberId!;
        teamHandlers.handleRemoveUserFromWorkspace(memberId);
        return;
    }
    if (target.closest('#add-milestone-btn')) {
        goalHandlers.handleAddMilestone();
        return;
    }
    const removeMilestoneBtn = target.closest('.remove-milestone-btn');
    if (removeMilestoneBtn) {
        const id = removeMilestoneBtn.closest<HTMLElement>('.milestone-item')!.dataset.id!;
        goalHandlers.handleRemoveMilestone(id);
        return;
    }
    const clientFilterStatusBtn = target.closest<HTMLElement>('[data-client-filter-status]');
    if (clientFilterStatusBtn) {
        setState(prevState => ({ ui: { ...prevState.ui, clients: { ...prevState.ui.clients, filters: { ...prevState.ui.clients.filters, status: clientFilterStatusBtn.dataset.clientFilterStatus as any } } } }), ['page']);
        return;
    }
    const teamCalendarViewBtn = target.closest<HTMLElement>('[data-team-calendar-view]');
    if (teamCalendarViewBtn) {
        setState(prevState => ({ ui: { ...prevState.ui, teamCalendar: { ...prevState.ui.teamCalendar, view: teamCalendarViewBtn.dataset.teamCalendarView as any } } }), ['page']);
        return;
    }
    const calendarNavBtn = target.closest<HTMLElement>('[data-calendar-nav]');
    if (calendarNavBtn) {
        const direction = calendarNavBtn.dataset.calendarNav;
        const targetCalendar = calendarNavBtn.dataset.targetCalendar;
        
        setState(prevState => {
            if (targetCalendar === 'team') {
                const viewKey = prevState.ui.teamCalendar.view;
                const currentDate = new Date(prevState.ui.teamCalendar.date + 'T12:00:00Z');
                
                if (direction === 'prev') {
                    if (viewKey === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
                    else if (['week', 'workload', 'timesheet'].includes(viewKey)) currentDate.setDate(currentDate.getDate() - 7);
                    else if (viewKey === 'day') currentDate.setDate(currentDate.getDate() - 1);
                } else { // 'next'
                    if (viewKey === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
                    else if (['week', 'workload', 'timesheet'].includes(viewKey)) currentDate.setDate(currentDate.getDate() + 7);
                    else if (viewKey === 'day') currentDate.setDate(currentDate.getDate() + 1);
                }
                return { ui: { ...prevState.ui, teamCalendar: { ...prevState.ui.teamCalendar, date: currentDate.toISOString().slice(0, 10) } } };
            } else { // for tasks calendar
                const currentDate = new Date(prevState.ui.calendarDate + '-15T12:00:00Z');
                if (direction === 'prev') {
                    currentDate.setMonth(currentDate.getMonth() - 1);
                } else { // 'next'
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
                return { ui: { ...prevState.ui, calendarDate: currentDate.toISOString().slice(0, 7) } };
            }
        }, ['page']);
        return;
    }

}