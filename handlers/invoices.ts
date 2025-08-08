import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { InvoiceLineItem, TimeLog, Expense, Task, Workspace } from '../types.ts';
import { t } from '../i18n.ts';
import { apiPut, apiFetch } from '../services/api.ts';
import { showModal, showToast } from './ui.ts';

export async function fetchInvoicesForWorkspace(workspaceId: string) {
    console.log(`Fetching invoice data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&invoicesOnly=true`);
        if (!data) throw new Error("Invoice data fetch returned null.");

        setState(prevState => ({
            invoices: data.invoices || [],
            ui: {
                ...prevState.ui,
                invoices: { ...prevState.ui.invoices, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched invoice data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch invoice data:", error);
        setState(prevState => ({
            ui: { ...prevState.ui, invoices: { ...prevState.ui.invoices, isLoading: false, loadedWorkspaceId: null } }
        }), ['page']);
    }
}

export function handleGenerateInvoiceItems() {
    const state = getState();
    const clientSelect = document.getElementById('invoiceClient') as HTMLSelectElement | null;
    const clientId = clientSelect?.value;

    if (!clientId || !state.activeWorkspaceId) {
        showToast("Please select a client first.", 'error');
        return;
    }

    const taskMap = new Map(state.tasks.map(t => [t.id, t]));

    const billableProjects = state.projects.filter(p =>
        p.workspaceId === state.activeWorkspaceId &&
        p.clientId === clientId
    );

    const billableProjectIds = new Set(billableProjects.map(p => p.id));
    const newItems: InvoiceLineItem[] = [];

    const unbilledTimeLogs = state.timeLogs.filter(tl => {
        const task = taskMap.get(tl.taskId);
        return tl.workspaceId === state.activeWorkspaceId &&
               !tl.invoiceId &&
               task &&
               billableProjectIds.has(task.projectId);
    });

    const timeByProject: Record<string, number> = {};
    unbilledTimeLogs.forEach(tl => {
        const task = taskMap.get(tl.taskId)!;
        if (!timeByProject[task.projectId]) {
            timeByProject[task.projectId] = 0;
        }
        timeByProject[task.projectId] += tl.trackedSeconds;
    });
    
    for (const projectId in timeByProject) {
        const project = billableProjects.find(p => p.id === projectId)!;
        if (project.hourlyRate && project.hourlyRate > 0) {
            const totalSeconds = timeByProject[projectId];
            const totalHours = totalSeconds / 3600;

            if (totalHours > 0) {
                newItems.push({
                    id: (Date.now() + Math.random()).toString(),
                    invoiceId: '',
                    description: t('invoices.generated_item_desc')
                        .replace('{projectName}', project.name)
                        .replace('{hours}', totalHours.toFixed(2)),
                    quantity: parseFloat(totalHours.toFixed(2)),
                    unitPrice: project.hourlyRate!,
                });
            }
        }
    }

    const unbilledExpenses = state.expenses.filter(ex => 
        ex.workspaceId === state.activeWorkspaceId &&
        ex.isBillable &&
        !ex.invoiceId &&
        ex.projectId && // Ensure expense is linked to a project
        billableProjectIds.has(ex.projectId)
    );

    unbilledExpenses.forEach(ex => {
        newItems.push({
            id: (Date.now() + Math.random()).toString(),
            invoiceId: '',
            description: t('invoices.generated_expense_desc').replace('{expenseDesc}', ex.description),
            quantity: 1,
            unitPrice: ex.amount,
        });
    });

    setState(prevState => ({
        ui: {
            ...prevState.ui,
            modal: {
                ...prevState.ui.modal,
                data: {
                    ...prevState.ui.modal.data,
                    items: newItems,
                    sourceLogIds: unbilledTimeLogs.map(l => l.id),
                    sourceExpenseIds: unbilledExpenses.map(e => e.id),
                }
            }
        }
    }), ['modal']);
}

export async function handleToggleInvoiceStatus(invoiceId: string) {
    const state = getState();
    const invoice = state.invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        const originalStatus = invoice.status;
        const newStatus = originalStatus === 'paid' ? 'pending' : 'paid';
        
        setState(prevState => ({ 
            invoices: prevState.invoices.map(i => i.id === invoiceId ? { ...invoice, status: newStatus } : i)
        }), ['page']);

        try {
            await apiPut('invoices', { id: invoiceId, status: newStatus });
        } catch (error) {
            console.error("Failed to toggle invoice status:", error);
            setState(prevState => ({ 
                invoices: prevState.invoices.map(i => i.id === invoiceId ? { ...i, status: originalStatus } : i)
            }), ['page']);
            showToast("Could not update invoice status. Please try again.", 'error');
        }
    }
}

export async function handleSendInvoiceByEmail(invoiceId: string) {
    const state = getState();
    const gmailIntegration = state.integrations.find(i => i.workspaceId === state.activeWorkspaceId && i.provider === 'google_gmail' && i.isActive);

    if (gmailIntegration) {
        showModal('sendInvoiceEmail', { invoiceId });
        return;
    }

    // Fallback to mailto link
    const invoice = state.invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const client = state.clients.find(c => c.id === invoice.clientId);
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    
    const primaryContact = client?.contacts?.[0];
    const clientEmail = primaryContact?.email || client?.email;

    if (!client || !clientEmail) {
        showToast(t('invoices.client_email_missing'), 'error');
        return;
    }
    if (!workspace) return;

    const subject = t('invoices.email_template_subject')
        .replace('{invoiceNumber}', invoice.invoiceNumber)
        .replace('{companyName}', workspace.companyName || '');

    const body = t('invoices.email_template_body')
        .replace('{invoiceNumber}', invoice.invoiceNumber)
        .replace('{companyName}', workspace.companyName || '');

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    let mailtoLink = `mailto:${clientEmail}?subject=${encodedSubject}&body=${encodedBody}`;

    if (workspace.companyEmail) {
        mailtoLink += `&bcc=${encodeURIComponent(workspace.companyEmail)}`;
    }

    window.open(mailtoLink, '_self');

    const originalEmailStatus = invoice.emailStatus;
    const originalSentAt = invoice.sentAt;
    
    setState(prevState => ({
        invoices: prevState.invoices.map(i => i.id === invoiceId ? { ...i, emailStatus: 'sent', sentAt: new Date().toISOString() } : i)
    }), ['page']);


    try {
        await apiPut('invoices', { id: invoiceId, emailStatus: 'sent', sentAt: new Date().toISOString() });
    } catch (error) {
        console.error("Failed to update invoice email status:", error);
        setState(prevState => ({
            invoices: prevState.invoices.map(i => i.id === invoiceId ? { ...i, emailStatus: originalEmailStatus, sentAt: originalSentAt } : i)
        }), ['page']);
    }
}

export async function handleSaveInvoiceSettings() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;

    const template = (document.getElementById('invoice-template-input') as HTMLInputElement).value as 'modern' | 'classic' | 'elegant' | 'minimalist';
    const accentColor = (document.getElementById('invoice-accent-color') as HTMLInputElement).value;
    const defaultNotes = (document.getElementById('invoice-default-notes') as HTMLTextAreaElement).value;

    const newSettings = {
        template,
        accentColor,
        defaultNotes,
    };

    const originalSettings = workspace.invoiceSettings;

    // Optimistic update
    setState(prevState => ({
        workspaces: prevState.workspaces.map(w => 
            w.id === activeWorkspaceId ? { ...w, invoiceSettings: newSettings } : w
        )
    }), []);

    const saveButton = document.getElementById('save-invoice-settings-btn');
    if (saveButton) {
        saveButton.textContent = t('misc.saving');
        saveButton.setAttribute('disabled', 'true');
    }

    try {
        await apiPut('workspaces', { id: activeWorkspaceId, invoiceSettings: newSettings });
        if (saveButton) {
            saveButton.textContent = t('misc.saved');
            setTimeout(() => {
                if (saveButton) {
                    saveButton.textContent = t('modals.save');
                    saveButton.removeAttribute('disabled');
                }
            }, 2000);
        }
    } catch (error) {
        console.error("Failed to save invoice settings:", error);
        showToast("Failed to save invoice settings.", 'error');
        
        // Revert on failure
        setState(prevState => ({
            workspaces: prevState.workspaces.map(w => 
                w.id === activeWorkspaceId ? { ...w, invoiceSettings: originalSettings } : w
            )
        }), ['page']);

        if (saveButton) {
            saveButton.textContent = t('modals.save');
            saveButton.removeAttribute('disabled');
        }
    }
}