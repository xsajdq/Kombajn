import { state } from '../state.ts';
import { t } from '../i18n.ts';

export function TextSelectionPopover() {
    const { isOpen, top, left } = state.ui.textSelectionPopover;
    if (!isOpen) return '';

    return `
        <div class="text-selection-popover" style="position: absolute; top: ${top}px; left: ${left}px;">
            <button id="create-task-from-selection-btn" class="btn btn-secondary btn-sm flex items-center gap-1">
                <span class="material-icons-sharp text-base">add_task</span>
                Create Task
            </button>
        </div>
    `;
}
