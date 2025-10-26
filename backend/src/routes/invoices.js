import { Router } from 'express';
import crypto from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../db/connection.js';
import {
  invoices,
  orderItems,
  orders,
  productCodeVersions,
  productCodes,
  salesReturnItems,
  salesReturns,
} from '../db/schema.js';
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

const normalizeInvoiceNo = (raw) => {
  if (typeof raw !== 'string') {
    return '';
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.toUpperCase();
};

invoicesRouter.get('/:invoiceNo', async (req, res, next) => {
  try {
    const rawInvoiceNo = req.params.invoiceNo ?? '';
    const invoiceNo = normalizeInvoiceNo(rawInvoiceNo);

    if (!invoiceNo) {
      return res.status(400).json({
        error: 'InvalidInvoiceNumber',
        message: 'A valid invoice number must be provided in the path.',
      });
    }

    const [invoiceRow] = await db
      .select({
        invoiceId: invoices.id,
        invoiceNo: invoices.invoiceNo,
        invoiceCreatedAt: invoices.createdAt,
        orderId: invoices.orderId,
        totalCents: invoices.totalCents,
        taxCents: invoices.taxCents,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        branchId: orders.branchId,
        userId: orders.userId,
        customerId: orders.customerId,
        orderSubtotalCents: orders.subtotalCents,
      })
      .from(invoices)
      .innerJoin(orders, eq(orders.id, invoices.orderId))
      .where(eq(invoices.invoiceNo, invoiceNo))
      .limit(1);

    if (!invoiceRow) {
      return res.status(404).json({
        error: 'InvoiceNotFound',
        message: 'No invoice exists for the provided number.',
      });
    }

    const orderLineItems = await db
      .select({
        id: orderItems.id,
        qty: orderItems.qty,
        unitPriceCents: orderItems.unitPriceCents,
        totalCents: orderItems.totalCents,
        productCodeVersionId: orderItems.productCodeVersionId,
        productCodeId: productCodeVersions.productCodeId,
        productCode: productCodes.code,
        productName: productCodes.name,
        productSku: productCodes.sku,
      })
      .from(orderItems)
      .innerJoin(productCodeVersions, eq(productCodeVersions.id, orderItems.productCodeVersionId))
      .innerJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
      .where(eq(orderItems.orderId, invoiceRow.orderId));

    if (orderLineItems.length === 0) {
      return res.status(409).json({
        error: 'InvoiceHasNoItems',
        message: 'The invoice does not have any items to return.',
      });
    }

    const orderItemIds = orderLineItems.map((item) => item.id);

    let refundedTotals = [];
    if (orderItemIds.length > 0) {
      refundedTotals = await db
        .select({
          orderItemId: salesReturnItems.orderItemId,
          refundedQty: sql`COALESCE(SUM(${salesReturnItems.qty}), 0)`.mapWith(Number),
          refundedCents: sql`COALESCE(SUM(${salesReturnItems.refundCents}), 0)`.mapWith(Number),
        })
        .from(salesReturnItems)
        .innerJoin(salesReturns, eq(salesReturns.id, salesReturnItems.salesReturnId))
        .where(
          and(
            eq(salesReturns.invoiceId, invoiceRow.invoiceId),
            inArray(salesReturnItems.orderItemId, orderItemIds),
          ),
        )
        .groupBy(salesReturnItems.orderItemId);
    }

    const refundedMap = new Map();
    let refundedTotalCents = 0;
    for (const row of refundedTotals) {
      const safeQty = Number.isFinite(row.refundedQty) ? row.refundedQty : 0;
      const safeCents = Number.isFinite(row.refundedCents) ? row.refundedCents : 0;
      refundedMap.set(row.orderItemId, {
        qty: safeQty,
        cents: safeCents,
      });
      refundedTotalCents += safeCents;
    }

    const items = orderLineItems.map((item) => {
      const refunded = refundedMap.get(item.id) ?? { qty: 0, cents: 0 };
      const refundableQty = Math.max(item.qty - refunded.qty, 0);
      const refundableCents = Math.max(item.totalCents - refunded.cents, 0);

      return {
        id: item.id,
        qty: item.qty,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.totalCents,
        product: {
          codeId: item.productCodeId,
          code: item.productCode,
          name: item.productName,
          sku: item.productSku,
          versionId: item.productCodeVersionId,
        },
        refunded: {
          qty: refunded.qty,
          cents: refunded.cents,
        },
        refundable: {
          qty: refundableQty,
          cents: refundableCents,
        },
      };
    });

    const responseInvoice = {
      id: invoiceRow.invoiceId,
      invoiceNo: invoiceRow.invoiceNo,
      totalCents: invoiceRow.totalCents,
      taxCents: invoiceRow.taxCents,
      createdAt: invoiceRow.invoiceCreatedAt,
    };

    const responseOrder = {
      id: invoiceRow.orderId,
      orderNumber: invoiceRow.orderNumber,
      status: invoiceRow.orderStatus,
      branchId: invoiceRow.branchId,
      userId: invoiceRow.userId,
      customerId: invoiceRow.customerId,
      subtotalCents: invoiceRow.orderSubtotalCents,
      taxCents: invoiceRow.taxCents,
      totalCents: invoiceRow.totalCents,
    };

    res.json({
      data: {
        invoice: responseInvoice,
        order: responseOrder,
        items,
        totals: {
          refundableCents: Math.max(invoiceRow.totalCents - refundedTotalCents, 0),
          refundedCents: refundedTotalCents,
        },
      },
      meta: {
        found: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

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
