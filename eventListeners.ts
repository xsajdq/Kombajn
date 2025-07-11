
import { state, saveState } from './state.ts';
import { renderApp } from './app-renderer.ts';
import { handleAiTaskGeneration, generateInvoicePDF } from './services.ts';
import type { InvoiceLineItem, Task, Role, PlanId, User, DateRangeFilter, CustomFieldType, Workspace, DashboardWidgetType, AppState } from './types.ts';
import { t } from './i18n.ts';
import { apiPost, apiPut } from './services/api.ts';

import * as aiHandlers from './handlers/ai.ts';
import * as billingHandlers from './handlers/billing.ts';
import * as commandHandlers from './handlers/commands.ts';
import * as dndHandlers from './handlers/dnd.ts';
import * as formHandlers from './handlers/form.ts';
import * as invoiceHandlers from './handlers/invoices.ts';
import * as mainHandlers from './handlers/main.ts';
import * as notificationHandlers from './handlers/notifications.ts';
import * as reportHandlers from './handlers/reports.ts';
import * as taskHandlers from './handlers/tasks.ts';
import * as teamHandlers from './handlers/team.ts';
import * as timerHandlers from './handlers/timers.ts';
import * as uiHandlers from './handlers/ui.ts';
import * as wikiHandlers from './handlers/wiki.ts';
import * as automationHandlers from './handlers/automations.ts';
import * as dashboardHandlers from './handlers/dashboard.ts';
import * as userHandlers from './handlers/user.ts';
import * as calendarHandlers from './handlers/calendar.ts';
import * as auth from './services/auth.ts';
import { renderLoginForm, renderRegisterForm } from './pages/AuthPage.ts';
import { subscribeToRealtimeUpdates } from './services/supabase.ts';
import * as onboardingHandlers from './handlers/onboarding.ts';
import { formatDate } from './utils.ts';

// --- MENTION HANDLING ---
function handleInsertMention(mentionItem: HTMLElement) {
    const targetInput = state.ui.mention.target as HTMLInputElement;
    if (!targetInput) return;

    const mentionName = mentionItem.dataset.mentionName;
    if (!mentionName) return;

    const currentText = targetInput.value;
    const atMatchIndex = currentText.lastIndexOf('@');

    if (atMatchIndex > -1) {
        const textBefore = currentText.substring(0, atMatchIndex);
        targetInput.value = `${textBefore}@${mentionName} `;
        targetInput.focus();
        const newCursorPos = targetInput.value.length;
        targetInput.setSelectionRange(newCursorPos, newCursorPos);
    }

    state.ui.mention = { query: null, target: null, activeIndex: 0 };
    renderApp();
}

function handleMentionInput(input: HTMLInputElement) {
    const text = input.value;
    const cursorPosition = input.selectionStart || 0;
    const textUpToCursor = text.substring(0, cursorPosition);
    const atMatch = textUpToCursor.match(/@([\w\s]*)$/);

    if (atMatch) {
        const query = atMatch[1];
        state.ui.mention = {
            query: query,
            target: input,
            activeIndex: 0
        };
    } else {
        state.ui.mention = {
            query: null,
            target: null,
            activeIndex: 0
        };
    }
    renderApp();
}


