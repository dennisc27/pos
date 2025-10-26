import { Router } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';

import { db } from '../db/connection.js';
import { invoices, orderItems, orders } from '../db/schema.js';
import { toPositiveInteger } from '../utils/validation.js';
import { computeNetAndTaxFromTotal } from '../utils/money.js';

const invoicesRouter = Router();
const INVOICE_NUMBER_ATTEMPTS = 7;

class HttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

const generateInvoiceNumberCandidate = () => {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const randomSegment = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${timestamp}-${randomSegment}`;
};

const getUniqueInvoiceNumber = async (tx) => {
  for (let attempt = 0; attempt < INVOICE_NUMBER_ATTEMPTS; attempt += 1) {
    const candidate = generateInvoiceNumberCandidate();
    const [existing] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.invoiceNo, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  throw new HttpError(
    500,
    'InvoiceNumberGenerationFailed',
    'Unable to generate a unique invoice number at this time. Please retry.',
  );
};

invoicesRouter.post('/', async (req, res, next) => {
  try {
    const { orderId: orderIdInput, invoiceNumber: invoiceNumberInput } = req.body ?? {};

    const orderId = toPositiveInteger(orderIdInput);
    if (!orderId) {
      return res.status(400).json({
        error: 'InvalidOrderId',
        message: 'The "orderId" field must be a positive integer.',
      });
    }

    let providedInvoiceNumber = '';
    if (typeof invoiceNumberInput === 'string') {
      providedInvoiceNumber = invoiceNumberInput.trim();
      if (providedInvoiceNumber.length > 64) {
        return res.status(400).json({
          error: 'InvoiceNumberTooLong',
          message: 'The "invoiceNumber" field must be 64 characters or fewer.',
        });
      }

      if (providedInvoiceNumber && !/^[A-Za-z0-9_-]+$/.test(providedInvoiceNumber)) {
        return res.status(400).json({
          error: 'InvoiceNumberInvalidFormat',
          message: 'The "invoiceNumber" field may only contain letters, numbers, underscores, or hyphens.',
        });
      }

      providedInvoiceNumber = providedInvoiceNumber.toUpperCase();
    }

    const [orderRecord] = await db
      .select({
        id: orders.id,
        branchId: orders.branchId,
        status: orders.status,
        subtotalCents: orders.subtotalCents,
        taxCents: orders.taxCents,
        totalCents: orders.totalCents,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!orderRecord) {
      return res.status(404).json({
        error: 'OrderNotFound',
        message: 'No order was found for the provided identifier.',
      });
    }

    const [existingInvoice] = await db
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo })
      .from(invoices)
      .where(eq(invoices.orderId, orderId))
      .limit(1);

    if (existingInvoice) {
      return res.status(409).json({
        error: 'InvoiceAlreadyExists',
        message: `Order ${orderId} already has invoice ${existingInvoice.invoiceNo}.`,
      });
    }

    const orderLineItems = await db
      .select({
        id: orderItems.id,
        qty: orderItems.qty,
        unitPriceCents: orderItems.unitPriceCents,
        totalCents: orderItems.totalCents,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    if (orderLineItems.length === 0) {
      return res.status(400).json({
        error: 'OrderHasNoItems',
        message: 'Cannot create an invoice for an order without items.',
      });
    }

    let totalBigInt = 0n;
    const enrichedItems = orderLineItems.map((item) => {
      totalBigInt += BigInt(item.totalCents);
      const lineTotals = computeNetAndTax(item.totalCents);
      return {
        id: item.id,
        qty: item.qty,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.totalCents,
        netCents: lineTotals.netCents,
        taxCents: lineTotals.taxCents,
      };
    });

    if (totalBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(
        400,
        'InvoiceTotalOutOfRange',
        'The computed invoice total exceeds the supported monetary range.',
      );
    }

    const totalCents = Number(totalBigInt);
    const { netCents, taxCents } = computeNetAndTaxFromTotal(totalCents);

    const result = await db.transaction(async (tx) => {
      let invoiceNumber = providedInvoiceNumber;

      if (invoiceNumber) {
        const [duplicate] = await tx
          .select({ id: invoices.id })
          .from(invoices)
          .where(eq(invoices.invoiceNo, invoiceNumber))
          .limit(1);

        if (duplicate) {
          throw new HttpError(
            409,
            'InvoiceNumberExists',
            `The invoice number "${invoiceNumber}" is already in use.`,
          );
        }
      } else {
        invoiceNumber = await getUniqueInvoiceNumber(tx);
      }

      await tx
        .update(orders)
        .set({
          subtotalCents: netCents,
          taxCents,
          totalCents,
        })
        .where(eq(orders.id, orderId));

      const insertResult = await tx
        .insert(invoices)
        .values({
          orderId,
          invoiceNo: invoiceNumber,
          totalCents,
          taxCents,
        })
        .execute();

      const invoiceId = insertResult.insertId;
      if (!invoiceId) {
        throw new HttpError(
          500,
          'InvoiceCreationFailed',
          'The invoice could not be created due to an unexpected error.',
        );
      }

      const [invoiceRecord] = await tx
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

      return {
        invoice: invoiceRecord,
        invoiceNumber,
      };
    });

    res.status(201).json({
      data: {
        invoice: result.invoice,
        totals: {
          totalCents,
          netCents,
          taxCents,
        },
        order: {
          id: orderRecord.id,
          branchId: orderRecord.branchId,
          status: orderRecord.status,
        },
        items: enrichedItems,
      },
      meta: {
        created: true,
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

export default invoicesRouter;
