

import { state } from './state.ts';
import type { Role, Permission } from './types.ts';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    owner: [ // Owner has all permissions explicitly listed
        'manage_billing', 'view_hr', 'manage_roles', 'invite_users', 'remove_users', 'manage_workspace_settings',
        'manage_projects', 'create_projects', 'manage_clients', 'manage_invoices', 'manage_deals', 'manage_tasks', 'manage_automations', 'view_reports'
    ],
    admin: [
        'view_hr', 'manage_roles', 'invite_users', 'remove_users', 'manage_workspace_settings',
        'manage_projects', 'create_projects', 'manage_clients', 'manage_invoices', 'manage_deals', 'manage_tasks', 'manage_automations', 'view_reports'
    ],
    manager: [
        'view_hr', 'invite_users', 'create_projects', 'manage_projects', 'manage_clients', 'manage_deals', 'manage_tasks', 'manage_automations', 'view_reports'
    ],
    finance: [
        'manage_invoices', 'view_reports'
    ],
    member: [
        'manage_tasks' // Can manage tasks they are assigned to, specific checks will be in components
    ],
    client: [
        // Clients have very limited, specific access, usually handled by project privacy and ProjectRole
    ],
};

export function can(permission: Permission): boolean {
    const { currentUser, activeWorkspaceId, workspaceMembers } = state;

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