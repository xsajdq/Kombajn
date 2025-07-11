
import { state } from '../state.ts';
import type { User } from '../types.ts';

export function MentionPopover() {
    const { query, target } = state.ui.mention;
    if (query === null || !target) return '';

    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => u !== undefined && (u.name?.toLowerCase().includes(query.toLowerCase()) || u.initials.toLowerCase().includes(query.toLowerCase())));

    if (workspaceMembers.length === 0) return '';
    
    const targetRect = target.getBoundingClientRect();

    // Reworked positioning to be more robust, especially inside modals.
    // Calculate position from the bottom of the viewport to avoid transform issues.
    const bottom = window.innerHeight - targetRect.top + 5; // 5px gap above the input
    const left = targetRect.left;
    const width = targetRect.width;

    // Use inline styles for dynamic positioning. The rest is in index.css.
    return `
        <div class="mention-popover" style="bottom: ${bottom}px; left: ${left}px; width: ${width}px;">
            ${workspaceMembers.map((user, index) => `
                <div class="mention-item ${index === state.ui.mention.activeIndex ? 'active' : ''}" data-mention-id="${user.id}" data-mention-name="${user.name || user.initials}">
                    <div class="avatar">${user.initials}</div>
                    <div class="mention-user">${user.name || user.initials}</div>
                    <div class="subtle-text">${user.email || ''}</div>
                </div>
            `).join('')}
        </div>
    `;
}
