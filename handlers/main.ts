import { getState, setState } from '../state.ts';
import type { Role, ProjectRole, ProjectTemplate, Task, Attachment, ChatMessage, Automation, DashboardWidget, Client, Project, Invoice, User, Workspace, WorkspaceMember, Notification, FilterView } from '../types.ts';
import { updateUI } from '../app-renderer.ts';
import { t } from '../i18n.ts';
import { apiFetch, apiPost } from '../services/api.ts';
import { Session } from '@supabase/supabase-js';
import { showToast } from './ui.ts';

export async function fetchInitialData(session: Session) {
    console.log("Fetching core data...");
    const data = await apiFetch('/api?action=bootstrap', {}, session);

    if (!data) throw new Error("Bootstrap data is null or undefined.");
    
    if (!data.currentUser) throw new Error("Bootstrap data is missing current user profile.");

    setState({
        currentUser: data.currentUser,
        users: data.profiles || [],
        workspaces: (data.workspaces || []).map((w: any) => ({
            ...w,
            subscription: { planId: w.subscriptionPlanId, status: w.subscriptionStatus },
            planHistory: w.planHistory || []
        })),
        workspaceMembers: data.workspaceMembers || [],
        workspaceJoinRequests: data.workspaceJoinRequests || [],
        notifications: data.notifications || [],
        integrations: data.integrations || [],
        filterViews: [],
    }, []);
    
    console.log("Core data fetched successfully.");
}

export async function fetchWorkspaceData(workspaceId: string) {
    console.log(`Fetching core data for workspace ${workspaceId}...`);
    
    try {
        // Fetch only the essential data for the dashboard and project/client overviews.
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&coreOnly=true`);
        if (!data) throw new Error("Workspace core data fetch returned null.");

        setState(prevState => ({
            dashboardWidgets: (data.dashboardWidgets || []).sort((a: DashboardWidget, b: DashboardWidget) => (a.sortOrder || 0) - (b.sortOrder || 0)),
            projects: data.projects || [],
            clients: data.clients || [],
            clientContacts: data.clients.flatMap((c: any) => c.clientContacts || []),
            projectMembers: data.projectMembers || [],
            tags: data.tags || [],
            projectTags: data.projectTags || [],
            clientTags: data.clientTags || [],
            timeOffRequests: data.timeOffRequests || [],
            reviews: data.reviews || [],
            tasks: data.tasks || [], // Add tasks for "My Day"
            taskAssignees: data.taskAssignees || [], // Add assignees for those tasks
            taskViews: data.taskViews || [],
            kanbanStages: data.kanbanStages || [],
            pipelineStages: data.pipelineStages || [],
            // Set loaded state for dashboard
            ui: {
                ...prevState.ui,
                dashboard: { ...prevState.ui.dashboard, loadedWorkspaceId: workspaceId, isLoading: false },
            }
        }), ['page']);
        
        console.log(`Successfully fetched core data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch core workspace data:", error);
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                dashboard: { ...prevState.ui.dashboard, isLoading: false, loadedWorkspaceId: null },
            }
        }), []);
        throw error; // Re-throw the error to be caught by the bootstrap process
    }
}

export function getUserProjectRole(userId: string, projectId: string): ProjectRole | null {
    const state = getState();
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
    
    if (workspaceMember.role === 'owner' || workspaceMember.role === 'admin') {
        return 'admin';
    }
    if (workspaceMember.role === 'manager') {
        return 'editor';
    }
    if (workspaceMember.role === 'member') {
        return 'editor';
    }
    if (workspaceMember.role === 'client') {
        return 'viewer';
    }
    
    return null;
}

export function getWorkspaceKanbanWorkflow(workspaceId: string | null): 'simple' | 'advanced' {
    const state = getState();
    if (!workspaceId) return 'simple';
    const integration = state.integrations.find(i => 
        i.workspaceId === workspaceId && 
        i.provider === 'internal_settings'
    );
    return integration?.settings?.defaultKanbanWorkflow || 'simple';
}

export async function handleSaveProjectAsTemplate(projectId: string) {
    const state = getState();
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !state.activeWorkspaceId) return;

    const tasksToTemplate = state.tasks
        .filter(t => t.projectId === projectId && !t.parentId)
        .map(({ name, description, priority }) => ({ name, description, priority }));

    const automationsToTemplate = state.automations
        .filter(a => a.projectId === projectId)
        .map(({ name, trigger, actions }): Omit<Automation, 'id' | 'workspaceId' | 'projectId'> => ({ name, trigger, actions }));

    const newTemplatePayload: Omit<ProjectTemplate, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        name: `${project.name} Template`,
        tasks: tasksToTemplate,
        automations: automationsToTemplate,
    };

    try {
        const [savedTemplate] = await apiPost('project_templates', newTemplatePayload);
        setState(prevState => ({ projectTemplates: [...prevState.projectTemplates, savedTemplate] }), []);
        showToast(`Project "${project.name}" saved as a template!`, 'success');
    } catch (error) {
        console.error("Failed to save project as template:", error);
        showToast("Could not save template. Please try again.", 'error');
    } finally {
        closeProjectMenu();
    }
}

export async function handleFileUpload(projectId: string, file: File, taskId?: string) {
    const state = getState();
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !state.activeWorkspaceId) return;

    const newAttachmentPayload: Omit<Attachment, 'id' | 'createdAt'> = {
        workspaceId: state.activeWorkspaceId,
        projectId: projectId,
        taskId: taskId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        provider: 'native',
    };
    
    try {
        const [savedAttachment] = await apiPost('attachments', newAttachmentPayload);
        setState(prevState => ({ attachments: [...prevState.attachments, savedAttachment] }), [getState().ui.modal.isOpen ? 'modal' : 'side-panel']);
    } catch(error) {
        console.error("File upload failed:", error);
        showToast("File upload failed. Please try again.", 'error');
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
    setState(prevState => ({ ui: { ...prevState.ui, activeChannelId: channelId } }), ['page']);
}

export async function handleSendMessage(channelId: string, content: string) {
    const state = getState();
    if (!state.currentUser) return;
    
    const newMessagePayload: Omit<ChatMessage, 'id'|'createdAt'> = {
        channelId,
        userId: state.currentUser.id,
        content,
    };
    
    try {
        const [savedMessage] = await apiPost('chat_messages', newMessagePayload);
        setState(prevState => ({ chatMessages: [...prevState.chatMessages, savedMessage] }), ['page']);
        
        const messageList = document.querySelector('.message-list');
        if (messageList) {
            setTimeout(() => messageList.scrollTop = messageList.scrollHeight, 0);
        }
    } catch (error) {
        console.error("Failed to send message:", error);
        showToast("Could not send message.", 'error');
    }
}
