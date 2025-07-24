import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { formatCurrency, formatDate } from '../utils.ts';
import type { Budget, Expense, Invoice } from '../types.ts';

export function BudgetPage() {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return '';

    const canManage = can('manage_budgets');
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const period = currentMonthStart; // For now, only monthly. Can be extended later.

    const budgets = state.budgets.filter(b => b.workspaceId === activeWorkspaceId && b.period === period);
    const expenses = state.expenses.filter(e => e.workspaceId === activeWorkspaceId && e.date.startsWith(period.slice(0, 7)));
    const invoices = state.invoices.filter(i => i.workspaceId === activeWorkspaceId && i.issueDate.startsWith(period.slice(0, 7)));

    // --- KPI Calculations ---
    const totalRevenue = invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
    
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const budgetVsActualPercent = totalBudget > 0 ? Math.min(100, (totalExpenses / totalBudget) * 100) : 0;
    
    // --- Transactions Log ---
    const incomeTransactions = invoices
        .filter(i => i.status === 'paid')
        .map(inv => {
            const client = state.clients.find(c => c.id === inv.clientId);
            return {
                date: inv.issueDate,
                description: `Invoice ${inv.invoiceNumber} (${client?.name || 'N/A'})`,
                category: t('budget.type_income'),
                amount: inv.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
                type: 'income' as const
            };
        });
        
    const expenseTransactions = expenses.map(exp => ({
        date: exp.date,
        description: exp.description,
        category: exp.category || 'Uncategorized',
        amount: -exp.amount,
        type: 'expense' as const
    }));
    
    const allTransactions = [...incomeTransactions, ...expenseTransactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    return `
        <div class="space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold">${t('budget.title')}</h2>
                    <p class="text-text-subtle">${t('budget.subtitle')}</p>
                </div>
                <div class="flex items-center gap-2">
                     ${canManage ? `<button class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="setBudgets" data-period="${period}"><span class="material-icons-sharp text-base">edit</span> ${t('budget.set_budgets')}</button>` : ''}
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addExpense"><span class="material-icons-sharp text-base">add</span> ${t('budget.add_expense')}</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-content p-4 rounded-lg"><p class="text-sm text-text-subtle">${t('budget.total_revenue')}</p><strong class="text-2xl font-semibold text-success">${formatCurrency(totalRevenue, 'PLN')}</strong></div>
                <div class="bg-content p-4 rounded-lg"><p class="text-sm text-text-subtle">${t('budget.total_expenses')}</p><strong class="text-2xl font-semibold text-danger">${formatCurrency(totalExpenses, 'PLN')}</strong></div>
                <div class="bg-content p-4 rounded-lg"><p class="text-sm text-text-subtle">${t('budget.net_profit')}</p><strong class="text-2xl font-semibold ${netProfit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(netProfit, 'PLN')}</strong></div>
                <div class="bg-content p-4 rounded-lg"><p class="text-sm text-text-subtle">${t('budget.budget_vs_actual')}</p><div class="w-full bg-background rounded-full h-2.5 my-2"><div class="h-2.5 rounded-full ${budgetVsActualPercent > 90 ? 'bg-danger' : budgetVsActualPercent > 70 ? 'bg-warning' : 'bg-primary'}" style="width: ${budgetVsActualPercent}%"></div></div><p class="text-xs text-text-subtle">${t('budget.spent_of_budget', { spent: formatCurrency(totalExpenses, 'PLN'), budget: formatCurrency(totalBudget, 'PLN') })}</p></div>
            </div>

            <div class="bg-content p-4 rounded-lg">
                <h4 class="font-semibold mb-3">${t('budget.budgets_by_category')}</h4>
                ${budgets.length > 0 ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${budgets.map(budget => {
                            const spent = expenses.filter(e => e.category === budget.category).reduce((sum, e) => sum + e.amount, 0);
                            const progress = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
                            return `
                                <div>
                                    <div class="flex justify-between text-sm mb-1">
                                        <span class="font-medium">${budget.category}</span>
                                        <span class="text-text-subtle">${formatCurrency(spent, 'PLN')} / ${formatCurrency(budget.amount, 'PLN')}</span>
                                    </div>
                                    <div class="w-full bg-background rounded-full h-2"><div class="h-2 rounded-full ${progress > 90 ? 'bg-danger' : progress > 70 ? 'bg-warning' : 'bg-primary'}" style="width: ${progress}%"></div></div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `<div class="text-center py-8 text-text-subtle"><p>${t('budget.no_budgets_set')}</p><p class="text-xs">${t('budget.no_budgets_set_desc')}</p></div>`}
            </div>
            
            <div class="bg-content p-4 rounded-lg">
                <h4 class="font-semibold mb-3">${t('budget.recent_transactions')}</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-xs text-text-subtle uppercase bg-background">
                            <tr>
                                <th class="px-4 py-2 text-left">${t('budget.col_date')}</th>
                                <th class="px-4 py-2 text-left">${t('budget.col_description')}</th>
                                <th class="px-4 py-2 text-left">${t('budget.col_category')}</th>
                                <th class="px-4 py-2 text-right">${t('budget.col_amount')}</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border-color">
                             ${allTransactions.length > 0 ? allTransactions.map(tx => `
                                <tr>
                                    <td class="px-4 py-3">${formatDate(tx.date)}</td>
                                    <td class="px-4 py-3">${tx.description}</td>
                                    <td class="px-4 py-3"><span class="px-2 py-1 text-xs font-medium rounded-full bg-background">${tx.category}</span></td>
                                    <td class="px-4 py-3 text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-danger'}">${formatCurrency(tx.amount, 'PLN')}</td>
                                </tr>
                             `).join('') : `<tr><td colspan="4" class="text-center py-8 text-text-subtle">${t('budget.no_transactions')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}