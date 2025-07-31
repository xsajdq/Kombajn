import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';

export function handleMouseUp(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Don't show popover if we're clicking on the popover itself or an input/editable area
    if (target.closest('.text-selection-popover') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // If the click is inside an editable area but NOT a selection, close the popover.
        if (window.getSelection()?.isCollapsed && state.ui.textSelectionPopover.isOpen) {
             state.ui.textSelectionPopover.isOpen = false;
             updateUI(['text-selection-popover']);
        }
        return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectionText = selection.toString().trim();
    
    if (selection.isCollapsed || !selectionText) {
        if (state.ui.textSelectionPopover.isOpen) {
            state.ui.textSelectionPopover.isOpen = false;
            updateUI(['text-selection-popover']);
        }
        return;
    }
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? container as HTMLElement : container.parentElement;

    if (!element) return;

    const wikiView = element.closest('#project-wiki-view');
    const commentBody = element.closest('.activity-body .prose');
    
    let context: { type: 'project' | 'task', id: string } | null = null;
    
    if (wikiView) {
        const projectId = state.ui.openedProjectId;
        if (projectId) {
            context = { type: 'project', id: projectId };
        }
    } else if (commentBody) {
        const taskId = state.ui.modal.data?.taskId;
        if (taskId) {
            context = { type: 'task', id: taskId };
        }
    }

    if (context) {
        const rect = range.getBoundingClientRect();
        state.ui.textSelectionPopover = {
            isOpen: true,
            top: rect.bottom + window.scrollY + 5,
            left: rect.left + window.scrollX + (rect.width / 2),
            selectedText: selectionText,
            context: context
        };
        updateUI(['text-selection-popover']);
    } else {
        if (state.ui.textSelectionPopover.isOpen) {
            state.ui.textSelectionPopover.isOpen = false;
            updateUI(['text-selection-popover']);
        }
    }
}
