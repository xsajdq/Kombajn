import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { InvoiceLineItem } from '../types.ts';
import { t } from '../i18n.ts';
import { apiPut } from '../services/api.ts';
import { showModal } from './ui.ts';

export function handleGenerateInvoiceItems() {
    const clientSelect = document.getElementById('invoiceClient') as HTMLSelectElement | null;
    const clientId = clientSelect?.value;

    if (!clientId || !state.activeWorkspaceId) {
        alert("Please select a client first.");
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

    state.ui.modal.data.items = newItems;
    state.ui.modal.data.sourceLogIds = unbilledTimeLogs.map(l => l.id);
    state.ui.modal.data.sourceExpenseIds = unbilledExpenses.map(e => e.id);
    updateUI(['modal']);
}

export async function handleToggleInvoiceStatus(invoiceId: string) {
    const invoice = state.invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        const originalStatus = invoice.status;
        const newStatus = originalStatus === 'paid' ? 'pending' : 'paid';
        
        invoice.status = newStatus;
        updateUI(['page']);

        try {
            await apiPut('invoices', { id: invoiceId, status: newStatus });
        } catch (error) {
            console.error("Failed to toggle invoice status:", error);
            invoice.status = originalStatus;
            updateUI(['page']);
            alert("Could not update invoice status. Please try again.");
        }
    }
}

export async function handleSendInvoiceByEmail(invoiceId: string) {
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

    if (!client || !client.email) {
        alert(t('invoices.client_email_missing'));
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
    let mailtoLink = `mailto:${client.email}?subject=${encodedSubject}&body=${encodedBody}`;

    if (workspace.companyEmail) {
        mailtoLink += `&bcc=${encodeURIComponent(workspace.companyEmail)}`;
    }

    window.open(mailtoLink, '_self');

    const originalEmailStatus = invoice.emailStatus;
    invoice.emailStatus = 'sent';
    updateUI(['page']);

    try {
        await apiPut('invoices', { id: invoiceId, emailStatus: 'sent' });
    } catch (error) {
        console.error("Failed to update invoice email status:", error);
        invoice.emailStatus = originalEmailStatus;
        updateUI(['page']);
    }
}