import { Router } from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../db/connection.js';
import {
  creditNoteLedger,
  creditNotes,
  invoices,
  orderItems,
  orders,
  productCodeVersions,
  salesReturnItems,
  salesReturns,
  stockLedger,
} from '../db/schema.js';
import { toPositiveInteger } from '../utils/validation.js';

const refundsRouter = Router();

const ALLOWED_CONDITIONS = new Set(['new', 'used', 'damaged']);
const ALLOWED_METHODS = new Set(['cash', 'store_credit']);

class HttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

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

const normalizeReason = (raw) => {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCondition = (raw) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return 'used';
  }

  const normalized = raw.trim().toLowerCase();
  if (!ALLOWED_CONDITIONS.has(normalized)) {
    throw new HttpError(
      400,
      'InvalidCondition',
      `Condition must be one of: ${Array.from(ALLOWED_CONDITIONS).join(', ')}.`,
    );
  }

  return normalized;
};

const normalizeMethod = (raw) => {
  if (typeof raw !== 'string') {
    throw new HttpError(
      400,
      'InvalidRefundMethod',
      `Refund method must be one of: ${Array.from(ALLOWED_METHODS).join(', ')}.`,
    );
  }

  const normalized = raw.trim().toLowerCase();
  if (!ALLOWED_METHODS.has(normalized)) {
    throw new HttpError(
      400,
      'InvalidRefundMethod',
      `Refund method must be one of: ${Array.from(ALLOWED_METHODS).join(', ')}.`,
    );
  }

  return normalized;
};

const parseItemsInput = (itemsInput) => {
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
    throw new HttpError(400, 'MissingItems', 'At least one refund line must be provided.');
  }

  return itemsInput.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new HttpError(
        400,
        'InvalidItem',
        `Item at index ${index} must be an object with orderItemId, qty, and refundCents fields.`,
      );
    }

    const orderItemId =
      toPositiveInteger(item.orderItemId ?? item.order_item_id) ??
      toPositiveInteger(item.orderItemID);
    if (!orderItemId) {
      throw new HttpError(
        400,
        'InvalidOrderItemId',
        `Item at index ${index} is missing a valid "orderItemId".`,
      );
    }

    const qty = toPositiveInteger(item.qty);
    if (!qty) {
      throw new HttpError(
        400,
        'InvalidQuantity',
        `Item at index ${index} must specify a quantity greater than zero.`,
      );
    }

    const refundCents = toPositiveInteger(item.refundCents ?? item.refund_cents);
    if (!refundCents) {
      throw new HttpError(
        400,
        'InvalidRefundCents',
        `Item at index ${index} must specify a "refundCents" value greater than zero.`,
      );
    }

    return {
      index,
      orderItemId,
      qty,
      refundCents,
    };
  });
};

