

import { state } from '../state.ts';
import type { Role, ProjectRole, ProjectTemplate, Task, Attachment, ChatMessage, Automation, DashboardWidget } from '../types.ts';
import { renderApp } from '../app-renderer.ts';
import { t } from '../i18n.ts';
import { apiPost } from '../services/api.ts';


export function getUserProjectRole(userId: string, projectId: string): ProjectRole | null {
    if (!userId || !projectId) return null;

    const project = state.projects.find(p => p.id === projectId);
    if (!project) return null;
    
    const projectMember = state.projectMembers.find(pm => pm.projectId === projectId && pm.userId === userId);
    if (projectMember) {
        return projectMember.role;
    }

    if (project.privacy === 'private') {
        return null;
    }

    const workspaceMember = state.workspaceMembers.find(wm => wm.workspaceId === project.workspaceId && wm.userId === userId);
    if (!workspaceMember) return null;
    
    // Simplistic mapping from workspace role to project role for public projects
    // Owner and Admin get admin rights on all public projects.
    if (workspaceMember.roles.includes('owner') || workspaceMember.roles.includes('admin')) {
        return 'admin';
    }
    if (workspaceMember.roles.includes('manager')) {
        return 'editor'; // Managers can edit public projects
    }
    if (workspaceMember.roles.includes('member')) {
        return 'editor'; // Members can also edit public projects
    }
    if (workspaceMember.roles.includes('client')) {
        return 'viewer';
    }
    
    return null;
}

export async function handleSaveProjectAsTemplate(projectId: string) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !state.activeWorkspaceId) return;

    const tasksToTemplate = state.tasks
        .filter(t => t.projectId === projectId && !t.parentId)
        .map(({ name, description, priority }) => ({ name, description, priority }));

    const automationsToTemplate = state.automations
        .filter(a => a.projectId === projectId)
        .map(({ trigger, action }): Omit<Automation, 'id' | 'workspaceId' | 'projectId'> => ({ trigger, action }));

    const newTemplatePayload: Omit<ProjectTemplate, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name: `${project.name} Template`,
        tasks: tasksToTemplate,
        automations: automationsToTemplate,
    };

    try {
        const [savedTemplate] = await apiPost('project_templates', newTemplatePayload);
        state.projectTemplates.push(savedTemplate);
        alert(`Project "${project.name}" saved as a template!`);
    } catch (error) {
        console.error("Failed to save project as template:", error);
        alert("Could not save template. Please try again.");
    } finally {
        closeProjectMenu();
    }
}

export async function handleFileUpload(projectId: string, file: File, taskId?: string) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !state.activeWorkspaceId) return;

    // This is a simplified version. A real implementation would upload to Supabase Storage
    // and then save the file URL/path in the database.
    const newAttachmentPayload: Omit<Attachment, 'id' | 'createdAt'> = {
        workspaceId: state.activeWorkspaceId,
        projectId: projectId,
        taskId: taskId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
    };
    
    try {
        const [savedAttachment] = await apiPost('attachments', newAttachmentPayload);
        state.attachments.push(savedAttachment);
        renderApp();
    } catch(error) {
        console.error("File upload failed:", error);
        alert("File upload failed. Please try again.");
    }
}

export function toggleProjectMenu() {
    const menu = document.querySelector('.project-header-menu');
    menu?.classList.toggle('hidden');
}

export function closeProjectMenu() {
     const menu = document.querySelector('.project-header-menu');
    menu?.classList.add('hidden');
}

export function handleSwitchChannel(channelId: string) {
    state.ui.activeChannelId = channelId;
    renderApp();
}

export async function handleSendMessage(channelId: string, content: string) {
    if (!state.currentUser) return;
    
    const newMessagePayload: Omit<ChatMessage, 'id'|'createdAt'> = {
        channelId,
        userId: state.currentUser.id,
        content,
    };
    
    try {
        const [savedMessage] = await apiPost('chat_messages', newMessagePayload);
        state.chatMessages.push(savedMessage);
        
        const messageList = document.querySelector('.message-list');
        renderApp(); // Re-render to show the new message
        if (messageList) {
            // Scroll to bottom after render
            setTimeout(() => messageList.scrollTop = messageList.scrollHeight, 0);
        }
    } catch (error) {
        console.error("Failed to send message:", error);
        alert("Could not send message.");
    }
}