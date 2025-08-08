import { getState, setState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { modalFormGridClasses, renderTextInput, renderSelect, formControlClasses, formGroupClasses, labelClasses } from './formControls.ts';
import { formatCurrency } from '../../utils.ts';
import type { InvoiceLineItem, AddInvoiceModalData } from '../../types.ts';
import { html, TemplateResult } from 'lit-html';

export function AddInvoiceModal() {
    const state = getState();
    const modalData = (getState().ui.modal.data ?? {}) as AddInvoiceModalData;
    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
    
    const isEdit = !!modalData.invoiceId;
    const invoice = isEdit ? state.invoices.find(i => i.id === modalData.invoiceId) : null;
    const items = invoice ? invoice.items : (modalData.items || []);
    
    const title = isEdit ? `Edit Invoice ${invoice?.invoiceNumber}` : t('modals.create_invoice_title');
    
    const total = items.reduce((sum: number, item: InvoiceLineItem) => sum + (item.quantity * item.unitPrice), 0);

    const body = html`
        <form id="invoiceForm" class="space-y-4">
            <div class="${modalFormGridClasses}">
                ${renderSelect({
                    id: 'invoiceClient', label: t('modals.client'), value: invoice?.clientId || modalData.clientId, required: true,
                    options: [{value: '', text: t('modals.select_a_client')}, ...workspaceClients.map(c => ({value: c.id, text: c.name}))]
                })}
                <button type="button" id="generate-invoice-items-btn" class="self-end px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background">${t('modals.generate_from_time')}</button>
                ${renderTextInput({ id: 'invoiceIssueDate', label: t('modals.issue_date'), value: invoice?.issueDate || modalData.issueDate, type: 'date', required: true })}
                ${renderTextInput({ id: 'invoiceDueDate', label: t('modals.due_date'), value: invoice?.dueDate || modalData.dueDate, type: 'date', required: true })}
            </div>
            
            <div class="pt-4 mt-4 border-t border-border-color">
                <h4 class="font-semibold text-md mb-2">${t('modals.invoice_items')}</h4>
                <div class="space-y-2">
                     <div class="hidden md:grid grid-cols-[1fr,80px,120px,120px,auto] gap-2 text-xs font-semibold text-text-subtle">
                        <span>${t('modals.item_description')}</span>
                        <span class="text-right">${t('modals.item_qty')}</span>
                        <span class="text-right">${t('invoices.unit_price')}</span>
                        <span class="text-right">${t('invoices.total_price')}</span>
                        <span></span>
                    </div>
                    ${items.map((item: InvoiceLineItem) => html`
                        <div class="grid grid-cols-2 md:grid-cols-[1fr,80px,120px,120px,auto] gap-2 items-center invoice-item-row" data-item-id="${item.id}">
                            <div class="md:col-span-1 col-span-2">
                                <label class="md:hidden text-xs font-semibold text-text-subtle">${t('modals.item_description')}</label>
                                <input type="text" class="${formControlClasses}" value="${item.description}" data-field="description">
                            </div>
                            <div>
                                <label class="md:hidden text-xs font-semibold text-text-subtle">${t('modals.item_qty')}</label>
                                <input type="number" class="${formControlClasses} text-right" value="${item.quantity}" data-field="quantity" min="0" step="0.01">
                            </div>
                            <div>
                                <label class="md:hidden text-xs font-semibold text-text-subtle">${t('invoices.unit_price')}</label>
                                <input type="number" class="${formControlClasses} text-right" value="${item.unitPrice}" data-field="unitPrice" min="0" step="0.01">
                            </div>
                            <div class="text-right self-center">
                                <label class="md:hidden text-xs font-semibold text-text-subtle">${t('invoices.total_price')}</label>
                                <span class="font-semibold">${formatCurrency(item.quantity * item.unitPrice, 'PLN')}</span>
                            </div>
                             <button type="button" class="p-2 text-danger hover:bg-danger/10 rounded-full remove-invoice-item-btn" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
                        </div>
                    `)}
                </div>
                 <button type="button" id="add-invoice-item-btn" class="mt-2 px-3 py-1.5 text-sm font-medium text-text-main bg-background border border-border-color rounded-md hover:bg-border-color transition-colors flex items-center gap-1">
                    <span class="material-icons-sharp text-base">add</span> ${t('modals.add_item')}
                </button>
            </div>

            <div class="flex justify-end pt-4 mt-4 border-t border-border-color">
                <div class="flex items-baseline gap-2">
                    <span class="font-semibold">${t('modals.total')}:</span>
                    <span class="text-2xl font-bold">${formatCurrency(total, 'PLN')}</span>
                </div>
            </div>
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer, maxWidth: 'max-w-4xl' };
}