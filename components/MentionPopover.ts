import { state } from '../state.ts';
import type { User } from '../types.ts';
import { t } from '../i18n.ts';

export function MentionPopover() {
    const { query, activeIndex, rect } = state.ui.mention;
    if (query === null || !rect) return '';

    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId && m.userId !== state.currentUser?.id) // Filter out current user
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => {
            if (!u) return false;
            const queryLower = query.toLowerCase();
            const nameMatch = u.name ? u.name.toLowerCase().includes(queryLower) : false;
            // The DB allows initials to be null, so we must check for its existence before calling a method on it.
            const initialsMatch = u.initials ? u.initials.toLowerCase().includes(queryLower) : false;
            return nameMatch || initialsMatch;
        });

    const top = rect.bottom + 5; // Position below the cursor with a 5px gap
    const left = rect.left;

    const popoverContent = workspaceMembers.length > 0
        ? workspaceMembers.map((user, index) => `
            <div class="mention-item ${index === activeIndex ? 'active' : ''}" data-mention-id="${user.id}" data-mention-name="${user.name || user.initials}">
                <div class="avatar">${user.initials}</div>
                <div class="mention-user-info">
                    <div class="mention-user-name">${user.name || user.initials}</div>
                    <div class="mention-user-email">${user.email || ''}</div>
                </div>
            </div>
        `).join('')
        : `<div class="mention-item-empty">${t('command_palette.no_results')}</div>`;

    return `
        <div class="mention-popover" style="position: fixed; top: ${top}px; left: ${left}px;">
            ${popoverContent}
        </div>
    `;
}