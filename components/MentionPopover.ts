
import { state } from '../state.ts';
import type { User } from '../types.ts';
import { t } from '../i18n.ts';

export function MentionPopover() {
    const { query, target, activeIndex } = state.ui.mention;
    if (query === null || !target) return '';

    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId && m.userId !== state.currentUser?.id) // Filter out current user
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => u !== undefined && (u.name?.toLowerCase().includes(query.toLowerCase()) || u.initials.toLowerCase().includes(query.toLowerCase())));

    const targetRect = target.getBoundingClientRect();
    const bottom = window.innerHeight - targetRect.top + 5;
    const left = targetRect.left;
    const width = targetRect.width;

    const popoverContent = workspaceMembers.length > 0
        ? workspaceMembers.map((user, index) => `
            <div class="mention-item ${index === activeIndex ? 'active' : ''}" data-mention-id="${user.id}" data-mention-name="${user.name || user.initials}">
                <div class="avatar">${user.initials}</div>
                <div class="mention-user">${user.name || user.initials}</div>
                <div class="subtle-text">${user.email || ''}</div>
            </div>
        `).join('')
        : `<div class="mention-item-empty">${t('command_palette.no_results')}</div>`;

    return `
        <div class="mention-popover" style="bottom: ${bottom}px; left: ${left}px; width: ${width}px;">
            ${popoverContent}
        </div>
    `;
}
