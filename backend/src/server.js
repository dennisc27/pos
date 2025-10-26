import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB, closeConnection, db } from './db/connection.js';
import {
  creditNoteLedger,
  creditNotes,
  giftCardLedger,
  giftCards,
  invoices,
  orderItems,
  orders,
  payments,
  productCodes,
  productCodeVersions,
  stockLedger,
} from './db/schema.js';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'POS System API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});

app.get('/api/products', async (req, res, next) => {
  try {
    const search = (req.query.q || '').toString().trim();

    if (!search) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const likeQuery = `%${search}%`;

    const products = await db
      .select({
        id: productCodes.id,
        code: productCodes.code,
        name: productCodes.name,
        sku: productCodes.sku,
        branchId: productCodeVersions.branchId,
        priceCents: productCodeVersions.priceCents,
        qtyOnHand: productCodeVersions.qtyOnHand,
        qtyReserved: productCodeVersions.qtyReserved,
      })
      .from(productCodes)
      .leftJoin(
        productCodeVersions,
        eq(productCodeVersions.productCodeId, productCodes.id)
      )
      .where(
        or(
          like(productCodes.name, likeQuery),
          like(productCodes.code, likeQuery),
          like(productCodes.sku, likeQuery)
        )
      )
      .limit(20);

    res.json({ results: products });
  } catch (error) {
    next(error);
  }
});

app.post('/api/cart/price-override', async (req, res) => {
  const { lineItemId, overridePriceCents, reason, managerPin } = req.body ?? {};

  if (!lineItemId) {
    return res.status(400).json({ error: 'lineItemId is required' });
  }

  if (
    typeof overridePriceCents !== 'number' ||
    Number.isNaN(overridePriceCents) ||
    overridePriceCents <= 0
  ) {
    return res.status(400).json({ error: 'overridePriceCents must be a positive number' });
  }

  if (!managerPin) {
    return res.status(400).json({ error: 'managerPin is required for overrides' });
  }

  const configuredPin = process.env.MANAGER_OVERRIDE_PIN || '1234';

  if (managerPin !== configuredPin) {
    return res.status(403).json({ error: 'Manager approval failed' });
  }

  res.json({
    approved: true,
    lineItemId,
    overridePriceCents,
    reason: reason ?? null,
    approvedAt: new Date().toISOString(),
  });
});

app.post('/api/orders/validate', (req, res) => {
  const { items = [], taxRate = 0.18 } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one line item is required' });
  }

  try {
    const normalizedItems = items.map((item, index) => {
      const qty = Number(item?.qty);
      const unitPriceCents = Number(item?.unitPriceCents);

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`items[${index}].qty must be greater than 0`);
      }

      if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
        throw new Error(`items[${index}].unitPriceCents must be greater than 0`);
      }

      const totalCents = Math.round(qty * unitPriceCents);

      return { qty, unitPriceCents, totalCents };
    });

    const subtotalCents = normalizedItems.reduce((sum, item) => sum + item.totalCents, 0);
    const taxPercent = Number(taxRate) || 0;
    const taxCents = Math.round(subtotalCents * taxPercent);
    const totalCents = subtotalCents + taxCents;

    res.json({ subtotalCents, taxCents, totalCents });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('items[')) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Validation error:', error);
    res.status(500).json({ error: 'Failed to validate order totals' });
  }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const { branchId, userId, customerId = null, items = [], taxRate = 0.18 } = req.body ?? {};

    if (!branchId || !userId) {
      return res.status(400).json({ error: 'branchId and userId are required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }

    const normalizedItems = items.map((item, index) => {
      const { productCodeVersionId, qty, unitPriceCents } = item ?? {};

      if (!productCodeVersionId) {
        throw new Error(`items[${index}].productCodeVersionId is required`);
      }

      const quantity = Number(qty);
      const priceCents = Number(unitPriceCents);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`items[${index}].qty must be greater than 0`);
      }

      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        throw new Error(`items[${index}].unitPriceCents must be greater than 0`);
      }

      const lineTotal = Math.round(quantity * priceCents);

      return {
        productCodeVersionId,
        qty: quantity,
        unitPriceCents: priceCents,
        totalCents: lineTotal,
      };
    });

    const subtotalCents = normalizedItems.reduce((sum, item) => sum + item.totalCents, 0);
    const taxPercent = Number(taxRate) || 0;
    const taxCents = Math.round(subtotalCents * taxPercent);
    const totalCents = subtotalCents + taxCents;
    const orderNumber = `ORD-${Date.now()}`;

    const createdOrder = await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        branchId,
        userId,
        customerId,
        orderNumber,
        status: 'pending',
        subtotalCents,
        taxCents,
        totalCents,
      });

      const [orderRow] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.orderNumber, orderNumber), eq(orders.branchId, branchId)))
        .limit(1);

      if (!orderRow) {
        throw new Error('Failed to retrieve created order');
      }

      const orderId = orderRow.id;

      for (const item of normalizedItems) {
        await tx.insert(orderItems).values({
          orderId,
          productCodeVersionId: item.productCodeVersionId,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
        });
      }

      return {
        id: orderId,
        orderNumber,
        branchId,
        userId,
        customerId,
        status: 'pending',
        subtotalCents,
        taxCents,
        totalCents,
        items: normalizedItems,
      };
    });

    res.status(201).json(createdOrder);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('items[')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

