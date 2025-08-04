
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Command } from '../types.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { showModal, toggleCommandPalette, updateUrlAndShowDetail } from './ui.ts';
import { toggleNotificationsPopover } from './notifications.ts';
import { renderCommandPaletteList } from '../components/CommandPalette.ts';

function navigate(path: string) {
    history.pushState({}, '', path);
}

export function executeCommand(commandId: string) {
    const command = getCommands().find(c => c.id === commandId);
    if (command) {
        command.action();
    }
}

let searchTimeout: number;
export function handleCommandSearch(query: string) {
    setState(prevState => ({
        ui: {
            ...prevState.ui,
            commandPaletteQuery: query,
            commandPaletteActiveIndex: 0,
        }
    }), []);

    clearTimeout(searchTimeout);

    const listContainer = document.querySelector('.command-palette-list');
    if (!listContainer) return;

    // If query is empty, restore default commands immediately
    if (!query) {
        listContainer.innerHTML = renderCommandPaletteList();
        return;
    }
    
    // Use a short debounce for responsiveness as filtering large arrays can be slow
    searchTimeout = window.setTimeout(() => {
        const lowerCaseQuery = query.toLowerCase();
        const state = getState();

        const projectResults = state.projects
            .filter(p => p.workspaceId === state.activeWorkspaceId && p.name.toLowerCase().includes(lowerCaseQuery))
            .map(p => ({
                id: p.id,
                name: p.name,
                type: 'project',
                context: state.clients.find(c => c.id === p.clientId)?.name || ''
            }));

        const taskResults = state.tasks
            .filter(t => t.workspaceId === state.activeWorkspaceId && t.name.toLowerCase().includes(lowerCaseQuery))
            .map(t => ({
                id: t.id,
                name: t.name,
                type: 'task',
                context: state.projects.find(p => p.id === t.projectId)?.name || ''
            }));
            
        const clientResults = state.clients
            .filter(c => c.workspaceId === state.activeWorkspaceId && c.name.toLowerCase().includes(lowerCaseQuery))
            .map(c => ({
                id: c.id,
                name: c.name,
                type: 'client',
                context: '' // Clients don't have a parent context
            }));

        const groupedResults = {
            projects: projectResults,
            tasks: taskResults,
            clients: clientResults,
        };
        
        if (listContainer && getState().ui.isCommandPaletteOpen) {
            listContainer.innerHTML = renderCommandPaletteList(groupedResults);
        }
    }, 100);
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
            setState(prevState => ({ settings: { ...prevState.settings, theme: prevState.settings.theme === 'dark' ? 'light' : 'dark' } }), ['all']);
        }},
        { id: 'go-dashboard', name: t('command_palette.cmd_go_dashboard'), icon: 'dashboard', action: () => { navigate('/dashboard'); updateUI(['page', 'sidebar']); } },
        { id: 'go-projects', name: t('command_palette.cmd_go_projects'), icon: 'folder', action: () => { navigate('/projects'); updateUI(['page', 'sidebar']); } },
        { id: 'go-tasks', name: t('command_palette.cmd_go_tasks'), icon: 'checklist', action: () => { navigate('/tasks'); updateUI(['page', 'sidebar']); } },
        { id: 'go-settings', name: t('command_palette.cmd_go_settings'), icon: 'settings', action: () => { navigate('/settings'); updateUI(['page', 'sidebar']); } },
        { id: 'toggle-notifications', name: t('command_palette.cmd_toggle_notifications'), icon: 'notifications', action: () => toggleNotificationsPopover() },
        { id: 'new-project', name: t('command_palette.cmd_new_project'), icon: 'create_new_folder', action: () => showModal('addProject'), permission: 'create_projects' },
        { id: 'new-client', name: t('command_palette.cmd_new_client'), icon: 'person_add', action: () => showModal('addClient'), permission: 'manage_clients' },
        { id: 'new-invoice', name: t('command_palette.cmd_new_invoice'), icon: 'receipt_long', action: () => showModal('addInvoice'), permission: 'manage_invoices' },
        { id: 'go-hr', name: t('command_palette.cmd_go_hr'), icon: 'groups', action: () => { navigate('/hr'); updateUI(['page', 'sidebar']); }, permission: 'view_hr' }
    ];

    const availableCommands = allCommands.filter(cmd => !cmd.permission || can(cmd.permission));

    return availableCommands.sort((a, b) => a.name.localeCompare(b.name));
}
