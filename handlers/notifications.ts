import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Notification, Task, NotificationType } from '../types.ts';
import { t } from '../i18n.ts';
import { openTaskDetail } from './tasks.ts';
import { apiPost, apiPut } from '../services/api.ts';
import { sendSlackNotification } from '../services.ts';

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
    const state = getState();
    const task = data.taskId ? state.tasks.find(t => t.id === data.taskId) : null;
    if (type !== 'join_request' && type !== 'time_off_request' && !task) return;

    if (data.userIdToNotify === data.actorId) return;

    let text = '';
    const actor = state.users.find(u => u.id === data.actorId);
    const actorName = actor?.name || actor?.initials || t('misc.system');

    let action: Notification['action'] = null;
    let targetWorkspaceId = data.workspaceId;

    switch (type) {
        case 'new_comment':
            text = t('notifications.comment_added').replace('{user}', actorName).replace('{taskName}', `"${task!.name}"`);
            action = { type: 'viewTask', taskId: data.taskId };
            targetWorkspaceId = task!.workspaceId;
            break;
        case 'new_assignment':
            text = t('notifications.task_assigned').replace('{taskName}', `"${task!.name}"`);
            action = { type: 'viewTask', taskId: data.taskId };
            targetWorkspaceId = task!.workspaceId;
            break;
        case 'status_change':
             const statusText = t(`tasks.${data.newStatus}`);
             text = t('notifications.status_changed').replace('{taskName}', `"${task!.name}"`).replace('{status}', statusText);
             action = { type: 'viewTask', taskId: data.taskId };
             targetWorkspaceId = task!.workspaceId;
            break;
        case 'mention':
            text = t('notifications.user_mentioned').replace('{user}', actorName).replace('{taskName}', `"${task!.name}"`);
            action = { type: 'viewTask', taskId: data.taskId };
            targetWorkspaceId = task!.workspaceId;
            break;
        case 'join_request':
            text = t('notifications.join_request').replace('{user}', actorName).replace('{workspaceName}', data.workspaceName || '');
            action = { type: 'viewJoinRequests' };
            break;
        case 'time_off_request':
            text = t('notifications.time_off_request').replace('{user}', actorName);
            action = { type: 'viewHrRequests' };
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
            await apiPost('notifications', newNotificationPayload);

            const slackIntegration = state.integrations.find(i => i.provider === 'slack' && i.isActive && i.workspaceId === targetWorkspaceId);
            if (slackIntegration) {
                const userToNotify = state.users.find(u => u.id === data.userIdToNotify);
                if (userToNotify?.slackUserId) {
                    sendSlackNotification(data.userIdToNotify, text, targetWorkspaceId);
                }
            }
        } catch (error) {
            console.error("Failed to create notification:", error);
        }
    }
}

export function toggleNotificationsPopover(force?: boolean) {
    setState(prevState => ({ ui: { ...prevState.ui, isNotificationsOpen: force ?? !prevState.ui.isNotificationsOpen } }), ['header']);
}

export async function handleNotificationClick(notificationId: string) {
    const state = getState();
    const notification = state.notifications.find(n => n.id === notificationId);
    if (!notification) return;

    if (!notification.isRead) {
        // Optimistic update without render
        setState(prevState => ({ 
            notifications: prevState.notifications.map(n => n.id === notificationId ? { ...n, isRead: true } : n) 
        }), []);

        try {
            await apiPut('notifications', { id: notificationId, isRead: true });
        } catch (error) {
            setState(prevState => ({
                notifications: prevState.notifications.map(n => n.id === notificationId ? { ...n, isRead: false } : n)
            }), []);
            console.error("Failed to mark notification as read:", error);
        }
    }

    setState(prevState => ({ ui: { ...prevState.ui, isNotificationsOpen: false } }), []);

    if (notification.action?.type === 'viewTask' && notification.action.taskId) {
        openTaskDetail(notification.action.taskId);
    } else if (notification.action?.type === 'viewJoinRequests' || notification.action?.type === 'viewHrRequests') {
        setState(prevState => ({ 
            ui: { ...prevState.ui, hr: { ...prevState.ui.hr, activeTab: 'requests' } },
            currentPage: 'hr'
        }), []);
        history.pushState({}, '', '/hr');
        updateUI(['page', 'header', 'sidebar']);
    }
    else {
        updateUI(['header']);
    }
}

export async function markAllNotificationsAsRead() {
    const state = getState();
    if (!state.currentUser || !state.activeWorkspaceId) return;
    
    const unreadNotificationIds = new Set(
        state.notifications
            .filter(n => n.userId === state.currentUser!.id && n.workspaceId === state.activeWorkspaceId && !n.isRead)
            .map(n => n.id)
    );
    
    if (unreadNotificationIds.size === 0) return;

    const originalNotifications = [...state.notifications];

    setState(prevState => ({
        notifications: prevState.notifications.map(n => unreadNotificationIds.has(n.id) ? { ...n, isRead: true } : n)
    }), ['header']);

    try {
        await Promise.all(
            Array.from(unreadNotificationIds).map(id => apiPut('notifications', { id, isRead: true }))
        );
    } catch (error) {
        console.error("Failed to mark all notifications as read:", error);
        alert(t('errors.notification_read_failed'));
        setState({ notifications: originalNotifications }, ['header']);
    }
}