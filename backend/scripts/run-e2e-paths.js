import { sql } from 'drizzle-orm';
import { connectDB, closeConnection, db } from '../src/db/connection.js';
import {
  branches,
  users,
  orders,
  orderItems,
  invoices,
  payments,
  productCodeVersions,
  customers,
  productCodes,
  loanSchedules,
  loanPayments,
  loanForfeitures,
  loans,
  layaways,
  layawayPayments,
  stockLedger,
  interestModels,
} from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

function nowPlusDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function loadContext() {
  const [branch] = await db.select({ id: branches.id }).from(branches).limit(1);
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  const [customer] = await db.select({ id: customers.id }).from(customers).limit(1);
  const [interestModel] = await db.select({ id: interestModels.id }).from(interestModels).limit(1);
  const [productVersion] = await db
    .select({
      id: productCodeVersions.id,
      productCodeId: productCodeVersions.productCodeId,
    })
    .from(productCodeVersions)
    .limit(1);
  const [productCode] = await db
    .select({ id: productCodes.id })
    .from(productCodes)
    .where(eq(productCodes.id, productVersion?.productCodeId ?? 0))
    .limit(1);

  if (!branch || !user || !customer || !productVersion || !productCode || !interestModel) {
    throw new Error('Missing prerequisite data. Run the seed script first.');
  }

  return {
    branchId: Number(branch.id),
    userId: Number(user.id),
    customerId: Number(customer.id),
    productVersionId: Number(productVersion.id),
    productCodeId: Number(productCode.id),
    interestModelId: Number(interestModel.id),
  };
}

async function runPosFlows(tx, context) {
  const orderNumber = `E2E-SALE-${Date.now()}`;
  await tx.insert(orders).values({
    branchId: context.branchId,
    userId: context.userId,
    customerId: context.customerId,
    orderNumber,
    status: 'completed',
    subtotalCents: 450000,
    taxCents: 81000,
    totalCents: 531000,
  });

  const [order] = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  await tx.insert(orderItems).values({
    orderId: order.id,
    productCodeVersionId: context.productVersionId,
    qty: 1,
    unitPriceCents: 450000,
    totalCents: 450000,
  });

  const invoiceNo = `INV-${Date.now()}`;
  await tx.insert(invoices).values({
    orderId: order.id,
    invoiceNo,
    totalCents: 531000,
    taxCents: 81000,
  });

  const [invoice] = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.invoiceNo, invoiceNo))
    .limit(1);

  await tx.insert(payments).values({
    orderId: order.id,
    invoiceId: invoice.id,
    method: 'cash',
    amountCents: 531000,
  });

  await tx.insert(stockLedger).values({
    productCodeVersionId: context.productVersionId,
    reason: 'sale',
    qtyChange: -1,
    referenceId: invoice.id,
    referenceType: 'invoice',
    notes: 'E2E sale flow',
  });

  await tx
    .update(productCodeVersions)
    .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} - 1` })
    .where(eq(productCodeVersions.id, context.productVersionId));

  await tx.insert(stockLedger).values({
    productCodeVersionId: context.productVersionId,
    reason: 'return',
    qtyChange: 1,
    referenceId: invoice.id,
    referenceType: 'invoice',
    notes: 'E2E refund restock',
  });

  await tx
    .update(productCodeVersions)
    .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + 1` })
    .where(eq(productCodeVersions.id, context.productVersionId));

  return { orderId: Number(order.id), invoiceId: Number(invoice.id) };
}

