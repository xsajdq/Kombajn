

import { state } from '../state.ts';
import type { User } from '../types.ts';

export function MentionPopover() {
    const { query, target } = state.ui.mention;
    if (query === null || !target) return '';

    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => u !== undefined && u.name.toLowerCase().includes(query.toLowerCase()));

    if (workspaceMembers.length === 0) return '';
    
    const targetRect = target.getBoundingClientRect();

    // Position the popover just above the input field, aligned to the left.
    // Using fixed positioning relative to the viewport is more robust.
    const top = targetRect.top;
    const left = targetRect.left;
    const width = targetRect.width;

    return `
        <div class="mention-popover" style="top: ${top}px; left: ${left}px; width: ${width}px; transform: translateY(-100%); margin-top: -5px;">
            ${workspaceMembers.map((user, index) => `
                <div class="mention-item ${index === state.ui.mention.activeIndex ? 'active' : ''}" data-mention-id="${user.id}" data-mention-name="${user.name}">
                    <div class="avatar">${user.initials}</div>
                    <div class="mention-user">${user.name}</div>
                    <div class="subtle-text">${user.email || ''}</div>
                </div>
            `).join('')}
        </div>
    `;
}