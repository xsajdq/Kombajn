

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate, getVacationInfo } from '../utils.ts';
import type { Role, User, WorkspaceMember, TimeOffRequest, Review } from '../types.ts';
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
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">${t('hr.tabs.employees')}</h3>
            <div class="flex items-center gap-2">
                <div class="relative">
                     <span class="material-icons-sharp absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">search</span>
                     <input type="text" id="employee-search" class="pl-10 pr-4 py-2 w-64 bg-background border border-border-color rounded-md text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Search by name or email...">
                </div>
                ${canInviteUsers ? `
                <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed" id="hr-invite-member-btn" ${userLimitReached ? 'disabled' : ''} title="${userLimitReached ? t('billing.limit_reached_users').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                    <span class="material-icons-sharp text-base">add</span> ${t('hr.invite_member')}
                </button>
                ` : ''}
            </div>
        </div>
        <div class="bg-content rounded-lg shadow-sm">
            <div class="w-full text-sm">
                <div class="modern-list-row hr-list-grid px-4 py-3 bg-background text-xs font-semibold text-text-subtle uppercase hidden md:grid">
                    <div>${t('hr.employee')}</div>
                    <div>${t('hr.role')}</div>
                    <div>Email</div>
                    <div class="text-right">${t('hr.actions')}</div>
                </div>
                <div class="divide-y divide-border-color hr-table-body">
                    ${members.map(({ member, user }) => {
                        const isSelf = user.id === state.currentUser?.id;
                        const isOwner = member.role === 'owner';
                        const displayName = user.name || user.email || user.initials;
                        return `
                        <div class="modern-list-row hr-list-grid group" data-user-name="${(user.name || '').toLowerCase()}" data-user-email="${(user.email || '').toLowerCase()}">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">${user.initials}</div>
                                <div class="font-semibold">
                                    ${displayName} ${isSelf ? `<span class="text-xs font-normal text-text-subtle">(${t('hr.you')})</span>` : ''}
                                </div>
                            </div>
                            <div>
                                ${canManageRoles && !isOwner && !isSelf ? `
                                    <div class="relative">
                                        <button class="role-tag" data-menu-toggle="role-menu-${member.id}" aria-haspopup="true" aria-expanded="false">
                                            <span>${t(`hr.role_${member.role}`)}</span>
                                            <span class="material-icons-sharp text-base">expand_more</span>
                                        </button>
                                        <div id="role-menu-${member.id}" class="dropdown-menu role-menu">
                                            ${ALL_ROLES.filter(r => r !== 'owner').map(role => `
                                                <button class="role-menu-item ${member.role === role ? 'active' : ''}" data-new-role-for-member-id="${member.id}" data-role="${role}">
                                                    ${t(`hr.role_${role}`)}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-background capitalize">${t(`hr.role_${member.role}`)}</span>`}
                            </div>
                            <div>
                                <span class="text-text-subtle">${user.email || t('misc.not_applicable')}</span>
                            </div>
                            <div class="flex justify-end items-center gap-1 actions-on-hover">
                                <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-modal-target="employeeDetail" data-user-id="${user.id}" title="View/Edit Details">
                                    <span class="material-icons-sharp text-lg">edit_note</span>
                                </button>
                                ${canRemoveUsers && !isOwner && !isSelf ? `
                                    <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color hover:text-danger" data-remove-member-id="${member.id}" title="${t('hr.remove')}"><span class="material-icons-sharp text-lg">person_remove</span></button>
                                ` : ''}
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        </div>

        <div id="hr-invite-flyout-backdrop" class="fixed inset-0 bg-black/50 z-30 opacity-0 pointer-events-none transition-opacity duration-300"></div>
        <div id="hr-invite-flyout" class="fixed top-0 right-0 h-full w-96 bg-content shadow-lg transform translate-x-full transition-transform duration-300 z-40 flex flex-col">
            <div class="p-4 border-b border-border-color">
                <h4 class="font-semibold text-lg">${t('hr.invite_member')}</h4>
            </div>
             <form id="invite-user-form" class="p-4 flex-1 flex flex-col">
                <div class="space-y-4">
                    <div class="flex flex-col gap-1.5">
                        <label for="invite-email" class="text-sm font-medium text-text-subtle">${t('hr.invite_by_email')}</label>
                        <input type="email" id="invite-email" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label for="invite-role" class="text-sm font-medium text-text-subtle">${t('hr.select_role')}</label>
                        <select id="invite-role" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                            ${ALL_ROLES.filter(r => r !== 'owner').map(r => `<option value="${r}">${t(`hr.role_${r}`)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="mt-auto pt-4 flex justify-end items-center gap-2">
                    <button type="button" class="px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background" id="hr-invite-cancel-btn">${t('modals.cancel')}</button>
                    <button type="submit" class="px-3 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('hr.invite')}</button>
                </div>
            </form>
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
        return `<div class="flex flex-col items-center justify-center h-full text-center">
            <span class="material-icons-sharp text-5xl text-text-subtle">inbox</span>
            <h3 class="text-lg font-medium mt-2">${t('hr.no_pending_requests')}</h3>
        </div>`;
     }

     return `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">${t('hr.tabs.requests')}</h3>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
                <h4 class="font-semibold mb-3">${t('hr.join_requests_title')} (${pendingJoinRequests.length})</h4>
                <div class="space-y-3">
                    ${pendingJoinRequests.length > 0 ? pendingJoinRequests.map(request => {
                        const user = state.users.find(u => u.id === request.userId);
                        if (!user) return '';
                        return `
                            <div class="bg-content p-3 rounded-lg flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">${user.initials}</div>
                                    <div>
                                        <strong class="text-sm font-semibold">${user.name || user.initials}</strong>
                                        <p class="text-xs text-text-subtle">${user.email}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button class="px-3 py-1.5 text-xs font-medium rounded-md bg-content border border-border-color hover:bg-background" data-reject-join-request-id="${request.id}">${t('hr.reject')}</button>
                                    <button class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-hover" data-approve-join-request-id="${request.id}">${t('hr.approve')}</button>
                                </div>
                            </div>
                        `;
                    }).join('') : `<div class="bg-content p-4 rounded-lg text-center text-sm text-text-subtle">${t('hr.no_pending_requests')}</div>`}
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-3">Leave Requests (${pendingLeaveRequests.length})</h4>
                <div class="space-y-3">
                    ${pendingLeaveRequests.length > 0 ? pendingLeaveRequests.map(request => {
                        const user = state.users.find(u => u.id === request.userId);
                        return `
                            <div class="bg-content p-3 rounded-lg flex items-center justify-between gap-2">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">${user?.initials || '?'}</div>
                                    <div>
                                        <strong class="text-sm font-semibold">${user?.name || 'Unknown User'}</strong>
                                        <p class="text-xs text-text-subtle">${t(`team_calendar.leave_type_${request.type}`)}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 text-sm">
                                    <span>${formatDate(request.startDate, {month: 'short', day: 'numeric'})}</span>
                                    <span class="material-icons-sharp text-text-subtle text-base">arrow_forward</span>
                                    <span>${formatDate(request.endDate, {month: 'short', day: 'numeric'})}</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color hover:text-danger" data-reject-request-id="${request.id}" title="Reject"><span class="material-icons-sharp text-lg">close</span></button>
                                    <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color hover:text-success" data-approve-request-id="${request.id}" title="Approve"><span class="material-icons-sharp text-lg">check</span></button>
                                </div>
                            </div>
                        `;
                    }).join('') : `<div class="bg-content p-4 rounded-lg text-center text-sm text-text-subtle">${t('hr.no_pending_requests')}</div>`}
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
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">${t('hr.tabs.vacation')}</h3>
        </div>
        <div class="bg-content rounded-lg shadow-sm">
            <div class="w-full text-sm">
                <div class="grid grid-cols-[2fr,1fr,2fr,1fr,1fr] gap-4 px-4 py-3 bg-background text-xs font-semibold text-text-subtle uppercase hidden md:grid">
                    <div>${t('hr.employee')}</div>
                    <div>${t('hr.vacation_pool')}</div>
                    <div>${t('hr.vacation_used')}</div>
                    <div>${t('hr.vacation_remaining')}</div>
                    <div class="text-right">${t('hr.actions')}</div>
                </div>
                <div class="divide-y divide-border-color md:divide-y-0">
                    ${workspaceUsers.map(user => {
                        const vacationInfo = getVacationInfo(user, state.timeOffRequests, state.publicHolidays);
                        const usagePercentage = vacationInfo.pool.hours > 0 ? (vacationInfo.used.hours / vacationInfo.pool.hours) * 100 : 0;
                        return `
                            <div class="grid-cols-[2fr,1fr,2fr,1fr,1fr] gap-4 px-4 py-3 items-center hr-table-row">
                                <div data-label="${t('hr.employee')}">${user.name || user.initials}</div>
                                <div data-label="${t('hr.vacation_pool')}">
                                    <span>${vacationInfo.pool.days} ${t('hr.days')}</span>
                                    <span class="text-text-subtle ml-1">(${vacationInfo.pool.hours} ${t('hr.hours')})</span>
                                </div>
                                <div data-label="${t('hr.vacation_used')}">
                                    <div class="flex items-center gap-2">
                                        <span>${vacationInfo.used.days} ${t('hr.days')}</span>
                                        <div class="w-20 h-2 bg-background rounded-full"><div class="h-2 rounded-full bg-primary" style="width: ${usagePercentage}%;"></div></div>
                                    </div>
                                </div>
                                <div data-label="${t('hr.vacation_remaining')}">
                                    <span>${vacationInfo.remaining.days} ${t('hr.days')}</span>
                                    <span class="text-text-subtle ml-1">(${vacationInfo.remaining.hours} ${t('hr.hours')})</span>
                                </div>
                                <div class="text-right" data-label="${t('hr.actions')}">
                                    ${canManage ? `
                                    <button class="px-2 py-1 text-xs font-medium rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="adjustVacationAllowance" data-user-id="${user.id}" data-current-allowance="${vacationInfo.pool.hours}">
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

function renderHistoryTab() {
    const history = state.timeOffRequests
        .filter(r => r.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (history.length === 0) {
        return `<div class="empty-state">
            <span class="material-icons-sharp text-5xl text-text-subtle">history</span>
            <h3 class="text-lg font-medium mt-2">${t('hr.no_leave_history')}</h3>
        </div>`;
    }

    const statusClasses: Record<string, string> = {
        approved: 'bg-success/10 text-success',
        rejected: 'bg-danger/10 text-danger',
        pending: 'bg-warning/10 text-warning',
    };

    return `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">${t('hr.tabs.history')}</h3>
        </div>
        <div class="bg-content rounded-lg shadow-sm">
            <div class="w-full text-sm">
                <div class="grid grid-cols-[2fr,1fr,1fr,1fr,1fr] gap-4 px-4 py-3 bg-background text-xs font-semibold text-text-subtle uppercase hidden md:grid">
                    <div>${t('hr.history_table.employee')}</div>
                    <div>${t('hr.history_table.type')}</div>
                    <div>${t('hr.history_table.start_date')}</div>
                    <div>${t('hr.history_table.end_date')}</div>
                    <div>${t('hr.history_table.status')}</div>
                </div>
                <div class="divide-y divide-border-color md:divide-y-0">
                    ${history.map(request => {
                        const user = state.users.find(u => u.id === request.userId);
                        return `
                        <div class="grid-cols-[2fr,1fr,1fr,1fr,1fr] gap-4 px-4 py-3 items-center hr-table-row">
                            <div data-label="${t('hr.history_table.employee')}">${user?.name || 'Unknown'}</div>
                            <div data-label="${t('hr.history_table.type')}">${t(`team_calendar.leave_type_${request.type}`)}</div>
                            <div data-label="${t('hr.history_table.start_date')}">${formatDate(request.startDate)}</div>
                            <div data-label="${t('hr.history_table.end_date')}">${formatDate(request.endDate)}</div>
                            <div data-label="${t('hr.history_table.status')}">
                                <span class="px-2 py-1 text-xs font-semibold rounded-full capitalize ${statusClasses[request.status]}">
                                    ${t(`modals.status_${request.status}`)}
                                </span>
                            </div>
                        </div>
                        `
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderReviewsTab() {
    const members = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId)!)
        .filter(Boolean)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
    const canManage = can('manage_roles');

    return `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">${t('hr.tabs.reviews')}</h3>
        </div>
        <div class="space-y-4">
            ${members.map(member => {
                const reviews = state.reviews
                    .filter(r => r.employeeId === member.id)
                    .sort((a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime());
                
                return `
                <details class="bg-content rounded-lg shadow-sm" open>
                    <summary class="flex justify-between items-center p-4 cursor-pointer">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">${member.initials}</div>
                            <span class="font-semibold">${member.name}</span>
                        </div>
                        ${canManage ? `
                        <button class="btn btn-secondary btn-sm" data-modal-target="addReview" data-employee-id="${member.id}">
                            <span class="material-icons-sharp text-base">add</span>
                            ${t('hr.add_review')}
                        </button>
                        ` : ''}
                    </summary>
                    <div class="p-4 border-t border-border-color">
                        ${reviews.length > 0 ? `
                            <div class="space-y-4">
                                ${reviews.map(review => {
                                    const reviewer = state.users.find(u => u.id === review.reviewerId);
                                    return `
                                    <div class="p-3 bg-background rounded-md">
                                        <div class="flex justify-between items-center mb-2">
                                            <p class="text-xs text-text-subtle">${t('hr.reviewed_by', {name: reviewer?.name || 'User', date: formatDate(review.reviewDate)})}</p>
                                            <div class="flex items-center gap-1 text-yellow-500">
                                                ${Array.from({length: 5}).map((_, i) => `<span class="material-icons-sharp text-base">${i < review.rating ? 'star' : 'star_border'}</span>`).join('')}
                                            </div>
                                        </div>
                                        <p class="text-sm">${review.notes.replace(/\n/g, '<br>')}</p>
                                    </div>
                                    `
                                }).join('')}
                            </div>
                        ` : `
                            <p class="text-sm text-text-subtle text-center py-4">${t('hr.no_reviews')}</p>
                        `}
                    </div>
                </details>
                `;
            }).join('')}
        </div>
    `;
}


export async function HRPage() {
    if (!can('view_hr')) {
        return `<div class="flex flex-col items-center justify-center h-full text-center">
            <span class="material-icons-sharp text-5xl text-text-subtle">lock</span>
            <h3 class="text-lg font-medium mt-2">${t('hr.access_denied')}</h3>
            <p class="text-sm text-text-subtle">${t('hr.access_denied_desc')}</p>
        </div>`;
    }
    
    await fetchPublicHolidays(new Date().getFullYear());

    const { activeTab } = state.ui.hr;
    let tabContent = '';
    switch(activeTab) {
        case 'employees': tabContent = await renderEmployeesTab(); break;
        case 'requests': tabContent = renderRequestsTab(); break;
        case 'vacation': tabContent = renderVacationTab(); break;
        case 'history': tabContent = renderHistoryTab(); break;
        case 'reviews': tabContent = renderReviewsTab(); break;
    }

    const navItems = [
        { id: 'employees', text: t('hr.tabs.employees') },
        { id: 'requests', text: t('hr.tabs.requests') },
        { id: 'vacation', text: t('hr.tabs.vacation') },
        { id: 'history', text: t('hr.tabs.history') },
        { id: 'reviews', text: t('hr.tabs.reviews') }
    ];

    return `
        <div class="flex flex-col md:flex-row gap-8 h-full">
            <nav class="flex flex-col w-full md:w-56 shrink-0">
                <h3 class="text-xl font-bold p-4">${t('hr.title')}</h3>
                <ul class="space-y-1 p-2">
                ${navItems.map(item => `
                    <li>
                        <a href="#" class="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === item.id ? 'bg-primary/10 text-primary' : 'hover:bg-background'}" data-hr-tab="${item.id}">
                            ${item.text}
                        </a>
                    </li>
                `).join('')}
                </ul>
            </nav>
            <main class="flex-1 overflow-y-auto">
                ${tabContent}
            </main>
        </div>
    `;
}
