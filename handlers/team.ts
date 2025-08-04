
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Role, WorkspaceMember, User, Workspace, TimeOffRequest, ProjectMember, WorkspaceJoinRequest, ProjectRole } from '../types.ts';
import { closeSidePanels, closeModal, showModal } from './ui.ts';
import { getUsage, PLANS } from '../utils.ts';
import { t } from '../i18n.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { createNotification } from './notifications.ts';
import { switchWorkspaceChannel, supabase } from '../services/supabase.ts';
import { startOnboarding } from './onboarding.ts';
import { renderApp } from '../app-renderer.ts';
import { fetchWorkspaceData } from './main.ts';
import { handleCreateDefaultStages } from './pipeline.ts';

export async function handleWorkspaceSwitch(workspaceId: string) {
    const state = getState();
    if (state.activeWorkspaceId !== workspaceId) {
        
        localStorage.setItem('activeWorkspaceId', workspaceId);

        // Reset loaded status for all pages to force refetch
        const newUiState = { ...state.ui };
        Object.keys(newUiState).forEach(key => {
            const pageState = (newUiState as any)[key];
            if (pageState && typeof pageState === 'object' && 'loadedWorkspaceId' in pageState) {
                pageState.loadedWorkspaceId = null;
            }
        });
        
        newUiState.dashboard.isLoading = true;
        
        closeSidePanels(false);
        
        setState({ 
            activeWorkspaceId: workspaceId,
            currentPage: 'dashboard',
            ui: newUiState
        }, ['page', 'sidebar', 'header']);
        
        history.pushState({}, '', '/dashboard');


        await switchWorkspaceChannel(workspaceId);
        await fetchWorkspaceData(workspaceId);
        
        setState(prevState => ({ ui: { ...prevState.ui, dashboard: { ...prevState.ui.dashboard, isLoading: false } } }), ['page']);
    }
}


export async function handleCreateWorkspace(name: string) {
    const state = getState();
    if (!state.currentUser) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
        alert("Workspace name cannot be empty.");
        return;
    }
    
    // Check against all workspaces, not just loaded ones
    const { data: existingWorkspaces } = await apiFetch(`/api?action=data&resource=workspaces&name=${trimmedName}`);
    if (existingWorkspaces && existingWorkspaces.length > 0) {
        alert(t('hr.workspace_name_exists'));
        return;
    }
    
    const ownedWorkspacesCount = state.workspaces.filter(w =>
        state.workspaceMembers.some(m => m.workspaceId === w.id && m.userId === state.currentUser!.id && m.role === 'owner')
    ).length;
    const currentPlanId = state.activeWorkspaceId ? state.workspaces.find(w => w.id === state.activeWorkspaceId)!.subscription.planId : 'free';
    const planLimits = PLANS[currentPlanId];

    if (ownedWorkspacesCount >= planLimits.workspaces) {
        alert(t('hr.workspace_limit_reached'));
        return;
    }


    try {
        const workspacePayload = {
            name: trimmedName,
            subscriptionPlanId: 'free',
            subscriptionStatus: 'active'
        };
        
        const [newWorkspaceRaw] = await apiPost('workspaces', workspacePayload);
        
        const memberPayload = { workspaceId: newWorkspaceRaw.id, userId: state.currentUser.id, role: 'owner' as Role };
        const [newMember] = await apiPost('workspace_members', memberPayload);

        // Create default pipeline stages for the new workspace
        await handleCreateDefaultStages(newWorkspaceRaw.id);

        const newWorkspace: Workspace = {
            ...newWorkspaceRaw,
            subscription: {
                planId: newWorkspaceRaw.subscriptionPlanId,
                status: newWorkspaceRaw.subscriptionStatus
            },
            planHistory: newWorkspaceRaw.planHistory || []
        };
        setState({
            workspaces: [...state.workspaces, newWorkspace],
            workspaceMembers: [...state.workspaceMembers, newMember]
        }, []);

        // Automatically switch to the new workspace
        await handleWorkspaceSwitch(newWorkspace.id);

        // Start onboarding for the first workspace
        startOnboarding();

    } catch (error) {
        console.error("Failed to create workspace:", error);
        alert((error as Error).message);
    }
}

