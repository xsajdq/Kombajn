import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { Role, WorkspaceMember, User, Workspace, TimeOffRequest, ProjectMember, WorkspaceJoinRequest, ProjectRole } from '../types.ts';
import { closeSidePanels, closeModal, showModal } from './ui.ts';
import { getUsage, PLANS } from '../utils.ts';
import { t } from '../i18n.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { createNotification } from './notifications.ts';
import { switchWorkspaceChannel, supabase } from '../services/supabase.ts';
import { startOnboarding } from './onboarding.ts';
import { bootstrapApp } from '../index.tsx';

export async function handleWorkspaceSwitch(workspaceId: string) {
    if (state.activeWorkspaceId !== workspaceId) {
        state.activeWorkspaceId = workspaceId;
        localStorage.setItem('activeWorkspaceId', workspaceId);

        // Reset loaded status for all pages to force refetch
        Object.keys(state.ui).forEach(key => {
            const pageState = (state.ui as any)[key];
            if (pageState && typeof pageState === 'object' && 'loadedWorkspaceId' in pageState) {
                pageState.loadedWorkspaceId = null;
            }
        });

        closeSidePanels(false);
        state.currentPage = 'dashboard';
        history.pushState({}, '', '/dashboard');

        await switchWorkspaceChannel(workspaceId);

        // Re-bootstrap the workspace data only
        const session = await supabase?.auth.getSession();
        if (session?.data.session) {
             // A "soft" bootstrap, only for the new workspace data
             await bootstrapApp(session.data.session);
        }
    }
}


export async function handleCreateWorkspace(name: string) {
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

    updateUI(['page']);
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
        updateUI(['page']);
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
        updateUI(['page']);
    } catch(error) {
        alert("Failed to reject join request.");
    }
}

export async function handleInviteUser(email: string, role: Role) {
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
        state.workspaceMembers.push(newMember);
        updateUI(['page']);
    } catch (error) {
        alert("Failed to invite user.");
    }
}

export async function handleChangeUserRole(memberId: string, newRole: Role) {
    const member = state.workspaceMembers.find(m => m.id === memberId);
    if (!member) return;
    
    const originalRole = member.role;
    if (originalRole === newRole) return;
    
    member.role = newRole; 
    updateUI(['page']);

    try {
        await apiPut('workspace_members', { id: memberId, role: newRole });
    } catch (error) {
        console.error("Failed to update user role:", error);
        member.role = originalRole; 
        updateUI(['page']);
        alert("Failed to update user role.");
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
    updateUI(['page']);
    
    try {
        await apiFetch('/api?action=data&resource=workspace_members', {
            method: 'DELETE',
            body: JSON.stringify({ id: memberId }),
        });
    } catch(error) {
        state.workspaceMembers.splice(memberIndex, 0, removedMember);
        updateUI(['page']);
        alert("Failed to remove user.");
    }
}

export async function handleSaveWorkspaceSettings() {
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
        const [updatedWorkspace] = await apiPut('workspaces', workspacePayload);

        const index = state.workspaces.findIndex(w => w.id === workspace.id);
        if (index !== -1) {
            state.workspaces[index] = {
                ...state.workspaces[index],
                ...updatedWorkspace,
                subscription: {
                    planId: updatedWorkspace.subscriptionPlanId,
                    status: updatedWorkspace.subscriptionStatus,
                },
                planHistory: updatedWorkspace.planHistory || [],
            };
        }

        updateUI(['page']);

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

export function handleSwitchHrTab(tab: 'employees' | 'requests' | 'vacation' | 'history' | 'reviews') {
    state.ui.hr.activeTab = tab;
    updateUI(['page']);
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
            updateUI(['page']);
        } catch (error) {
            console.error("Failed to update employee notes:", error);
            alert((error as Error).message);
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
        updateUI(['page']);
        try {
            await apiPut('time_off_requests', { id: requestId, status: 'approved' });
        } catch(error) {
            request.status = originalStatus;
            updateUI(['page']);
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
            closeModal();
        } catch(error) {
            request.status = originalStatus;
            delete request.rejectionReason;
            alert("Failed to reject request.");
        } finally {
            updateUI(['page']);
        }
    }
}

export async function handleSetVacationAllowance(userId: string, hours: number) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    
    const originalAllowance = user.vacationAllowanceHours;
    user.vacationAllowanceHours = hours;
    closeModal();
    updateUI(['page']);
    
    try {
        await apiPut('profiles', { id: userId, vacationAllowanceHours: hours });
    } catch (error) {
        console.error("Failed to update vacation allowance:", error);
        alert("Could not save vacation allowance. Please try again.");
        user.vacationAllowanceHours = originalAllowance;
        updateUI(['page']);
    }
}

export async function handleRemoveUserFromProject(projectMemberId: string) {
    const memberIndex = state.projectMembers.findIndex(pm => pm.id === projectMemberId);
    if (memberIndex === -1) return;
    
    const [removedMember] = state.projectMembers.splice(memberIndex, 1);
    updateUI(['side-panel']);
    
    try {
        await apiFetch('/api?action=data&resource=project_members', {
            method: 'DELETE',
            body: JSON.stringify({ id: projectMemberId }),
        });
    } catch(error) {
        state.projectMembers.splice(memberIndex, 0, removedMember);
        updateUI(['side-panel']);
        alert("Failed to remove user from project.");
    }
}

export async function handleChangeProjectMemberRole(projectMemberId: string, newRole: ProjectRole) {
    const member = state.projectMembers.find(pm => pm.id === projectMemberId);
    if (!member) return;

    const originalRole = member.role;
    member.role = newRole;
    updateUI(['side-panel']);

    try {
        await apiPut('project_members', { id: projectMemberId, role: newRole });
    } catch (error) {
        console.error("Failed to change project member role:", error);
        member.role = originalRole;
        updateUI(['side-panel']);
        alert("Could not update member role.");
    }
}

export async function handleAddMemberToProject(projectId: string, userId: string, role: ProjectRole) {
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
        state.projectMembers.push(savedMember);
        updateUI(['side-panel']);
    } catch (error) {
        console.error("Failed to add member to project:", error);
        alert("Could not add member to project.");
    }
}