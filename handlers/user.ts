import { getState, setState } from '../state.ts';
import { t } from '../i18n.ts';
import { apiFetch, apiPost, apiPut } from '../services/api.ts';
import { updateUI } from '../app-renderer.ts';

export async function handleUpdateProfile(form: HTMLFormElement) {
    const state = getState();
    if (!state.currentUser) return;

    const nameInput = form.querySelector('#profile-full-name') as HTMLInputElement;
    const avatarInput = form.querySelector('#avatar-upload') as HTMLInputElement;
    const statusEl = document.getElementById('profile-update-status');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    const name = nameInput.value.trim();
    if (!name) return;

    if (button) button.disabled = true;
    if (statusEl) statusEl.textContent = t('misc.saving');

    const payload: { id: string; name: string; avatarUrl?: string } = {
        id: state.currentUser.id,
        name: name,
        avatarUrl: state.currentUser.avatarUrl,
    };

    try {
        if (avatarInput.files && avatarInput.files[0]) {
            const file = avatarInput.files[0];
            const reader = new FileReader();
            payload.avatarUrl = await new Promise((resolve, reject) => {
                reader.onload = event => resolve(event.target?.result as string);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });
        }

        const [updatedProfile] = await apiPut('profiles', payload);

        setState(prevState => {
            const updatedUsers = prevState.users.map(u => 
                u.id === prevState.currentUser!.id ? { ...u, ...updatedProfile } : u
            );
            return {
                currentUser: { ...prevState.currentUser!, ...updatedProfile },
                users: updatedUsers
            };
        }, ['page', 'header']);


        if (statusEl) {
            statusEl.textContent = t('settings.profile_updated');
            statusEl.style.color = 'var(--success-color)';
        }
        
    } catch (error) {
        console.error("Profile update failed:", error);
        if (statusEl) {
            statusEl.textContent = t('settings.error_updating_profile');
            statusEl.style.color = 'var(--danger-color)';
        }
    } finally {
        if (button) button.disabled = false;
        setTimeout(() => {
            if (statusEl) statusEl.textContent = '';
        }, 3000);
    }
}

export async function handleUpdatePassword(form: HTMLFormElement) {
    const newPasswordEl = form.querySelector('#password-new') as HTMLInputElement;
    const confirmPasswordEl = form.querySelector('#password-confirm') as HTMLInputElement;
    const statusEl = document.getElementById('password-update-status');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;

    if (statusEl) statusEl.textContent = '';

    if (newPassword.length < 6) {
        if (statusEl) {
            statusEl.textContent = t('errors.password_too_short');
            statusEl.style.color = 'var(--danger-color)';
        }
        return;
    }

    if (newPassword !== confirmPassword) {
        if (statusEl) {
            statusEl.textContent = t('settings.password_mismatch');
            statusEl.style.color = 'var(--danger-color)';
        }
        return;
    }

    if (button) button.disabled = true;
    if (statusEl) statusEl.textContent = t('misc.saving');
    
    try {
        await apiFetch('/api?action=auth-update-password', { method: 'POST', body: JSON.stringify({ newPassword }) });
        
        if (statusEl) {
            statusEl.textContent = t('settings.password_updated');
            statusEl.style.color = 'var(--success-color)';
        }
        form.reset();
    } catch (error) {
        console.error("Password update failed:", error);
        if (statusEl) {
            statusEl.textContent = (error as Error).message || t('settings.error_updating_password');
            statusEl.style.color = 'var(--danger-color)';
        }
    } finally {
        if (button) button.disabled = false;
        setTimeout(() => {
            if (statusEl) statusEl.textContent = '';
        }, 3000);
    }
}

export async function handleToggleKanbanViewMode() {
    const state = getState();
    if (!state.currentUser) return;

    const currentMode = state.currentUser.kanbanViewMode || 'detailed';
    const newMode = currentMode === 'detailed' ? 'simple' : 'detailed';

    setState(prevState => ({
        currentUser: { ...prevState.currentUser!, kanbanViewMode: newMode }
    }), ['page']);

    try {
        await apiPut('profiles', { id: state.currentUser.id, kanbanViewMode: newMode });
    } catch (error) {
        console.error("Failed to save Kanban view preference:", error);
        setState(prevState => ({
            currentUser: { ...prevState.currentUser!, kanbanViewMode: currentMode }
        }), ['page']);
        alert(t('errors.view_preference_save_failed'));
    }
}