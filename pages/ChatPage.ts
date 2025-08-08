import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate } from '../utils.ts';
import type { Channel, ChatMessage, User } from '../types.ts';
import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

function renderChatMessage(message: ChatMessage): TemplateResult | '' {
    const state = getState();
    const user = state.users.find(u => u.id === message.userId);
    if (!user) return '';

    const renderMessageBody = (content: string) => {
        const mentionRegex = /@\[([^\]]+)\]\(user:([a-fA-F0-9-]+)\)/g;
        const htmlContent = content.replace(mentionRegex, `<strong class="px-1.5 py-0.5 bg-primary/10 text-primary rounded-md">@$1</strong>`);
        return html`<p>${unsafeHTML(htmlContent)}</p>`;
    };

    return html`
        <div class="flex items-start gap-3 p-3 hover:bg-background rounded-lg">
            <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold shrink-0">${user.initials}</div>
            <div class="flex-1">
                <div class="flex items-baseline gap-2">
                    <strong class="text-sm font-semibold">${user.name}</strong>
                    <span class="text-xs text-text-subtle">${formatDate(message.createdAt, { hour: 'numeric', minute: 'numeric' })}</span>
                </div>
                <div class="text-sm prose dark:prose-invert max-w-none">
                    ${renderMessageBody(message.content)}
                </div>
            </div>
        </div>
    `;
}

export function ChatPage(): TemplateResult {
    const state = getState();
    const { activeWorkspaceId, currentUser } = state;
    const { activeChannelId } = state.ui;
    if (!activeWorkspaceId || !currentUser) {
        return html`<p>Loading...</p>`;
    }

    const channels = state.channels
        .filter(c => c.workspaceId === activeWorkspaceId)
        .sort((a, b) => (a.projectId ? 1 : -1) - (b.projectId ? 1 : -1) || a.name.localeCompare(b.name));
    
    const activeChannel = channels.find(c => c.id === activeChannelId);
    
    const messages = state.chatMessages
        .filter(m => m.channelId === activeChannelId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return html`
        <div class="flex flex-col md:flex-row h-full bg-content rounded-lg shadow-sm border border-border-color">
            <aside class="w-full md:w-72 bg-background/50 border-b md:border-b-0 md:border-r border-border-color flex flex-col">
                <h3 class="text-lg font-semibold p-4 border-b border-border-color">${t('sidebar.chat')}</h3>
                <ul class="flex-1 overflow-y-auto p-2 space-y-1">
                    ${channels.map(channel => html`
                        <li class="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm font-medium ${channel.id === activeChannelId ? 'bg-primary/10 text-primary' : 'hover:bg-background'}" data-channel-id="${channel.id}">
                            <span class="material-icons-sharp text-base">${channel.projectId ? 'folder' : 'public'}</span>
                            <span>${channel.name}</span>
                        </li>
                    `)}
                </ul>
            </aside>
            <main class="flex-1 flex flex-col">
                ${activeChannel ? html`
                    <div class="p-4 border-b border-border-color">
                        <h4 class="font-semibold">${activeChannel.name}</h4>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 message-list">
                        <div class="space-y-1">
                            ${messages.map(renderChatMessage)}
                        </div>
                    </div>
                    <div class="p-4 border-t border-border-color">
                        <form id="chat-form" class="flex items-center gap-2">
                            <div class="relative flex-1">
                                <div id="chat-message-input" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition min-h-[40px]" contenteditable="true" role="textbox" aria-multiline="false" data-placeholder="${t('modals.add_comment')}"></div>
                            </div>
                            <button type="submit" class="p-2 rounded-md bg-primary text-white hover:bg-primary-hover" id="chat-send-btn">
                                <span class="material-icons-sharp">send</span>
                            </button>
                        </form>
                    </div>
                ` : html`
                    <div class="flex flex-col items-center justify-center h-full text-center">
                        <span class="material-icons-sharp text-5xl text-text-subtle">chat</span>
                        <p class="mt-2 text-text-subtle">Select a channel to start chatting.</p>
                    </div>
                `}
            </main>
        </div>
    `;
}