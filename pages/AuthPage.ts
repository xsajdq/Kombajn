import { t } from '../i18n.ts';

export function AuthPage() {
    return `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; padding: 1rem; background-color: var(--background-color);">
            <div class="card" style="max-width: 450px; width: 100%; padding: 0;">
                <div class="auth-tabs">
                    <button class="auth-tab active" data-auth-tab="login">Login</button>
                    <button class="auth-tab" data-auth-tab="register">Register</button>
                </div>
                <div id="auth-form-container" style="padding: 2rem;">
                    ${renderLoginForm()}
                </div>
            </div>
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
