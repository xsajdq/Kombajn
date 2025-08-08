import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import * as uiHandlers from '../handlers/ui.ts';
import * as commandHandlers from '../handlers/commands.ts';
import * as onboardingHandlers from '../handlers/onboarding.ts';
import { handleInsertMention } from './mentions.ts';
import * as tagHandlers from '../handlers/tags.ts';
import { handleInsertSlashCommand } from '../handlers/editor.ts';
import * as goalHandlers from '../handlers/goals.ts';

let gKeyTimeout: number | null = null;

export function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const state = getState();

    // Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        uiHandlers.toggleCommandPalette();
        return;
    }

    // Modal Focus Trap
    if (e.key === 'Tab' && state.ui.modal.isOpen) {
        const modal = document.getElementById('modal-content');
        if (!modal) return;

        const focusableElements = Array.from(
            modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter(el => el.offsetParent !== null); // Ensure element is visible

        if (focusableElements.length === 0) {
            e.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) { // Shift + Tab
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else { // Tab
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
        // Let the browser handle tabbing between other elements within the modal
        return;
    }


    // Close modals/panels with Escape
    if (e.key === 'Escape') {
        if (state.ui.onboarding.isActive) {
            onboardingHandlers.finishOnboarding();
        } else if (state.ui.isCommandPaletteOpen) {
            uiHandlers.toggleCommandPalette(false);
        } else if (state.ui.mention.target || state.ui.slashCommand.target) {
            setState(prevState => ({ ui: { ...prevState.ui, mention: { query: null, target: null, activeIndex: 0, rect: null }, slashCommand: { query: null, target: null, activeIndex: 0, rect: null } } }), ['mention-popover', 'slash-command-popover']);
        } else if (state.ui.modal.isOpen) {
            uiHandlers.closeModal();
        } else if (state.ui.openedClientId || state.ui.openedProjectId || state.ui.openedDealId) {
            uiHandlers.closeSidePanels();
        } else if (document.querySelector('[data-editing="true"]')) {
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

    // Handle interactions within popovers (Mentions, Slash Commands, or Command Palette)
    const activePopover = document.querySelector('.mention-popover, .slash-command-popover, .command-palette-list');
    if (activePopover) {
        const items = activePopover.querySelectorAll('.mention-item, .slash-command-item, .command-item');
        if (items.length === 0) return;

        let activeIndex: number = 0;
        let popoverType: 'mention' | 'slash' | 'command' = 'command';

        if (state.ui.mention.target) {
            activeIndex = state.ui.mention.activeIndex;
            popoverType = 'mention';
        } else if (state.ui.slashCommand.target) {
            activeIndex = state.ui.slashCommand.activeIndex;
            popoverType = 'slash';
        } else {
            activeIndex = state.ui.commandPaletteActiveIndex;
        }

        let newIndex = activeIndex;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            newIndex = (activeIndex + 1) % items.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            newIndex = (activeIndex - 1 + items.length) % items.length;
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const activeItem = items[activeIndex] as HTMLElement;
            if (activeItem) {
                if (popoverType === 'mention') {
                    const userId = activeItem.dataset.mentionId!;
                    const user = state.users.find(u => u.id === userId);
                    if (user) handleInsertMention(user, state.ui.mention.target!);
                } else if (popoverType === 'slash') {
                    const command = activeItem.dataset.command as string;
                    handleInsertSlashCommand(command, state.ui.slashCommand.target!);
                } else {
                    commandHandlers.handleCommandPaletteSelection(activeItem);
                }
            }
            return;
        }
        
        if (newIndex !== activeIndex) {
             if (popoverType === 'mention') {
                setState(prevState => ({ ui: { ...prevState.ui, mention: { ...prevState.ui.mention, activeIndex: newIndex } } }), ['mention-popover']);
            } else if (popoverType === 'slash') {
                setState(prevState => ({ ui: { ...prevState.ui, slashCommand: { ...prevState.ui.slashCommand, activeIndex: newIndex } } }), ['slash-command-popover']);
            } else {
                setState(prevState => ({ ui: { ...prevState.ui, commandPaletteActiveIndex: newIndex } }), ['command-palette']);
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

    // Handle new milestone creation on Enter
    if (e.key === 'Enter' && target.id === 'new-milestone-input') {
        e.preventDefault();
        goalHandlers.handleAddMilestone();
        return;
    }

    const isEditing = target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

    // Contextual shortcuts inside Task Detail Modal
    if (state.ui.modal.isOpen && state.ui.modal.type === 'taskDetail') {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (target.matches('#task-comment-input, .reply-form .rich-text-input')) {
                e.preventDefault();
                const form = target.closest('form');
                form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
                return;
            }
        }
        
        if (!isEditing) {
            if (e.key === 'e') {
                e.preventDefault();
                document.querySelector<HTMLTextAreaElement>('.task-detail-description textarea[data-field="description"]')?.focus();
                return;
            }
            if (e.key === 'm') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('.add-assignee-btn')?.click();
                return;
            }
        }
    }

    // Gmail-style navigation
    if (state.ui.gKeyPressed) {
        const keyMap: { [key: string]: string } = {
            'p': '/projects', 't': '/tasks', 'd': '/dashboard', 'h': '/hr', 's': '/settings',
        };
        if (keyMap[e.key]) {
            e.preventDefault();
            history.pushState({}, '', keyMap[e.key]);
            updateUI(['page', 'sidebar']);
        }
        setState(prevState => ({ ui: { ...prevState.ui, gKeyPressed: false } }), []);
        if (gKeyTimeout) clearTimeout(gKeyTimeout);
        gKeyTimeout = null;
        return;
    }

    // Global shortcuts (only when not in an input)
    if (!isEditing) {
        if (e.key === '?') {
            e.preventDefault();
            uiHandlers.showModal('keyboardShortcuts');
            return;
        }

        if (e.key === 'g') {
            e.preventDefault();
            setState(prevState => ({ ui: { ...prevState.ui, gKeyPressed: true } }), []);
            if (gKeyTimeout) clearTimeout(gKeyTimeout);
            gKeyTimeout = window.setTimeout(() => {
                if (getState().ui.gKeyPressed) {
                     setState(prevState => ({ ui: { ...prevState.ui, gKeyPressed: false } }), []);
                }
                gKeyTimeout = null;
            }, 2000);
            return;
        }

        if (e.key === 'n') {
            e.preventDefault();
            uiHandlers.showModal('addTask');
            return;
        }

        if (e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('task-filter-text');
            if (searchInput) {
                uiHandlers.toggleTaskFilters(true);
                searchInput.focus();
            }
            return;
        }
    }
}