async function runLoanFlows(tx, context) {
  const baseTicket = `LN-${Date.now()}`;
  const dueDate = nowPlusDays(30);

  await tx.insert(loans).values({
    branchId: context.branchId,
    customerId: context.customerId,
    ticketNumber: baseTicket,
    principalCents: 200000,
    interestModelId: context.interestModelId,
    interestRate: 0.1,
    dueDate,
    status: 'active',
    comments: 'E2E loan cycle',
  });

  const [loan] = await tx
    .select({ id: loans.id })
    .from(loans)
    .where(eq(loans.ticketNumber, baseTicket))
    .limit(1);

  await tx.insert(loanSchedules).values([
    { loanId: loan.id, dueOn: dueDate, interestCents: 20000, feeCents: 0 },
    { loanId: loan.id, dueOn: nowPlusDays(60), interestCents: 20000, feeCents: 0 },
  ]);

  await tx.insert(loanPayments).values({
    loanId: loan.id,
    kind: 'renew',
    amountCents: 20000,
    method: 'cash',
  });

  await tx
    .update(loans)
    .set({ status: 'renewed', dueDate: nowPlusDays(60) })
    .where(eq(loans.id, loan.id));

  await tx.insert(loanPayments).values({
    loanId: loan.id,
    kind: 'redeem',
    amountCents: 220000,
    method: 'cash',
  });

  await tx
    .update(loans)
    .set({ status: 'redeemed' })
    .where(eq(loans.id, loan.id));

  const forfeitTicket = `${baseTicket}-F`;
  await tx.insert(loans).values({
    branchId: context.branchId,
    customerId: context.customerId,
    ticketNumber: forfeitTicket,
    principalCents: 150000,
    interestModelId: context.interestModelId,
    interestRate: 0.1,
    dueDate,
    status: 'active',
    comments: 'E2E forfeit loan',
  });

  const [forfeitLoan] = await tx
    .select({ id: loans.id })
    .from(loans)
    .where(eq(loans.ticketNumber, forfeitTicket))
    .limit(1);

  await tx.insert(loanSchedules).values({
    loanId: forfeitLoan.id,
    dueOn: dueDate,
    interestCents: 15000,
    feeCents: 0,
  });

  await tx
    .update(loans)
    .set({ status: 'forfeited' })
    .where(eq(loans.id, forfeitLoan.id));

  await tx.insert(loanForfeitures).values({
    loanId: forfeitLoan.id,
    codeId: context.productCodeId,
  });

  await tx.insert(stockLedger).values({
    productCodeVersionId: context.productVersionId,
    reason: 'pawn_forfeit_in',
    qtyChange: 1,
    referenceId: forfeitLoan.id,
    referenceType: 'loan',
    notes: 'E2E pawn forfeit intake',
  });

  await tx
    .update(productCodeVersions)
    .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + 1` })
    .where(eq(productCodeVersions.id, context.productVersionId));

  return {
    renewedLoanId: Number(loan.id),
    forfeitedLoanId: Number(forfeitLoan.id),
  };
}

async function runLayawayFlow(tx, context, pawnLoanId) {
  const orderNumber = `LAY-${Date.now()}`;
  await tx.insert(orders).values({
    branchId: context.branchId,
    userId: context.userId,
    customerId: context.customerId,
    orderNumber,
    status: 'pending',
    subtotalCents: 120000,
    taxCents: 21600,
    totalCents: 141600,
  });

  const [order] = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  await tx.insert(orderItems).values({
    orderId: order.id,
    productCodeVersionId: context.productVersionId,
    qty: 1,
    unitPriceCents: 120000,
    totalCents: 120000,
  });

  await tx.insert(layaways).values({
    branchId: context.branchId,
    customerId: context.customerId,
    orderId: order.id,
    status: 'active',
    totalCents: 141600,
    paidCents: 30000,
    dueDate: nowPlusDays(45),
  });

  const [layaway] = await tx
    .select({ id: layaways.id })
    .from(layaways)
    .where(eq(layaways.orderId, order.id))
    .limit(1);

  await tx.insert(layawayPayments).values({
    layawayId: layaway.id,
    amountCents: 30000,
    method: 'cash',
    note: 'E2E initial payment',
  });

  await tx
    .update(layaways)
    .set({ paidCents: 30000, status: 'pawned', pawnLoanId: pawnLoanId ?? null, pawnedAt: new Date() })
    .where(eq(layaways.id, layaway.id));

  return { layawayId: Number(layaway.id) };
}

async function main() {
  await connectDB();

  try {
    const context = await loadContext();

    const summary = await db.transaction(async (tx) => {
      const sale = await runPosFlows(tx, context);
      const loansSummary = await runLoanFlows(tx, context);
      const layaway = await runLayawayFlow(tx, context, loansSummary.forfeitedLoanId);

      return {
        sale,
        loans: loansSummary,
        layaway,
      };
    });

    console.log('✅ E2E flows executed successfully');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error('❌ Failed to execute E2E flows:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

main();
