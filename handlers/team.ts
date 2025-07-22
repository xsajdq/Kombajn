

import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Role, WorkspaceMember, User, Workspace, TimeOffRequest, ProjectMember, WorkspaceJoinRequest, ProjectRole } from '../types.ts';
import { closeSidePanels, closeModal } from './ui.ts';
import { getUsage, PLANS } from '../utils.ts';
import { t } from '../i18n.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import { createNotification } from './notifications.ts';
import { switchWorkspaceChannel } from '../services/supabase.ts';
import { startOnboarding } from './onboarding.ts';

export async function handleWorkspaceSwitch(workspaceId: string) {
    if (state.activeWorkspaceId !== workspaceId) {
        state.activeWorkspaceId = workspaceId;
        localStorage.setItem('activeWorkspaceId', workspaceId);

        // Clear page-specific data to force a reload on the new workspace's pages
        state.projects = [];
        state.tasks = [];
        state.clients = [];
        state.deals = [];
        state.timeLogs = [];
        state.comments = [];
        state.projectMembers = [];
        state.taskAssignees = [];
        state.ui.dashboard.loadedWorkspaceId = null;
        // etc...

        closeSidePanels(false);
        state.currentPage = 'dashboard';
        history.pushState({}, '', '/dashboard');

        // Switch the realtime channel BEFORE rendering
        await switchWorkspaceChannel(workspaceId);

        await renderApp();
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

        state.activeWorkspaceId = newWorkspace.id;
        state.currentPage = 'dashboard';
        localStorage.setItem('activeWorkspaceId', newWorkspace.id);
        history.pushState({}, '', '/dashboard');
        
        // Switch to the new channel
        await switchWorkspaceChannel(newWorkspace.id);
        
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
        renderApp();
    } catch (error) {
        alert("Failed to invite user.");
    }
}

export async function handleChangeUserRole(memberId: string, newRole: Role) {
    const member = state.workspaceMembers.find(m => m.id === memberId);
    if (!member) return;
    
    const originalRole = member.role;
    if (originalRole === newRole) return;
    
    member.role = newRole; // Optimistic update
    renderApp();

    try {
        await apiPut('workspace_members', { id: memberId, role: newRole });
    } catch (error) {
        console.error("Failed to update user role:", error);
        member.role = originalRole; // Revert
        renderApp();
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
    renderApp();
    
    try {
        await apiFetch('/api/data/workspace_members', {
            method: 'DELETE',
            body: JSON.stringify({ id: memberId }),
        });
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

export function handleSwitchHrTab(tab: 'employees' | 'requests' | 'vacation' | 'history' | 'reviews') {
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

export async function handleSetVacationAllowance(userId: string, hours: number) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    
    const originalAllowance = user.vacationAllowanceHours;
    
    // Optimistic update
    user.vacationAllowanceHours = hours;
    closeModal();
    
    try {
        await apiPut('profiles', { id: userId, vacationAllowanceHours: hours });
    } catch (error) {
        console.error("Failed to update vacation allowance:", error);
        alert("Could not save vacation allowance. Please try again.");
        // Revert on failure
        user.vacationAllowanceHours = originalAllowance;
        renderApp();
    }
}

export async function handleRemoveUserFromProject(projectMemberId: string) {
    const memberIndex = state.projectMembers.findIndex(pm => pm.id === projectMemberId);
    if (memberIndex === -1) return;
    
    const [removedMember] = state.projectMembers.splice(memberIndex, 1);
    renderApp();
    
    try {
        await apiFetch('/api/data/project_members', {
            method: 'DELETE',
            body: JSON.stringify({ id: projectMemberId }),
        });
    } catch(error) {
        state.projectMembers.splice(memberIndex, 0, removedMember);
        renderApp();
        alert("Failed to remove user from project.");
    }
}

export async function handleChangeProjectMemberRole(projectMemberId: string, newRole: ProjectRole) {
    const member = state.projectMembers.find(pm => pm.id === projectMemberId);
    if (!member) return;

    const originalRole = member.role;
    member.role = newRole; // Optimistic update
    renderApp();

    try {
        await apiPut('project_members', { id: projectMemberId, role: newRole });
    } catch (error) {
        console.error("Failed to change project member role:", error);
        member.role = originalRole; // Revert
        renderApp();
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
        renderApp(); // This will re-render the access tab with the new member
    } catch (error) {
        console.error("Failed to add member to project:", error);
        alert("Could not add member to project.");
    }
}