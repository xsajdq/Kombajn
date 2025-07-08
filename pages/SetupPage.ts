// File: pages/SetupPage.ts

export function SetupPage() {
    // This is a special page shown only on the very first run when no users exist.
    // It's rendered directly into the #app container, bypassing the main layout.
    // The styles are simple and mostly inline to be self-contained.
    return `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; padding: 1rem; background-color: var(--background-color);">
            <div class="card" style="max-width: 500px; width: 100%; animation: scaleIn 0.3s ease-out;">
                <form id="setupForm">
                    <div class="modal-header" style="border-bottom: none; padding: 0 0 1.5rem 0; margin-bottom: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                             <span class="material-icons-sharp" style="font-size: 2.5rem; color: var(--primary-color);">hub</span>
                             <h1 style="font-size: 1.8rem; margin: 0; color: var(--dark-color);">Welcome to Kombajn!</h1>
                        </div>
                    </div>
                    <p class="subtle-text" style="margin-bottom: 2rem;">Let's get your account and first workspace set up. This will create the first owner account for your application.</p>
                    <div class="form-group">
                        <label for="setupUserName">Your Full Name</label>
                        <input type="text" id="setupUserName" class="form-control" required placeholder="e.g., Ada Lovelace">
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="setupUserEmail">Your Email Address</label>
                        <input type="email" id="setupUserEmail" class="form-control" required placeholder="e.g., ada.lovelace@example.com">
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="setupWorkspaceName">Workspace Name</label>
                        <input type="text" id="setupWorkspaceName" class="form-control" required placeholder="e.g., Babbage Inc.">
                    </div>
                    <div class="modal-footer" style="border-top: none; padding: 2rem 0 0 0; margin-top: 0;">
                        <button type="submit" id="setup-submit-btn" class="btn btn-primary" style="width: 100%;">Get Started</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