app.post('/api/invoices', async (req, res, next) => {
  try {
    const { orderId, invoiceNo: requestedInvoiceNo = null, taxRate = null } = req.body ?? {};

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const [order] = await db
      .select({
        id: orders.id,
        subtotalCents: orders.subtotalCents,
        taxCents: orders.taxCents,
        totalCents: orders.totalCents,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const lineItems = await db
      .select({
        id: orderItems.id,
        totalCents: orderItems.totalCents,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'Order has no items' });
    }

    const subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);
    const computedTaxRate = taxRate === null ? null : Number(taxRate);
    const taxCents = computedTaxRate !== null && Number.isFinite(computedTaxRate)
      ? Math.round(subtotalCents * computedTaxRate)
      : order.taxCents;
    const totalCents = subtotalCents + taxCents;
    const invoiceNo = requestedInvoiceNo || `INV-${Date.now()}`;

    const createdInvoice = await db.transaction(async (tx) => {
      await tx.insert(invoices).values({
        orderId,
        invoiceNo,
        totalCents,
        taxCents,
      });

      await tx
        .update(orders)
        .set({ subtotalCents, taxCents, totalCents, status: 'completed' })
        .where(eq(orders.id, orderId));

      const [invoiceRow] = await tx
        .select({
          id: invoices.id,
          invoiceNo: invoices.invoiceNo,
          totalCents: invoices.totalCents,
          taxCents: invoices.taxCents,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .where(and(eq(invoices.orderId, orderId), eq(invoices.invoiceNo, invoiceNo)))
        .limit(1);

      if (!invoiceRow) {
        throw new Error('Failed to retrieve created invoice');
      }

      return invoiceRow;
    });

    res.status(201).json({
      ...createdInvoice,
      orderId,
      subtotalCents,
      totalCents,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments', async (req, res, next) => {
  try {
    const {
      invoiceId = null,
      orderId = null,
      shiftId = null,
      method,
      amountCents,
      meta = null,
    } = req.body ?? {};

    if (!invoiceId && !orderId) {
      return res.status(400).json({ error: 'invoiceId or orderId is required' });
    }

    if (!method) {
      return res.status(400).json({ error: 'method is required' });
    }

    const validMethods = new Set(['cash', 'card', 'transfer', 'gift_card', 'credit_note']);
    if (!validMethods.has(method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const normalizedAmount = Number(amountCents);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ error: 'amountCents must be a positive number' });
    }

    if (invoiceId) {
      const [invoice] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
    }

    if (orderId) {
      const [order] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
    }

    const paymentMeta = meta && typeof meta === 'object' ? meta : null;

    if (method === 'gift_card' && !(paymentMeta?.giftCardId)) {
      return res.status(400).json({ error: 'giftCardId is required in meta for gift card payments' });
    }

    if (method === 'credit_note' && !(paymentMeta?.creditNoteId)) {
      return res.status(400).json({ error: 'creditNoteId is required in meta for credit note payments' });
    }

    const createdPayment = await db.transaction(async (tx) => {
      if (method === 'gift_card') {
        const [card] = await tx
          .select({ id: giftCards.id, balanceCents: giftCards.balanceCents })
          .from(giftCards)
          .where(eq(giftCards.id, paymentMeta.giftCardId))
          .limit(1);

        if (!card) {
          throw new Error('GIFT_CARD_NOT_FOUND');
        }

        if (Number(card.balanceCents) < normalizedAmount) {
          throw new Error('GIFT_CARD_INSUFFICIENT');
        }
      }

      if (method === 'credit_note') {
        const [note] = await tx
          .select({ id: creditNotes.id, balanceCents: creditNotes.balanceCents })
          .from(creditNotes)
          .where(eq(creditNotes.id, paymentMeta.creditNoteId))
          .limit(1);

        if (!note) {
          throw new Error('CREDIT_NOTE_NOT_FOUND');
        }

        if (Number(note.balanceCents) < normalizedAmount) {
          throw new Error('CREDIT_NOTE_INSUFFICIENT');
        }
      }

      await tx.insert(payments).values({
        invoiceId,
        orderId,
        shiftId,
        method,
        amountCents: normalizedAmount,
        meta: paymentMeta,
      });

      const [paymentRow] = await tx
        .select({
          id: payments.id,
          invoiceId: payments.invoiceId,
          orderId: payments.orderId,
          shiftId: payments.shiftId,
          method: payments.method,
          amountCents: payments.amountCents,
          meta: payments.meta,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .orderBy(desc(payments.id))
        .limit(1);

      if (!paymentRow) {
        throw new Error('Failed to retrieve created payment');
      }

      if (method === 'gift_card') {
        await tx.insert(giftCardLedger).values({
          giftCardId: paymentMeta.giftCardId,
          deltaCents: -normalizedAmount,
          refTable: 'payments',
          refId: paymentRow.id,
        });

        await tx
          .update(giftCards)
          .set({ balanceCents: sql`${giftCards.balanceCents} - ${normalizedAmount}` })
          .where(eq(giftCards.id, paymentMeta.giftCardId));
      }

      if (method === 'credit_note') {
        await tx.insert(creditNoteLedger).values({
          creditNoteId: paymentMeta.creditNoteId,
          deltaCents: -normalizedAmount,
          refTable: 'payments',
          refId: paymentRow.id,
        });

        await tx
          .update(creditNotes)
          .set({ balanceCents: sql`${creditNotes.balanceCents} - ${normalizedAmount}` })
          .where(eq(creditNotes.id, paymentMeta.creditNoteId));
      }

      if (invoiceId) {
        const [invoiceRow] = await tx
          .select({ id: invoices.id, totalCents: invoices.totalCents, orderId: invoices.orderId })
          .from(invoices)
          .where(eq(invoices.id, invoiceId))
          .limit(1);

        if (invoiceRow) {
          const [paidRow] = await tx
            .select({ totalPaid: sql`COALESCE(SUM(${payments.amountCents}), 0)` })
            .from(payments)
            .where(eq(payments.invoiceId, invoiceId));

          const [ledgerRow] = await tx
            .select({ existingCount: sql`COUNT(*)` })
            .from(stockLedger)
            .where(and(eq(stockLedger.referenceId, invoiceId), eq(stockLedger.referenceType, 'invoice')));

          const paidAmount = paidRow ? Number(paidRow.totalPaid ?? 0) : 0;
          const alreadyLedgered = ledgerRow ? Number(ledgerRow.existingCount ?? 0) > 0 : false;

          if (!alreadyLedgered && paidAmount >= Number(invoiceRow.totalCents)) {
            const itemsForOrder = await tx
              .select({
                productCodeVersionId: orderItems.productCodeVersionId,
                qty: orderItems.qty,
              })
              .from(orderItems)
              .where(eq(orderItems.orderId, invoiceRow.orderId));

            for (const item of itemsForOrder) {
              const qtyChange = -Math.abs(Number(item.qty));

              await tx.insert(stockLedger).values({
                productCodeVersionId: item.productCodeVersionId,
                reason: 'sale',
                qtyChange,
                referenceId: invoiceRow.id,
                referenceType: 'invoice',
                notes: 'Auto ledger entry on invoice payment',
              });

              await tx
                .update(productCodeVersions)
                .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${qtyChange}` })
                .where(eq(productCodeVersions.id, item.productCodeVersionId));
            }
          }
        }
      }

      return paymentRow;
    });

    res.status(201).json(createdPayment);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'GIFT_CARD_NOT_FOUND') {
        return res.status(404).json({ error: 'Gift card not found' });
      }

      if (error.message === 'GIFT_CARD_INSUFFICIENT') {
        return res.status(400).json({ error: 'Gift card has insufficient balance' });
      }

      if (error.message === 'CREDIT_NOTE_NOT_FOUND') {
        return res.status(404).json({ error: 'Credit note not found' });
      }

      if (error.message === 'CREDIT_NOTE_INSUFFICIENT') {
        return res.status(400).json({ error: 'Credit note has insufficient balance' });
      }
    }

    next(error);
  }
});

app.post('/api/receipts/:invoiceId/print', async (req, res, next) => {
  try {
    const invoiceId = Number(req.params.invoiceId);

    if (!Number.isFinite(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoiceId' });
    }

    const [invoice] = await db
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      status: 'queued',
      message: 'Receipt print job queued for ESC/POS printer',
      queuedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  await closeConnection();
  process.exit(0);
});

startServer();
