

import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Command } from '../types.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { showModal, toggleCommandPalette, updateUrlAndShowDetail } from './ui.ts';
import { toggleNotificationsPopover } from './notifications.ts';

function navigate(path: string) {
    history.pushState({}, '', path);
}

export function executeCommand(commandId: string) {
    const command = getCommands().find(c => c.id === commandId);
    if (command) {
        command.action();
    }
}

export function handleCommandPaletteSelection(selectedItem: HTMLElement) {
    const type = selectedItem.dataset.resultType;
    const commandId = selectedItem.dataset.commandId;
    const resultId = selectedItem.dataset.resultId;
    
    toggleCommandPalette(false);

    if (type === 'command' && commandId) {
        executeCommand(commandId);
    } else if (resultId) {
        switch (type) {
            case 'project':
                updateUrlAndShowDetail('project', resultId);
                break;
            case 'client':
                updateUrlAndShowDetail('client', resultId);
                break;
            case 'task':
                updateUrlAndShowDetail('task', resultId);
                break;
        }
    }
}


export function getCommands(): Command[] {
    const allCommands: Command[] = [
        { id: 'new-task', name: t('command_palette.cmd_new_task'), icon: 'add_task', shortcut: 'N', action: () => showModal('addTask') },
        { id: 'toggle-theme', name: t('command_palette.cmd_toggle_theme'), icon: 'brightness_6', action: () => {
            state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
            saveState();
        }},
        { id: 'go-dashboard', name: t('command_palette.cmd_go_dashboard'), icon: 'dashboard', action: () => navigate('/dashboard') },
        { id: 'go-projects', name: t('command_palette.cmd_go_projects'), icon: 'folder', action: () => navigate('/projects') },
        { id: 'go-tasks', name: t('command_palette.cmd_go_tasks'), icon: 'checklist', action: () => navigate('/tasks') },
        { id: 'go-settings', name: t('command_palette.cmd_go_settings'), icon: 'settings', action: () => navigate('/settings') },
        { id: 'toggle-notifications', name: t('command_palette.cmd_toggle_notifications'), icon: 'notifications', action: () => toggleNotificationsPopover() },
        { id: 'new-project', name: t('command_palette.cmd_new_project'), icon: 'create_new_folder', action: () => showModal('addProject'), permission: 'create_projects' },
        { id: 'new-client', name: t('command_palette.cmd_new_client'), icon: 'person_add', action: () => showModal('addClient'), permission: 'manage_clients' },
        { id: 'new-invoice', name: t('command_palette.cmd_new_invoice'), icon: 'receipt_long', action: () => showModal('addInvoice'), permission: 'manage_invoices' },
        { id: 'go-hr', name: t('command_palette.cmd_go_hr'), icon: 'groups', action: () => navigate('/hr'), permission: 'view_hr' }
    ];

    const availableCommands = allCommands.filter(cmd => !cmd.permission || can(cmd.permission));

    return availableCommands.sort((a, b) => a.name.localeCompare(b.name));
}