export async function handleRequestToJoinWorkspace(workspaceName: string) {
    const state = getState();
    if (!state.currentUser) return;
    
    // Fetch from API to check all workspaces, not just the ones the user is in
    const { data: targetWorkspaces } = await apiFetch(`/api?action=data&resource=workspaces&name=${workspaceName}`);
    if (!targetWorkspaces || targetWorkspaces.length === 0) {
        alert(`Workspace "${workspaceName}" not found.`);
        return;
    }
    const targetWorkspace = targetWorkspaces[0];
    
    const isMember = state.workspaceMembers.some(m => m.workspaceId === targetWorkspace.id && m.userId === state.currentUser!.id);
    if (isMember) {
        alert("You are already a member of this workspace.");
        return;
    }

    const hasPendingRequest = state.workspaceJoinRequests.some(r => r.workspaceId === targetWorkspace.id && r.userId === state.currentUser!.id && r.status === 'pending');
    if (hasPendingRequest) {
        alert("You already have a pending request to join this workspace.");
        return;
    }

    const [newRequest] = await apiPost('workspace_join_requests', { workspaceId: targetWorkspace.id, userId: state.currentUser!.id, status: 'pending' });
    setState({ workspaceJoinRequests: [...state.workspaceJoinRequests, newRequest] }, ['page']);

    const owners = state.workspaceMembers.filter(m => m.workspaceId === targetWorkspace.id && m.role === 'owner');
    owners.forEach(owner => {
        createNotification('join_request', {
            userIdToNotify: owner.userId,
            actorId: state.currentUser!.id,
            workspaceId: targetWorkspace.id,
            workspaceName: targetWorkspace.name
        });
    });
}

export async function handleApproveJoinRequest(requestId: string) {
    const state = getState();
    const request = state.workspaceJoinRequests.find(r => r.id === requestId);
    if (!request) return;

    try {
        const [newMember] = await apiPost('workspace_members', {
            workspaceId: request.workspaceId,
            userId: request.userId,
            role: 'member'
        });

        const [updatedRequest] = await apiPut('workspace_join_requests', { id: request.id, status: 'approved' });
        
        setState(prevState => ({
            workspaceMembers: [...prevState.workspaceMembers, newMember],
            workspaceJoinRequests: prevState.workspaceJoinRequests.map(r => r.id === requestId ? updatedRequest : r)
        }), ['page']);
    } catch(error) {
        alert("Failed to approve join request.");
    }
}

export async function handleRejectJoinRequest(requestId: string) {
    try {
        const [updatedRequest] = await apiPut('workspace_join_requests', { id: requestId, status: 'rejected' });
        setState(prevState => ({
            workspaceJoinRequests: prevState.workspaceJoinRequests.map(r => r.id === requestId ? updatedRequest : r)
        }), ['page']);
    } catch(error) {
        alert("Failed to reject join request.");
    }
}

export async function handleInviteUser(email: string, role: Role) {
    const state = getState();
    if (!state.activeWorkspaceId || !state.currentUser) return;
    
    const user = state.users.find(u => u.email === email);
    if (!user) {
        alert(`User with email ${email} not found. Please ask them to sign up first.`);
        return;
    }

    const isAlreadyMember = state.workspaceMembers.some(m => m.userId === user.id && m.workspaceId === state.activeWorkspaceId);
    if (isAlreadyMember) {
        alert("This user is already a member of this workspace.");
        return;
    }

    try {
        const [newMember] = await apiPost('workspace_members', {
            workspaceId: state.activeWorkspaceId,
            userId: user.id,
            role: role,
        });
        setState({ workspaceMembers: [...state.workspaceMembers, newMember] }, ['page']);
    } catch (error) {
        alert("Failed to invite user.");
    }
}

export async function handleChangeUserRole(memberId: string, newRole: Role) {
    const state = getState();
    const member = state.workspaceMembers.find(m => m.id === memberId);
    if (!member) return;
    
    const originalRole = member.role;
    if (originalRole === newRole) return;
    
    const updatedMembers = state.workspaceMembers.map(m => m.id === memberId ? { ...m, role: newRole } : m);
    setState({ workspaceMembers: updatedMembers }, ['page']);

    try {
        await apiPut('workspace_members', { id: memberId, role: newRole });
    } catch (error) {
        console.error("Failed to update user role:", error);
        const revertedMembers = state.workspaceMembers.map(m => m.id === memberId ? { ...m, role: originalRole } : m);
        setState({ workspaceMembers: revertedMembers }, ['page']);
        alert("Failed to update user role.");
    }
}

