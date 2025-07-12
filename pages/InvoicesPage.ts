import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate, getUsage, PLANS } from '../utils.ts';
import type { Invoice } from '../types.ts';
import { can } from '../permissions.ts';

function getFilteredInvoices() {
    const { clientId, status, dateStart, dateEnd } = state.ui.invoiceFilters;
    const startDate = new Date(dateStart);
    const endDate = new Date(dateEnd);

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
            
            const issueDate = new Date(invoice.issueDate + 'T00:00:00');
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
    
    const { filters } = state.ui.reports;
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
        <div class="invoice-summary-grid">
            <div class="card stat-card">
                <h4>${t('invoices.title')}</h4>
                <div class="stat-card-value">${summary.count}</div>
            </div>
            <div class="card stat-card">
                <h4>${t('invoices.col_total')}</h4>
                <div class="stat-card-value">${new Intl.NumberFormat('pl-PL').format(summary.totalAmount)} PLN</div>
            </div>
            <div class="card stat-card">
                <h4>${t('invoices.status_overdue')}</h4>
                <div class="stat-card-value overdue">${new Intl.NumberFormat('pl-PL').format(summary.overdueAmount)} PLN</div>
            </div>
        </div>
    `;

    const filterBar = `
        <div id="invoice-filters-bar" class="card reports-filter-bar" style="margin-bottom: 1.5rem;">
            <div class="form-group">
                <label>${t('reports.filter_date_range')}</label>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="date" id="invoice-filter-date-start" class="form-control" value="${state.ui.invoiceFilters.dateStart}">
                    <span>-</span>
                    <input type="date" id="invoice-filter-date-end" class="form-control" value="${state.ui.invoiceFilters.dateEnd}">
                </div>
            </div>
            <div class="form-group">
                <label>${t('invoices.col_client')}</label>
                <select id="invoice-filter-client" class="form-control">
                    <option value="all">${t('invoices.all_clients')}</option>
                    ${workspaceClients.map(c => `<option value="${c.id}" ${state.ui.invoiceFilters.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>${t('invoices.col_status')}</label>
                <select id="invoice-filter-status" class="form-control">
                    <option value="all">${t('invoices.all_statuses')}</option>
                    ${statuses.map(s => `<option value="${s}" ${state.ui.invoiceFilters.status === s ? 'selected' : ''}>${t('invoices.status_' + s)}</option>`).join('')}
                </select>
            </div>
        </div>
    `;

    return `
        <div>
            <h2>
                <span>${t('invoices.title')}</span>
                 <button class="btn btn-primary" data-modal-target="addInvoice" ${!canCreate ? 'disabled' : ''} title="${!canCreateInvoice ? t('billing.limit_reached_invoices').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                    <span class="material-icons-sharp">add</span> ${t('invoices.new_invoice')}
                </button>
            </h2>
            ${filterBar}
            ${summaryComponent}
            ${filteredInvoices.length > 0 ? `
                <div class="card invoice-list-container">
                     <div class="invoice-list-header">
                        <div>${t('invoices.col_number')}</div>
                        <div>${t('invoices.col_client')}</div>
                        <div>${t('invoices.col_issued')}</div>
                        <div>${t('invoices.col_due')}</div>
                        <div>${t('invoices.col_total')}</div>
                        <div>${t('invoices.col_status')}</div>
                        <div>${t('invoices.col_actions')}</div>
                    </div>
                    <div class="invoice-list-body">
                    ${filteredInvoices.map(invoice => {
                        const client = state.clients.find(c => c.id === invoice.clientId);
                        const total = calculateInvoiceTotal(invoice);
                        const statusBadgeClass = invoice.effectiveStatus === 'overdue' ? 'status-backlog' : (invoice.effectiveStatus === 'paid' ? 'status-paid' : 'status-pending');

                        return `
                             <div class="invoice-list-row">
                                <div data-label="${t('invoices.col_number')}">${invoice.invoiceNumber}</div>
                                <div data-label="${t('invoices.col_client')}">${client?.name || t('misc.not_applicable')}</div>
                                <div data-label="${t('invoices.col_issued')}">${formatDate(invoice.issueDate)}</div>
                                <div data-label="${t('invoices.col_due')}">${formatDate(invoice.dueDate)}</div>
                                <div data-label="${t('invoices.col_total')}">${total.toFixed(2)} PLN</div>
                                <div data-label="${t('invoices.col_status')}">
                                    <span class="status-badge ${statusBadgeClass}">${t('modals.status_' + invoice.effectiveStatus)}</span>
                                    ${invoice.emailStatus === 'sent' ? `<span class="material-icons-sharp" title="${t('invoices.status_sent')}" style="color: var(--success-color); vertical-align: middle; margin-left: 0.5rem;">mark_email_read</span>` : ''}
                                </div>
                                <div data-label="${t('invoices.col_actions')}" style="display: flex; gap: 0.5rem;">
                                    <button class="btn-icon" data-send-invoice-id="${invoice.id}" title="${t('invoices.send_by_email')}" aria-label="${t('invoices.send_by_email')}">
                                        <span class="material-icons-sharp">outgoing_mail</span>
                                    </button>
                                    <button class="btn-icon" data-download-invoice-id="${invoice.id}" aria-label="${t('invoices.download_pdf')}">
                                        <span class="material-icons-sharp">picture_as_pdf</span>
                                    </button>
                                    ${canManage ? `
                                        <button class="btn-icon" data-toggle-invoice-status-id="${invoice.id}" aria-label="${invoice.status === 'paid' ? t('invoices.mark_as_unpaid') : t('invoices.mark_as_paid')}">
                                            <span class="material-icons-sharp">${invoice.status === 'paid' ? 'cancel' : 'check_circle'}</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                    </div>
                </div>
            ` : `
                 <div class="empty-state">
                    <span class="material-icons-sharp">receipt_long</span>
                    <h3>${t('invoices.no_invoices_yet')}</h3>
                    <p>${t('invoices.no_invoices_desc')}</p>
                     <button class="btn btn-primary" data-modal-target="addInvoice" ${!canCreate ? 'disabled' : ''}>
                        ${t('invoices.new_invoice')}
                    </button>
                </div>
            `}
        </div>
    `;
}