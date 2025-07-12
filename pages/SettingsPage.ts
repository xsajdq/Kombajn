



import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { CustomFieldType } from '../types.ts';
import { can } from '../permissions.ts';

export function SettingsPage() {
    const { activeTab } = state.ui.settings;
    const canManage = can('manage_workspace_settings');

    const renderGeneralSettings = () => `
        <div class="setting-item">
            <div>
                <h4>${t('settings.theme')}</h4>
                <p class="subtle-text">${t('settings.theme_desc')}</p>
            </div>
            <select id="theme-switcher" class="form-control" style="max-width: 200px;">
                <option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>${t('settings.theme_light')}</option>
                <option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>${t('settings.theme_dark')}</option>
                <option value="minimal" ${state.settings.theme === 'minimal' ? 'selected' : ''}>${t('settings.theme_minimal')}</option>
            </select>
        </div>
        <div class="setting-item">
            <div>
                <h4>${t('settings.language')}</h4>
                <p class="subtle-text">${t('settings.language_desc')}</p>
            </div>
            <select id="language-switcher" class="form-control" style="max-width: 200px;">
                <option value="en" ${state.settings.language === 'en' ? 'selected' : ''}>${t('settings.english')}</option>
                <option value="pl" ${state.settings.language === 'pl' ? 'selected' : ''}>${t('settings.polish')}</option>
            </select>
        </div>
        <div class="setting-item">
            <div>
                <h4>${t('settings.default_workflow')}</h4>
                <p class="subtle-text">${t('settings.workflow_desc')}</p>
            </div>
            <select id="kanban-workflow-switcher" class="form-control" style="max-width: 200px;">
                <option value="simple" ${state.settings.defaultKanbanWorkflow === 'simple' ? 'selected' : ''}>${t('settings.workflow_simple')}</option>
                <option value="advanced" ${state.settings.defaultKanbanWorkflow === 'advanced' ? 'selected' : ''}>${t('settings.workflow_advanced')}</option>
            </select>
        </div>
    `;

    const renderProfileSettings = () => {
        const user = state.currentUser;
        if (!user) return '';

        return `
            <div class="profile-settings-container">
                <div class="card">
                    <h4>${t('settings.profile_details')}</h4>
                    <form id="update-profile-form">
                        <div class="form-group">
                            <label for="profile-avatar">${t('settings.avatar')}</label>
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div class="avatar" style="width: 64px; height: 64px; font-size: 1.5rem;" id="avatar-preview">
                                    ${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="User avatar">` : user.initials}
                                </div>
                                <label for="avatar-upload" class="btn btn-secondary">${t('settings.upload_avatar')}</label>
                                <input type="file" id="avatar-upload" class="hidden" accept="image/png, image/jpeg">
                            </div>
                        </div>
                        <div class="form-group" style="margin-top:1rem;">
                            <label for="profile-full-name">${t('settings.full_name')}</label>
                            <input type="text" id="profile-full-name" class="form-control" value="${user.name || ''}" required>
                        </div>
                        <div class="form-group" style="margin-top:1rem;">
                            <label for="profile-email">${t('settings.email_address')}</label>
                            <input type="email" id="profile-email" class="form-control" value="${user.email || ''}" readonly disabled>
                        </div>
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1.5rem;">
                            <span id="profile-update-status" class="subtle-text" style="transition: opacity 0.3s ease;"></span>
                            <button type="submit" class="btn btn-primary">${t('settings.update_profile')}</button>
                        </div>
                    </form>
                </div>
                <div class="card">
                    <h4>${t('settings.change_password')}</h4>
                    <form id="update-password-form">
                        <div class="form-group">
                            <label for="password-new">${t('settings.new_password')}</label>
                            <input type="password" id="password-new" class="form-control" required minlength="6">
                        </div>
                         <div class="form-group" style="margin-top:1rem;">
                            <label for="password-confirm">${t('settings.confirm_new_password')}</label>
                            <input type="password" id="password-confirm" class="form-control" required minlength="6">
                        </div>
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1.5rem;">
                            <span id="password-update-status" class="subtle-text" style="transition: opacity 0.3s ease;"></span>
                            <button type="submit" class="btn btn-primary">${t('settings.update_password')}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    };

    const renderCustomFieldsSettings = () => {
        const customFields = state.customFieldDefinitions.filter(cf => cf.workspaceId === state.activeWorkspaceId);
        const fieldTypes: CustomFieldType[] = ['text', 'number', 'date', 'checkbox'];

        return `
            <h4>${t('settings.tab_custom_fields')}</h4>
            <div class="card" style="margin-top: 1rem;">
                ${customFields.length > 0 ? customFields.map(field => `
                    <div class="setting-item">
                        <span><strong>${field.name}</strong> (${t(`settings.field_type_${field.type}`)})</span>
                        <button class="btn-icon delete-custom-field-btn" data-field-id="${field.id}" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
                    </div>
                `).join('') : `<p class="subtle-text">${t('settings.no_custom_fields')}</p>`}
            </div>
            <form id="add-custom-field-form" class="card" style="margin-top: 1.5rem;">
                 <div style="display: flex; gap: 1rem; align-items: flex-end;">
                    <div class="form-group" style="flex-grow: 1;">
                        <label for="custom-field-name">${t('settings.field_name')}</label>
                        <input type="text" id="custom-field-name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="custom-field-type">${t('settings.field_type')}</label>
                        <select id="custom-field-type" class="form-control">
                            ${fieldTypes.map(type => `<option value="${type}">${t(`settings.field_type_${type}`)}</option>`).join('')}
                        </select>
                    </div>
                    <button type="submit" class="btn btn-secondary">${t('settings.add_field')}</button>
                </div>
            </form>
        `;
    };

    const renderWorkspaceSettings = () => {
        const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (!workspace) return '';
        
        return `
            <form id="workspace-settings-form">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                    <div>
                        <h4>${t('settings.company_details')}</h4>
                        <div class="form-group">
                            <label for="companyName">${t('settings.company_name')}</label>
                            <input type="text" id="companyName" data-field="companyName" class="form-control" value="${workspace.companyName || ''}">
                        </div>
                        <div class="form-group" style="margin-top:1rem;">
                            <label for="companyAddress">${t('settings.company_address')}</label>
                            <textarea id="companyAddress" data-field="companyAddress" class="form-control" rows="3">${workspace.companyAddress || ''}</textarea>
                        </div>
                        <div class="form-group" style="margin-top:1rem;">
                            <label for="companyVatId">${t('settings.company_vat_id')}</label>
                            <input type="text" id="companyVatId" data-field="companyVatId" class="form-control" value="${workspace.companyVatId || ''}">
                        </div>
                        <div class="form-group" style="margin-top:1rem;">
                            <label for="companyEmail">${t('settings.company_email')}</label>
                            <input type="email" id="companyEmail" data-field="companyEmail" class="form-control" value="${workspace.companyEmail || ''}">
                        </div>
                        <h4 style="margin-top:2rem;">${t('settings.bank_details')}</h4>
                        <div class="form-group">
                            <label for="companyBankName">${t('settings.bank_name')}</label>
                            <input type="text" id="companyBankName" data-field="companyBankName" class="form-control" value="${workspace.companyBankName || ''}">
                        </div>
                         <div class="form-group" style="margin-top:1rem;">
                            <label for="companyBankAccount">${t('settings.bank_account')}</label>
                            <input type="text" id="companyBankAccount" data-field="companyBankAccount" class="form-control" value="${workspace.companyBankAccount || ''}">
                        </div>
                    </div>
                    <div>
                        <h4>${t('settings.company_logo')}</h4>
                        <div class="form-group">
                             <label>${t('settings.logo_preview')}</label>
                             <div class="logo-preview" style="height: 80px; background-color: var(--light-color); border-radius: var(--border-radius); display:flex; align-items:center; justify-content:center; margin-bottom: 1rem;">
                                ${workspace.companyLogo ? `<img src="${workspace.companyLogo}" style="max-height: 100%; max-width: 100%; object-fit: contain;">` : `<span class="subtle-text">No logo</span>`}
                             </div>
                             <input type="file" id="logo-upload" class="hidden" accept="image/png, image/jpeg">
                             <div style="display:flex; gap: 0.5rem;">
                                <label for="logo-upload" class="btn btn-secondary">${t('settings.upload_logo')}</label>
                                ${workspace.companyLogo ? `<button id="remove-logo-btn" class="btn btn-secondary" style="background-color: var(--danger-color); color: var(--white-color); border-color: var(--danger-color);">${t('settings.remove_logo')}</button>` : ''}
                             </div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                    <span id="workspace-save-status" class="subtle-text" style="transition: opacity 0.3s ease;"></span>
                    <button type="button" id="save-workspace-settings-btn" class="btn btn-primary">${t('modals.save')}</button>
                </div>
            </form>
        `;
    };
    
    const renderIntegrationsSettings = () => {
        const slackIntegration = state.integrations.find(i => i.provider === 'slack' && i.workspaceId === state.activeWorkspaceId);
        const googleDriveIntegration = state.integrations.find(i => i.provider === 'google_drive' && i.workspaceId === state.activeWorkspaceId);

        const integrations = [
            { provider: 'slack', title: t('integrations.slack_title'), desc: t('integrations.slack_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg', enabled: true, instance: slackIntegration },
            { provider: 'google_drive', title: t('integrations.google_drive_title'), desc: t('integrations.google_drive_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/google-drive-2.svg', enabled: true, instance: googleDriveIntegration },
            { provider: 'github', title: t('integrations.github_title'), desc: t('integrations.github_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/github-icon-1.svg', enabled: false },
            { provider: 'figma', title: t('integrations.figma_title'), desc: t('integrations.figma_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/figma-1.svg', enabled: false },
        ];

        return `
            <h4>${t('settings.tab_integrations')}</h4>
            <div class="integrations-grid">
                ${integrations.map(int => {
                    let connectionStatus = '';
                    if (int.instance?.isActive) {
                        if (int.provider === 'slack') {
                            connectionStatus = t('integrations.connected_to').replace('{workspaceName}', int.instance?.settings?.slackWorkspaceName || 'Slack');
                        } else if (int.provider === 'google_drive') {
                            connectionStatus = t('integrations.connected_as').replace('{email}', int.instance?.settings?.googleUserEmail || '');
                        }
                    }

                    return `
                        <div class="integration-card ${!int.enabled ? 'coming-soon' : ''}">
                            <div class="integration-card-header">
                                <div class="integration-card-logo">
                                    <img src="${int.logo}" alt="${int.title} logo">
                                    <h4>${int.title}</h4>
                                </div>
                                <span class="integration-status-badge ${int.instance?.isActive ? 'active' : ''} ${!int.enabled ? 'coming-soon-badge' : ''}">
                                    ${int.instance?.isActive ? 'Connected' : (!int.enabled ? t('integrations.coming_soon') : 'Not Connected')}
                                </span>
                            </div>
                            <p>${int.desc}</p>
                            <div class="integration-card-footer">
                                ${int.enabled ? (
                                    int.instance?.isActive 
                                    ? `
                                        <p class="integration-connection-status">${connectionStatus}</p>
                                        <button class="btn btn-secondary" data-disconnect-provider="${int.provider}">${t('integrations.disconnect')}</button>
                                    `
                                    : `<button class="btn btn-primary" data-connect-provider="${int.provider}">${t('integrations.connect')}</button>`
                                ) : ''}
                            </div>
                        </div>
                    `}).join('')}
            </div>
        `;
    };


    let tabContent = '';
    switch (activeTab) {
        case 'general':
            tabContent = renderGeneralSettings();
            break;
        case 'profile':
            tabContent = renderProfileSettings();
            break;
        case 'customFields':
            if (canManage) tabContent = renderCustomFieldsSettings();
            break;
        case 'workspace':
            if (canManage) tabContent = renderWorkspaceSettings();
            break;
        case 'integrations':
            if (canManage) tabContent = renderIntegrationsSettings();
            break;
    }

    return `
    <div>
        <h2>${t('settings.title')}</h2>
        <div class="settings-tabs">
            <div class="setting-tab ${activeTab === 'general' ? 'active' : ''}" data-tab="general">${t('settings.tab_general')}</div>
            <div class="setting-tab ${activeTab === 'profile' ? 'active' : ''}" data-tab="profile">${t('settings.tab_profile')}</div>
            ${canManage ? `<div class="setting-tab ${activeTab === 'workspace' ? 'active' : ''}" data-tab="workspace">${t('settings.tab_workspace')}</div>` : ''}
            ${canManage ? `<div class="setting-tab ${activeTab === 'integrations' ? 'active' : ''}" data-tab="integrations">${t('settings.tab_integrations')}</div>` : ''}
            ${canManage ? `<div class="setting-tab ${activeTab === 'customFields' ? 'active' : ''}" data-tab="customFields">${t('settings.tab_custom_fields')}</div>` : ''}
        </div>
        <div class="card">
            ${tabContent}
        </div>
    </div>`;
}