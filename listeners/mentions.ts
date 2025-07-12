
import { state } from '../state.ts';
import { renderApp, renderMentionPopover } from '../app-renderer.ts';
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
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range.startContainer.textContent) {
        state.ui.mention.query = null;
        state.ui.mention.target = null;
        renderMentionPopover();
        return;
    }
    
    const textBeforeCursor = range.startContainer.textContent.substring(0, range.startOffset);
    const atPosition = textBeforeCursor.lastIndexOf('@');

    if (atPosition > -1 && (atPosition === 0 || /\s/.test(textBeforeCursor[atPosition - 1]))) {
        const query = textBeforeCursor.substring(atPosition + 1);
        if (query.includes('\n') || query.includes(' ')) {
             state.ui.mention.query = null;
             state.ui.mention.target = null;
        } else {
             state.ui.mention.query = query;
             state.ui.mention.target = inputDiv;
             state.ui.mention.activeIndex = 0;
        }
    } else {
        state.ui.mention.query = null;
        state.ui.mention.target = null;
    }
    
    renderMentionPopover();
}

export function handleInsertMention(user: User, inputDiv: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const cursorNode = range.startContainer;
    const cursorOffset = range.startOffset;

    if (cursorNode.nodeType !== Node.TEXT_NODE) {
        console.warn("Mention trigger was not in a text node. Aborting.");
        return;
    }
    
    const originalTextNode = cursorNode as Text;
    const parent = originalTextNode.parentNode;
    if (!parent) return;

    const mentionChip = document.createElement('span');
    mentionChip.className = 'mention-chip';
    mentionChip.setAttribute('contenteditable', 'false');
    mentionChip.dataset.userId = user.id;
    mentionChip.textContent = `@${user.name || user.initials}`;
    
    const spaceNode = document.createTextNode('\u00A0'); 

    const textBefore = originalTextNode.nodeValue!.substring(0, originalTextNode.nodeValue!.lastIndexOf('@'));
    const textAfter = originalTextNode.nodeValue!.substring(cursorOffset);
    
    parent.insertBefore(new Text(textBefore), originalTextNode);
    parent.insertBefore(mentionChip, originalTextNode);
    parent.insertBefore(spaceNode, originalTextNode);
    const afterNode = parent.insertBefore(new Text(textAfter), originalTextNode);
    parent.removeChild(originalTextNode);

    range.setStart(afterNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    state.ui.mention.query = null;
    state.ui.mention.target = null;
    renderMentionPopover();
    inputDiv.focus();
}
