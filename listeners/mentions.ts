import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { User } from '../types.ts';

export function parseMentionContent(element: HTMLElement): string {
    let content = '';
    element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            content += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains('mention-chip')) {
                const userId = el.dataset.userId;
                const userName = el.textContent?.substring(1); // Remove '@'
                if (userId && userName) {
                    content += `@[${userName}](user:${userId})`;
                }
            } else {
                 content += node.textContent;
            }
        }
    });
    return content;
}

export function handleMentionInput(inputDiv: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        state.ui.mention = { query: null, target: null, activeIndex: 0, rect: null };
        updateUI(['mention-popover']);
        return;
    }

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    
    // Check if we are inside a text node, which is necessary for range manipulation.
    if (textNode.nodeType !== Node.TEXT_NODE) {
        state.ui.mention = { query: null, target: null, activeIndex: 0, rect: null };
        updateUI(['mention-popover']);
        return;
    }

    const textBeforeCursor = textNode.textContent?.substring(0, range.startOffset) || '';
    const atPosition = textBeforeCursor.lastIndexOf('@');

    if (atPosition > -1 && (atPosition === 0 || /\s/.test(textBeforeCursor[atPosition - 1]))) {
        const query = textBeforeCursor.substring(atPosition + 1);
        if (query.includes('\n') || query.includes(' ')) {
            state.ui.mention = { query: null, target: null, activeIndex: 0, rect: null };
        } else {
            // Get rect of the '@' character itself for precise positioning
            const atRange = document.createRange();
            atRange.setStart(textNode, atPosition);
            atRange.setEnd(textNode, atPosition + 1);
            const atRect = atRange.getBoundingClientRect();

            state.ui.mention = { 
                query, 
                target: inputDiv, 
                activeIndex: 0,
                rect: atRect 
            };
        }
    } else {
        state.ui.mention = { query: null, target: null, activeIndex: 0, rect: null };
    }
    
    updateUI(['mention-popover']);
}

export function handleInsertMention(user: User, inputDiv: HTMLElement) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    
    if (textNode.nodeType !== Node.TEXT_NODE) {
        console.warn("Mention trigger was not in a text node. Aborting.");
        return;
    }

    // Find the position of the '@' that triggered the mention
    const textBeforeCursor = textNode.textContent?.substring(0, range.startOffset) || '';
    const atPosition = textBeforeCursor.lastIndexOf('@');
    if (atPosition === -1) return; // Should not happen if popover is visible

    // Replace the query text (from '@' to cursor) with the mention chip
    range.setStart(textNode, atPosition);
    range.deleteContents();

    // Create the mention chip
    const mentionChip = document.createElement('span');
    mentionChip.className = 'mention-chip';
    mentionChip.setAttribute('contenteditable', 'false');
    mentionChip.dataset.userId = user.id;
    mentionChip.textContent = `@${user.name || user.initials}`;
    
    // Insert the chip
    range.insertNode(mentionChip);

    // Add a non-breaking space after the chip and move the cursor
    const spaceNode = document.createTextNode('\u00A0'); 
    range.collapse(false); // collapse to the end of the chip
    range.insertNode(spaceNode);
    range.collapse(false); // move cursor after the space

    // Reset mention state completely
    state.ui.mention = { query: null, target: null, activeIndex: 0, rect: null };
    updateUI(['mention-popover']);
    inputDiv.focus();
}