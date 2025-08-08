

import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { getCommands } from '../handlers/commands.ts';
import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

// This function is now responsible ONLY for rendering the list of items.
export function renderCommandPaletteList(results?: any): TemplateResult {
    const state = getState();
    const query = state.ui.commandPaletteQuery;
    const activeIndex = state.ui.commandPaletteActiveIndex;

    const allCommands = getCommands();
    // Only show commands if query is empty, otherwise search results take precedence
    const commandResults = query ? [] : allCommands;
    
    let searchResults = results || { projects: [], tasks: [], clients: [] };
    
    if (!query) {
        searchResults = { projects: [], tasks: [], clients: [] };
    }
    
    const totalResults = commandResults.length + (searchResults.projects?.length || 0) + (searchResults.tasks?.length || 0) + (searchResults.clients?.length || 0);

    let currentIndex = 0;
    const renderGroup = (title: string, items: any[], type: string) => {
        if (!items || items.length === 0) return '';
        
        const itemsHtml = items.map(item => {
            const isItemActive = currentIndex === activeIndex;
            let icon, text, context, dataAttrs;

            switch (type) {
                case 'command':
                    icon = item.icon || 'keyboard_command_key';
                    text = item.name;
                    context = item.shortcut ? html`<span class="command-shortcut">${item.shortcut}</span>` : '';
                    dataAttrs = `data-command-id="${item.id}" data-result-type="command"`;
                    break;
                case 'project':
                    icon = 'folder';
                    text = item.name;
                    context = html`<span class="command-context">${item.context || ''}</span>`;
                    dataAttrs = `data-result-id="${item.id}" data-result-type="project"`;
                    break;
                case 'task':
                    icon = 'checklist';
                    text = item.name;
                    context = html`<span class="command-context">${item.context || ''}</span>`;
                    dataAttrs = `data-result-id="${item.id}" data-result-type="task"`;
                    break;
                case 'client':
                    icon = 'people';
                    text = item.name;
                    context = html`<span class="command-context">${item.context || ''}</span>`;
                    dataAttrs = `data-result-id="${item.id}" data-result-type="client"`;
                    break;
            }
            
            currentIndex++;
            return html`
                <div class="command-item ${isItemActive ? 'active' : ''}" ${unsafeHTML(dataAttrs)}>
                    <span class="material-icons-sharp command-icon">${icon}</span>
                    <span class="command-text">${text}</span>
                    ${context}
                </div>
            `;
        });
        
        return html`<div class="command-group"><div class="command-group-header">${title}</div>${itemsHtml}</div>`;
    };

    return totalResults > 0 
        ? html`${renderGroup('Commands', commandResults, 'command')}
               ${renderGroup('Projects', searchResults.projects, 'project')}
               ${renderGroup('Tasks', searchResults.tasks, 'task')}
               ${renderGroup('Clients', searchResults.clients, 'client')}`
        : html`<div class="empty-command-list">${t('command_palette.no_results')}</div>`;
}


// This function renders the main shell and the initial list content.
export function CommandPalette(): TemplateResult {
    const state = getState();
    return html`
        <div class="command-palette-overlay">
            <div class="command-palette">
                <div class="command-palette-input-wrapper">
                    <span class="material-icons-sharp">search</span>
                    <input type="text" id="command-palette-input" class="form-control" placeholder="${t('command_palette.placeholder')}" .value="${state.ui.commandPaletteQuery}" autofocus>
                </div>
                <div class="command-palette-list">
                    ${renderCommandPaletteList()}
                </div>
            </div>
        </div>
    `;
}