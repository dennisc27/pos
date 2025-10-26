import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../db/connection.js';
import {
  creditNoteLedger,
  creditNotes,
  giftCardLedger,
  giftCards,
  invoices,
  orderItems,
  orders,
  payments,
  stockLedger,
} from '../db/schema.js';
import { toPositiveInteger } from '../utils/validation.js';

const paymentsRouter = Router();
const ALLOWED_METHODS = new Set(['cash', 'card', 'transfer', 'gift_card', 'credit_note']);

class HttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

paymentsRouter.post('/', async (req, res, next) => {
  try {
    const {
      orderId: orderIdInput,
      invoiceId: invoiceIdInput,
      shiftId: shiftIdInput,
      method,
      amountCents: amountInput,
      meta,
    } = req.body ?? {};

    let orderId = null;
    if (orderIdInput !== undefined && orderIdInput !== null) {
      orderId = toPositiveInteger(orderIdInput);
      if (orderId === null) {
        return res.status(400).json({
          error: 'InvalidOrderId',
          message: 'When provided, "orderId" must be a positive integer.',
        });
      }
    }

    let invoiceId = null;
    if (invoiceIdInput !== undefined && invoiceIdInput !== null) {
      invoiceId = toPositiveInteger(invoiceIdInput);
      if (invoiceId === null) {
        return res.status(400).json({
          error: 'InvalidInvoiceId',
          message: 'When provided, "invoiceId" must be a positive integer.',
        });
      }
    }

    if (!orderId && !invoiceId) {
      return res.status(400).json({
        error: 'MissingTarget',
        message: 'A payment must reference at least an orderId or an invoiceId.',
      });
    }

    let shiftId = null;
    if (shiftIdInput !== undefined && shiftIdInput !== null) {
      shiftId = toPositiveInteger(shiftIdInput);
      if (shiftId === null) {
        return res.status(400).json({
          error: 'InvalidShiftId',
          message: 'When provided, "shiftId" must be a positive integer.',
        });
      }
    }

    if (typeof method !== 'string') {
      return res.status(400).json({
        error: 'InvalidMethod',
        message: `Payment "method" must be one of: ${Array.from(ALLOWED_METHODS).join(', ')}.`,
      });
    }

    const methodNormalized = method.trim().toLowerCase();
    if (!ALLOWED_METHODS.has(methodNormalized)) {
      return res.status(400).json({
        error: 'InvalidMethod',
        message: `Payment "method" must be one of: ${Array.from(ALLOWED_METHODS).join(', ')}.`,
      });
    }

    const amountCents = toPositiveInteger(amountInput);
    if (!amountCents) {
      return res.status(400).json({
        error: 'InvalidAmount',
        message: 'The "amountCents" field must be a positive integer.',
      });
    }

    let normalizedMeta = {};
    if (meta !== undefined && meta !== null) {
      if (typeof meta !== 'object' || Array.isArray(meta)) {
        return res.status(400).json({
          error: 'InvalidMeta',
          message: 'When provided, "meta" must be a JSON object.',
        });
      }
      normalizedMeta = { ...meta };
    }

    let giftCardId = null;
    let creditNoteId = null;

    if (methodNormalized === 'gift_card') {
      const metaGiftCardId = normalizedMeta.giftCardId ?? normalizedMeta.gift_card_id;
      giftCardId = toPositiveInteger(metaGiftCardId);
      if (!giftCardId) {
        return res.status(400).json({
          error: 'MissingGiftCardId',
          message: 'Payments with method "gift_card" must include a "giftCardId" in the meta payload.',
        });
      }
      normalizedMeta.giftCardId = giftCardId;
      delete normalizedMeta.gift_card_id;
    }

    if (methodNormalized === 'credit_note') {
      const metaCreditNoteId = normalizedMeta.creditNoteId ?? normalizedMeta.credit_note_id;
      creditNoteId = toPositiveInteger(metaCreditNoteId);
      if (!creditNoteId) {
        return res.status(400).json({
          error: 'MissingCreditNoteId',
          message: 'Payments with method "credit_note" must include a "creditNoteId" in the meta payload.',
        });
      }
      normalizedMeta.creditNoteId = creditNoteId;
      delete normalizedMeta.credit_note_id;
    }

    const metaToStore = Object.keys(normalizedMeta).length > 0 ? normalizedMeta : null;

    const result = await db.transaction(async (tx) => {
      let resolvedOrderId = orderId;
      let resolvedInvoice = null;

      if (invoiceId) {
        const [invoiceRecord] = await tx
          .select({
            id: invoices.id,
            orderId: invoices.orderId,
            totalCents: invoices.totalCents,
            taxCents: invoices.taxCents,
          })
          .from(invoices)
          .where(eq(invoices.id, invoiceId))
          .limit(1);

        if (!invoiceRecord) {
          throw new HttpError(404, 'InvoiceNotFound', 'The specified invoice does not exist.');
        }

        resolvedInvoice = invoiceRecord;
        resolvedOrderId = invoiceRecord.orderId;
      }

      if (resolvedOrderId) {
        const [orderRecord] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.id, resolvedOrderId))
          .limit(1);

        if (!orderRecord) {
          throw new HttpError(404, 'OrderNotFound', 'The specified order does not exist.');
        }
      }

      if (orderId && resolvedOrderId && orderId !== resolvedOrderId) {
        throw new HttpError(
          400,
          'OrderInvoiceMismatch',
          'The provided orderId does not match the invoice order.',
        );
      }

      let giftCardAdjustment = null;
      if (methodNormalized === 'gift_card' && giftCardId) {
        const [giftCard] = await tx
          .select({ id: giftCards.id, balanceCents: giftCards.balanceCents })
          .from(giftCards)
          .where(eq(giftCards.id, giftCardId))
          .limit(1);

        if (!giftCard) {
          throw new HttpError(404, 'GiftCardNotFound', 'The referenced gift card does not exist.');
        }

        if (giftCard.balanceCents < amountCents) {
          throw new HttpError(400, 'GiftCardInsufficientBalance', 'The gift card does not have enough balance.');
        }

        const updatedBalance = giftCard.balanceCents - amountCents;

        await tx
          .update(giftCards)
          .set({ balanceCents: updatedBalance })
          .where(eq(giftCards.id, giftCardId));

        await tx
          .insert(giftCardLedger)
          .values({
            giftCardId,
            deltaCents: -amountCents,
            refTable: invoiceId ? 'invoice' : 'order',
            refId: invoiceId ?? resolvedOrderId,
          })
          .execute();

        giftCardAdjustment = {
          giftCardId,
          balanceCents: updatedBalance,
        };
      }

      let creditNoteAdjustment = null;
      if (methodNormalized === 'credit_note' && creditNoteId) {
        const [creditNote] = await tx
          .select({ id: creditNotes.id, balanceCents: creditNotes.balanceCents })
          .from(creditNotes)
          .where(eq(creditNotes.id, creditNoteId))
          .limit(1);

        if (!creditNote) {
          throw new HttpError(404, 'CreditNoteNotFound', 'The referenced credit note does not exist.');
        }

        if (creditNote.balanceCents < amountCents) {
          throw new HttpError(400, 'CreditNoteInsufficientBalance', 'The credit note does not have enough balance.');
        }

        const updatedBalance = creditNote.balanceCents - amountCents;

        await tx
          .update(creditNotes)
          .set({ balanceCents: updatedBalance })
          .where(eq(creditNotes.id, creditNoteId));

        await tx
          .insert(creditNoteLedger)
          .values({
            creditNoteId,
            deltaCents: -amountCents,
            refTable: invoiceId ? 'invoice' : 'order',
            refId: invoiceId ?? resolvedOrderId,
          })
          .execute();

        creditNoteAdjustment = {
          creditNoteId,
          balanceCents: updatedBalance,
        };
      }

      const insertResult = await tx
        .insert(payments)
        .values({
          orderId: resolvedOrderId,
          invoiceId,
          shiftId,
          method: methodNormalized,
          amountCents,
          meta: metaToStore,
        })
        .execute();

      const paymentId = insertResult.insertId;
      if (!paymentId) {
        throw new HttpError(500, 'PaymentCreationFailed', 'Unable to record the payment.');
      }

      const [paymentRecord] = await tx
        .select({
          id: payments.id,
          orderId: payments.orderId,
          invoiceId: payments.invoiceId,
          shiftId: payments.shiftId,
          method: payments.method,
          amountCents: payments.amountCents,
          meta: payments.meta,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);

      let invoiceSummary = null;
      let stockPosted = false;

      if (invoiceId) {
        const paidAggregate = sql`COALESCE(SUM(${payments.amountCents}), 0)`;
        const [totals] = await tx
          .select({ paidCents: paidAggregate })
          .from(payments)
          .where(eq(payments.invoiceId, invoiceId));

        const paidCents = Number(totals?.paidCents ?? 0);
        const remainingCents = Math.max((resolvedInvoice?.totalCents ?? 0) - paidCents, 0);

        invoiceSummary = {
          invoiceId,
          totalCents: resolvedInvoice?.totalCents ?? null,
          paidCents,
          remainingCents,
        };

        if (resolvedInvoice && remainingCents === 0) {
          const [existingLedger] = await tx
            .select({ id: stockLedger.id })
            .from(stockLedger)
            .where(
              and(
                eq(stockLedger.referenceType, 'invoice'),
                eq(stockLedger.referenceId, invoiceId),
              ),
            )
            .limit(1);

          if (!existingLedger) {
            const saleItems = await tx
              .select({
                productCodeVersionId: orderItems.productCodeVersionId,
                qty: orderItems.qty,
              })
              .from(orderItems)
              .where(eq(orderItems.orderId, resolvedOrderId));

            if (saleItems.length > 0) {
              await tx
                .insert(stockLedger)
                .values(
                  saleItems.map((item) => ({
                    productCodeVersionId: item.productCodeVersionId,
                    reason: 'sale',
                    qtyChange: -Math.abs(item.qty),
                    referenceId: invoiceId,
                    referenceType: 'invoice',
                    notes: 'Invoice paid in full',
                  })),
                )
                .execute();
              stockPosted = true;
            }
          }
        }
      }

      let orderSummary = null;
      if (resolvedOrderId) {
        const paidAggregate = sql`COALESCE(SUM(${payments.amountCents}), 0)`;
        const [orderTotals] = await tx
          .select({ paidCents: paidAggregate })
          .from(payments)
          .where(eq(payments.orderId, resolvedOrderId));

        orderSummary = {
          orderId: resolvedOrderId,
          paidCents: Number(orderTotals?.paidCents ?? 0),
        };
      }

      return {
        payment: paymentRecord,
        invoiceSummary,
        orderSummary,
        ledger: {
          giftCard: giftCardAdjustment,
          creditNote: creditNoteAdjustment,
          stockPosted,
        },
      };
    });

    res.status(201).json({
      data: {
        payment: result.payment,
        invoice: result.invoiceSummary,
        order: result.orderSummary,
        ledger: result.ledger,
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

export default paymentsRouter;
