import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, renderSelect, modalFormGridClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { User, AddDealModalData } from '../../types.ts';

export function AddDealModal() {
    const state = getState();
    const modalData = (getState().ui.modal.data ?? {}) as AddDealModalData;
    const isEdit = !!modalData.dealId;
    const deal = isEdit ? state.deals.find(d => d.id === modalData.dealId) : null;
    
    const clients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
    const users = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u);
    const stages = state.pipelineStages.filter(s => s.workspaceId === state.activeWorkspaceId && s.category === 'open');

    const title = isEdit ? 'Edit Deal' : 'Add New Deal';
    const body = html`
        <form id="addDealForm" class="space-y-4">
            <input type="hidden" id="dealId" value="${deal?.id || ''}">
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'dealName', label: 'Deal Name', value: deal?.name, required: true })}
                ${renderSelect({
                    id: 'dealClient', label: 'Client', value: deal?.clientId, required: true,
                    options: [{ value: '', text: 'Select Client' }, ...clients.map(c => ({ value: c.id, text: c.name }))]
                })}
            </div>
             <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'dealValue', label: 'Value (PLN)', type: 'number', value: deal?.value, required: true, min: 0 })}
                ${renderSelect({
                    id: 'dealOwner', label: 'Owner', value: deal?.ownerId || state.currentUser?.id, required: true,
                    options: users.map(u => ({ value: u.id, text: u.name || '' }))
                })}
            </div>
             <div class="${modalFormGridClasses}">
                ${renderSelect({
                    id: 'dealStage', label: 'Stage', value: deal?.stage, required: true,
                    options: stages.map(s => ({ value: s.id, text: s.name }))
                })}
                ${renderTextInput({ id: 'dealCloseDate', label: 'Expected Close Date', type: 'date', value: deal?.expectedCloseDate })}
            </div>
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}