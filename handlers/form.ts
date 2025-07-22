





import { state } from '../state.ts';
import { closeModal } from './ui.ts';
import { createNotification } from './notifications.ts';
import { getUsage, PLANS, parseDurationStringToHours } from '../utils.ts';
import type { Invoice, InvoiceLineItem, Task, ProjectMember, Project, ProjectTemplate, Channel, Automation, Objective, KeyResult, Expense, TimeOffRequest, CalendarEvent, Deal, Client, ClientContact } from '../types.ts';
import { t } from '../i18n.ts';
import { renderApp } from '../app-renderer.ts';
import * as timerHandlers from './timers.ts';
import * as hrHandlers from './team.ts';
import * as dashboardHandlers from './dashboard.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import * as okrHandler from './okr.ts';
import * as dealHandler from './deals.ts';
import * as projectHandlers from './projects.ts';
import { getWorkspaceKanbanWorkflow } from './main.ts';

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
            const form = document.getElementById('clientForm') as HTMLFormElement;
            const clientId = (form.querySelector('#clientId') as HTMLInputElement).value;
            const name = (form.querySelector('#clientName') as HTMLInputElement).value;
            if (!name) return;

            const clientData: Partial<Client> = {
                workspaceId: activeWorkspaceId,
                name: name,
                vatId: (form.querySelector('#clientVatId') as HTMLInputElement).value,
                category: (form.querySelector('#clientCategory') as HTMLInputElement).value || null,
                healthStatus: (form.querySelector('#clientHealthStatus') as HTMLSelectElement).value as Client['healthStatus'] || null,
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
            const updatedContacts: ClientContact[] = [];

            contactRows.forEach(row => {
                const contactId = row.dataset.contactId!;
                const isNew = contactId.startsWith('new-');
                const contactPayload = {
                    id: isNew ? undefined : contactId,
                    clientId: savedClient.id,
                    workspaceId: activeWorkspaceId,
                    name: (row.querySelector<HTMLInputElement>('[data-field="name"]'))!.value,
                    email: (row.querySelector<HTMLInputElement>('[data-field="email"]'))!.value,
                    phone: (row.querySelector<HTMLInputElement>('[data-field="phone"]'))!.value,
                    role: (row.querySelector<HTMLInputElement>('[data-field="role"]'))!.value,
                };
                if (!contactPayload.name) return;

                if (isNew) {
                    contactPromises.push(apiPost('client_contacts', contactPayload));
                } else {
                    contactPromises.push(apiPut('client_contacts', contactPayload));
                }
            });

            const deletedContactIds = (document.getElementById('deleted-contact-ids') as HTMLInputElement).value.split(',').filter(Boolean);
            deletedContactIds.forEach(id => {
                contactPromises.push(apiFetch('/api/data/client_contacts', { method: 'DELETE', body: JSON.stringify({ id }) }));
            });

            const settledContacts = await Promise.all(contactPromises.map(p => p.catch(e => e)));
            const successfulContacts = settledContacts.flat().filter(c => c && !(c instanceof Error));
            
            // Update client in state with all contacts
            const clientInState = state.clients.find(c => c.id === savedClient.id);
            if (clientInState) {
                const allContacts = await apiFetch(`/api/data/client_contacts?clientId=${savedClient.id}`);
                clientInState.contacts = allContacts || [];
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

            const projectData: Partial<Project> = {
                workspaceId: activeWorkspaceId,
                name: name,
                clientId: clientId,
                wikiContent: '',
                hourlyRate: parseFloat((document.getElementById('projectHourlyRate') as HTMLInputElement).value) || undefined,
                privacy: (document.querySelector('input[name="privacy"]:checked') as HTMLInputElement).value as Project['privacy'],
                budgetHours: parseFloat((document.getElementById('projectBudgetHours') as HTMLInputElement).value) || undefined,
                budgetCost: parseFloat((document.getElementById('projectBudgetCost') as HTMLInputElement).value) || undefined,
                category: (document.getElementById('projectCategory') as HTMLInputElement).value || undefined,
            };
            
            const [newProject] = await apiPost('projects', projectData);
            state.projects.push(newProject);

            // ALWAYS add the creator as admin
            const creatorMember: Omit<ProjectMember, 'id'> = {
                workspaceId: activeWorkspaceId,
                projectId: newProject.id,
                userId: state.currentUser.id,
                role: 'admin'
            };
            const [savedCreatorMember] = await apiPost('project_members', creatorMember);
            state.projectMembers.push(savedCreatorMember);


            // If project is private, add selected members
            if (newProject.privacy === 'private') {
                const memberCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="project_members"]:checked');
                const memberIds = Array.from(memberCheckboxes).map(cb => cb.value);

                const membersToAdd: Omit<ProjectMember, 'id'>[] = memberIds
                    .filter(id => id !== state.currentUser!.id) // Don't re-add creator
                    .map(userId => ({
                        workspaceId: activeWorkspaceId,
                        projectId: newProject.id,
                        userId: userId,
                        role: 'editor' // Default role for invited members
                    }));

                if (membersToAdd.length > 0) {
                    const savedMembers = await apiPost('project_members', membersToAdd);
                    state.projectMembers.push(...savedMembers);
                }
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

        if (type === 'addTask') {
            const name = (document.getElementById('taskName') as HTMLInputElement).value;
            const projectId = (document.getElementById('taskProject') as HTMLSelectElement).value;
            if (!name) return;
            if (!projectId) {
                alert(t('modals.select_a_project_error'));
                return;
            }
            
            const estimatedHoursString = (document.getElementById('taskEstimatedHours') as HTMLInputElement).value;

            const assigneeId = (document.getElementById('taskAssignee') as HTMLSelectElement).value || null;
            const workflow = getWorkspaceKanbanWorkflow(activeWorkspaceId);

            const taskData: Partial<Task> = {
                workspaceId: activeWorkspaceId,
                projectId: projectId,
                name: name,
                description: (document.getElementById('taskDescription') as HTMLTextAreaElement).value,
                status: workflow === 'advanced' ? 'backlog' : 'todo',
                startDate: (document.getElementById('taskStartDate') as HTMLInputElement).value || undefined,
                dueDate: (document.getElementById('taskDueDate') as HTMLInputElement).value || undefined,
                priority: ((document.getElementById('taskPriority') as HTMLSelectElement).value as Task['priority']) || null,
                estimatedHours: parseDurationStringToHours(estimatedHoursString),
                type: ((document.getElementById('taskType') as HTMLSelectElement).value as Task['type']) || null,
            };

            if (data?.dealId) {
                taskData.dealId = data.dealId;
            }

            const [newTask] = await apiPost('tasks', taskData);
            state.tasks.push(newTask);
            
            if (assigneeId) {
                const assigneeData = {
                    workspaceId: activeWorkspaceId,
                    taskId: newTask.id,
                    userId: assigneeId
                };
                const [newTaskAssignee] = await apiPost('task_assignees', assigneeData);
                state.taskAssignees.push(newTaskAssignee);
            }

            if (assigneeId && state.currentUser && assigneeId !== state.currentUser.id) {
                await createNotification('new_assignment', { taskId: newTask.id, userIdToNotify: assigneeId, actorId: state.currentUser.id });
            }
        }
        
        if (type === 'addInvoice') {
            const form = document.getElementById('invoiceForm') as HTMLFormElement;
            if (!form) return;
            
            const clientId = data.clientId;
            const issueDate = data.issueDate;
            const dueDate = data.dueDate;
            const items = data.items;

            if (!clientId || !issueDate || !dueDate || items.length === 0) {
                alert("Please fill all required invoice fields.");
                return;
            }
            
            const invoicePayload = {
                workspaceId: activeWorkspaceId,
                clientId: clientId,
                invoiceNumber: `INV-${Date.now()}`, // Simple invoice number generation
                issueDate: issueDate,
                dueDate: dueDate,
                status: 'pending',
                emailStatus: 'not_sent',
            };
            
            const [newInvoice] = await apiPost('invoices', invoicePayload);
            
            // Link line items to the new invoice
            const itemPayloads = items.map((item: any) => ({
                invoiceId: newInvoice.id,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            }));
            const lineItems = await apiPost('invoice_line_items', itemPayloads);
            
            newInvoice.items = lineItems;
            state.invoices.push(newInvoice);
            
            // Mark time logs and expenses as billed
            if (data.sourceLogIds?.length > 0) {
                for (const logId of data.sourceLogIds) {
                    await apiPut('time_logs', { id: logId, invoiceId: newInvoice.id });
                    const log = state.timeLogs.find(l => l.id === logId);
                    if (log) log.invoiceId = newInvoice.id;
                }
            }
            if (data.sourceExpenseIds?.length > 0) {
                for (const expenseId of data.sourceExpenseIds) {
                    await apiPut('expenses', { id: expenseId, invoiceId: newInvoice.id });
                    const expense = state.expenses.find(e => e.id === expenseId);
                    if (expense) expense.invoiceId = newInvoice.id;
                }
            }
        }
        
        if (type === 'addTimeOffRequest') {
            const leaveType = (document.getElementById('leaveType') as HTMLSelectElement).value as TimeOffRequest['type'];
            const startDate = (document.getElementById('leaveStartDate') as HTMLInputElement).value;
            const endDate = (document.getElementById('leaveEndDate') as HTMLInputElement).value;

            if (!leaveType || !startDate || !endDate) {
                alert('Please fill all required fields.');
                return; // Prevent closing the modal
            }
            if (new Date(endDate) < new Date(startDate)) {
                alert('End date cannot be before start date.');
                return; // Prevent closing the modal
            }
            // This handler already closes the modal on success.
            await hrHandlers.handleSubmitTimeOffRequest(leaveType, startDate, endDate);
            return; // Exit here since the handler manages its own flow.
        }

        if (type === 'addCalendarEvent') {
            const title = (document.getElementById('eventTitle') as HTMLInputElement).value;
            const eventType = (document.getElementById('eventType') as HTMLSelectElement).value as CalendarEvent['type'];
            const startDate = (document.getElementById('eventStartDate') as HTMLInputElement).value;
            const endDate = (document.getElementById('eventEndDate') as HTMLInputElement).value;

            if (!title || !startDate || !endDate) {
                alert('Please fill all required fields.');
                return; // prevent modal close
            }
            if (new Date(endDate) < new Date(startDate)) {
                alert('End date cannot be before start date.');
                return; // prevent modal close
            }

            const payload: Omit<CalendarEvent, 'id'> = {
                workspaceId: activeWorkspaceId,
                title,
                type: eventType,
                startDate,
                endDate,
                isAllDay: true, // Assuming all-day for now
            };

            const [newEvent] = await apiPost('calendar_events', payload);
            state.calendarEvents.push(newEvent);
        }

        if (type === 'rejectTimeOffRequest') {
             const form = document.getElementById('rejectTimeOffForm') as HTMLFormElement;
             const requestId = form.dataset.requestId!;
             const reason = (document.getElementById('rejectionReason') as HTMLTextAreaElement).value;
             if (reason) {
                await hrHandlers.handleRejectTimeOffRequest(requestId, reason);
             } else {
                alert("Reason for rejection is required.");
                return; // Prevent closing the modal
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
            };

            const [newDeal] = await apiPost('deals', dealData);
            state.deals.push(newDeal);
        }

        if (type === 'employeeDetail') {
            const form = document.getElementById('employeeDetailForm') as HTMLFormElement;
            const userId = form.dataset.userId;
            if (userId) {
                const contractNotes = (document.getElementById('contractInfoNotes') as HTMLTextAreaElement).value;
                const employmentNotes = (document.getElementById('employmentInfoNotes') as HTMLTextAreaElement).value;
                await hrHandlers.handleUpdateEmployeeNotes(userId, contractNotes, employmentNotes);
                return; 
            }
        }

        if (type === 'addManualTimeLog') {
            const taskId = data.taskId as string;
            const timeString = (document.getElementById('timeLogAmount') as HTMLInputElement).value;
            const dateString = (document.getElementById('timeLogDate') as HTMLInputElement).value;
            const comment = (document.getElementById('timeLogComment') as HTMLTextAreaElement).value.trim();

            if (taskId && timeString && dateString) {
                await timerHandlers.handleSaveManualTimeLog(taskId, timeString, dateString, comment || undefined);
            }
        }
        
        if (type === 'adjustVacationAllowance') {
            const form = document.getElementById('adjustVacationForm') as HTMLFormElement;
            const userId = form.dataset.userId!;
            const hoursInput = document.getElementById('vacation-allowance-hours') as HTMLInputElement;
            const hours = parseInt(hoursInput.value, 10);
            if (userId && !isNaN(hours)) {
                await hrHandlers.handleSetVacationAllowance(userId, hours);
                return; // Handler closes modal
            }
        }

        if (type === 'addObjective') {
            const projectId = data.projectId;
            const title = (document.getElementById('objectiveTitle') as HTMLInputElement).value;
            const description = (document.getElementById('objectiveDescription') as HTMLTextAreaElement).value;
            if (projectId && title) {
                await okrHandler.handleCreateObjective(projectId, title, description);
            }
            return; // Handler closes modal
        }

        if (type === 'addKeyResult') {
            const objectiveId = data.objectiveId;
            const title = (document.getElementById('krTitle') as HTMLInputElement).value;
            const krType = (document.getElementById('krType') as HTMLSelectElement).value as 'number' | 'percentage';
            const startValue = parseFloat((document.getElementById('krStartValue') as HTMLInputElement).value);
            const targetValue = parseFloat((document.getElementById('krTargetValue') as HTMLInputElement).value);
            if (objectiveId && title && !isNaN(startValue) && !isNaN(targetValue)) {
                await okrHandler.handleAddKeyResult(objectiveId, title, krType, startValue, targetValue);
            }
            return; // Handler closes modal
        }

        if (type === 'configureWidget') {
            const form = document.getElementById('configure-widget-form') as HTMLFormElement;
            if (form) {
                const widgetId = form.dataset.widgetId!;
                await dashboardHandlers.handleWidgetConfigSave(widgetId);
            }
            return; 
        }

        closeModal();
        renderApp();

    } catch (error) {
        console.error("Form submission failed:", error);
        alert(`Error: ${(error as Error).message}`);
    }
}