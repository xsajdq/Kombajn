

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Notification, Task, NotificationType } from '../types.ts';
import { t } from '../i18n.ts';
import { openTaskDetail } from './tasks.ts';
import { apiPost, apiPut } from '../services/api.ts';

export async function createNotification(
    type: NotificationType,
    data: { 
        taskId?: string; 
        userIdToNotify: string; 
        actorId: string; 
        newStatus?: Task['status'],
        workspaceId?: string;
        workspaceName?: string;
    }
) {
    const task = data.taskId ? state.tasks.find(t => t.id === data.taskId) : null;
    if (type !== 'join_request' && !task) return;

    if (data.userIdToNotify === data.actorId) return;

    let text = '';
    const actor = state.users.find(u => u.id === data.actorId);
    const actorName = actor?.name || actor?.initials || 'System';

    let action: Notification['action'] = { type: 'viewTask', taskId: data.taskId };
    let targetWorkspaceId = task?.workspaceId;

    switch (type) {
        case 'new_comment':
            text = t('notifications.comment_added').replace('{user}', actorName).replace('{taskName}', `"${task!.name}"`);
            break;
        case 'new_assignment':
            text = t('notifications.task_assigned').replace('{taskName}', `"${task!.name}"`);
            break;
        case 'status_change':
             const statusText = t(`tasks.${data.newStatus}`);
             text = t('notifications.status_changed').replace('{taskName}', `"${task!.name}"`).replace('{status}', statusText);
            break;
        case 'mention':
            text = t('notifications.user_mentioned').replace('{user}', actorName).replace('{taskName}', `"${task!.name}"`);
            break;
        case 'join_request':
            text = t('notifications.join_request').replace('{user}', actorName).replace('{workspaceName}', data.workspaceName || '');
            action = { type: 'viewJoinRequests' };
            targetWorkspaceId = data.workspaceId;
            break;
    }
    
    if (text && targetWorkspaceId) {
        const newNotificationPayload: Omit<Notification, 'id' | 'createdAt'> = {
            userId: data.userIdToNotify,
            workspaceId: targetWorkspaceId,
            type,
            actorId: data.actorId,
            text,
            isRead: false,
            action: action,
        };
        try {
            const [savedNotification] = await apiPost('notifications', newNotificationPayload);
            state.notifications.unshift(savedNotification);
            // Re-render only if the notification bell is visible
            if (document.getElementById('notification-bell')) {
                renderApp();
            }
        } catch (error) {
            console.error("Failed to create notification:", error);
        }
    }
}

export function toggleNotificationsPopover(force?: boolean) {
    state.ui.isNotificationsOpen = force ?? !state.ui.isNotificationsOpen;
    renderApp();
}

export async function handleNotificationClick(notificationId: string) {
    const notification = state.notifications.find(n => n.id === notificationId);
    if (!notification) return;

    if (!notification.isRead) {
        notification.isRead = true; // Optimistic update
        try {
            await apiPut('notifications', { id: notificationId, isRead: true });
        } catch (error) {
            notification.isRead = false; // Revert on failure
            console.error("Failed to mark notification as read:", error);
            // Optionally show an error to the user
        }
    }

    state.ui.isNotificationsOpen = false;

    if (notification.action.type === 'viewTask' && notification.action.taskId) {
        openTaskDetail(notification.action.taskId);
    } else if (notification.action.type === 'viewJoinRequests') {
        state.ui.hr.activeTab = 'requests';
        window.location.hash = '#/hr';
        renderApp();
    }
    else {
        renderApp();
    }
}

export async function markAllNotificationsAsRead() {
    if (!state.currentUser || !state.activeWorkspaceId) return;
    
    const unreadNotifications = state.notifications.filter(n => 
        n.userId === state.currentUser!.id && 
        n.workspaceId === state.activeWorkspaceId && 
        !n.isRead
    );
    
    if (unreadNotifications.length === 0) return;

    // Optimistic update
    unreadNotifications.forEach(n => n.isRead = true);
    renderApp();

    try {
        // Send all updates to the backend
        await Promise.all(
            unreadNotifications.map(n => apiPut('notifications', { id: n.id, isRead: true }))
        );
    } catch (error) {
        // Revert on failure
        console.error("Failed to mark all notifications as read:", error);
        alert("Could not mark all notifications as read. Please try again.");
        unreadNotifications.forEach(n => {
            const originalNotification = state.notifications.find(on => on.id === n.id);
            if(originalNotification) originalNotification.isRead = false;
        });
        renderApp();
    }
}