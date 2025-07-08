
import { t } from '../../i18n.ts';
import { formatDuration } from '../../utils.ts';

export function AddCommentToTimeLogModal({ trackedSeconds }: { trackedSeconds: number }): string {
    return `
        <form id="add-comment-to-timelog-form">
            <p>${t('modals.time_tracked')}: <strong>${formatDuration(trackedSeconds)}</strong></p>
            <div class="form-group">
                <label for="timelog-comment">${t('modals.comment_placeholder')}</label>
                <textarea id="timelog-comment" class="form-control" rows="3"></textarea>
            </div>
        </form>
    `;
}
