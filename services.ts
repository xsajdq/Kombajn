

import { GenerateContentResponse } from "@google/genai";
import { state } from './state.ts';
import { t } from './i18n.ts';
import { formatDate } from './utils.ts';
import { renderApp } from "./app-renderer.ts";
import type { AiSuggestedTask } from './types.ts';
import { apiFetch } from "./services/api.ts";

declare const jspdf: any;

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
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });
    const pageHeight = doc.internal.pageSize.height;
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.width;

    const generatePdfContent = () => {
        // --- HEADER ---
        doc.setFontSize(26);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55); // Gray 800
        doc.text(`${t('invoices.invoice_singular').toUpperCase()}`, pageMargin, 30);

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128); // Gray 500
        doc.text(`${invoice.invoiceNumber}`, pageMargin, 37);
        
        doc.text(`${t('modals.issue_date')}: ${formatDate(invoice.issueDate)}`, pageWidth - pageMargin, 30, { align: 'right' });
        doc.text(`${t('modals.due_date')}: ${formatDate(invoice.dueDate)}`, pageWidth - pageMargin, 37, { align: 'right' });


        // --- SELLER & BUYER ---
        let yPos = 55;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 114, 128);
        doc.text(`${t('panels.seller').toUpperCase()}`, pageMargin, yPos);
        doc.text(`${t('panels.buyer').toUpperCase()}`, pageWidth / 2, yPos);
        yPos += 6;
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(11);
        doc.text(workspace.companyName || '', pageMargin, yPos);
        doc.text(client.name, pageWidth / 2, yPos);
        yPos += 6;

        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        const sellerAddress = (workspace.companyAddress || '').split('\n');
        let tempY = yPos;
        sellerAddress.forEach(line => {
            doc.text(line, pageMargin, tempY);
            tempY += 5;
        });
        doc.text(`${t('modals.vat_id')}: ${workspace.companyVatId || ''}`, pageMargin, tempY);

        const buyerAddress = (client.address || 'Address not specified').split('\n');
        tempY = yPos;
        buyerAddress.forEach(line => {
            doc.text(line, pageWidth / 2, tempY);
            tempY += 5;
        });
        doc.text(`${t('modals.vat_id')}: ${client.vatId || t('misc.not_applicable')}`, pageWidth / 2, tempY);
        
        yPos = tempY + 15;


        // --- TABLE ---
        const tableColumn = ["#", t('modals.item_description'), t('modals.item_qty'), t('invoices.unit_price'), t('invoices.total_price')];
        const tableRows: any[] = [];
        let subtotal = 0;

        invoice.items.forEach((item, index) => {
            const total = item.quantity * item.unitPrice;
            const row = [
                index + 1,
                item.description,
                item.quantity.toFixed(2),
                item.unitPrice.toFixed(2),
                total.toFixed(2)
            ];
            tableRows.push(row);
            subtotal += total;
        });

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: yPos,
            theme: 'striped', // 'striped', 'grid', 'plain'
            headStyles: {
                fillColor: [59, 130, 246], // Blue 500
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                cellPadding: 3,
                fontSize: 10
            },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });
        
        let finalY = (doc as any).lastAutoTable.finalY;

        // --- TOTALS ---
        finalY += 10;
        const total = subtotal; // Assuming no tax for now
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(55, 65, 81);
        doc.text(`${t('modals.total')}:`, pageWidth - pageMargin - 30, finalY, { align: 'right'});

        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text(`${total.toFixed(2)} PLN`, pageWidth - pageMargin, finalY, { align: 'right' });


        // --- FOOTER / PAYMENT INFO ---
        finalY = pageHeight - 40;
        doc.setLineWidth(0.5);
        doc.setDrawColor(229, 231, 235); // Gray 200
        doc.line(pageMargin, finalY, pageWidth - pageMargin, finalY);
        finalY += 10;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 114, 128);
        doc.text("Payment Details", pageMargin, finalY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(55, 65, 81);
        doc.text(workspace.companyBankName || 'Bank Name Not Provided', pageMargin, finalY + 6);
        doc.text(workspace.companyBankAccount || 'Bank Account Not Provided', pageMargin, finalY + 11);


        doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
    };
    
    // --- LOGO HANDLING ---
    if (workspace.companyLogo) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = workspace.companyLogo;
        img.onload = () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                const logoHeight = 15; 
                const logoWidth = (img.naturalWidth * logoHeight) / img.naturalHeight;
                const maxLogoWidth = 50;
                const finalLogoWidth = logoWidth > maxLogoWidth ? maxLogoWidth : logoWidth;
                const format = workspace.companyLogo!.includes('jpeg') ? 'JPEG' : 'PNG';
                
                // Position logo on the top right
                doc.addImage(img, format, pageWidth - pageMargin - finalLogoWidth, 15, finalLogoWidth, logoHeight);
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
    renderApp();

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
        renderApp();
    }
}