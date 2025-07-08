

import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Notification, Task } from '../types.ts';
import { t } from '../i18n.ts';
import { openTaskDetail } from './tasks.ts';

export function createNotification(
    type: 'new_comment' | 'new_assignment' | 'status_change' | 'mention',
    data: { taskId: string; userIdToNotify: string; actorId: string; newStatus?: Task['status'] }
) {
    const task = state.tasks.find(t => t.id === data.taskId);
    if (!task) return;

    // Don't notify users about their own actions
    if (data.userIdToNotify === data.actorId) return;

    let text = '';
    const actor = state.users.find(u => u.id === data.actorId);
    const actorName = actor?.name || actor?.initials || 'System';
    const taskName = `"${task.name}"`;

    switch (type) {
        case 'new_comment':
            text = t('notifications.comment_added').replace('{user}', actorName).replace('{taskName}', taskName);
            break;
        case 'new_assignment':
            text = t('notifications.task_assigned').replace('{taskName}', taskName);
            break;
        case 'status_change':
             const statusText = t(`tasks.${data.newStatus}`);
             text = t('notifications.status_changed').replace('{taskName}', taskName).replace('{status}', statusText);
            break;
        case 'mention':
            text = t('notifications.user_mentioned').replace('{user}', actorName).replace('{taskName}', taskName);
            break;
    }
    
    if (text) {
        const newNotification: Notification = {
            id: generateId(),
            userId: data.userIdToNotify,
            workspaceId: task.workspaceId,
            text,
            createdAt: new Date().toISOString(),
            isRead: false,
            action: { type: 'viewTask', taskId: data.taskId }
        };
        state.notifications.unshift(newNotification);
    }
}

export function toggleNotificationsPopover(force?: boolean) {
    state.ui.isNotificationsOpen = force ?? !state.ui.isNotificationsOpen;
    renderApp();
}

export function handleNotificationClick(notificationId: string) {
    const notification = state.notifications.find(n => n.id === notificationId);
    if (!notification) return;

    notification.isRead = true;
    saveState(); // Save the read status immediately

    state.ui.isNotificationsOpen = false;

    // Perform action, which will trigger a re-render
    if (notification.action.type === 'viewTask') {
        openTaskDetail(notification.action.taskId);
    } else {
        renderApp(); // Fallback re-render for other action types
    }
}

export function markAllNotificationsAsRead() {
    if (!state.currentUser || !state.activeWorkspaceId) return;
    state.notifications.forEach(n => {
        if (n.userId === state.currentUser!.id && n.workspaceId === state.activeWorkspaceId) {
            n.isRead = true;
        }
    });
    saveState();
    renderApp();
}