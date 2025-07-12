
import { t } from '../i18n.ts';

declare const jspdf: any;

function tableToCSV(table: HTMLTableElement): string {
    let csv = [];
    const rows = table.querySelectorAll("tr");
    
    for (const row of rows) {
        const rowData: string[] = [];
        const cols = row.querySelectorAll("td, th");
        for (const col of cols) {
            // Clean up text content and handle potential commas
            let text = col.textContent?.trim().replace(/"/g, '""') ?? '';
            if (text.includes(',')) {
                text = `"${text}"`;
            }
            rowData.push(text);
        }
        csv.push(rowData.join(","));
    }
    
    return csv.join("\n");
}

function downloadFile(content: string, fileName: string, mimeType: string) {
     const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function handleExportCsv(e: MouseEvent) {
    const table = (e.target as HTMLElement).closest('.card')?.querySelector('table');
    if (!table) { 
        alert('Could not find table to export.'); 
        return; 
    }
    const title = (e.target as HTMLElement).closest('.card')?.querySelector('h4')?.textContent || 'report';
    const csvContent = tableToCSV(table);
    const fileName = `${title.replace(/\s/g, '_').toLowerCase()}.csv`;
    downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
}

export function handleExportPdf(e: MouseEvent) {
    const table = (e.target as HTMLElement).closest('.card')?.querySelector('table');
    const title = (e.target as HTMLElement).closest('.card')?.querySelector('h4')?.textContent || 'Report';
    if (!table) { 
        alert('Could not find table to export.'); 
        return;
    }
    
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);

    (doc as any).autoTable({ 
        html: table, 
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] } // Dark gray color
    });
    
    doc.save(`${title.replace(/\s/g, '_').toLowerCase()}.pdf`);
}