
import { t } from '../../i18n.ts';
import { formatDuration } from '../../utils.ts';

export function AddCommentToTimeLogModal({ trackedSeconds }: { trackedSeconds: number }): string {
    const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
    const formGroupClasses = "flex flex-col gap-1.5";
    const labelClasses = "text-sm font-medium text-text-subtle";
    return `
        <form id="add-comment-to-timelog-form" class="space-y-4">
            <div class="${formGroupClasses}">
                <label for="timelog-amount" class="${labelClasses}">${t('modals.time_to_log')}</label>
                <input type="text" id="timelog-amount" class="${formControlClasses}" value="${formatDuration(trackedSeconds)}" placeholder="${t('modals.time_placeholder')}" required>
            </div>
            <div class="${formGroupClasses}">
                <label for="timelog-comment" class="${labelClasses}">${t('modals.comment_placeholder')}</label>
                <textarea id="timelog-comment" class="${formControlClasses}" rows="3"></textarea>
            </div>
        </form>
    `;
}