export async function handleRemoveUserFromWorkspace(memberId: string) {
    const state = getState();
    const memberIndex = state.workspaceMembers.findIndex(m => m.id === memberId);
    if (memberIndex === -1) return;

    const memberToRemove = state.workspaceMembers[memberIndex];
    if (memberToRemove.role === 'owner') {
        const ownerCount = state.workspaceMembers.filter(m => m.workspaceId === memberToRemove.workspaceId && m.role === 'owner').length;
        if (ownerCount <= 1) {
            alert(t('hr.cannot_remove_owner'));
            return;
        }
    }
    
    const originalMembers = [...state.workspaceMembers];
    const updatedMembers = originalMembers.filter(m => m.id !== memberId);
    setState({ workspaceMembers: updatedMembers }, ['page']);
    
    try {
        await apiFetch('/api?action=data&resource=workspace_members', {
            method: 'DELETE',
            body: JSON.stringify({ id: memberId }),
        });
    } catch(error) {
        setState({ workspaceMembers: originalMembers }, ['page']);
        alert("Failed to remove user.");
    }
}

export async function handleSaveWorkspaceSettings() {
    const state = getState();
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!workspace) return;

    const form = document.getElementById('workspace-settings-form');
    if (!form) return;

    const workspacePayload = {
        id: workspace.id,
        companyName: (form.querySelector('#companyName') as HTMLInputElement).value,
        companyAddress: (form.querySelector('#companyAddress') as HTMLTextAreaElement).value,
        companyVatId: (form.querySelector('#companyVatId') as HTMLInputElement).value,
        companyEmail: (form.querySelector('#companyEmail') as HTMLInputElement).value,
        companyBankName: (form.querySelector('#companyBankName') as HTMLInputElement).value,
        companyBankAccount: (form.querySelector('#companyBankAccount') as HTMLInputElement).value,
        companyLogo: workspace.companyLogo,
    };

    try {
        const [updatedWorkspaceApi] = await apiPut('workspaces', workspacePayload);

        const updatedWorkspace: Workspace = {
            ...workspace,
            ...updatedWorkspaceApi,
            subscription: {
                planId: updatedWorkspaceApi.subscriptionPlanId,
                status: updatedWorkspaceApi.subscriptionStatus,
            },
            planHistory: updatedWorkspaceApi.planHistory || [],
        };
        
        const updatedWorkspaces = state.workspaces.map(w => w.id === workspace.id ? updatedWorkspace : w);
        setState({ workspaces: updatedWorkspaces }, ['page']);

        const statusEl = document.getElementById('workspace-save-status');
        if (statusEl) {
            statusEl.textContent = t('panels.saved');
            setTimeout(() => {
                const currentStatusEl = document.getElementById('workspace-save-status');
                if (currentStatusEl) currentStatusEl.textContent = '';
            }, 2000);
        }
    } catch (error) {
        console.error("Failed to save workspace settings:", error);
        alert("Failed to save settings. Please try again.");
    }
}

export async function handleUpdateEmployeeNotes(userId: string, contractNotes: string, employmentNotes: string) {
    const state = getState();
    const user = state.users.find(u => u.id === userId);
    if (user) {
        const payload = {
            id: userId,
            contractInfoNotes: contractNotes,
            employmentInfoNotes: employmentNotes,
        };
        try {
            const [updatedProfile] = await apiPut('profiles', payload);
            const updatedUsers = state.users.map(u => u.id === userId ? { ...u, ...updatedProfile } : u);
            setState({ users: updatedUsers }, ['page']);
            closeModal();
        } catch (error) {
            console.error("Failed to update employee notes:", error);
            alert((error as Error).message);
        }
    }
}

export async function handleUpdateEmployeeManager(userId: string, managerId: string) {
    const state = getState();
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    const originalManagerId = user.managerId;
    const updatedUsers = state.users.map(u => u.id === userId ? { ...u, managerId: managerId || undefined } : u);
    setState({ users: updatedUsers }, ['page']);

    try {
        await apiPut('profiles', { id: userId, managerId: managerId || null });
    } catch (error) {
        console.error("Failed to update employee manager:", error);
        alert((error as Error).message);
        const revertedUsers = state.users.map(u => u.id === userId ? { ...u, managerId: originalManagerId } : u);
        setState({ users: revertedUsers }, ['page']);
    }
}

