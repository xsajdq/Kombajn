
import { getState } from '../state.ts';
import { t } from '../i18n.ts';

type CommandItem = {
    id: 'heading1' | 'bulleted_list' | 'checklist';
    icon: string;
};

const COMMANDS: CommandItem[] = [
    { id: 'heading1', icon: 'title' },
    { id: 'bulleted_list', icon: 'format_list_bulleted' },
    { id: 'checklist', icon: 'checklist' },
];

export function SlashCommandPopover() {
    const state = getState();
    const { query, activeIndex, rect, target } = state.ui.slashCommand;
    if (query === null || !rect || !target) return '';

    const filteredCommands = COMMANDS.filter(cmd => cmd.id.includes(query.toLowerCase()));

    const top = rect.bottom + window.scrollY + 5;
    const left = rect.left + window.scrollX;

    const popoverContent = filteredCommands.length > 0
        ? filteredCommands.map((cmd, index) => `
            <div class="slash-command-item ${index === activeIndex ? 'active' : ''}" data-command="${cmd.id}">
                <div class="slash-command-icon">
                    <span class="material-icons-sharp">${cmd.icon}</span>
                </div>
                <div class="slash-command-info">
                    <h5>${t(`slash_commands.${cmd.id}`)}</h5>
                    <p>${t(`slash_commands.${cmd.id}_desc`)}</p>
                </div>
            </div>
        `).join('')
        : `<div class="slash-command-item-empty">${t('command_palette.no_results')}</div>`;

    return `
        <div class="slash-command-popover" style="position: absolute; top: ${top}px; left: ${left}px;">
            ${popoverContent}
        </div>
    `;
}
