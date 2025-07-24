

import { state } from '../state.ts';
import { handleMentionInput } from './mentions.ts';
import { updateUI } from '../app-renderer.ts';
import type { InvoiceLineItem } from '../types.ts';

declare const marked: any;
declare const DOMPurify: any;

export function handleInput(e: Event) {
    const target = e.target as HTMLElement;

    // Command Palette live search
    if (target.id === 'command-palette-input') {
        state.ui.commandPaletteQuery = (target as HTMLInputElement).value;
        state.ui.commandPaletteActiveIndex = 0; // Reset selection on new input
        updateUI(['command-palette']);
        return;
    }

    // Handle mention input on designated rich text fields
    if (target.matches('#chat-message-input, #task-comment-input')) {
        handleMentionInput(target);
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

    const employeeSearch = target.closest<HTMLInputElement>('#employee-search');
    if (employeeSearch) {
        const query = employeeSearch.value.toLowerCase();
        const rows = document.querySelectorAll<HTMLElement>('.hr-table-body .hr-table-row');
        rows.forEach(row => {
            const name = row.dataset.userName || '';
            const email = row.dataset.userEmail || '';
            const isVisible = name.includes(query) || email.includes(query);
            row.classList.toggle('hidden', !isVisible);
        });
        return;
    }
    
    // Client page search
    const clientSearchInput = target.closest<HTMLInputElement>('#client-search-input');
    if (clientSearchInput) {
        state.ui.clients.filters.text = clientSearchInput.value;
        updateUI(['page']);
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
