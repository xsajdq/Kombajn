// components/modals/formControls.ts
import { html, TemplateResult } from 'lit-html';
import { classMap } from 'lit-html/directives/class-map.js';
import type { User } from '../../types.ts';
import { getUserInitials } from '../../utils.ts';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

export const formGroupClasses = "flex flex-col gap-1.5";
export const labelClasses = "text-sm font-medium text-text-subtle";
export const formControlClasses = "w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
export const modalFormGridClasses = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4";

type InputOptions = {
    id: string;
    label: string;
    type?: string;
    value?: string | number;
    required?: boolean;
    placeholder?: string;
    containerClassName?: string;
    min?: number;
    step?: number;
    disabled?: boolean;
    dataField?: string;
};

export function renderTextInput({ id, label, type = 'text', value = '', required = false, placeholder = '', containerClassName = formGroupClasses, min, step, disabled = false, dataField }: InputOptions): TemplateResult {
    return html`
        <div class="${containerClassName}">
            <label for="${id}" class="${labelClasses}">${label} ${required ? html`<span class="text-danger">*</span>` : ''}</label>
            <input 
                type="${type}" 
                id="${id}" 
                class="${formControlClasses}" 
                .value="${value || ''}" 
                ?required=${required} 
                placeholder="${placeholder}"
                min="${min}"
                step="${step}"
                ?disabled=${disabled}
                data-field=${dataField}
            >
        </div>
    `;
}

type TextareaOptions = {
    id: string;
    label: string;
    value?: string;
    required?: boolean;
    placeholder?: string;
    rows?: number;
    containerClassName?: string;
};

export function renderTextarea({ id, label, value = '', required = false, placeholder = '', rows = 4, containerClassName = formGroupClasses }: TextareaOptions): TemplateResult {
    return html`
        <div class="${containerClassName}">
            <label for="${id}" class="${labelClasses}">${label} ${required ? html`<span class="text-danger">*</span>` : ''}</label>
            <textarea 
                id="${id}" 
                class="${formControlClasses}" 
                rows="${rows}"
                ?required=${required} 
                placeholder="${placeholder}"
            >${value}</textarea>
        </div>
    `;
}

type SelectOptions = {
    id: string;
    label: string;
    value?: string | number;
    required?: boolean;
    options: { value: string | number; text: string }[];
    containerClassName?: string;
    disabled?: boolean;
    dataField?: string;
};

export function renderSelect({ id, label, value = '', required = false, options, containerClassName = formGroupClasses, disabled = false, dataField }: SelectOptions): TemplateResult {
    return html`
        <div class="${containerClassName}">
            <label for="${id}" class="${labelClasses}">${label} ${required ? html`<span class="text-danger">*</span>` : ''}</label>
            <select 
                id="${id}" 
                class="${formControlClasses}" 
                ?required=${required}
                ?disabled=${disabled}
                data-field=${dataField}
            >
                ${options.map(opt => html`<option value="${opt.value}" ?selected=${opt.value === value}>${opt.text}</option>`)}
            </select>
        </div>
    `;
}

type MultiUserSelectOptions = {
    id: string;
    label: string;
    users: User[];
    selectedUserIds: string[];
    unassignedText: string;
    containerClassName?: string;
};

export function renderMultiUserSelect({ id, label, users, selectedUserIds, unassignedText, containerClassName = formGroupClasses }: MultiUserSelectOptions): TemplateResult {
    const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
    return html`
        <div class="${containerClassName}">
            <label class="${labelClasses}">${label}</label>
            <div id="${id}" class="multiselect-container" data-type="user">
                <div class="multiselect-display">
                    ${selectedUsers.length > 0
                        ? selectedUsers.map(user => html`
                            <div class="multiselect-selected-item">
                                <div class="avatar">${getUserInitials(user)}</div>
                                <span>${user.name}</span>
                            </div>
                          `)
                        : html`<span class="subtle-text">${unassignedText}</span>`
                    }
                </div>
                <div class="multiselect-dropdown hidden">
                    <div class="multiselect-list">
                    ${users.map(user => html`
                        <label class="multiselect-list-item">
                            <input type="checkbox" name="${id}" value="${user.id}" ?checked=${selectedUserIds.includes(user.id)}>
                            <div class="avatar">${getUserInitials(user)}</div>
                            <span>${user.name}</span>
                        </label>
                    `)}
                    </div>
                </div>
            </div>
        </div>
    `;
}