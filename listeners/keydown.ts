import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import * as uiHandlers from '../handlers/ui.ts';
import * as commandHandlers from '../handlers/commands.ts';
import * as onboardingHandlers from '../handlers/onboarding.ts';
import { handleInsertMention } from './mentions.ts';

export function handleKeydown(e: KeyboardEvent) {
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
        const targetEl = e.target as HTMLElement;
        if (targetEl.getAttribute('role') === 'button' && targetEl.tagName !== 'BUTTON') {
            e.preventDefault();
            targetEl.click();
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
            const activeItem = isMention
                ? items[state.ui.mention.activeIndex] as HTMLElement
                : items[state.ui.commandPaletteActiveIndex] as HTMLElement;

            if (activeItem) {
                if (isMention) {
                    const userId = activeItem.dataset.mentionId!;
                    const user = state.users.find(u => u.id === userId);
                    if(user) handleInsertMention(user, state.ui.mention.target as HTMLElement);
                } else {
                    commandHandlers.executeCommand(activeItem.dataset.commandId!);
                }
            }
        }
        return;
    }

    // Global shortcuts (only when not in an input)
    if (e.target instanceof HTMLElement && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !(e.target as HTMLElement).isContentEditable) {
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