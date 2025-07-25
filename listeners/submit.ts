

import { state } from '../state.ts';
import { handleAiTaskGeneration } from '../services.ts';
import type { Role, Task, CustomFieldType, ProjectRole, AutomationAction } from '../types.ts';
import * as auth from '../services/auth.ts';
import { renderLoginForm, renderRegisterForm } from '../pages/AuthPage.ts';
import * as userHandlers from '../handlers/user.ts';
import * as teamHandlers from '../handlers/team.ts';
import * as taskHandlers from '../handlers/tasks.ts';
import * as automationHandlers from '../handlers/automations.ts';
import * as mainHandlers from '../handlers/main.ts';
import * as dealHandlers from '../handlers/deals.ts';
import * as okrHandlers from '../handlers/okr.ts';
import { parseMentionContent } from './mentions.ts';


export async function handleSubmit(e: SubmitEvent) {
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

        try {
            await auth.login(email, password);
            // onAuthStateChange will now handle successful login
        } catch (err: any) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
            button.textContent = 'Log In';
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
        button.textContent = 'Registering...';
        button.disabled = true;
        errorDiv.style.display = 'none';

        try {
            await auth.signup(name, email, password);
            // onAuthStateChange will now handle successful signup & login
        } catch (err: any) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
            button.textContent = 'Register';
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
        const projectId = state.ui.modal.data?.projectId;
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
        if (inputDiv && state.ui.activeChannelId) {
            const content = parseMentionContent(inputDiv);
            if (content.trim()) {
                mainHandlers.handleSendMessage(state.ui.activeChannelId, content.trim());
                inputDiv.innerHTML = ''; // Clear input on send
            }
        }
    } else if (target.id === 'add-comment-form') {
        const taskId = (target as HTMLElement).dataset.taskId || state.ui.modal.data.taskId;
        const inputDiv = document.getElementById('task-comment-input') as HTMLElement;
        if (taskId && inputDiv) {
            const content = parseMentionContent(inputDiv);
            if (content.trim()) {
                await taskHandlers.handleAddTaskComment(taskId, content.trim(), null, () => {
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
    }
}