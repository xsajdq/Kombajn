

import { getState } from './state.ts';
import type { Role, Permission } from './types.ts';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    owner: [ // All permissions
        'manage_billing', 'view_hr', 'manage_roles', 'invite_users', 'remove_users', 'manage_workspace_settings',
        'view_dashboard', 'view_projects', 'manage_projects', 'create_projects', 'view_tasks', 'manage_tasks', 'view_clients',
        'manage_clients', 'view_sales', 'manage_deals', 'view_invoices', 'manage_invoices', 'view_reports',
        'view_team_calendar', 'view_chat', 'view_ai_assistant', 'view_settings', 'manage_automations', 'view_automations',
        'view_goals', 'manage_goals', 'view_inventory', 'manage_inventory', 'view_budgets', 'manage_budgets'
    ],
    admin: [
        'view_hr', 'manage_roles', 'invite_users', 'remove_users', 'manage_workspace_settings',
        'view_dashboard', 'view_projects', 'manage_projects', 'create_projects', 'view_tasks', 'manage_tasks', 'view_clients',
        'manage_clients', 'view_sales', 'manage_deals', 'view_invoices', 'manage_invoices', 'view_reports',
        'view_team_calendar', 'view_chat', 'view_ai_assistant', 'view_settings', 'manage_automations', 'view_automations',
        'view_goals', 'manage_goals', 'view_inventory', 'manage_inventory', 'view_budgets', 'manage_budgets'
    ],
    manager: [
        'view_hr', 'invite_users',
        'view_dashboard', 'view_projects', 'manage_projects', 'create_projects', 'view_tasks',
        'manage_tasks', 'view_clients', 'manage_clients', 'view_sales', 'manage_deals', 'view_reports',
        'view_team_calendar', 'view_chat', 'view_ai_assistant', 'view_settings', 'manage_automations', 'view_automations',
        'view_goals', 'manage_goals', 'view_inventory', 'manage_inventory', 'view_budgets', 'manage_budgets'
    ],
    finance: [
        'view_dashboard', 'view_invoices', 'manage_invoices', 'view_reports', 'view_settings', 'view_budgets', 'manage_budgets'
    ],
    member: [
        'view_dashboard', 'view_projects', 'view_tasks', 'manage_tasks', 'view_team_calendar', 'view_chat', 'view_settings', 'view_ai_assistant', 'view_clients', 'view_goals', 'view_inventory', 'view_budgets'
    ],
    client: [
        'view_dashboard',
        'view_projects',
        'view_tasks',
        'view_settings'
    ],
};

export function can(permission: Permission): boolean {
    const { currentUser, activeWorkspaceId, workspaceMembers } = getState();

    if (!currentUser || !activeWorkspaceId || !workspaceMembers || workspaceMembers.length === 0) {
        return false;
    }

    const member = workspaceMembers.find(m => m && m.userId === currentUser.id && m.workspaceId === activeWorkspaceId);
    
    if (!member || !member.role) {
        return false;
    }

    const permissionsForRole = ROLE_PERMISSIONS[member.role];
    if (!permissionsForRole) {
        return false;
    }
    
    return permissionsForRole.includes(permission);
}