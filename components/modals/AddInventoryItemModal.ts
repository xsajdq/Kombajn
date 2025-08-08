import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, modalFormGridClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { AddInventoryItemModalData } from '../../types.ts';

export function AddInventoryItemModal() {
    const modalData = (getState().ui.modal.data ?? {}) as AddInventoryItemModalData;
    const isEdit = !!modalData.itemId;
    const item = isEdit ? getState().inventoryItems.find(i => i.id === modalData.itemId) : null;
    
    const title = isEdit ? t('modals.modal_edit_item_title') : t('modals.modal_add_item_title');
    const body = html`
        <form id="addInventoryItemForm" data-item-id="${item?.id || ''}" class="space-y-4">
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'itemName', label: t('modals.modal_item_name'), value: item?.name, required: true })}
                ${renderTextInput({ id: 'itemCategory', label: t('modals.category'), value: item?.category })}
            </div>
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'itemSku', label: t('modals.modal_sku'), value: item?.sku })}
                ${renderTextInput({ id: 'itemLocation', label: t('modals.modal_location'), value: item?.location })}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${renderTextInput({ id: 'itemCurrentStock', label: t('modals.modal_current_stock'), type: 'number', value: item?.currentStock, required: true, min: 0 })}
                ${renderTextInput({ id: 'itemTargetStock', label: t('modals.modal_target_stock'), type: 'number', value: item?.targetStock, required: true, min: 0 })}
                ${renderTextInput({ id: 'itemLowStockThreshold', label: t('modals.modal_low_stock_threshold'), type: 'number', value: item?.lowStockThreshold, required: true, min: 0 })}
            </div>
            ${renderTextInput({ id: 'itemUnitPrice', label: t('modals.modal_unit_price'), type: 'number', value: item?.unitPrice, required: true, min: 0, step: 0.01 })}
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}