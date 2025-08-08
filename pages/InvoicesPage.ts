import { getState, setState } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate, getUsage, PLANS, formatCurrency } from '../utils.ts';
import type { Invoice, Workspace } from '../types.ts';
import { can } from '../permissions.ts';
import { fetchInvoicesForWorkspace } from '../handlers/invoices.ts';
import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

function getFilteredInvoices() {
    const state = getState();
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

function renderInvoicesList(): TemplateResult {
    const state = getState();
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return html``;

    const usage = getUsage(activeWorkspace.id);
    const planLimits = PLANS[activeWorkspace.subscription.planId];
    const canCreateInvoice = usage.invoicesThisMonth < planLimits.invoices;
    const isAllowedToCreate = can('manage_invoices');

    const filteredInvoices = getFilteredInvoices();
    const clients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);

    const { clientId, status, dateStart, dateEnd } = state.ui.invoiceFilters;

    return html`
        <div class="space-y-6">
             <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 class="text-xl font-bold">${t('invoices.list_title')}</h3>
                <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed" data-modal-target="addInvoice" ?disabled=${!isAllowedToCreate || !canCreateInvoice} title="${!canCreateInvoice ? t('billing.limit_reached_invoices').replace('{planName}', activeWorkspace.subscription.planId) : ''}">
                    <span class="material-icons-sharp text-base">add</span> ${t('invoices.new_invoice')}
                </button>
            </div>
             <div id="invoice-filter-panel" class="bg-content p-3 rounded-lg border border-border-color grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="invoice-filter-client" class="text-xs font-medium text-text-subtle block mb-1">${t('invoices.col_client')}</label>
                    <select id="invoice-filter-client" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" data-filter-key="clientId">
                        <option value="all">${t('invoices.all_clients')}</option>
                        ${clients.map(c => html`<option value="${c.id}" ?selected=${clientId === c.id}>${c.name}</option>`)}
                    </select>
                </div>
                 <div>
                    <label for="invoice-filter-status" class="text-xs font-medium text-text-subtle block mb-1">${t('invoices.col_status')}</label>
                    <select id="invoice-filter-status" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" data-filter-key="status">
                        <option value="all">${t('invoices.all_statuses')}</option>
                        <option value="pending" ?selected=${status === 'pending'}>${t('invoices.status_pending')}</option>
                        <option value="paid" ?selected=${status === 'paid'}>${t('invoices.status_paid')}</option>
                        <option value="overdue" ?selected=${status === 'overdue'}>${t('invoices.status_overdue')}</option>
                    </select>
                </div>
                 <div class="lg:col-span-2">
                    <label class="text-xs font-medium text-text-subtle block mb-1">${t('reports.filter_date_range')}</label>
                    <div class="flex items-center gap-2">
                        <input type="date" id="invoice-filter-date-start" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" .value=${dateStart} data-filter-key="dateStart">
                        <span>-</span>
                        <input type="date" id="invoice-filter-date-end" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" .value=${dateEnd} data-filter-key="dateEnd">
                    </div>
                </div>
            </div>

            <div class="bg-content rounded-lg shadow-sm">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm responsive-table">
                         <thead class="text-xs text-text-subtle uppercase bg-background">
                            <tr>
                                <th class="px-4 py-2 text-left">${t('invoices.col_number')}</th>
                                <th class="px-4 py-2 text-left">${t('invoices.col_client')}</th>
                                <th class="px-4 py-2 text-left">${t('invoices.col_issued')}</th>
                                <th class="px-4 py-2 text-left">${t('invoices.col_due')}</th>
                                <th class="px-4 py-2 text-left">${t('invoices.col_total')}</th>
                                <th class="px-4 py-2 text-left">Email Status</th>
                                <th class="px-4 py-2 text-left">${t('invoices.col_status')}</th>
                                <th class="px-4 py-2 text-right">${t('invoices.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border-color">
                            ${filteredInvoices.map(invoice => {
                                const client = clients.find(c => c.id === invoice.clientId);
                                const total = invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                                const statusClass = invoice.effectiveStatus === 'paid' ? 'bg-success/10 text-success' : invoice.effectiveStatus === 'overdue' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning';
                                
                                let emailStatusHtml: TemplateResult;
                                if (invoice.emailStatus === 'sent') {
                                    if (invoice.openedAt) {
                                        emailStatusHtml = html`<div class="flex items-center gap-1 text-success" title="${t('invoices.opened')} ${formatDate(invoice.openedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}">
                                            <span class="material-icons-sharp text-base">visibility</span>
                                            <span class="text-xs font-medium">${t('invoices.opened')}</span>
                                        </div>`;
                                    } else {
                                        emailStatusHtml = html`<div class="flex items-center gap-1 text-text-subtle" title="${t('invoices.not_opened')}">
                                            <span class="material-icons-sharp text-base">visibility_off</span>
                                            <span class="text-xs font-medium">${t('invoices.not_opened')}</span>
                                        </div>`;
                                    }
                                } else {
                                    emailStatusHtml = html`<span class="text-text-subtle">-</span>`;
                                }


                                return html`
                                    <tr>
                                        <td data-label="${t('invoices.col_number')}" class="px-4 py-3 font-medium">${invoice.invoiceNumber}</td>
                                        <td data-label="${t('invoices.col_client')}" class="px-4 py-3">${client?.name || t('misc.no_client')}</td>
                                        <td data-label="${t('invoices.col_issued')}" class="px-4 py-3">${formatDate(invoice.issueDate)}</td>
                                        <td data-label="${t('invoices.col_due')}" class="px-4 py-3">${formatDate(invoice.dueDate)}</td>
                                        <td data-label="${t('invoices.col_total')}" class="px-4 py-3">${formatCurrency(total, 'PLN')}</td>
                                        <td data-label="Email Status" class="px-4 py-3">${emailStatusHtml}</td>
                                        <td data-label="${t('invoices.col_status')}" class="px-4 py-3">
                                            <span class="px-2 py-1 text-xs font-semibold rounded-full capitalize ${statusClass}">${t(`invoices.status_${invoice.effectiveStatus}`)}</span>
                                        </td>
                                        <td data-label="${t('invoices.col_actions')}" class="px-4 py-3">
                                            <div class="flex justify-end items-center gap-1">
                                                <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-modal-target="addInvoice" data-invoice-id="${invoice.id}" title="${t('misc.edit')}"><span class="material-icons-sharp text-lg">edit</span></button>
                                                <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-download-invoice-id="${invoice.id}" title="${t('invoices.download_pdf')}"><span class="material-icons-sharp text-lg">picture_as_pdf</span></button>
                                                <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-send-invoice-id="${invoice.id}" title="${t('invoices.send_by_email')} ${invoice.emailStatus === 'sent' ? `(${t('invoices.status_sent')})` : ''}"><span class="material-icons-sharp text-lg">${invoice.emailStatus === 'sent' ? 'mark_email_read' : 'email'}</span></button>
                                                <button class="p-1.5 rounded-full text-text-subtle hover:bg-border-color" data-toggle-invoice-status-id="${invoice.id}" title="${invoice.status === 'paid' ? t('invoices.mark_as_unpaid') : t('invoices.mark_as_paid')}"><span class="material-icons-sharp text-lg">${invoice.status === 'paid' ? 'remove_done' : 'done_all'}</span></button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            })}
                        </tbody>
                    </table>
                     ${filteredInvoices.length === 0 ? html`<div class="text-center py-8 text-text-subtle">${t('invoices.no_invoices_yet')}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderSettingsTab(workspace: Workspace): TemplateResult {
    const settings = workspace.invoiceSettings || { template: 'modern', accentColor: '#3B82F6', defaultNotes: '' };
    const templates = ['modern', 'classic', 'elegant', 'minimalist'];

    return html`
        <div class="max-w-4xl mx-auto space-y-6">
            <h3 class="text-xl font-bold">${t('invoices.settings_title')}</h3>
            <p class="text-sm text-text-subtle">${t('invoices.settings_subtitle')}</p>
            
            <form id="invoice-settings-form" class="space-y-6">
                <div>
                    <label class="block text-sm font-medium mb-2">${t('invoices.template_label')}</label>
                    <div class="invoice-template-grid">
                        ${templates.map(template => html`
                            <div class="template-card ${settings.template === template ? 'selected' : ''}" data-template-name="${template}">
                                <div class="template-preview">
                                    <span class="material-icons-sharp text-4xl">description</span>
                                </div>
                                <p class="template-card-name capitalize">${template}</p>
                            </div>
                        `)}
                        <input type="hidden" id="invoice-template-input" .value="${settings.template}">
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="invoice-accent-color" class="block text-sm font-medium mb-2">${t('invoices.accent_color_label')}</label>
                        <input type="color" id="invoice-accent-color" class="w-24 h-10 p-1 bg-content border border-border-color rounded-md cursor-pointer" .value="${settings.accentColor}">
                    </div>
                </div>
                
                <div>
                    <label for="invoice-default-notes" class="block text-sm font-medium mb-2">${t('invoices.default_notes_label')}</label>
                    <textarea id="invoice-default-notes" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm" rows="4" placeholder="${t('invoices.default_notes_placeholder')}">${settings.defaultNotes}</textarea>
                </div>

                <div class="flex justify-end pt-4 border-t border-border-color">
                    <button type="button" id="save-invoice-settings-btn" class="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('modals.save')}</button>
                </div>
            </form>
        </div>
    `;
}

export async function initInvoicesPage() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    if (state.ui.invoices.loadedWorkspaceId !== activeWorkspaceId) {
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                invoices: { ...prevState.ui.invoices, isLoading: true, loadedWorkspaceId: activeWorkspaceId }
            }
        }), ['page']);
        
        await fetchInvoicesForWorkspace(activeWorkspaceId);
    }
}

export async function InvoicesPage(): Promise<TemplateResult> {
    const state = getState();
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return html``;

    if (state.ui.invoices.isLoading) {
        return html`<div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>`;
    }
    
    const { activeTab } = state.ui.invoices;

    const navItems = [
        { id: 'list', text: t('invoices.tab_list') },
        { id: 'settings', text: t('invoices.tab_settings') },
    ];

    let content: TemplateResult = html``;
    switch (activeTab) {
        case 'list':
            content = renderInvoicesList();
            break;
        case 'settings':
            content = renderSettingsTab(activeWorkspace);
            break;
    }

    return html`
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">${t('invoices.title')}</h2>
            <div class="border-b border-border-color">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    ${navItems.map(item => html`
                        <button type="button" class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === item.id ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-main hover:border-border-color'}" data-tab-group="ui.invoices.activeTab" data-tab-value="${item.id}">${item.text}</button>
                    `)}
                </nav>
            </div>
            ${content}
        </div>
    `;
}