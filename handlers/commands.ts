

import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Command } from '../types.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
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
    const allCommands: Command[] = [
        { id: 'new-task', name: t('command_palette.cmd_new_task'), icon: 'add_task', shortcut: 'N', action: () => showModal('addTask') },
        { id: 'toggle-theme', name: t('command_palette.cmd_toggle_theme'), icon: 'brightness_6', action: () => {
            state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
            saveState();
            renderApp();
        }},
        { id: 'go-dashboard', name: t('command_palette.cmd_go_dashboard'), icon: 'dashboard', action: () => window.location.hash = '#/dashboard' },
        { id: 'go-projects', name: t('command_palette.cmd_go_projects'), icon: 'folder', action: () => window.location.hash = '#/projects' },
        { id: 'go-tasks', name: t('command_palette.cmd_go_tasks'), icon: 'checklist', action: () => window.location.hash = '#/tasks' },
        { id: 'go-settings', name: t('command_palette.cmd_go_settings'), icon: 'settings', action: () => window.location.hash = '#/settings' },
        { id: 'toggle-notifications', name: t('command_palette.cmd_toggle_notifications'), icon: 'notifications', action: () => toggleNotificationsPopover() },
        { id: 'new-project', name: t('command_palette.cmd_new_project'), icon: 'create_new_folder', action: () => showModal('addProject'), permission: 'create_projects' },
        { id: 'new-client', name: t('command_palette.cmd_new_client'), icon: 'person_add', action: () => showModal('addClient'), permission: 'manage_clients' },
        { id: 'new-invoice', name: t('command_palette.cmd_new_invoice'), icon: 'receipt_long', action: () => showModal('addInvoice'), permission: 'manage_invoices' },
        { id: 'go-hr', name: t('command_palette.cmd_go_hr'), icon: 'groups', action: () => window.location.hash = '#/hr', permission: 'view_hr' }
    ];

    const availableCommands = allCommands.filter(cmd => !cmd.permission || can(cmd.permission));

    return availableCommands.sort((a, b) => a.name.localeCompare(b.name));
}