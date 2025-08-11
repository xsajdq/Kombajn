
import { getState, setState } from '../state.ts';
import { closeModal, showToast } from './ui.ts';
import { createNotification } from './notifications.ts';
import { getUsage, PLANS, parseDurationStringToHours, parseDurationStringToSeconds, generateSlug } from '../utils.ts';
import type { Invoice, InvoiceLineItem, Task, ProjectMember, Project, ProjectTemplate, Channel, Automation, Objective, KeyResult, Expense, TimeOffRequest, CalendarEvent, Deal, Client, ClientContact, TaskTag, Review, InventoryItem, InventoryAssignment, Budget, AddTaskModalData, AddInvoiceModalData, AddProjectModalData, AddCommentToTimeLogModalData, AssignGlobalTimeModalData, AddManualTimeLogModalData, AddProjectSectionModalData, AddReviewModalData, AddGoalModalData, AddInventoryItemModalData, AssignInventoryItemModalData, SetBudgetsModalData, AddDealModalData, AddExpenseModalData, AddCalendarEventModalData, AddTimeOffRequestModalData, AdjustVacationAllowanceModalData, ConfirmPlanChangeModalData, EmployeeDetailModalData, RejectTimeOffRequestModalData, SendInvoiceEmailModalData, AutomationsModalData, AddClientModalData } from '../types.ts';
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
import * as billingHandlers from './billing.ts';

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
            const invoiceId = (data as SendInvoiceEmailModalData).invoiceId;
            const to = (form.querySelector('#email-to') as HTMLInputElement).value;
            const subject = (form.querySelector('#email-subject') as HTMLInputElement).value;
            const body = (form.querySelector('#email-body') as HTMLTextAreaElement).value;

            (button as HTMLButtonElement).textContent = t('misc.sending');

            try {
                const dataUri = await generateInvoicePDF(invoiceId, { outputType: 'datauristring' }) as string | null;
                if (!dataUri) throw new Error("Failed to generate PDF for the invoice.");
                
                const pdfBase64 = dataUri.substring(dataUri.indexOf(',') + 1);

                await apiFetch('/api?action=send-invoice-gmail', {
                    method: 'POST',
                    body: JSON.stringify({ workspaceId: state.activeWorkspaceId, invoiceId, to, subject, body, pdfBase64 }),
                });
            } catch (err) {
                console.error("Failed to send invoice email:", err);
                showToast((err as Error).message, 'error');
                return;
            }
        } else if (type === 'addClient') {
            const form = document.getElementById('clientForm') as HTMLFormElement;
            const clientId = (data as AddClientModalData)?.clientId;
            const name = (form.querySelector('#clientName') as HTMLInputElement).value;
            if (!name) {
                showToast(t('errors.fill_all_fields'), 'error');
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
            const projectId = (data as AddProjectModalData)?.projectId;
            const isEdit = !!projectId;

            if (!isEdit && usage.projects >= planLimits.projects) {
                showToast(t('billing.limit_reached_projects', {planName: workspace.subscription.planId}), 'error');
                return;
            }

            const name = (document.getElementById('projectName') as HTMLInputElement).value;
            const clientId = (document.getElementById('projectClient') as HTMLSelectElement).value;
            if (!name || !clientId) {
                 showToast(t('errors.fill_all_fields'), 'error');
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
                showToast(t('errors.fill_all_fields'), 'error');
                return;
            }
            await projectHandlers.handlePlanProjectWithAi(name, clientId, goal);
            return; 
        } else if (type === 'addGoal') {
            const form = document.getElementById('addGoalForm') as HTMLFormElement;
            const goalId = (data as AddGoalModalData)?.goalId;
            const isEdit = !!goalId;

            const title = (form.querySelector('#goalTitle') as HTMLInputElement).value;
            if (!title) { showToast(t('errors.fill_all_fields'), 'error'); return; }

            const goalPayload = {
                workspaceId: activeWorkspaceId,
                title,
                description: (form.querySelector('#goalDescription') as HTMLTextAreaElement).value,
                ownerId: (form.querySelector('#goalOwner') as HTMLSelectElement).value,
                dueDate: (form.querySelector('#goalDueDate') as HTMLInputElement).value,
                category: (form.querySelector('#goalCategory') as HTMLInputElement).value,
                priority: (form.querySelector('#goalPriority') as HTMLSelectElement).value,
                status: (form.querySelector('#goalStatus') as HTMLSelectElement).value,
                targetValue: parseFloat((form.querySelector('#goalTargetValue') as HTMLInputElement).value) || 0,
                currentValue: parseFloat((form.querySelector('#goalCurrentValue') as HTMLInputElement).value) || 0,
                valueUnit: (form.querySelector('#goalValueUnit') as HTMLInputElement).value
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
            const employeeId = (data as AddReviewModalData).employeeId;
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
                showToast(t('modals.select_a_project_error'), 'error');
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
                isMilestone: false,
                dealId: (data as AddTaskModalData)?.dealId
            };
            
            let [savedTask] = await apiPost('tasks', taskData);

            // Generate and save slug
            const slug = generateSlug(savedTask.name, savedTask.id);
            const [taskWithSlug] = await apiPut('tasks', { id: savedTask.id, slug });
            savedTask = { ...savedTask, ...taskWithSlug };
            
            const assigneeCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="taskAssigneesSelector"]:checked');
            const assigneeIds = Array.from(assigneeCheckboxes).map(cb => cb.value);
            if (assigneeIds.length > 0) {
                const assigneePayloads = assigneeIds.map(userId => ({ taskId: savedTask.id, userId, workspaceId: activeWorkspaceId }));
                const savedAssignees = await apiPost('task_assignees', assigneePayloads);
                setState(prevState => ({ taskAssignees: [...prevState.taskAssignees, ...savedAssignees] }), []);
                
                for (const userId of assigneeIds) {
                    if (userId !== state.currentUser!.id) {
                        await createNotification('new_assignment', { taskId: savedTask.id, userIdToNotify: userId, actorId: state.currentUser!.id });
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
            const form = document.getElementById('invoiceForm') as HTMLFormElement;
            const invoiceId = (data as AddInvoiceModalData)?.invoiceId;
            const isEdit = !!invoiceId;
        
            if (!isEdit && usage.invoicesThisMonth >= planLimits.invoices) {
                showToast(t('billing.limit_reached_invoices', { planName: workspace.subscription.planId }), 'error');
                return;
            }
        
            const clientId = (form.querySelector('#invoiceClient') as HTMLSelectElement).value;
            const issueDate = (form.querySelector('#invoiceIssueDate') as HTMLInputElement).value;
            const dueDate = (form.querySelector('#invoiceDueDate') as HTMLInputElement).value;
            if (!clientId || !issueDate || !dueDate) {
                showToast(t('errors.fill_all_fields'), 'error');
                return;
            }
        
            const itemRows = form.querySelectorAll<HTMLElement>('.invoice-item-row');
            const lineItemsFromForm: Omit<InvoiceLineItem, 'id' | 'invoiceId'>[] = [];
            itemRows.forEach(row => {
                const description = (row.querySelector('[data-field="description"]') as HTMLInputElement).value;
                const quantity = parseFloat((row.querySelector('[data-field="quantity"]') as HTMLInputElement).value);
                const unitPrice = parseFloat((row.querySelector('[data-field="unitPrice"]') as HTMLInputElement).value);
                if (description && !isNaN(quantity) && !isNaN(unitPrice)) {
                    lineItemsFromForm.push({ description, quantity, unitPrice });
                }
            });
        
            if (isEdit) {
                const invoiceData = { clientId, issueDate, dueDate };
                const [updatedInvoice] = await apiPut('invoices', { ...invoiceData, id: invoiceId });
        
                await apiFetch(`/api?action=data&resource=invoice_line_items`, {
                    method: 'DELETE',
                    body: JSON.stringify({ invoiceId: invoiceId })
                });
        
                let savedItems: InvoiceLineItem[] = [];
                if (lineItemsFromForm.length > 0) {
                    const newLineItemsPayload = lineItemsFromForm.map(item => ({ ...item, invoiceId }));
                    savedItems = await apiPost('invoice_line_items', newLineItemsPayload);
                }
                
                updatedInvoice.items = savedItems;
                
                setState(prevState => ({
                    invoices: prevState.invoices.map(i => i.id === invoiceId ? { ...i, ...updatedInvoice } : i)
                }), ['page']);
            } else {
                const invoiceData: Partial<Invoice> = {
                    workspaceId: activeWorkspaceId,
                    clientId,
                    issueDate,
                    dueDate,
                    status: 'pending',
                    emailStatus: 'not_sent',
                };
                const [savedInvoice] = await apiPost('invoices', invoiceData);
                
                let savedItems: InvoiceLineItem[] = [];
                if (lineItemsFromForm.length > 0) {
                    const lineItemsPayload = lineItemsFromForm.map(item => ({ ...item, invoiceId: savedInvoice.id }));
                    savedItems = await apiPost('invoice_line_items', lineItemsPayload);
                }
                savedInvoice.items = savedItems;
                
                const modalData = data as AddInvoiceModalData;
                if (modalData?.sourceLogIds?.length) {
                    await apiPut('time_logs', { ids: modalData.sourceLogIds, invoiceId: savedInvoice.id });
                    setState(prevState => ({
                        timeLogs: prevState.timeLogs.map(log => modalData.sourceLogIds!.includes(log.id) ? { ...log, invoiceId: savedInvoice.id } : log)
                    }), []);
                }
                if (modalData?.sourceExpenseIds?.length) {
                    await apiPut('expenses', { ids: modalData.sourceExpenseIds, invoiceId: savedInvoice.id });
                    setState(prevState => ({
                        expenses: prevState.expenses.map(exp => modalData.sourceExpenseIds!.includes(exp.id) ? { ...exp, invoiceId: savedInvoice.id } : exp)
                    }), []);
                }
        
                setState(prevState => ({ invoices: [...prevState.invoices, savedInvoice] }), ['page']);
            }
        } else if (type === 'addCommentToTimeLog') {
            const form = document.getElementById('add-comment-to-timelog-form') as HTMLFormElement;
            const trackedSeconds = parseInt((form.querySelector('#time-picker-seconds') as HTMLInputElement).value, 10);
            const comment = (form.querySelector('#timelog-comment') as HTMLTextAreaElement).value;
            const modalData = data as AddCommentToTimeLogModalData;
            await timerHandlers.handleSaveTimeLogAndComment(modalData.taskId, trackedSeconds, comment);
            return;
        } else if (type === 'addManualTimeLog') {
            const form = document.getElementById('manualTimeLogForm') as HTMLFormElement;
            const taskId = (form.querySelector('#timeLogTask') as HTMLSelectElement).value;
            const trackedSeconds = parseInt((form.querySelector('#time-picker-seconds') as HTMLInputElement).value, 10);
            const date = (form.querySelector('#timeLogDate') as HTMLInputElement).value;
            const time = (form.querySelector('#timeLogStartTime') as HTMLInputElement).value;
            const createdAt = new Date(`${date}T${time}`).toISOString();
            const comment = (form.querySelector('#timeLogComment') as HTMLTextAreaElement).value;
            if (taskId) {
                await timerHandlers.handleSaveManualTimeLog(taskId, trackedSeconds, createdAt, comment);
            }
            return;
        } else if (type === 'assignGlobalTime') {
             const form = document.getElementById('assignGlobalTimeForm') as HTMLFormElement;
             const taskId = (form.querySelector('#assign-time-task-select') as HTMLSelectElement).value;
             const comment = (form.querySelector('#assign-time-comment') as HTMLTextAreaElement).value;
             const modalData = data as AssignGlobalTimeModalData;
             if(taskId) {
                await timerHandlers.handleSaveManualTimeLog(taskId, modalData.trackedSeconds, new Date().toISOString(), comment);
             }
             return;
        } else if (type === 'addProjectSection') {
            const form = document.getElementById('add-project-section-form') as HTMLFormElement;
            const name = (form.querySelector('#project-section-name') as HTMLInputElement).value;
            const projectId = (data as AddProjectSectionModalData).projectId;
            if (name && projectId) {
                await projectSectionHandlers.handleCreateProjectSection(projectId, name);
            }
        } else if (type === 'addInventoryItem') {
            // ...
        } else if (type === 'assignInventoryItem') {
            // ...
        } else if (type === 'setBudgets') {
            // ...
        } else if (type === 'addDeal') {
            // ...
        } else if (type === 'addExpense') {
            // ...
        } else if (type === 'addCalendarEvent') {
            // ...
        } else if (type === 'addTimeOffRequest') {
            const form = document.getElementById('time-off-request-form') as HTMLFormElement;
            const type = (form.querySelector('#time-off-type') as HTMLSelectElement).value as TimeOffRequest['type'];
            const startDate = (form.querySelector('#time-off-start-date') as HTMLInputElement).value;
            const endDate = (form.querySelector('#time-off-end-date') as HTMLInputElement).value;
            await hrHandlers.handleSubmitTimeOffRequest(type, startDate, endDate);
            return;
        } else if (type === 'adjustVacationAllowance') {
            const form = document.getElementById('adjust-vacation-form') as HTMLFormElement;
            const userId = (data as AdjustVacationAllowanceModalData).userId;
            const hours = parseFloat((form.querySelector('#vacation-allowance') as HTMLInputElement).value);
            if (userId && !isNaN(hours)) {
                await hrHandlers.handleSetVacationAllowance(userId, hours);
            }
            return;
        } else if (type === 'confirmPlanChange') {
            const planId = (data as ConfirmPlanChangeModalData).planId;
            await billingHandlers.handlePlanChange(planId);
        } else if (type === 'employeeDetail') {
            const form = document.getElementById('employee-detail-form') as HTMLFormElement;
            const userId = (data as EmployeeDetailModalData).userId;
            const contractNotes = (form.querySelector('#contract-info-notes') as HTMLTextAreaElement).value;
            const employmentNotes = (form.querySelector('#employment-info-notes') as HTMLTextAreaElement).value;
            await hrHandlers.handleUpdateEmployeeNotes(userId, contractNotes, employmentNotes);
            return;
        } else if (type === 'rejectTimeOffRequest') {
            const form = document.getElementById('reject-time-off-form') as HTMLFormElement;
            const requestId = (data as RejectTimeOffRequestModalData).requestId;
            const reason = (form.querySelector('#rejection-reason') as HTMLTextAreaElement).value;
            if(requestId && reason) {
                await hrHandlers.handleRejectTimeOffRequest(requestId, reason);
            }
            return;
        }

        closeModal();
    } catch (error) {
        console.error("Form submission failed:", error);
        showToast((error as Error).message, 'error');
    } finally {
        if (button) {
            button.removeAttribute('disabled');
            (button as HTMLButtonElement).textContent = t('modals.save');
        }
    }
}
