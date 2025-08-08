

import { getState } from '../../state.ts';
import { AddClientModal } from './modals/AddClientModal.ts';
import { AddProjectModal } from './modals/AddProjectModal.ts';
import { AiProjectPlannerModal } from './modals/AiProjectPlannerModal.ts';
import { AddTaskModal } from './modals/AddTaskModal.ts';
import { AddInvoiceModal } from './modals/AddInvoiceModal.ts';
import { SendInvoiceEmailModal } from './modals/SendInvoiceEmailModal.ts';
import { AddWidgetModal } from './modals/AddWidgetModal.ts';
import { ConfigureWidgetModal } from './modals/ConfigureWidgetModal.ts';
import { AutomationsModal } from './modals/AutomationsModal.ts';
import { AddManualTimeLogModal } from './modals/AddManualTimeLogModal.ts';
import { AssignGlobalTimeModal } from './modals/AssignGlobalTimeModal.ts';
import { AddProjectSectionModal } from './modals/AddProjectSectionModal.ts';
import { AddReviewModal } from './modals/AddReviewModal.ts';
import { DealWonModal } from './modals/DealWonModal.ts';
import { KeyboardShortcutsModal } from './modals/KeyboardShortcutsModal.ts';
import { AddGoalModal } from './modals/AddGoalModal.ts';
import { AddInventoryItemModal } from './modals/AddInventoryItemModal.ts';
import { AssignInventoryItemModal } from './modals/AssignInventoryItemModal.ts';
import { SetBudgetsModal } from './modals/SetBudgetsModal.ts';
import { AddDealModal } from './modals/AddDealModal.ts';
import { AddExpenseModal } from './modals/AddExpenseModal.ts';
import { AddCalendarEventModal } from './modals/AddCalendarEventModal.ts';
import { AddTimeOffRequestModal } from './modals/AddTimeOffRequestModal.ts';
import { AdjustVacationAllowanceModal } from './modals/AdjustVacationAllowanceModal.ts';
import { ConfirmPlanChangeModal } from './modals/ConfirmPlanChangeModal.ts';
import { EmployeeDetailModal } from './modals/EmployeeDetailModal.ts';
import { RejectTimeOffRequestModal } from './modals/RejectTimeOffRequestModal.ts';
import { UpgradePlanModal } from './modals/UpgradePlanModal.ts';
import { WikiHistoryModal } from './modals/WikiHistoryModal.ts';
import { SubtaskDetailModal } from './modals/SubtaskDetailModal.ts';
import { t } from '../../i18n.ts';
import { formControlClasses, formGroupClasses, labelClasses } from './formControls.ts';
import { getUserProjectRole } from '../../handlers/main.ts';
import { formatDuration, formatDate, getUserInitials } from '../../utils.ts';
import type { Task, User, CustomFieldDefinition, Comment, TimeLog } from '../../types.ts';
import { html, TemplateResult } from 'lit-html';
import { AddCommentToTimeLogModal } from './modals/AddCommentToTimeLogModal.ts';
import { TaskDetailModal } from './modals/TaskDetailModal.ts';


type ModalContent = {
    title: string | TemplateResult;
    body: TemplateResult;
    footer: TemplateResult;
    maxWidth?: string;
} | null;

export function Modal(): TemplateResult | '' {
    const state = getState();
    if (!state.ui.modal.isOpen) return '';

    let modalContent: ModalContent = null;

    switch (state.ui.modal.type) {
        case 'keyboardShortcuts': modalContent = KeyboardShortcutsModal(); break;
        case 'addClient': modalContent = AddClientModal(); break;
        case 'addProject': modalContent = AddProjectModal(); break;
        case 'aiProjectPlanner': modalContent = AiProjectPlannerModal(); break;
        case 'addTask': modalContent = AddTaskModal(); break;
        case 'addCommentToTimeLog': modalContent = AddCommentToTimeLogModal(); break;
        case 'addInvoice': modalContent = AddInvoiceModal(); break;
        case 'sendInvoiceEmail': modalContent = SendInvoiceEmailModal(); break;
        case 'addWidget': modalContent = AddWidgetModal(); break;
        case 'configureWidget': modalContent = ConfigureWidgetModal(); break;
        case 'automations': modalContent = AutomationsModal(); break;
        case 'taskDetail': modalContent = TaskDetailModal(); break;
        case 'subtaskDetail': modalContent = SubtaskDetailModal(); break;
        case 'addManualTimeLog': modalContent = AddManualTimeLogModal(); break;
        case 'assignGlobalTime': modalContent = AssignGlobalTimeModal(); break;
        case 'addProjectSection': modalContent = AddProjectSectionModal(); break;
        case 'addReview': modalContent = AddReviewModal(); break;
        case 'dealWon': modalContent = DealWonModal(); break;
        case 'addGoal': case 'addObjective': modalContent = AddGoalModal(); break;
        case 'addInventoryItem': modalContent = AddInventoryItemModal(); break;
        case 'assignInventoryItem': modalContent = AssignInventoryItemModal(); break;
        case 'setBudgets': modalContent = SetBudgetsModal(); break;
        case 'addDeal': modalContent = AddDealModal(); break;
        case 'addExpense': modalContent = AddExpenseModal(); break;
        case 'addCalendarEvent': modalContent = AddCalendarEventModal(); break;
        case 'addTimeOffRequest': modalContent = AddTimeOffRequestModal(); break;
        case 'adjustVacationAllowance': modalContent = AdjustVacationAllowanceModal(); break;
        case 'confirmPlanChange': modalContent = ConfirmPlanChangeModal(); break;
        case 'employeeDetail': modalContent = EmployeeDetailModal(); break;
        case 'rejectTimeOffRequest': modalContent = RejectTimeOffRequestModal(); break;
        case 'upgradePlan': modalContent = UpgradePlanModal(); break;
        case 'wikiHistory': modalContent = WikiHistoryModal(); break;
        default:
            console.warn(`Unknown modal type: ${state.ui.modal.type}`);
            return '';
    }

    if (!modalContent) return '';

    const { title, body, footer, maxWidth = 'max-w-2xl' } = modalContent;

    return html`
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" id="modal-backdrop">
            <div id="modal-content" class="bg-content rounded-lg shadow-xl w-full ${maxWidth} transition-all transform scale-95 opacity-0" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="flex justify-between items-center p-4 border-b border-border-color">
                    <h3 class="text-lg font-semibold flex-1" id="modal-title">${title}</h3>
                    <button class="p-1 rounded-full hover:bg-background btn-close-modal" aria-label="Close modal">
                        <span class="material-icons-sharp">close</span>
                    </button>
                </div>
                <div class="p-4 sm:p-6">${body}</div>
                <div class="px-4 py-3 bg-background rounded-b-lg flex justify-end items-center gap-3">
                    ${footer}
                </div>
            </div>
        </div>
    `;
}