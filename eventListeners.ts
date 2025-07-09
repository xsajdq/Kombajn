
import { state, saveState } from './state.ts';
import { renderApp, renderMentionPopover } from './app-renderer.ts';
import { handleAiTaskGeneration, generateInvoicePDF } from './services.ts';
import type { InvoiceLineItem, Task, Role, PlanId, User, DateRangeFilter, CustomFieldType, Workspace, DashboardWidgetType } from '../types.ts';
import { t } from './i18n.ts';

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
import * as auth from './services/auth.ts';
import { renderLoginForm, renderRegisterForm } from './pages/AuthPage.ts';


function handleMentionInput(input: HTMLInputElement) {
    const text = input.value;
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
        state.ui.mention.query = mentionMatch[1];
        state.ui.mention.target = input;
        state.ui.mention.activeIndex = 0;
    } else {
        state.ui.mention.query = null;
        state.ui.mention.target = null;
    }
    renderMentionPopover();
}

function handleInsertMention(user: User, input: HTMLInputElement) {
    const text = input.value;
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionRegex = /@(\w*)$/;
    
    // Format mention as `@[User Name](user:u1)`
    const mentionTag = `@[${user.name || user.initials}](user:${user.id}) `;
    
    const newText = textBeforeCursor.replace(mentionRegex, mentionTag) + text.substring(cursorPos);
    
    input.value = newText;
    state.ui.mention.query = null;
    state.ui.mention.target = null;
    renderMentionPopover();
    input.focus();
    input.selectionStart = input.selectionEnd = textBeforeCursor.replace(mentionRegex, mentionTag).length;
}

