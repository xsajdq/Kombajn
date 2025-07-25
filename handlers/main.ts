

import { state } from '../state.ts';
import type { Role, ProjectRole, ProjectTemplate, Task, Attachment, ChatMessage, Automation, DashboardWidget, Client, Project, Invoice, User, Workspace, WorkspaceMember, Notification, FilterView } from '../types.ts';
import { updateUI } from '../app-renderer.ts';
import { t } from '../i18n.ts';
import { apiFetch, apiPost } from '../services/api.ts';
import { Session } from '@supabase/supabase-js';

type PageName = 'clients' | 'invoices' | 'projects' | 'tasks' | 'sales';

export async function fetchInitialData(session: Session) {
    console.log("Fetching core data...");
    const data = await apiFetch('/api?action=bootstrap', {}, session);

    if (!data) throw new Error("Bootstrap data is null or undefined.");
    
    state.currentUser = data.currentUser;
    if (!state.currentUser) throw new Error("Bootstrap data is missing current user profile.");

    state.users = data.profiles || [];
    state.workspaces = (data.workspaces || []).map((w: any) => ({
        ...w,
        subscription: { planId: w.subscriptionPlanId, status: w.subscriptionStatus },
        planHistory: w.planHistory || []
    }));
    state.workspaceMembers = data.workspaceMembers || [];
    state.workspaceJoinRequests = data.workspaceJoinRequests || [];
    
    // Notifications and integrations are global to the user, load them here.
    state.notifications = data.notifications || [];
    state.integrations = data.integrations || [];
    state.filterViews = [];
    
    console.log("Core data fetched successfully.");
}

export async function fetchWorkspaceData(workspaceId: string) {
    console.log(`Fetching data for workspace ${workspaceId}...`);
    
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}`);
        if (!data) throw new Error("Workspace data fetch returned null.");

        state.dashboardWidgets = (data.dashboardWidgets || []).sort((a: DashboardWidget, b: DashboardWidget) => (a.sortOrder || 0) - (b.sortOrder || 0));
        state.projects = data.projects || [];
        state.tasks = data.tasks || [];
        state.clients = data.clients || [];
        state.invoices = data.invoices || [];
        state.timeLogs = data.timeLogs || [];
        state.comments = data.comments || [];
        state.taskAssignees = data.taskAssignees || [];
        state.projectSections = data.projectSections || [];
        state.taskViews = data.taskViews || [];
        state.reviews = data.reviews || [];
        state.timeOffRequests = data.timeOffRequests || [];
        state.userTaskSortOrders = data.userTaskSortOrders || [];
        state.projectMembers = data.projectMembers || [];
        state.objectives = data.objectives || [];
        state.keyResults = data.keyResults || [];
        state.inventoryItems = data.inventoryItems || [];
        state.inventoryAssignments = data.inventoryAssignments || [];
        state.budgets = data.budgets || [];
        state.deals = data.deals || [];
        state.dealNotes = data.dealNotes || [];
        
        // Set loaded flags to prevent re-fetching on navigation
        state.ui.dashboard.loadedWorkspaceId = workspaceId;
        state.ui.projects.loadedWorkspaceId = workspaceId;
        state.ui.tasks.loadedWorkspaceId = workspaceId;
        state.ui.clients.loadedWorkspaceId = workspaceId;
        state.ui.invoices.loadedWorkspaceId = workspaceId;
        state.ui.sales.loadedWorkspaceId = workspaceId;
        
        console.log(`Successfully fetched data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch workspace data:", error);
        state.ui.dashboard.loadedWorkspaceId = null;
        state.ui.projects.loadedWorkspaceId = null;
        state.ui.tasks.loadedWorkspaceId = null;
        state.ui.clients.loadedWorkspaceId = null;
        state.ui.invoices.loadedWorkspaceId = null;
        state.ui.sales.loadedWorkspaceId = null;
        throw error; // Re-throw the error to be caught by the bootstrap process
    }
}


async function fetchPageData(pageName: PageName, apiAction: string, relatedPage?: PageName) {
    const uiState = state.ui[pageName as keyof typeof state.ui] as any;
    if (!state.activeWorkspaceId || uiState.isLoading) return;

    if (uiState.loadedWorkspaceId === state.activeWorkspaceId) {
        return; 
    }

    uiState.isLoading = true;
    updateUI(['page']);

    try {
        const data = await apiFetch(`/api?action=${apiAction}&workspaceId=${state.activeWorkspaceId}`);
        
        if (data) {
            Object.keys(data).forEach(key => {
                if (key in state && Array.isArray(state[key as keyof typeof state])) {
                    const existingDataArray = state[key as keyof typeof state] as any[];
                    const newDataFromFetch = data[key] || [];

                    // Remove all items from the current workspace before adding the new ones
                    const otherWorkspaceItems = existingDataArray.filter(item => item.workspaceId !== state.activeWorkspaceId);
                    
                    // Add the newly fetched items for the current workspace
                    (state as any)[key] = [...otherWorkspaceItems, ...newDataFromFetch];
                }
            });
        }
        
        uiState.loadedWorkspaceId = state.activeWorkspaceId;
        if (relatedPage) {
            (state.ui[relatedPage as keyof typeof state.ui] as any).loadedWorkspaceId = state.activeWorkspaceId;
        }
    } catch (error) {
        console.error(`Failed to fetch ${pageName} data:`, error);
        uiState.loadedWorkspaceId = null; // Allow retry
    } finally {
        uiState.isLoading = false;
        updateUI(['page']);
    }
}

export async function fetchClientsAndInvoicesData() {
    await fetchPageData('clients', 'clients-page-data', 'invoices');
}

export async function fetchProjectsData() {
    await fetchPageData('projects', 'projects-page-data');
}

export async function fetchTasksData() {
    await fetchPageData('tasks', 'tasks-page-data');
}


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
    if (!workspaceId) return 'simple';
    const integration = state.integrations.find(i => 
        i.workspaceId === workspaceId && 
        i.provider === 'internal_settings'
    );
    return integration?.settings?.defaultKanbanWorkflow || 'simple';
}

export async function handleSaveProjectAsTemplate(projectId: string) {
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
        state.attachments.push(savedAttachment);
        updateUI(state.ui.modal.isOpen ? ['modal'] : ['side-panel']);
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
    updateUI(['page']);
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
        
        updateUI(['page']);
        const messageList = document.querySelector('.message-list');
        if (messageList) {
            setTimeout(() => messageList.scrollTop = messageList.scrollHeight, 0);
        }
    } catch (error) {
        console.error("Failed to send message:", error);
        alert("Could not send message.");
    }
}
