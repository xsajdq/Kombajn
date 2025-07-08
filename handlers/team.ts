
import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Role, WorkspaceMember, User, Workspace, TimeOffRequest, ProjectMember } from '../types.ts';
import { closeSidePanels, closeModal } from './ui.ts';
import { getUsage, PLANS } from '../utils.ts';
import { t } from '../i18n.ts';

export function handleWorkspaceSwitch(workspaceId: string) {
    if (state.activeWorkspaceId !== workspaceId) {
        state.activeWorkspaceId = workspaceId;
        closeSidePanels(false);
        saveState();
        renderApp();
    }
}

export function handleCreateWorkspace(name: string) {
    if (!state.currentUser || !state.activeWorkspaceId) return;

    // Validation
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return;

    const ownedWorkspacesCount = state.workspaces.filter(w =>
        state.workspaceMembers.some(m => m.workspaceId === w.id && m.userId === state.currentUser!.id && m.role === 'owner')
    ).length;

    const planLimits = PLANS[activeWorkspace.subscription.planId];
    if (ownedWorkspacesCount >= planLimits.workspaces) {
        alert(t('hr.workspace_limit_reached'));
        return;
    }

    // Create new workspace and membership
    const newWorkspace: Workspace = {
        id: generateId(),
        name,
        // The new workspace inherits the subscription status of the one it was created from
        // This is a simplification; a real app might have more complex logic
        subscription: activeWorkspace.subscription,
        planHistory: [{ planId: activeWorkspace.subscription.planId, date: new Date().toISOString() }],
    };

    const newMembership: WorkspaceMember = {
        id: generateId(),
        workspaceId: newWorkspace.id,
        userId: state.currentUser.id,
        role: 'owner',
    };

    state.workspaces.push(newWorkspace);
    state.workspaceMembers.push(newMembership);

    // Switch to the new workspace
    state.activeWorkspaceId = newWorkspace.id;

    closeSidePanels(false); // Close any open panels
    saveState();
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
    let user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        user = {
            id: generateId(),
            name: email.split('@')[0],
            email: email.toLowerCase(),
            initials: email.substring(0, 2).toUpperCase(),
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