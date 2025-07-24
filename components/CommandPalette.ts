
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getCommands } from '../handlers/commands.ts';

export function CommandPalette() {
    const query = state.ui.commandPaletteQuery.toLowerCase();
    const activeIndex = state.ui.commandPaletteActiveIndex;

    const allCommands = getCommands();

    const results = {
        commands: [] as any[],
        projects: [] as any[],
        tasks: [] as any[],
        clients: [] as any[],
    };

    let totalResults = 0;

    if (query) {
        results.commands = allCommands.filter(cmd => cmd.name.toLowerCase().includes(query));
        results.projects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId && p.name.toLowerCase().includes(query)).slice(0, 5);
        results.tasks = state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && t.name.toLowerCase().includes(query)).slice(0, 5);
        results.clients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId && c.name.toLowerCase().includes(query)).slice(0, 5);
        totalResults = results.commands.length + results.projects.length + results.tasks.length + results.clients.length;
    } else {
        results.commands = allCommands;
        totalResults = allCommands.length;
    }

    let currentIndex = 0;
    const renderGroup = (title: string, items: any[], type: string) => {
        if (items.length === 0) return '';
        
        const itemsHtml = items.map(item => {
            const isItemActive = currentIndex === activeIndex;
            let icon, text, context, dataAttrs;

            switch (type) {
                case 'command':
                    icon = item.icon || 'keyboard_command_key';
                    text = item.name;
                    context = item.shortcut ? `<span class="command-shortcut">${item.shortcut}</span>` : '';
                    dataAttrs = `data-command-id="${item.id}" data-result-type="command"`;
                    break;
                case 'project':
                    icon = 'folder';
                    text = item.name;
                    const client = state.clients.find(c => c.id === item.clientId);
                    context = `<span class="command-context">${client?.name || ''}</span>`;
                    dataAttrs = `data-result-id="${item.id}" data-result-type="project"`;
                    break;
                case 'task':
                    icon = 'checklist';
                    text = item.name;
                    const project = state.projects.find(p => p.id === item.projectId);
                    context = `<span class="command-context">${project?.name || ''}</span>`;
                    dataAttrs = `data-result-id="${item.id}" data-result-type="task"`;
                    break;
                case 'client':
                    icon = 'people';
                    text = item.name;
                    context = `<span class="command-context">${item.email || ''}</span>`;
                    dataAttrs = `data-result-id="${item.id}" data-result-type="client"`;
                    break;
            }
            
            currentIndex++;
            return `
                <div class="command-item ${isItemActive ? 'active' : ''}" ${dataAttrs}>
                    <span class="material-icons-sharp command-icon">${icon}</span>
                    <span class="command-text">${text}</span>
                    ${context}
                </div>
            `;
        }).join('');
        
        return `<div class="command-group"><div class="command-group-header">${title}</div>${itemsHtml}</div>`;
    };

    const resultsHtml = `
        ${renderGroup('Commands', results.commands, 'command')}
        ${renderGroup('Projects', results.projects, 'project')}
        ${renderGroup('Tasks', results.tasks, 'task')}
        ${renderGroup('Clients', results.clients, 'client')}
    `;
    
    return `
        <div class="command-palette-overlay">
            <div class="command-palette">
                <div class="command-palette-input-wrapper">
                    <span class="material-icons-sharp">search</span>
                    <input type="text" id="command-palette-input" class="form-control" placeholder="${t('command_palette.placeholder')}" value="${state.ui.commandPaletteQuery}">
                </div>
                <div class="command-palette-list">
                    ${totalResults > 0 ? resultsHtml : `<div class="empty-command-list">${t('command_palette.no_results')}</div>`}
                </div>
            </div>
        </div>
    `;
}