export async function handleSubmitTimeOffRequest(type: 'vacation' | 'sick_leave' | 'other', startDate: string, endDate: string) {
    const state = getState();
    if (!state.currentUser || !state.activeWorkspaceId) return;

    const newRequestPayload: Omit<TimeOffRequest, 'id'|'createdAt'> = {
        workspaceId: state.activeWorkspaceId,
        userId: state.currentUser.id,
        type,
        startDate,
        endDate,
        status: 'pending',
    };

    try {
        const [savedRequest] = await apiPost('time_off_requests', newRequestPayload);
        setState({ timeOffRequests: [...state.timeOffRequests, savedRequest] }, ['page']);
        closeModal();

        const requester = state.currentUser;
        const managerId = requester.managerId;
        
        let userIdsToNotify: string[] = [];

        if (managerId) {
            const managerExists = state.workspaceMembers.some(m => m.workspaceId === state.activeWorkspaceId && m.userId === managerId);
            if (managerExists) {
                userIdsToNotify.push(managerId);
            }
        }
        
        if (userIdsToNotify.length === 0) {
            const adminsAndOwners = state.workspaceMembers
                .filter(m => m.workspaceId === state.activeWorkspaceId && (m.role === 'admin' || m.role === 'owner'))
                .map(m => m.userId);
            userIdsToNotify.push(...adminsAndOwners);
        }

        const notificationPromises = userIdsToNotify
            .filter(id => id !== requester.id) // Don't notify the user about their own request
            .map(userId => 
                createNotification('time_off_request', {
                    userIdToNotify: userId,
                    actorId: requester.id,
                    workspaceId: state.activeWorkspaceId!
                })
            );
        
        await Promise.all(notificationPromises);

    } catch(error) {
        alert("Failed to submit time off request.");
    }
}

export async function handleApproveTimeOffRequest(requestId: string) {
    const state = getState();
    const request = state.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        const originalStatus = request.status;
        const updatedRequests = state.timeOffRequests.map(r => r.id === requestId ? { ...r, status: 'approved' as const } : r);
        setState({ timeOffRequests: updatedRequests }, ['page']);
        try {
            await apiPut('time_off_requests', { id: requestId, status: 'approved' });
        } catch(error) {
            const revertedRequests = state.timeOffRequests.map(r => r.id === requestId ? { ...r, status: originalStatus } : r);
            setState({ timeOffRequests: revertedRequests }, ['page']);
            alert("Failed to approve request.");
        }
    }
}

export async function handleRejectTimeOffRequest(requestId: string, reason: string) {
    const state = getState();
    const request = state.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        const originalStatus = request.status;
        const updatedRequest = { ...request, status: 'rejected' as const, rejectionReason: reason };
        const updatedRequests = state.timeOffRequests.map(r => r.id === requestId ? updatedRequest : r);
        
        try {
            await apiPut('time_off_requests', { id: requestId, status: 'rejected', rejectionReason: reason });
            setState({ timeOffRequests: updatedRequests }, ['page']);
            closeModal();
        } catch(error) {
            alert("Failed to reject request.");
        }
    }
}

export async function handleSetVacationAllowance(userId: string, hours: number) {
    const state = getState();
    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    
    const originalAllowance = user.vacationAllowanceHours;
    const updatedUsers = state.users.map(u => u.id === userId ? { ...u, vacationAllowanceHours: hours } : u);
    setState({ users: updatedUsers }, ['page']);
    closeModal();
    
    try {
        await apiPut('profiles', { id: userId, vacationAllowanceHours: hours });
    } catch (error) {
        console.error("Failed to update vacation allowance:", error);
        alert("Could not save vacation allowance. Please try again.");
        const revertedUsers = state.users.map(u => u.id === userId ? { ...u, vacationAllowanceHours: originalAllowance } : u);
        setState({ users: revertedUsers }, ['page']);
    }
}

export async function handleChangeProjectMemberRole(projectMemberId: string, newRole: ProjectRole) {
    const state = getState();
    const member = state.projectMembers.find(pm => pm.id === projectMemberId);
    if (!member) return;

    const originalRole = member.role;
    const updatedMembers = state.projectMembers.map(pm => pm.id === projectMemberId ? { ...pm, role: newRole } : pm);
    setState({ projectMembers: updatedMembers }, ['side-panel']);

    try {
        await apiPut('project_members', { id: projectMemberId, role: newRole });
    } catch (error) {
        console.error("Failed to change project member role:", error);
        const revertedMembers = state.projectMembers.map(pm => pm.id === projectMemberId ? { ...pm, role: originalRole } : pm);
        setState({ projectMembers: revertedMembers }, ['side-panel']);
        alert("Could not update member role.");
    }
}

export async function handleAddMemberToProject(projectId: string, userId: string, role: ProjectRole) {
    const state = getState();
    if (!projectId || !userId || !role) {
        alert("Please select a member and a role.");
        return;
    }

    const project = state.projects.find(p => p.id === projectId);
    if (!project) {
        console.error("Could not find project to add member to.");
        alert("An error occurred: Project not found.");
        return;
    }

    const newMemberPayload: Omit<ProjectMember, 'id'> = {
        projectId,
        userId,
        role,
    };

    try {
        const [savedMember] = await apiPost('project_members', newMemberPayload);
        setState({ projectMembers: [...state.projectMembers, savedMember] }, ['side-panel']);
    } catch (error) {
        console.error("Failed to add member to project:", error);
        alert("Could not add member to project.");
    }
}