export function setupEventListeners(bootstrapApp: () => void) {
  document.body.addEventListener('click', async (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // --- Logout ---
    if (target.closest('[data-logout-button]')) {
        auth.logout();
    }
    
    // --- Modals ---
    const modalTarget = target.closest<HTMLElement>('[data-modal-target]');
    if (modalTarget) {
        const type = modalTarget.dataset.modalTarget as AppState['ui']['modal']['type'];
        const data = { ...modalTarget.dataset };
        uiHandlers.showModal(type, data);
    }
    if (target.closest('.btn-close-modal') || (target.matches('.modal-overlay') && !target.closest('.modal-content'))) {
        uiHandlers.closeModal();
    }
    
    // --- Side Panels ---
    const projectTarget = target.closest<HTMLElement>('[data-project-id]');
    if (projectTarget && !projectTarget.closest('.side-panel')) {
        uiHandlers.openProjectPanel(projectTarget.dataset.projectId!);
    }
    const clientTarget = target.closest<HTMLElement>('[data-client-id]');
    if (clientTarget && !clientTarget.closest('.side-panel') && state.currentPage === 'clients') {
        uiHandlers.openClientPanel(clientTarget.dataset.clientId!);
    }
    if (target.closest('.btn-close-panel') || target.matches('.side-panel-overlay')) {
        uiHandlers.closeSidePanels();
    }
    
    // --- Timers ---
    const timerButton = target.closest<HTMLElement>('[data-timer-task-id]');
    if (timerButton) {
        const taskId = timerButton.dataset.timerTaskId!;
        timerHandlers.startTimer(taskId);
    }
    
    // --- Tasks ---
    if (target.closest('.clickable[data-task-id]')) {
      const taskId = target.closest<HTMLElement>('[data-task-id]')!.dataset.taskId!;
      taskHandlers.openTaskDetail(taskId);
    }
    if (target.id === 'submit-comment-btn') {
        const taskId = state.ui.modal.data?.taskId;
        const input = document.getElementById('task-comment-input') as HTMLInputElement;
        if (taskId && input) {
            taskHandlers.handleAddTaskComment(taskId, input);
        }
    }
    if (target.matches('.subtask-checkbox')) {
        taskHandlers.handleToggleSubtaskStatus((target as HTMLInputElement).dataset.subtaskId!);
    }
     if (target.closest('.delete-subtask-btn')) {
        taskHandlers.handleDeleteSubtask(target.closest<HTMLElement>('.delete-subtask-btn')!.dataset.subtaskId!);
    }
     if (target.closest('.delete-attachment-btn')) {
        taskHandlers.handleRemoveAttachment(target.closest<HTMLElement>('.delete-attachment-btn')!.dataset.attachmentId!);
    }
     if (target.closest('.delete-dependency-btn')) {
        taskHandlers.handleRemoveDependency(target.closest<HTMLElement>('.delete-dependency-btn')!.dataset.dependencyId!);
    }
    
    // --- Tabs ---
    const tab = target.closest<HTMLElement>('[data-tab]');
    if (tab) {
        const newTab = tab.dataset.tab;
        if (tab.closest('.task-detail-tabs')) state.ui.taskDetail.activeTab = newTab as any;
        if (tab.closest('.side-panel-tabs')) state.ui.openedProjectTab = newTab as any;
        if (tab.closest('.settings-tabs')) state.ui.settings.activeTab = newTab as any;
        if (tab.closest('.reports-tabs')) state.ui.reports.activeTab = newTab as any;
        if (tab.closest('.notifications-tabs')) state.ui.notifications.activeTab = newTab as any;
        if (tab.closest('.auth-tabs')) {
             document.querySelector('.auth-tab.active')?.classList.remove('active');
             tab.classList.add('active');
             const container = document.getElementById('auth-form-container')!;
             container.innerHTML = newTab === 'login' ? renderLoginForm() : renderRegisterForm();
        }
         if (tab.closest('.hr-tabs')) teamHandlers.handleSwitchHrTab(newTab as any);

        renderApp();
    }
    
    // --- Invoices ---
    const downloadInvoiceBtn = target.closest<HTMLElement>('[data-download-invoice-id]');
    if (downloadInvoiceBtn) generateInvoicePDF(downloadInvoiceBtn.dataset.downloadInvoiceId!);
    if (target.id === 'add-invoice-item-btn') invoiceHandlers.handleAddInvoiceItem();
    if (target.closest('.remove-invoice-item')) invoiceHandlers.handleRemoveInvoiceItem(target.closest<HTMLElement>('[data-item-id]')!);
    if (target.id === 'generate-invoice-items-btn') invoiceHandlers.handleGenerateInvoiceItems();
    if (target.closest('[data-toggle-invoice-status-id]')) invoiceHandlers.handleToggleInvoiceStatus(target.closest<HTMLElement>('[data-toggle-invoice-status-id]')!.dataset.toggleInvoiceStatusId!);
    if (target.closest('[data-send-invoice-id]')) invoiceHandlers.handleSendInvoiceByEmail(target.closest<HTMLElement>('[data-send-invoice-id]')!.dataset.sendInvoiceId!);

    
    // --- AI Assistant ---
    const addAiTaskBtn = target.closest<HTMLElement>('.add-ai-task-btn');
    if (addAiTaskBtn) {
      const index = parseInt(addAiTaskBtn.dataset.taskIndex!, 10);
      const projectId = (document.getElementById('ai-project-select') as HTMLSelectElement).value;
      aiHandlers.handleAddAiTask(index, projectId);
    }
    
    // --- Team / HR ---
     if (target.closest('[data-approve-request-id]')) teamHandlers.handleApproveTimeOffRequest(target.closest<HTMLElement>('[data-approve-request-id]')!.dataset.approveRequestId!);
     if (target.closest('[data-reject-request-id]')) uiHandlers.showModal('rejectTimeOffRequest', { requestId: target.closest<HTMLElement>('[data-reject-request-id]')!.dataset.rejectRequestId! });
     if (target.closest('[data-approve-join-request-id]')) teamHandlers.handleApproveJoinRequest(target.closest<HTMLElement>('[data-approve-join-request-id]')!.dataset.approveJoinRequestId!);
     if (target.closest('[data-reject-join-request-id]')) teamHandlers.handleRejectJoinRequest(target.closest<HTMLElement>('[data-reject-join-request-id]')!.dataset.rejectJoinRequestId!);
     if (target.closest('[data-remove-project-member-id]')) teamHandlers.handleRemoveUserFromProject(target.closest<HTMLElement>('[data-remove-project-member-id]')!.dataset.removeProjectMemberId!);
     
    // --- Wiki ---
    if (target.id === 'edit-wiki-btn') wikiHandlers.startWikiEdit();
    if (target.id === 'cancel-wiki-edit-btn') wikiHandlers.cancelWikiEdit();
    if (target.id === 'save-wiki-btn') wikiHandlers.saveWikiEdit();
    if (target.id === 'wiki-history-btn') uiHandlers.showModal('wikiHistory', { projectId: target.dataset.projectId });
    if (target.closest('[data-restore-wiki-version-id]')) wikiHandlers.handleRestoreWikiVersion(target.closest<HTMLElement>('[data-restore-wiki-version-id]')!.dataset.restoreWikiVersionId!);

    // --- Command Palette / FAB ---
    if (target.id === 'fab-new-task') commandHandlers.executeCommand('new-task');
    const commandItem = target.closest<HTMLElement>('.command-item');
    if (commandItem && commandItem.dataset.commandId) commandHandlers.executeCommand(commandItem.dataset.commandId);

    // --- Notifications ---
    if (target.id === 'notification-bell') notificationHandlers.toggleNotificationsPopover();
    if (target.closest('.notification-item')) notificationHandlers.handleNotificationClick(target.closest<HTMLElement>('.notification-item')!.dataset.notificationId!);
    if (target.id === 'mark-all-read-btn') notificationHandlers.markAllNotificationsAsRead();
    
    // --- Billing ---
    const planButton = target.closest<HTMLElement>('[data-plan-id]');
    if (planButton && !planButton.hasAttribute('disabled')) uiHandlers.showModal('confirmPlanChange', { planId: planButton.dataset.planId, planName: t(`billing.plan_${planButton.dataset.planId!}`) });
    if (target.id === 'modal-confirm-plan-change-btn') billingHandlers.handlePlanChange(target.dataset.planId as PlanId);

    // --- Dashboard ---
    if (target.id === 'toggle-dashboard-edit-mode') dashboardHandlers.toggleEditMode();
    if (target.id === 'add-widget-btn') uiHandlers.showModal('addWidget');
    if (target.closest('[data-configure-widget-id]')) dashboardHandlers.showConfigureWidgetModal(target.closest<HTMLElement>('[data-configure-widget-id]')!.dataset.configureWidgetId!);
    if (target.closest('[data-remove-widget-id]')) dashboardHandlers.removeWidget(target.closest<HTMLElement>('[data-remove-widget-id]')!.dataset.removeWidgetId!);
    if (target.closest('[data-widget-type]')) dashboardHandlers.addWidget(target.closest<HTMLElement>('[data-widget-type]')!.dataset.widgetType as DashboardWidgetType);
    if (target.closest('[data-resize-action]')) {
        const btn = target.closest<HTMLElement>('[data-resize-action]')!;
        dashboardHandlers.handleWidgetResize(btn.dataset.widgetId!, btn.dataset.resizeAction as any);
    }
    
    // --- Mention Popover ---
    const mentionItem = target.closest<HTMLElement>('.mention-item');
    if (mentionItem) handleInsertMention(mentionItem);

     // --- Calendar ---
    if (target.closest('[data-calendar-nav]')) {
        const nav = target.closest<HTMLElement>('[data-calendar-nav]')!.dataset;
        const targetCalendar = nav.targetCalendar;
        const direction = nav.calendarNav as 'prev' | 'next';
        const dateKey = targetCalendar === 'team' ? 'teamCalendarDate' : 'calendarDate';
        const viewKey = targetCalendar === 'team' ? 'teamCalendarView' : 'tasksViewMode';
        const view = state.ui[viewKey];
        const currentDate = new Date(state.ui[dateKey] + 'T12:00:00Z');
        let increment: 'day' | 'week' | 'month' = 'month';
        if (view === 'day') increment = 'day';
        if (view === 'week') increment = 'week';
        
        if (increment === 'day') currentDate.setDate(currentDate.getDate() + (direction === 'prev' ? -1 : 1));
        if (increment === 'week') currentDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7));
        if (increment === 'month') currentDate.setMonth(currentDate.getMonth() + (direction === 'prev' ? -1 : 1));

        if (dateKey === 'teamCalendarDate') {
            state.ui.teamCalendarDate = currentDate.toISOString().slice(0, 10);
        } else {
            state.ui.calendarDate = currentDate.toISOString().slice(0, 7);
        }
        renderApp();
    }
    if (target.closest('[data-team-calendar-view]')) {
        state.ui.teamCalendarView = target.closest<HTMLElement>('[data-team-calendar-view]')!.dataset.teamCalendarView as any;
        renderApp();
    }
    
     // --- Onboarding ---
    if (target.closest('.onboarding-next-btn')) onboardingHandlers.nextStep();
    if (target.closest('.onboarding-skip-btn')) onboardingHandlers.finishOnboarding();
    
    // --- Project Menu ---
    if (target.closest('#project-menu-toggle')) {
        mainHandlers.toggleProjectMenu();
    } else if (!target.closest('.project-header-menu')) {
        mainHandlers.closeProjectMenu();
    }
    if(target.id === 'save-as-template-btn') mainHandlers.handleSaveProjectAsTemplate(target.dataset.projectId!);


    // Close popovers if clicking outside
    if (!target.closest('.notification-wrapper')) notificationHandlers.toggleNotificationsPopover(false);
    if (!target.closest('.command-palette-overlay')) uiHandlers.toggleCommandPalette(false);
    if (!target.closest('.mention-popover') && !target.matches('#task-comment-input, #chat-message-input')) {
        if (state.ui.mention.target) {
            state.ui.mention.target = null;
            renderApp();
        }
    }
  });

  document.body.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    const target = e.target as HTMLFormElement;

    const authSubmitButton = target.querySelector<HTMLButtonElement>('button[type="submit"]');
    if(authSubmitButton) authSubmitButton.disabled = true;

    if (target.id === 'loginForm') {
        const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
        const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
        const errorEl = document.getElementById('login-error')!;
        try {
            await auth.login(email, password);
            await bootstrapApp();
        } catch (error: any) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
        }
    } else if (target.id === 'registerForm') {
        const name = (document.getElementById('registerName') as HTMLInputElement).value;
        const email = (document.getElementById('registerEmail') as HTMLInputElement).value;
        const password = (document.getElementById('registerPassword') as HTMLInputElement).value;
        const errorEl = document.getElementById('register-error')!;
        try {
            await auth.signup(name, email, password);
            await bootstrapApp();
        } catch (error: any) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
        }
    } else if (target.id === 'create-workspace-setup-form' || target.id === 'create-workspace-form') {
        const inputId = target.id.includes('setup') ? 'new-workspace-name-setup' : 'new-workspace-name';
        const name = (document.getElementById(inputId) as HTMLInputElement).value;
        await teamHandlers.handleCreateWorkspace(name);
    } else if (target.id === 'join-workspace-setup-form') {
         const name = (document.getElementById('join-workspace-name-setup') as HTMLInputElement).value;
         await teamHandlers.handleRequestToJoinWorkspace(name);
    } else if (target.id === 'ai-task-generator-form') {
        const prompt = (document.getElementById('ai-prompt') as HTMLTextAreaElement).value;
        handleAiTaskGeneration(prompt);
    } else if (target.id === 'invite-user-form') {
        const email = (document.getElementById('invite-email') as HTMLInputElement).value;
        const role = (document.getElementById('invite-role') as HTMLSelectElement).value as Role;
        await teamHandlers.handleInviteUser(email, role);
        target.reset();
    } else if (target.id === 'add-automation-form') {
        const projectId = (document.getElementById('automation-project') as HTMLSelectElement).value;
        const status = (document.getElementById('automation-trigger-status') as HTMLSelectElement).value as Task['status'];
        const userId = (document.getElementById('automation-action-user') as HTMLSelectElement).value;
        automationHandlers.handleAddAutomation(projectId, status, userId);
        target.reset();
    } else if (target.id === 'widgetConfigForm') {
        dashboardHandlers.handleWidgetConfigSave(target.dataset.widgetId!);
    } else if (target.id === 'update-profile-form') {
        userHandlers.handleUpdateProfile(target);
    } else if (target.id === 'update-password-form') {
        userHandlers.handleUpdatePassword(target);
    } else if (target.id === 'add-subtask-form') {
        taskHandlers.handleAddSubtask(target.dataset.parentTaskId!, (target.querySelector('input') as HTMLInputElement).value);
        target.reset();
    } else if (target.id === 'add-dependency-form') {
        taskHandlers.handleAddDependency((target.querySelector('select') as HTMLSelectElement).value, target.dataset.blockedTaskId!);
        target.reset();
    } else if (target.id === 'add-custom-field-form') {
        const name = (document.getElementById('custom-field-name') as HTMLInputElement).value;
        const type = (document.getElementById('custom-field-type') as HTMLSelectElement).value as CustomFieldType;
        taskHandlers.handleAddCustomFieldDefinition(name, type);
        target.reset();
    } else if (target.id === 'add-project-member-form') {
        const userId = (document.getElementById('project-member-select') as HTMLSelectElement).value;
        const role = (document.getElementById('project-role-select') as HTMLSelectElement).value as Role;
        await apiPost('project_members', { projectId: target.dataset.projectId, userId, role });
        renderApp();
    } else if (target.id === 'chat-form') {
        const input = document.getElementById('chat-message-input') as HTMLInputElement;
        if (input.value.trim()) {
            mainHandlers.handleSendMessage(state.ui.activeChannelId!, input.value.trim());
            input.value = '';
        }
    } else {
        // Fallback for all modal forms
        formHandlers.handleFormSubmit();
    }

    if(authSubmitButton) authSubmitButton.disabled = false;
  });

  document.body.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const { settings, ui } = state;
    const { taskFilters, invoiceFilters, modal, reports: { filters: reportFilters } } = ui;

    // --- Filters ---
    if (target.id === 'task-filter-text') taskFilters.text = target.value;
    if (target.id === 'task-filter-project') taskFilters.projectId = target.value;
    if (target.id === 'task-filter-assignee') taskFilters.assigneeId = target.value;
    if (target.id === 'task-filter-priority') taskFilters.priority = target.value;
    if (target.id === 'task-filter-status') taskFilters.status = target.value;
    if (target.id === 'task-filter-date-range') taskFilters.dateRange = target.value as DateRangeFilter;
    if (target.id.startsWith('invoice-filter-')) {
        const key = target.id.replace('invoice-filter-', '').replace('-', '_') as keyof typeof invoiceFilters;
        (invoiceFilters as any)[key] = target.value;
    }
    if (target.id.startsWith('report-filter-')) {
        const key = target.id.replace('report-filter-', '').replace('-', '_') as keyof typeof reportFilters;
        (reportFilters as any)[key] = target.value;
    }

    // --- Settings ---
    if (target.id === 'theme-switcher') {
        settings.theme = target.value as any;
        saveState();
    }
    if (target.id === 'language-switcher') {
        settings.language = target.value as any;
        saveState();
    }
    if (target.id === 'kanban-workflow-switcher') {
        settings.defaultKanbanWorkflow = target.value as any;
        saveState();
    }
    
    // --- Workspace settings ---
    const wsSettingField = target.closest<HTMLElement>('#workspace-settings-form [data-field]');
    if (wsSettingField && state.activeWorkspaceId) {
        const key = wsSettingField.dataset.field as keyof Workspace;
        const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (ws) (ws as any)[key] = target.value;
    }
    
    // --- Command Palette ---
    if (target.id === 'command-palette-input') ui.commandPaletteQuery = target.value;
    
    // --- Mentions ---
    if (target.matches('#task-comment-input, #chat-message-input')) {
        handleMentionInput(target);
    }

    // --- Invoice Items ---
    if (target.closest('.invoice-item-editor')) {
        const itemEditor = target.closest<HTMLElement>('.invoice-item-editor')!;
        const itemId = parseInt(itemEditor.dataset.itemId!, 10);
        const field = target.dataset.field as keyof InvoiceLineItem;
        const value = field === 'description' ? target.value : parseFloat(target.value);
        const item = modal.data.items.find((i: InvoiceLineItem) => i.id === itemId);
        if (item) (item as any)[field] = value;
    }

    // --- Task Detail ---
    if (target.closest('.task-detail-sidebar')) {
      const field = target.dataset.field as keyof Task;
      if (field) {
        taskHandlers.handleTaskDetailUpdate(modal.data.taskId, field, target.value);
      }
      const customFieldContainer = target.closest<HTMLElement>('[data-custom-field-id]');
      if (customFieldContainer) {
        const fieldId = customFieldContainer.dataset.customFieldId!;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        taskHandlers.handleCustomFieldValueUpdate(modal.data.taskId, fieldId, value);
      }
    }
    
    renderApp();
  });

   document.body.addEventListener('change', async (e: Event) => {
        const target = e.target as HTMLElement;
        
        // --- Workspace Switcher ---
        if (target.id === 'workspace-switcher') {
            teamHandlers.handleWorkspaceSwitch((target as HTMLSelectElement).value);
        }

        // --- Team Management ---
        const memberRoleSelect = target.closest<HTMLSelectElement>('[data-project-member-id]');
        if (memberRoleSelect) {
            const memberId = memberRoleSelect.dataset.projectMemberId!;
            const newRole = memberRoleSelect.value as Role;
            await apiPut('project_members', { id: memberId, role: newRole });
        }

        // --- Dashboard grid columns ---
        if (target.id === 'dashboard-grid-columns') {
            await dashboardHandlers.handleGridColumnsChange(parseInt((target as HTMLSelectElement).value, 10));
        }

        // --- File Uploads ---
        if (target.id === 'project-file-upload') {
            const input = target as HTMLInputElement;
            if (input.files?.length) {
                mainHandlers.handleFileUpload(input.dataset.projectId!, input.files[0]);
            }
        }
        if (target.id === 'attachment-file-input') {
            const input = target as HTMLInputElement;
            if (input.files?.length) {
                taskHandlers.handleAddAttachment(input.dataset.taskId!, input.files[0]);
            }
        }
        if (target.id === 'logo-upload') {
             const input = target as HTMLInputElement;
             if (input.files?.length && state.activeWorkspaceId) {
                 const file = input.files[0];
                 const reader = new FileReader();
                 reader.onloadend = () => {
                     const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId);
                     if (ws) ws.companyLogo = reader.result as string;
                     renderApp();
                 };
                 reader.readAsDataURL(file);
             }
        }
   });

  document.body.addEventListener('keydown', (e: KeyboardEvent) => {
    // Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        uiHandlers.toggleCommandPalette();
    }
    if (state.ui.isCommandPaletteOpen) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const count = document.querySelectorAll('.command-item').length;
            state.ui.commandPaletteActiveIndex = (state.ui.commandPaletteActiveIndex + 1) % count;
            renderApp();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const count = document.querySelectorAll('.command-item').length;
            state.ui.commandPaletteActiveIndex = (state.ui.commandPaletteActiveIndex - 1 + count) % count;
            renderApp();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = document.querySelector('.command-item.active');
            if (activeItem) commandHandlers.executeCommand((activeItem as HTMLElement).dataset.commandId!);
        } else if (e.key === 'Escape') {
             uiHandlers.toggleCommandPalette(false);
        }
    }
    // New Task Shortcut
    if (e.key.toLowerCase() === 'n' && !state.ui.modal.isOpen && !state.ui.isCommandPaletteOpen && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        uiHandlers.showModal('addTask');
    }
    // Escape to close modals/panels
    if (e.key === 'Escape') {
        if (state.ui.modal.isOpen) uiHandlers.closeModal();
        else if (state.ui.openedProjectId || state.ui.openedClientId) uiHandlers.closeSidePanels();
    }
    
    // Mention popover navigation
    if (state.ui.mention.target && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
        const items = document.querySelectorAll('.mention-item');
        if (items.length > 0) {
            e.preventDefault();
            if (e.key === 'ArrowDown') {
                state.ui.mention.activeIndex = (state.ui.mention.activeIndex + 1) % items.length;
            } else if (e.key === 'ArrowUp') {
                state.ui.mention.activeIndex = (state.ui.mention.activeIndex - 1 + items.length) % items.length;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                const activeItem = items[state.ui.mention.activeIndex] as HTMLElement;
                if (activeItem) handleInsertMention(activeItem);
                return;
            }
        }
         if (e.key === 'Escape') {
            state.ui.mention.target = null;
        }
        renderApp();
    }
  });

  // DND Handlers
  document.body.addEventListener('dragstart', dndHandlers.handleDragStart);
  document.body.addEventListener('dragend', dndHandlers.handleDragEnd);
  document.body.addEventListener('dragover', dndHandlers.handleDragOver);
  document.body.addEventListener('drop', dndHandlers.handleDrop);

  document.body.addEventListener('dragstart', dashboardHandlers.handleWidgetDragStart);
  document.body.addEventListener('dragend', dashboardHandlers.handleWidgetDragEnd);
  document.body.addEventListener('dragover', dashboardHandlers.handleWidgetDragOver);
  document.body.addEventListener('drop', dashboardHandlers.handleWidgetDrop);
}
