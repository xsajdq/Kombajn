
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
import * as userHandlers from './handlers/user.ts';
import * as auth from './services/auth.ts';
import { renderLoginForm, renderRegisterForm } from './pages/AuthPage.ts';
import { subscribeToRealtimeUpdates } from './services/supabase.ts';
import * as onboardingHandlers from './handlers/onboarding.ts';
import * as okrHandlers from './handlers/okr.ts';
import * as dealHandlers from './handlers/deals.ts';
import { can } from './permissions.ts';


function parseContentEditable(element: HTMLElement): string {
    let content = '';
    element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            content += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains('mention-chip')) {
                const userId = el.dataset.userId;
                const userName = el.textContent?.substring(1); // Remove '@'
                if (userId && userName) {
                    content += `@[${userName}](user:${userId})`;
                }
            } else {
                 content += node.textContent;
            }
        }
    });
    return content;
}

function handleMentionInput(inputDiv: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range.startContainer.textContent) {
        state.ui.mention.query = null;
        state.ui.mention.target = null;
        renderMentionPopover();
        return;
    }
    
    const textBeforeCursor = range.startContainer.textContent.substring(0, range.startOffset);
    const atPosition = textBeforeCursor.lastIndexOf('@');

    if (atPosition > -1 && (atPosition === 0 || /\s/.test(textBeforeCursor[atPosition - 1]))) {
        const query = textBeforeCursor.substring(atPosition + 1);
        if (query.includes('\n') || query.includes(' ')) {
             state.ui.mention.query = null;
             state.ui.mention.target = null;
        } else {
             state.ui.mention.query = query;
             state.ui.mention.target = inputDiv;
             state.ui.mention.activeIndex = 0;
        }
    } else {
        state.ui.mention.query = null;
        state.ui.mention.target = null;
    }
    
    renderMentionPopover();
}

