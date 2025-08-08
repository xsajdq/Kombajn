

import { getState, setState } from '../state.ts';
import { closeModal } from './ui.ts';
import { createNotification } from './notifications.ts';
import { getUsage, PLANS, parseDurationStringToHours, parseDurationStringToSeconds, generateSlug } from '../utils.ts';
import type { Invoice, InvoiceLineItem, Task, ProjectMember, Project, ProjectTemplate, Channel, Automation, Objective, KeyResult, Expense, TimeOffRequest, CalendarEvent, Deal, Client, ClientContact, TaskTag, Review, InventoryItem, InventoryAssignment, Budget } from '../types.ts';
import { t } from '../i18n.ts';
import { updateUI } from '../app-renderer.ts';
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

    if (type === 'taskDetail') {
        return;
    }
    
    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;
    const usage = getUsage(activeWorkspaceId);
    const planLimits = PLANS[workspace.subscription.planId];
    
    const button = document.getElementById('modal-save-btn');
    if (button) {
        button.setAttribute('disabled', 'true');
    }

    try {
        if (type === 'sendInvoiceEmail') {
            const form = document.getElementById('send-invoice-email-form') as HTMLFormElement;
            const invoiceId = form.dataset.invoiceId!;
            const to = (form.querySelector('#email-to') as HTMLInputElement).value;
            const subject = (form.querySelector('#email-subject') as HTMLInputElement).value;
            const body = (form.querySelector('#email-body') as HTMLTextAreaElement).value;

            const button = document.getElementById('modal-save-btn') as HTMLButtonElement;
            if (button) {
                button.disabled = true;
                button.textContent = t('misc.sending');
            }

            try {
                const dataUri = await generateInvoicePDF(invoiceId, { outputType: 'datauristring' }) as string | null;
                if (!dataUri) {
                    throw new Error("Failed to generate PDF for the invoice.");
                }
                const pdfBase64 = dataUri.substring(dataUri.indexOf(',') + 1);

                await apiFetch('/api?action=send-invoice-gmail', {
                    method: 'POST',
                    body: JSON.stringify({
                        workspaceId: state.activeWorkspaceId,
                        invoiceId,
                        to,
                        subject,
                        body,
                        pdfBase64,
                    }),
                });
            } catch (err) {
                console.error("Failed to send invoice email:", err);
                alert((err as Error).message);
                if (button) {
                    button.disabled = false;
                    button.textContent = t('modals.send_email_button');
                }
                return; // Prevent modal from closing
            }
        } else if (type === 'addClient') {
            const form = document.getElementById('clientForm') as HTMLFormElement;
            const clientId = (form.querySelector('#clientId') as HTMLInputElement).value;
            const name = (form.querySelector('#clientName') as HTMLInputElement).value;
            if (!name) {
                alert(t('errors.fill_all_fields'));
                return;
            };

            const clientData: Partial<Client> = {
                workspaceId: activeWorkspaceId,
                name: name,
                vatId: (form.querySelector('#clientVatId') as HTMLInputElement).value,
                category: (form.querySelector('#clientCategory') as HTMLInputElement).value || undefined,
                healthStatus: (form.querySelector('#clientHealthStatus') as HTMLSelectElement).value as Client['healthStatus'] || null,
                status: (form.querySelector('#clientStatus') as HTMLSelectElement).value as Client['status'] || 'active',
            };

            let finalClient: Client;

            if (clientId) {
                clientData.slug = generateSlug(name, clientId);
                [finalClient] = await apiPut('clients', { ...clientData, id: clientId });
                setState(prevState => ({
                    clients: prevState.clients.map(c => c.id === clientId ? { ...c, ...finalClient, contacts: c.contacts } : c)
                }), []);
            } else {
                let [savedClient] = await apiPost('clients', clientData);
                const slug = generateSlug(savedClient.name, savedClient.id);
                const [clientWithSlug] = await apiPut('clients', { id: savedClient.id, slug });
                finalClient = { ...savedClient, ...clientWithSlug };
            }

            const contactRows = form.querySelectorAll<HTMLElement>('.contact-form-row');
            const contactPromises: Promise<any>[] = [];

            contactRows.forEach(row => {
                const nameInput = row.querySelector<HTMLInputElement>('[data-field="name"]');
                if (!nameInput || !nameInput.value.trim()) return;
                const contactId = row.dataset.contactId!;
                const isNew = contactId.startsWith('new-');
                
                const contactPayload = {
                    id: isNew ? undefined : contactId,
                    clientId: finalClient.id,
                    workspaceId: activeWorkspaceId,
                    name: nameInput.value.trim(),
                    email: (row.querySelector<HTMLInputElement>('[data-field="email"]'))!.value.trim() || undefined,
                    phone: (row.querySelector<HTMLInputElement>('[data-field="phone"]'))!.value.trim() || undefined,
                    role: (row.querySelector<HTMLInputElement>('[data-field="role"]'))!.value.trim() || undefined,
                };
                if (isNew) contactPromises.push(apiPost('client_contacts', contactPayload));
                else contactPromises.push(apiPut('client_contacts', contactPayload));
            });

            const deletedContactIds = (document.getElementById('deleted-contact-ids') as HTMLInputElement).value.split(',').filter(Boolean);
            deletedContactIds.forEach(id => contactPromises.push(apiFetch('/api?action=data&resource=client_contacts', { method: 'DELETE', body: JSON.stringify({ id }) })));

            await Promise.all(contactPromises.map(p => p.catch(e => console.error("Contact save error:", e))));
            
            const allContactsForClient = await apiFetch(`/api?action=data&resource=client_contacts&clientId=${finalClient.id}`);

            if (clientId) {
                 setState(prevState => ({
                    clients: prevState.clients.map(c => c.id === clientId ? { ...c, ...finalClient, contacts: allContactsForClient || [] } : c)
                }), ['page', 'side-panel']);
            } else {
                setState(prevState => ({ clients: [...prevState.clients, { ...finalClient, contacts: allContactsForClient || [] }] }), ['page', 'side-panel']);
            }
        } else if (type === 'addProject') {
            const form = document.getElementById('projectForm') as HTMLFormElement;
            const projectId = (form.querySelector('#projectId') as HTMLInputElement).value;
            const isEdit = !!projectId;

            if (!isEdit && usage.projects >= planLimits.projects) {
                alert(t('billing.limit_reached_projects', {planName: workspace.subscription.planId}));
                return;
            }

            const name = (document.getElementById('projectName') as HTMLInputElement).value;
            const clientId = (document.getElementById('projectClient') as HTMLSelectElement).value;
            if (!name || !clientId) {
                 alert(t('errors.fill_all_fields'));
                 return;
            }

            const projectData: Partial<Project> = {
                workspaceId: activeWorkspaceId,
                name: name,
                clientId: clientId,
                wikiContent: isEdit ? getState().projects.find(p => p.id === projectId)!.wikiContent : '',
                hourlyRate: parseFloat((document.getElementById('projectHourlyRate') as HTMLInputElement).value) || undefined,
                privacy: (document.querySelector('input[name="privacy"]:checked') as HTMLInputElement).value as Project['privacy'],
                budgetHours: parseFloat((document.getElementById('projectBudgetHours') as HTMLInputElement).value) || undefined,
                budgetCost: parseFloat((document.getElementById('projectBudgetCost') as HTMLInputElement).value) || undefined,
                category: (document.getElementById('projectCategory') as HTMLInputElement).value || undefined,
            };

            let finalProject;

            if (isEdit) {
                projectData.slug = generateSlug(name, projectId);
                [finalProject] = await apiPut('projects', { ...projectData, id: projectId });
                setState(prevState => ({ projects: prevState.projects.map(p => p.id === projectId ? { ...p, ...finalProject } : p) }), []);
            } else {
                let [savedProject] = await apiPost('projects', projectData);
                const slug = generateSlug(savedProject.name, savedProject.id);
                const [projectWithSlug] = await apiPut('projects', { id: savedProject.id, slug });
                finalProject = { ...savedProject, ...projectWithSlug };

                setState(prevState => ({ projects: [...prevState.projects, finalProject] }), []);
                
                const creatorMember: Omit<ProjectMember, 'id'> = { projectId: finalProject.id, userId: state.currentUser!.id, role: 'admin' };
                const [savedCreatorMember] = await apiPost('project_members', creatorMember);
                setState(prevState => ({ projectMembers: [...prevState.projectMembers, savedCreatorMember] }), []);
            }
            
            const tagCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="project_tags"]:checked');
            const newTagIds = new Set(Array.from(tagCheckboxes).map(cb => cb.value));
            await projectHandlers.handleSyncProjectTags(finalProject.id, newTagIds);

            if (projectData.privacy === 'private') {
                const memberCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="project_members"]:checked');
                const newMemberIds = new Set(Array.from(memberCheckboxes).map(cb => cb.value));
                await projectHandlers.handleSyncProjectMembers(finalProject.id, newMemberIds);
            } else if (isEdit && projectData.privacy === 'public') {
                await projectHandlers.handleSyncProjectMembers(finalProject.id, new Set([state.currentUser!.id]));
            }
        } else if (type === 'aiProjectPlanner') {
            const name = (document.getElementById('aiProjectName') as HTMLInputElement).value;
            const clientId = (document.getElementById('aiProjectClient') as HTMLSelectElement).value;
            const goal = (document.getElementById('aiProjectGoal') as HTMLTextAreaElement).value;
            if (!name || !clientId || !goal) {
                alert(t('errors.fill_all_fields'));
                return;
            }
            await projectHandlers.handlePlanProjectWithAi(name, clientId, goal);
            return; 
        } else if (type === 'addGoal') {
            const form = document.getElementById('addGoalForm') as HTMLFormElement;
            const goalId = form.dataset.goalId;
            const isEdit = !!goalId;

            const title = (form.querySelector('#goalTitle') as HTMLInputElement).value;
            const description = (form.querySelector('#goalDescription') as HTMLTextAreaElement).value;
            const ownerId = (form.querySelector('#goalOwner') as HTMLSelectElement).value;
            const dueDate = (form.querySelector('#goalDueDate') as HTMLInputElement).value;
            const category = (form.querySelector('#goalCategory') as HTMLInputElement).value;
            const priority = (form.querySelector('#goalPriority') as HTMLSelectElement).value;
            const status = (form.querySelector('#goalStatus') as HTMLSelectElement).value;
            const targetValue = parseFloat((form.querySelector('#goalTargetValue') as HTMLInputElement).value) || 0;
            const currentValue = parseFloat((form.querySelector('#goalCurrentValue') as HTMLInputElement).value) || 0;
            const valueUnit = (form.querySelector('#goalValueUnit') as HTMLInputElement).value;

            const goalPayload = {
                workspaceId: activeWorkspaceId,
                title, description, ownerId, dueDate, category, priority, status, targetValue, currentValue, valueUnit
            };

            let savedGoal;
            if (isEdit) {
                [savedGoal] = await apiPut('objectives', { ...goalPayload, id: goalId });
                setState(prevState => ({ objectives: prevState.objectives.map(o => o.id === goalId ? savedGoal : o) }), []);
            } else {
                [savedGoal] = await apiPost('objectives', goalPayload);
                setState(prevState => ({ objectives: [...prevState.objectives, savedGoal] }), []);
            }

            const milestoneInputs = Array.from(form.querySelectorAll<HTMLElement>('.milestone-item'));
            const milestonePromises = milestoneInputs.map(item => {
                const id = item.dataset.id!;
                const isNew = id.startsWith('new-');
                const text = (item.querySelector('.milestone-input') as HTMLInputElement).value;
                const krPayload = {
                    objectiveId: savedGoal.id,
                    title: text,
                    type: 'number' as const,
                    startValue: 0,
                    targetValue: 1,
                    completed: (item.querySelector('.milestone-checkbox') as HTMLInputElement)?.checked || false,
                };
                if (isNew) {
                    return apiPost('key_results', krPayload);
                } else {
                    return apiPut('key_results', { ...krPayload, id });
                }
            });
            await Promise.all(milestonePromises);
            const keyResultsForGoal = await apiFetch(`/api?action=data&resource=key_results&objectiveId=${savedGoal.id}`);
            setState(prevState => ({ keyResults: [...prevState.keyResults.filter(kr => kr.objectiveId !== savedGoal.id), ...keyResultsForGoal] }), []);
        } else if (type === 'addReview') {
            const form = document.getElementById('addReviewForm') as HTMLFormElement;
            const employeeId = form.dataset.employeeId!;
            const rating = parseInt((form.querySelector('#reviewRating') as HTMLSelectElement).value, 10);
            const notes = (form.querySelector('#reviewNotes') as HTMLTextAreaElement).value;

            if (employeeId && rating && notes) {
                const payload: Omit<Review, 'id' | 'createdAt'> = {
                    workspaceId: activeWorkspaceId,
                    employeeId,
                    reviewerId: state.currentUser!.id,
                    reviewDate: new Date().toISOString().slice(0, 10),
                    rating,
                    notes,
                };
                const [newReview] = await apiPost('reviews', payload);
                setState(prevState => ({ reviews: [...prevState.reviews, newReview] }), ['page']);
            }
        } else if (type === 'addTask') {
            const form = document.getElementById('taskForm') as HTMLFormElement;
            const name = (form.querySelector('#taskName') as HTMLInputElement).value;
            const projectId = (form.querySelector('#taskProject') as HTMLSelectElement).value;
            if (!name || !projectId) {
                alert(t('modals.select_a_project_error'));
                return;
            }
            
            const workflow = getWorkspaceKanbanWorkflow(activeWorkspaceId);

            const taskData: Partial<Task> = {
                workspaceId: activeWorkspaceId,
                name,
                projectId,
                description: (form.querySelector('#taskDescription') as HTMLTextAreaElement).value || undefined,
                projectSectionId: (form.querySelector('#projectSection') as HTMLSelectElement).value || undefined,
                taskViewId: (form.querySelector('#taskView') as HTMLSelectElement).value || undefined,
                status: workflow === 'advanced' ? 'backlog' : 'todo',
                startDate: (form.querySelector('#taskStartDate') as HTMLInputElement).value || undefined,
                dueDate: (form.querySelector('#taskDueDate') as HTMLInputElement).value || undefined,
                priority: (form.querySelector('#taskPriority') as HTMLSelectElement).value as Task['priority'] || null,
                estimatedHours: parseDurationStringToHours((form.querySelector('#taskEstimatedHours') as HTMLInputElement).value) || undefined,
                type: (form.querySelector('#taskType') as HTMLSelectElement).value as Task['type'] || null,
                isArchived: false,
                createdAt: new Date().toISOString(),
                dealId: data.dealId
            };
            
            let [savedTask] = await apiPost('tasks', taskData);

            // Generate and save slug
            const slug = generateSlug(savedTask.name, savedTask.id);
            const [taskWithSlug] = await apiPut('tasks', { id: savedTask.id, slug });
            savedTask = { ...savedTask, ...taskWithSlug };
            
            const assigneeCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="taskAssignees"]:checked');
            const assigneeIds = Array.from(assigneeCheckboxes).map(cb => cb.value);
            if (assigneeIds.length > 0) {
                const assigneePayloads = assigneeIds.map(userId => ({ taskId: savedTask.id, userId, workspaceId: activeWorkspaceId }));
                const savedAssignees = await apiPost('task_assignees', assigneePayloads);
                setState(prevState => ({ taskAssignees: [...prevState.taskAssignees, ...savedAssignees] }), []);
                
                // Send notifications
                for (const userId of assigneeIds) {
                    if (userId !== state.currentUser!.id) {
                        await createNotification('new_assignment', {
                            taskId: savedTask.id,
                            userIdToNotify: userId,
                            actorId: state.currentUser!.id,
                        });
                    }
                }
            }
            
            const tagCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="taskTags"]:checked');
            const tagIds = Array.from(tagCheckboxes).map(cb => cb.value);
            if (tagIds.length > 0) {
                const tagPayloads = tagIds.map(tagId => ({ taskId: savedTask.id, tagId, workspaceId: activeWorkspaceId }));
                const savedTags = await apiPost('task_tags', tagPayloads);
                setState(prevState => ({ taskTags: [...prevState.taskTags, ...savedTags] }), []);
            }

            setState(prevState => ({ tasks: [...prevState.tasks, savedTask] }), []);
        } else if (type === 'addInvoice') {
            if (usage.invoicesThisMonth >= planLimits.invoices) {
                alert(t('billing.limit_reached_invoices', {planName: workspace.subscription.planId}));
                return;
            }
            const form = document.getElementById('invoiceForm') as HTMLFormElement;
            const clientId = (form.querySelector('#invoiceClient') as HTMLSelectElement).value;
            const issueDate = (form.querySelector('#invoiceIssueDate') as HTMLInputElement).value;
            const dueDate = (form.querySelector('#invoiceDueDate') as HTMLInputElement).value;

            const invoiceData: Partial<Invoice> = {
                workspaceId: activeWorkspaceId,
                clientId,
                issueDate,
                dueDate,
                status: 'pending',
                emailStatus: 'not_sent',
            };

            const [savedInvoice] = await apiPost('invoices', invoiceData);
            
            const itemRows = form.querySelectorAll<HTMLElement>('.invoice-item-row');
            const lineItems: Omit<InvoiceLineItem, 'id'>[] = [];
            itemRows.forEach(row => {
                lineItems.push({
                    invoiceId: savedInvoice.id,
                    description: (row.querySelector<HTMLInputElement>('[data-field="description"]'))!.value,
                    quantity: parseFloat((row.querySelector<HTMLInputElement>('[data-field="quantity"]'))!.value),
                    unitPrice: parseFloat((row.querySelector<HTMLInputElement>('[data-field="unitPrice"]'))!.value),
                });
            });

            const savedLineItems = await apiPost('invoice_line_items', lineItems);
            
            const fullInvoice = { ...savedInvoice, items: savedLineItems };
            setState(prevState => ({ invoices: [...prevState.invoices, fullInvoice] }), []);

            const { sourceLogIds, sourceExpenseIds } = data;
            if (sourceLogIds?.length) {
                await apiPut('time_logs', sourceLogIds.map((id: string) => ({ id, invoice_id: savedInvoice.id })));
            }
            if (sourceExpenseIds?.length) {
                await apiPut('expenses', sourceExpenseIds.map((id: string) => ({ id, invoice_id: savedInvoice.id })));
            }
        } else if (type === 'addDeal') {
            const form = document.querySelector('form') as HTMLFormElement; // Assume generic form as it's not implemented yet
            const dealId = (form.querySelector('#dealId') as HTMLInputElement)?.value;
            const isEdit = !!dealId;
            
            const dealData: Partial<Deal> = {
                workspaceId: activeWorkspaceId,
                name: (form.querySelector('#dealName') as HTMLInputElement).value,
                clientId: (form.querySelector('#dealClient') as HTMLSelectElement).value,
                value: parseFloat((form.querySelector('#dealValue') as HTMLInputElement).value),
                ownerId: (form.querySelector('#dealOwner') as HTMLSelectElement).value,
                stage: (form.querySelector('#dealStage') as HTMLSelectElement).value,
                expectedCloseDate: (form.querySelector('#dealCloseDate') as HTMLInputElement).value || undefined,
                lastActivityAt: new Date().toISOString(),
            };

            let finalDeal;
            if (isEdit) {
                dealData.slug = generateSlug(dealData.name!, dealId);
                [finalDeal] = await apiPut('deals', { ...dealData, id: dealId });
                setState(prevState => ({ deals: prevState.deals.map(d => d.id === dealId ? finalDeal : d) }), []);
            } else {
                let [savedDeal] = await apiPost('deals', dealData);
                const slug = generateSlug(savedDeal.name, savedDeal.id);
                const [dealWithSlug] = await apiPut('deals', { id: savedDeal.id, slug });
                finalDeal = { ...savedDeal, ...dealWithSlug };
                setState(prevState => ({ deals: [...prevState.deals, finalDeal] }), []);
            }
        } else if (type === 'addManualTimeLog') {
            const form = document.getElementById('manualTimeLogForm') as HTMLFormElement;
            const taskId = (form.querySelector('#timeLogTask') as HTMLSelectElement).value;
            const trackedSeconds = parseInt((form.querySelector('#time-picker-seconds') as HTMLInputElement).value, 10);
            const dateWorked = (form.querySelector('#timeLogDate') as HTMLInputElement).value;
            const startTime = (form.querySelector('#timeLogStartTime') as HTMLInputElement).value;
            const comment = (form.querySelector('#timeLogComment') as HTMLTextAreaElement).value;
            
            const createdAt = new Date(`${dateWorked}T${startTime || '00:00:00'}`).toISOString();

            if (taskId) {
                await timerHandlers.handleSaveManualTimeLog(taskId, trackedSeconds, createdAt, comment);
            }
        } else if (type === 'addExpense') {
            const form = document.getElementById('addExpenseForm') as HTMLFormElement;
            const expenseData: Omit<Expense, 'id'> = {
                workspaceId: activeWorkspaceId,
                userId: state.currentUser.id,
                description: (form.querySelector('#expenseDescription') as HTMLInputElement).value,
                amount: parseFloat((form.querySelector('#expenseAmount') as HTMLInputElement).value),
                date: (form.querySelector('#expenseDate') as HTMLInputElement).value,
                projectId: (form.querySelector('#expenseProject') as HTMLSelectElement).value || undefined,
                category: (form.querySelector('#expenseCategory') as HTMLInputElement).value || undefined,
                isBillable: (form.querySelector('#expenseIsBillable') as HTMLInputElement).checked,
            };
            const [savedExpense] = await apiPost('expenses', expenseData);
            setState(prevState => ({ expenses: [...prevState.expenses, savedExpense] }), []);
        } else if (type === 'setBudgets') {
            const form = document.getElementById('setBudgetsForm') as HTMLFormElement;
            const period = form.dataset.period!;
            const budgetRows = form.querySelectorAll<HTMLElement>('#budgets-container > div');
            const budgetsToUpsert: Omit<Budget, 'id'>[] = [];
            
            budgetRows.forEach(row => {
                const categoryInput = row.querySelector('input[name^="budget_category"]') as HTMLInputElement;
                const amountInput = row.querySelector('input[name^="budget_amount"]') as HTMLInputElement;
                const category = categoryInput.value.trim();
                const amount = parseFloat(amountInput.value);
                if (category && !isNaN(amount)) {
                    budgetsToUpsert.push({
                        workspaceId: activeWorkspaceId,
                        category,
                        period,
                        amount,
                    });
                }
            });
            
            if (budgetsToUpsert.length > 0) {
                const savedBudgets = await apiPost('budgets', budgetsToUpsert);
                setState(prevState => ({
                    budgets: [...prevState.budgets.filter(b => b.period !== period), ...savedBudgets]
                }), []);
            }
        } else if (type === 'addInventoryItem') {
            const form = document.getElementById('addInventoryItemForm') as HTMLFormElement;
            const itemId = form.dataset.itemId;
            const isEdit = !!itemId;
            
            const itemData = {
                workspaceId: activeWorkspaceId,
                name: (form.querySelector('#itemName') as HTMLInputElement).value,
                category: (form.querySelector('#itemCategory') as HTMLInputElement).value || undefined,
                sku: (form.querySelector('#itemSku') as HTMLInputElement).value || undefined,
                location: (form.querySelector('#itemLocation') as HTMLInputElement).value || undefined,
                currentStock: parseInt((form.querySelector('#itemCurrentStock') as HTMLInputElement).value) || 0,
                targetStock: parseInt((form.querySelector('#itemTargetStock') as HTMLInputElement).value) || 0,
                lowStockThreshold: parseInt((form.querySelector('#itemLowStockThreshold') as HTMLInputElement).value) || 0,
                unitPrice: parseFloat((form.querySelector('#itemUnitPrice') as HTMLInputElement).value) || 0,
            };
            
            if (isEdit) {
                const [updatedItem] = await apiPut('inventory_items', { ...itemData, id: itemId });
                setState(prevState => ({
                    inventoryItems: prevState.inventoryItems.map(i => i.id === itemId ? updatedItem : i)
                }), ['page']);
            } else {
                const [newItem] = await apiPost('inventory_items', itemData);
                setState(prevState => ({ inventoryItems: [...prevState.inventoryItems, newItem] }), ['page']);
            }
        } else if (type === 'assignInventoryItem') {
            const form = document.getElementById('assignInventoryItemForm') as HTMLFormElement;
            const itemId = form.dataset.itemId!;
            
            const assignmentData: Omit<InventoryAssignment, 'id' | 'createdAt'> = {
                workspaceId: activeWorkspaceId,
                itemId: itemId,
                employeeId: (form.querySelector('#assign-employee-select') as HTMLSelectElement).value,
                assignmentDate: (form.querySelector('#assignmentDate') as HTMLInputElement).value,
                returnDate: (form.querySelector('#returnDate') as HTMLInputElement).value || undefined,
                serialNumber: (form.querySelector('#serialNumber') as HTMLInputElement).value || undefined,
                notes: (form.querySelector('#notes') as HTMLTextAreaElement).value || undefined,
            };
            
            const [newAssignment] = await apiPost('inventory_assignments', assignmentData);
            setState(prevState => ({
                inventoryAssignments: [...prevState.inventoryAssignments, newAssignment]
            }), ['page']);
        }

        closeModal();
        updateUI(['page', 'side-panel']);
    } catch (error) {
        console.error("Form submission error:", error);
        alert(`${t('errors.generic_error')}: ${(error as Error).message}`);
    } finally {
        if (button) {
            button.removeAttribute('disabled');
        }
    }
}
