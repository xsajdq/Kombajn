import { GenerateContentResponse } from "@google/genai";
import { state } from './state.ts';
import { t } from './i18n.ts';
import { formatDate } from './utils.ts';
import { updateUI } from "./app-renderer.ts";
import type { AiSuggestedTask } from './types.ts';
import { apiFetch } from "./services/api.ts";

declare const jspdf: any;

export function generateInvoicePDF(invoiceId: string, options: { outputType?: 'download' | 'datauristring' } = {}) {
    const { outputType = 'download' } = options;
    const activeWorkspaceId = state.activeWorkspaceId;
    const invoice = state.invoices.find(inv => inv.id === invoiceId && inv.workspaceId === activeWorkspaceId);
    const client = state.clients.find(c => c.id === invoice?.clientId && c.workspaceId === activeWorkspaceId);
    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);

    if (!invoice || !client || !workspace) {
        alert("Could not find invoice, client or workspace data.");
        return null;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageMargin = 20;

    const generateAndProcess = (): string | void => {
        let yPos = 30;
        const pageWidth = doc.internal.pageSize.width;

        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.setTextColor('#111827');
        doc.text(t('invoices.invoice_singular').toUpperCase(), pageMargin, yPos);
        yPos += 8;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor('#6B7280');
        doc.text(`${invoice.invoiceNumber}`, pageMargin, yPos);

        const datesY = 38;
        doc.text(`${t('modals.issue_date')}: ${formatDate(invoice.issueDate)}`, pageWidth - pageMargin, datesY, { align: 'right' });
        doc.text(`${t('modals.due_date')}: ${formatDate(invoice.dueDate)}`, pageWidth - pageMargin, datesY + 7, { align: 'right' });

        yPos = 65;

        doc.setLineWidth(0.1);
        doc.setDrawColor('#E5E7EB');
        doc.line(pageMargin, yPos - 10, pageWidth - pageMargin, yPos - 10);

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor('#6B7280');
        doc.text(t('panels.seller').toUpperCase(), pageMargin, yPos);
        doc.text(t('panels.buyer').toUpperCase(), pageWidth / 2 + 10, yPos);
        yPos += 6;

        doc.setFont("helvetica", "normal");
        doc.setTextColor('#1F2937');
        doc.setFontSize(10);
        doc.text(workspace.companyName || '', pageMargin, yPos);
        doc.text(client.name, pageWidth / 2 + 10, yPos);
        yPos += 5;

        doc.setFontSize(9);
        doc.setTextColor('#4B5563');
        const sellerAddress = (workspace.companyAddress || '').split('\n');
        let tempY = yPos;
        sellerAddress.forEach(line => { doc.text(line, pageMargin, tempY); tempY += 4; });
        doc.text(`${t('modals.vat_id')}: ${workspace.companyVatId || ''}`, pageMargin, tempY);

        const buyerAddress = (client.address || 'Address not specified').split('\n');
        tempY = yPos;
        buyerAddress.forEach(line => { doc.text(line, pageWidth / 2 + 10, tempY); tempY += 4; });
        doc.text(`${t('modals.vat_id')}: ${client.vatId || t('misc.not_applicable')}`, pageWidth / 2 + 10, tempY);

        yPos = tempY + 20;

        const tableColumn = ["#", t('modals.item_description'), t('modals.item_qty'), t('invoices.unit_price'), t('invoices.total_price')];
        const tableRows: any[] = [];
        let subtotal = 0;
        invoice.items.forEach((item, index) => {
            const total = item.quantity * item.unitPrice;
            tableRows.push([index + 1, item.description, item.quantity.toFixed(2), item.unitPrice.toFixed(2) + ' PLN', total.toFixed(2) + ' PLN']);
            subtotal += total;
        });

        (doc as any).autoTable({
            head: [tableColumn], body: tableRows, startY: yPos, theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 10 },
            styles: { cellPadding: 3, fontSize: 9, valign: 'middle' },
            columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right', cellWidth: 20 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 30 } }
        });

        let finalY = (doc as any).lastAutoTable.finalY;
        finalY += 15;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${t('modals.total')}:`, pageWidth - pageMargin - 40, finalY, { align: 'right' });
        doc.text(`${subtotal.toFixed(2)} PLN`, pageWidth - pageMargin, finalY, { align: 'right' });

        if (outputType === 'datauristring') {
            return doc.output('datauristring');
        } else {
            doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
        }
    };

    return new Promise((resolve) => {
        if (workspace.companyLogo) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = workspace.companyLogo;
            const process = () => resolve(generateAndProcess());
            img.onload = () => {
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    const logoHeight = 15;
                    const logoWidth = (img.naturalWidth * logoHeight) / img.naturalHeight;
                    const maxLogoWidth = 60;
                    const finalLogoWidth = Math.min(logoWidth, maxLogoWidth);
                    const format = workspace.companyLogo!.includes('jpeg') ? 'JPEG' : 'PNG';
                    doc.addImage(img, format, doc.internal.pageSize.width - pageMargin - finalLogoWidth, 18, finalLogoWidth, logoHeight);
                }
                process();
            };
            img.onerror = process;
        } else {
            resolve(generateAndProcess());
        }
    });
}


export async function sendSlackNotification(userId: string, message: string, workspaceId: string) {
    try {
        await apiFetch('/api?action=notify-slack', {
            method: 'POST',
            body: JSON.stringify({ userId, message, workspaceId }),
        });
    } catch (error) {
        // Silently fail for now, but log the error.
        // We don't want to block the UI for a failed notification.
        console.error("Failed to send Slack notification:", error);
    }
}

export async function handleAiTaskGeneration(promptText: string) {
    state.ai = { loading: true, error: null, suggestedTasks: null };
    updateUI(['page']);

    try {
        const suggestedTasks: AiSuggestedTask[] = await apiFetch('/api?action=generate-tasks', {
            method: 'POST',
            body: JSON.stringify({ promptText }),
        });
        
        if (Array.isArray(suggestedTasks)) {
            state.ai = { loading: false, error: null, suggestedTasks: suggestedTasks };
        } else {
            throw new Error("AI response was not in the expected format.");
        }
    } catch (error) {
        console.error("AI task generation failed:", error);
        state.ai = { loading: false, error: (error as Error).message, suggestedTasks: null };
    } finally {
        updateUI(['page']);
    }
}