

import { state, saveState, generateId } from '../state.ts';
import { closeModal } from './ui.ts';
import { createNotification } from './notifications.ts';
import { getUsage, PLANS } from '../utils.ts';
import type { Invoice, InvoiceLineItem, Task, ProjectMember, Project, ProjectTemplate, Channel, Automation, Objective, KeyResult, Expense, TimeOffRequest, CalendarEvent, Deal, Client } from '../types.ts';
import { t } from '../i18n.ts';
import { renderApp } from '../app-renderer.ts';
import * as timerHandlers from './timers.ts';
import * as hrHandlers from './team.ts';
import { handleWidgetConfigSave } from './dashboard.ts';
import { apiPost, apiPut } from '../services/api.ts';

export async function handleFormSubmit() {
    const { type, data } = state.ui.modal;
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId || !state.currentUser) return;

    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;
    const usage = getUsage(activeWorkspaceId);
    const planLimits = PLANS[workspace.subscription.planId];

    try {
        if (type === 'addClient') {
            const clientId = (document.getElementById('clientId') as HTMLInputElement).value;
            const name = (document.getElementById('clientName') as HTMLInputElement).value;
            if (!name) return;

            const clientData: Partial<Client> = {
                workspaceId: activeWorkspaceId,
                name: name,
                vatId: (document.getElementById('clientVatId') as HTMLInputElement).value,
                contactPerson: (document.getElementById('clientContact') as HTMLInputElement).value,
                email: (document.getElementById('clientEmail') as HTMLInputElement).value,
                phone: (document.getElementById('clientPhone') as HTMLInputElement).value,
            };

            if (clientId) { // This is an UPDATE
                const [updatedClient] = await apiPut('clients', { ...clientData, id: clientId });
                const index = state.clients.findIndex(c => c.id === clientId);
                if (index !== -1) {
                    state.clients[index] = updatedClient;
                }
            } else { // This is a CREATE
                const [newClient] = await apiPost('clients', clientData);
                state.clients.push(newClient);
            }
        }

        if (type === 'addProject') {
            if (usage.projects >= planLimits.projects) {
                alert(t('billing.limit_reached_projects').replace('{planName}', workspace.subscription.planId));
                return;
            }
            const name = (document.getElementById('projectName') as HTMLInputElement).value;
            const clientId = (document.getElementById('projectClient') as HTMLSelectElement).value;
            if (!name || !clientId) return;

            const projectData = {
                workspaceId: activeWorkspaceId,
                name: name,
                clientId: clientId,
                wikiContent: '',
                hourlyRate: parseFloat((document.getElementById('projectHourlyRate') as HTMLInputElement).value) || null,
                privacy: (document.querySelector('input[name="privacy"]:checked') as HTMLInputElement).value as Project['privacy'],
            };
            
            const [newProject] = await apiPost('projects', projectData);
            state.projects.push(newProject);
            // Additional local logic (like creating channels or template tasks) would go here
        }

        if (type === 'addTask') {
            const name = (document.getElementById('taskName') as HTMLInputElement).value;
            const projectId = (document.getElementById('taskProject') as HTMLSelectElement).value;
            if (!name || !projectId) return;

            const taskData = {
                workspaceId: activeWorkspaceId,
                projectId: projectId,
                name: name,
                description: (document.getElementById('taskDescription') as HTMLTextAreaElement).value,
                assigneeId: (document.getElementById('taskAssignee') as HTMLSelectElement).value || null,
                status: state.settings.defaultKanbanWorkflow === 'advanced' ? 'backlog' : 'todo',
                startDate: (document.getElementById('taskStartDate') as HTMLInputElement).value || null,
                dueDate: (document.getElementById('taskDueDate') as HTMLInputElement).value || null,
                priority: (document.getElementById('taskPriority') as HTMLSelectElement).value || null,
            };

            const [newTask] = await apiPost('tasks', taskData);
            state.tasks.push(newTask);
            // Handle notifications
            if (newTask.assigneeId && state.currentUser && newTask.assigneeId !== state.currentUser.id) {
                createNotification('new_assignment', { taskId: newTask.id, userIdToNotify: newTask.assigneeId, actorId: state.currentUser.id });
            }
        }

        if (type === 'addDeal') {
            const name = (document.getElementById('dealName') as HTMLInputElement).value;
            const clientId = (document.getElementById('dealClient') as HTMLSelectElement).value;
            const value = parseFloat((document.getElementById('dealValue') as HTMLInputElement).value);
            if (!name || !clientId || isNaN(value)) return;
            
            const dealData = {
                workspaceId: activeWorkspaceId,
                name,
                clientId,
                value,
                ownerId: (document.getElementById('dealOwner') as HTMLSelectElement).value,
                stage: (document.getElementById('dealStage') as HTMLSelectElement).value as Deal['stage'],
                expectedCloseDate: (document.getElementById('dealExpectedCloseDate') as HTMLInputElement).value || null,
                createdAt: new Date().toISOString()
            };

            const [newDeal] = await apiPost('deals', dealData);
            state.deals.push(newDeal);
        }

        // The logic for other forms would follow a similar pattern:
        // 1. Get data from the form.
        // 2. Call `apiPost(resource, data)`.
        // 3. Push the returned object into the local state.
        
        closeModal();
        renderApp();

    } catch (error) {
        console.error("Form submission failed:", error);
        alert(`Error: ${(error as Error).message}`);
    }
}
