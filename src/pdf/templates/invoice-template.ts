import PDFDocument from 'pdfkit';
import { Invoice, Client } from '../../shared/types/index';

/** Format integer cents to AUD display string e.g. 165000 → "$1,650.00" */
function formatAUD(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}

export async function renderInvoicePDF(
  invoice: Invoice,
  client: Client,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 495; // usable width

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('QuickInvoice', 50, 50)
      .fontSize(10)
      .font('Helvetica')
      .text('Professional Invoice Management', 50, 80)
      .moveDown(2);

    // ── Invoice meta ─────────────────────────────────────────────────────────
    const metaY = 120;
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('INVOICE', 50, metaY)
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice #: ${invoice.invoiceNumber}`, 50, metaY + 28)
      .text(`Issue Date: ${invoice.issueDate}`, 50, metaY + 42)
      .text(`Due Date: ${invoice.dueDate}`, 50, metaY + 56)
      .text(`Status: ${invoice.status.toUpperCase()}`, 50, metaY + 70);

    // ── Bill To ──────────────────────────────────────────────────────────────
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('BILL TO', 300, metaY)
      .fontSize(10)
      .font('Helvetica')
      .text(client.name, 300, metaY + 18)
      .text(client.email, 300, metaY + 32);

    // ── Divider ──────────────────────────────────────────────────────────────
    doc
      .moveTo(50, 230)
      .lineTo(545, 230)
      .strokeColor('#cccccc')
      .stroke();

    // ── Line items table header ───────────────────────────────────────────────
    const tableTop = 245;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Description', 50, tableTop)
      .text('Qty', 310, tableTop, { width: 50, align: 'right' })
      .text('Unit Price', 365, tableTop, { width: 80, align: 'right' })
      .text('Tax %', 450, tableTop, { width: 40, align: 'right' })
      .text('Total', 495, tableTop, { width: 50, align: 'right' });

    doc
      .moveTo(50, tableTop + 16)
      .lineTo(545, tableTop + 16)
      .strokeColor('#cccccc')
      .stroke();

    // ── Line items ────────────────────────────────────────────────────────────
    let rowY = tableTop + 24;
    doc.fontSize(10).font('Helvetica');

    for (const item of invoice.lineItems) {
      const lineTotal = Math.round(item.quantity * item.unitPrice);
      doc
        .text(item.description, 50, rowY, { width: 255 })
        .text(String(item.quantity), 310, rowY, { width: 50, align: 'right' })
        .text(formatAUD(item.unitPrice), 365, rowY, { width: 80, align: 'right' })
        .text(`${item.taxRate}%`, 450, rowY, { width: 40, align: 'right' })
        .text(formatAUD(lineTotal), 495, rowY, { width: 50, align: 'right' });
      rowY += 20;
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalsX = 380;
    rowY += 10;
    doc
      .moveTo(50, rowY)
      .lineTo(545, rowY)
      .strokeColor('#cccccc')
      .stroke();
    rowY += 12;

    doc
      .font('Helvetica')
      .text('Subtotal:', totalsX, rowY)
      .text(formatAUD(invoice.subtotal), 495, rowY, { width: 50, align: 'right' });
    rowY += 18;

    doc
      .text('GST:', totalsX, rowY)
      .text(formatAUD(invoice.taxTotal), 495, rowY, { width: 50, align: 'right' });
    rowY += 18;

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('TOTAL DUE:', totalsX, rowY)
      .text(formatAUD(invoice.grandTotal), 495, rowY, { width: 50, align: 'right' });

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (invoice.notes) {
      rowY += 40;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Notes:', 50, rowY)
        .font('Helvetica')
        .text(invoice.notes, 50, rowY + 14, { width: W });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#888888')
      .text(
        'Thank you for your business. Please reference the invoice number when making payment.',
        50,
        780,
        { width: W, align: 'center' },
      );

    doc.end();
  });
}
