




import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { CustomFieldType, TaskView } from '../types.ts';
import { can } from '../permissions.ts';

export function SettingsPage() {
    const { activeTab } = state.ui.settings;
    const canManage = can('manage_workspace_settings');

    const renderGeneralSettings = () => `
        <div class="flex justify-between items-center py-4 border-b border-border-color">
            <div>
                <h4 class="font-semibold">${t('settings.theme')}</h4>
                <p class="text-sm text-text-subtle">${t('settings.theme_desc')}</p>
            </div>
            <select id="theme-switcher" class="w-full max-w-[200px] bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                <option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>${t('settings.theme_light')}</option>
                <option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>${t('settings.theme_dark')}</option>
            </select>
        </div>
        <div class="flex justify-between items-center py-4">
            <div>
                <h4 class="font-semibold">${t('settings.language')}</h4>
                <p class="text-sm text-text-subtle">${t('settings.language_desc')}</p>
            </div>
            <select id="language-switcher" class="w-full max-w-[200px] bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                <option value="en" ${state.settings.language === 'en' ? 'selected' : ''}>${t('settings.english')}</option>
                <option value="pl" ${state.settings.language === 'pl' ? 'selected' : ''}>${t('settings.polish')}</option>
            </select>
        </div>
    `;

    const renderProfileSettings = () => {
        const user = state.currentUser;
        if (!user) return '';

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div class="bg-content p-5 rounded-lg shadow-sm">
                    <h4 class="font-semibold text-lg mb-4">${t('settings.profile_details')}</h4>
                    <form id="update-profile-form" class="space-y-4">
                        <div class="flex flex-col gap-1.5">
                            <label class="text-sm font-medium text-text-subtle">${t('settings.avatar')}</label>
                            <div class="flex items-center gap-4">
                                <div id="avatar-preview" class="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xl font-semibold">
                                    ${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="User avatar" class="w-full h-full rounded-full object-cover">` : user.initials}
                                </div>
                                <label for="avatar-upload" class="cursor-pointer px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background">${t('settings.upload_avatar')}</label>
                                <input type="file" id="avatar-upload" class="hidden" accept="image/png, image/jpeg">
                            </div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label for="profile-full-name" class="text-sm font-medium text-text-subtle">${t('settings.full_name')}</label>
                            <input type="text" id="profile-full-name" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${user.name || ''}" required>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label for="profile-email" class="text-sm font-medium text-text-subtle">${t('settings.email_address')}</label>
                            <input type="email" id="profile-email" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${user.email || ''}" readonly disabled>
                        </div>
                        <div class="flex justify-end items-center gap-3 pt-4">
                            <span id="profile-update-status" class="text-sm transition-opacity duration-300"></span>
                            <button type="submit" class="px-3 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('settings.update_profile')}</button>
                        </div>
                    </form>
                </div>
                <div class="bg-content p-5 rounded-lg shadow-sm">
                    <h4 class="font-semibold text-lg mb-4">${t('settings.change_password')}</h4>
                    <form id="update-password-form" class="space-y-4">
                        <div class="flex flex-col gap-1.5">
                            <label for="password-new" class="text-sm font-medium text-text-subtle">${t('settings.new_password')}</label>
                            <input type="password" id="password-new" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required minlength="6">
                        </div>
                         <div class="flex flex-col gap-1.5">
                            <label for="password-confirm" class="text-sm font-medium text-text-subtle">${t('settings.confirm_new_password')}</label>
                            <input type="password" id="password-confirm" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required minlength="6">
                        </div>
                        <div class="flex justify-end items-center gap-3 pt-4">
                             <span id="password-update-status" class="text-sm transition-opacity duration-300"></span>
                            <button type="submit" class="px-3 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('settings.update_password')}</button>
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
            <div>
                <h4 class="font-semibold text-lg mb-1">${t('settings.tab_custom_fields')}</h4>
                <p class="text-sm text-text-subtle mb-4">Add custom fields to your tasks to capture more specific information.</p>
            </div>
            <div class="bg-content p-5 rounded-lg shadow-sm">
                <div class="divide-y divide-border-color">
                ${customFields.length > 0 ? customFields.map(field => `
                    <div class="flex justify-between items-center py-3">
                        <span class="font-medium">${field.name} <span class="text-text-subtle ml-2 text-xs capitalize">(${t(`settings.field_type_${field.type}`)})</span></span>
                        <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color hover:text-danger" data-field-id="${field.id}" title="${t('modals.remove_item')}"><span class="material-icons-sharp text-lg">delete</span></button>
                    </div>
                `).join('') : `<p class="text-center text-sm text-text-subtle py-8">${t('settings.no_custom_fields')}</p>`}
                </div>
            </div>
            <form id="add-custom-field-form" class="bg-content p-5 rounded-lg shadow-sm mt-6">
                 <div class="flex gap-4 items-end">
                    <div class="flex-grow flex flex-col gap-1.5">
                        <label for="custom-field-name" class="text-sm font-medium text-text-subtle">${t('settings.field_name')}</label>
                        <input type="text" id="custom-field-name" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" required>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label for="custom-field-type" class="text-sm font-medium text-text-subtle">${t('settings.field_type')}</label>
                        <select id="custom-field-type" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                            ${fieldTypes.map(type => `<option value="${type}">${t(`settings.field_type_${type}`)}</option>`).join('')}
                        </select>
                    </div>
                    <button type="submit" class="px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background">${t('settings.add_field')}</button>
                </div>
            </form>
        `;
    };

    const renderWorkspaceSettings = () => {
        const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (!workspace) return '';
        
        return `
            <form id="workspace-settings-form">
                <div class="bg-content p-5 rounded-lg shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="md:col-span-2 space-y-4">
                            <h4 class="font-semibold text-lg">${t('settings.company_details')}</h4>
                            <div class="flex flex-col gap-1.5">
                                <label for="companyName" class="text-sm font-medium text-text-subtle">${t('settings.company_name')}</label>
                                <input type="text" id="companyName" data-field="companyName" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${workspace.companyName || ''}">
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <label for="companyAddress" class="text-sm font-medium text-text-subtle">${t('settings.company_address')}</label>
                                <textarea id="companyAddress" data-field="companyAddress" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" rows="3">${workspace.companyAddress || ''}</textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1.5">
                                    <label for="companyVatId" class="text-sm font-medium text-text-subtle">${t('settings.company_vat_id')}</label>
                                    <input type="text" id="companyVatId" data-field="companyVatId" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${workspace.companyVatId || ''}">
                                </div>
                                 <div class="flex flex-col gap-1.5">
                                    <label for="companyEmail" class="text-sm font-medium text-text-subtle">${t('settings.company_email')}</label>
                                    <input type="email" id="companyEmail" data-field="companyEmail" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${workspace.companyEmail || ''}">
                                </div>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <h4 class="font-semibold text-lg">${t('settings.company_logo')}</h4>
                            <div class="flex flex-col gap-1.5">
                                 <label class="text-sm font-medium text-text-subtle">${t('settings.logo_preview')}</label>
                                 <div class="h-24 bg-background border border-border-color rounded-md flex items-center justify-center">
                                    ${workspace.companyLogo ? `<img src="${workspace.companyLogo}" class="max-h-full max-w-full object-contain p-2">` : `<span class="text-text-subtle text-sm">No logo</span>`}
                                 </div>
                                 <input type="file" id="logo-upload" class="hidden" accept="image/png, image/jpeg">
                                 <div class="flex gap-2">
                                    <label for="logo-upload" class="cursor-pointer px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background">${t('settings.upload_logo')}</label>
                                    ${workspace.companyLogo ? `<button id="remove-logo-btn" class="px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background text-danger">${t('settings.remove_logo')}</button>` : ''}
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
                 <div class="bg-content p-5 rounded-lg shadow-sm mt-6">
                    <h4 class="font-semibold text-lg mb-4">${t('settings.bank_details')}</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <label for="companyBankName" class="text-sm font-medium text-text-subtle">${t('settings.bank_name')}</label>
                            <input type="text" id="companyBankName" data-field="companyBankName" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${workspace.companyBankName || ''}">
                        </div>
                         <div class="flex flex-col gap-1.5">
                            <label for="companyBankAccount" class="text-sm font-medium text-text-subtle">${t('settings.bank_account')}</label>
                            <input type="text" id="companyBankAccount" data-field="companyBankAccount" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${workspace.companyBankAccount || ''}">
                        </div>
                    </div>
                </div>
                <div class="flex justify-end items-center gap-3 mt-8 pt-4 border-t border-border-color">
                    <span id="workspace-save-status" class="text-sm transition-opacity duration-300"></span>
                    <button type="button" id="save-workspace-settings-btn" class="px-3 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('modals.save')}</button>
                </div>
            </form>
        `;
    };
    
    const renderIntegrationsSettings = () => {
        const slackIntegration = state.integrations.find(i => i.provider === 'slack' && i.workspaceId === state.activeWorkspaceId);
        const googleDriveIntegration = state.integrations.find(i => i.provider === 'google_drive' && i.workspaceId === state.activeWorkspaceId);
        const gmailIntegration = state.integrations.find(i => i.provider === 'google_gmail' && i.workspaceId === state.activeWorkspaceId);

        const integrations = [
            { provider: 'slack', title: t('integrations.slack_title'), desc: t('integrations.slack_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg', enabled: true, instance: slackIntegration },
            { provider: 'google_drive', title: t('integrations.google_drive_title'), desc: t('integrations.google_drive_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/google-drive-2.svg', enabled: true, instance: googleDriveIntegration },
            { provider: 'google_gmail', title: t('integrations.gmail_title'), desc: t('integrations.gmail_desc'), logo: 'https://www.vectorlogo.zone/logos/gmail/gmail-icon.svg', enabled: true, instance: gmailIntegration },
            { provider: 'github', title: t('integrations.github_title'), desc: t('integrations.github_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/github-icon-1.svg', enabled: false },
            { provider: 'figma', title: t('integrations.figma_title'), desc: t('integrations.figma_desc'), logo: 'https://cdn.worldvectorlogo.com/logos/figma-1.svg', enabled: false },
        ];

        return `
            <div>
                <h4 class="font-semibold text-lg mb-1">${t('settings.tab_integrations')}</h4>
                <p class="text-sm text-text-subtle mb-4">Connect your other tools to Kombajn to streamline your workflow.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${integrations.map(int => {
                    let connectionStatus = '';
                    if (int.instance?.isActive) {
                        if (int.provider === 'slack') {
                            connectionStatus = t('integrations.connected_to').replace('{workspaceName}', int.instance?.settings?.slackWorkspaceName || 'Slack');
                        } else if (int.provider === 'google_drive' || int.provider === 'google_gmail') {
                            connectionStatus = t('integrations.connected_as').replace('{email}', int.instance?.settings?.googleUserEmail || '');
                        }
                    }

                    return `
                        <div class="bg-content p-5 rounded-lg shadow-sm flex flex-col ${!int.enabled ? 'opacity-50' : ''}">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <img src="${int.logo}" alt="${int.title} logo" class="w-8 h-8">
                                    <h4 class="font-semibold">${int.title}</h4>
                                </div>
                                <span class="px-2 py-1 text-xs font-semibold rounded-full ${int.instance?.isActive ? 'bg-success/10 text-success' : (!int.enabled ? 'bg-background' : 'bg-background')}">
                                    ${int.instance?.isActive ? 'Connected' : (!int.enabled ? t('integrations.coming_soon') : 'Not Connected')}
                                </span>
                            </div>
                            <p class="text-sm text-text-subtle my-3 flex-grow">${int.desc}</p>
                            <div class="flex justify-between items-center mt-auto pt-3 border-t border-border-color">
                                <p class="text-xs text-text-subtle">${connectionStatus}</p>
                                ${int.enabled ? (
                                    int.instance?.isActive 
                                    ? `<button class="px-3 py-1.5 text-xs font-medium rounded-md bg-content border border-border-color hover:bg-background text-danger" data-disconnect-provider="${int.provider}">${t('integrations.disconnect')}</button>`
                                    : `<button class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-hover" data-connect-provider="${int.provider}">${t('integrations.connect')}</button>`
                                ) : ''}
                            </div>
                        </div>
                    `}).join('')}
            </div>
        `;
    };
    
    const renderTaskViewsSettings = () => {
        const taskViews = state.taskViews.filter(tv => tv.workspaceId === state.activeWorkspaceId);
        return `
            <div>
                <h4 class="font-semibold text-lg mb-1">${t('settings.tab_task_views')}</h4>
                <p class="text-sm text-text-subtle mb-4">Create custom task boards that will appear in your sidebar for quick access.</p>
            </div>
            <div class="bg-content p-5 rounded-lg shadow-sm">
                <div class="divide-y divide-border-color">
                    ${taskViews.map(view => `
                        <div class="py-3 task-view-item" data-view-id="${view.id}">
                            <div class="view-mode flex justify-between items-center">
                                <div class="flex items-center gap-3">
                                    <span class="material-icons-sharp">${view.icon}</span>
                                    <span class="font-medium">${view.name}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button class="btn-icon edit-task-view-btn"><span class="material-icons-sharp text-base">edit</span></button>
                                    <button class="btn-icon delete-task-view-btn" data-view-id="${view.id}"><span class="material-icons-sharp text-base text-danger">delete</span></button>
                                </div>
                            </div>
                            <div class="edit-mode hidden mt-2">
                                <div class="flex gap-2 items-end">
                                    <div class="flex-1">
                                        <label class="text-xs font-medium text-text-subtle">${t('settings.view_name')}</label>
                                        <input type="text" name="view-name" class="form-control" value="${view.name}">
                                    </div>
                                    <div class="flex-1">
                                        <label class="text-xs font-medium text-text-subtle">${t('settings.icon')}</label>
                                        <input type="text" name="view-icon" class="form-control" value="${view.icon}">
                                    </div>
                                    <button class="btn btn-secondary cancel-task-view-edit-btn">${t('modals.cancel')}</button>
                                    <button class="btn btn-primary save-task-view-btn">${t('modals.save')}</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="bg-content p-5 rounded-lg shadow-sm mt-6">
                <div class="flex gap-4 items-end">
                    <div class="flex-grow">
                        <label for="new-task-view-name" class="text-sm font-medium text-text-subtle">${t('settings.view_name')}</label>
                        <input type="text" id="new-task-view-name" class="form-control" required>
                    </div>
                    <div>
                        <label for="new-task-view-icon" class="text-sm font-medium text-text-subtle">${t('settings.icon')}</label>
                        <input type="text" id="new-task-view-icon" class="form-control" value="checklist">
                    </div>
                    <button id="add-task-view-btn" class="btn btn-secondary">${t('settings.add_view')}</button>
                </div>
            </div>
        `;
    };

    const renderPipelineSettings = () => {
        const stages = state.pipelineStages
            .filter(s => s.workspaceId === state.activeWorkspaceId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
        const openStages = stages.filter(s => s.category === 'open');
        const wonStage = stages.find(s => s.category === 'won');
        const lostStage = stages.find(s => s.category === 'lost');
    
        const renderStageRow = (stage: any, isDraggable: boolean) => `
            <div class="flex items-center gap-3 p-3 bg-background rounded-md pipeline-stage-row" data-stage-id="${stage.id}" ${isDraggable ? 'draggable="true"' : ''}>
                ${isDraggable ? `<span class="material-icons-sharp text-text-subtle cursor-move">drag_indicator</span>` : ''}
                <input type="text" class="form-control" value="${stage.name}" data-stage-name-id="${stage.id}" ${!isDraggable ? 'disabled' : ''}>
                ${isDraggable ? `
                <div class="flex items-center gap-1">
                    <button class="btn-icon" data-save-pipeline-stage="${stage.id}" title="${t('modals.save')}"><span class="material-icons-sharp text-base">save</span></button>
                    <button class="btn-icon" data-delete-pipeline-stage="${stage.id}" title="${t('modals.delete')}"><span class="material-icons-sharp text-base text-danger">delete</span></button>
                </div>
                ` : ''}
            </div>
        `;
    
        return `
            <div>
                <h4 class="font-semibold text-lg mb-1">${t('settings.tab_pipeline')}</h4>
                <p class="text-sm text-text-subtle mb-4">Customize the stages of your sales pipeline.</p>
            </div>
            <div class="bg-content p-5 rounded-lg shadow-sm">
                <h5 class="font-semibold mb-2">${t('settings.deal_stages')}</h5>
                <p class="text-xs text-text-subtle mb-4">${t('settings.drag_to_reorder')}</p>
                <div id="pipeline-stages-list" class="space-y-2">
                    ${openStages.map(stage => renderStageRow(stage, true)).join('')}
                    ${wonStage ? renderStageRow(wonStage, false) : ''}
                    ${lostStage ? renderStageRow(lostStage, false) : ''}
                </div>
            </div>
            <form id="add-pipeline-stage-form" class="bg-content p-5 rounded-lg shadow-sm mt-6">
                 <div class="flex gap-4 items-end">
                    <div class="flex-grow">
                        <label for="new-stage-name" class="text-sm font-medium text-text-subtle">${t('settings.stage_name')}</label>
                        <input type="text" id="new-stage-name" name="stage-name" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-secondary">${t('settings.add_stage')}</button>
                </div>
            </form>
        `;
    };

    const renderKanbanSettings = () => {
        const stages = state.kanbanStages
            .filter(s => s.workspaceId === state.activeWorkspaceId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
        
        return `
            <div>
                <h4 class="font-semibold text-lg mb-1">${t('settings.tab_kanban')}</h4>
                <p class="text-sm text-text-subtle mb-4">Customize the name and order of your task board columns.</p>
            </div>
            <div class="bg-content p-5 rounded-lg shadow-sm">
                <h5 class="font-semibold mb-2">Kanban Columns</h5>
                <p class="text-xs text-text-subtle mb-4">${t('settings.drag_to_reorder')}</p>
                <div id="kanban-stages-list" class="space-y-2">
                    ${stages.map(stage => `
                        <div class="flex items-center gap-3 p-3 bg-background rounded-md kanban-stage-row" data-stage-id="${stage.id}" draggable="true">
                            <span class="material-icons-sharp text-text-subtle cursor-move">drag_indicator</span>
                            <input type="text" class="form-control" value="${stage.name}" data-stage-name-id="${stage.id}">
                            <div class="flex items-center gap-1">
                                <button class="btn-icon" data-save-kanban-stage="${stage.id}" title="${t('modals.save')}"><span class="material-icons-sharp text-base">save</span></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    let tabContent = '';
    switch (activeTab) {
        case 'general': tabContent = renderGeneralSettings(); break;
        case 'profile': tabContent = renderProfileSettings(); break;
        case 'customFields': if (canManage) tabContent = renderCustomFieldsSettings(); break;
        case 'workspace': if (canManage) tabContent = renderWorkspaceSettings(); break;
        case 'integrations': if (canManage) tabContent = renderIntegrationsSettings(); break;
        case 'taskViews': if (canManage) tabContent = renderTaskViewsSettings(); break;
        case 'pipeline': if (canManage) tabContent = renderPipelineSettings(); break;
        case 'kanban': if (canManage) tabContent = renderKanbanSettings(); break;
    }

    const navItems = [
        { id: 'general', icon: 'tune', text: t('settings.tab_general'), permission: null },
        { id: 'profile', icon: 'account_circle', text: t('settings.tab_profile'), permission: null },
        { id: 'workspace', icon: 'corporate_fare', text: t('settings.tab_workspace'), permission: 'manage_workspace_settings' },
        { id: 'integrations', icon: 'integration_instructions', text: t('settings.tab_integrations'), permission: 'manage_workspace_settings' },
        { id: 'pipeline', icon: 'view_kanban', text: t('settings.tab_pipeline'), permission: 'manage_workspace_settings' },
        { id: 'kanban', icon: 'view_week', text: t('settings.tab_kanban'), permission: 'manage_workspace_settings' },
        { id: 'customFields', icon: 'ballot', text: t('settings.tab_custom_fields'), permission: 'manage_workspace_settings' },
        { id: 'taskViews', icon: 'view_list', text: t('settings.tab_task_views'), permission: 'manage_workspace_settings' },
    ];

    const availableNavItems = navItems.filter(item => !item.permission || can(item.permission as any));

    return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">${t('settings.title')}</h2>
            <div class="flex flex-col md:flex-row gap-8">
                <nav class="flex flex-row md:flex-col md:w-56 shrink-0 overflow-x-auto -mx-4 px-4 md:m-0 md:p-0">
                    <ul class="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-1">
                        ${availableNavItems.map(item => `
                            <li>
                                <a href="#" class="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === item.id ? 'bg-primary/10 text-primary' : 'hover:bg-background'}" data-tab="${item.id}">
                                    <span class="material-icons-sharp">${item.icon}</span>
                                    ${item.text}
                                </a>
                            </li>
                        `).join('')}
                    </ul>
                </nav>
                <main class="flex-1">
                    ${tabContent}
                </main>
            </div>
        </div>
    `;
}