

import { getState } from '../state.ts';
import { handleAiTaskGeneration } from '../services.ts';
import type { Role, Task, CustomFieldType, ProjectRole, AutomationAction, DealActivity } from '../types.ts';
import * as auth from '../services/auth.ts';
import { renderLoginForm, renderRegisterForm } from '../pages/AuthPage.ts';
import * as userHandlers from '../handlers/user.ts';
import * as teamHandlers from '../handlers/team.ts';
import * as taskHandlers from '../handlers/tasks.ts';
import * as automationHandlers from '../handlers/automations.ts';
import * as mainHandlers from '../handlers/main.ts';
import * as dealHandlers from '../handlers/deals.ts';
import * as okrHandlers from '../handlers/okr.ts';
import { getStorableHtmlFromContentEditable } from '../handlers/editor.ts';
import * as pipelineHandlers from '../handlers/pipeline.ts';
import * as tagHandlers from '../handlers/tags.ts';
import { t } from '../i18n.ts';


export async function handleSubmit(e: SubmitEvent) {
    const target = e.target as HTMLElement;
    e.preventDefault();

    if (target.id === 'loginForm') {
        const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
        const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
        const errorDiv = document.getElementById('login-error')!;
        const button = document.getElementById('login-submit-btn') as HTMLButtonElement;
        button.textContent = t('auth.logging_in');
        button.disabled = true;
        errorDiv.style.display = 'none';

        try {
            await auth.login(email, password);
            // onAuthStateChange will now handle successful login
        } catch (err: any) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
            button.textContent = t('auth.login_button');
            button.disabled = false;
        }
        return;
    }

    if (target.id === 'registerForm') {
        const name = (document.getElementById('registerName') as HTMLInputElement).value;
        const email = (document.getElementById('registerEmail') as HTMLInputElement).value;
        const password = (document.getElementById('registerPassword') as HTMLInputElement).value;
        const errorDiv = document.getElementById('register-error')!;
        const button = document.getElementById('register-submit-btn') as HTMLButtonElement;
        button.textContent = t('auth.registering');
        button.disabled = true;
        errorDiv.style.display = 'none';

        try {
            await auth.signup(name, email, password);
            // onAuthStateChange will now handle successful signup & login
        } catch (err: any) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
            button.textContent = t('auth.register_button');
            button.disabled = false;
        }
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
        const form = target as HTMLFormElement;
        const projectId = getState().ui.modal.data?.projectId;
        const automationId = form.dataset.automationId || null;
        const name = (form.querySelector('input[name="automation-name"]') as HTMLInputElement).value;
        const triggerStatus = (form.querySelector('select[name="automation-trigger-status"]') as HTMLSelectElement).value as Task['status'];
        
        const actions: AutomationAction[] = [];
        form.querySelectorAll('.automation-action-row').forEach(row => {
            const type = (row.querySelector('select[name="action-type"]') as HTMLSelectElement).value;
            const value = (row.querySelector('select[name="action-value"]') as HTMLSelectElement).value;
            if (type === 'assignUser') {
                actions.push({ type: 'assignUser', userId: value });
            } else if (type === 'changeStatus') {
                actions.push({ type: 'changeStatus', status: value as Task['status'] });
            }
        });

        if (projectId && name && triggerStatus && actions.length > 0) {
            const trigger = { type: 'statusChange' as const, status: triggerStatus };
            await automationHandlers.handleSaveAutomation(automationId, projectId, name, trigger, actions);
        }
    } else if (target.id === 'chat-form') {
        const inputDiv = document.getElementById('chat-message-input') as HTMLElement;
        const state = getState();
        if (inputDiv && state.ui.activeChannelId) {
            const content = getStorableHtmlFromContentEditable(inputDiv);
            if (content.trim()) {
                mainHandlers.handleSendMessage(state.ui.activeChannelId, content.trim());
                inputDiv.innerHTML = ''; // Clear input on send
            }
        }
    } else if (target.id === 'add-comment-form' || target.classList.contains('reply-form')) {
        const form = target as HTMLFormElement;
        const isReply = form.classList.contains('reply-form');
        const parentId = isReply ? form.dataset.parentId : null;
        const taskId = form.dataset.taskId || getState().ui.modal.data.taskId;
        const inputDiv = form.querySelector<HTMLElement>('.rich-text-input');
        
        if (taskId && inputDiv) {
            const content = getStorableHtmlFromContentEditable(inputDiv);
            if (content.trim()) {
                await taskHandlers.handleAddTaskComment(taskId, content.trim(), parentId, () => {
                    if (isReply) {
                        form.parentElement?.remove(); // Remove the container
                    } else {
                        inputDiv.innerHTML = ''; // Clear main input
                    }
                });
            }
        }
        return;
    } else if (target.id === 'log-deal-activity-form') {
        const form = target as HTMLFormElement;
        const dealId = form.dataset.dealId!;
        const textarea = form.querySelector('textarea[name="activity-content"]') as HTMLTextAreaElement;
        const type = (form.querySelector('input[name="activity-type"]') as HTMLInputElement).value as DealActivity['type'];
        const content = textarea.value.trim();
        if (dealId && content && type) {
            await dealHandlers.handleAddDealActivity(dealId, type, content);
            textarea.value = '';
        }
    } else if (target.id === 'send-deal-email-form') {
        const form = target as HTMLFormElement;
        const dealId = form.dataset.dealId!;
        const to = (form.querySelector('select[name="email-to"]') as HTMLSelectElement).value;
        const subject = (form.querySelector('input[name="email-subject"]') as HTMLInputElement).value;
        const body = (form.querySelector('textarea[name="email-body"]') as HTMLTextAreaElement).value;
        if (dealId && to && subject && body) {
            await dealHandlers.handleSendDealEmail(dealId, to, subject, body, form);
        }
    } else if (target.id === 'add-new-tag-form') {
        const taskId = target.dataset.taskId!;
        const input = target.querySelector('input')!;
        const tagName = input.value.trim();
        if (taskId && tagName) {
            tagHandlers.handleToggleTag('task', taskId, '', tagName);
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
    } else if (target.id === 'add-checklist-item-form') {
        const taskId = target.dataset.taskId!;
        const input = target.querySelector('input')!;
        const text = input.value.trim();
        if (taskId && text) {
            await taskHandlers.handleAddChecklistItem(taskId, text);
            input.value = '';
        }
        return;
    } else if (target.id === 'add-project-member-form') {
        const addProjectMemberForm = target.closest<HTMLFormElement>('#add-project-member-form');
        if (addProjectMemberForm) {
            const projectId = addProjectMemberForm.dataset.projectId!;
            const userId = (addProjectMemberForm.querySelector('#project-member-select') as HTMLSelectElement).value;
            const role = (addProjectMemberForm.querySelector('#project-role-select') as HTMLSelectElement).value as ProjectRole;
            await teamHandlers.handleAddMemberToProject(projectId, userId, role);
        }
        return;
    } else if (target.id === 'add-pipeline-stage-form') {
        const input = target.querySelector<HTMLInputElement>('input[name="stage-name"]')!;
        const name = input.value.trim();
        if (name) {
            await pipelineHandlers.handleCreateStage(name);
            input.value = '';
        }
        return;
    }
}