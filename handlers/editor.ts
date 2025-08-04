
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';

function getCaretPosition(element: HTMLElement): { range: Range | null, rect: DOMRect | null } {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        return { range, rect };
    }
    return { range: null, rect: null };
}

export function handleSlashCommandInput(inputDiv: HTMLElement) {
    const { range, rect } = getCaretPosition(inputDiv);
    if (!range || !rect) {
        setState(prevState => ({ ui: { ...prevState.ui, slashCommand: { query: null, target: null, activeIndex: 0, rect: null } } }), ['slash-command-popover']);
        return;
    }

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
        setState(prevState => ({ ui: { ...prevState.ui, slashCommand: { query: null, target: null, activeIndex: 0, rect: null } } }), ['slash-command-popover']);
        return;
    }

    const textBeforeCursor = textNode.textContent?.substring(0, range.startOffset) || '';
    const slashPosition = textBeforeCursor.lastIndexOf('/');

    if (slashPosition > -1 && (slashPosition === 0 || /\s/.test(textBeforeCursor[slashPosition - 1]))) {
        const query = textBeforeCursor.substring(slashPosition + 1);
        
        if (query.includes('\n') || query.includes(' ')) {
            setState(prevState => ({ ui: { ...prevState.ui, slashCommand: { query: null, target: null, activeIndex: 0, rect: null } } }), ['slash-command-popover']);
        } else {
            const slashRange = document.createRange();
            slashRange.setStart(textNode, slashPosition);
            slashRange.setEnd(textNode, slashPosition + 1);
            const slashRect = slashRange.getBoundingClientRect();

            setState(prevState => ({ ui: { ...prevState.ui, slashCommand: { query, target: inputDiv, activeIndex: 0, rect: slashRect } } }), ['slash-command-popover']);
        }
    } else {
        setState(prevState => ({ ui: { ...prevState.ui, slashCommand: { query: null, target: null, activeIndex: 0, rect: null } } }), ['slash-command-popover']);
    }
}

export function handleInsertSlashCommand(command: string, inputDiv: HTMLElement) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const textBeforeCursor = textNode.textContent?.substring(0, range.startOffset) || '';
    const slashPosition = textBeforeCursor.lastIndexOf('/');
    if (slashPosition === -1) return;

    range.setStart(textNode, slashPosition);
    range.deleteContents();

    inputDiv.focus();
    
    switch(command) {
        case 'heading1':
            document.execCommand('formatBlock', false, '<h1>');
            break;
        case 'bulleted_list':
            document.execCommand('insertUnorderedList', false);
            break;
        case 'checklist':
            // Simple checklist for now
            document.execCommand('insertHTML', false, '<ul><li><input type="checkbox"> </li></ul>');
            break;
    }

    setState(prevState => ({ ui: { ...prevState.ui, slashCommand: { query: null, target: null, activeIndex: 0, rect: null } } }), ['slash-command-popover']);
}

export function handleLiveMarkdown(inputDiv: HTMLElement) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    if (container.nodeType === Node.TEXT_NODE && container.textContent?.startsWith('## ')) {
        const textNode = container as Text;
        
        // Prevent infinite loops
        if (textNode.parentElement?.tagName === 'H2') return;

        range.setStart(textNode, 0);
        range.setEnd(textNode, 3);
        range.deleteContents();

        document.execCommand('formatBlock', false, '<h2>');
    }
}

export function getStorableHtmlFromContentEditable(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;

    // Convert mention spans back to storable format
    clone.querySelectorAll('.mention-chip').forEach(chip => {
        const el = chip as HTMLElement;
        const userId = el.dataset.userId;
        const userName = el.textContent?.substring(1);
        if (userId && userName) {
            chip.replaceWith(document.createTextNode(`@[${userName}](user:${userId})`));
        }
    });

    return clone.innerHTML;
}
