


import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Role, WorkspaceMember, User, Workspace, TimeOffRequest, ProjectMember, WorkspaceJoinRequest } from '../types.ts';
import { closeSidePanels, closeModal } from './ui.ts';
import { getUsage, PLANS } from '../utils.ts';
import { t } from '../i18n.ts';
import { apiPost, apiPut } from '../services/api.ts';
import { createNotification } from './notifications.ts';

export function handleWorkspaceSwitch(workspaceId: string) {
    if (state.activeWorkspaceId !== workspaceId) {
        state.activeWorkspaceId = workspaceId;
        localStorage.setItem('activeWorkspaceId', workspaceId); // Save for next session
        closeSidePanels(false); // Close panels without re-rendering immediately
        state.currentPage = 'dashboard'; // Default to dashboard on switch
        window.location.hash = '#/dashboard'; // Update URL
        renderApp(); // Now re-render the whole app
    }
}


export async function handleCreateWorkspace(name: string) {
    if (!state.currentUser) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
        alert("Workspace name cannot be empty.");
        return;
    }

    // Client-side check for unique name
    const existingWorkspace = state.workspaces.find(w => w.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingWorkspace) {
        alert(t('hr.workspace_name_exists'));
        return;
    }
    
    // Check plan limits
    const ownedWorkspacesCount = state.workspaces.filter(w =>
        state.workspaceMembers.some(m => m.workspaceId === w.id && m.userId === state.currentUser!.id && m.role === 'owner')
    ).length;
    // Use the 'free' plan limits if the user has no workspaces yet.
    const currentPlanId = state.activeWorkspaceId ? state.workspaces.find(w => w.id === state.activeWorkspaceId)!.subscription.planId : 'free';
    const planLimits = PLANS[currentPlanId];

    if (ownedWorkspacesCount >= planLimits.workspaces) {
        alert(t('hr.workspace_limit_reached'));
        return;
    }


    try {
        const workspacePayload = {
            name: trimmedName,
            subscription_plan_id: 'free',
            subscription_status: 'active'
        };
        
        // 1. Create the workspace
        const [newWorkspaceRaw] = await apiPost('workspaces', workspacePayload);
        
        // 2. Create the membership, making the current user the owner
        const memberPayload = { workspace_id: newWorkspaceRaw.id, user_id: state.currentUser.id, role: 'owner' as const };
        const [newMemberRaw] = await apiPost('workspace_members', memberPayload);

        // --- Optimistic UI Update ---
        // Instead of a full bootstrap, we add the new data directly to the state.
        
        // 3. Transform new workspace data and add it
        const newWorkspace: Workspace = {
            ...newWorkspaceRaw,
            subscription: {
                planId: newWorkspaceRaw.subscription_plan_id,
                status: newWorkspaceRaw.subscription_status
            },
            planHistory: newWorkspaceRaw.planHistory || []
        };
        state.workspaces.push(newWorkspace);

        // 4. Add the new membership to the state
        const newMember: WorkspaceMember = {
            id: newMemberRaw.id,
            workspaceId: newMemberRaw.workspace_id,
            userId: newMemberRaw.user_id,
            role: newMemberRaw.role,
        };
        state.workspaceMembers.push(newMember);

        // 5. Set the new workspace as active and navigate to the dashboard
        state.activeWorkspaceId = newWorkspace.id;
        state.currentPage = 'dashboard';
        localStorage.setItem('activeWorkspaceId', newWorkspace.id);
        window.location.hash = '#/dashboard';
        
        // 6. Render the app with the complete, updated state
        renderApp();

    } catch (error) {
        console.error("Failed to create workspace:", error);
        alert((error as Error).message);
    }
}

export async function handleRequestToJoinWorkspace(workspaceName: string) {
    if (!state.currentUser) return;
    
    // The client has all workspaces, so we can find the ID here.
    // In a larger app, this would be an API call to a dedicated endpoint.
    const targetWorkspace = state.workspaces.find(w => w.name.toLowerCase() === workspaceName.toLowerCase());
    
    if (!targetWorkspace) {
        alert(`Workspace "${workspaceName}" not found.`);
        return;
    }
    
    // Check if user is already a member
    const isMember = state.workspaceMembers.some(m => m.workspaceId === targetWorkspace.id && m.userId === state.currentUser.id);
    if (isMember) {
        alert("You are already a member of this workspace.");
        return;
    }

    // Check for existing pending request
    const hasPendingRequest = state.workspaceJoinRequests.some(r => r.workspaceId === targetWorkspace.id && r.userId === state.currentUser!.id && r.status === 'pending');
    if (hasPendingRequest) {
        alert("You already have a pending request to join this workspace.");
        return;
    }

    const [newRequest] = await apiPost('workspace_join_requests', { workspace_id: targetWorkspace.id, user_id: state.currentUser.id, status: 'pending' });
    state.workspaceJoinRequests.push(newRequest);

    // Notify all owners of the target workspace
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

    // 1. Add user to workspace members
    const [newMember] = await apiPost('workspace_members', {
        workspace_id: request.workspaceId,
        user_id: request.userId,
        role: 'member' // Default role for approved users
    });

    // 2. Update the request status to 'approved'
    const [updatedRequest] = await apiPut('workspace_join_requests', { id: request.id, status: 'approved' });

    // 3. Update local state
    state.workspaceMembers.push(newMember);
    const reqIndex = state.workspaceJoinRequests.findIndex(r => r.id === requestId);
    if (reqIndex > -1) {
        state.workspaceJoinRequests[reqIndex] = updatedRequest;
    }
    renderApp();
}

