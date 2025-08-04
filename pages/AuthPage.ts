

import { t } from '../i18n.ts';
import { getState } from '../state.ts';

function renderSetupPage() {
    const state = getState();
    const { currentUser, workspaceJoinRequests, workspaces } = state;
    if (!currentUser) return '';

    const pendingRequest = workspaceJoinRequests.find(r => r.userId === currentUser.id && r.status === 'pending');

    if (pendingRequest) {
        const workspaceName = workspaces.find(w => w.id === pendingRequest.workspaceId)?.name || 'a workspace';
        return `
            <div class="bg-content p-8 rounded-lg shadow-md max-w-lg w-full text-center">
                <h3 class="text-xl font-bold">${t('setup.request_pending_title')}</h3>
                <p class="mt-4 leading-relaxed text-text-subtle">${t('setup.request_pending_message').replace('{workspaceName}', workspaceName)}</p>
                <button class="mt-6 px-4 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background" data-logout-button>${t('auth.logout')}</button>
            </div>
        `;
    }

    return `
        <div class="bg-content p-8 rounded-lg shadow-md max-w-3xl w-full">
            <h2 class="text-center text-2xl font-bold mb-6">${t('setup.title')}, ${currentUser.name || currentUser.initials}!</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                <div class="p-6 bg-background rounded-lg border border-border-color">
                    <h4 class="font-semibold mb-4 text-center">${t('setup.create_workspace_header')}</h4>
                    <form id="create-workspace-setup-form" novalidate class="space-y-4">
                        <div class="flex flex-col gap-1.5">
                            <label for="new-workspace-name-setup" class="sr-only">${t('setup.create_workspace_placeholder')}</label>
                            <input type="text" id="new-workspace-name-setup" class="w-full bg-white dark:bg-gray-800 border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required placeholder="${t('setup.create_workspace_placeholder')}">
                        </div>
                        <button type="submit" class="w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('setup.create_workspace_button')}</button>
                    </form>
                </div>
                
                <div class="p-6 bg-background rounded-lg border border-border-color">
                    <h4 class="font-semibold mb-4 text-center">${t('setup.join_workspace_header')}</h4>
                    <form id="join-workspace-setup-form" novalidate class="space-y-4">
                        <div class="flex flex-col gap-1.5">
                            <label for="join-workspace-name-setup" class="sr-only">${t('setup.join_workspace_placeholder')}</label>
                            <input type="text" id="join-workspace-name-setup" class="w-full bg-white dark:bg-gray-800 border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required placeholder="${t('setup.join_workspace_placeholder')}">
                        </div>
                        <button type="submit" class="w-full px-4 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background">${t('setup.join_workspace_button')}</button>
                    </form>
                </div>

            </div>
             <div class="text-center mt-8">
                <button class="text-sm text-text-subtle hover:underline" data-logout-button>${t('auth.logout')}</button>
            </div>
        </div>
    `;
}

export function AuthPage({ isSetup = false } = {}) {
    const content = isSetup ? renderSetupPage() : `
        <div class="bg-content rounded-lg shadow-md max-w-md w-full">
            <div class="flex border-b border-border-color">
                <button class="flex-1 py-3 px-4 font-medium text-text-subtle border-b-2 border-transparent -mb-px active" data-auth-tab="login">${t('auth.login_tab')}</button>
                <button class="flex-1 py-3 px-4 font-medium text-text-subtle border-b-2 border-transparent -mb-px" data-auth-tab="register">${t('auth.register_tab')}</button>
            </div>
            <div id="auth-form-container" class="p-8">
                ${renderLoginForm()}
            </div>
        </div>
    `;
    
    return `
        <div class="flex justify-center items-center min-h-screen p-4 bg-background">
            ${content}
        </div>
    `;
}

export function renderLoginForm() {
    return `
        <form id="loginForm" novalidate class="space-y-4">
            <h3 class="text-center text-xl font-bold mb-6">${t('auth.welcome_back')}</h3>
            <div id="login-error" class="bg-danger/10 text-danger text-sm p-3 rounded-md hidden"></div>
            <div class="flex flex-col gap-1.5">
                <label for="loginEmail" class="text-sm font-medium text-text-subtle">${t('auth.email_label')}</label>
                <input type="email" id="loginEmail" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required autocomplete="email">
            </div>
            <div class="flex flex-col gap-1.5">
                <label for="loginPassword" class="text-sm font-medium text-text-subtle">${t('auth.password_label')}</label>
                <input type="password" id="loginPassword" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required autocomplete="current-password">
            </div>
            <button type="submit" id="login-submit-btn" class="w-full mt-6 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('auth.login_button')}</button>
        </form>
    `;
}

export function renderRegisterForm() {
    return `
        <form id="registerForm" novalidate class="space-y-4">
            <h3 class="text-center text-xl font-bold mb-6">${t('auth.create_account_title')}</h3>
            <div id="register-error" class="bg-danger/10 text-danger text-sm p-3 rounded-md hidden"></div>
            <div class="flex flex-col gap-1.5">
                <label for="registerName" class="text-sm font-medium text-text-subtle">${t('auth.full_name_label')}</label>
                <input type="text" id="registerName" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required autocomplete="name">
            </div>
            <div class="flex flex-col gap-1.5">
                <label for="registerEmail" class="text-sm font-medium text-text-subtle">${t('auth.email_label')}</label>
                <input type="email" id="registerEmail" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required autocomplete="email">
            </div>
            <div class="flex flex-col gap-1.5">
                <label for="registerPassword" class="text-sm font-medium text-text-subtle">${t('auth.password_label_min')}</label>
                <input type="password" id="registerPassword" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required minlength="6" autocomplete="new-password">
            </div>
            <button type="submit" id="register-submit-btn" class="w-full mt-6 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('auth.register_button')}</button>
        </form>
    `;
}