
import { t } from '../../i18n.ts';
import { formatDuration } from '../../utils.ts';

export function AddCommentToTimeLogModal({ trackedSeconds }: { trackedSeconds: number }): string {
    return `
        <form id="add-comment-to-timelog-form" class="space-y-4">
            <p class="text-sm text-text-subtle">${t('modals.time_tracked')}: <strong class="text-base text-text-main font-semibold">${formatDuration(trackedSeconds)}</strong></p>
            <div class="flex flex-col gap-1.5">
                <label for="timelog-comment" class="text-sm font-medium text-text-subtle">${t('modals.comment_placeholder')}</label>
                <textarea id="timelog-comment" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" rows="3"></textarea>
            </div>
        </form>
    `;
}
