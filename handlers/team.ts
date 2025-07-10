



import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Role, WorkspaceMember, User, Workspace, TimeOffRequest, ProjectMember, WorkspaceJoinRequest } from '../types.ts';
import { closeSidePanels, closeModal } from './ui.ts';
import { getUsage, PLANS } from '../utils.ts';
import { t } from '../i18n.ts';
import { apiPost, apiPut } from '../services/api.ts';
import { createNotification } from './notifications.ts';
import { subscribeToRealtimeUpdates } from '../services/supabase.ts';
import { startOnboarding } from './onboarding.ts';

export function handleWorkspaceSwitch(workspaceId: string) {
    if (state.activeWorkspaceId !== workspaceId) {
        state.activeWorkspaceId = workspaceId;
        localStorage.setItem('activeWorkspaceId', workspaceId);
        closeSidePanels(false);
        state.currentPage = 'dashboard';
        window.location.hash = '#/dashboard';
        renderApp();
        // Re-subscribe to realtime channels for the new workspace context
        subscribeToRealtimeUpdates();
    }
}


export async function handleCreateWorkspace(name: string) {
    if (!state.currentUser) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
        alert("Workspace name cannot be empty.");
        return;
    }

    const existingWorkspace = state.workspaces.find(w => w.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingWorkspace) {
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
        
        const memberPayload = { workspaceId: newWorkspaceRaw.id, userId: state.currentUser.id, role: 'owner' as const };
        const [newMember] = await apiPost('workspace_members', memberPayload);

        const newWorkspace: Workspace = {
            ...newWorkspaceRaw,
            subscription: {
                planId: newWorkspaceRaw.subscriptionPlanId,
                status: newWorkspaceRaw.subscriptionStatus
            },
            planHistory: newWorkspaceRaw.planHistory || []
        };
        state.workspaces.push(newWorkspace);

        state.workspaceMembers.push(newMember);

        state.activeWorkspaceId = newWorkspace.id;
        state.currentPage = 'dashboard';
        localStorage.setItem('activeWorkspaceId', newWorkspace.id);
        window.location.hash = '#/dashboard';
        
        renderApp();

        // Start onboarding for the first workspace
        startOnboarding();

    } catch (error) {
        console.error("Failed to create workspace:", error);
        alert((error as Error).message);
    }
}

export async function handleRequestToJoinWorkspace(workspaceName: string) {
    if (!state.currentUser) return;
    
    const targetWorkspace = state.workspaces.find(w => w.name.toLowerCase() === workspaceName.toLowerCase());
    
    if (!targetWorkspace) {
        alert(`Workspace "${workspaceName}" not found.`);
        return;
    }
    
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
    state.workspaceJoinRequests.push(newRequest);

    const owners = state.workspaceMembers.filter(m => m.workspaceId === targetWorkspace.id && m.role === 'owner');
    owners.forEach(owner => {
        createNotification('join_request', {
            userIdToNotify: owner.userId,
            actorId: state.currentUser!.id,
            workspaceId: targetWorkspace.id,
            workspaceName: targetWorkspace.name
        });
    });

    renderApp();
}

export async function handleApproveJoinRequest(requestId: string) {
    const request = state.workspaceJoinRequests.find(r => r.id === requestId);
    if (!request) return;

    try {
        const [newMember] = await apiPost('workspace_members', {
            workspaceId: request.workspaceId,
            userId: request.userId,
            role: 'member'
        });

        const [updatedRequest] = await apiPut('workspace_join_requests', { id: request.id, status: 'approved' });

        state.workspaceMembers.push(newMember);
        const reqIndex = state.workspaceJoinRequests.findIndex(r => r.id === requestId);
        if (reqIndex > -1) {
            state.workspaceJoinRequests[reqIndex] = updatedRequest;
        }
        renderApp();
    } catch(error) {
        alert("Failed to approve join request.");
    }
}

export async function handleRejectJoinRequest(requestId: string) {
    try {
        const [updatedRequest] = await apiPut('workspace_join_requests', { id: requestId, status: 'rejected' });
        const reqIndex = state.workspaceJoinRequests.findIndex(r => r.id === requestId);
        if (reqIndex > -1) {
            state.workspaceJoinRequests[reqIndex] = updatedRequest;
        }
        renderApp();
    } catch(error) {
        alert("Failed to reject join request.");
    }
}

export async function handleInviteUser(email: string, role: Role) {
    if (!state.activeWorkspaceId || !state.currentUser) return;
    
    // This is a simplified invite. A real system would send an email.
    // Here we assume the user exists or will be created. We just create the membership.
    // For simplicity, we can't create a profile for a non-existent user here.
    // This part of the logic remains a simplified local representation.
    // A better approach would be an API endpoint that handles the invitation logic.
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
            role,
        });
        state.workspaceMembers.push(newMember);
        renderApp();
    } catch (error) {
        alert("Failed to invite user.");
    }
}