export async function handleRejectJoinRequest(requestId: string) {
    const [updatedRequest] = await apiPut('workspace_join_requests', { id: requestId, status: 'rejected' });
    const reqIndex = state.workspaceJoinRequests.findIndex(r => r.id === requestId);
    if (reqIndex > -1) {
        state.workspaceJoinRequests[reqIndex] = updatedRequest;
    }
    renderApp();
}

export function handleInviteUser(email: string, role: Role) {
    if (!state.activeWorkspaceId) return;
    
    // Check limits before inviting
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!workspace) return;
    const usage = getUsage(workspace.id);
    const planLimits = PLANS[workspace.subscription.planId];
    if (usage.users >= planLimits.users) {
        alert(t('billing.limit_reached_users').replace('{planName}', workspace.subscription.planId));
        return;
    }
    
    // Find or create a user in the global user list
    let user = state.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        const namePart = email.split('@')[0];
        user = {
            id: generateId(),
            email: email.toLowerCase(),
            initials: namePart.substring(0, 2).toUpperCase(),
        };
        state.users.push(user);
    }
    
    // Check if user is already a member of this workspace
    const isAlreadyMember = state.workspaceMembers.some(m => m.userId === user!.id && m.workspaceId === state.activeWorkspaceId);
    if (isAlreadyMember) {
        alert("This user is already a member of this workspace.");
        return;
    }

    const newMember: WorkspaceMember = {
        id: generateId(),
        workspaceId: state.activeWorkspaceId,
        userId: user.id,
        role,
    };
    state.workspaceMembers.push(newMember);
    saveState();
    renderApp();
}

export function handleChangeUserRole(memberId: string, newRole: Role) {
    const member = state.workspaceMembers.find(m => m.id === memberId);
    if (member) {
        member.role = newRole;
        saveState();
        renderApp();
    }
}

export function handleRemoveUserFromWorkspace(memberId: string) {
    const memberToRemove = state.workspaceMembers.find(m => m.id === memberId);
    if (!memberToRemove) return;

    // Prevent removing the last owner
    if (memberToRemove.role === 'owner') {
        const ownerCount = state.workspaceMembers.filter(m => m.workspaceId === memberToRemove.workspaceId && m.role === 'owner').length;
        if (ownerCount <= 1) {
            alert(t('hr.cannot_remove_owner'));
            return;
        }
    }
    
    state.workspaceMembers = state.workspaceMembers.filter(m => m.id !== memberId);
    saveState();
    renderApp();
}

export async function handleSaveWorkspaceSettings() {
    if (!state.activeWorkspaceId) return;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!workspace) return;

    // Transform the frontend model back to the DB model for the PUT request
    const payload = {
        id: workspace.id,
        name: workspace.name,
        company_name: workspace.companyName,
        company_address: workspace.companyAddress,
        company_vat_id: workspace.companyVatId,
        company_bank_name: workspace.companyBankName,
        company_bank_account: workspace.companyBankAccount,
        company_logo: workspace.companyLogo,
        company_email: workspace.companyEmail,
    };

    try {
        const [updatedWorkspaceRaw] = await apiPut('workspaces', payload);
        const index = state.workspaces.findIndex(w => w.id === workspace.id);
        if (index !== -1) {
            // Re-transform the returned data to update local state accurately
            state.workspaces[index] = {
                ...state.workspaces[index], // Preserve other parts of state object
                ...updatedWorkspaceRaw,   // Overwrite with fresh data from DB
                subscription: {           // Re-nest subscription object
                    planId: updatedWorkspaceRaw.subscription_plan_id,
                    status: updatedWorkspaceRaw.subscription_status
                },
                planHistory: updatedWorkspaceRaw.planHistory || []
            };
        }
        renderApp(); // Re-render to show changes (like the logo)
        console.log("Workspace settings saved.");
    } catch (error) {
        console.error("Failed to save workspace settings:", error);
        alert("Failed to save settings. Please try again.");
    }
}


// --- NEW HR HANDLERS ---
export function handleSwitchHrTab(tab: 'employees' | 'requests' | 'history' | 'reviews') {
    state.ui.hr.activeTab = tab;
    renderApp();
}

export function handleUpdateEmployeeNotes(userId: string, contractNotes: string, employmentNotes: string) {
    const user = state.users.find(u => u.id === userId);
    if (user) {
        user.contractInfoNotes = contractNotes;
        user.employmentInfoNotes = employmentNotes;
        closeModal();
    }
}

export function handleSubmitTimeOffRequest(type: 'vacation' | 'sick_leave' | 'other', startDate: string, endDate: string) {
    if (!state.currentUser || !state.activeWorkspaceId) return;

    const newRequest: TimeOffRequest = {
        id: generateId(),
        workspaceId: state.activeWorkspaceId,
        userId: state.currentUser.id,
        type,
        startDate,
        endDate,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };

    state.timeOffRequests.push(newRequest);
    closeModal();
}

export function handleApproveTimeOffRequest(requestId: string) {
    const request = state.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        request.status = 'approved';
        saveState();
        renderApp();
    }
}

export function handleRejectTimeOffRequest(requestId: string, reason: string) {
    const request = state.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        request.status = 'rejected';
        request.rejectionReason = reason;
        // The calling function `handleFormSubmit` will close the modal.
    }
}

export function handleRemoveUserFromProject(projectMemberId: string) {
    state.projectMembers = state.projectMembers.filter(pm => pm.id !== projectMemberId);
    saveState();
    renderApp();
}