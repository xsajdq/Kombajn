import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import * as uiHandlers from '../handlers/ui.ts';
import * as commandHandlers from '../handlers/commands.ts';
import * as onboardingHandlers from '../handlers/onboarding.ts';
import { handleInsertMention } from './mentions.ts';
import * as tagHandlers from '../handlers/tags.ts';

export function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    // Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        uiHandlers.toggleCommandPalette();
        return;
    }

    // Close modals/panels with Escape
    if (e.key === 'Escape') {
        if (state.ui.onboarding.isActive) {
            onboardingHandlers.finishOnboarding();
        } else if (state.ui.isCommandPaletteOpen) {
            uiHandlers.toggleCommandPalette(false);
        } else if (state.ui.modal.isOpen) {
            uiHandlers.closeModal();
        } else if (state.ui.openedClientId || state.ui.openedProjectId || state.ui.openedDealId) {
            uiHandlers.closeSidePanels();
        } else if (document.querySelector('[data-editing="true"]')) {
            // If an inline edit is active, cancel it.
            updateUI(['page']); 
        }
        return;
    }
    
    // Accessibility: Activate role="button" elements with Enter/Space
    if (e.key === 'Enter' || e.key === ' ') {
        if (target.getAttribute('role') === 'button' && target.tagName !== 'BUTTON') {
            e.preventDefault();
            target.click();
        }
    }

    // Handle interactions within popovers (Mentions or Command Palette)
    const targetPopover = document.querySelector('.mention-popover, .command-palette-list');
    if (targetPopover) {
        const items = targetPopover.querySelectorAll('.mention-item, .command-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            let activeIndex = state.ui.mention.target ? state.ui.mention.activeIndex : state.ui.commandPaletteActiveIndex;
            activeIndex = (activeIndex + 1) % items.length;
            if (state.ui.mention.target) {
                state.ui.mention.activeIndex = activeIndex;
                updateUI(['mention-popover']);
            } else {
                state.ui.commandPaletteActiveIndex = activeIndex;
                updateUI(['command-palette']);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            let activeIndex = state.ui.mention.target ? state.ui.mention.activeIndex : state.ui.commandPaletteActiveIndex;
            activeIndex = (activeIndex - 1 + items.length) % items.length;
             if (state.ui.mention.target) {
                state.ui.mention.activeIndex = activeIndex;
                updateUI(['mention-popover']);
            } else {
                state.ui.commandPaletteActiveIndex = activeIndex;
                updateUI(['command-palette']);
            }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const isMention = !!state.ui.mention.target;
            const isCommandPalette = state.ui.isCommandPaletteOpen;

            if (isMention) {
                 const activeItem = items[state.ui.mention.activeIndex] as HTMLElement;
                 if (activeItem) {
                    const userId = activeItem.dataset.mentionId!;
                    const user = state.users.find(u => u.id === userId);
                    if(user) handleInsertMention(user, state.ui.mention.target as HTMLElement);
                 }
            } else if (isCommandPalette) {
                 const activeItem = items[state.ui.commandPaletteActiveIndex] as HTMLElement;
                 if (activeItem) {
                    commandHandlers.handleCommandPaletteSelection(activeItem);
                 }
            }
        }
        return;
    }

    // Handle new tag creation on Enter
    if (e.key === 'Enter' && target.matches('.multiselect-add-new input')) {
        e.preventDefault();
        const input = target as HTMLInputElement;
        const newTagName = input.value.trim();
        const multiselect = input.closest<HTMLElement>('.multiselect-container');
        if (newTagName && multiselect) {
            const entityType = multiselect.dataset.entityType as 'project' | 'client' | 'task';
            const entityId = multiselect.dataset.entityId!;
            tagHandlers.handleToggleTag(entityType, entityId, '', newTagName);
            input.value = '';
        }
        return;
    }

    // Global shortcuts (only when not in an input)
    if (target instanceof HTMLElement && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !(target as HTMLElement).isContentEditable) {
        if (e.key === 'n') {
            e.preventDefault();
            uiHandlers.showModal('addTask');
        }
        if (e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('task-filter-text');
            if (searchInput) {
                uiHandlers.toggleTaskFilters(true); // Ensure filters are open
                searchInput.focus();
            }
        }
    }
}