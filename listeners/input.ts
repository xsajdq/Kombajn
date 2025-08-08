import { getState, setState } from '../state.ts';
import { handleMentionInput } from './mentions.ts';
import { updateUI } from '../app-renderer.ts';
import type { InvoiceLineItem, TaskDetailModalData, AddInvoiceModalData } from '../types.ts';
import { handleCommandSearch } from '../handlers/commands.ts';
import { handleSlashCommandInput, handleLiveMarkdown } from '../handlers/editor.ts';

declare const marked: any;
declare const DOMPurify: any;

export async function handleInput(e: Event) {
    const target = e.target as HTMLElement;

    const liveSearchInputs: { [key: string]: (value: string) => void } = {
        'project-search-input': (value) => setState(prevState => ({ ui: { ...prevState.ui, projects: { ...prevState.ui.projects, filters: { ...prevState.ui.projects.filters, text: value } } } }), ['page']),
        'task-filter-text': (value) => setState(prevState => ({ ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, filters: { ...prevState.ui.tasks.filters, text: value }, activeFilterViewId: null } } }), ['page']),
        'client-search-input': (value) => setState(prevState => ({ ui: { ...prevState.ui, clients: { ...prevState.ui.clients, filters: { ...prevState.ui.clients.filters, text: value } } } }), ['page']),
        'employee-search': (value) => setState(prevState => ({ ui: { ...prevState.ui, hr: { ...prevState.ui.hr, filters: { ...prevState.ui.hr.filters, text: value } } } }), ['page']),
        'goal-search-input': (value) => setState(prevState => ({ ui: { ...prevState.ui, goals: { ...prevState.ui.goals, filters: { ...prevState.ui.goals.filters, text: value } } } }), ['page']),
        'inventory-search-input': (value) => setState(prevState => ({ ui: { ...prevState.ui, inventory: { ...prevState.ui.inventory, filters: { ...prevState.ui.inventory.filters, text: value } } } }), ['page']),
    };

    if (target.id in liveSearchInputs && target instanceof HTMLInputElement) {
        const inputElement = target;
        const activeElementId = inputElement.id;
        const selectionStart = inputElement.selectionStart;
        const selectionEnd = inputElement.selectionEnd;

        liveSearchInputs[inputElement.id](inputElement.value);

        // The updateUI is now handled by setState, but it's async.
        // We use a microtask (setTimeout 0) to try and restore focus after the render.
        setTimeout(() => {
            const restoredInput = document.getElementById(activeElementId) as HTMLInputElement | null;
            if (restoredInput) {
                restoredInput.focus();
                if (selectionStart !== null && selectionEnd !== null) {
                    restoredInput.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }, 0);
        return;
    }

    if (target.id === 'command-palette-input') {
        const query = (target as HTMLInputElement).value;
        handleCommandSearch(query);
        return;
    }

    if (target.id === 'task-comment-input' && getState().ui.modal.type === 'taskDetail') {
        const taskId = (getState().ui.modal.data as TaskDetailModalData)?.taskId;
        if (taskId) {
            localStorage.setItem(`comment-draft-${taskId}`, target.innerHTML);
        }
    }

    if (target.matches('.rich-text-input')) {
        handleMentionInput(target);
        handleSlashCommandInput(target);
        handleLiveMarkdown(target);
    }

    if (target.matches('#project-wiki-editor')) {
        const editor = target as HTMLTextAreaElement;
        const preview = document.getElementById('project-wiki-preview');
        if (preview) {
            const sanitizedHtml = DOMPurify.sanitize(marked.parse(editor.value));
            preview.innerHTML = sanitizedHtml || '<p class="subtle-text">Live preview will appear here...</p>';
        }
        return;
    }
    
    const invoiceItemRow = target.closest<HTMLElement>('.invoice-item-row');
    if (invoiceItemRow) {
        const itemId = invoiceItemRow.dataset.itemId!;
        const field = (target as HTMLInputElement).dataset.field as keyof InvoiceLineItem;
        let value: string | number = (target as HTMLInputElement).value;
    
        if ((target as HTMLInputElement).type === 'number') {
            value = parseFloat(value) || 0;
        }
    
        setState(prevState => {
            if (prevState.ui.modal.type === 'addInvoice') {
                const modalData = prevState.ui.modal.data as AddInvoiceModalData;
                const updatedItems = (modalData.items || []).map((item: any) => 
                    item.id.toString() === itemId ? { ...item, [field]: value } : item
                );
                return { ui: { ...prevState.ui, modal: { ...prevState.ui.modal, data: { ...prevState.ui.modal.data, items: updatedItems } } } };
            }
            return prevState;
        }, ['modal']);
        return;
    }
}