refundsRouter.post('/', async (req, res, next) => {
  try {
    const {
      invoiceNo: invoiceNoInput,
      reason: reasonInput,
      condition: conditionInput,
      refundMethod: refundMethodInput,
      items: itemsInput,
    } = req.body ?? {};

    const invoiceNo = normalizeInvoiceNo(invoiceNoInput ?? '');
    if (!invoiceNo) {
      return res.status(400).json({
        error: 'InvalidInvoiceNumber',
        message: 'The "invoiceNo" field is required and must be a non-empty string.',
      });
    }

    const condition = normalizeCondition(conditionInput);
    const refundMethod = normalizeMethod(refundMethodInput);
    const reason = normalizeReason(reasonInput);
    const normalizedItems = parseItemsInput(itemsInput);

    const result = await db.transaction(async (tx) => {
      const [invoiceRow] = await tx
        .select({
          invoiceId: invoices.id,
          invoiceNo: invoices.invoiceNo,
          orderId: invoices.orderId,
          totalCents: invoices.totalCents,
          taxCents: invoices.taxCents,
          createdAt: invoices.createdAt,
          orderNumber: orders.orderNumber,
          orderStatus: orders.status,
          branchId: orders.branchId,
          userId: orders.userId,
          customerId: orders.customerId,
        })
        .from(invoices)
        .innerJoin(orders, eq(orders.id, invoices.orderId))
        .where(eq(invoices.invoiceNo, invoiceNo))
        .limit(1);

      if (!invoiceRow) {
        throw new HttpError(404, 'InvoiceNotFound', 'No invoice exists for the provided number.');
      }

      const orderItemIds = [...new Set(normalizedItems.map((item) => item.orderItemId))];

      const orderLineItems = await tx
        .select({
          id: orderItems.id,
          qty: orderItems.qty,
          totalCents: orderItems.totalCents,
          productCodeVersionId: orderItems.productCodeVersionId,
        })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, invoiceRow.orderId),
            inArray(orderItems.id, orderItemIds),
          ),
        );

      if (orderLineItems.length !== orderItemIds.length) {
        throw new HttpError(
          404,
          'OrderItemNotFound',
          'One or more items do not belong to the invoice order.',
        );
      }

      const orderItemMap = new Map(orderLineItems.map((item) => [item.id, item]));

      let existingRefundRows = [];
      if (orderItemIds.length > 0) {
        existingRefundRows = await tx
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

      const alreadyRefundedMap = new Map(
        existingRefundRows.map((row) => [row.orderItemId, {
          qty: Number.isFinite(row.refundedQty) ? row.refundedQty : 0,
          cents: Number.isFinite(row.refundedCents) ? row.refundedCents : 0,
        }]),
      );

      const itemsToInsert = [];
      const responseLines = [];
      let totalRefundBigInt = 0n;

      for (const item of normalizedItems) {
        const orderItem = orderItemMap.get(item.orderItemId);
        const alreadyRefunded = alreadyRefundedMap.get(item.orderItemId) ?? { qty: 0, cents: 0 };

        if (!orderItem) {
          throw new HttpError(
            404,
            'OrderItemNotFound',
            `Item at index ${item.index} is not associated with the invoice order.`,
          );
        }

        if (item.qty + alreadyRefunded.qty > orderItem.qty) {
          throw new HttpError(
            400,
            'QuantityExceeded',
            `Item at index ${item.index} exceeds the remaining refundable quantity.`,
          );
        }

        const remainingCents = Math.max(orderItem.totalCents - alreadyRefunded.cents, 0);
        if (item.refundCents > remainingCents) {
          throw new HttpError(
            400,
            'RefundAmountExceeded',
            `Item at index ${item.index} exceeds the remaining refundable amount.`,
          );
        }

        totalRefundBigInt += BigInt(item.refundCents);

        itemsToInsert.push({
          salesReturnId: 0, // placeholder, updated after creating the return
          orderItemId: item.orderItemId,
          productCodeVersionId: orderItem.productCodeVersionId,
          qty: item.qty,
          refundCents: item.refundCents,
        });

        responseLines.push({
          orderItemId: item.orderItemId,
          qty: item.qty,
          refundCents: item.refundCents,
          remainingQty: orderItem.qty - (alreadyRefunded.qty + item.qty),
          remainingCents: remainingCents - item.refundCents,
        });
      }

      if (totalRefundBigInt <= 0n) {
        throw new HttpError(
          400,
          'RefundAmountRequired',
          'The total refund amount must be greater than zero.',
        );
      }

      if (totalRefundBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new HttpError(
          400,
          'RefundAmountTooLarge',
          'The refund amount exceeds the supported monetary range.',
        );
      }

      const totalRefundCents = Number(totalRefundBigInt);

      const insertResult = await tx
        .insert(salesReturns)
        .values({
          invoiceId: invoiceRow.invoiceId,
          reason,
          condition,
          refundMethod,
          totalRefundCents,
        })
        .execute();

      const salesReturnId = insertResult.insertId;
      if (!salesReturnId) {
        throw new HttpError(500, 'SalesReturnCreationFailed', 'Unable to record the sales return.');
      }

      await tx
        .insert(salesReturnItems)
        .values(
          itemsToInsert.map((item) => ({
            ...item,
            salesReturnId,
          })),
        )
        .execute();

      let restocked = [];
      if (condition === 'new' || condition === 'used') {
        restocked = itemsToInsert.map((item) => ({
          productCodeVersionId: item.productCodeVersionId,
          qty: item.qty,
        }));

        for (const item of itemsToInsert) {
          await tx
            .update(productCodeVersions)
            .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${item.qty}` })
            .where(eq(productCodeVersions.id, item.productCodeVersionId));
        }

        if (restocked.length > 0) {
          await tx
            .insert(stockLedger)
            .values(
              restocked.map((entry) => ({
                productCodeVersionId: entry.productCodeVersionId,
                reason: 'return',
                qtyChange: entry.qty,
                referenceId: salesReturnId,
                referenceType: 'sales_return',
                notes: condition === 'new' ? 'Returned in new condition' : 'Returned in used condition',
              })),
            )
            .execute();
        }
      }

      let creditNote = null;
      if (refundMethod === 'store_credit') {
        if (!invoiceRow.customerId) {
          throw new HttpError(
            400,
            'CustomerRequired',
            'Store credit refunds require the order to be associated with a customer.',
          );
        }

        const creditReason = reason ?? `Refund for invoice ${invoiceRow.invoiceNo}`;
        const creditInsert = await tx
          .insert(creditNotes)
          .values({
            customerId: invoiceRow.customerId,
            balanceCents: totalRefundCents,
            reason: creditReason,
          })
          .execute();

        const creditNoteId = creditInsert.insertId;
        if (!creditNoteId) {
          throw new HttpError(500, 'CreditNoteCreationFailed', 'Unable to create the credit note.');
        }

        await tx
          .insert(creditNoteLedger)
          .values({
            creditNoteId,
            deltaCents: totalRefundCents,
            refTable: 'sales_return',
            refId: salesReturnId,
          })
          .execute();

        const [creditRecord] = await tx
          .select({
            id: creditNotes.id,
            customerId: creditNotes.customerId,
            balanceCents: creditNotes.balanceCents,
            reason: creditNotes.reason,
            createdAt: creditNotes.createdAt,
          })
          .from(creditNotes)
          .where(eq(creditNotes.id, creditNoteId))
          .limit(1);

        creditNote = creditRecord;
      }

      const [salesReturnRecord] = await tx
        .select({
          id: salesReturns.id,
          invoiceId: salesReturns.invoiceId,
          condition: salesReturns.condition,
          refundMethod: salesReturns.refundMethod,
          totalRefundCents: salesReturns.totalRefundCents,
          createdAt: salesReturns.createdAt,
          reason: salesReturns.reason,
        })
        .from(salesReturns)
        .where(eq(salesReturns.id, salesReturnId))
        .limit(1);

      return {
        salesReturn: salesReturnRecord,
        lines: responseLines,
        restocked,
        creditNote,
      };
    });

    res.status(201).json({
      data: {
        salesReturn: result.salesReturn,
        lines: result.lines,
        restocked: result.restocked,
        creditNote: result.creditNote,
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

export default refundsRouter;