export function setupEventListeners(bootstrapCallback: () => Promise<void>) {
    const app = document.getElementById('app')!;
    
    // --- Global Keydown Listener ---
    window.addEventListener('keydown', (e: KeyboardEvent) => {
        // Command Palette
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            uiHandlers.toggleCommandPalette();
            return;
        }

        // Close modals/panels with Escape
        if (e.key === 'Escape') {
            if (state.ui.isCommandPaletteOpen) {
                uiHandlers.toggleCommandPalette(false);
            } else if (state.ui.modal.isOpen) {
                uiHandlers.closeModal();
            } else if (state.ui.openedClientId || state.ui.openedProjectId) {
                uiHandlers.closeSidePanels();
            }
            return;
        }
        
        // Accessibility: Activate role="button" elements with Enter/Space
        if (e.key === 'Enter' || e.key === ' ') {
            const targetEl = e.target as HTMLElement;
            if (targetEl.getAttribute('role') === 'button' && targetEl.tagName !== 'BUTTON') {
                e.preventDefault();
                targetEl.click();
            }
        }


        // Handle interactions within popovers
        const targetPopover = document.querySelector('.mention-popover, .command-palette-list');
        if (targetPopover) {
            const items = targetPopover.querySelectorAll('.mention-item, .command-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                let activeIndex = state.ui.mention.target ? state.ui.mention.activeIndex : state.ui.commandPaletteActiveIndex;
                activeIndex = (activeIndex + 1) % items.length;
                if (state.ui.mention.target) {
                    state.ui.mention.activeIndex = activeIndex;
                    renderMentionPopover();
                } else {
                    state.ui.commandPaletteActiveIndex = activeIndex;
                    renderApp();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                let activeIndex = state.ui.mention.target ? state.ui.mention.activeIndex : state.ui.commandPaletteActiveIndex;
                activeIndex = (activeIndex - 1 + items.length) % items.length;
                 if (state.ui.mention.target) {
                    state.ui.mention.activeIndex = activeIndex;
                    renderMentionPopover();
                } else {
                    state.ui.commandPaletteActiveIndex = activeIndex;
                    renderApp();
                }
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const activeItem = state.ui.mention.target
                    ? items[state.ui.mention.activeIndex] as HTMLElement
                    : items[state.ui.commandPaletteActiveIndex] as HTMLElement;

                if (activeItem) {
                    if (state.ui.mention.target) {
                         const userId = activeItem.dataset.mentionId!;
                        const user = state.users.find(u => u.id === userId);
                        if(user) handleInsertMention(user, state.ui.mention.target as HTMLInputElement);
                    } else {
                        commandHandlers.executeCommand(activeItem.dataset.commandId!);
                    }
                }
            }
            return;
        }


        // Global shortcuts (only when not in an input)
        if (e.target instanceof HTMLElement && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            if (e.key === 'n') {
                e.preventDefault();
                uiHandlers.showModal('addTask');
            }
            if (e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('task-filter-text');
                if (searchInput) {
                    uiHandlers.toggleTaskFilters(true); // Ensure filters are open
                    searchInput.focus();
                }
            }
        }
    });


    app.addEventListener('submit', async (e: SubmitEvent) => {
        const target = e.target as HTMLElement;
        e.preventDefault();

        if (target.id === 'loginForm') {
            const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
            const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
            const errorDiv = document.getElementById('login-error')!;
            const button = document.getElementById('login-submit-btn') as HTMLButtonElement;
            button.textContent = 'Logging in...';
            button.disabled = true;
            errorDiv.style.display = 'none';

            auth.login(email, password)
                .then(() => bootstrapCallback())
                .catch(err => {
                    errorDiv.textContent = err.message;
                    errorDiv.style.display = 'block';
                    button.textContent = 'Log In';
                    button.disabled = false;
                });
            return;
        }

        if (target.id === 'registerForm') {
            const name = (document.getElementById('registerName') as HTMLInputElement).value;
            const email = (document.getElementById('registerEmail') as HTMLInputElement).value;
            const password = (document.getElementById('registerPassword') as HTMLInputElement).value;
            const errorDiv = document.getElementById('register-error')!;
            const button = document.getElementById('register-submit-btn') as HTMLButtonElement;
            button.textContent = 'Registering...';
            button.disabled = true;
            errorDiv.style.display = 'none';

            auth.signup(name, email, password)
                .then(() => bootstrapCallback())
                .catch(err => {
                    errorDiv.textContent = err.message;
                    errorDiv.style.display = 'block';
                    button.textContent = 'Register';
                    button.disabled = false;
                });
            return;
        }
        
        if (target.id === 'create-workspace-setup-form') {
            const nameInput = document.getElementById('new-workspace-name-setup') as HTMLInputElement;
            const name = nameInput.value.trim();
            if (name) {
                await teamHandlers.handleCreateWorkspace(name, bootstrapCallback);
            }
            return;
        }

        if (target.id === 'join-workspace-setup-form') {
            const nameInput = document.getElementById('join-workspace-name-setup') as HTMLInputElement;
            const name = nameInput.value.trim();
            if (name) {
                await teamHandlers.handleRequestToJoinWorkspace(name);
            }
            return;
        }

        if (target.id === 'ai-task-generator-form') {
            const promptEl = document.getElementById('ai-prompt') as HTMLTextAreaElement;
            const promptText = promptEl.value.trim();
            if (promptText) {
                handleAiTaskGeneration(promptText);
            }
        } else if (target.id === 'invite-user-form') {
            const emailInput = document.getElementById('invite-email') as HTMLInputElement;
            const roleInput = document.getElementById('invite-role') as HTMLSelectElement;
            const email = emailInput.value.trim();
            const role = roleInput.value as Role;
            if (email && role) {
                teamHandlers.handleInviteUser(email, role);
                emailInput.value = ''; // Clear form
            }
        } else if (target.id === 'create-workspace-form') {
            const nameInput = document.getElementById('new-workspace-name') as HTMLInputElement;
            const name = nameInput.value.trim();
            if (name) {
                await teamHandlers.handleCreateWorkspace(name, bootstrapCallback);
                nameInput.value = ''; // Clear form
            }
        } else if (target.id === 'add-subtask-form') {
            const input = target.querySelector<HTMLInputElement>('input')!;
            const parentTaskId = target.dataset.parentTaskId!;
            if (input.value.trim() && parentTaskId) {
                taskHandlers.handleAddSubtask(parentTaskId, input.value.trim());
                input.value = '';
            }
        } else if (target.id === 'add-dependency-form') {
            const select = target.querySelector('select') as HTMLSelectElement;
            const blockedTaskId = target.dataset.blockedTaskId!;
            const blockingTaskId = select.value;
            if (blockedTaskId && blockingTaskId) {
                taskHandlers.handleAddDependency(blockingTaskId, blockedTaskId);
            }
        } else if (target.id === 'add-custom-field-form') {
            const nameInput = target.querySelector<HTMLInputElement>('#custom-field-name')!;
            const typeInput = target.querySelector<HTMLSelectElement>('#custom-field-type')!;
            if (nameInput.value && typeInput.value) {
                taskHandlers.handleAddCustomFieldDefinition(nameInput.value, typeInput.value as CustomFieldType);
                nameInput.value = '';
            }
        } else if (target.id === 'add-automation-form') {
            const projectId = target.querySelector<HTMLSelectElement>('#automation-project')!.value;
            const triggerStatus = target.querySelector<HTMLSelectElement>('#automation-trigger-status')!.value as Task['status'];
            const actionUser = target.querySelector<HTMLSelectElement>('#automation-action-user')!.value;
            if (projectId && triggerStatus && actionUser) {
                automationHandlers.handleAddAutomation(projectId, triggerStatus, actionUser);
            }
        } else if (target.id === 'chat-form') {
            const input = document.getElementById('chat-message-input') as HTMLInputElement;
            const content = input.value.trim();
            if (content && state.ui.activeChannelId) {
                mainHandlers.handleSendMessage(state.ui.activeChannelId, content);
                input.value = '';
            }
        }
    });

    app.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        const target = e.target as Element;

        // --- NEW: Auth Page Tabs ---
        const authTab = target.closest<HTMLElement>('.auth-tab');
        if (authTab) {
            const tabName = authTab.dataset.authTab;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            authTab.classList.add('active');
            const container = document.getElementById('auth-form-container')!;
            if (tabName === 'login') {
                container.innerHTML = renderLoginForm();
            } else {
                container.innerHTML = renderRegisterForm();
            }
            return;
        }
        
        // --- NEW: Logout Button ---
        const logoutBtn = target.closest<HTMLElement>('[data-logout-button]');
        if (logoutBtn) {
            auth.logout();
            return;
        }


        // Close popovers if click is outside
        if (!target.closest('.notification-wrapper') && state.ui.isNotificationsOpen) {
            notificationHandlers.toggleNotificationsPopover(false);
        }
        if (!target.closest('.command-palette') && state.ui.isCommandPaletteOpen) {
             uiHandlers.toggleCommandPalette(false);
        }
        if (!target.closest('.project-header-menu-container') && document.querySelector('.project-header-menu')) {
            mainHandlers.closeProjectMenu();
        }

        const navLink = target.closest('a');
        if (navLink && navLink.href.includes('#/')) {
            e.preventDefault();
            const newHash = navLink.hash;
            if (window.location.hash !== newHash) {
                window.location.hash = newHash;
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

        const taskElement = target.closest<HTMLElement>('[data-task-id].clickable');
        if (taskElement) {
             taskHandlers.openTaskDetail(taskElement.dataset.taskId!);
            return;
        }


        const calendarNav = target.closest<HTMLElement>('[data-calendar-nav]');
        if (calendarNav) { 
            const targetCalendar = calendarNav.dataset.targetCalendar || 'main';
            const dateKey = targetCalendar === 'team' ? 'teamCalendarDate' : 'calendarDate';
            const [year, month] = state.ui[dateKey].split('-').map(Number);
            let newDate;
            if (calendarNav.dataset.calendarNav === 'prev') {
                newDate = new Date(year, month - 2, 1);
            } else {
                newDate = new Date(year, month, 1);
            }
            state.ui[dateKey] = newDate.toISOString().slice(0, 7);
            renderApp();
            return;
        }
        
        const sidePanelTab = target.closest<HTMLElement>('.side-panel-tab[data-tab]');
        if(sidePanelTab) {
            state.ui.openedProjectTab = sidePanelTab.dataset.tab as any;
            if (state.ui.openedProjectTab === 'wiki') {
                state.ui.isWikiEditing = false; // Reset to view mode when switching to wiki tab
            }
            renderApp();
            return;
        }

        const settingsTab = target.closest<HTMLElement>('.setting-tab[data-tab]');
        if (settingsTab) {
            state.ui.settings.activeTab = settingsTab.dataset.tab as any;
            renderApp();
            return;
        }

        const hrTab = target.closest<HTMLElement>('.hr-tab[data-hr-tab]');
        if (hrTab) {
            teamHandlers.handleSwitchHrTab(hrTab.dataset.hrTab as any);
            return;
        }
        
        const approveRequestBtn = target.closest<HTMLElement>('[data-approve-request-id]');
        if (approveRequestBtn) {
            teamHandlers.handleApproveTimeOffRequest(approveRequestBtn.dataset.approveRequestId!);
            return;
        }

        const rejectRequestBtn = target.closest<HTMLElement>('[data-reject-request-id]');
        if (rejectRequestBtn) {
            const requestId = rejectRequestBtn.dataset.rejectRequestId!;
            uiHandlers.showModal('rejectTimeOffRequest', { requestId });
            return;
        }

        const approveJoinRequestBtn = target.closest<HTMLElement>('[data-approve-join-request-id]');
        if (approveJoinRequestBtn) {
            teamHandlers.handleApproveJoinRequest(approveJoinRequestBtn.dataset.approveJoinRequestId!);
            return;
        }
        
        const rejectJoinRequestBtn = target.closest<HTMLElement>('[data-reject-join-request-id]');
        if (rejectJoinRequestBtn) {
            teamHandlers.handleRejectJoinRequest(rejectJoinRequestBtn.dataset.rejectJoinRequestId!);
            return;
        }

        const projectCard = target.closest<HTMLElement>('[data-project-id][role="button"]');
        if (projectCard && !projectCard.closest('.side-panel') && !projectCard.closest('[data-modal-target]')) {
            // This check prevents the panel from re-opening when clicking on a project link inside an already open panel.
            const insidePanel = target.closest('.side-panel');
            if (!insidePanel) {
                uiHandlers.openProjectPanel(projectCard.dataset.projectId!);
            }
            return;
        }


        const clientCard = target.closest<HTMLElement>('[data-client-id][role="button"]');
        if (clientCard && !clientCard.closest('[data-modal-target]')) { uiHandlers.openClientPanel(clientCard.dataset.clientId!); return; }

        if (target.closest('.btn-close-panel') || target.matches('.side-panel-overlay')) { uiHandlers.closeSidePanels(); return; }

        const modalTrigger = target.closest<HTMLElement>('[data-modal-target]');
        if (modalTrigger) {
            const modalType = modalTrigger.dataset.modalTarget as any;
            const data: Record<string, any> = {};
            // A more generic way to pass data from dataset to the modal
            for (const key in modalTrigger.dataset) {
                if (key !== 'modalTarget') {
                    // Convert camelCase from dataset to the key we use in state
                    const dataKey = key.replace(/-(\w)/g, (_, c) => c.toUpperCase());
                    data[dataKey] = modalTrigger.dataset[key];
                }
            }
            uiHandlers.showModal(modalType, data);
            return;
        }
        
        const addAiTaskBtn = target.closest<HTMLElement>('.add-ai-task-btn');
        if(addAiTaskBtn) {
            const taskIndex = parseInt(addAiTaskBtn.dataset.taskIndex!, 10);
            const projectId = (document.getElementById('ai-project-select') as HTMLSelectElement).value;
            if(!isNaN(taskIndex) && projectId) {
                aiHandlers.handleAddAiTask(taskIndex, projectId);
            }
            return;
        }

        const downloadBtn = target.closest<HTMLElement>('[data-download-invoice-id]');
        if(downloadBtn) { generateInvoicePDF(downloadBtn.dataset.downloadInvoiceId!); return; }
        
        const sendInvoiceBtn = target.closest<HTMLElement>('[data-send-invoice-id]');
        if (sendInvoiceBtn) {
            invoiceHandlers.handleSendInvoiceByEmail(sendInvoiceBtn.dataset.sendInvoiceId!);
            return;
        }
        
        const toggleInvoiceStatusBtn = target.closest<HTMLElement>('[data-toggle-invoice-status-id]');
        if (toggleInvoiceStatusBtn) {
            invoiceHandlers.handleToggleInvoiceStatus(toggleInvoiceStatusBtn.dataset.toggleInvoiceStatusId!);
            return;
        }

        const addInvoiceItemBtn = target.closest<HTMLElement>('#add-invoice-item-btn');
        if (addInvoiceItemBtn) {
            state.ui.modal.data.items.push({ id: Date.now(), description: '', quantity: 1, unitPrice: 0 });
            renderApp();
            return;
        }

        const removeInvoiceItemBtn = target.closest<HTMLElement>('.remove-invoice-item');
        if (removeInvoiceItemBtn) {
            const itemEditor = removeInvoiceItemBtn.closest<HTMLElement>('.invoice-item-editor');
            if(itemEditor) {
                const itemId = parseInt(itemEditor.dataset.itemId!, 10);
                state.ui.modal.data.items = state.ui.modal.data.items.filter((i: InvoiceLineItem) => i.id !== itemId);
                renderApp();
            }
            return;
        }
        
        if (target.closest<HTMLElement>('#generate-invoice-items-btn')) {
            invoiceHandlers.handleGenerateInvoiceItems();
            return;
        }
        
        // Manual comment submission fix
        const submitCommentBtn = target.closest('#submit-comment-btn, #chat-send-btn');
        if (submitCommentBtn) {
            if (submitCommentBtn.id === 'submit-comment-btn') {
                const taskId = state.ui.modal.data.taskId;
                const input = document.getElementById('task-comment-input') as HTMLInputElement;
                if (taskId && input) { // Ensure input exists
                    taskHandlers.handleAddTaskComment(taskId, input);
                }
            } else if (submitCommentBtn.id === 'chat-send-btn') {
                 const input = document.getElementById('chat-message-input') as HTMLInputElement;
                 const content = input.value.trim();
                 if (content && state.ui.activeChannelId) {
                    mainHandlers.handleSendMessage(state.ui.activeChannelId, content);
                    input.value = '';
                 }
            }
            return;
        }

        // --- NEW ---
        const taskDetailTab = target.closest<HTMLElement>('.task-detail-tab[data-tab]');
        if (taskDetailTab) {
            const tab = taskDetailTab.dataset.tab as any;
            if (tab) {
                state.ui.taskDetail.activeTab = tab;
                renderApp();
            }
            return;
        }
        const mentionItem = target.closest<HTMLElement>('.mention-item');
        if (mentionItem) {
            const userId = mentionItem.dataset.mentionId!;
            const user = state.users.find(u => u.id === userId);
            // Ensure we have a target input field stored in the state
            if(user && state.ui.mention.target) {
                handleInsertMention(user, state.ui.mention.target as HTMLInputElement);
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
            if (planId) {
                billingHandlers.handlePlanChange(planId);
                uiHandlers.closeModal();
            }
            return;
        }

        // --- Notifications ---
        if (target.closest('#notification-bell')) { notificationHandlers.toggleNotificationsPopover(); return; }
        const notificationItem = target.closest<HTMLElement>('.notification-item');
        if (notificationItem) { notificationHandlers.handleNotificationClick(notificationItem.dataset.notificationId!); return; }
        if (target.closest('#mark-all-read-btn')) { notificationHandlers.markAllNotificationsAsRead(); return; }


        // --- Dark Mode / Language ---
        const darkModeToggle = target.closest('#dark-mode-toggle');
        if (darkModeToggle) {
            state.settings.darkMode = (darkModeToggle as HTMLInputElement).checked;
            saveState();
            renderApp();
            return;
        }
        const langSwitcher = target.closest<HTMLSelectElement>('#language-switcher');
        if (langSwitcher) {
            langSwitcher.addEventListener('change', () => {
                state.settings.language = langSwitcher.value as 'en' | 'pl';
                saveState();
                renderApp();
            });
            return;
        }
        
        // --- Kanban Workflow Switcher ---
        const kanbanWorkflowSwitcher = target.closest<HTMLSelectElement>('#kanban-workflow-switcher');
        if (kanbanWorkflowSwitcher) {
             kanbanWorkflowSwitcher.addEventListener('change', () => {
                state.settings.defaultKanbanWorkflow = kanbanWorkflowSwitcher.value as 'simple' | 'advanced';
                saveState();
                renderApp();
            });
            return;
        }
        
         // --- Workspace Switcher ---
        const workspaceSwitcher = target.closest<HTMLSelectElement>('#workspace-switcher');
        if (workspaceSwitcher) {
             workspaceSwitcher.addEventListener('change', () => {
                teamHandlers.handleWorkspaceSwitch(workspaceSwitcher.value);
            });
            return;
        }

        // --- Member management ---
        const roleSelector = target.closest<HTMLSelectElement>('select[data-member-id]');
        if (roleSelector) {
            roleSelector.addEventListener('change', () => {
                teamHandlers.handleChangeUserRole(roleSelector.dataset.memberId!, roleSelector.value as Role);
            });
            return;
        }
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


        // --- Task Filters ---
        if (target.closest('#toggle-filters-btn')) { uiHandlers.toggleTaskFilters(); return; }
        if (target.closest('#reset-task-filters')) {
            state.ui.taskFilters = { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all' };
            renderApp();
            return;
        }
        
        // --- Task Details Modal ---
        const taskDetailField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-field]');
        if (taskDetailField) {
             taskDetailField.addEventListener('change', () => {
                const taskId = state.ui.modal.data.taskId;
                const field = taskDetailField.dataset.field as keyof Task;
                taskHandlers.handleTaskDetailUpdate(taskId, field, taskDetailField.value);
             }, { once: true });
             return;
        }

        // --- Custom Fields ---
        const customFieldInput = target.closest<HTMLElement>('[data-custom-field-id] > *');
        if (customFieldInput) {
            customFieldInput.addEventListener('change', () => {
                 const taskId = state.ui.modal.data.taskId;
                 const fieldId = customFieldInput.parentElement!.dataset.customFieldId!;
                 const value = (customFieldInput as HTMLInputElement).type === 'checkbox' ? (customFieldInput as HTMLInputElement).checked : (customFieldInput as HTMLInputElement).value;
                 taskHandlers.handleCustomFieldValueUpdate(taskId, fieldId, value);
            }, { once: true });
            return;
        }
        const deleteCustomFieldBtn = target.closest<HTMLElement>('.delete-custom-field-btn');
        if (deleteCustomFieldBtn) {
            taskHandlers.handleDeleteCustomFieldDefinition(deleteCustomFieldBtn.dataset.fieldId!);
            return;
        }


        // Subtasks
        const subtaskCheckbox = target.closest<HTMLInputElement>('.subtask-checkbox');
        if (subtaskCheckbox) {
             taskHandlers.handleToggleSubtaskStatus(subtaskCheckbox.dataset.subtaskId!);
             return; // Checkbox click doesn't need a re-render from here, handler does it
        }
        const deleteSubtaskBtn = target.closest<HTMLElement>('.delete-subtask-btn');
        if (deleteSubtaskBtn) {
            taskHandlers.handleDeleteSubtask(deleteSubtaskBtn.dataset.subtaskId!);
            return;
        }

        // --- Attachments ---
        const deleteAttachmentBtn = target.closest<HTMLElement>('.delete-attachment-btn');
        if(deleteAttachmentBtn) {
            taskHandlers.handleRemoveAttachment(deleteAttachmentBtn.dataset.attachmentId!);
            return;
        }

        // --- Dependencies ---
        const deleteDependencyBtn = target.closest<HTMLElement>('.delete-dependency-btn');
        if (deleteDependencyBtn) {
            taskHandlers.handleRemoveDependency(deleteDependencyBtn.dataset.dependencyId!);
            return;
        }
        
        // --- Billing ---
        const planButton = target.closest<HTMLElement>('[data-plan-id]');
        if (planButton && !planButton.hasAttribute('disabled')) {
            const planId = planButton.dataset.planId as PlanId;
            const planName = t(`billing.plan_${planId}`);
            uiHandlers.showModal('confirmPlanChange', { planId, planName });
            return;
        }
        
        // --- Reports ---
        const reportTab = target.closest<HTMLElement>('.report-tab');
        if (reportTab) {
            state.ui.reports.activeTab = reportTab.dataset.tab as any;
            renderApp();
            return;
        }
        
        if (target.closest('.export-csv-btn')) { reportHandlers.handleExportCsv(e); return; }
        if (target.closest('.export-pdf-btn')) { reportHandlers.handleExportPdf(e); return; }

        // --- Wiki ---
        if (target.closest('#edit-wiki-btn')) { wikiHandlers.startWikiEdit(); return; }
        if (target.closest('#cancel-wiki-edit-btn')) { wikiHandlers.cancelWikiEdit(); return; }
        if (target.closest('#save-wiki-btn')) { wikiHandlers.saveWikiEdit(); return; }
        if (target.closest('#wiki-history-btn')) { uiHandlers.showModal('wikiHistory', { projectId: target.closest<HTMLElement>('#wiki-history-btn')?.dataset.projectId }); return; }
        const restoreWikiBtn = target.closest<HTMLElement>('[data-restore-wiki-version-id]');
        if (restoreWikiBtn) { wikiHandlers.handleRestoreWikiVersion(restoreWikiBtn.dataset.restoreWikiVersionId!); return; }

        // --- Automations ---
        const deleteAutomationBtn = target.closest<HTMLElement>('.delete-automation-btn');
        if(deleteAutomationBtn) {
            automationHandlers.handleDeleteAutomation(deleteAutomationBtn.dataset.automationId!);
            return;
        }
        
        // --- Project Menu ---
        if (target.closest('#project-menu-toggle')) { mainHandlers.toggleProjectMenu(); return; }
        if (target.closest('#save-as-template-btn')) {
            const projectId = (target.closest('#save-as-template-btn') as HTMLElement).dataset.projectId!;
            mainHandlers.handleSaveProjectAsTemplate(projectId);
            return;
        }

        // --- Dashboard ---
        if (target.closest('#toggle-dashboard-edit-mode')) { dashboardHandlers.toggleEditMode(); return; }
        if (target.closest('#add-widget-btn')) { uiHandlers.showModal('addWidget'); return; }
        const configureWidgetBtn = target.closest<HTMLElement>('[data-configure-widget-id]');
        if (configureWidgetBtn) { dashboardHandlers.showConfigureWidgetModal(configureWidgetBtn.dataset.configureWidgetId!); return; }
        const removeWidgetBtn = target.closest<HTMLElement>('[data-remove-widget-id]');
        if (removeWidgetBtn) { dashboardHandlers.removeWidget(removeWidgetBtn.dataset.removeWidgetId!); return; }
        const widgetCard = target.closest<HTMLElement>('[data-widget-type]');
        if (widgetCard) {
            dashboardHandlers.addWidget(widgetCard.dataset.widgetType as DashboardWidgetType);
            return;
        }

        // --- CHAT ---
        const channelItem = target.closest<HTMLElement>('.channel-item');
        if (channelItem) {
            mainHandlers.handleSwitchChannel(channelItem.dataset.channelId!);
            return;
        }
        
        // --- Workspace Settings ---
        const removeLogoBtn = target.closest<HTMLElement>('#remove-logo-btn');
        if (removeLogoBtn) {
            const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
            if (workspace) {
                workspace.companyLogo = undefined;
                teamHandlers.handleSaveWorkspaceSettings();
            }
            return;
        }

    });


    // Listener for inputs that need real-time updates or state changes
    app.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLInputElement;

        // Command Palette Input
        if (target.id === 'command-palette-input') {
            state.ui.commandPaletteQuery = target.value;
            state.ui.commandPaletteActiveIndex = 0; // Reset index on new query
            renderApp(); // This is a bit heavy, could be optimized to only render the palette
            target.focus();
            return;
        }
        
        // Invoice client change handler (special case that needs a full modal re-render)
        if (target.id === 'invoiceClient') {
            state.ui.modal.data.clientId = target.value;
            state.ui.modal.data.items = [];
            state.ui.modal.data.sourceLogIds = [];
            state.ui.modal.data.sourceExpenseIds = [];
            renderApp();
            document.getElementById('invoiceClient')?.focus();
            return;
        }

        // Other invoice form fields that don't need a full re-render
        const invoiceForm = target.closest<HTMLFormElement>('#invoiceForm');
        if (invoiceForm) {
            const modalData = state.ui.modal.data;
            if (!modalData) return;

            // Handle date fields
            if (target.id === 'invoiceIssueDate') {
                modalData.issueDate = target.value;
                return; // State updated, no re-render needed.
            }
            if (target.id === 'invoiceDueDate') {
                modalData.dueDate = target.value;
                return; // State updated, no re-render needed.
            }

            // Handle line items
            const itemEditor = target.closest<HTMLElement>('.invoice-item-editor');
            if (itemEditor) {
                const itemId = parseInt(itemEditor.dataset.itemId!, 10);
                const field = target.dataset.field as keyof InvoiceLineItem;
                const item = modalData.items.find((i: InvoiceLineItem) => i.id === itemId);

                if (item) {
                    if (field === 'description') {
                        item.description = target.value;
                    } else { // quantity or unitPrice
                        const value = parseFloat(target.value) || 0;
                        if (field === 'quantity') item.quantity = value;
                        if (field === 'unitPrice') item.unitPrice = value;

                        // Manually update the total price in the DOM
                        const total = modalData.items.reduce((sum: number, i: InvoiceLineItem) => sum + (i.quantity * i.unitPrice), 0);
                        const totalEl = invoiceForm.querySelector('.invoice-totals strong');
                        if (totalEl) {
                            totalEl.textContent = `${t('modals.total')}: ${total.toFixed(2)} PLN`;
                        }
                    }
                }
                return; // Done with this input.
            }
        }
        
         // Workspace Settings
        const workspaceSettingInput = target.closest<HTMLInputElement | HTMLTextAreaElement>('#workspace-settings-form [data-field]');
        if (workspaceSettingInput) {
            const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
            if (workspace) {
                // @ts-ignore
                workspace[workspaceSettingInput.dataset.field] = workspaceSettingInput.value;
                // Defer saving until user clicks away or saves
            }
            return;
        }
        
        // Task filters
        if (target.closest('.tasks-filter-bar')) {
             state.ui.taskFilters.text = (document.getElementById('task-filter-text') as HTMLInputElement).value;
             state.ui.taskFilters.assigneeId = (document.getElementById('task-filter-assignee') as HTMLSelectElement).value;
             state.ui.taskFilters.priority = (document.getElementById('task-filter-priority') as HTMLSelectElement).value;
             state.ui.taskFilters.projectId = (document.getElementById('task-filter-project') as HTMLSelectElement).value;
             state.ui.taskFilters.status = (document.getElementById('task-filter-status') as HTMLSelectElement).value;
             state.ui.taskFilters.dateRange = (document.getElementById('task-filter-date-range') as HTMLSelectElement).value as DateRangeFilter;
             renderApp();
             return;
        }
        
        // Report filters
        if (target.closest('#reports-filters')) {
            state.ui.reports.filters.dateStart = (document.getElementById('report-filter-date-start') as HTMLInputElement).value;
            state.ui.reports.filters.dateEnd = (document.getElementById('report-filter-date-end') as HTMLInputElement).value;
            state.ui.reports.filters.projectId = (document.getElementById('report-filter-project') as HTMLSelectElement).value;
            state.ui.reports.filters.userId = (document.getElementById('report-filter-user') as HTMLSelectElement).value;
            state.ui.reports.filters.clientId = (document.getElementById('report-filter-client') as HTMLSelectElement).value;
            renderApp();
            return;
        }
        
        // Invoice filters
        if (target.closest('#invoice-filters-bar')) {
            state.ui.invoiceFilters.dateStart = (document.getElementById('invoice-filter-date-start') as HTMLInputElement).value;
            state.ui.invoiceFilters.dateEnd = (document.getElementById('invoice-filter-date-end') as HTMLInputElement).value;
            state.ui.invoiceFilters.clientId = (document.getElementById('invoice-filter-client') as HTMLSelectElement).value;
            state.ui.invoiceFilters.status = (document.getElementById('invoice-filter-status') as HTMLSelectElement).value;
            renderApp();
            return;
        }
        
        // @Mention handling
        if (target.id === 'task-comment-input' || target.id === 'chat-message-input') {
            handleMentionInput(target);
            return;
        }
    });

    app.addEventListener('focusout', (e: FocusEvent) => {
        const target = e.target as HTMLElement;

        // Save workspace settings when user clicks away from an input
        const workspaceSettingInput = target.closest<HTMLInputElement | HTMLTextAreaElement>('#workspace-settings-form [data-field]');
        if (workspaceSettingInput) {
            teamHandlers.handleSaveWorkspaceSettings();
            return;
        }
    });
    
    // File upload handler
    app.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;

        if (target.id === 'attachment-file-input' && target.files?.length) {
            const file = target.files[0];
            const taskId = target.dataset.taskId!;
            taskHandlers.handleAddAttachment(taskId, file);
        }
        
        if (target.id === 'project-file-upload' && target.files?.length) {
            const file = target.files[0];
            const projectId = target.dataset.projectId!;
            mainHandlers.handleFileUpload(projectId, file);
        }

        if (target.id === 'logo-upload' && target.files?.length) {
            const file = target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
                if (workspace) {
                    workspace.companyLogo = event.target?.result as string;
                    teamHandlers.handleSaveWorkspaceSettings();
                }
            };
            reader.readAsDataURL(file);
        }

    });
    
    // Drag and Drop for Kanban board
    app.addEventListener('dragstart', dndHandlers.handleDragStart);
    app.addEventListener('dragend', dndHandlers.handleDragEnd);
    app.addEventListener('dragover', dndHandlers.handleDragOver);
    app.addEventListener('drop', dndHandlers.handleDrop);
    
    // Drag and Drop for Dashboard Widgets
    app.addEventListener('dragstart', dashboardHandlers.handleWidgetDragStart);
    app.addEventListener('dragend', dashboardHandlers.handleWidgetDragEnd);
    app.addEventListener('dragover', dashboardHandlers.handleWidgetDragOver);
    app.addEventListener('drop', dashboardHandlers.handleWidgetDrop);
}