import { Router } from 'express';
import { eq } from 'drizzle-orm';

import { db } from '../db/connection.js';
import {
  invoices,
  orderItems,
  orders,
  payments,
  productCodeVersions,
  productCodes,
} from '../db/schema.js';
import { toPositiveInteger } from '../utils/validation.js';
import { computeNetAndTaxFromTotal } from '../utils/money.js';

const receiptsRouter = Router();

class HttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

const formatCurrency = (cents) => {
  return (cents / 100).toFixed(2);
};

const buildReceiptText = ({
  invoice,
  order,
  items,
  totals,
  paymentsSummary,
}) => {
  const ESC = '\u001b';
  const GS = '\u001d';

  const previewLines = [];
  const printerLines = [];

  const addPreview = (line = '') => previewLines.push(line);
  const addPrinter = (line = '') => printerLines.push(line);

  addPrinter(`${ESC}@`); // Initialize printer
  addPrinter(`${ESC}!\x38POS RECEIPT`);
  addPrinter(`${ESC}!\x00`);

  addPreview('POS RECEIPT');
  addPreview('');

  const orderReference = order?.orderNumber ?? order?.id ?? 'N/A';
  const issuedAt = new Date(invoice.createdAt ?? Date.now()).toLocaleString();

  addPrinter(`Invoice: ${invoice.invoiceNo}`);
  addPrinter(`Order: ${orderReference}`);
  addPrinter(`Date: ${issuedAt}`);

  addPreview(`Invoice: ${invoice.invoiceNo}`);
  addPreview(`Order: ${orderReference}`);
  addPreview(`Date: ${issuedAt}`);
  addPreview('------------------------------');

  addPrinter('------------------------------');

  items.forEach((item) => {
    const descriptor = [item.code, item.name].filter(Boolean).join(' ').trim() || 'Item';
    const nameLine = `${descriptor} x${item.qty}`;
    const priceLine = `  ${formatCurrency(item.totalCents)} (${formatCurrency(item.unitPriceCents)} ea)`;

    addPrinter(nameLine);
    addPrinter(priceLine);

    addPreview(nameLine);
    addPreview(priceLine);
  });

  addPrinter('------------------------------');
  addPreview('------------------------------');

  addPrinter(`Subtotal: ${formatCurrency(totals.netCents)}`);
  addPrinter(`ITBIS 18%: ${formatCurrency(totals.taxCents)}`);
  addPrinter(`TOTAL: ${formatCurrency(totals.totalCents)}`);

  addPreview(`Subtotal: ${formatCurrency(totals.netCents)}`);
  addPreview(`ITBIS 18%: ${formatCurrency(totals.taxCents)}`);
  addPreview(`TOTAL: ${formatCurrency(totals.totalCents)}`);

  if (paymentsSummary.length > 0) {
    addPrinter('------------------------------');
    addPreview('------------------------------');
    addPrinter('Payments:');
    addPreview('Payments:');

    paymentsSummary.forEach((payment) => {
      const line = `- ${payment.method.toUpperCase()}: ${formatCurrency(payment.amountCents)}`;
      addPrinter(line);
      addPreview(line);
    });
  }

  const hasCashPayment = paymentsSummary.some((payment) => payment.method === 'cash');
  if (hasCashPayment) {
    addPreview('');
    addPreview('[Drawer kick sent]');
    addPrinter(`${ESC}p\x00\x3C\xFF`);
  }

  addPrinter('');
  addPrinter('Thank you for your purchase!');
  addPreview('');
  addPreview('Thank you for your purchase!');

  addPrinter(`${GS}V\x00`); // Full cut

  const commandBuffer = Buffer.from(printerLines.join('\n'), 'utf8');

  return {
    preview: previewLines,
    escposBase64: commandBuffer.toString('base64'),
  };
};

receiptsRouter.post('/:invoiceId/print', async (req, res, next) => {
  try {
    const invoiceId = toPositiveInteger(req.params.invoiceId);
    if (!invoiceId) {
      return res.status(400).json({
        error: 'InvalidInvoiceId',
        message: 'The "invoiceId" parameter must be a positive integer.',
      });
    }

    const [invoiceRecord] = await db
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        orderId: invoices.orderId,
        totalCents: invoices.totalCents,
        taxCents: invoices.taxCents,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoiceRecord) {
      return res.status(404).json({
        error: 'InvoiceNotFound',
        message: 'The requested invoice does not exist.',
      });
    }

    const [orderRecord] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        branchId: orders.branchId,
        userId: orders.userId,
        subtotalCents: orders.subtotalCents,
        taxCents: orders.taxCents,
        totalCents: orders.totalCents,
      })
      .from(orders)
      .where(eq(orders.id, invoiceRecord.orderId))
      .limit(1);

    if (!orderRecord) {
      throw new HttpError(404, 'OrderNotFound', 'The order associated with this invoice was not found.');
    }

    const lineItems = await db
      .select({
        id: orderItems.id,
        qty: orderItems.qty,
        unitPriceCents: orderItems.unitPriceCents,
        totalCents: orderItems.totalCents,
        productCodeVersionId: orderItems.productCodeVersionId,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(orderItems)
      .innerJoin(productCodeVersions, eq(orderItems.productCodeVersionId, productCodeVersions.id))
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .where(eq(orderItems.orderId, invoiceRecord.orderId));

    const paymentRecords = await db
      .select({
        id: payments.id,
        method: payments.method,
        amountCents: payments.amountCents,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

    const totals = {
      ...computeNetAndTaxFromTotal(invoiceRecord.totalCents),
      totalCents: invoiceRecord.totalCents,
    };

    const itemsWithBreakdown = lineItems.map((item) => {
      const breakdown = computeNetAndTaxFromTotal(item.totalCents);
      return {
        ...item,
        netCents: breakdown.netCents,
        taxCents: breakdown.taxCents,
      };
    });

    const paymentsSummary = paymentRecords.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amountCents: payment.amountCents,
      createdAt: payment.createdAt,
    }));

    const printJob = buildReceiptText({
      invoice: invoiceRecord,
      order: orderRecord,
      items: itemsWithBreakdown,
      totals,
      paymentsSummary,
    });

    res.status(200).json({
      data: {
        invoice: invoiceRecord,
        order: orderRecord,
        items: itemsWithBreakdown,
        payments: paymentsSummary,
        printJob,
      },
      meta: {
        queued: true,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        error: error.errorCode,
        message: error.message,
      });
    }

    next(error);
  }
});

export default receiptsRouter;
