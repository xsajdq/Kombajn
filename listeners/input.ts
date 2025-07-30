
import { state } from '../state.ts';
import { handleMentionInput } from './mentions.ts';
import { updateUI } from '../app-renderer.ts';
import type { InvoiceLineItem } from '../types.ts';
import { handleCommandSearch } from '../handlers/commands.ts';

declare const marked: any;
declare const DOMPurify: any;

export function handleInput(e: Event) {
    const target = e.target as HTMLElement;

    // Command Palette live search
    if (target.id === 'command-palette-input') {
        const query = (target as HTMLInputElement).value;
        handleCommandSearch(query);
        return;
    }

    // Projects Page Search
    if (target.id === 'project-search-input') {
        state.ui.projects.filters.text = (target as HTMLInputElement).value;
        updateUI(['page']);
        return;
    }

    // Tasks Page Search
    if (target.id === 'task-filter-text') {
        state.ui.tasks.filters.text = (target as HTMLInputElement).value;
        state.ui.tasks.activeFilterViewId = null; // Typing in search box de-selects a saved view
        updateUI(['page']);
        return;
    }

    // Clients Page Search
    if (target.id === 'client-search-input') {
        state.ui.clients.filters.text = (target as HTMLInputElement).value;
        updateUI(['page']);
        return;
    }

    // HR (Employees) Page Search
    if (target.id === 'employee-search') {
        state.ui.hr.filters.text = (target as HTMLInputElement).value;
        updateUI(['page']);
        return;
    }
    
    // Goals Page Search
    if (target.id === 'goal-search-input') {
        state.ui.goals.filters.text = (target as HTMLInputElement).value;
        updateUI(['page']);
        return;
    }

    // Inventory Page Search
    if (target.id === 'inventory-search-input') {
        state.ui.inventory.filters.text = (target as HTMLInputElement).value;
        updateUI(['page']);
        return;
    }

    // Task comment draft saving
    if (target.id === 'task-comment-input' && state.ui.modal.type === 'taskDetail') {
        const taskId = state.ui.modal.data?.taskId;
        if (taskId) {
            localStorage.setItem(`comment-draft-${taskId}`, target.innerHTML);
        }
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