function handleInsertMention(user: User, inputDiv: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const cursorNode = range.startContainer;
    const cursorOffset = range.startOffset;

    if (cursorNode.nodeType !== Node.TEXT_NODE) {
        console.warn("Mention trigger was not in a text node. Aborting.");
        return;
    }

    // --- Start of new logic ---
    const originalTextNode = cursorNode as Text;
    const parent = originalTextNode.parentNode;
    if (!parent) return;

    // Create the new mention chip
    const mentionChip = document.createElement('span');
    mentionChip.className = 'mention-chip';
    mentionChip.setAttribute('contenteditable', 'false');
    mentionChip.dataset.userId = user.id;
    mentionChip.textContent = `@${user.name || user.initials}`;
    
    // A non-breaking space after the chip is good for UX.
    const spaceNode = document.createTextNode('\u00A0'); 

    // Get the parts of the text node we want to keep
    const textBefore = originalTextNode.nodeValue!.substring(0, originalTextNode.nodeValue!.lastIndexOf('@'));
    const textAfter = originalTextNode.nodeValue!.substring(cursorOffset);
    
    // Replace the original text node with the new structure
    parent.insertBefore(new Text(textBefore), originalTextNode);
    parent.insertBefore(mentionChip, originalTextNode);
    parent.insertBefore(spaceNode, originalTextNode);
    // Important: We need a reference to the node *after* the space to place the cursor
    const afterNode = parent.insertBefore(new Text(textAfter), originalTextNode);
    parent.removeChild(originalTextNode);

    // Set the cursor position at the beginning of the text node that follows the space
    range.setStart(afterNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // --- End of new logic ---

    // Clean up mention state and focus
    state.ui.mention.query = null;
    state.ui.mention.target = null;
    renderMentionPopover();
    inputDiv.focus();
}

export function setupEventListeners(bootstrapCallback: () => Promise<void>) {
    const app = document.getElementById('app')!;

    app.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();

        // If the target is an editable element, let the default browser behavior happen.
        // This prevents the element from losing focus.
        if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
            return;
        }

        const mentionItem = target.closest('.mention-item');
        if (mentionItem) {
            e.preventDefault();
            return;
        }

        const multiSelectDropdown = target.closest('.multiselect-dropdown');
        if (multiSelectDropdown) {
            // For other interactive elements inside a dropdown (like list items),
            // prevent default to keep the original input focused.
            e.preventDefault();
        }
    });
    
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
            if (state.ui.onboarding.isActive) {
                onboardingHandlers.finishOnboarding();
            } else if (state.ui.isCommandPaletteOpen) {
                uiHandlers.toggleCommandPalette(false);
            } else if (state.ui.modal.isOpen) {
                uiHandlers.closeModal();
            } else if (state.ui.openedClientId || state.ui.openedProjectId || state.ui.openedDealId) {
                uiHandlers.closeSidePanels();
            } else if (document.querySelector('[data-editing="true"]')) {
                // If an inline edit is active, cancel it.
                renderApp(); 
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
                        if(user) handleInsertMention(user, state.ui.mention.target as HTMLElement);
                    } else {
                        commandHandlers.executeCommand(activeItem.dataset.commandId!);
                    }
                }
            }
            return;
        }


        // Global shortcuts (only when not in an input)
        if (e.target instanceof HTMLElement && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !(e.target as HTMLElement).isContentEditable) {
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
                .then(async () => {
                    await bootstrapCallback();
                    subscribeToRealtimeUpdates();
                })
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
                .then(async () => {
                    await bootstrapCallback();
                    subscribeToRealtimeUpdates();
                })
                .catch(err => {
                    errorDiv.textContent = err.message;
                    errorDiv.style.display = 'block';
                    button.textContent = 'Register';
                    button.disabled = false;
                });
            return;
        }

        if (target.id === 'update-profile-form') {
            await userHandlers.handleUpdateProfile(target as HTMLFormElement);
            return;
        }

        if (target.id === 'update-password-form') {
            await userHandlers.handleUpdatePassword(target as HTMLFormElement);
            return;
        }
        
        if (target.id === 'create-workspace-setup-form') {
            const nameInput = document.getElementById('new-workspace-name-setup') as HTMLInputElement;
            const name = nameInput.value.trim();
            if (name) {
                await teamHandlers.handleCreateWorkspace(name);
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
                await teamHandlers.handleCreateWorkspace(name);
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
            const inputDiv = document.getElementById('chat-message-input') as HTMLElement;
            if (inputDiv && state.ui.activeChannelId) {
                const content = parseContentEditable(inputDiv);
                if (content.trim()) {
                    mainHandlers.handleSendMessage(state.ui.activeChannelId, content.trim());
                    inputDiv.innerHTML = ''; // Clear input on send
                }
            }
        } else if (target.id === 'add-comment-form') {
            const taskId = state.ui.modal.data.taskId;
            const inputDiv = document.getElementById('task-comment-input') as HTMLElement;
            if (taskId && inputDiv) {
                const content = parseContentEditable(inputDiv);
                if (content.trim()) {
                    await taskHandlers.handleAddTaskComment(taskId, content.trim(), () => {
                        inputDiv.innerHTML = '';
                    });
                }
            }
            return;
        } else if (target.id === 'add-deal-note-form') {
            const dealId = target.dataset.dealId!;
            const textarea = target.querySelector('textarea') as HTMLTextAreaElement;
            const content = textarea.value.trim();
            if (dealId && content) {
                await dealHandlers.handleAddDealNote(dealId, content);
                textarea.value = '';
            }
        } else if (target.id === 'add-new-tag-form') {
            const taskId = target.dataset.taskId!;
            const input = target.querySelector('input')!;
            const tagName = input.value.trim();
            if (taskId && tagName) {
                taskHandlers.handleToggleTag(taskId, '', tagName);
                input.value = ''; // Clear input
            }
            return;
        } else if (target.id === 'update-kr-form') {
            const krId = target.dataset.krId!;
            const input = target.querySelector('input') as HTMLInputElement;
            const value = parseFloat(input.value);
            if (krId && !isNaN(value)) {
                await okrHandlers.handleUpdateKeyResultValue(krId, value);
            }
        }
    });

    app.addEventListener('click', async (e) => {
        if (!(e.target instanceof Element)) return;
        const target = e.target as Element;

        // --- Handle multiselect dropdowns ---
        const multiselectDisplay = target.closest<HTMLElement>('.multiselect-display');
        if (multiselectDisplay) {
            const dropdown = multiselectDisplay.nextElementSibling;
            dropdown?.classList.toggle('hidden');
        } else if (!target.closest('.multiselect-container')) {
            // Close all dropdowns if clicking outside
            document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.add('hidden'));
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
        if (navLink && navLink.href.includes('#/')) {
            e.preventDefault();
            const newHash = navLink.hash;
            if (window.location.hash !== newHash) { window.location.hash = newHash; }
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
        
        const dealCard = target.closest<HTMLElement>('[data-deal-id]');
        if (dealCard) {
            uiHandlers.openDealPanel(dealCard.dataset.dealId!);
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
                    else current_date.setDate(current_date.getDate() - 1);
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

        const settingsTab = target.closest<HTMLElement>('.setting-tab[data-tab]');
        if (settingsTab) { state.ui.settings.activeTab = settingsTab.dataset.tab as any; renderApp(); return; }

        const hrTab = target.closest<HTMLElement>('.hr-tab[data-hr-tab]');
        if (hrTab) { teamHandlers.handleSwitchHrTab(hrTab.dataset.hrTab as any); return; }
        
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
            if (!insidePanel) { uiHandlers.openProjectPanel(projectCard.dataset.projectId!); }
            return;
        }

        const clientCard = target.closest<HTMLElement>('[data-client-id][role="button"]');
        if (clientCard && !clientCard.closest('[data-modal-target]')) { uiHandlers.openClientPanel(clientCard.dataset.clientId!); return; }

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
            uiHandlers.showModal(modalType, data);
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
            if (tab) { state.ui.taskDetail.activeTab = tab; renderApp(); }
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
            state.ui.taskFilters = { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all' };
            renderApp();
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
        if (deleteCustomFieldBtn) { taskHandlers.handleDeleteCustomFieldDefinition(deleteCustomFieldBtn.dataset.fieldId!); return; }


        // Subtasks
        const subtaskCheckbox = target.closest<HTMLInputElement>('.subtask-checkbox');
        if (subtaskCheckbox) { taskHandlers.handleToggleSubtaskStatus(subtaskCheckbox.dataset.subtaskId!); return; }
        const deleteSubtaskBtn = target.closest<HTMLElement>('.delete-subtask-btn');
        if (deleteSubtaskBtn) { taskHandlers.handleDeleteSubtask(deleteSubtaskBtn.dataset.subtaskId!); return; }

        // Attachments
        const deleteAttachmentBtn = target.closest<HTMLElement>('.delete-attachment-btn');
        if(deleteAttachmentBtn) { taskHandlers.handleRemoveAttachment(deleteAttachmentBtn.dataset.attachmentId!); return; }

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

    });

    app.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLElement;

        if (target.matches('[data-change-role-for-member-id]')) {
            const select = target as HTMLSelectElement;
            const memberId = select.dataset.changeRoleForMemberId!;
            const newRole = select.value as Role;
            teamHandlers.handleChangeUserRole(memberId, newRole);
            return;
        }

        // This handles updates from the task detail sidebar (priority, status, dates, etc.)
        if (target.matches('.task-detail-sidebar *[data-field]') && state.ui.modal.type === 'taskDetail') {
            const taskId = state.ui.modal.data?.taskId;
            const field = target.dataset.field as keyof Task;
            const value = (target as HTMLInputElement).value;
            if (taskId && field) {
                taskHandlers.handleTaskDetailUpdate(taskId, field, value);
                return;
            }
        }
        
        // --- Multi-select checkbox handling ---
        const multiSelectCheckbox = target.closest<HTMLInputElement>('.multiselect-list-item input[type="checkbox"]');
        if (multiSelectCheckbox) {
            const container = multiSelectCheckbox.closest<HTMLElement>('.multiselect-container');
            if (container) {
                const type = container.dataset.type;
                const taskId = container.dataset.taskId;
                if (taskId && type === 'assignee') {
                    taskHandlers.handleToggleAssignee(taskId, multiSelectCheckbox.value);
                } else if (taskId && type === 'tag') {
                    taskHandlers.handleToggleTag(taskId, multiSelectCheckbox.value);
                }
            }
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
        const themeSwitcher = target.closest<HTMLSelectElement>('#theme-switcher');
        if (themeSwitcher) { state.settings.theme = themeSwitcher.value as 'light' | 'dark' | 'minimal'; saveState(); renderApp(); return; }

        const langSwitcher = target.closest<HTMLSelectElement>('#language-switcher');
        if (langSwitcher) { state.settings.language = langSwitcher.value as 'en' | 'pl'; saveState(); renderApp(); return; }
        
        // Kanban Workflow Switcher
        const kanbanWorkflowSwitcher = target.closest<HTMLSelectElement>('#kanban-workflow-switcher');
        if (kanbanWorkflowSwitcher) { state.settings.defaultKanbanWorkflow = kanbanWorkflowSwitcher.value as 'simple' | 'advanced'; saveState(); renderApp(); return; }

        // Dashboard Grid Columns
        const gridColumnsSelect = target.closest<HTMLSelectElement>('#dashboard-grid-columns');
        if (gridColumnsSelect) {
            const newCount = parseInt(gridColumnsSelect.value, 10);
            if (!isNaN(newCount)) { dashboardHandlers.handleGridColumnsChange(newCount); }
            return;
        }

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
