
import { state } from '../state.ts';
import { handleMentionInput } from './mentions.ts';
import { updateUI } from '../app-renderer.ts';
import type { InvoiceLineItem } from '../types.ts';
import { handleCommandSearch } from '../handlers/commands.ts';
import { handleSlashCommandInput, handleLiveMarkdown } from '../handlers/editor.ts';

declare const marked: any;
declare const DOMPurify: any;

export async function handleInput(e: Event) {
    const target = e.target as HTMLElement;

    // Map of live search input IDs to the state update function
    const liveSearchInputs: { [key: string]: (value: string) => void } = {
        'project-search-input': (value) => state.ui.projects.filters.text = value,
        'task-filter-text': (value) => {
            state.ui.tasks.filters.text = value;
            state.ui.tasks.activeFilterViewId = null;
        },
        'client-search-input': (value) => state.ui.clients.filters.text = value,
        'employee-search': (value) => state.ui.hr.filters.text = value,
        'goal-search-input': (value) => state.ui.goals.filters.text = value,
        'inventory-search-input': (value) => state.ui.inventory.filters.text = value,
    };

    // Handle live search with focus preservation
    if (target.id in liveSearchInputs && target instanceof HTMLInputElement) {
        const inputElement = target;
        const activeElementId = inputElement.id;
        const selectionStart = inputElement.selectionStart;
        const selectionEnd = inputElement.selectionEnd;

        liveSearchInputs[inputElement.id](inputElement.value);

        await updateUI(['page']);

        const restoredInput = document.getElementById(activeElementId) as HTMLInputElement | null;
        if (restoredInput) {
            restoredInput.focus();
            if (selectionStart !== null && selectionEnd !== null) {
                restoredInput.setSelectionRange(selectionStart, selectionEnd);
            }
        }
        return;
    }

    // Command Palette live search
    if (target.id === 'command-palette-input') {
        const query = (target as HTMLInputElement).value;
        handleCommandSearch(query);
        return;
    }

    // Task comment draft saving
    if (target.id === 'task-comment-input' && state.ui.modal.type === 'taskDetail') {
        const taskId = state.ui.modal.data?.taskId;
        if (taskId) {
            localStorage.setItem(`comment-draft-${taskId}`, target.innerHTML);
        }
    }

    // Handle rich text editor features
    if (target.matches('.rich-text-input')) {
        handleMentionInput(target);
        handleSlashCommandInput(target);
        handleLiveMarkdown(target);
    }

    // Live Markdown preview for Wiki editor
    if (target.matches('#project-wiki-editor')) {
        const editor = target as HTMLTextAreaElement;
        const preview = document.getElementById('project-wiki-preview');
        if (preview) {
            const sanitizedHtml = DOMPurify.sanitize(marked.parse(editor.value));
            preview.innerHTML = sanitizedHtml || '<p class="subtle-text">Live preview will appear here...</p>';
        }
        return;
    }
    
    // Invoice item row input
    const invoiceItemRow = target.closest<HTMLElement>('.invoice-item-row');
    if (invoiceItemRow) {
        const itemId = invoiceItemRow.dataset.itemId!;
        const field = (target as HTMLInputElement).dataset.field as keyof InvoiceLineItem;
        let value: string | number = (target as HTMLInputElement).value;
    
        if ((target as HTMLInputElement).type === 'number') {
            value = parseFloat(value) || 0;
        }
    
        if (state.ui.modal.type === 'addInvoice') {
            const item = state.ui.modal.data.items.find((i: any) => i.id.toString() === itemId);
            if (item) {
                (item as any)[field] = value;
                updateUI(['modal']);
            }
        }
        return;
    }
}