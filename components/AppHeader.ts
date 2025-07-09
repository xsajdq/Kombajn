


import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { User } from '../types.ts';

export function AppHeader({ currentUser, activeWorkspaceId }: { currentUser: User, activeWorkspaceId: string }) {
    const userNotifications = state.notifications.filter(n => n.userId === currentUser.id && n.workspaceId === activeWorkspaceId);
    const unreadCount = userNotifications.filter(n => !n.isRead).length;

    const userWorkspaces = state.workspaceMembers
        .filter(m => m.userId === currentUser.id)
        .map(m => state.workspaces.find(w => w.id === m.workspaceId))
        .filter(w => w !== undefined);

    return `
        <header class="app-header">
             <div class="header-left">
                <div class="workspace-switcher">
                    <span class="material-icons-sharp">workspaces</span>
                    <select id="workspace-switcher" class="form-control">
                        ${userWorkspaces.map(w => `<option value="${w!.id}" ${w!.id === activeWorkspaceId ? 'selected' : ''}>${w!.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="header-right">
                <div class="notification-wrapper">
                    <button id="notification-bell" class="btn-icon" aria-label="${t('notifications.title')}">
                        <span class="material-icons-sharp">notifications</span>
                        ${unreadCount > 0 ? `<span class="notification-badge">${unreadCount}</span>` : ''}
                    </button>
                    ${state.ui.isNotificationsOpen ? NotificationsPopover({ currentUser, activeWorkspaceId }) : ''}
                </div>
                <button class="btn-icon" data-logout-button title="Log Out">
                    <span class="material-icons-sharp">logout</span>
                </button>
                <div class="avatar" title="${currentUser.name || currentUser.initials}">
                    ${currentUser.avatarUrl ? `<img src="${currentUser.avatarUrl}" alt="${currentUser.name || 'User avatar'}">` : currentUser.initials}
                </div>
            </div>
        </header>
    `;
}

export function NotificationsPopover({ currentUser, activeWorkspaceId }: { currentUser: User, activeWorkspaceId: string }) {
    const notifications = state.notifications
        .filter(n => n.userId === currentUser.id && n.workspaceId === activeWorkspaceId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


    // A simple time ago function for notifications
    const timeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return Math.floor(seconds) + "s ago";
    };

    return `
        <div class="notifications-popover">
            <div class="notifications-header">
                <h4>${t('notifications.title')}</h4>
                <button class="btn-link" id="mark-all-read-btn">${t('notifications.mark_all_read')}</button>
            </div>
            <div class="notifications-body">
                ${notifications.length > 0 ? `
                    <ul class="notification-list">
                        ${notifications.map(n => `
                            <li class="notification-item ${n.isRead ? '' : 'unread'}" data-notification-id="${n.id}">
                                <div class="notification-item-icon">
                                    <span class="material-icons-sharp">info</span>
                                </div>
                                <div class="notification-item-content">
                                    <p>${n.text}</p>
                                    <div class="time">${timeAgo(n.createdAt)}</div>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <p class="no-notifications">${t('notifications.no_notifications')}</p>
                `}
            </div>
        </div>
    `;
}