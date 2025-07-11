

import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { InvoiceLineItem } from '../types.ts';
import { t } from '../i18n.ts';

export function handleGenerateInvoiceItems() {
    const { clientId } = state.ui.modal.data;
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

    // --- Generate items from Time Logs ---
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
                    id: Date.now() + Math.random(),
                    description: t('invoices.generated_item_desc')
                        .replace('{projectName}', project.name)
                        .replace('{hours}', totalHours.toFixed(2)),
                    quantity: parseFloat(totalHours.toFixed(2)),
                    unitPrice: project.hourlyRate!,
                });
            }
        }
    }

    // --- Generate items from Expenses ---
    const unbilledExpenses = state.expenses.filter(ex => 
        ex.workspaceId === state.activeWorkspaceId &&
        !ex.invoiceId &&
        billableProjectIds.has(ex.projectId)
    );

    unbilledExpenses.forEach(ex => {
        newItems.push({
            id: Date.now() + Math.random(),
            description: t('invoices.generated_expense_desc').replace('{expenseDesc}', ex.description),
            quantity: 1,
            unitPrice: ex.amount,
        });
    });

    state.ui.modal.data.items = newItems;
    state.ui.modal.data.sourceLogIds = unbilledTimeLogs.map(l => l.id);
    state.ui.modal.data.sourceExpenseIds = unbilledExpenses.map(e => e.id);
    renderApp();
}

export function handleToggleInvoiceStatus(invoiceId: string) {
    const invoice = state.invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        invoice.status = invoice.status === 'paid' ? 'pending' : 'paid';
        saveState();
        renderApp();
    }
}

export function handleSendInvoiceByEmail(invoiceId: string) {
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

    // Use window.open for better compatibility
    window.open(mailtoLink, '_self');

    // Optimistically update status
    invoice.emailStatus = 'sent';
    saveState();
    renderApp();
}