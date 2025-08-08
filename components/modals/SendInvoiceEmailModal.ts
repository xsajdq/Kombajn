

import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, renderTextarea } from './formControls.ts';
import type { SendInvoiceEmailModalData } from '../../types.ts';
import { html, TemplateResult } from 'lit-html';

export function SendInvoiceEmailModal() {
    const state = getState();
    const modalData = (getState().ui.modal.data || {}) as SendInvoiceEmailModalData;
    const invoice = state.invoices.find(i => i.id === modalData.invoiceId);
    const client = invoice ? state.clients.find(c => c.id === invoice.clientId) : null;
    const primaryContact = client?.contacts?.[0];
    const clientEmail = primaryContact?.email || client?.email;
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    const subject = t('invoices.email_template_subject').replace('{invoiceNumber}', invoice?.invoiceNumber || '').replace('{companyName}', workspace?.companyName || '');
    const bodyText = t('invoices.email_template_body').replace('{invoiceNumber}', invoice?.invoiceNumber || '').replace('{companyName}', workspace?.companyName || '');
    
    const title = `Send Invoice ${invoice?.invoiceNumber}`;
    const body: TemplateResult = html`
        <form id="send-invoice-email-form" data-invoice-id="${invoice?.id}" class="space-y-4">
            ${renderTextInput({ id: 'email-to', label: 'To:', type: 'email', value: clientEmail || '', required: true })}
            ${renderTextInput({ id: 'email-subject', label: 'Subject:', value: subject, required: true })}
            ${renderTextarea({ id: 'email-body', label: 'Body:', value: bodyText, required: true, rows: 8 })}
            <div class="flex items-center gap-2 text-sm bg-background p-2 rounded-md">
                <span class="material-icons-sharp text-text-subtle">attachment</span>
                <span class="font-medium">Invoice-${invoice?.invoiceNumber}.pdf</span>
            </div>
        </form>
    `;
    const footer: TemplateResult = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn" type="submit" form="send-invoice-email-form">${t('modals.send_email_button')}</button>
    `;

    return { title, body, footer };
}