import { getState } from '../state.ts';
import { closeModal } from './ui.ts';
import { createNotification } from './notifications.ts';
import { getUsage, PLANS, parseDurationStringToHours, parseDurationStringToSeconds } from '../utils.ts';
import type { Invoice, InvoiceLineItem, Task, ProjectMember, Project, ProjectTemplate, Channel, Automation, Objective, KeyResult, Expense, TimeOffRequest, CalendarEvent, Deal, Client, ClientContact, TaskTag, Review, InventoryItem, InventoryAssignment, Budget } from '../types.ts';
import { t } from '../i18n.ts';
import { renderApp, updateUI } from '../app-renderer.ts';
import * as timerHandlers from './timers.ts';
import * as hrHandlers from './team.ts';
import * as dashboardHandlers from './dashboard.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import * as okrHandler from './okr.ts';
import * as dealHandler from './deals.ts';
import * as projectHandlers from './projects.ts';
import { getWorkspaceKanbanWorkflow } from './main.ts';
import * as projectSectionHandlers from './projectSections.ts';
import { generateInvoicePDF } from '../services.ts';

export async function handleFormSubmit() {
    const state = getState();
    const { type, data } = state.ui.modal;
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId || !state.currentUser) return;

    // The task detail modal has its own internal forms (like comments)
    // which are handled by specific submit listeners, not this generic one.
    if (type === 'taskDetail') {
        return;
    }

    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;
    const usage = getUsage(activeWorkspaceId);
    const planLimits = PLANS[workspace.subscription.planId];

    try {
        if (type === 'addClient') {
            const form = document.getElementById('clientForm') as HTMLFormElement;
            const clientId = (form.querySelector('#clientId') as HTMLInputElement).value;
            const name = (form.querySelector('#clientName') as HTMLInputElement).value;
            if (!name) return;

            const clientData: Partial<Client> = {
                workspaceId: activeWorkspaceId,
                name: name,
                vatId: (form.querySelector('#clientVatId') as HTMLInputElement).value,
                category: (form.querySelector('#clientCategory') as HTMLInputElement).value || undefined,
                healthStatus: (form.querySelector('#clientHealthStatus') as HTMLSelectElement).value as Client['healthStatus'] || null,
                status: (form.querySelector('#clientStatus') as HTMLSelectElement).value as Client['status'] || 'active',
            };

            let savedClient: Client;

            if (clientId) {
                [savedClient] = await apiPut('clients', { ...clientData, id: clientId });
                const index = state.clients.findIndex(c => c.id === clientId);
                if (index !== -1) {
                    state.clients[index] = { ...state.clients[index], ...savedClient };
                }
            } else {
                [savedClient] = await apiPost('clients', clientData);
                state.clients.push({ ...savedClient, contacts: [] });
            }

            // Handle contacts
            const contactRows = form.querySelectorAll<HTMLElement>('.contact-form-row');
            const contactPromises: Promise<any>[] = [];

            contactRows.forEach(row => {
                const nameInput = row.querySelector<HTMLInputElement>('[data-field="name"]');
                if (!nameInput || !nameInput.value.trim()) {
                    return; // Skip empty/newly added but unfilled rows
                }

                const contactId = row.dataset.contactId!;
                const isNew = contactId.startsWith('new-');
                
                const contactPayload = {
                    id: isNew ? undefined : contactId,
                    clientId: savedClient.id,
                    workspaceId: activeWorkspaceId,
                    name: nameInput.value.trim(),
                    email: (row.querySelector<HTMLInputElement>('[data-field="email"]'))!.value.trim() || undefined,
                    phone: (row.querySelector<HTMLInputElement>('[data-field="phone"]'))!.value.trim() || undefined,
                    role: (row.querySelector<HTMLInputElement>('[data-field="role"]'))!.value.trim() || undefined,
                };

                if (isNew) {
                    contactPromises.push(apiPost('client_contacts', contactPayload));
                } else {
                    contactPromises.push(apiPut('client_contacts', contactPayload));
                }
            });

            const deletedContactIds = (document.getElementById('deleted-contact-ids') as HTMLInputElement).value.split(',').filter(Boolean);
            deletedContactIds.forEach(id => {
                contactPromises.push(apiFetch('/api?action=data&resource=client_contacts', { method: 'DELETE', body: JSON.stringify({ id }) }));
            });

            await Promise.all(contactPromises.map(p => p.catch(e => console.error("Contact save error:", e))));
            
            // Update client in state with all fresh contacts from DB
            const clientInState = state.clients.find(c => c.id === savedClient.id);
            if (clientInState) {
                const allContactsForClient = await apiFetch(`/api?action=data&resource=client_contacts&clientId=${savedClient.id}`);
                clientInState.contacts = allContactsForClient || [];
            }
        }

        if (type === 'addProject') {
            const form = document.getElementById('projectForm') as HTMLFormElement;
            const projectId = (form.querySelector('#projectId') as HTMLInputElement).value;
            const isEdit = !!projectId;

            if (!isEdit && usage.projects >= planLimits.projects) {
                alert(t('billing.limit_reached_projects').replace('{planName}', workspace.subscription.planId));
                return;
            }

            const name = (document.getElementById('projectName') as HTMLInputElement).value;
            const clientId = (document.getElementById('projectClient') as HTMLSelectElement).value;
            if (!name || !clientId) return;

            const projectData: Partial<Project> = {
                workspaceId: activeWorkspaceId,
                name: name,
                clientId: clientId,
                wikiContent: isEdit ? state.projects.find(p => p.id === projectId)!.wikiContent : '',
                hourlyRate: parseFloat((document.getElementById('projectHourlyRate') as HTMLInputElement).value) || undefined,
                privacy: (document.querySelector('input[name="privacy"]:checked') as HTMLInputElement).value as Project['privacy'],
                budgetHours: parseFloat((document.getElementById('projectBudgetHours') as HTMLInputElement).value) || undefined,
                budgetCost: parseFloat((document.getElementById('projectBudgetCost') as HTMLInputElement).value) || undefined,
                category: (document.getElementById('projectCategory') as HTMLInputElement).value || undefined,
            };

            let savedProject;

            if (isEdit) {
                [savedProject] = await apiPut('projects', { ...projectData, id: projectId });
                const index = state.projects.findIndex(p => p.id === projectId);
                if (index !== -1) {
                    state.projects[index] = { ...state.projects[index], ...savedProject };
                }
            } else {
                [savedProject] = await apiPost('projects', projectData);
                state.projects.push(savedProject);
    
                // ALWAYS add the creator as admin
                const creatorMember: Omit<ProjectMember, 'id'> = {
                    projectId: savedProject.id,
                    userId: state.currentUser.id,
                    role: 'admin'
                };
                const [savedCreatorMember] = await apiPost('project_members', creatorMember);
                state.projectMembers.push(savedCreatorMember);
            }
            
             // Handle tags
            const tagCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="project_tags"]:checked');
            const newTagIds = new Set(Array.from(tagCheckboxes).map(cb => cb.value));
            await projectHandlers.handleSyncProjectTags(savedProject.id, newTagIds);


            // Handle members for both edit and create
            if (projectData.privacy === 'private') {
                const memberCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="project_members"]:checked');
                const newMemberIds = new Set(Array.from(memberCheckboxes).map(cb => cb.value));
                
                if (isEdit) {
                    await projectHandlers.handleSyncProjectMembers(savedProject.id, newMemberIds);
                } else if (newMemberIds.size > 0) {
                     const membersToAdd: Omit<ProjectMember, 'id'>[] = Array.from(newMemberIds)
                        .filter(id => id !== state.currentUser!.id) // Don't re-add creator
                        .map(userId => ({ projectId: savedProject.id, userId, role: 'editor' }));
                    if(membersToAdd.length > 0) {
                        const savedMembers = await apiPost('project_members', membersToAdd);
                        state.projectMembers.push(...savedMembers);
                    }
                }
            } else if (isEdit && projectData.privacy === 'public') {
                // If switching from private to public, remove all non-creator members
                await projectHandlers.handleSyncProjectMembers(savedProject.id, new Set([state.currentUser.id]));
            }
        }

        if (type === 'aiProjectPlanner') {
            const name = (document.getElementById('aiProjectName') as HTMLInputElement).value;
            const clientId = (document.getElementById('aiProjectClient') as HTMLSelectElement).value;
            const goal = (document.getElementById('aiProjectGoal') as HTMLTextAreaElement).value;
            if (!name || !clientId || !goal) {
                alert("Please fill all fields.");
                return;
            }
            await projectHandlers.handlePlanProjectWithAi(name, clientId, goal);
            return;
        }

        if (type === 'addGoal') {
            const form = document.getElementById('addGoalForm') as HTMLFormElement;
            const goalId = form.dataset.goalId;
            const isEdit = !!goalId;

            const title = (form.querySelector('#goalTitle') as HTMLInputElement).value;