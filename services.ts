
import { GenerateContentResponse } from "@google/genai";
import { getState, setState } from './state.ts';
import { t } from './i18n.ts';
import { formatDate } from './utils.ts';
import { updateUI } from "./app-renderer.ts";
import type { AiSuggestedTask, Client, Invoice, Workspace } from './types.ts';
import { apiFetch } from "./services/api.ts";
import { showToast } from "./handlers/ui.ts";

declare const jspdf: any;

// ============================================================================
// PDF Generation Logic
// ============================================================================

const pageMargin = 20;

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [ parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16) ] : null;
}

// --- Template Renderers ---

function renderModernTemplate(doc: any, invoice: Invoice, client: Client, workspace: Workspace, tableRows: any[], subtotal: number, accentColor: string) {
    let yPos = 30;
    const pageWidth = doc.internal.pageSize.width;
    const accentRgb = hexToRgb(accentColor) || [59, 130, 246];

    // Header
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor);
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

    // Seller & Buyer
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
    yPos = Math.max(yPos, tempY) + 20;

    // Table
    doc.autoTable({
        head: [[ "#", t('modals.item_description'), t('modals.item_qty'), t('invoices.unit_price'), t('invoices.total_price')]],
        body: tableRows, startY: yPos, theme: 'striped',
        headStyles: { fillColor: accentRgb, textColor: 255, fontStyle: 'bold', fontSize: 10 },
        styles: { cellPadding: 3, fontSize: 9, valign: 'middle' },
        columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right', cellWidth: 20 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 30 } }
    });

    // Total & Footer
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${t('modals.total')}:`, pageWidth - pageMargin - 40, finalY, { align: 'right' });
    doc.text(`${subtotal.toFixed(2)} PLN`, pageWidth - pageMargin, finalY, { align: 'right' });

    if (workspace.invoiceSettings?.defaultNotes) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor('#6B7280');
        doc.text(workspace.invoiceSettings.defaultNotes, pageMargin, doc.internal.pageSize.height - 20, { maxWidth: pageWidth - (pageMargin * 2) });
    }
}

function renderClassicTemplate(doc: any, invoice: Invoice, client: Client, workspace: Workspace, tableRows: any[], subtotal: number, accentColor: string) {
    let yPos = 25;
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFont("times", "bold");
    doc.setFontSize(32);
    doc.setTextColor('#111827');
    doc.text(t('invoices.invoice_singular').toUpperCase(), pageWidth - pageMargin, yPos, { align: 'right' });

    // Seller info on left
    yPos = 40;
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text(workspace.companyName || 'Your Company', pageMargin, yPos);
    yPos += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const sellerAddress = (workspace.companyAddress || 'Your Address').split('\n');
    sellerAddress.forEach(line => { doc.text(line, pageMargin, yPos); yPos += 5; });
    doc.text(workspace.companyVatId || '', pageMargin, yPos);

    // Invoice info on right
    yPos = 50;
    doc.setFont("times", "bold");
    doc.text(`${t('invoices.invoice_singular')} #:`, pageWidth - pageMargin, yPos, { align: 'right' });
    doc.setFont("times", "normal");
    doc.text(invoice.invoiceNumber, pageWidth - pageMargin - 30, yPos);
    yPos += 7;
    doc.setFont("times", "bold");
    doc.text(`${t('modals.issue_date')}:`, pageWidth - pageMargin, yPos, { align: 'right' });
    doc.setFont("times", "normal");
    doc.text(formatDate(invoice.issueDate), pageWidth - pageMargin - 30, yPos);
    yPos += 7;
    doc.setFont("times", "bold");
    doc.text(`${t('modals.due_date')}:`, pageWidth - pageMargin, yPos, { align: 'right' });
    doc.setFont("times", "normal");
    doc.text(formatDate(invoice.dueDate), pageWidth - pageMargin - 30, yPos);

    // Bill to
    yPos = 80;
    doc.setFont("times", "bold");
    doc.text(t('panels.buyer').toUpperCase(), pageMargin, yPos);
    yPos += 6;
    doc.setFont("times", "normal");
    doc.text(client.name, pageMargin, yPos);
    yPos += 5;
    const buyerAddress = (client.address || '').split('\n');
    buyerAddress.forEach(line => { doc.text(line, pageMargin, yPos); yPos += 5; });

    // Table
    yPos += 10;
    doc.autoTable({
        head: [[ "#", t('modals.item_description'), t('modals.item_qty'), t('invoices.unit_price'), t('invoices.total_price')]],
        body: tableRows, startY: yPos, theme: 'grid',
        headStyles: { fillColor: [22, 22, 22], textColor: 255, font: 'times', fontStyle: 'bold' },
        styles: { font: 'times' },
        columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    // Total
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text(`${t('modals.total')}:`, pageWidth - pageMargin, finalY, { align: 'right' });
    doc.text(`${subtotal.toFixed(2)} PLN`, pageWidth - pageMargin, finalY + 7, { align: 'right' });
    
    if (workspace.invoiceSettings?.defaultNotes) {
        doc.setFontSize(9);
        doc.setFont("times", "italic");
        doc.setTextColor('#6B7280');
        doc.text(workspace.invoiceSettings.defaultNotes, pageMargin, doc.internal.pageSize.height - 20, { maxWidth: pageWidth - (pageMargin * 2) });
    }
}

function renderElegantTemplate(doc: any, invoice: Invoice, client: Client, workspace: Workspace, tableRows: any[], subtotal: number, accentColor: string) {
    const pageWidth = doc.internal.pageSize.width;
    const accentRgb = hexToRgb(accentColor) || [59, 130, 246];

    // Header Band
    doc.setFillColor(...accentRgb);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text(t('invoices.invoice_singular').toUpperCase(), pageMargin, 25);

    // Dates
    doc.setFontSize(10);
    doc.text(`${t('invoices.invoice_singular')} #: ${invoice.invoiceNumber}`, pageWidth - pageMargin, 15, { align: 'right' });
    doc.text(`${t('modals.issue_date')}: ${formatDate(invoice.issueDate)}`, pageWidth - pageMargin, 22, { align: 'right' });
    doc.text(`${t('modals.due_date')}: ${formatDate(invoice.dueDate)}`, pageWidth - pageMargin, 29, { align: 'right' });

    // Seller and Buyer
    let yPos = 55;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor('#6B7280');
    doc.text(t('panels.seller').toUpperCase(), pageMargin, yPos);
    doc.text(t('panels.buyer').toUpperCase(), pageWidth / 2, yPos);
    yPos += 6;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor('#1F2937');
    doc.setFontSize(10);
    doc.text(workspace.companyName || '', pageMargin, yPos, { maxWidth: pageWidth / 2 - pageMargin - 10 });
    doc.text(client.name, pageWidth / 2, yPos, { maxWidth: pageWidth / 2 - pageMargin });
    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor('#4B5563');
    doc.text((workspace.companyAddress || '').replace(/\n/g, ', '), pageMargin, yPos, { maxWidth: pageWidth / 2 - pageMargin - 10 });
    doc.text((client.address || '').replace(/\n/g, ', '), pageWidth / 2, yPos, { maxWidth: pageWidth / 2 - pageMargin });
    
    // Table
    yPos += 20;
    doc.autoTable({
        head: [[ "#", t('modals.item_description'), t('modals.item_qty'), t('invoices.unit_price'), t('invoices.total_price')]],
        body: tableRows, startY: yPos, theme: 'plain',
        headStyles: { textColor: accentColor, fontStyle: 'bold', fontSize: 10, cellPadding: { bottom: 3 } },
        styles: { cellPadding: 3, fontSize: 9, valign: 'middle', lineColor: '#E5E7EB', lineWidth: 0.1 },
        didParseCell: (data: any) => { if (data.section === 'head') data.cell.styles.lineColor = accentColor; }
    });

    // Total
    let finalY = doc.lastAutoTable.finalY;
    doc.setFillColor(...accentRgb);
    doc.rect(pageWidth / 2, finalY + 10, pageWidth / 2 - pageMargin, 20, 'F');
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${t('modals.total')}:`, pageWidth / 2 + 10, finalY + 22);
    doc.text(`${subtotal.toFixed(2)} PLN`, pageWidth - pageMargin, finalY + 22, { align: 'right' });
}

function renderMinimalistTemplate(doc: any, invoice: Invoice, client: Client, workspace: Workspace, tableRows: any[], subtotal: number, accentColor: string) {
    let yPos = 25;
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor('#111827');
    doc.text(workspace.companyName || 'Your Company', pageMargin, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text(t('invoices.invoice_singular'), pageWidth - pageMargin, yPos, { align: 'right' });

    yPos += 15;
    doc.setLineWidth(0.5);
    doc.setDrawColor(accentColor);
    doc.line(pageMargin, yPos, pageWidth - pageMargin, yPos);

    yPos += 15;
    // Seller/Buyer
    doc.setFontSize(9);
    doc.setTextColor('#6B7280');
    doc.text(t('panels.buyer').toUpperCase(), pageMargin, yPos);
    doc.text(t('invoices.invoice_singular').toUpperCase(), pageWidth - pageMargin, yPos, { align: 'right' });
    yPos += 6;
    doc.setFontSize(10);
    doc.setTextColor('#1F2937');
    doc.text(client.name, pageMargin, yPos);
    doc.text(invoice.invoiceNumber, pageWidth - pageMargin, yPos, { align: 'right' });
    yPos += 5;
    doc.text(client.address || '', pageMargin, yPos);
    doc.text(formatDate(invoice.issueDate), pageWidth - pageMargin, yPos, { align: 'right' });

    // Table
    yPos += 20;
    doc.autoTable({
        head: [[t('modals.item_description'), t('modals.item_qty'), t('invoices.unit_price'), t('invoices.total_price')]],
        body: tableRows.map(r => r.slice(1)), // remove '#' column
        startY: yPos, theme: 'plain',
        headStyles: { fontStyle: 'bold', textColor: '#111827', cellPadding: { bottom: 4 } },
        styles: { cellPadding: 3, fontSize: 10 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
    });

    // Total
    let finalY = doc.lastAutoTable.finalY;
    doc.setLineWidth(0.3);
    doc.line(pageWidth / 2, finalY + 8, pageWidth - pageMargin, finalY + 8);
    finalY += 15;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${t('modals.total')}:`, pageWidth - pageMargin - 40, finalY, { align: 'right' });
    doc.text(`${subtotal.toFixed(2)} PLN`, pageWidth - pageMargin, finalY, { align: 'right' });
}


