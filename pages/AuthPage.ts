
import { t } from '../i18n.ts';
import { state } from '../state.ts';

function renderSetupPage() {
    const { currentUser, workspaceJoinRequests, workspaces } = state;
    if (!currentUser) return '';

    const pendingRequest = workspaceJoinRequests.find(r => r.userId === currentUser.id && r.status === 'pending');

    if (pendingRequest) {
        const workspaceName = workspaces.find(w => w.id === pendingRequest.workspaceId)?.name || 'a workspace';
        return `
            <div class="card" style="max-width: 550px; width: 100%; text-align: center;">
                <h3>${t('setup.request_pending_title')}</h3>
                <p style="margin-top: 1rem; line-height: 1.6;">${t('setup.request_pending_message').replace('{workspaceName}', workspaceName)}</p>
                <button class="btn btn-secondary" style="margin-top: 1.5rem;" data-logout-button>Log Out</button>
            </div>
        `;
    }

    return `
        <div class="card" style="max-width: 800px; width: 100%;">
            <h2 style="text-align: center; margin-bottom: 2rem;">${t('setup.title')}, ${currentUser.name || currentUser.initials}!</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start;">
                
                <div class="setup-option-card">
                    <h4>${t('setup.create_workspace_header')}</h4>
                    <form id="create-workspace-setup-form" novalidate>
                        <div class="form-group">
                            <label for="new-workspace-name-setup" class="sr-only">${t('setup.create_workspace_placeholder')}</label>
                            <input type="text" id="new-workspace-name-setup" class="form-control" required placeholder="${t('setup.create_workspace_placeholder')}">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">${t('setup.create_workspace_button')}</button>
                    </form>
                </div>
                
                <div class="setup-option-card">
                    <h4>${t('setup.join_workspace_header')}</h4>
                    <form id="join-workspace-setup-form" novalidate>
                        <div class="form-group">
                            <label for="join-workspace-name-setup" class="sr-only">${t('setup.join_workspace_placeholder')}</label>
                            <input type="text" id="join-workspace-name-setup" class="form-control" required placeholder="${t('setup.join_workspace_placeholder')}">
                        </div>
                        <button type="submit" class="btn btn-secondary" style="width: 100%; margin-top: 1rem;">${t('setup.join_workspace_button')}</button>
                    </form>
                </div>

            </div>
             <div style="text-align: center; margin-top: 2rem;">
                <button class="btn btn-link" data-logout-button>Log Out</button>
            </div>
        </div>
    `;
}

export function AuthPage({ isSetup = false } = {}) {
    const content = isSetup ? renderSetupPage() : `
        <div class="card" style="max-width: 450px; width: 100%; padding: 0;">
            <div class="auth-tabs">
                <button class="auth-tab active" data-auth-tab="login">Login</button>
                <button class="auth-tab" data-auth-tab="register">Register</button>
            </div>
            <div id="auth-form-container" style="padding: 2rem;">
                ${renderLoginForm()}
            </div>
        </div>
    `;
    
    return `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; padding: 1rem; background-color: var(--background-color);">
            ${content}
        </div>
    `;
}

export function renderLoginForm() {
    return `
        <form id="loginForm" novalidate>
            <h3 style="text-align: center; margin-bottom: 1.5rem;">Welcome Back</h3>
            <div id="login-error" class="auth-error" style="display: none;"></div>
            <div class="form-group">
                <label for="loginEmail">Email</label>
                <input type="email" id="loginEmail" class="form-control" required autocomplete="email">
            </div>
            <div class="form-group" style="margin-top: 1rem;">
                <label for="loginPassword">Password</label>
                <input type="password" id="loginPassword" class="form-control" required autocomplete="current-password">
            </div>
            <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width: 100%; margin-top: 2rem;">Log In</button>
        </form>
    `;
}

export function renderRegisterForm() {
    return `
        <form id="registerForm" novalidate>
            <h3 style="text-align: center; margin-bottom: 1.5rem;">Create Account</h3>
            <div id="register-error" class="auth-error" style="display: none;"></div>
            <div class="form-group">
                <label for="registerName">Full Name</label>
                <input type="text" id="registerName" class="form-control" required autocomplete="name">
            </div>
            <div class="form-group" style="margin-top: 1rem;">
                <label for="registerEmail">Email</label>
                <input type="email" id="registerEmail" class="form-control" required autocomplete="email">
            </div>
            <div class="form-group" style="margin-top: 1rem;">
                <label for="registerPassword">Password (min. 6 characters)</label>
                <input type="password" id="registerPassword" class="form-control" required minlength="6" autocomplete="new-password">
            </div>
            <button type="submit" id="register-submit-btn" class="btn btn-primary" style="width: 100%; margin-top: 2rem;">Register</button>
        </form>
    `;
}