export async function handleChangeUserRole(memberId: string, newRole: Role) {
    const member = state.workspaceMembers.find(m => m.id === memberId);
    if (member) {
        const originalRole = member.role;
        member.role = newRole;
        renderApp();
        try {
            await apiPut('workspace_members', { id: memberId, role: newRole });
        } catch(error) {
            member.role = originalRole;
            renderApp();
            alert("Failed to change user role.");
        }
    }
}

export async function handleRemoveUserFromWorkspace(memberId: string) {
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
    
    const [removedMember] = state.workspaceMembers.splice(memberIndex, 1);
    renderApp();
    
    try {
        await apiPost('workspace_members/delete', { id: memberId });
    } catch(error) {
        state.workspaceMembers.splice(memberIndex, 0, removedMember);
        renderApp();
        alert("Failed to remove user.");
    }
}

export async function handleSaveWorkspaceSettings() {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!workspace) return;

    const payload = {
        id: workspace.id,
        name: workspace.name,
        companyName: workspace.companyName,
        companyAddress: workspace.companyAddress,
        companyVatId: workspace.companyVatId,
        companyBankName: workspace.companyBankName,
        companyBankAccount: workspace.companyBankAccount,
        companyLogo: workspace.companyLogo,
        companyEmail: workspace.companyEmail,
    };

    try {
        const [updatedWorkspace] = await apiPut('workspaces', payload);
        const index = state.workspaces.findIndex(w => w.id === workspace.id);
        if (index !== -1) {
            state.workspaces[index] = {
                ...state.workspaces[index],
                ...updatedWorkspace,
                subscription: {
                    planId: updatedWorkspace.subscriptionPlanId,
                    status: updatedWorkspace.subscriptionStatus
                },
                planHistory: updatedWorkspace.planHistory || []
            };
        }
        renderApp();

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


export function handleSwitchHrTab(tab: 'employees' | 'requests' | 'history' | 'reviews') {
    state.ui.hr.activeTab = tab;
    renderApp();
}

export async function handleUpdateEmployeeNotes(userId: string, contractNotes: string, employmentNotes: string) {
    const user = state.users.find(u => u.id === userId);
    if (user) {
        const payload = {
            id: userId,
            contractInfoNotes: contractNotes,
            employmentInfoNotes: employmentNotes,
        };
        try {
            const [updatedProfile] = await apiPut('profiles', payload);
            const index = state.users.findIndex(u => u.id === userId);
            if (index !== -1) {
                state.users[index] = { ...state.users[index], ...updatedProfile };
            }
            closeModal();
        } catch (error) {
            console.error("Failed to update employee notes:", error);
            alert(`Error: ${(error as Error).message}`);
        }
    }
}


export async function handleSubmitTimeOffRequest(type: 'vacation' | 'sick_leave' | 'other', startDate: string, endDate: string) {
    if (!state.currentUser || !state.activeWorkspaceId) return;

    const newRequestPayload: Omit<TimeOffRequest, 'id'|'createdAt'|'status'> = {
        workspaceId: state.activeWorkspaceId,
        userId: state.currentUser.id,
        type,
        startDate,
        endDate,
    };

    try {
        const [savedRequest] = await apiPost('time_off_requests', newRequestPayload);
        state.timeOffRequests.push(savedRequest);
        closeModal();
    } catch(error) {
        alert("Failed to submit time off request.");
    }
}

export async function handleApproveTimeOffRequest(requestId: string) {
    const request = state.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        const originalStatus = request.status;
        request.status = 'approved';
        renderApp();
        try {
            await apiPut('time_off_requests', { id: requestId, status: 'approved' });
        } catch(error) {
            request.status = originalStatus;
            renderApp();
            alert("Failed to approve request.");
        }
    }
}

export async function handleRejectTimeOffRequest(requestId: string, reason: string) {
    const request = state.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        const originalStatus = request.status;
        request.status = 'rejected';
        request.rejectionReason = reason;
        
        try {
            await apiPut('time_off_requests', { id: requestId, status: 'rejected', rejectionReason: reason });
            closeModal(); // Success, close modal
        } catch(error) {
            request.status = originalStatus;
            delete request.rejectionReason;
            alert("Failed to reject request.");
        } finally {
            renderApp();
        }
    }
}

export async function handleRemoveUserFromProject(projectMemberId: string) {
    const memberIndex = state.projectMembers.findIndex(pm => pm.id === projectMemberId);
    if (memberIndex === -1) return;
    
    const [removedMember] = state.projectMembers.splice(memberIndex, 1);
    renderApp();
    
    try {
        await apiPost('project_members/delete', { id: projectMemberId });
    } catch(error) {
        state.projectMembers.splice(memberIndex, 0, removedMember);
        renderApp();
        alert("Failed to remove user from project.");
    }
}
