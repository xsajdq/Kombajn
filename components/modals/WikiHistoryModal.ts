import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { formatDate, getUserInitials } from '../../utils.ts';
import { html, TemplateResult } from 'lit-html';
import type { WikiHistoryModalData } from '../../types.ts';

export function WikiHistoryModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as WikiHistoryModalData;
    const projectId = modalData.projectId;
    const history = state.wikiHistory
        .filter(h => h.projectId === projectId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const title = t('panels.history');
    const footer = html`<button class="btn-close-modal">${t('panels.close')}</button>`;
    const body = html`
        <div class="max-h-96 overflow-y-auto -mx-4 px-4">
            <ul class="divide-y divide-border-color">
            ${history.length > 0 ? history.map(h => {
                const user = state.users.find(u => u.id === h.userId);
                return html`
                    <li class="py-3">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-sm font-medium">
                                    ${t('hr.reviewed_by', {name: user?.name || getUserInitials(user) || 'User', date: formatDate(h.createdAt, {dateStyle: 'medium', timeStyle: 'short'})})}
                                </p>
                                <p class="text-xs text-text-subtle">${h.content.substring(0, 100)}...</p>
                            </div>
                            <button class="btn btn-secondary btn-sm" data-restore-version-id="${h.id}">Restore</button>
                        </div>
                    </li>
                `;
            }) : html`<p class="text-center text-sm text-text-subtle py-8">No history found.</p>`}
            </ul>
        </div>
    `;
    const maxWidth = 'max-w-3xl';
    
    return { title, body, footer, maxWidth };
}