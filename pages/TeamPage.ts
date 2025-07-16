

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate, getVacationInfo } from '../utils.ts';
import type { Role, User, WorkspaceMember, TimeOffRequest } from '../types.ts';
import { can } from '../permissions.ts';
import { PLANS } from '../utils.ts';
import { fetchPublicHolidays } from '../handlers/calendar.ts';

async function renderEmployeesTab() {
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return 'Error: Active workspace not found.';

    const members: { member: WorkspaceMember, user: User }[] = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => ({ member: m, user: state.users.find(u => u.id === m.userId)! }))
        .filter(item => item.user)
        .sort((a, b) => (a.user.name || '').localeCompare(b.user.name || ''));

    const ALL_ROLES: Role[] = ['owner', 'admin', 'manager', 'member', 'finance', 'client'];
    const canManageRoles = can('manage_roles');
    const canInviteUsers = can('invite_users');
    const canRemoveUsers = can('remove_users');

    const usage = PLANS[activeWorkspace.subscription.planId];
    const userLimitReached = members.length >= usage.users;

    return `
        <div class="hr-content-header">
            <h3>${t('hr.tabs.employees')}</h3>
            <div class="hr-controls">
                <div class="form-group search-group" style="margin: 0;">
                     <input type="text" id="employee-search" class="form-control" placeholder="Search by name or email...">
                </div>
                ${canInviteUsers ? `
                <button class="btn btn-primary" id="hr-invite-member-btn" ${userLimitReached ? 'disabled' : ''} title="${userLimitReached ? t('billing.limit_reached_users').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                    <span class="material-icons-sharp">add</span> ${t('hr.invite_member')}
                </button>
                ` : ''}
            </div>
        </div>
        <div class="card card-table">
            <div class="hr-employee-table">
                <div class="hr-table-header">
                    <div>${t('hr.employee')}</div>
                    <div>Role</div>
                    <div>Email</div>
                    <div>${t('hr.actions')}</div>
                </div>
                <div class="hr-table-body">
                    ${members.map(({ member, user }) => {
                        const isSelf = user.id === state.currentUser?.id;
                        const isOwner = member.role === 'owner';
                        return `
                        <div class="hr-table-row" data-user-name="${user.name?.toLowerCase() || ''}" data-user-email="${user.email?.toLowerCase() || ''}">
                            <div class="hr-employee-cell" data-label="Employee">
                                <div class="avatar">${user.initials}</div>
                                <div class="member-info">
                                    <strong>${user.name || user.initials} ${isSelf ? `<span class="subtle-text">(${t('hr.you')})</span>` : ''}</strong>
                                </div>
                            </div>
                            <div data-label="Role">
                                ${canManageRoles && !isOwner && !isSelf ? `
                                    <select class="form-control" data-change-role-for-member-id="${member.id}">
                                        ${ALL_ROLES.filter(r => r !== 'owner').map(role => `
                                            <option value="${role}" ${member.role === role ? 'selected' : ''}>${t(`hr.role_${role}`)}</option>
                                        `).join('')}
                                    </select>
                                ` : `<span class="status-badge status-backlog">${t(`hr.role_${member.role}`)}</span>`}
                            </div>
                            <div data-label="Email">
                                <span class="subtle-text">${user.email || t('misc.not_applicable')}</span>
                            </div>
                            <div data-label="Actions">
                                <button class="btn-icon" data-modal-target="employeeDetail" data-user-id="${user.id}" title="View/Edit Details">
                                    <span class="material-icons-sharp">edit_note</span>
                                </button>
                                ${canRemoveUsers && !isOwner && !isSelf ? `
                                    <button class="btn-icon" data-remove-member-id="${member.id}" title="${t('hr.remove')}"><span class="material-icons-sharp danger-icon">person_remove</span></button>
                                ` : ''}
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        </div>

        <div id="hr-invite-flyout" class="hr-invite-flyout">
            <div class="hr-invite-flyout-content">
                <h4>${t('hr.invite_member')}</h4>
                 <form id="invite-user-form">
                    <div class="form-group">
                        <label for="invite-email">${t('hr.invite_by_email')}</label>
                        <input type="email" id="invite-email" class="form-control" required>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="invite-role">${t('hr.select_role')}</label>
                        <select id="invite-role" class="form-control">
                            ${ALL_ROLES.filter(r => r !== 'owner').map(r => `<option value="${r}">${t(`hr.role_${r}`)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="hr-invite-cancel-btn">${t('modals.cancel')}</button>
                        <button type="submit" class="btn btn-primary">${t('hr.invite')}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderRequestsTab() {
     const pendingLeaveRequests = state.timeOffRequests.filter(r => 
        r.workspaceId === state.activeWorkspaceId && r.status === 'pending'
     );
     const pendingJoinRequests = state.workspaceJoinRequests.filter(r =>
        r.workspaceId === state.activeWorkspaceId && r.status === 'pending'
     );

     if (pendingLeaveRequests.length === 0 && pendingJoinRequests.length === 0) {
        return `<div class="empty-state">
            <span class="material-icons-sharp">inbox</span>
            <h3>${t('hr.no_pending_requests')}</h3>
        </div>`;
     }

     return `
        <div class="hr-content-header">
            <h3>${t('hr.tabs.requests')}</h3>
        </div>
        <div class="hr-requests-grid">
            <div class="requests-column">
                <h4>${t('hr.join_requests_title')} (${pendingJoinRequests.length})</h4>
                <div class="request-cards-list">
                    ${pendingJoinRequests.length > 0 ? pendingJoinRequests.map(request => {
                        const user = state.users.find(u => u.id === request.userId);
                        if (!user) return '';
                        return `
                            <div class="request-card">
                                <div class="request-card-user">
                                    <div class="avatar">${user.initials}</div>
                                    <div>
                                        <strong>${user.name || user.initials}</strong>
                                        <p class="subtle-text">${user.email}</p>
                                    </div>
                                </div>
                                <div class="request-card-actions">
                                    <button class="btn btn-secondary" data-reject-join-request-id="${request.id}">${t('hr.reject')}</button>
                                    <button class="btn btn-primary" data-approve-join-request-id="${request.id}">${t('hr.approve')}</button>
                                </div>
                            </div>
                        `;
                    }).join('') : `<p class="subtle-text" style="padding: 1rem;">${t('hr.no_pending_requests')}</p>`}
                </div>
            </div>
            <div class="requests-column">
                <h4>Leave Requests (${pendingLeaveRequests.length})</h4>
                <div class="request-cards-list">
                    ${pendingLeaveRequests.length > 0 ? pendingLeaveRequests.map(request => {
                        const user = state.users.find(u => u.id === request.userId);
                        return `
                            <div class="request-card">
                                <div class="request-card-user">
                                    <div class="avatar">${user?.initials || '?'}</div>
                                    <div>
                                        <strong>${user?.name || 'Unknown User'}</strong>
                                        <p class="subtle-text">${t(`team_calendar.leave_type_${request.type}`)}</p>
                                    </div>
                                </div>
                                <div class="request-card-details">
                                    <div>${formatDate(request.startDate)}</div>
                                    <span class="material-icons-sharp">arrow_forward</span>
                                    <div>${formatDate(request.endDate)}</div>
                                </div>
                                <div class="request-card-actions">
                                    <button class="btn-icon" data-reject-request-id="${request.id}" title="Reject"><span class="material-icons-sharp danger-icon">close</span></button>
                                    <button class="btn-icon" data-approve-request-id="${request.id}" title="Approve"><span class="material-icons-sharp success-icon">check</span></button>
                                </div>
                            </div>
                        `;
                    }).join('') : `<p class="subtle-text" style="padding: 1rem;">${t('hr.no_pending_requests')}</p>`}
                </div>
            </div>
        </div>
     `;
}

function renderVacationTab() {
    const workspaceUsers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId)!)
        .filter(Boolean);

    const canManage = can('manage_roles');

    return `
        <div class="hr-content-header">
            <h3>${t('hr.tabs.vacation')}</h3>
        </div>
        <div class="card card-table">
            <div class="hr-vacation-table">
                <div class="hr-table-header">
                    <div>${t('hr.employee')}</div>
                    <div>${t('hr.vacation_pool')}</div>
                    <div>${t('hr.vacation_used')}</div>
                    <div>${t('hr.vacation_remaining')}</div>
                    <div class="actions-col">${t('hr.actions')}</div>
                </div>
                <div class="hr-table-body">
                    ${workspaceUsers.map(user => {
                        const vacationInfo = getVacationInfo(user, state.timeOffRequests, state.publicHolidays);
                        const usagePercentage = vacationInfo.pool.hours > 0 ? (vacationInfo.used.hours / vacationInfo.pool.hours) * 100 : 0;
                        return `
                            <div class="hr-table-row">
                                <div data-label="${t('hr.employee')}">
                                    ${user.name || user.initials}
                                </div>
                                <div data-label="${t('hr.vacation_pool')}">
                                    <div class="vacation-cell">
                                        <span>${vacationInfo.pool.days} ${t('hr.days')}</span>
                                        <span class="subtle-text">(${vacationInfo.pool.hours} ${t('hr.hours')})</span>
                                    </div>
                                </div>
                                <div data-label="${t('hr.vacation_used')}">
                                    <div class="vacation-cell">
                                        <span>${vacationInfo.used.days} ${t('hr.days')}</span>
                                        <div class="vacation-progress-bar">
                                            <div class="vacation-progress-bar-inner" style="width: ${usagePercentage}%;"></div>
                                        </div>
                                    </div>
                                </div>
                                <div data-label="${t('hr.vacation_remaining')}">
                                    <div class="vacation-cell">
                                        <span>${vacationInfo.remaining.days} ${t('hr.days')}</span>
                                        <span class="subtle-text">(${vacationInfo.remaining.hours} ${t('hr.hours')})</span>
                                    </div>
                                </div>
                                <div class="actions-col" data-label="${t('hr.actions')}">
                                    ${canManage ? `
                                    <button class="btn btn-secondary btn-sm" data-modal-target="adjustVacationAllowance" data-user-id="${user.id}" data-current-allowance="${vacationInfo.pool.hours}">
                                        ${t('hr.manage_vacation')}
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}


export async function HRPage() {
    if (!can('view_hr')) {
        return `<div class="empty-state">
            <span class="material-icons-sharp">lock</span>
            <h3>${t('hr.access_denied')}</h3>
            <p>${t('hr.access_denied_desc')}</p>
        </div>`;
    }
    
    await fetchPublicHolidays(new Date().getFullYear());

    const { activeTab } = state.ui.hr;
    let tabContent = '';
    switch(activeTab) {
        case 'employees': tabContent = await renderEmployeesTab(); break;
        case 'requests': tabContent = renderRequestsTab(); break;
        case 'vacation': tabContent = renderVacationTab(); break;
        case 'history': tabContent = `<div class="empty-state"><p>Leave history coming soon.</p></div>`; break;
        case 'reviews': tabContent = `<div class="empty-state"><p>Performance reviews coming soon.</p></div>`; break;
    }

    const navItems = [
        { id: 'employees', text: t('hr.tabs.employees') },
        { id: 'requests', text: t('hr.tabs.requests') },
        { id: 'vacation', text: t('hr.tabs.vacation') },
        { id: 'history', text: t('hr.tabs.history') },
        { id: 'reviews', text: t('hr.tabs.reviews') }
    ];

    return `
        <div class="hr-page-layout">
            <nav class="hr-nav-menu">
                <h3>${t('hr.title')}</h3>
                <ul>
                ${navItems.map(item => `
                    <li>
                        <a href="#" class="hr-nav-item ${activeTab === item.id ? 'active' : ''}" data-hr-tab="${item.id}">
                            ${item.text}
                        </a>
                    </li>
                `).join('')}
                </ul>
            </nav>
            <main class="hr-content">
                ${tabContent}
            </main>
        </div>
    `;
}
