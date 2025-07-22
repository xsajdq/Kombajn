import { t } from '../i18n.ts';
import { can } from '../permissions.ts';

export function FloatingActionButton() {
    const options: { modal: string, text: string, icon: string, permission: any }[] = [
        { modal: 'addProject', text: t('dashboard.action_new_project'), icon: 'create_new_folder', permission: 'create_projects' },
        { modal: 'addClient', text: t('dashboard.action_add_client'), icon: 'person_add', permission: 'manage_clients' },
        { modal: 'addTask', text: t('tasks.new_task'), icon: 'add_task', permission: 'manage_tasks' },
    ];

    const availableOptions = options.filter(opt => can(opt.permission));

    return `
        <div class="fab-container" id="fab-container">
            <div class="fab-options">
                ${availableOptions.reverse().map(opt => `
                    <button class="fab-option" data-modal-target="${opt.modal}">
                        <span class="font-medium text-sm">${opt.text}</span>
                        <span class="material-icons-sharp text-primary">${opt.icon}</span>
                    </button>
                `).join('')}
            </div>
            <button class="fab-main" id="fab-main-btn" aria-label="Quick actions">
                <span class="material-icons-sharp">add</span>
            </button>
        </div>
    `;
}