
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getCommands } from '../handlers/commands.ts';

export function CommandPalette() {
    const query = state.ui.commandPaletteQuery.toLowerCase();
    const allCommands = getCommands();
    const filteredCommands = query
        ? allCommands.filter(cmd => cmd.name.toLowerCase().includes(query))
        : allCommands;

    return `
        <div class="command-palette-overlay">
            <div class="command-palette">
                <div class="command-palette-input-wrapper">
                    <span class="material-icons-sharp">search</span>
                    <input type="text" id="command-palette-input" class="form-control" placeholder="${t('command_palette.placeholder')}" value="${state.ui.commandPaletteQuery}">
                </div>
                <div class="command-palette-list">
                    ${filteredCommands.length > 0 ? filteredCommands.map((cmd, index) => `
                        <div class="command-item ${index === state.ui.commandPaletteActiveIndex ? 'active' : ''}" data-command-id="${cmd.id}">
                            <span class="material-icons-sharp command-icon">${cmd.icon || 'keyboard_command_key'}</span>
                            <span class="command-text">${cmd.name}</span>
                            ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
                        </div>
                    `).join('') : `<div class="empty-command-list">${t('command_palette.no_results')}</div>`}
                </div>
            </div>
        </div>
    `;
}
