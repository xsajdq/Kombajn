import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { html, nothing, TemplateResult } from 'lit-html';

export function TextSelectionPopover(): TemplateResult | typeof nothing {
    const state = getState();
    const { isOpen, top, left } = state.ui.textSelectionPopover;
    if (!isOpen) return nothing;

    // The 'left' position is calculated as the horizontal center of the selection.
    // By adding `transform: translateX(-50%)`, we perfectly center the popover.
    const popoverStyle = `position: absolute; top: ${top}px; left: ${left}px; transform: translateX(-50%);`;

    return html`
        <div class="text-selection-popover" style="${popoverStyle}">
            <button id="create-task-from-selection-btn" class="btn btn-secondary btn-sm flex items-center gap-1">
                <span class="material-icons-sharp text-base">add_task</span>
                Create Task
            </button>
        </div>
    `;
}