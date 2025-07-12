
import { GenerateContentResponse } from "@google/genai";
import { state } from './state.ts';
import { t } from './i18n.ts';
import { formatDate } from './utils.ts';
import { renderApp } from "./app-renderer.ts";
import type { AiSuggestedTask } from './types.ts';
import { apiFetch } from "./services/api.ts";

declare const jspdf: any;

export async function handleAiTaskGeneration(promptText: string) {
    state.ai = { loading: true, error: null, suggestedTasks: null };
    renderApp();

    try {
        const response = await fetch('/api/actions?action=generate-tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ promptText }),
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'Failed to generate tasks from AI.');
        }

        const parsedData = await response.json() as AiSuggestedTask[];

        if (Array.isArray(parsedData) && parsedData.every(item => typeof item.name === 'string' && typeof item.description === 'string')) {
            state.ai.suggestedTasks = parsedData;
        } else {
            throw new Error("Received invalid data structure from AI.");
        }
    } catch (error: any) {
        console.error("AI Task Generation Error:", error);
        state.ai.error = error.message || "Sorry, something went wrong while generating tasks. Please try again or rephrase your idea.";
    } finally {
        state.ai.loading = false;
        renderApp();
    }
}


export function generateInvoicePDF(invoiceId: string) {
    const activeWorkspaceId = state.activeWorkspaceId;
    const invoice = state.invoices.find(inv => inv.id === invoiceId && inv.workspaceId === activeWorkspaceId);
    const client = state.clients.find(c => c.id === invoice?.clientId && c.workspaceId === activeWorkspaceId);
    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);

    if (!invoice || !client || !workspace) {
        alert("Could not find invoice, client or workspace data.");
        return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();

    let yPos = 22;
    
    const generatePdfContent = () => {
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text(`${t('invoices.invoice_singular')} ${invoice.invoiceNumber}`, 14, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`${t('modals.issue_date')}: ${formatDate(invoice.issueDate)}`, 14, yPos);
        yPos += 5;
        doc.text(`${t('modals.due_date')}: ${formatDate(invoice.dueDate)}`, 14, yPos);
        yPos += 15;


        // Seller & Buyer Info
        const startY = yPos;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${t('panels.seller')}:`, 14, startY);
        doc.setFont("helvetica", "normal");
        doc.text(workspace.companyName || '', 14, startY + 6);
        doc.text(workspace.companyAddress || '', 14, startY + 12);
        doc.text(`NIP: ${workspace.companyVatId || ''}`, 14, startY + 18);

        doc.setFont("helvetica", "bold");
        doc.text(`${t('panels.buyer')}:`, 110, startY);
        doc.setFont("helvetica", "normal");
        doc.text(client.name, 110, startY + 6);
        doc.text(client.address || 'Address not specified', 110, startY + 12);
        doc.text(`NIP: ${client.vatId || t('misc.not_applicable')}`, 110, startY + 18);


        const tableColumn = ["#", t('modals.item_description'), t('modals.item_qty'), t('invoices.unit_price'), t('invoices.total_price')];
        const tableRows: any[] = [];
        let subtotal = 0;

        invoice.items.forEach((item, index) => {
            const total = item.quantity * item.unitPrice;
            const row = [
                index + 1,
                item.description,
                item.quantity.toFixed(2),
                `${item.unitPrice.toFixed(2)}`,
                `${total.toFixed(2)}`
            ];
            tableRows.push(row);
            subtotal += total;
        });

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: startY + 30,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133] }
        });

        const finalY = (doc as any).lastAutoTable.finalY;
        const total = subtotal; // Assuming no tax for now
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${t('modals.total')}: ${total.toFixed(2)} PLN`, 14, finalY + 15);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Payment to:", 14, finalY + 30);
        doc.text(workspace.companyBankName || '', 14, finalY + 35);
        doc.text(workspace.companyBankAccount || '', 14, finalY + 40);

        doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
    };
    
    if (workspace.companyLogo) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = workspace.companyLogo;
        img.onload = () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                const logoHeight = 20; 
                const logoWidth = (img.naturalWidth * logoHeight) / img.naturalHeight;
                const maxLogoWidth = 60;
                const finalLogoWidth = logoWidth > maxLogoWidth ? maxLogoWidth : logoWidth;
                const format = workspace.companyLogo!.includes('jpeg') ? 'JPEG' : 'PNG';
                doc.addImage(img, format, 14, 15, finalLogoWidth, logoHeight);
                yPos = 15 + logoHeight + 10;
            }
            generatePdfContent();
        };
        img.onerror = () => {
            console.error("Failed to load logo for PDF, generating without it.");
            generatePdfContent();
        };
    } else {
        generatePdfContent();
    }
}

export async function sendSlackNotification(userId: string, message: string, workspaceId: string) {
    try {
        await apiFetch('/api/actions?action=notify-slack', {
            method: 'POST',
            body: JSON.stringify({ userId, message, workspaceId }),
        });
    } catch (error) {
        // Silently fail for now, but log the error.
        // We don't want to block the UI for a failed notification.
        console.error("Failed to send Slack notification:", error);
    }
}
