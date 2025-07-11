

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate } from '../utils.ts';
import type { Deal, Task } from '../types.ts';

function renderActivityTab(deal: Deal) {
    const notes = state.dealNotes
        .filter(n => n.dealId === deal.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return `
        <div class="deal-activity-feed">
            ${notes.length > 0 ? notes.map(note => {
                const user = state.users.find(u => u.id === note.userId);
                return `
                    <div class="deal-note-item">
                        <div class="avatar">${user?.initials || '?'}</div>
                        <div class="note-content">
                            <div class="note-header">
                                <strong>${user?.name || 'User'}</strong>
                                <span class="subtle-text">${formatDate(note.createdAt, {hour: 'numeric', minute: 'numeric'})}</span>
                            </div>
                            <p>${note.content}</p>
                        </div>
                    </div>
                `;
            }).join('') : `<p class="subtle-text">${t('panels.no_deal_activity')}</p>`}
        </div>
        <form id="add-deal-note-form" data-deal-id="${deal.id}" class="add-deal-note-form">
            <textarea class="form-control" name="note-content" rows="3" placeholder="${t('modals.note_placeholder')}" required></textarea>
            <button class="btn btn-primary" type="submit" style="align-self: flex-end;">${t('panels.add_note')}</button>
        </form>
    `;
}

function renderTasksTab(deal: Deal) {
    const tasks = state.tasks.filter(t => t.dealId === deal.id);
    return `
        <button class="btn btn-secondary btn-sm" data-modal-target="addTask" data-deal-id="${deal.id}" style="margin-bottom: 1rem;">
            <span class="material-icons-sharp" style="font-size: 1.2rem;">add</span>
            ${t('panels.add_task')}
        </button>
        <div class="item-list">
            ${tasks.length > 0 ? tasks.map(task => `
                <div class="item-card clickable" data-task-id="${task.id}" role="button">
                    <span class="material-icons-sharp">check_box_outline_blank</span>
                    <div style="flex-grow: 1;">
                        <strong>${task.name}</strong>
                    </div>
                    <span class="material-icons-sharp">chevron_right</span>
                </div>
            `).join('') : `<p class="subtle-text">${t('panels.no_tasks_in_stage')}</p>`}
        </div>
    `;
}

export function DealDetailPanel({ dealId }: { dealId: string }) {
    const deal = state.deals.find(d => d.id === dealId && d.workspaceId === state.activeWorkspaceId);
    if (!deal) return '';

    const client = state.clients.find(c => c.id === deal.clientId);
    const owner = state.users.find(u => u.id === deal.ownerId);
    const stages: Deal['stage'][] = ['lead', 'contacted', 'demo', 'proposal', 'won', 'lost'];
    const activeTab = state.ui.dealDetail.activeTab;

    let tabContent = '';
    switch(activeTab) {
        case 'activity':
            tabContent = renderActivityTab(deal);
            break;
        case 'tasks':
            tabContent = renderTasksTab(deal);
            break;
    }

    const formatCurrency = (value: number) => new Intl.NumberFormat(state.settings.language === 'pl' ? 'pl-PL' : 'en-US', {
        style: 'currency', currency: 'PLN', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);

    return `
        <div class="side-panel" role="region" aria-label="Deal Details Panel">
            <div class="side-panel-header">
                <h2>${deal.name}</h2>
                <button class="btn-icon" data-copy-link="sales/${deal.id}" title="${t('misc.copy_link')}">
                    <span class="material-icons-sharp">link</span>
                </button>
                <button class="btn btn-secondary btn-sm" data-modal-target="addDeal" data-deal-id="${deal.id}">${t('misc.edit')}</button>
                 <button class="btn-icon btn-close-panel" aria-label="${t('panels.close')}">
                    <span class="material-icons-sharp">close</span>
                </button>
            </div>
            <div class="side-panel-content">
                <div class="deal-pipeline-visualizer">
                    ${stages.map(stage => `<div class="pipeline-stage ${deal.stage === stage ? 'active' : ''}">${t(`sales.stage_${stage}`)}</div>`).join('')}
                </div>
                <div class="deal-kpi-grid">
                    <div class="deal-kpi-item">
                        <label>${t('sales.deal_value')}</label>
                        <div class="value">${formatCurrency(deal.value)}</div>
                    </div>
                    <div class="deal-kpi-item">
                        <label>${t('sales.deal_owner')}</label>
                        <div class="value">
                            ${owner ? `<div class="avatar" title="${owner.name}">${owner.initials}</div><span>${owner.name}</span>` : t('tasks.unassigned')}
                        </div>
                    </div>
                    <div class="deal-kpi-item">
                        <label>${t('sales.deal_client')}</label>
                        <div class="value">${client?.name || t('misc.no_client')}</div>
                    </div>
                    <div class="deal-kpi-item">
                        <label>${t('sales.expected_close')}</label>
                        <div class="value">${deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : t('misc.not_applicable')}</div>
                    </div>
                </div>

                <div class="side-panel-tabs" role="tablist" aria-label="Deal sections">
                    <div class="side-panel-tab ${activeTab === 'activity' ? 'active' : ''}" data-tab="activity" role="tab" aria-selected="${activeTab === 'activity'}">${t('panels.activity')}</div>
                    <div class="side-panel-tab ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks" role="tab" aria-selected="${activeTab === 'tasks'}">${t('panels.tasks')}</div>
                </div>

                <div class="card" style="margin-top: 1.5rem;">
                    ${tabContent}
                </div>

            </div>
        </div>
    `;
}