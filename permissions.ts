
import { state } from './state.ts';
import type { Role, Permission } from './types.ts';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    owner: [ // Owner has all permissions implicitly, but we can list them for clarity
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

    // Most fundamental checks. If these aren't set, no permissions can be checked.
    if (!currentUser || !activeWorkspaceId) {
        return false;
    }

    // CRITICAL FIX FOR RACE CONDITION:
    // Explicitly check if the workspaceMembers array has been populated from the API.
    // The initial state is an empty array. If it's still empty when `can` is called,
    // it means data hasn't loaded yet, so we cannot determine permissions.
    if (!workspaceMembers || workspaceMembers.length === 0) {
        return false;
    }

    const member = workspaceMembers.find(m => m && m.userId === currentUser.id && m.workspaceId === activeWorkspaceId);
    
    // Defensive check for data integrity.
    if (!member || !Array.isArray(member.roles)) {
        return false;
    }

    // Owner role always has all permissions.
    if (member.roles.includes('owner')) {
        return true;
    }

    const userPermissions = new Set<Permission>();
    for (const role of member.roles) {
        const permissionsForRole = ROLE_PERMISSIONS[role];
        if (permissionsForRole) {
            permissionsForRole.forEach(p => userPermissions.add(p));
        }
    }
    
    return userPermissions.has(permission);
}
