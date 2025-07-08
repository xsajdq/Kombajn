

import { state, saveState, generateId } from '../state.ts';
import { closeModal } from './ui.ts';
import { createNotification } from './notifications.ts';
import { getUsage, PLANS } from '../utils.ts';
import type { Invoice, InvoiceLineItem, Task, ProjectMember, Project, ProjectTemplate, Channel, Automation, Objective, KeyResult, Expense, TimeOffRequest, CalendarEvent, Deal } from '../types.ts';
import { t } from '../i18n.ts';
import { renderApp } from '../app-renderer.ts';
import * as timerHandlers from './timers.ts';
import * as hrHandlers from './team.ts';
import { handleWidgetConfigSave } from './dashboard.ts';

export function handleFormSubmit() {
    const { type, data } = state.ui.modal;
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId || !state.currentUser) return;

    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;
    const usage = getUsage(activeWorkspaceId);
    const planLimits = PLANS[workspace.subscription.planId];

    if (type === 'addClient') {
        const clientId = (document.getElementById('clientId') as HTMLInputElement).value;
        const name = (document.getElementById('clientName') as HTMLInputElement).value;
        const vatId = (document.getElementById('clientVatId') as HTMLInputElement).value;
        const contactPerson = (document.getElementById('clientContact') as HTMLInputElement).value;
        const email = (document.getElementById('clientEmail') as HTMLInputElement).value;
        const phone = (document.getElementById('clientPhone') as HTMLInputElement).value;

        if (name) {
            if (clientId) { // Editing existing client
                const clientIndex = state.clients.findIndex(c => c.id === clientId);
                if (clientIndex !== -1) {
                    state.clients[clientIndex] = { ...state.clients[clientIndex], name, vatId, contactPerson, email, phone };
                }
            } else { // Creating new client
                 state.clients.push({ id: generateId(), workspaceId: activeWorkspaceId, name, vatId, contactPerson, email, phone });
            }
        }
    }

    if (type === 'addProject') {
        if (usage.projects >= planLimits.projects) {
            alert(t('billing.limit_reached_projects').replace('{planName}', workspace.subscription.planId));
            return;
        }
        const name = (document.getElementById('projectName') as HTMLInputElement).value;
        const clientId = (document.getElementById('projectClient') as HTMLSelectElement).value;
        const hourlyRateInput = (document.getElementById('projectHourlyRate') as HTMLInputElement).value;
        const hourlyRate = hourlyRateInput ? parseFloat(hourlyRateInput) : undefined;
        const privacy = (document.querySelector('input[name="privacy"]:checked') as HTMLInputElement).value as Project['privacy'];
        const templateId = (document.getElementById('projectTemplate') as HTMLSelectElement).value;

        if (name && clientId) {
            const newProjectId = generateId();
            state.projects.push({ id: newProjectId, workspaceId: activeWorkspaceId, name, clientId, wikiContent: '', hourlyRate, privacy });
            
            // If project is private, add the creator as an admin
            if (privacy === 'private') {
                const newProjectMember: ProjectMember = {
                    id: generateId(),
                    projectId: newProjectId,
                    userId: state.currentUser.id,
                    role: 'admin'
                };
                state.projectMembers.push(newProjectMember);
            }

            // Create tasks and automations if a template was selected
            if (templateId) {
                const template = state.projectTemplates.find(t => t.id === templateId);
                if (template) {
                    template.tasks.forEach(taskTemplate => {
                        const newTask: Task = {
                            id: generateId(),
                            workspaceId: activeWorkspaceId,
                            projectId: newProjectId,
                            name: taskTemplate.name,
                            description: taskTemplate.description,
                            priority: taskTemplate.priority,
                            status: 'todo', // Default status for template tasks
                        };
                        state.tasks.push(newTask);
                    });

                    if (template.automations) {
                        template.automations.forEach(automationTemplate => {
                            const newAutomation: Automation = {
                                id: generateId(),
                                workspaceId: activeWorkspaceId,
                                projectId: newProjectId,
                                ...automationTemplate
                            };
                            state.automations.push(newAutomation);
                        });
                    }
                }
            }
            
            // Create a chat channel for the new project
            const newChannel: Channel = {
                id: generateId(),
                workspaceId: activeWorkspaceId,
                projectId: newProjectId,
                name: name,
            };
            state.channels.push(newChannel);
        }
    }

    if (type === 'addTask') {
        const name = (document.getElementById('taskName') as HTMLInputElement).value;
        const description = (document.getElementById('taskDescription') as HTMLTextAreaElement).value;
        const projectId = (document.getElementById('taskProject') as HTMLSelectElement).value;
        const assigneeId = (document.getElementById('taskAssignee') as HTMLSelectElement).value;
        
        if (name && projectId) {
             const initialStatus = state.settings.defaultKanbanWorkflow === 'advanced' ? 'backlog' : 'todo';
             const newTaskId = generateId();
             state.tasks.push({ id: newTaskId, workspaceId: activeWorkspaceId, name, projectId, status: initialStatus, description, assigneeId });
             if (assigneeId && state.currentUser && assigneeId !== state.currentUser.id) {
                createNotification('new_assignment', { taskId: newTaskId, userIdToNotify: assigneeId, actorId: state.currentUser.id });
                renderApp();
             }
        }
    }

    if (type === 'addDeal') {
        const name = (document.getElementById('dealName') as HTMLInputElement).value;
        const clientId = (document.getElementById('dealClient') as HTMLSelectElement).value;
        const value = parseFloat((document.getElementById('dealValue') as HTMLInputElement).value);
        const ownerId = (document.getElementById('dealOwner') as HTMLSelectElement).value;
        const stage = (document.getElementById('dealStage') as HTMLSelectElement).value as Deal['stage'];
        const expectedCloseDate = (document.getElementById('dealExpectedCloseDate') as HTMLInputElement).value;
        
        if (name && clientId && !isNaN(value) && ownerId && stage) {
             const newDeal: Deal = {
                 id: generateId(),
                 workspaceId: activeWorkspaceId,
                 name,
                 clientId,
                 value,
                 ownerId,
                 stage,
                 expectedCloseDate: expectedCloseDate || undefined,
                 createdAt: new Date().toISOString()
             };
             state.deals.push(newDeal);
        }
    }

    if (type === 'addManualTimeLog') {
        const amount = (document.getElementById('timeLogAmount') as HTMLInputElement).value;
        const date = (document.getElementById('timeLogDate') as HTMLInputElement).value;
        const comment = (document.getElementById('timeLogComment') as HTMLTextAreaElement).value;
        const taskId = data.taskId;

        if (amount && date && taskId) {
            timerHandlers.handleSaveManualTimeLog(taskId, amount, date, comment);
        }
    }

    if (type === 'addInvoice') {
        if (usage.invoicesThisMonth >= planLimits.invoices) {
            alert(t('billing.limit_reached_invoices').replace('{planName}', workspace.subscription.planId));
            return;
        }
        const { clientId, issueDate: issueDateStr, dueDate, items } = data;
        const filteredItems = items.filter((item: InvoiceLineItem) => item.description && item.quantity > 0 && item.unitPrice >= 0);

        if (clientId && issueDateStr && dueDate && filteredItems.length > 0) {
            const issueDate = new Date(issueDateStr + 'T00:00:00');
            const year = issueDate.getFullYear();
            const month = issueDate.getMonth() + 1;
    
            const invoicesInMonth = state.invoices.filter(i => {
                if (i.workspaceId !== activeWorkspaceId) return false;
                const invDate = new Date(i.issueDate);
                return invDate.getFullYear() === year && (invDate.getMonth() + 1) === month;
            });

            const newInvoiceNumberInMonth = invoicesInMonth.length + 1;
            const newInvoiceNumber = `${year}/${String(month).padStart(2, '0')}/${newInvoiceNumberInMonth}`;
            
            const newInvoice: Invoice = {
                id: generateId(),
                workspaceId: activeWorkspaceId,
                invoiceNumber: newInvoiceNumber,
                clientId,
                issueDate: issueDateStr,
                dueDate,
                items: filteredItems,
                status: 'pending',
                emailStatus: 'not_sent',
            };
            state.invoices.push(newInvoice);

            const sourceLogIds = data.sourceLogIds || [];
            const sourceExpenseIds = data.sourceExpenseIds || [];
    
            // Mark associated time logs and expenses as billed
            if (sourceLogIds.length > 0) {
                state.timeLogs.forEach(tl => {
                    if (sourceLogIds.includes(tl.id)) {
                        tl.invoiceId = newInvoice.id;
                    }
                });
            }
            if (sourceExpenseIds.length > 0) {
                state.expenses.forEach(ex => {
                    if (sourceExpenseIds.includes(ex.id)) {
                        ex.invoiceId = newInvoice.id;
                    }
                });
            }
        }
    }
    
    if (type === 'addObjective') {
        const title = (document.getElementById('objectiveTitle') as HTMLInputElement).value;
        const description = (document.getElementById('objectiveDescription') as HTMLTextAreaElement).value;
        const projectId = data.projectId;
        if (title && projectId) {
            const newObjective: Objective = {
                id: generateId(),
                workspaceId: activeWorkspaceId,
                projectId,
                title,
                description,
            };
            state.objectives.push(newObjective);
        }
    }

    if (type === 'addKeyResult') {
        const title = (document.getElementById('krTitle') as HTMLInputElement).value;
        const keyResultType = (document.getElementById('krType') as HTMLSelectElement).value as 'number' | 'percentage';
        const startValue = parseFloat((document.getElementById('krStart') as HTMLInputElement).value);
        const targetValue = parseFloat((document.getElementById('krTarget') as HTMLInputElement).value);
        const currentValue = parseFloat((document.getElementById('krCurrent') as HTMLInputElement).value);
        const objectiveId = data.objectiveId;

        if (title && objectiveId && !isNaN(startValue) && !isNaN(targetValue) && !isNaN(currentValue)) {
            const newKeyResult: KeyResult = {
                id: generateId(),
                objectiveId,
                title,
                type: keyResultType,
                startValue,
                targetValue,
                currentValue,
            };
            state.keyResults.push(newKeyResult);
        }
    }
    
    if (type === 'addExpense') {
        const description = (document.getElementById('expenseDescription') as HTMLInputElement).value;
        const amount = parseFloat((document.getElementById('expenseAmount') as HTMLInputElement).value);
        const date = (document.getElementById('expenseDate') as HTMLInputElement).value;
        const projectId = data.projectId;

        if (description && !isNaN(amount) && date && projectId) {
            const newExpense: Expense = {
                id: generateId(),
                workspaceId: activeWorkspaceId,
                projectId,
                description,
                amount,
                date,
            };
            state.expenses.push(newExpense);
        }
    }

    if (type === 'addTimeOffRequest') {
        const leaveType = (document.getElementById('leaveType') as HTMLSelectElement).value as 'vacation' | 'sick_leave' | 'other';
        const startDate = (document.getElementById('leaveStartDate') as HTMLInputElement).value;
        const endDate = (document.getElementById('leaveEndDate') as HTMLInputElement).value;
        
        if (leaveType && startDate && endDate) {
            hrHandlers.handleSubmitTimeOffRequest(leaveType, startDate, endDate);
        }
    }

    if (type === 'addCalendarEvent') {
        const title = (document.getElementById('eventTitle') as HTMLInputElement).value;
        const eventType = (document.getElementById('eventType') as HTMLSelectElement).value as 'event' | 'on-call';
        const startDate = (document.getElementById('eventStartDate') as HTMLInputElement).value;
        const endDate = (document.getElementById('eventEndDate') as HTMLInputElement).value;

        if (title && startDate && endDate) {
            const newEvent: CalendarEvent = {
                id: generateId(),
                workspaceId: activeWorkspaceId,
                title,
                startDate,
                endDate,
                isAllDay: true, // For simplicity, all events are all-day for now
                type: eventType,
            };
            state.calendarEvents.push(newEvent);
        }
    }
    
    if (type === 'rejectTimeOffRequest') {
        const reason = (document.getElementById('rejectionReason') as HTMLTextAreaElement).value;
        const requestId = (document.querySelector('#rejectTimeOffForm') as HTMLElement).dataset.requestId!;
        if (reason && requestId) {
            hrHandlers.handleRejectTimeOffRequest(requestId, reason);
        }
    }

    if (type === 'employeeDetail') {
        const userId = (document.getElementById('employeeDetailForm') as HTMLElement).dataset.userId!;
        const contractNotes = (document.getElementById('contractInfoNotes') as HTMLTextAreaElement).value;
        const employmentNotes = (document.getElementById('employmentInfoNotes') as HTMLTextAreaElement).value;
        hrHandlers.handleUpdateEmployeeNotes(userId, contractNotes, employmentNotes);
        return; // Don't call closeModal again
    }

    if (type === 'configureWidget') {
        const widgetId = (document.getElementById('widgetConfigForm') as HTMLElement).dataset.widgetId!;
        handleWidgetConfigSave(widgetId);
        return;
    }


    closeModal();
    saveState();
    renderApp();
}