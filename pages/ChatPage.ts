
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate } from '../utils.ts';
import type { Channel, ChatMessage, User } from '../types.ts';

function renderChatMessage(message: ChatMessage) {
    const user = state.users.find(u => u.id === message.userId);
    if (!user) return '';

    const renderMessageBody = (content: string) => {
        const mentionRegex = /@\[([^\]]+)\]\(user:([a-zA-Z0-9]+)\)/g;
        const html = content.replace(mentionRegex, `<strong style="color: var(--primary-color)">@$1</strong>`);
        return `<p>${html}</p>`;
    };

    return `
        <div class="message-item">
            <div class="avatar">${user.initials}</div>
            <div class="message-content">
                <div class="message-header">
                    <strong>${user.name}</strong>
                    <span class="time">${formatDate(message.createdAt, { hour: 'numeric', minute: 'numeric' })}</span>
                </div>
                <div class="message-body">
                    ${renderMessageBody(message.content)}
                </div>
            </div>
        </div>
    `;
}

export function ChatPage() {
    const { activeWorkspaceId, currentUser } = state;
    const { activeChannelId } = state.ui;
    if (!activeWorkspaceId || !currentUser) {
        return `<p>Loading...</p>`;
    }

    const channels = state.channels
        .filter(c => c.workspaceId === activeWorkspaceId)
        .sort((a, b) => (a.projectId ? 1 : -1) - (b.projectId ? 1 : -1) || a.name.localeCompare(b.name));
    
    const activeChannel = channels.find(c => c.id === activeChannelId);
    
    const messages = state.chatMessages
        .filter(m => m.channelId === activeChannelId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return `
        <div class="chat-layout">
            <aside class="chat-sidebar">
                <h3>${t('chat.channels')}</h3>
                <ul class="channel-list">
                    ${channels.map(channel => `
                        <li class="channel-item ${channel.id === activeChannelId ? 'active' : ''}" data-channel-id="${channel.id}">
                            <span class="material-icons-sharp">${channel.projectId ? 'folder' : 'public'}</span>
                            <span>${channel.projectId ? channel.name : t('chat.general_channel')}</span>
                        </li>
                    `).join('')}
                </ul>
            </aside>
            <main class="chat-main">
                ${activeChannel ? `
                    <div class="chat-header">
                        <h4>${activeChannel.projectId ? activeChannel.name : t('chat.general_channel')}</h4>
                    </div>
                    <div class="message-list">
                        <div class="message-list-inner">
                            ${messages.map(renderChatMessage).join('')}
                        </div>
                    </div>
                    <div class="chat-form-container">
                        <form id="chat-form" class="chat-form">
                            <input type="text" id="chat-message-input" class="form-control" placeholder="${t('chat.send_a_message')}" autocomplete="off">
                            <button type="submit" class="btn btn-primary" id="chat-send-btn">
                                <span class="material-icons-sharp">send</span>
                            </button>
                        </form>
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>Select a channel to start chatting.</p>
                    </div>
                `}
            </main>
        </div>
    `;
}
