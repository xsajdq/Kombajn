


import { state, saveState, generateId } from '../state.ts';
import type { Role, ProjectRole, ProjectTemplate, Task, Attachment, ChatMessage, Automation, DashboardWidget } from '../types.ts';
import { renderApp } from '../app-renderer.ts';
import { t } from '../i18n.ts';
import { apiPost } from '../services/api.ts';


export function getCurrentUserRole(): Role | null {
    if (!state.currentUser || !state.activeWorkspaceId) return null;
    const member = state.workspaceMembers.find(m => m.userId === state.currentUser!.id && m.workspaceId === state.activeWorkspaceId);
    return member ? member.role : null;
}

export function getUserProjectRole(userId: string, projectId: string): ProjectRole | null {
    if (!userId || !projectId) return null;

    const project = state.projects.find(p => p.id === projectId);
    if (!project) return null;
    
    // 1. Check for explicit project membership first. This is the highest priority.
    const projectMember = state.projectMembers.find(pm => pm.projectId === projectId && pm.userId === userId);
    if (projectMember) {
        return projectMember.role;
    }

    // 2. If the project is private and user is not an explicit member, they have no access.
    if (project.privacy === 'private') {
        return null;
    }

    // 3. If the project is public, determine implied role based on workspace role.
    const workspaceMember = state.workspaceMembers.find(wm => wm.workspaceId === project.workspaceId && wm.userId === userId);
    if (!workspaceMember) return null; // Not part of the workspace at all.

    switch (workspaceMember.role) {
        case 'owner':
        case 'manager':
            return 'admin'; // Workspace admins are project admins for all public projects.
        case 'member':
            return 'editor'; // Workspace members can edit public projects.
        case 'client':
            return 'viewer'; // Clients can view public projects.
        default:
            return null;
    }
}

export function handleSaveProjectAsTemplate(projectId: string) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const tasksToTemplate = state.tasks
        .filter(t => t.projectId === projectId && !t.parentId) // Only top-level tasks
        .map(({ name, description, priority }) => ({ name, description, priority }));

    const automationsToTemplate = state.automations
        .filter(a => a.projectId === projectId)
        .map(({ trigger, action }): Omit<Automation, 'id' | 'workspaceId' | 'projectId'> => ({ trigger, action }));

    const newTemplate: ProjectTemplate = {
        id: generateId(),
        workspaceId: project.workspaceId,
        name: `${project.name} Template`,
        tasks: tasksToTemplate,
        automations: automationsToTemplate,
    };

    state.projectTemplates.push(newTemplate);
    saveState();
    alert(`Project "${project.name}" saved as a template!`);
    closeProjectMenu();
}

export function handleFileUpload(projectId: string, file: File, taskId?: string) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const newAttachment: Attachment = {
        id: generateId(),
        workspaceId: project.workspaceId,
        projectId: projectId,
        taskId: taskId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        createdAt: new Date().toISOString(),
    };
    state.attachments.push(newAttachment);
    saveState();
    renderApp();
}

export function toggleProjectMenu() {
    const menu = document.querySelector('.project-header-menu');
    menu?.classList.toggle('hidden');
}

export function closeProjectMenu() {
     const menu = document.querySelector('.project-header-menu');
    menu?.classList.add('hidden');
}

// --- CHAT HANDLERS ---
export function handleSwitchChannel(channelId: string) {
    state.ui.activeChannelId = channelId;
    saveState();
    renderApp();
}

export function handleSendMessage(channelId: string, content: string) {
    if (!state.currentUser) return;
    
    const newMessage: ChatMessage = {
        id: generateId(),
        channelId,
        userId: state.currentUser.id,
        content,
        createdAt: new Date().toISOString(),
    };
    
    state.chatMessages.push(newMessage);
    saveState();
    renderApp();
    
    // Scroll to bottom of messages
    const messageList = document.querySelector('.message-list');
    if (messageList) {
        messageList.scrollTop = messageList.scrollHeight;
    }
}