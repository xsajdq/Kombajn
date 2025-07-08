import { t } from '../i18n.ts';

export function FloatingActionButton() {
    return `
        <button class="fab" id="fab-new-task" aria-label="${t('tasks.new_task')}" title="${t('tasks.new_task')} (n)">
            <span class="material-icons-sharp">add</span>
        </button>
    `;
}