export function generateInvoicePDF(invoiceId: string, options: { outputType?: 'download' | 'datauristring' } = {}) {
    const { outputType = 'download' } = options;
    const state = getState();
    const activeWorkspaceId = state.activeWorkspaceId;
    const invoice = state.invoices.find(inv => inv.id === invoiceId && inv.workspaceId === activeWorkspaceId);
    const client = state.clients.find(c => c.id === invoice?.clientId && c.workspaceId === activeWorkspaceId);
    const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);

    if (!invoice || !client || !workspace) {
        showToast("Could not find invoice, client or workspace data.", 'error');
        return null;
    }
    
    const settings = workspace.invoiceSettings || {
        template: 'modern',
        accentColor: '#3B82F6',
        defaultNotes: '',
    };

    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const generateAndProcess = (): string | void => {
        const tableRows: any[] = [];
        let subtotal = 0;
        invoice.items.forEach((item, index) => {
            const total = item.quantity * item.unitPrice;
            tableRows.push([index + 1, item.description, item.quantity.toFixed(2), item.unitPrice.toFixed(2) + ' PLN', total.toFixed(2) + ' PLN']);
            subtotal += total;
        });

        // Call the appropriate template renderer based on settings
        switch (settings.template) {
            case 'classic':
                renderClassicTemplate(doc, invoice, client, workspace, tableRows, subtotal, settings.accentColor);
                break;
            case 'elegant':
                renderElegantTemplate(doc, invoice, client, workspace, tableRows, subtotal, settings.accentColor);
                break;
            case 'minimalist':
                renderMinimalistTemplate(doc, invoice, client, workspace, tableRows, subtotal, settings.accentColor);
                break;
            case 'modern':
            default:
                renderModernTemplate(doc, invoice, client, workspace, tableRows, subtotal, settings.accentColor);
                break;
        }

        if (outputType === 'datauristring') {
            return doc.output('datauristring');
        } else {
            doc.save(`invoice-${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`);
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
                    // The renderer itself will place the logo, we just need to make sure it's loaded.
                    (doc as any).logoImage = { img, format, width: finalLogoWidth, height: logoHeight };
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
    setState({ ai: { loading: true, error: null, suggestedTasks: null } }, ['page']);

    try {
        const suggestedTasks: AiSuggestedTask[] = await apiFetch('/api?action=generate-tasks', {
            method: 'POST',
            body: JSON.stringify({ promptText }),
        });
        
        if (Array.isArray(suggestedTasks)) {
            setState({ ai: { loading: false, error: null, suggestedTasks: suggestedTasks } }, ['page']);
        } else {
            throw new Error("AI response was not in the expected format.");
        }
    } catch (error) {
        console.error("AI task generation failed:", error);
        setState({ ai: { loading: false, error: (error as Error).message, suggestedTasks: null } }, ['page']);
    }
}
