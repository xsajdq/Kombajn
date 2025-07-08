


import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Command } from '../types.ts';
import { t } from '../i18n.ts';
import { getCurrentUserRole } from './main.ts';
import { showModal, toggleCommandPalette } from './ui.ts';
import { toggleNotificationsPopover } from './notifications.ts';

export function executeCommand(commandId: string) {
    const command = getCommands().find(c => c.id === commandId);
    if (command) {
        command.action();
        // The action should handle its own state changes and re-rendering.
        // We close the palette after executing.
        toggleCommandPalette(false);
    }
}

export function getCommands(): Command[] {
    const userRole = getCurrentUserRole();
    const canManage = userRole === 'owner' || userRole === 'manager';

    const commands: Command[] = [
        { id: 'new-task', name: t('command_palette.cmd_new_task'), icon: 'add_task', shortcut: 'N', action: () => showModal('addTask') },
        { id: 'toggle-theme', name: t('command_palette.cmd_toggle_theme'), icon: 'brightness_6', action: () => {
            state.settings.darkMode = !state.settings.darkMode;
            saveState();
            renderApp();
        }},
        { id: 'go-dashboard', name: t('command_palette.cmd_go_dashboard'), icon: 'dashboard', action: () => window.location.hash = '#/dashboard' },
        { id: 'go-projects', name: t('command_palette.cmd_go_projects'), icon: 'folder', action: () => window.location.hash = '#/projects' },
        { id: 'go-tasks', name: t('command_palette.cmd_go_tasks'), icon: 'checklist', action: () => window.location.hash = '#/tasks' },
        { id: 'go-settings', name: t('command_palette.cmd_go_settings'), icon: 'settings', action: () => window.location.hash = '#/settings' },
        { id: 'toggle-notifications', name: t('command_palette.cmd_toggle_notifications'), icon: 'notifications', action: () => toggleNotificationsPopover() }
    ];

    if (canManage) {
        commands.push(
            { id: 'new-project', name: t('command_palette.cmd_new_project'), icon: 'create_new_folder', action: () => showModal('addProject') },
            { id: 'new-client', name: t('command_palette.cmd_new_client'), icon: 'person_add', action: () => showModal('addClient') },
            { id: 'new-invoice', name: t('command_palette.cmd_new_invoice'), icon: 'receipt_long', action: () => showModal('addInvoice') },
            { id: 'go-hr', name: t('command_palette.cmd_go_hr'), icon: 'groups', action: () => window.location.hash = '#/hr' }
        );
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
}
