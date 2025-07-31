
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { User } from '../types.ts';
import { formatDuration } from '../utils.ts';
import { Breadcrumbs } from './Breadcrumbs.ts';

export function AppHeader({ currentUser, activeWorkspaceId }: { currentUser: User, activeWorkspaceId: string }) {
    const userNotifications = state.notifications.filter(n => n.userId === currentUser.id && n.workspaceId === activeWorkspaceId);
    const unreadCount = userNotifications.filter(n => !n.isRead).length;

    const userWorkspaces = state.workspaceMembers
        .filter(m => m.userId === currentUser.id)
        .map(m => state.workspaces.find(w => w.id === m.workspaceId))
        .filter(w => w !== undefined);
    
    const { isRunning, startTime } = state.ui.globalTimer;
    const elapsedSeconds = isRunning && startTime ? (Date.now() - startTime) / 1000 : 0;

    return `
        <header class="bg-content text-text-main shrink-0">
             <div class="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 border-b border-border-color">
                <div class="flex items-center gap-4">
                    <button id="mobile-menu-toggle" class="p-2 rounded-full hover:bg-background transition-colors md:hidden" aria-label="Toggle menu">
                        <span class="material-icons-sharp">menu</span>
                    </button>
                    <div class="hidden md:flex items-center gap-2">
                        <span class="material-icons-sharp text-text-subtle">workspaces</span>
                        <select id="workspace-switcher" class="bg-transparent border border-border-color rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary outline-none">
                            ${userWorkspaces.map(w => `<option value="${w!.id}" ${w!.id === activeWorkspaceId ? 'selected' : ''} class="bg-content text-text-main">${w!.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div id="global-timer-container" class="flex items-center gap-2">
                        <span class="font-mono text-sm font-medium ${isRunning ? 'text-primary' : ''}" id="global-timer-display">
                            ${formatDuration(elapsedSeconds)}
                        </span>
                        <button id="global-timer-toggle" class="p-2 rounded-full hover:bg-background transition-colors ${isRunning ? 'text-primary' : ''}" aria-label="${isRunning ? t('tasks.stop_timer') : t('tasks.start_timer')}">
                            <span class="material-icons-sharp">${isRunning ? 'pause_circle' : 'play_circle'}</span>
                        </button>
                    </div>

                    <button id="help-btn" class="p-2 rounded-full hover:bg-background transition-colors" title="${t('shortcuts.title')}">
                        <span class="material-icons-sharp">help_outline</span>
                    </button>

                    <div class="relative">
                        <button id="notification-bell" class="p-2 rounded-full hover:bg-background transition-colors" aria-label="${t('notifications.title')}">
                            <span class="material-icons-sharp">notifications</span>
                            ${unreadCount > 0 ? `<span class="absolute top-0 right-0 h-4 w-4 bg-danger text-white text-xs font-bold rounded-full flex items-center justify-center">${unreadCount}</span>` : ''}
                        </button>
                        ${state.ui.isNotificationsOpen ? NotificationsPopover({ currentUser, activeWorkspaceId }) : ''}
                    </div>
                    <button class="p-2 rounded-full hover:bg-background transition-colors" data-logout-button title="Log Out">
                        <span class="material-icons-sharp">logout</span>
                    </button>
                    <div class="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold uppercase" title="${currentUser.name || currentUser.initials}">
                        ${currentUser.avatarUrl ? `<img src="${currentUser.avatarUrl}" alt="${currentUser.name || 'User avatar'}" class="h-full w-full rounded-full object-cover">` : currentUser.initials}
                    </div>
                </div>
            </div>
            ${Breadcrumbs()}
        </header>
    `;
}

export function NotificationsPopover({ currentUser, activeWorkspaceId }: { currentUser: User, activeWorkspaceId: string }) {
    const allNotifications = state.notifications
        .filter(n => n.userId === currentUser.id && n.workspaceId === activeWorkspaceId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const { activeTab } = state.ui.notifications;
    const unreadCount = allNotifications.filter(n => !n.isRead).length;

    const filteredNotifications = allNotifications.filter(n => {
        if (activeTab === 'new') return !n.isRead;
        if (activeTab === 'read') return n.isRead;
        return true;
    });

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
        <div class="absolute top-full right-0 mt-2 w-80 bg-content border border-border-color rounded-lg shadow-lg z-20">
            <div class="flex justify-between items-center p-3 border-b border-border-color">
                <h4 class="font-semibold">${t('notifications.title')}</h4>
                <button class="text-sm text-primary hover:underline" id="mark-all-read-btn">${t('notifications.mark_all_read')}</button>
            </div>
            <div class="flex border-b border-border-color">
                <button class="flex-1 py-2 text-center text-sm ${activeTab === 'new' ? 'border-b-2 border-primary text-text-main font-semibold' : 'text-text-subtle'}" data-tab="new">${t('notifications.tab_new')} (${unreadCount})</button>
                <button class="flex-1 py-2 text-center text-sm ${activeTab === 'read' ? 'border-b-2 border-primary text-text-main font-semibold' : 'text-text-subtle'}" data-tab="read">${t('notifications.tab_read')}</button>
            </div>
            <div class="p-2 max-h-96 overflow-y-auto">
                ${filteredNotifications.length > 0 ? `
                    <ul class="divide-y divide-border-color">
                        ${filteredNotifications.map(n => `
                            <li class="flex items-start gap-3 p-2 rounded-md cursor-pointer hover:bg-background notification-item ${n.isRead ? '' : 'font-semibold'}" data-notification-id="${n.id}">
                                <div class="mt-1">
                                    <span class="material-icons-sharp text-primary">info</span>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm">${n.text}</p>
                                    <div class="text-xs text-text-subtle mt-1">${timeAgo(n.createdAt)}</div>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <p class="text-center text-sm text-text-subtle py-8">${activeTab === 'new' ? t('notifications.no_new_notifications') : t('notifications.no_notifications')}</p>
                `}
            </div>
        </div>
    `;
}