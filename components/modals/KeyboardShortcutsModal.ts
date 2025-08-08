import { t } from '../../i18n.ts';
import { html, TemplateResult } from 'lit-html';

export function KeyboardShortcutsModal() {
    const title = t('shortcuts.title');
    const maxWidth = 'max-w-lg';
    const footer = html`<button class="btn btn-primary btn-close-modal">Got it</button>`;

    const renderShortcutRow = (keys: string, description: string) => html`
        <div class="flex justify-between items-center py-2">
            <p class="text-sm">${description}</p>
            <div class="flex gap-1">
                ${keys.split('+').map(key => html`<kbd class="px-2 py-1 text-xs font-semibold bg-background border border-border-color rounded-md">${key.trim()}</kbd>`)}
            </div>
        </div>
    `;

    const body = html`
        <div class="space-y-4">
            <div>
                <h4 class="font-semibold mb-2">${t('shortcuts.global_title')}</h4>
                <div class="divide-y divide-border-color">
                    ${renderShortcutRow('Ctrl + K', t('shortcuts.global_desc_palette'))}
                    ${renderShortcutRow('n', t('shortcuts.global_desc_new_task'))}
                    ${renderShortcutRow('?', t('shortcuts.global_desc_help'))}
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-2">${t('shortcuts.nav_title')}</h4>
                <p class="text-xs text-text-subtle mb-2">${t('shortcuts.nav_desc_prefix')}</p>
                <div class="divide-y divide-border-color">
                    ${renderShortcutRow('g + d', t('shortcuts.nav_desc_dashboard'))}
                    ${renderShortcutRow('g + p', t('shortcuts.nav_desc_projects'))}
                    ${renderShortcutRow('g + t', t('shortcuts.nav_desc_tasks'))}
                    ${renderShortcutRow('g + h', t('shortcuts.nav_desc_hr'))}
                    ${renderShortcutRow('g + s', t('shortcuts.nav_desc_settings'))}
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-2">${t('shortcuts.context_title')}</h4>
                <div class="divide-y divide-border-color">
                    ${renderShortcutRow('e', t('shortcuts.context_desc_edit'))}
                    ${renderShortcutRow('m', t('shortcuts.context_desc_assign'))}
                    ${renderShortcutRow('Ctrl + Enter', t('shortcuts.context_desc_comment'))}
                </div>
            </div>
        </div>
    `;

    return { title, body, footer, maxWidth };
}