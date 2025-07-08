
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { state } from './state.ts';
import { t } from './i18n.ts';
import { formatDate } from './utils.ts';
import { renderApp } from "./app-renderer.ts";
import type { AiSuggestedTask } from './types.ts';

declare const jspdf: any;

const API_KEY = process.env.API_KEY;

export async function handleAiTaskGeneration(promptText: string) {
    if (!API_KEY) {
        state.ai.error = "API_KEY is not configured. Please set it up to use the AI Assistant.";
        state.ai.loading = false;
        renderApp();
        return;
    }

    state.ai = { loading: true, error: null, suggestedTasks: null };
    renderApp();

    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });

        const systemInstruction = `You are an expert project manager. Your task is to break down a user's high-level project idea into a list of specific, actionable tasks. Respond ONLY with a valid JSON array of objects. Do not include any other text, explanations, or markdown formatting around the JSON. The JSON schema for the response should be an array of objects, where each object has a "name" (a short, clear task title) and a "description" (a one-sentence explanation of what the task involves).`;
        const userPrompt = `Generate a list of tasks for the following project: "${promptText}".`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-04-17',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }

        const parsedData = JSON.parse(jsonStr) as AiSuggestedTask[];

        if (Array.isArray(parsedData) && parsedData.every(item => typeof item.name === 'string' && typeof item.description === 'string')) {
            state.ai.suggestedTasks = parsedData;
        } else {
            throw new Error("Received invalid data structure from AI.");
        }
    } catch (error) {
        console.error("AI Task Generation Error:", error);
        state.ai.error = "Sorry, something went wrong while generating tasks. Please try again or rephrase your idea.";
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
