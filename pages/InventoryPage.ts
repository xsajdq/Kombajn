
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { formatCurrency } from '../utils.ts';
import type { InventoryItem } from '../types.ts';

// Helper to calculate KPI values
function getInventoryKpis(items: InventoryItem[]) {
    const totalItems = items.reduce((sum, item) => sum + item.currentStock, 0);
    const totalValue = items.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);
    const lowStock = items.filter(item => item.currentStock > 0 && item.currentStock <= item.lowStockThreshold).length;
    const outOfStock = items.filter(item => item.currentStock === 0).length;

    return { totalItems, totalValue, lowStock, outOfStock };
}

// Helper to calculate category summaries
function getCategorySummaries(items: InventoryItem[]) {
    const summary: Record<string, { count: number, value: number }> = {};
    items.forEach(item => {
        const category = item.category || 'Uncategorized';
        if (!summary[category]) {
            summary[category] = { count: 0, value: 0 };
        }
        summary[category].count += item.currentStock;
        summary[category].value += item.currentStock * item.unitPrice;
    });
    return Object.entries(summary).map(([name, data]) => ({ name, ...data }));
}

export function InventoryPage() {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return '';

    const inventoryItems = state.inventoryItems.filter(item => item.workspaceId === activeWorkspaceId);
    const canManage = can('manage_inventory');

    const kpis = getInventoryKpis(inventoryItems);
    const categories = getCategorySummaries(inventoryItems);

    const renderItemRow = (item: InventoryItem) => {
        const stockLevelPercent = item.targetStock > 0 ? Math.min(100, (item.currentStock / item.targetStock) * 100) : 0;
        let status = 'in_stock';
        let statusClass = 'bg-success/10 text-success';
        if (item.currentStock <= 0) {
            status = 'out_of_stock';
            statusClass = 'bg-danger/10 text-danger';
        } else if (item.currentStock <= item.lowStockThreshold) {
            status = 'low_stock';
            statusClass = 'bg-warning/10 text-warning';
        }
        
        return `
            <tr>
                <td class="px-4 py-3">
                    <div class="font-medium">${item.name}</div>
                    <div class="text-xs text-text-subtle">${item.category || ''} - ${item.location || ''}</div>
                </td>
                <td class="px-4 py-3 font-mono text-xs">${item.sku || 'N/A'}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2 text-sm">
                        <span>${item.currentStock} / ${item.targetStock}</span>
                        <div class="w-24 h-2 bg-background rounded-full"><div class="h-2 rounded-full ${stockLevelPercent < 20 ? 'bg-danger' : 'bg-primary'}" style="width: ${stockLevelPercent}%;"></div></div>
                    </div>
                </td>
                <td class="px-4 py-3">${formatCurrency(item.unitPrice, 'PLN')}</td>
                <td class="px-4 py-3 font-semibold">${formatCurrency(item.currentStock * item.unitPrice, 'PLN')}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full capitalize ${statusClass}">${t(`inventory.status_${status}`)}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2 text-sm">
                        <button class="text-primary hover:underline" data-modal-target="assignInventoryItem" data-item-id="${item.id}">Assign</button>
                        ${canManage ? `
                            <button class="text-primary hover:underline" data-modal-target="addInventoryItem" data-item-id="${item.id}">Edit</button>
                            <button class="text-danger hover:underline" data-delete-inventory-item-id="${item.id}">Delete</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    };

    return `
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-bold">${t('inventory.title')}</h2>
                    <p class="text-text-subtle">${t('inventory.subtitle')}</p>
                </div>
                ${canManage ? `<button class="px-3 py-2 text-sm font-medium flex items-center gap-1 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addInventoryItem"><span class="material-icons-sharp text-base">add</span> ${t('inventory.add_item')}</button>` : ''}
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500"><span class="material-icons-sharp">inventory_2</span></div><div><p class="text-sm text-text-subtle">${t('inventory.total_items')}</p><strong class="text-xl font-semibold">${kpis.totalItems}</strong></div></div>
                <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-green-100 dark:bg-green-900/50 text-green-500"><span class="material-icons-sharp">paid</span></div><div><p class="text-sm text-text-subtle">${t('inventory.total_value')}</p><strong class="text-xl font-semibold">${formatCurrency(kpis.totalValue, 'PLN')}</strong></div></div>
                <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-500"><span class="material-icons-sharp">warning_amber</span></div><div><p class="text-sm text-text-subtle">${t('inventory.low_stock')}</p><strong class="text-xl font-semibold">${kpis.lowStock}</strong></div></div>
                <div class="bg-content p-4 rounded-lg flex items-center gap-4"><div class="p-3 rounded-full bg-red-100 dark:bg-red-900/50 text-red-500"><span class="material-icons-sharp">production_quantity_limits</span></div><div><p class="text-sm text-text-subtle">${t('inventory.out_of_stock')}</p><strong class="text-xl font-semibold">${kpis.outOfStock}</strong></div></div>
            </div>

            <div class="bg-content p-4 rounded-lg">
                <h4 class="font-semibold mb-3">${t('inventory.inventory_by_category')}</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${categories.map(cat => `
                        <div class="border border-border-color p-3 rounded-md flex justify-between items-start">
                           <div>
                                <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-background">${cat.name}</span>
                                <p class="text-xs text-text-subtle mt-2">${t('inventory.items')}</p>
                                <p class="font-bold">${cat.count}</p>
                           </div>
                           <div>
                                <p class="text-xs text-text-subtle">${t('inventory.value')}</p>
                                <p class="font-bold">${formatCurrency(cat.value, 'PLN')}</p>
                           </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="bg-content rounded-lg shadow-sm">
                 <div class="p-4">
                    <input type="text" id="inventory-search-input" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm" placeholder="${t('inventory.search_inventory')}">
                 </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                         <thead class="text-xs text-text-subtle uppercase bg-background">
                            <tr>
                                <th class="px-4 py-2 text-left">${t('inventory.col_item')}</th>
                                <th class="px-4 py-2 text-left">${t('inventory.col_sku')}</th>
                                <th class="px-4 py-2 text-left">${t('inventory.col_stock_level')}</th>
                                <th class="px-4 py-2 text-left">${t('inventory.col_unit_price')}</th>
                                <th class="px-4 py-2 text-left">${t('inventory.col_total_value')}</th>
                                <th class="px-4 py-2 text-left">${t('inventory.col_status')}</th>
                                <th class="px-4 py-2 text-left">${t('inventory.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border-color" id="inventory-table-body">
                            ${inventoryItems.length > 0 ? inventoryItems.map(renderItemRow).join('') : `<tr><td colspan="7" class="text-center py-8 text-text-subtle">${t('inventory.no_items')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}
