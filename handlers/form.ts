

import { state } from '../state.ts';
import { closeModal } from './ui.ts';
import { createNotification } from './notifications.ts';
import { getUsage, PLANS, parseDurationStringToHours, parseDurationStringToSeconds } from '../utils.ts';
import type { Invoice, InvoiceLineItem, Task, ProjectMember, Project, ProjectTemplate, Channel, Automation, Objective, KeyResult, Expense, TimeOffRequest, CalendarEvent, Deal, Client, ClientContact, TaskTag, Review, InventoryItem, InventoryAssignment, Budget } from '../types.ts';
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
import * as projectSectionHandlers from './projectSections.ts';

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
            const title = (form.querySelector('#goalTitle') as HTMLInputElement).value;
            if (!title) return;

            const objectivePayload: Partial<Objective> = {
                workspaceId: activeWorkspaceId,
                title,
                description: (form.querySelector('#goalDescription') as HTMLTextAreaElement).value || undefined,
                ownerId: (form.querySelector('#goalOwner') as HTMLSelectElement).value || undefined,
                dueDate: (form.querySelector('#goalDueDate') as HTMLInputElement).value || undefined,
                category: (form.querySelector('#goalCategory') as HTMLInputElement).value || undefined,
                priority: (form.querySelector('#goalPriority') as HTMLSelectElement).value as Objective['priority'] || undefined,
                status: (form.querySelector('#goalStatus') as HTMLSelectElement).value as Objective['status'] || 'in_progress',
                targetValue: parseFloat((form.querySelector('#goalTargetValue') as HTMLInputElement).value) || undefined,
                currentValue: parseFloat((form.querySelector('#goalCurrentValue') as HTMLInputElement).value) || 0,
                valueUnit: (form.querySelector('#goalValueUnit') as HTMLInputElement).value || undefined,
            };

            const [newObjective] = await apiPost('objectives', objectivePayload);
            state.objectives.push(newObjective);
            
            const milestoneInputs = form.querySelectorAll<HTMLInputElement>('.milestone-input');
            const milestonePayloads: Omit<KeyResult, 'id'>[] = Array.from(milestoneInputs)
                .filter(input => input.value.trim() !== '')
                .map(input => ({
                    objectiveId: newObjective.id,
                    title: input.value.trim(),
                    completed: false,
                    type: 'number', // Default values to satisfy schema, ignored by UI
                    startValue: 0,
                    targetValue: 1,
                    currentValue: 0
                }));

            if (milestonePayloads.length > 0) {
                const newMilestones = await apiPost('key_results', milestonePayloads);
                state.keyResults.push(...newMilestones);
            }
        }

        if (type === 'addTask') {
            const form = document.getElementById('taskForm') as HTMLFormElement;
            const name = (form.querySelector('#taskName') as HTMLInputElement).value;
            const projectId = (form.querySelector('#taskProject') as HTMLSelectElement).value;
            if (!name) return;
            if (!projectId) {
                alert(t('modals.select_a_project_error'));
                return;
            }
            
            const estimatedHoursString = (form.querySelector('#taskEstimatedHours') as HTMLInputElement).value;
            const projectSectionId = (form.querySelector('#projectSection') as HTMLSelectElement).value;
            const taskViewId = (form.querySelector('#taskView') as HTMLSelectElement).value;

            const assigneeCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="taskAssignees"]:checked');
            const assigneeIds = Array.from(assigneeCheckboxes).map(cb => cb.value);

            const tagCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="taskTags"]:checked');
            const tagIds = Array.from(tagCheckboxes).map(cb => cb.value);

            const workflow = getWorkspaceKanbanWorkflow(activeWorkspaceId);
            const status = workflow === 'advanced' ? 'backlog' : 'todo';

            const taskData: Partial<Task> = {
                workspaceId: activeWorkspaceId,
                projectId: projectId,
                projectSectionId: projectSectionId || null,
                taskViewId: taskViewId || null,
                name: name,
                description: (form.querySelector('#taskDescription') as HTMLTextAreaElement).value,
                status: status,
                startDate: (form.querySelector('#taskStartDate') as HTMLInputElement).value || undefined,
                dueDate: (form.querySelector('#taskDueDate') as HTMLInputElement).value || undefined,
                priority: ((form.querySelector('#taskPriority') as HTMLSelectElement).value as Task['priority']) || null,
                estimatedHours: parseDurationStringToHours(estimatedHoursString),
                type: ((form.querySelector('#taskType') as HTMLSelectElement).value as Task['type']) || null,
            };

            if (data?.dealId) {
                taskData.dealId = data.dealId;
            }

            const [newTask] = await apiPost('tasks', taskData);
            state.tasks.push(newTask);
            
            if (assigneeIds.length > 0) {
                const assigneePayloads = assigneeIds.map(userId => ({
                    workspaceId: activeWorkspaceId,
                    taskId: newTask.id,
                    userId: userId
                }));
                const newAssignees = await apiPost('task_assignees', assigneePayloads);
                state.taskAssignees.push(...newAssignees);

                for (const userId of assigneeIds) {
                    if (state.currentUser && userId !== state.currentUser.id) {
                        await createNotification('new_assignment', { taskId: newTask.id, userIdToNotify: userId, actorId: state.currentUser.id });
                    }
                }
            }

            if (tagIds.length > 0) {
                const tagPayloads = tagIds.map(tagId => ({
                    workspaceId: activeWorkspaceId,
                    taskId: newTask.id,
                    tagId: tagId
                }));
                const newTaskTags = await apiPost('task_tags', tagPayloads);
                state.taskTags.push(...newTaskTags);
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

            const date = new Date(issueDate);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();

            const invoicesInMonth = state.invoices.filter(i => {
                if (i.workspaceId !== activeWorkspaceId) return false;
                const invDate = new Date(i.issueDate);
                return invDate.getFullYear() === year && (invDate.getMonth() + 1) === month;
            });

            const newInvoiceNumberStr = `${invoicesInMonth.length + 1}/${String(month).padStart(2, '0')}/${year}`;
            
            const invoicePayload = {
                workspaceId: activeWorkspaceId,
                clientId: clientId,
                invoiceNumber: newInvoiceNumberStr,
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

        if (type === 'addReview') {
            const form = document.getElementById('addReviewForm') as HTMLFormElement;
            const employeeId = form.dataset.employeeId!;
            const reviewDate = (document.getElementById('reviewDate') as HTMLInputElement).value;
            const rating = parseInt((document.getElementById('reviewRating') as HTMLInputElement).value, 10);
            const notes = (document.getElementById('reviewNotes') as HTMLTextAreaElement).value;

            if (!employeeId || !reviewDate || isNaN(rating) || !notes.trim()) {
                alert("Please fill all fields.");
                return;
            }

            const payload: Omit<Review, 'id' | 'createdAt'> = {
                workspaceId: activeWorkspaceId,
                employeeId,
                reviewerId: state.currentUser.id,
                reviewDate,
                rating,
                notes,
            };

            const [newReview] = await apiPost('reviews', payload);
            state.reviews.push(newReview);
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
            const form = document.getElementById('dealForm') as HTMLFormElement;
            const dealId = (form.querySelector('#dealId') as HTMLInputElement).value;
            const isEdit = !!dealId;

            const name = (document.getElementById('dealName') as HTMLInputElement).value;
            const clientId = (document.getElementById('dealClient') as HTMLSelectElement).value;
            const value = parseFloat((document.getElementById('dealValue') as HTMLInputElement).value);
            if (!name || !clientId || isNaN(value)) return;
            
            const dealData: Partial<Deal> = {
                workspaceId: activeWorkspaceId,
                name,
                clientId,
                value,
                ownerId: (document.getElementById('dealOwner') as HTMLSelectElement).value,
                stage: (document.getElementById('dealStage') as HTMLSelectElement).value as Deal['stage'],
                expectedCloseDate: (document.getElementById('dealExpectedCloseDate') as HTMLInputElement).value || undefined,
            };

            if (isEdit) {
                const [updatedDeal] = await apiPut('deals', { ...dealData, id: dealId });
                const index = state.deals.findIndex(d => d.id === dealId);
                if (index !== -1) {
                    state.deals[index] = { ...state.deals[index], ...updatedDeal };
                }
            } else {
                const [newDeal] = await apiPost('deals', dealData);
                state.deals.push(newDeal);
            }
        }
        
        if (type === 'addExpense') {
            const form = document.getElementById('addExpenseForm') as HTMLFormElement;
            const description = (document.getElementById('expenseDescription') as HTMLInputElement).value;
            const amount = parseFloat((document.getElementById('expenseAmount') as HTMLInputElement).value);
            const date = (document.getElementById('expenseDate') as HTMLInputElement).value;
            const category = (document.getElementById('expenseCategory') as HTMLSelectElement).value;
            const projectId = (document.getElementById('expenseProject') as HTMLSelectElement).value;
        
            if (!description || isNaN(amount) || !date || !category) {
                alert("Please fill all required fields for the expense.");
                return;
            }
        
            const payload: Omit<Expense, 'id'> = {
                workspaceId: activeWorkspaceId,
                userId: state.currentUser.id,
                projectId: projectId || undefined,
                description,
                amount,
                date,
                category,
            };
        
            const [newExpense] = await apiPost('expenses', payload);
            state.expenses.push(newExpense);
        }

        if (type === 'setBudgets') {
            const form = document.getElementById('setBudgetsForm') as HTMLFormElement;
            const period = form.dataset.period!;
            const budgetRows = form.querySelectorAll<HTMLElement>('.budget-item-row');
            
            const budgetPayloads: Omit<Budget, 'id'>[] = [];
            budgetRows.forEach(row => {
                const category = (row.querySelector<HTMLInputElement>('input[name="category"]'))!.value;
                const amount = parseFloat((row.querySelector<HTMLInputElement>('input[name="amount"]'))!.value);
                if (category && !isNaN(amount)) {
                    budgetPayloads.push({
                        workspaceId: activeWorkspaceId,
                        category,
                        period,
                        amount,
                    });
                }
            });

            if (budgetPayloads.length > 0) {
                const updatedBudgets = await apiPost('budgets', budgetPayloads);
                updatedBudgets.forEach((updated: Budget) => {
                    const index = state.budgets.findIndex(b => b.id === updated.id);
                    if (index > -1) {
                        state.budgets[index] = updated;
                    } else {
                        state.budgets.push(updated);
                    }
                });
            }
        }

        if (type === 'addInventoryItem') {
            const form = document.getElementById('inventoryItemForm') as HTMLFormElement;
            const itemId = form.dataset.itemId;
            const isEdit = !!itemId;

            const payload: Partial<InventoryItem> = {
                workspaceId: activeWorkspaceId,
                name: (form.querySelector('#itemName') as HTMLInputElement).value,
                category: (form.querySelector('#itemCategory') as HTMLInputElement).value,
                sku: (form.querySelector('#itemSku') as HTMLInputElement).value,
                location: (form.querySelector('#itemLocation') as HTMLInputElement).value,
                currentStock: parseInt((form.querySelector('#itemCurrentStock') as HTMLInputElement).value, 10),
                targetStock: parseInt((form.querySelector('#itemTargetStock') as HTMLInputElement).value, 10),
                lowStockThreshold: parseInt((form.querySelector('#itemLowStockThreshold') as HTMLInputElement).value, 10),
                unitPrice: parseFloat((form.querySelector('#itemUnitPrice') as HTMLInputElement).value),
            };
            
            if (isEdit) {
                const [updatedItem] = await apiPut('inventory_items', { ...payload, id: itemId });
                const index = state.inventoryItems.findIndex(i => i.id === itemId);
                if (index > -1) state.inventoryItems[index] = { ...state.inventoryItems[index], ...updatedItem };
            } else {
                const [newItem] = await apiPost('inventory_items', payload);
                state.inventoryItems.push(newItem);
            }
        }

        if (type === 'assignInventoryItem') {
            const form = document.getElementById('assignInventoryItemForm') as HTMLFormElement;
            const itemId = form.dataset.itemId!;
            const employeeId = (form.querySelector('#employeeId') as HTMLSelectElement).value;
            const assignmentDate = (form.querySelector('#assignmentDate') as HTMLInputElement).value;
            
            if (!itemId || !employeeId || !assignmentDate) {
                alert("Please fill all required fields.");
                return;
            }
            
            const payload: Omit<InventoryAssignment, 'id' | 'createdAt'> = {
                workspaceId: activeWorkspaceId,
                itemId,
                employeeId,
                assignmentDate,
                serialNumber: (form.querySelector('#serialNumber') as HTMLInputElement).value || undefined,
                notes: (form.querySelector('#notes') as HTMLTextAreaElement).value || undefined,
            };

            const [newAssignment] = await apiPost('inventory_assignments', payload);
            state.inventoryAssignments.push(newAssignment);

            // Decrement stock
            const item = state.inventoryItems.find(i => i.id === itemId);
            if (item) {
                item.currentStock -= 1;
                await apiPut('inventory_items', { id: item.id, currentStock: item.currentStock });
            }
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
        
        if (type === 'addCommentToTimeLog') {
            const taskId = data.taskId as string;
            const timeString = (document.getElementById('timelog-amount') as HTMLInputElement).value;
            const comment = (document.getElementById('timelog-comment') as HTMLTextAreaElement).value.trim();
            const trackedSeconds = parseDurationStringToSeconds(timeString);

            if (taskId && trackedSeconds > 0) {
                await timerHandlers.handleSaveTimeLogAndComment(taskId, trackedSeconds, comment || undefined);
                return; 
            } else {
                alert("Invalid time format or amount. Please use a format like '1h 30m'.");
                return; 
            }
        }

        if (type === 'assignGlobalTime') {
            const timeString = (document.getElementById('global-timelog-amount') as HTMLInputElement).value;
            const trackedSeconds = parseDurationStringToSeconds(timeString);
            const projectId = (document.getElementById('assign-time-project-select') as HTMLSelectElement).value;
            const taskId = (document.getElementById('assign-time-task-select') as HTMLSelectElement).value;
            const comment = (document.getElementById('global-timelog-comment') as HTMLTextAreaElement).value.trim();

            if (taskId && trackedSeconds > 0) {
                await timerHandlers.handleSaveTimeLogAndComment(taskId, trackedSeconds, comment || undefined);
                return; 
            } else {
                alert("Please select a task and enter a valid time.");
                return; 
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
            const form = document.getElementById('addObjectiveForm') as HTMLFormElement;
            const projectId = form.dataset.projectId!;
            const title = (document.getElementById('objectiveTitle') as HTMLInputElement).value;
            const description = (document.getElementById('objectiveDescription') as HTMLTextAreaElement).value;
            if (projectId && title) {
                await okrHandler.handleCreateObjective(projectId, title, description);
            }
            return; // Handler manages its own state
        }

        if (type === 'addKeyResult') {
            const form = document.getElementById('addKeyResultForm') as HTMLFormElement;
            const objectiveId = form.dataset.objectiveId!;
            const title = (document.getElementById('krTitle') as HTMLInputElement).value;
            const krType = (document.getElementById('krType') as HTMLSelectElement).value as 'number' | 'percentage';
            const startValue = parseFloat((document.getElementById('krStartValue') as HTMLInputElement).value);
            const targetValue = parseFloat((document.getElementById('krTargetValue') as HTMLInputElement).value);
            if (objectiveId && title && !isNaN(startValue) && !isNaN(targetValue)) {
                await okrHandler.handleAddKeyResult(objectiveId, title, krType, startValue, targetValue);
            }
            return; // Handler manages its own state
        }

        if (type === 'addProjectSection') {
            const form = document.getElementById('addProjectSectionForm') as HTMLFormElement;
            const projectId = form.dataset.projectId!;
            const name = (document.getElementById('projectSectionName') as HTMLInputElement).value;
            if (projectId && name) {
                await projectSectionHandlers.handleCreateProjectSection(projectId, name);
            }
            return; // Handler manages its own state
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