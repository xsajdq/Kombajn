import { t } from '../../i18n.ts';

function renderTimePicker(initialSeconds: number = 0) {
    const hours = Math.floor(initialSeconds / 3600);
    const minutes = Math.floor((initialSeconds % 3600) / 60);
    const snappedMinutes = Math.round(minutes / 5) * 5;

    const hoursOptions = Array.from({ length: 24 }, (_, i) => `<div class="time-picker-option ${i === hours ? 'selected' : ''}" data-value="${i}">${String(i).padStart(2, '0')}</div>`).join('');
    const minutesOptions = Array.from({ length: 12 }, (_, i) => {
        const minute = i * 5;
        return `<div class="time-picker-option ${minute === snappedMinutes ? 'selected' : ''}" data-value="${minute}">${String(minute).padStart(2, '0')}</div>`;
    }).join('');

    return `
        <div class="time-picker">
            <input type="hidden" id="time-picker-seconds" value="${initialSeconds}">
            <div class="time-picker-column" id="time-picker-hours">${hoursOptions}</div>
            <div class="time-picker-column" id="time-picker-minutes">${minutesOptions}</div>
        </div>
    `;
}

export function AddCommentToTimeLogModal({ trackedSeconds }: { trackedSeconds: number }): string {
    const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
    const formGroupClasses = "flex flex-col gap-1.5";
    const labelClasses = "text-sm font-medium text-text-subtle";
    return `
        <form id="add-comment-to-timelog-form" class="space-y-4">
            <div class="${formGroupClasses}">
                <label class="${labelClasses}">${t('modals.time_to_log')}</label>
                ${renderTimePicker(Math.floor(trackedSeconds))}
            </div>
            <div class="${formGroupClasses}">
                <label for="timelog-comment" class="${labelClasses}">${t('modals.comment_placeholder')}</label>
                <textarea id="timelog-comment" class="${formControlClasses}" rows="3"></textarea>
            </div>
        </form>
    `;
}
