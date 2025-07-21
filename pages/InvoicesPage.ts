
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate, getUsage, PLANS, formatCurrency } from '../utils.ts';
import type { Invoice } from '../types.ts';
import { can } from '../permissions.ts';

function getFilteredInvoices() {
    const { clientId, status, dateStart, dateEnd } = state.ui.invoiceFilters;
    const startDate = new Date(dateStart + 'T00:00:00Z');
    const endDate = new Date(dateEnd + 'T23:59:59Z');

    return state.invoices
        .filter(i => i.workspaceId === state.activeWorkspaceId)
        .map(invoice => {
            let effectiveStatus: 'pending' | 'paid' | 'overdue' = invoice.status;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (invoice.status === 'pending' && new Date(invoice.dueDate) < today) {
                effectiveStatus = 'overdue';
            }
            return { ...invoice, effectiveStatus };
        })
        .filter(invoice => {
            const clientMatch = clientId === 'all' || invoice.clientId === clientId;
            const statusMatch = status === 'all' || invoice.effectiveStatus === status;
            
            const issueDate = new Date(invoice.issueDate + 'T00:00:00Z');
            const dateMatch = issueDate >= startDate && issueDate <= endDate;

            return clientMatch && statusMatch && dateMatch;
        });
}

export function InvoicesPage() {
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return '';

    const usage = getUsage(activeWorkspace.id);
    const planLimits = PLANS[activeWorkspace.subscription.planId];
    const canCreateInvoice = usage.invoicesThisMonth < planLimits.invoices;
    const canManage = can('manage_invoices');
    const canCreate = canManage && canCreateInvoice;

    const filteredInvoices = getFilteredInvoices();

    const calculateInvoiceTotal = (invoice: Invoice) => {
        return invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    };
    
    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
    const statuses = ['pending', 'paid', 'overdue'];

    const summary = {
        count: filteredInvoices.length,
        totalAmount: filteredInvoices.reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0),
        overdueAmount: filteredInvoices
            .filter(inv => inv.effectiveStatus === 'overdue')
            .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0),
    };

    const summaryComponent = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="text-sm font-medium text-text-subtle">${t('invoices.title')}</h4>
                <div class="text-2xl font-bold mt-1">${summary.count}</div>
            </div>
            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="text-sm font-medium text-text-subtle">${t('invoices.col_total')}</h4>
                <div class="text-2xl font-bold mt-1">${formatCurrency(summary.totalAmount)}</div>
            </div>
            <div class="bg-content p-4 rounded-lg shadow-sm">
                <h4 class="text-sm font-medium text-text-subtle">${t('invoices.status_overdue')}</h4>
                <div class="text-2xl font-bold mt-1 text-danger">${formatCurrency(summary.overdueAmount)}</div>
            </div>
        </div>
    `;

    const filterBar = `
        <div id="invoice-filters-bar" class="bg-content p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div class="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div>
                    <label class="text-xs text-text-subtle mb-1 block">${t('reports.filter_date_range')}</label>
                    <div class="flex items-center gap-2">
                        <input type="date" id="invoice-filter-date-start" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${state.ui.invoiceFilters.dateStart}">
                        <span>-</span>
                        <input type="date" id="invoice-filter-date-end" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" value="${state.ui.invoiceFilters.dateEnd}">
                    </div>
                </div>
                <div>
                    <label for="invoice-filter-client" class="text-xs text-text-subtle mb-1 block">${t('invoices.col_client')}</label>
                    <select id="invoice-filter-client" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                        <option value="all">${t('invoices.all_clients')}</option>
                        ${workspaceClients.map(c => `<option value="${c.id}" ${state.ui.invoiceFilters.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="invoice-filter-status" class="text-xs text-text-subtle mb-1 block">${t('invoices.col_status')}</label>
                    <select id="invoice-filter-status" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                        <option value="all">${t('invoices.all_statuses')}</option>
                        ${statuses.map(s => `<option value="${s}" ${state.ui.invoiceFilters.status === s ? 'selected' : ''}>${t('invoices.status_' + s)}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
    `;

    return `
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-bold">${t('invoices.title')}</h2>
                 <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed" data-modal-target="addInvoice" ${!canCreate ? 'disabled' : ''} title="${!canCreateInvoice ? t('billing.limit_reached_invoices').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                    <span class="material-icons-sharp text-base">add</span> ${t('invoices.new_invoice')}
                </button>
            </div>
            ${filterBar}
            ${summaryComponent}
            ${filteredInvoices.length > 0 ? `
                <div class="bg-content rounded-lg shadow-sm overflow-x-auto">
                     <table class="w-full text-sm text-left">
                        <thead class="bg-background text-xs text-text-subtle uppercase">
                            <tr>
                                <th scope="col" class="px-4 py-3">${t('invoices.col_number')}</th>
                                <th scope="col" class="px-4 py-3">${t('invoices.col_client')}</th>
                                <th scope="col" class="px-4 py-3">${t('invoices.col_issued')}</th>
                                <th scope="col" class="px-4 py-3">${t('invoices.col_due')}</th>
                                <th scope="col" class="px-4 py-3 text-right">${t('invoices.col_total')}</th>
                                <th scope="col" class="px-4 py-3">${t('invoices.col_status')}</th>
                                <th scope="col" class="px-4 py-3 text-right">${t('invoices.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                        ${filteredInvoices.map(invoice => {
                            const client = state.clients.find(c => c.id === invoice.clientId);
                            const total = calculateInvoiceTotal(invoice);
                             const statusColors = {
                                paid: 'bg-success/10 text-success',
                                pending: 'bg-warning/10 text-warning',
                                overdue: 'bg-danger/10 text-danger'
                            };
                            const statusBadgeClass = statusColors[invoice.effectiveStatus] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';

                            return `
                                 <tr class="border-b border-border-color hover:bg-background">
                                    <td class="px-4 py-3 font-medium">${invoice.invoiceNumber}</td>
                                    <td class="px-4 py-3">${client?.name || t('misc.not_applicable')}</td>
                                    <td class="px-4 py-3">${formatDate(invoice.issueDate)}</td>
                                    <td class="px-4 py-3">${formatDate(invoice.dueDate)}</td>
                                    <td class="px-4 py-3 text-right font-medium">${formatCurrency(total)}</td>
                                    <td class="px-4 py-3">
                                        <div class="flex items-center gap-2">
                                            <span class="px-2 py-1 text-xs font-semibold rounded-full capitalize ${statusBadgeClass}">${t('invoices.status_' + invoice.effectiveStatus)}</span>
                                            ${invoice.emailStatus === 'sent' ? `<span class="material-icons-sharp text-success text-base" title="${t('invoices.status_sent')}">mark_email_read</span>` : ''}
                                        </div>
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <div class="flex items-center justify-end gap-1">
                                            <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-send-invoice-id="${invoice.id}" title="${t('invoices.send_by_email')}" aria-label="${t('invoices.send_by_email')}">
                                                <span class="material-icons-sharp text-lg">outgoing_mail</span>
                                            </button>
                                            <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-download-invoice-id="${invoice.id}" aria-label="${t('invoices.download_pdf')}">
                                                <span class="material-icons-sharp text-lg">picture_as_pdf</span>
                                            </button>
                                            ${canManage ? `
                                                <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-toggle-invoice-status-id="${invoice.id}" aria-label="${invoice.status === 'paid' ? t('invoices.mark_as_unpaid') : t('invoices.mark_as_paid')}">
                                                    <span class="material-icons-sharp text-lg">${invoice.status === 'paid' ? 'cancel' : 'check_circle'}</span>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                 <div class="flex flex-col items-center justify-center h-96 bg-content rounded-lg border-2 border-dashed border-border-color">
                    <span class="material-icons-sharp text-5xl text-text-subtle">receipt_long</span>
                    <h3 class="text-lg font-medium mt-4">${t('invoices.no_invoices_yet')}</h3>
                    <p class="text-sm text-text-subtle mt-1">${t('invoices.no_invoices_desc')}</p>
                     <button class="mt-4 px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed" data-modal-target="addInvoice" ${!canCreate ? 'disabled' : ''}>
                        ${t('invoices.new_invoice')}
                    </button>
                </div>
            `}
        </div>
    `;
}
