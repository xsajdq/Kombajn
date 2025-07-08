
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate } from '../utils.ts';
import type { Role, User, WorkspaceMember, TimeOffRequest } from '../types.ts';
import { getCurrentUserRole } from '../handlers/main.ts';
import { PLANS } from '../utils.ts';

export function HRPage() {
    const userRole = getCurrentUserRole();
    if (userRole !== 'owner' && userRole !== 'manager') {
        return `<div class="empty-state">
            <span class="material-icons-sharp">lock</span>
            <h3>${t('hr.access_denied')}</h3>
            <p>${t('hr.access_denied_desc')}</p>
        </div>`;
    }

    const { activeTab } = state.ui.hr;

    let tabContent = '';
    switch(activeTab) {
        case 'employees':
            tabContent = renderEmployeesTab();
            break;
        case 'requests':
            tabContent = renderLeaveRequestsTab();
            break;
        case 'history':
             tabContent = `<div class="empty-state"><p>Leave history coming soon.</p></div>`;
             break;
        case 'reviews':
             tabContent = `<div class="empty-state"><p>Performance reviews coming soon.</p></div>`;
             break;
    }

    return `
        <div>
            <div class="kanban-header">
                <h2>${t('hr.title')}</h2>
                <button class="btn btn-primary" data-modal-target="addTimeOffRequest">
                    <span class="material-icons-sharp">flight_takeoff</span>
                    ${t('team_calendar.add_leave')}
                </button>
            </div>
            <div class="hr-tabs">
                <div class="hr-tab ${activeTab === 'employees' ? 'active' : ''}" data-hr-tab="employees">${t('hr.tabs.employees')}</div>
                <div class="hr-tab ${activeTab === 'requests' ? 'active' : ''}" data-hr-tab="requests">${t('hr.tabs.requests')}</div>
                <div class="hr-tab ${activeTab === 'history' ? 'active' : ''}" data-hr-tab="history">${t('hr.tabs.history')}</div>
                <div class="hr-tab ${activeTab === 'reviews' ? 'active' : ''}" data-hr-tab="reviews">${t('hr.tabs.reviews')}</div>
            </div>
            ${tabContent}
        </div>
    `;
}

function renderEmployeesTab() {
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return 'Error: Active workspace not found.';

    const members: { member: WorkspaceMember, user: User }[] = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => ({ member: m, user: state.users.find(u => u.id === m.userId)! }))
        .filter(item => item.user);

    const roles: Role[] = ['owner', 'manager', 'member', 'client'];

    const ownedWorkspacesCount = state.workspaces.filter(w =>
        state.workspaceMembers.some(m => m.workspaceId === w.id && m.userId === state.currentUser?.id && m.role === 'owner')
    ).length;

    const planLimits = PLANS[activeWorkspace.subscription.planId];
    const canCreateWorkspace = ownedWorkspacesCount < planLimits.workspaces;

    return `
        <div class="hr-grid">
            <div class="member-list-container">
                <div class="card">
                    <div class="card-header-flex">
                        <h3>${t('hr.members_in')} ${activeWorkspace.name}</h3>
                    </div>
                    <div class="member-list">
                        ${members.map(({ member, user }) => `
                            <div class="member-item" data-modal-target="employeeDetail" data-user-id="${user.id}">
                                <div class="avatar">${user.initials}</div>
                                <div class="member-info">
                                    <strong>${user.name} ${user.id === state.currentUser?.id ? `<span class="subtle-text">${t('hr.you')}</span>` : ''}</strong>
                                    <p>${user.email || t('misc.not_applicable')}</p>
                                </div>
                                <div class="member-actions">
                                     <span class="status-badge status-backlog">${t('hr.role_' + member.role)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="management-sidebar">
                <div class="card">
                    <h4>${t('hr.invite_member')}</h4>
                    <form id="invite-user-form">
                        <div class="form-group">
                            <label for="invite-email">${t('hr.invite_by_email')}</label>
                            <input type="email" id="invite-email" class="form-control" required>
                        </div>
                        <div class="form-group" style="margin-top: 1rem;">
                            <label for="invite-role">${t('hr.select_role')}</label>
                            <select id="invite-role" class="form-control">
                                ${roles.filter(r => r !== 'owner').map(r => `<option value="${r}">${t('hr.role_' + r)}</option>`).join('')}
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">${t('hr.invite')}</button>
                    </form>
                </div>
                <div class="card">
                     <h4>${t('hr.create_workspace_title')}</h4>
                     <form id="create-workspace-form">
                        <div class="form-group">
                            <label for="new-workspace-name">${t('hr.workspace_name_label')}</label>
                            <input type="text" id="new-workspace-name" class="form-control" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top: 1rem;" ${!canCreateWorkspace ? 'disabled' : ''} title="${!canCreateWorkspace ? t('hr.workspace_limit_reached') : ''}">${t('hr.create_button')}</button>
                     </form>
                </div>
            </div>
        </div>
    `;
}

function renderLeaveRequestsTab() {
     const pendingRequests = state.timeOffRequests.filter(r => 
        r.workspaceId === state.activeWorkspaceId && r.status === 'pending'
     );

     if (pendingRequests.length === 0) {
        return `<div class="empty-state">
            <span class="material-icons-sharp">inbox</span>
            <h3>${t('hr.no_pending_requests')}</h3>
        </div>`;
     }

     return `
        <div class="card">
            <div class="leave-request-list">
                ${pendingRequests.map(request => {
                    const user = state.users.find(u => u.id === request.userId);
                    return `
                        <div class="leave-request-item">
                            <div class="avatar">${user?.initials || '?'}</div>
                            <div>
                                <strong>${user?.name || 'Unknown User'}</strong>
                                <p class="subtle-text">${t(`team_calendar.leave_type_${request.type}`)}</p>
                            </div>
                            <div>
                                <strong>${t('modals.start_date')}</strong>
                                <p>${formatDate(request.startDate)}</p>
                            </div>
                             <div>
                                <strong>${t('modals.due_date')}</strong>
                                <p>${formatDate(request.endDate)}</p>
                            </div>
                            <div class="leave-request-actions">
                                <button class="btn btn-secondary" data-reject-request-id="${request.id}">${t('hr.reject')}</button>
                                <button class="btn btn-primary" data-approve-request-id="${request.id}">${t('hr.approve')}</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
     `;
}