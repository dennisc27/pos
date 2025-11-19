import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { connectDB, closeConnection, db } from './db/connection.js';
import {
  branches,
  cashMovements,
  componentChildCodes,
  componentParentCodes,
  creditNoteLedger,
  creditNotes,
  giftCardLedger,
  giftCards,
  inventoryCountLines,
  inventoryCountSessions,
  inventoryQuarantines,
  inventoryTransferLines,
  inventoryTransfers,
  interestModels,
  invoices,
  idImages,
  idImageUploadTokens,
  instapawnIntakes,
  productCategories,
  loanCollateral,
  loanForfeitures,
  loanPayments,
  loanSchedules,
  notificationMessages,
  customerNotes,
  loyaltyLedger,
  reviews,
  marketingTemplates,
  marketingSegments,
  marketingCampaigns,
  marketingSends,
  ecomChannels,
  ecomChannelLogs,
  ecomWebhookLogs,
  ecomListings,
  ecomListingChannels,
  ecomOrders,
  ecomOrderItems,
  ecomReturns,
  ecomReturnItems,
  auditLogs,
  layawayPayments,
  layaways,
  loans,
  repairMaterials,
  repairPayments,
  repairPhotos,
  repairs,
  customers,
  orderItems,
  orders,
  payments,
  purchases,
  purchaseLines,
  purchaseReturnLines,
  purchaseReturns,
  products,
  productCodes,
  productCodeComponents,
  productCodeVersions,
  salesReturnItems,
  salesReturns,
  settings,
  shiftClosedByUsers,
  shiftOpenedByUsers,
  supplierCreditLedger,
  supplierCredits,
  shiftReports,
  shifts,
  stockLedger,
  users,
} from './db/schema.js';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  isNotNull,
  like,
  lt,
  lte,
  max,
  or,
  sql,
} from 'drizzle-orm';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const frontendBaseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const hexRegex = /^[0-9a-f]+$/i;

function normalizeStoredPinHash(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Uint8Array || value instanceof Buffer) {
    return Buffer.from(value).toString('hex');
  }

  if (typeof value === 'string') {
    if (hexRegex.test(value)) {
      return value.toLowerCase();
    }

    return Buffer.from(value, 'utf8').toString('hex');
  }

  return null;
}

function verifyPin(pin, storedHash) {
  if (!pin) {
    return false;
  }

  const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
  const normalizedStored = normalizeStoredPinHash(storedHash);

  if (normalizedStored) {
    if (hashedPin === normalizedStored) {
      return true;
    }
  }

  const fallbackPin = process.env.SHIFT_MANAGER_PIN || process.env.MANAGER_OVERRIDE_PIN || null;
  return fallbackPin ? pin === fallbackPin : false;
}

const shiftSelection = {
  id: shifts.id,
  branchId: shifts.branchId,
  openedBy: shifts.openedBy,
  closedBy: shifts.closedBy,
  openingCashCents: shifts.openingCashCents,
  closingCashCents: shifts.closingCashCents,
  expectedCashCents: shifts.expectedCashCents,
  overShortCents: shifts.overShortCents,
  openedAt: shifts.openedAt,
  closedAt: shifts.closedAt,
};

const cashMovementSelection = {
  id: cashMovements.id,
  shiftId: cashMovements.shiftId,
  kind: cashMovements.kind,
  amountCents: cashMovements.amountCents,
  reason: cashMovements.reason,
  createdAt: cashMovements.createdAt,
};

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfTomorrow(date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

const purchaseSelection = {
  id: purchases.id,
  branchId: purchases.branchId,
  supplierName: purchases.supplierName,
  supplierInvoice: purchases.supplierInvoice,
  referenceNo: purchases.referenceNo,
  receivedAt: purchases.receivedAt,
  createdBy: purchases.createdBy,
  totalCostCents: purchases.totalCostCents,
  totalQuantity: purchases.totalQuantity,
  labelLayout: purchases.labelLayout,
  labelIncludePrice: purchases.labelIncludePrice,
  labelCount: purchases.labelCount,
  labelNote: purchases.labelNote,
  notes: purchases.notes,
  createdAt: purchases.createdAt,
  updatedAt: purchases.updatedAt,
};

const purchaseReturnSelection = {
  id: purchaseReturns.id,
  purchaseId: purchaseReturns.purchaseId,
  branchId: purchaseReturns.branchId,
  supplierName: purchaseReturns.supplierName,
  supplierInvoice: purchaseReturns.supplierInvoice,
  reason: purchaseReturns.reason,
  notes: purchaseReturns.notes,
  createdBy: purchaseReturns.createdBy,
  totalQuantity: purchaseReturns.totalQuantity,
  totalCostCents: purchaseReturns.totalCostCents,
  createdAt: purchaseReturns.createdAt,
  updatedAt: purchaseReturns.updatedAt,
};

const supplierCreditSelection = {
  id: supplierCredits.id,
  branchId: supplierCredits.branchId,
  supplierName: supplierCredits.supplierName,
  supplierInvoice: supplierCredits.supplierInvoice,
  purchaseId: supplierCredits.purchaseId,
  purchaseReturnId: supplierCredits.purchaseReturnId,
  amountCents: supplierCredits.amountCents,
  balanceCents: supplierCredits.balanceCents,
  reason: supplierCredits.reason,
  notes: supplierCredits.notes,
  createdAt: supplierCredits.createdAt,
  updatedAt: supplierCredits.updatedAt,
};

const instapawnSelection = {
  id: instapawnIntakes.id,
  branchId: instapawnIntakes.branchId,
  customerFirstName: instapawnIntakes.customerFirstName,
  customerLastName: instapawnIntakes.customerLastName,
  customerPhone: instapawnIntakes.customerPhone,
  customerEmail: instapawnIntakes.customerEmail,
  governmentId: instapawnIntakes.governmentId,
  itemCategory: instapawnIntakes.itemCategory,
  itemDescription: instapawnIntakes.itemDescription,
  collateral: instapawnIntakes.collateral,
  requestedPrincipalCents: instapawnIntakes.requestedPrincipalCents,
  autoAppraisedValueCents: instapawnIntakes.autoAppraisedValueCents,
  interestModelId: instapawnIntakes.interestModelId,
  notes: instapawnIntakes.notes,
  status: instapawnIntakes.status,
  barcodeToken: instapawnIntakes.barcodeToken,
  barcodeExpiresAt: instapawnIntakes.barcodeExpiresAt,
  barcodeScannedAt: instapawnIntakes.barcodeScannedAt,
  notifiedAt: instapawnIntakes.notifiedAt,
  convertedLoanId: instapawnIntakes.convertedLoanId,
  convertedAt: instapawnIntakes.convertedAt,
  createdAt: instapawnIntakes.createdAt,
  updatedAt: instapawnIntakes.updatedAt,
};

const cashMovementDirection = {
  deposit: 1,
  cash_to_safe: -1,
  drop: -1,
  paid_in: 1,
  paid_out: -1,
  refund: -1,
  expense: -1,
  income: 1,
};

const manualMovementKinds = new Set([
  'deposit',
  'cash_to_safe',
  'drop',
  'paid_in',
  'paid_out',
  'expense',
  'income',
]);

const defaultInventoryPageSize = 50;
const maxInventoryPageSize = 200;

let inventoryCategoriesAvailable = null;

const inventorySortColumnMap = {
  name: productCodes.name,
  code: productCodes.code,
  sku: productCodes.sku,
  updatedAt: productCodeVersions.updatedAt,
  qtyOnHand: productCodeVersions.qtyOnHand,
  qtyReserved: productCodeVersions.qtyReserved,
  priceCents: productCodeVersions.priceCents,
};

const labelLayouts = {
  '2x7': {
    id: '2x7',
    name: '2 columnas x 7 filas (54x34mm)',
    columns: 2,
    rows: 7,
    widthMm: 54,
    heightMm: 34,
    marginMm: 3,
  },
  '3x10': {
    id: '3x10',
    name: '3 columnas x 10 filas (50.8x25.4mm)',
    columns: 3,
    rows: 10,
    widthMm: 50.8,
    heightMm: 25.4,
    marginMm: 2.5,
  },
};

const defaultLabelLayoutId = '2x7';
const maxLabelsPerRequest = 200;

function coerceIdArray(value) {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isInteger(entry) && entry > 0);
  }

  const asNumber = Number(value);

  if (Number.isInteger(asNumber) && asNumber > 0) {
    return [asNumber];
  }

  return [];
}

function serializeLabelLayout(layout) {
  return {
    id: layout.id,
    name: layout.name,
    columns: layout.columns,
    rows: layout.rows,
    widthMm: layout.widthMm,
    heightMm: layout.heightMm,
    marginMm: layout.marginMm,
  };
}

const availableLabelLayouts = Object.values(labelLayouts).map(serializeLabelLayout);

function resolveLabelLayout(layoutId) {
  if (typeof layoutId === 'string' && labelLayouts[layoutId]) {
    return labelLayouts[layoutId];
  }

  return labelLayouts[defaultLabelLayoutId];
}

function normalizeLabelNote(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'labelNote must be a string or null');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 140 ? trimmed.slice(0, 140) : trimmed;
}

function normalizeLabelItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpError(400, 'items must be a non-empty array');
  }

  const normalizedItems = rawItems.map((entry, index) => {
    const versionId = Number(entry?.productCodeVersionId ?? entry?.versionId);
    const quantity = Number(entry?.quantity ?? 1);

    if (!Number.isInteger(versionId) || versionId <= 0) {
      throw new HttpError(400, `items[${index}].productCodeVersionId must be a positive integer`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpError(400, `items[${index}].quantity must be a positive integer`);
    }

    return { productCodeVersionId: versionId, quantity };
  });

  const totalRequested = normalizedItems.reduce((sum, entry) => sum + entry.quantity, 0);

  if (totalRequested > maxLabelsPerRequest) {
    throw new HttpError(400, `Too many labels requested at once (max ${maxLabelsPerRequest})`);
  }

  return { normalizedItems, totalRequested };
}

const labelVersionSelection = {
  productCodeVersionId: productCodeVersions.id,
  productCodeId: productCodes.id,
  code: productCodes.code,
  name: productCodes.name,
  sku: productCodes.sku,
  branchId: productCodeVersions.branchId,
  branchName: branches.name,
  priceCents: productCodeVersions.priceCents,
};

async function resolveLabelVersions(rawItems) {
  const { normalizedItems, totalRequested } = normalizeLabelItems(rawItems);
  const versionIds = normalizedItems.map((entry) => entry.productCodeVersionId);

  const versionRows = await db
    .select(labelVersionSelection)
    .from(productCodeVersions)
    .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
    .leftJoin(branches, eq(productCodeVersions.branchId, branches.id))
    .where(inArray(productCodeVersions.id, versionIds));

  const versionMap = new Map(versionRows.map((row) => [row.productCodeVersionId, row]));

  const missingSet = new Set();
  for (const entry of normalizedItems) {
    if (!versionMap.has(entry.productCodeVersionId)) {
      missingSet.add(entry.productCodeVersionId);
    }
  }

  return {
    normalizedItems,
    totalRequested,
    versionMap,
    missingVersionIds: Array.from(missingSet.values()),
  };
}

function positionLabelsForLayout(labels, layout) {
  const perPage = Math.max(1, layout.rows * layout.columns);

  return labels.map((label, index) => {
    const pageNumber = Math.floor(index / perPage) + 1;
    const indexInPage = index % perPage;
    const rowIndex = Math.floor(indexInPage / layout.columns);
    const columnIndex = indexInPage % layout.columns;

    return {
      ...label,
      pageNumber,
      rowIndex,
      columnIndex,
    };
  });
}

function buildLabelPages(positionedLabels, layout) {
  const perPage = Math.max(1, layout.rows * layout.columns);
  const pages = [];

  for (const label of positionedLabels) {
    const pageIndex = label.pageNumber - 1;

    if (!pages[pageIndex]) {
      pages[pageIndex] = {
        pageNumber: label.pageNumber,
        rows: Array.from({ length: layout.rows }, () =>
          Array.from({ length: layout.columns }, () => null)
        ),
      };
    }

    const page = pages[pageIndex];
    if (
      label.rowIndex < page.rows.length &&
      label.columnIndex < page.rows[label.rowIndex].length
    ) {
      page.rows[label.rowIndex][label.columnIndex] = label;
    }
}

// Ensure empty pages are represented when the request contained items but resulted in no labels.
  if (pages.length === 0 && positionedLabels.length === 0 && perPage > 0) {
    pages.push({
      pageNumber: 1,
      rows: Array.from({ length: layout.rows }, () =>
        Array.from({ length: layout.columns }, () => null)
      ),
    });
  }

  return pages;
}

const allowedEcomProviders = new Set(['shopify', 'woocommerce', 'amazon', 'ebay', 'custom']);
const allowedEcomListingStatuses = new Set(['draft', 'active', 'inactive']);
const allowedEcomOrderStatuses = new Set(['pending', 'paid', 'fulfilled', 'cancelled']);
const returnStatusByAction = new Map([
  ['approve', 'approved'],
  ['receive', 'received'],
  ['refund', 'refunded'],
  ['deny', 'denied'],
]);
const allowedSettingScopes = new Set(['global', 'branch', 'user']);
const providerSettingsKey = new Map([
  ['sms', 'notifications.sms'],
  ['whatsapp', 'notifications.whatsapp'],
  ['email', 'notifications.email'],
]);
const sensitiveKeyPattern = /(secret|token|password|api[-_]?key)$/i;

const requiredConfigByProvider = {
  shopify: ['apiKey', 'storeDomain'],
  woocommerce: ['siteUrl', 'consumerKey', 'consumerSecret'],
  amazon: ['sellerId', 'region', 'authToken'],
  ebay: ['clientId', 'clientSecret'],
  custom: ['endpoint'],
};

function normalizeEcomConfig(provider, rawConfig) {
  if (!allowedEcomProviders.has(provider)) {
    throw new HttpError(400, 'Unsupported channel provider');
  }

  if (rawConfig == null) {
    return {};
  }

  if (typeof rawConfig !== 'object') {
    throw new HttpError(400, 'config must be an object');
  }

  const entries = Object.entries(rawConfig).map(([key, value]) => {
    if (typeof value === 'string') {
      return [key, value.trim()];
    }

    return [key, value];
  });

  return Object.fromEntries(entries);
}

function evaluateChannelConnection(provider, config) {
  const requiredKeys = requiredConfigByProvider[provider] ?? [];
  const missingKeys = requiredKeys.filter((key) => {
    const value = config?.[key];
    if (value == null) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    return false;
  });

  if (missingKeys.length > 0) {
    return {
      ok: false,
      message: `Missing configuration: ${missingKeys.join(', ')}`,
    };
  }

  return { ok: true, message: 'Connection test succeeded' };
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}

function escapeForLike(value) {
  return value.replace(/[%_]/g, '\\$&');
}

function parsePositiveInteger(value, fieldName) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }

  return numeric;
}

function parseNonNegativeInteger(value, fieldName) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new HttpError(400, `${fieldName} must be a non-negative integer`);
  }

  return numeric;
}

function parseIdArray(rawValue, fieldName) {
  if (!Array.isArray(rawValue) || rawValue.length === 0) {
    throw new HttpError(400, `${fieldName} must be a non-empty array`);
  }

  const result = [];
  const seen = new Set();

  rawValue.forEach((value, index) => {
    const id = parsePositiveInteger(value, `${fieldName}[${index}]`);
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  });

  return result;
}

function parseMoneyToCents(value, fieldName, { allowZero = false } = {}) {
  if (value == null || value === '') {
    throw new HttpError(400, `${fieldName} is required`);
  }

  let numeric;

  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(/,/g, '.');
    numeric = Number(normalized);
  } else {
    numeric = Number(value);
  }

  if (!Number.isFinite(numeric) || (!allowZero && numeric <= 0)) {
    throw new HttpError(400, `${fieldName} must be a positive number`);
  }

  return Math.round(numeric * 100);
}

function parseOptionalDate(value, fieldName) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${fieldName} must be a valid date`);
  }

  return parsed;
}

function parseUnitCostCents(entry, index) {
  const centKeys = ['unitCostCents', 'costCents', 'unit_cost_cents', 'cost_cents'];

  for (const key of centKeys) {
    if (entry?.[key] === undefined || entry[key] === null || entry[key] === '') {
      continue;
    }

    const numeric = Number(entry[key]);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new HttpError(400, `lines[${index}].${key} must be a positive integer representing cents`);
    }

    return numeric;
  }

  const decimalKeys = ['unitCost', 'cost', 'price'];

  for (const key of decimalKeys) {
    if (entry?.[key] === undefined || entry[key] === null || entry[key] === '') {
      continue;
    }

    const normalized = String(entry[key]).trim();
    if (!normalized) {
      continue;
    }

    const parsed = Number(normalized.replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new HttpError(400, `lines[${index}].${key} must be a number greater than zero`);
    }

    return Math.round(parsed * 100);
  }

  throw new HttpError(400, `lines[${index}] must include unitCostCents or unitCost`);
}

function normalizePurchaseLines(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new HttpError(400, 'lines must be a non-empty array');
  }

  const normalizedLines = [];
  let totalQuantity = 0;
  let totalCostCents = 0;
  let totalLabels = 0;

  rawLines.forEach((entry, index) => {
    if (entry == null || typeof entry !== 'object') {
      throw new HttpError(400, `lines[${index}] must be an object`);
    }

    const versionId = parsePositiveInteger(
      entry.productCodeVersionId ?? entry.versionId,
      `lines[${index}].productCodeVersionId`
    );
    const quantity = parsePositiveInteger(entry.quantity ?? entry.qty, `lines[${index}].quantity`);
    const unitCostCents = parseUnitCostCents(entry, index);
    const lineTotalCents = unitCostCents * quantity;
    const labelQuantityRaw =
      entry.labelQuantity ?? entry.labels ?? entry.labelQty ?? entry.label_quantity ?? quantity;
    const labelQuantity = parseNonNegativeInteger(labelQuantityRaw, `lines[${index}].labelQuantity`);
    const note =
      typeof entry.note === 'string' && entry.note.trim()
        ? entry.note.trim().slice(0, 160)
        : null;

    normalizedLines.push({
      productCodeVersionId: versionId,
      quantity,
      unitCostCents,
      lineTotalCents,
      labelQuantity,
      note,
    });

    totalQuantity += quantity;
    totalCostCents += lineTotalCents;
    totalLabels += labelQuantity;
  });

  return {
    normalizedLines,
    totalQuantity,
    totalCostCents,
    totalLabels,
  };
}

function buildInvoicePolicyFlags(invoiceRow) {
  const flags = [];

  if (invoiceRow?.createdAt) {
    const createdAt = invoiceRow.createdAt instanceof Date
      ? invoiceRow.createdAt
      : new Date(invoiceRow.createdAt);
    const diffMs = Date.now() - createdAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (Number.isFinite(diffDays) && diffDays <= 15) {
      flags.push('Within 15 day window');
    } else {
      flags.push('Outside 15 day window');
    }
  }

  flags.push('Receipt includes ITBIS');

  return flags;
}

async function loadInvoiceWithDetails(client, { invoiceId = null, invoiceNo = null }) {
  if (!invoiceId && !invoiceNo) {
    throw new HttpError(400, 'invoiceId or invoiceNo is required');
  }

  const whereClause = invoiceId
    ? eq(invoices.id, invoiceId)
    : eq(invoices.invoiceNo, invoiceNo);

  const [invoiceRow] = await client
    .select({
      id: invoices.id,
      invoiceNo: invoices.invoiceNo,
      orderId: invoices.orderId,
      totalCents: invoices.totalCents,
      taxCents: invoices.taxCents,
      createdAt: invoices.createdAt,
      branchId: orders.branchId,
      userId: orders.userId,
      customerId: orders.customerId,
      subtotalCents: orders.subtotalCents,
      orderStatus: orders.status,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
    })
    .from(invoices)
    .innerJoin(orders, eq(invoices.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(whereClause)
    .limit(1);

  if (!invoiceRow) {
    throw new HttpError(404, 'Invoice not found');
  }

  const lineRows = await client
    .select({
      id: orderItems.id,
      productCodeVersionId: orderItems.productCodeVersionId,
      qty: orderItems.qty,
      unitPriceCents: orderItems.unitPriceCents,
      totalCents: orderItems.totalCents,
      code: productCodes.code,
      sku: productCodes.sku,
      name: productCodes.name,
      description: productCodes.description,
      isActive: productCodeVersions.isActive,
    })
    .from(orderItems)
    .innerJoin(productCodeVersions, eq(orderItems.productCodeVersionId, productCodeVersions.id))
    .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
    .where(eq(orderItems.orderId, invoiceRow.orderId))
    .orderBy(asc(orderItems.id));

  const subtotalCents = Number(invoiceRow.subtotalCents ?? 0);
  const taxCents = Number(invoiceRow.taxCents ?? 0);
  const taxRatio = subtotalCents > 0 ? taxCents / subtotalCents : 0;

  const lines = lineRows.map((row) => {
    const qty = Number(row.qty ?? 0);
    const unitPriceCents = Number(row.unitPriceCents ?? 0);
    const lineSubtotalCents = Math.max(0, unitPriceCents * qty);
    const lineTaxCents = Math.round(lineSubtotalCents * taxRatio);
    const lineTotalCents = lineSubtotalCents + lineTaxCents;
    const taxPerUnitCents = qty > 0 ? Math.round(lineTaxCents / qty) : 0;

    return {
      id: Number(row.id),
      orderItemId: Number(row.id),
      productCodeVersionId: Number(row.productCodeVersionId),
      sku: row.sku ?? row.code ?? null,
      code: row.code ?? null,
      description: row.name ?? 'Product',
      qty,
      unitPriceCents,
      subtotalCents: lineSubtotalCents,
      taxCents: lineTaxCents,
      taxPerUnitCents,
      totalCents: lineTotalCents,
      restockable: Boolean(row.isActive ?? true),
    };
  });

  const paymentRows = await client
    .select({
      id: payments.id,
      method: payments.method,
      amountCents: payments.amountCents,
      meta: payments.meta,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceRow.id))
    .orderBy(asc(payments.id));

  const paymentsList = paymentRows.map((row) => {
    const meta = row.meta && typeof row.meta === 'object' ? row.meta : null;
    return {
      id: Number(row.id),
      method: row.method,
      amountCents: Number(row.amountCents ?? 0),
      reference: typeof meta?.reference === 'string' ? meta.reference : null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : toIsoString(row.createdAt),
    };
  });

  const customerName = [invoiceRow.customerFirstName, invoiceRow.customerLastName]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' ');

  return {
    invoice: {
      id: Number(invoiceRow.id),
      invoiceNo: invoiceRow.invoiceNo ?? null,
      orderId: Number(invoiceRow.orderId),
      branchId: Number(invoiceRow.branchId),
      userId: Number(invoiceRow.userId),
      customerId: invoiceRow.customerId == null ? null : Number(invoiceRow.customerId),
      subtotalCents,
      taxCents,
      totalCents: Number(invoiceRow.totalCents ?? subtotalCents + taxCents),
      createdAt: invoiceRow.createdAt instanceof Date
        ? invoiceRow.createdAt.toISOString()
        : toIsoString(invoiceRow.createdAt),
      status: invoiceRow.orderStatus,
      customerName: customerName || 'Walk-in customer',
    },
    lines,
    payments: paymentsList,
    policyFlags: buildInvoicePolicyFlags(invoiceRow),
  };
}

function normalizeGiftCardCode(code) {
  if (typeof code !== 'string') {
    return null;
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toUpperCase();
}

async function getGiftCardByIdentifier(client, { cardId = null, code = null }) {
  const normalizedCode = normalizeGiftCardCode(code);

  if (!cardId && !normalizedCode) {
    throw new HttpError(400, 'cardId or code is required');
  }

  let statement = client
    .select({
      id: giftCards.id,
      code: giftCards.code,
      balanceCents: giftCards.balanceCents,
      expiresOn: giftCards.expiresOn,
      createdAt: giftCards.createdAt,
    })
    .from(giftCards);

  if (cardId) {
    const numericId = parsePositiveInteger(cardId, 'cardId');
    statement = statement.where(eq(giftCards.id, numericId));
  } else if (normalizedCode) {
    statement = statement.where(eq(giftCards.code, normalizedCode));
  }

  const [row] = await statement.limit(1);

  if (!row) {
    throw new HttpError(404, 'Gift card not found');
  }

  return row;
}

function serializeGiftCardRow(row) {
  return {
    id: Number(row.id),
    code: row.code,
    balanceCents: Number(row.balanceCents ?? 0),
    expiresOn: row.expiresOn instanceof Date ? row.expiresOn.toISOString() : toIsoString(row.expiresOn),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : toIsoString(row.createdAt),
  };
}

function generateCustomerBuyCode(index) {
  const random = crypto.randomUUID().split('-')[0]?.toUpperCase() ?? 'NEW';
  return `BUY-${random}-${String(index + 1).padStart(2, '0')}`.slice(0, 32);
}

function normalizePurchaseReturnLines(rawLines, purchaseLineMap) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new HttpError(400, 'lines must be a non-empty array');
  }

  const normalizedLines = [];
  let totalQuantity = 0;
  let totalCostCents = 0;

  rawLines.forEach((entry, index) => {
    if (entry == null || typeof entry !== 'object') {
      throw new HttpError(400, `lines[${index}] must be an object`);
    }

    const lineId = parsePositiveInteger(
      entry.purchaseLineId ?? entry.lineId ?? entry.purchase_line_id ?? entry.line_id,
      `lines[${index}].purchaseLineId`
    );

    const lineInfo = purchaseLineMap.get(lineId);
    if (!lineInfo) {
      throw new HttpError(400, `lines[${index}].purchaseLineId is invalid`);
    }

    const quantity = parsePositiveInteger(entry.quantity ?? entry.qty, `lines[${index}].quantity`);

    if (quantity > lineInfo.availableQuantity) {
      throw new HttpError(
        409,
        `lines[${index}].quantity exceeds the remaining quantity available to return`
      );
    }

    const note =
      typeof entry.note === 'string' && entry.note.trim()
        ? entry.note.trim().slice(0, 160)
        : null;

    normalizedLines.push({
      purchaseLineId: lineId,
      productCodeVersionId: lineInfo.productCodeVersionId,
      quantity,
      unitCostCents: lineInfo.unitCostCents,
      lineTotalCents: lineInfo.unitCostCents * quantity,
      note,
    });

    totalQuantity += quantity;
    totalCostCents += lineInfo.unitCostCents * quantity;

    lineInfo.availableQuantity -= quantity;
  });

  return {
    normalizedLines,
    totalQuantity,
    totalCostCents,
  };
}

function parseReceivedAt(value) {
  if (value == null || value === '') {
    return new Date();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return new Date();
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) {
    throw new HttpError(400, 'receivedAt must be a valid date');
  }

  return fallback;
}

function combineConditions(conditions) {
  const filtered = conditions.filter(Boolean);
  if (filtered.length === 0) {
    return undefined;
  }

  if (filtered.length === 1) {
    return filtered[0];
  }

  return and(...filtered);
}

// Table aliases are imported from schema.js

async function getCountSessionWithLines(executor, sessionId) {
  const numericSessionId = Number(sessionId);

  if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
    throw new HttpError(400, 'sessionId must be a positive integer');
  }

  const [sessionRow] = await executor
    .select({
      id: inventoryCountSessions.id,
      branchId: inventoryCountSessions.branchId,
      branchName: branches.name,
      scope: inventoryCountSessions.scope,
      status: inventoryCountSessions.status,
      snapshotAt: inventoryCountSessions.snapshotAt,
      createdBy: inventoryCountSessions.createdBy,
      postedBy: inventoryCountSessions.postedBy,
      postedAt: inventoryCountSessions.postedAt,
      createdAt: inventoryCountSessions.createdAt,
      updatedAt: inventoryCountSessions.updatedAt,
    })
    .from(inventoryCountSessions)
    .leftJoin(branches, eq(branches.id, inventoryCountSessions.branchId))
    .where(eq(inventoryCountSessions.id, numericSessionId))
    .limit(1);

  if (!sessionRow) {
    throw new HttpError(404, 'Inventory count session not found');
  }

  const lineRows = await executor
    .select({
      id: inventoryCountLines.id,
      sessionId: inventoryCountLines.sessionId,
      productCodeVersionId: inventoryCountLines.productCodeVersionId,
      expectedQty: inventoryCountLines.expectedQty,
      countedQty: inventoryCountLines.countedQty,
      status: inventoryCountLines.status,
      createdAt: inventoryCountLines.createdAt,
      productCodeId: productCodeVersions.productCodeId,
      branchId: productCodeVersions.branchId,
      code: productCodes.code,
      name: productCodes.name,
      sku: productCodes.sku,
    })
    .from(inventoryCountLines)
    .innerJoin(productCodeVersions, eq(productCodeVersions.id, inventoryCountLines.productCodeVersionId))
    .innerJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
    .where(eq(inventoryCountLines.sessionId, numericSessionId))
    .orderBy(asc(inventoryCountLines.id));

  const lines = lineRows.map(serializeCountLine);
  const totals = summarizeCountLines(lines);

  return {
    session: serializeCountSession(sessionRow),
    lines,
    totals,
  };
}

function serializeCountSession(row) {
  return {
    id: row.id,
    branchId: row.branchId,
    branchName: row.branchName ?? null,
    scope: row.scope,
    status: row.status,
    snapshotAt: toIsoString(row.snapshotAt),
    createdBy: row.createdBy,
    postedBy: row.postedBy,
    postedAt: toIsoString(row.postedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializeCountLine(row) {
  const expectedQty = toNumber(row.expectedQty);
  const countedQty = toNumber(row.countedQty);
  const variance = countedQty - expectedQty;

  return {
    id: row.id,
    sessionId: row.sessionId,
    productCodeVersionId: row.productCodeVersionId,
    productCodeId: row.productCodeId,
    code: row.code,
    name: row.name,
    sku: row.sku ?? null,
    branchId: row.branchId,
    expectedQty,
    countedQty,
    variance,
    status: row.status,
    createdAt: toIsoString(row.createdAt),
  };
}

function summarizeCountLines(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.totalLines += 1;
      acc.expectedQty += line.expectedQty;
      acc.countedQty += line.countedQty;
      acc.totalVariance += line.variance;

      if (line.variance !== 0) {
        acc.varianceCount += 1;
      }

      return acc;
    },
    {
      totalLines: 0,
      expectedQty: 0,
      countedQty: 0,
      totalVariance: 0,
      varianceCount: 0,
    }
  );
}

async function getTransferDetail(executor, transferId) {
  const numericTransferId = Number(transferId);

  if (!Number.isInteger(numericTransferId) || numericTransferId <= 0) {
    throw new HttpError(400, 'transferId must be a positive integer');
  }

  const [transferRow] = await executor
    .select({
      id: inventoryTransfers.id,
      fromBranchId: inventoryTransfers.fromBranchId,
      toBranchId: inventoryTransfers.toBranchId,
      status: inventoryTransfers.status,
      createdBy: inventoryTransfers.createdBy,
      approvedBy: inventoryTransfers.approvedBy,
      shippedBy: inventoryTransfers.shippedBy,
      receivedBy: inventoryTransfers.receivedBy,
      shippedAt: inventoryTransfers.shippedAt,
      receivedAt: inventoryTransfers.receivedAt,
      createdAt: inventoryTransfers.createdAt,
      updatedAt: inventoryTransfers.updatedAt,
      fromBranchName: fromBranchAlias.name,
      toBranchName: toBranchAlias.name,
    })
    .from(inventoryTransfers)
    .leftJoin(fromBranchAlias, eq(fromBranchAlias.id, inventoryTransfers.fromBranchId))
    .leftJoin(toBranchAlias, eq(toBranchAlias.id, inventoryTransfers.toBranchId))
    .where(eq(inventoryTransfers.id, numericTransferId))
    .limit(1);

  if (!transferRow) {
    throw new HttpError(404, 'Inventory transfer not found');
  }

  const lineRows = await executor
    .select({
      id: inventoryTransferLines.id,
      transferId: inventoryTransferLines.transferId,
      productCodeVersionId: inventoryTransferLines.productCodeVersionId,
      qty: inventoryTransferLines.qty,
      productCodeId: productCodeVersions.productCodeId,
      code: productCodes.code,
      name: productCodes.name,
      sku: productCodes.sku,
      branchId: productCodeVersions.branchId,
    })
    .from(inventoryTransferLines)
    .innerJoin(productCodeVersions, eq(productCodeVersions.id, inventoryTransferLines.productCodeVersionId))
    .innerJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
    .where(eq(inventoryTransferLines.transferId, numericTransferId))
    .orderBy(asc(inventoryTransferLines.id));

  const lines = lineRows.map(serializeTransferLine);
  const summary = lines.reduce(
    (acc, line) => {
      acc.totalLines += 1;
      acc.totalQty += line.qty;
      return acc;
    },
    { totalLines: 0, totalQty: 0 }
  );

  return {
    transfer: serializeTransfer(transferRow),
    lines,
    summary,
  };
}

function serializeTransfer(row) {
  return {
    id: row.id,
    fromBranchId: row.fromBranchId,
    fromBranchName: row.fromBranchName ?? null,
    toBranchId: row.toBranchId,
    toBranchName: row.toBranchName ?? null,
    status: row.status,
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    shippedBy: row.shippedBy,
    receivedBy: row.receivedBy,
    shippedAt: toIsoString(row.shippedAt),
    receivedAt: toIsoString(row.receivedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializeTransferLine(row) {
  return {
    id: row.id,
    transferId: row.transferId,
    productCodeVersionId: row.productCodeVersionId,
    productCodeId: row.productCodeId,
    code: row.code,
    name: row.name,
    sku: row.sku ?? null,
    branchId: row.branchId,
    qty: toNumber(row.qty),
  };
}

async function getQuarantineEntry(executor, quarantineId) {
  const numericQuarantineId = Number(quarantineId);

  if (!Number.isInteger(numericQuarantineId) || numericQuarantineId <= 0) {
    throw new HttpError(400, 'quarantineId must be a positive integer');
  }

  const [quarantineRow] = await executor
    .select({
      id: inventoryQuarantines.id,
      branchId: inventoryQuarantines.branchId,
      branchName: branches.name,
      productCodeVersionId: inventoryQuarantines.productCodeVersionId,
      qty: inventoryQuarantines.qty,
      reason: inventoryQuarantines.reason,
      status: inventoryQuarantines.status,
      outcome: inventoryQuarantines.outcome,
      createdBy: inventoryQuarantines.createdBy,
      resolvedBy: inventoryQuarantines.resolvedBy,
      createdAt: inventoryQuarantines.createdAt,
      resolvedAt: inventoryQuarantines.resolvedAt,
      productCodeId: productCodeVersions.productCodeId,
      code: productCodes.code,
      name: productCodes.name,
      sku: productCodes.sku,
    })
    .from(inventoryQuarantines)
    .leftJoin(branches, eq(branches.id, inventoryQuarantines.branchId))
    .innerJoin(productCodeVersions, eq(productCodeVersions.id, inventoryQuarantines.productCodeVersionId))
    .innerJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
    .where(eq(inventoryQuarantines.id, numericQuarantineId))
    .limit(1);

  if (!quarantineRow) {
    throw new HttpError(404, 'Quarantine entry not found');
  }

  return serializeQuarantineEntry(quarantineRow);
}

function serializeQuarantineEntry(row) {
  return {
    id: row.id,
    branchId: row.branchId,
    branchName: row.branchName ?? null,
    productCodeVersionId: row.productCodeVersionId,
    productCodeId: row.productCodeId,
    code: row.code,
    name: row.name,
    sku: row.sku ?? null,
    qty: toNumber(row.qty),
    reason: row.reason ?? null,
    status: row.status,
    outcome: row.outcome ?? null,
    createdBy: row.createdBy ?? null,
    resolvedBy: row.resolvedBy ?? null,
    createdAt: toIsoString(row.createdAt),
    resolvedAt: toIsoString(row.resolvedAt),
  };
}

const allowedLoanPaymentMethods = new Set(['cash', 'card', 'transfer']);
const allowedLayawayPaymentMethods = new Set(['cash', 'card', 'transfer']);
const closedLoanStatuses = new Set(['redeemed', 'forfeited']);
const pastDueBucketOrder = ['1-7', '8-14', '15-29', '30-59', '60+'];
const allowedPastDueBuckets = new Set(pastDueBucketOrder);
const loanAgingBucketOrder = ['current', '1-7', '8-14', '15-29', '30-59', '60+'];
const loanAgingBucketSet = new Set(loanAgingBucketOrder);

const allowedIdImageContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const uploadSigningSecret = process.env.UPLOAD_SIGNING_SECRET || process.env.APP_SECRET || 'change-me';
const uploadBaseUrl = (process.env.UPLOAD_BASE_URL || 'https://uploads.local/ingest').replace(/\/$/, '');
const uploadPublicUrl = (process.env.UPLOAD_PUBLIC_URL || 'https://uploads.local/files').replace(/\/$/, '');
const maxUploadExpirySeconds = Math.max(60, Math.min(Number(process.env.UPLOAD_URL_MAX_AGE ?? 900), 3600));
const maxIdImageBytes = Math.max(256000, Number(process.env.ID_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024));
const pesoFormatter = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
  maximumFractionDigits: 2,
});

function extensionForContentType(contentType) {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return null;
  }
}

function sanitizeBaseFileName(name) {
  if (typeof name !== 'string') {
    return 'id-image';
  }

  const trimmed = name.trim().toLowerCase();
  if (!trimmed) {
    return 'id-image';
  }

  const withoutExt = trimmed.replace(/\.[^.]+$/, '');
  const sanitized = withoutExt.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'id-image';
}

function buildIdImageStoragePath(originalFileName, contentType) {
  const ext = extensionForContentType(contentType);
  if (!ext) {
    throw new HttpError(400, 'Unsupported content type');
  }

  const baseName = sanitizeBaseFileName(originalFileName);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  return `id-images/${timestamp}-${randomSuffix}-${baseName}.${ext}`;
}

function signUploadPayload(path, contentType, expiresAtIso) {
  const payload = `${path}:${contentType}:${expiresAtIso}`;
  return crypto.createHmac('sha256', uploadSigningSecret).update(payload).digest('hex');
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseAmount(amount) {
  const normalized = Number(amount);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return Math.round(normalized);
}

function normalizeReasonInput(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDateValue(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}

function parseDateOnly(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
    if (match) {
      const [, year, month, day] = match;
      const numericYear = Number(year);
      const numericMonth = Number(month);
      const numericDay = Number(day);

      if (Number.isInteger(numericYear) && Number.isInteger(numericMonth) && Number.isInteger(numericDay)) {
        return new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
      }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
    }
  }

  return null;
}

function calculateCalendarDaysLate(dueDateValue, referenceDate = new Date()) {
  const dueDate = parseDateOnly(dueDateValue);
  if (!dueDate) {
    return null;
  }

  const reference = parseDateOnly(referenceDate instanceof Date ? referenceDate : new Date(referenceDate));
  if (!reference) {
    return null;
  }

  const diffMs = reference.getTime() - dueDate.getTime();
  return Math.floor(diffMs / 86_400_000);
}

function determinePastDueBucket(daysLate) {
  if (daysLate == null || Number.isNaN(daysLate) || daysLate <= 0) {
    return 'current';
  }

  if (daysLate >= 60) {
    return '60+';
  }

  if (daysLate >= 30) {
    return '30-59';
  }

  if (daysLate >= 15) {
    return '15-29';
  }

  if (daysLate >= 8) {
    return '8-14';
  }

  return '1-7';
}

function formatPesosFromCents(cents) {
  const amount = Number(cents ?? 0);
  if (!Number.isFinite(amount)) {
    return pesoFormatter.format(0);
  }

  return pesoFormatter.format(Math.round(amount) / 100);
}

function normalizeLoanScheduleEntries(schedule, { allowZeroInterest = false } = {}) {
  if (!Array.isArray(schedule)) {
    throw new HttpError(400, 'schedule must be an array');
  }

  return schedule.map((entry, index) => {
    const dueOnValue = entry?.dueOn;
    const interestValue = Number(entry?.interestCents);
    const feeValue = Number(entry?.feeCents ?? 0);

    if (!dueOnValue || typeof dueOnValue !== 'string') {
      throw new HttpError(400, `schedule[${index}].dueOn is required`);
    }

    const dueOnDate = new Date(dueOnValue);

    if (Number.isNaN(dueOnDate.getTime())) {
      throw new HttpError(400, `schedule[${index}].dueOn is invalid`);
    }

    if (!Number.isFinite(interestValue) || interestValue < 0) {
      throw new HttpError(400, `schedule[${index}].interestCents must be zero or greater`);
    }

    if (!allowZeroInterest && interestValue <= 0) {
      throw new HttpError(400, `schedule[${index}].interestCents must be greater than 0`);
    }

    if (!Number.isFinite(feeValue) || feeValue < 0) {
      throw new HttpError(400, `schedule[${index}].feeCents must be zero or greater`);
    }

    const normalizedDueOn = dueOnDate.toISOString().slice(0, 10);

    return {
      dueOn: normalizedDueOn,
      interestCents: Math.round(interestValue),
      feeCents: Math.round(feeValue),
    };
  });
}

function normalizeOptionalString(value, { maxLength } = {}) {
  if (typeof value !== 'string') {
    return null;
  }

  let normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (maxLength != null && maxLength > 0 && normalized.length > maxLength) {
    normalized = normalized.slice(0, maxLength);
  }

  return normalized;
}

function normalizePhoneInput(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.replace(/[^0-9+]/g, '');
  const numeric = digits.replace(/\+/g, '').replace(/[^0-9]/g, '');

  if (numeric.length < 8) {
    return null;
  }

  return numeric.length === digits.length ? numeric : `+${numeric}`;
}

function normalizeCollateralDraftList(collateral) {
  if (!Array.isArray(collateral)) {
    return [];
  }

  return collateral
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      const description = normalizeOptionalString(item.description, { maxLength: 2048 });

      if (!description) {
        throw new HttpError(400, `collateral[${index}].description is required`);
      }

      const value = item.estimatedValueCents;
      const estimatedValue = value == null ? null : Number(value);

      if (estimatedValue != null && (!Number.isFinite(estimatedValue) || estimatedValue < 0)) {
        throw new HttpError(400, `collateral[${index}].estimatedValueCents must be zero or greater`);
      }

      const photoPath = normalizeOptionalString(item.photoPath, { maxLength: 512 });

      return {
        description,
        estimatedValueCents: estimatedValue == null ? null : Math.round(estimatedValue),
        photoPath,
      };
    });
}

function normalizeIdImagePathsList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value, index) => {
    if (typeof value !== 'string') {
      throw new HttpError(400, `idImagePaths[${index}] must be a string`);
    }

    const trimmed = value.trim();

    if (!trimmed) {
      throw new HttpError(400, `idImagePaths[${index}] cannot be empty`);
    }

    if (!trimmed.startsWith('id-images/')) {
      throw new HttpError(400, `idImagePaths[${index}] must reference an id-images storage path`);
    }

    return trimmed;
  });
}

async function enforceSignedIdImagePolicy(executor, paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return;
  }

  const tokenRows = await executor
    .select({
      id: idImageUploadTokens.id,
      path: idImageUploadTokens.path,
      expiresAt: idImageUploadTokens.expiresAt,
      usedAt: idImageUploadTokens.usedAt,
    })
    .from(idImageUploadTokens)
    .where(inArray(idImageUploadTokens.path, paths));

  if (tokenRows.length !== paths.length) {
    throw new HttpError(403, 'One or more ID image uploads are missing a signed token');
  }

  const now = Date.now();
  const seen = new Set();

  for (const path of paths) {
    const token = tokenRows.find((row) => row.path === path);

    if (!token) {
      throw new HttpError(403, 'Missing signed upload token for ID image');
    }

    if (seen.has(token.path)) {
      throw new HttpError(409, 'Duplicate ID image path detected');
    }

    seen.add(token.path);

    const expiresAtMs = token.expiresAt instanceof Date ? token.expiresAt.getTime() : new Date(token.expiresAt).getTime();

    if (!Number.isFinite(expiresAtMs) || expiresAtMs < now) {
      throw new HttpError(410, 'Signed upload token has expired');
    }

    if (token.usedAt) {
      throw new HttpError(409, 'Signed upload token has already been consumed');
    }
  }

  const idsToMark = tokenRows
    .filter((row) => !row.usedAt)
    .map((row) => row.id);

  if (idsToMark.length > 0) {
    await executor
      .update(idImageUploadTokens)
      .set({ usedAt: new Date() })
      .where(inArray(idImageUploadTokens.id, idsToMark));
  }
}

async function prepareLoanCreationInput(executor, payload, { allowZeroInterest = false } = {}) {
  const {
    branchId,
    customerId,
    ticketNumber,
    interestModelId,
    principalCents,
    comments = null,
    schedule = [],
    collateral = [],
    idImagePaths = [],
  } = payload ?? {};

  if (branchId == null || customerId == null) {
    throw new HttpError(400, 'branchId and customerId are required');
  }

  const numericBranchId = Number(branchId);
  const numericCustomerId = Number(customerId);

  if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
    throw new HttpError(400, 'branchId must be a positive integer');
  }

  if (!Number.isInteger(numericCustomerId) || numericCustomerId <= 0) {
    throw new HttpError(400, 'customerId must be a positive integer');
  }

  if (interestModelId == null) {
    throw new HttpError(400, 'interestModelId is required');
  }

  const numericInterestModelId = Number(interestModelId);

  if (!Number.isInteger(numericInterestModelId) || numericInterestModelId <= 0) {
    throw new HttpError(400, 'interestModelId must be a positive integer');
  }

  if (!ticketNumber || typeof ticketNumber !== 'string' || !ticketNumber.trim()) {
    throw new HttpError(400, 'ticketNumber is required');
  }

  if (!Array.isArray(schedule) || schedule.length === 0) {
    throw new HttpError(400, 'schedule must include at least one entry');
  }

  const normalizedTicket = ticketNumber.trim();
  const normalizedSchedule = normalizeLoanScheduleEntries(schedule, { allowZeroInterest });

  const dueDateString = normalizedSchedule.reduce((latest, entry) => {
    return entry.dueOn > latest ? entry.dueOn : latest;
  }, normalizedSchedule[0].dueOn);

  const roundedPrincipal = Math.round(Number(principalCents));

  if (!Number.isFinite(roundedPrincipal) || roundedPrincipal <= 0) {
    throw new HttpError(400, 'principalCents must be greater than 0');
  }

  const normalizedCollateral = normalizeCollateralDraftList(collateral);
  const normalizedIdImagePaths = normalizeIdImagePathsList(idImagePaths);
  await enforceSignedIdImagePolicy(executor, normalizedIdImagePaths);

  const [model] = await executor
    .select({
      id: interestModels.id,
      interestRateBps: interestModels.interestRateBps,
      minPrincipalCents: interestModels.minPrincipalCents,
      maxPrincipalCents: interestModels.maxPrincipalCents,
    })
    .from(interestModels)
    .where(eq(interestModels.id, numericInterestModelId))
    .limit(1);

  if (!model) {
    throw new HttpError(404, 'Interest model not found');
  }

  const minPrincipal = model.minPrincipalCents == null ? null : Number(model.minPrincipalCents);
  const maxPrincipal = model.maxPrincipalCents == null ? null : Number(model.maxPrincipalCents);

  if (minPrincipal != null && roundedPrincipal < minPrincipal) {
    throw new HttpError(400, `principalCents must be at least ${minPrincipal}`);
  }

  if (maxPrincipal != null && roundedPrincipal > maxPrincipal) {
    throw new HttpError(400, `principalCents must be at most ${maxPrincipal}`);
  }

  const [existingTicket] = await executor
    .select({ id: loans.id })
    .from(loans)
    .where(eq(loans.ticketNumber, normalizedTicket))
    .limit(1);

  if (existingTicket) {
    throw new HttpError(409, 'Ticket number already exists');
  }

  const normalizedComments = normalizeOptionalString(comments, { maxLength: 2000 });
  const rateDecimal = (Number(model.interestRateBps) / 10000).toFixed(4);

  return {
    branchId: numericBranchId,
    customerId: numericCustomerId,
    ticketNumber: normalizedTicket,
    principalCents: roundedPrincipal,
    interestModelId: Number(model.id),
    interestRate: rateDecimal,
    dueDate: dueDateString,
    comments: normalizedComments,
    schedule: normalizedSchedule,
    collateral: normalizedCollateral,
    idImagePaths: normalizedIdImagePaths,
  };
}

async function createLoanWithPreparedPayload(executor, prepared) {
  await executor.insert(loans).values({
    branchId: prepared.branchId,
    customerId: prepared.customerId,
    ticketNumber: prepared.ticketNumber,
    principalCents: prepared.principalCents,
    interestModelId: prepared.interestModelId,
    interestRate: prepared.interestRate,
    dueDate: prepared.dueDate,
    comments: prepared.comments,
  });

  const [loanRow] = await executor
    .select({
      id: loans.id,
      branchId: loans.branchId,
      customerId: loans.customerId,
      ticketNumber: loans.ticketNumber,
      principalCents: loans.principalCents,
      interestModelId: loans.interestModelId,
      interestRate: loans.interestRate,
      dueDate: loans.dueDate,
      status: loans.status,
      comments: loans.comments,
      createdAt: loans.createdAt,
      updatedAt: loans.updatedAt,
    })
    .from(loans)
    .where(eq(loans.ticketNumber, prepared.ticketNumber))
    .limit(1);

  if (!loanRow) {
    throw new Error('FAILED_TO_CREATE_LOAN');
  }

  for (const entry of prepared.schedule) {
    await executor.insert(loanSchedules).values({
      loanId: loanRow.id,
      dueOn: entry.dueOn,
      interestCents: entry.interestCents,
      feeCents: entry.feeCents,
    });
  }

  for (const item of prepared.collateral) {
    await executor.insert(loanCollateral).values({
      loanId: loanRow.id,
      description: item.description,
      estimatedValueCents: item.estimatedValueCents,
      photoPath: item.photoPath,
    });
  }

  const collateralRows = await executor
    .select({
      id: loanCollateral.id,
      loanId: loanCollateral.loanId,
      description: loanCollateral.description,
      estimatedValueCents: loanCollateral.estimatedValueCents,
      photoPath: loanCollateral.photoPath,
    })
    .from(loanCollateral)
    .where(eq(loanCollateral.loanId, loanRow.id));

  const scheduleRows = await executor
    .select({
      id: loanSchedules.id,
      loanId: loanSchedules.loanId,
      dueOn: loanSchedules.dueOn,
      interestCents: loanSchedules.interestCents,
      feeCents: loanSchedules.feeCents,
      createdAt: loanSchedules.createdAt,
    })
    .from(loanSchedules)
    .where(eq(loanSchedules.loanId, loanRow.id))
    .orderBy(asc(loanSchedules.dueOn));

  if (prepared.idImagePaths.length > 0) {
    const existingImageRows = await executor
      .select({ storagePath: idImages.storagePath })
      .from(idImages)
      .where(
        and(
          eq(idImages.customerId, loanRow.customerId),
          inArray(idImages.storagePath, prepared.idImagePaths)
        )
      );

    const existingPaths = new Set(existingImageRows.map((row) => row.storagePath));

    for (const path of prepared.idImagePaths) {
      if (!existingPaths.has(path)) {
        await executor.insert(idImages).values({
          customerId: loanRow.customerId,
          storagePath: path,
        });
      }
    }
  }

  return {
    loan: loanRow,
    collateral: collateralRows,
    schedule: scheduleRows,
    idImagePaths: prepared.idImagePaths,
  };
}

function serializeLoanResponsePayload(payload) {
  return {
    loan: {
      ...payload.loan,
      branchId: Number(payload.loan.branchId),
      customerId: Number(payload.loan.customerId),
      principalCents: Number(payload.loan.principalCents ?? 0),
      interestModelId: Number(payload.loan.interestModelId),
      dueDate: formatDateValue(payload.loan.dueDate),
      createdAt: payload.loan.createdAt?.toISOString?.() ?? payload.loan.createdAt,
      updatedAt: payload.loan.updatedAt?.toISOString?.() ?? payload.loan.updatedAt,
    },
    collateral: payload.collateral.map((item) => ({
      ...item,
      estimatedValueCents: item.estimatedValueCents == null ? null : Number(item.estimatedValueCents),
    })),
    schedule: payload.schedule.map((entry) => ({
      ...entry,
      dueOn: formatDateValue(entry.dueOn),
      interestCents: Number(entry.interestCents ?? 0),
      feeCents: Number(entry.feeCents ?? 0),
      createdAt: entry.createdAt?.toISOString?.() ?? entry.createdAt,
    })),
    idImagePaths: payload.idImagePaths,
  };
}

async function reserveLayawayInventory(executor, { orderId, branchId }) {
  const items = await executor
    .select({
      productCodeVersionId: orderItems.productCodeVersionId,
      qty: orderItems.qty,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) {
    throw new HttpError(400, 'Order has no items to reserve');
  }

  for (const item of items) {
    const qty = Number(item.qty ?? 0);

    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const [versionRow] = await executor
      .select({
        id: productCodeVersions.id,
        branchId: productCodeVersions.branchId,
        qtyOnHand: productCodeVersions.qtyOnHand,
        qtyReserved: productCodeVersions.qtyReserved,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(productCodeVersions)
      .leftJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
      .where(eq(productCodeVersions.id, item.productCodeVersionId))
      .limit(1);

    if (!versionRow) {
      throw new HttpError(400, 'Product code version not found for order item');
    }

    if (branchId != null && Number(versionRow.branchId) !== Number(branchId)) {
      throw new HttpError(400, 'Order item belongs to a different branch');
    }

    const available = Number(versionRow.qtyOnHand ?? 0) - Number(versionRow.qtyReserved ?? 0);

    if (available < qty) {
      const label = versionRow.code
        ? `${versionRow.code} · ${versionRow.name ?? ''}`.trim()
        : versionRow.name ?? `#${versionRow.id}`;
      throw new HttpError(409, `Insufficient quantity to reserve for ${label}`);
    }

    await executor
      .update(productCodeVersions)
      .set({ qtyReserved: sql`${productCodeVersions.qtyReserved} + ${qty}` })
      .where(eq(productCodeVersions.id, versionRow.id));
  }
}

async function releaseLayawayInventory(executor, orderId) {
  const items = await executor
    .select({
      productCodeVersionId: orderItems.productCodeVersionId,
      qty: orderItems.qty,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    const qty = Math.abs(Number(item.qty ?? 0));

    if (!Number.isFinite(qty) || qty === 0) {
      continue;
    }

    await executor
      .update(productCodeVersions)
      .set({ qtyReserved: sql`GREATEST(${productCodeVersions.qtyReserved} - ${qty}, 0)` })
      .where(eq(productCodeVersions.id, item.productCodeVersionId));
  }
}

async function fulfillLayawayInventory(executor, layawayId, orderId) {
  const items = await executor
    .select({
      productCodeVersionId: orderItems.productCodeVersionId,
      qty: orderItems.qty,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    const qty = Math.abs(Number(item.qty ?? 0));

    if (!Number.isFinite(qty) || qty === 0) {
      continue;
    }

    const [versionRow] = await executor
      .select({
        id: productCodeVersions.id,
        qtyOnHand: productCodeVersions.qtyOnHand,
      })
      .from(productCodeVersions)
      .where(eq(productCodeVersions.id, item.productCodeVersionId))
      .limit(1);

    if (!versionRow) {
      throw new HttpError(400, 'Product code version not found for layaway completion');
    }

    const onHand = Number(versionRow.qtyOnHand ?? 0);

    if (onHand < qty) {
      throw new HttpError(409, 'Insufficient on-hand quantity to complete layaway');
    }

    await executor
      .update(productCodeVersions)
      .set({
        qtyReserved: sql`GREATEST(${productCodeVersions.qtyReserved} - ${qty}, 0)`,
        qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${qty}`,
      })
      .where(eq(productCodeVersions.id, versionRow.id));

    await executor.insert(stockLedger).values({
      productCodeVersionId: versionRow.id,
      reason: 'sale',
      qtyChange: -qty,
      referenceId: layawayId,
      referenceType: 'layaway',
      notes: 'Layaway completion',
    });
  }
}

async function buildLayawayDashboardSnapshot(referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const todayStart = startOfDay(now);
  const tomorrowStart = startOfTomorrow(now);

  const activeRows = await db
    .select({
      id: layaways.id,
      branchId: layaways.branchId,
      branchName: branches.name,
      customerId: layaways.customerId,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      orderId: layaways.orderId,
      orderNumber: orders.orderNumber,
      totalCents: layaways.totalCents,
      paidCents: layaways.paidCents,
      dueDate: layaways.dueDate,
      createdAt: layaways.createdAt,
      updatedAt: layaways.updatedAt,
    })
    .from(layaways)
    .leftJoin(branches, eq(branches.id, layaways.branchId))
    .leftJoin(customers, eq(customers.id, layaways.customerId))
    .leftJoin(orders, eq(orders.id, layaways.orderId))
    .where(eq(layaways.status, 'active'))
    .orderBy(asc(layaways.dueDate), asc(layaways.id));

  const layawayIds = Array.from(new Set(activeRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id))));
  const orderIds = Array.from(new Set(activeRows.map((row) => Number(row.orderId)).filter((id) => Number.isFinite(id))));
  const customerIds = Array.from(new Set(activeRows.map((row) => Number(row.customerId)).filter((id) => Number.isFinite(id))));

  const firstItemByOrder = new Map();
  if (orderIds.length > 0) {
    const orderItemRows = await db
      .select({
        orderId: orderItems.orderId,
        qty: orderItems.qty,
        productName: productCodes.name,
        productCode: productCodes.code,
      })
      .from(orderItems)
      .leftJoin(productCodeVersions, eq(productCodeVersions.id, orderItems.productCodeVersionId))
      .leftJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(orderItems.orderId, asc(orderItems.id));

    for (const item of orderItemRows) {
      const id = Number(item.orderId);
      if (!Number.isFinite(id) || firstItemByOrder.has(id)) {
        continue;
      }

      const qty = Number(item.qty ?? 0);
      const labelParts = [];
      if (Number.isFinite(qty) && qty > 1) {
        labelParts.push(`${qty}×`);
      }
      labelParts.push(item.productName ?? item.productCode ?? 'Artículo reservado');
      firstItemByOrder.set(id, labelParts.join(' '));
    }
  }

  const lastPaymentByLayaway = new Map();
  if (layawayIds.length > 0) {
    const paymentRows = await db
      .select({
        layawayId: layawayPayments.layawayId,
        amountCents: layawayPayments.amountCents,
        method: layawayPayments.method,
        note: layawayPayments.note,
        createdAt: layawayPayments.createdAt,
      })
      .from(layawayPayments)
      .where(inArray(layawayPayments.layawayId, layawayIds))
      .orderBy(desc(layawayPayments.createdAt), desc(layawayPayments.id));

    for (const row of paymentRows) {
      const id = Number(row.layawayId);
      if (!Number.isFinite(id) || lastPaymentByLayaway.has(id)) {
        continue;
      }

      const createdAt = row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt
        ? new Date(row.createdAt).toISOString()
        : null;

      lastPaymentByLayaway.set(id, {
        amountCents: Number(row.amountCents ?? 0),
        method: row.method ?? 'cash',
        note: row.note ?? null,
        createdAt,
      });
    }
  }

  let notificationRows = [];
  if (customerIds.length > 0) {
    notificationRows = await db
      .select({
        id: notificationMessages.id,
        customerId: notificationMessages.customerId,
        channel: notificationMessages.channel,
        status: notificationMessages.status,
        message: notificationMessages.message,
        createdAt: notificationMessages.createdAt,
        sentAt: notificationMessages.sentAt,
      })
      .from(notificationMessages)
      .where(inArray(notificationMessages.customerId, customerIds))
      .orderBy(desc(notificationMessages.createdAt), desc(notificationMessages.id))
      .limit(40);
  }

  const lastNotificationByCustomer = new Map();
  for (const row of notificationRows) {
    const id = Number(row.customerId);
    if (!Number.isFinite(id) || lastNotificationByCustomer.has(id)) {
      continue;
    }
    lastNotificationByCustomer.set(id, row);
  }

  const [paymentsTodayRow] = await db
    .select({
      totalCents: sql`COALESCE(SUM(${layawayPayments.amountCents}), 0)`,
      count: sql`COUNT(*)`,
    })
    .from(layawayPayments)
    .where(and(gte(layawayPayments.createdAt, todayStart), lt(layawayPayments.createdAt, tomorrowStart)));

  const paymentsTodayCents = Number(paymentsTodayRow?.totalCents ?? 0);
  const paymentsTodayCount = Number(paymentsTodayRow?.count ?? 0);

  const [completedTodayRow] = await db
    .select({ count: sql`COUNT(*)` })
    .from(layaways)
    .where(
      and(
        eq(layaways.status, 'completed'),
        gte(layaways.updatedAt, todayStart),
        lt(layaways.updatedAt, tomorrowStart),
      ),
    );

  const completedToday = Number(completedTodayRow?.count ?? 0);

  const activePlans = [];
  const overduePlans = [];

  for (const row of activeRows) {
    const dueDateValue = row.dueDate instanceof Date
      ? row.dueDate
      : row.dueDate
      ? new Date(row.dueDate)
      : null;
    const dueDateIso = dueDateValue?.toISOString?.() ?? (typeof row.dueDate === 'string' ? row.dueDate : null);
    const totalCents = Number(row.totalCents ?? 0);
    const paidCents = Number(row.paidCents ?? 0);
    const balanceCents = Math.max(totalCents - paidCents, 0);
    const lastPayment = lastPaymentByLayaway.get(Number(row.id)) ?? null;
    const autopay = lastPayment?.method === 'card';
    const customerName = [row.customerFirstName, row.customerLastName]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' ') || `Cliente #${row.customerId}`;
    const branchName = row.branchName ?? `Sucursal ${row.branchId}`;
    const notification = lastNotificationByCustomer.get(Number(row.customerId)) ?? null;
    const contactDate = notification?.sentAt ?? notification?.createdAt ?? null;
    const contactIso = contactDate instanceof Date
      ? contactDate.toISOString()
      : contactDate
      ? new Date(contactDate).toISOString()
      : null;
    const status = dueDateValue && !Number.isNaN(dueDateValue.getTime()) && dueDateValue.getTime() < now.getTime()
      ? 'overdue'
      : 'active';
    const millisDiff = dueDateValue && !Number.isNaN(dueDateValue.getTime())
      ? dueDateValue.getTime() - now.getTime()
      : Infinity;
    let risk = 'low';
    if (millisDiff < 0) {
      risk = 'high';
    } else if (millisDiff <= 5 * 86400000) {
      risk = 'medium';
    }

    const plan = {
      id: Number(row.id),
      orderId: Number(row.orderId),
      planNumber: row.orderNumber ?? `LAY-${row.id}`,
      branchId: Number(row.branchId),
      branchName,
      customerId: Number(row.customerId),
      customerName,
      customerPhone: row.customerPhone ?? null,
      customerEmail: row.customerEmail ?? null,
      totalCents,
      paidCents,
      balanceCents,
      dueDate: dueDateIso,
      status,
      autopay,
      risk,
      nextPaymentCents: balanceCents,
      contactPreference: row.customerPhone ? 'WhatsApp' : row.customerEmail ? 'Email' : 'Call',
      lastContactAt: contactIso,
      lastContactChannel: notification?.channel ?? null,
      contactNotes: notification?.message ?? null,
      lastPayment,
      itemSummary: firstItemByOrder.get(Number(row.orderId)) ?? 'Artículos reservados',
    };

    activePlans.push(plan);
    if (status === 'overdue') {
      overduePlans.push(plan);
    }
  }

  const autopayCount = activePlans.filter((plan) => plan.autopay).length;
  const outstandingTotalCents = activePlans.reduce((sum, plan) => sum + Math.max(0, Number(plan.balanceCents ?? 0)), 0);
  const overdueOutstandingCents = overduePlans.reduce((sum, plan) => sum + Math.max(0, Number(plan.balanceCents ?? 0)), 0);
  const autopayRatio = activePlans.length > 0 ? autopayCount / activePlans.length : 0;

  const schedule = activePlans
    .filter((plan) => plan.balanceCents > 0)
    .map((plan) => {
      const due = plan.dueDate ? new Date(plan.dueDate) : null;
      const dueTime = due && !Number.isNaN(due.getTime()) ? due.getTime() : null;
      let status = 'scheduled';
      if (plan.balanceCents <= 0) {
        status = 'completed';
      } else if (dueTime != null && dueTime < now.getTime()) {
        status = 'overdue';
      } else if (plan.autopay && dueTime != null && Math.abs(dueTime - now.getTime()) <= 86400000) {
        status = 'processing';
      }

      const lastPaymentDate = plan.lastPayment?.createdAt
        ? new Date(plan.lastPayment.createdAt)
        : null;
      const note = lastPaymentDate && !Number.isNaN(lastPaymentDate.getTime())
        ? `Último ${plan.lastPayment?.method ?? 'pago'} el ${lastPaymentDate.toISOString().slice(0, 10)}`
        : null;

      return {
        id: `schedule-${plan.id}`,
        layawayId: plan.id,
        planNumber: plan.planNumber,
        customerName: plan.customerName,
        dueDate: dueTime != null ? new Date(dueTime).toISOString() : plan.dueDate,
        amountCents: Number(plan.nextPaymentCents ?? 0),
        channel: plan.autopay ? 'auto' : plan.lastPayment?.method ?? 'cash',
        status,
        notes: note,
      };
    })
    .sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    })
    .slice(0, 12);

  const channelLabelMap = {
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    email: 'Email',
  };
  const reminderStatusMap = {
    pending: 'queued',
    sent: 'sent',
    failed: 'scheduled',
  };

  const reminders = notificationRows
    .filter((row) => Boolean(row.message))
    .slice(0, 12)
    .map((row) => {
      const plan = activePlans.find((item) => item.customerId === Number(row.customerId));
      const scheduledAtRaw = row.sentAt ?? row.createdAt ?? null;
      const scheduledAt = scheduledAtRaw instanceof Date
        ? scheduledAtRaw
        : scheduledAtRaw
        ? new Date(scheduledAtRaw)
        : null;

      return {
        id: `reminder-${row.id}`,
        planNumber: plan?.planNumber ?? 'Layaway',
        customerName: plan?.customerName ?? `Cliente #${row.customerId ?? ''}`,
        message: row.message ?? '',
        channel: channelLabelMap[row.channel] ?? 'SMS',
        status: reminderStatusMap[row.status] ?? 'scheduled',
        scheduledFor: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt.toISOString() : null,
      };
    });

  const pesoFormatter = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' });
  const insights = [];

  if (overduePlans.length > 0) {
    insights.push({
      id: 'overdue-focus',
      title: 'Priorizar planes en mora',
      description: `Hay ${overduePlans.length} plan(es) con saldo pendiente de ${pesoFormatter.format(overdueOutstandingCents / 100)}.`,
      impact: overdueOutstandingCents > 250000 ? 'high' : 'medium',
    });
  }

  if (autopayRatio < 0.3 && activePlans.length > 0) {
    insights.push({
      id: 'increase-autopay',
      title: 'Incrementa los cobros automáticos',
      description: 'Menos del 30% de los planes activos utilizan AutoCobro. Ofrece incentivos para migrarlos y reducir mora.',
      impact: 'medium',
    });
  }

  if (paymentsTodayCount === 0 && activePlans.length > 0) {
    insights.push({
      id: 'no-payments-today',
      title: 'Sin abonos registrados hoy',
      description: 'Programa contactos para asegurar al menos un abono diario y mantener el flujo de caja estable.',
      impact: 'low',
    });
  } else if (paymentsTodayCount > 0) {
    insights.push({
      id: 'payments-today',
      title: 'Cobros registrados hoy',
      description: `Se han aplicado ${paymentsTodayCount} pago(s) por ${pesoFormatter.format(paymentsTodayCents / 100)} en total.`,
      impact: 'low',
    });
  }

  return {
    generatedAt: now.toISOString(),
    summary: {
      activeCount: activePlans.length,
      overdueCount: overduePlans.length,
      completedToday,
      paymentsTodayCents,
      paymentsTodayCount,
      outstandingCents: outstandingTotalCents,
      overdueOutstandingCents,
      autopayCount,
      autopayRatio,
    },
    activePlans,
    overduePlans,
    schedule,
    reminders,
    insights,
  };
}

async function getLayawayDetail(layawayId) {
  const numericId = Number(layawayId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new HttpError(400, 'Layaway id must be a positive integer');
  }

  const [layawayRow] = await db
    .select({
      id: layaways.id,
      branchId: layaways.branchId,
      customerId: layaways.customerId,
      orderId: layaways.orderId,
      status: layaways.status,
      totalCents: layaways.totalCents,
      paidCents: layaways.paidCents,
      dueDate: layaways.dueDate,
      pawnLoanId: layaways.pawnLoanId,
      pawnedAt: layaways.pawnedAt,
      createdAt: layaways.createdAt,
      updatedAt: layaways.updatedAt,
      branchName: branches.name,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
    })
    .from(layaways)
    .leftJoin(branches, eq(branches.id, layaways.branchId))
    .leftJoin(customers, eq(customers.id, layaways.customerId))
    .where(eq(layaways.id, numericId))
    .limit(1);

  if (!layawayRow) {
    throw new HttpError(404, 'Layaway not found');
  }

  const [orderRow] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      subtotalCents: orders.subtotalCents,
      taxCents: orders.taxCents,
      totalCents: orders.totalCents,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.id, layawayRow.orderId))
    .limit(1);

  const itemRows = await db
    .select({
      id: orderItems.id,
      productCodeVersionId: orderItems.productCodeVersionId,
      qty: orderItems.qty,
      unitPriceCents: orderItems.unitPriceCents,
      totalCents: orderItems.totalCents,
      productCode: productCodes.code,
      productName: productCodes.name,
    })
    .from(orderItems)
    .leftJoin(productCodeVersions, eq(productCodeVersions.id, orderItems.productCodeVersionId))
    .leftJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
    .where(eq(orderItems.orderId, layawayRow.orderId))
    .orderBy(asc(orderItems.id));

  const paymentRows = await db
    .select({
      id: layawayPayments.id,
      amountCents: layawayPayments.amountCents,
      method: layawayPayments.method,
      note: layawayPayments.note,
      createdAt: layawayPayments.createdAt,
    })
    .from(layawayPayments)
    .where(eq(layawayPayments.layawayId, numericId))
    .orderBy(desc(layawayPayments.createdAt), desc(layawayPayments.id));

  const totalCents = Number(layawayRow.totalCents ?? 0);
  const paidCents = Number(layawayRow.paidCents ?? 0);
  const balanceCents = Math.max(totalCents - paidCents, 0);

  const dueDate = layawayRow.dueDate instanceof Date
    ? layawayRow.dueDate
    : layawayRow.dueDate
    ? new Date(layawayRow.dueDate)
    : null;

  const dueDateIso = dueDate?.toISOString?.() ?? (typeof layawayRow.dueDate === 'string' ? layawayRow.dueDate : null);
  const now = Date.now();
  const overdueMs = dueDate && !Number.isNaN(dueDate.getTime()) ? now - dueDate.getTime() : 0;
  const overdueDays = overdueMs > 0 ? Math.floor(overdueMs / 86400000) : 0;

  const pawnedAtIso = layawayRow.pawnedAt?.toISOString?.() ?? layawayRow.pawnedAt ?? null;
  const createdAtIso = layawayRow.createdAt?.toISOString?.() ?? layawayRow.createdAt;
  const updatedAtIso = layawayRow.updatedAt?.toISOString?.() ?? layawayRow.updatedAt;

  const customerName = [layawayRow.customerFirstName, layawayRow.customerLastName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');

  return {
    layaway: {
      id: Number(layawayRow.id),
      branchId: Number(layawayRow.branchId),
      branchName: layawayRow.branchName ?? null,
      customerId: Number(layawayRow.customerId),
      customerName: customerName || null,
      orderId: Number(layawayRow.orderId),
      status: layawayRow.status,
      totalCents,
      paidCents,
      balanceCents,
      totalFormatted: formatPesosFromCents(totalCents),
      paidFormatted: formatPesosFromCents(paidCents),
      balanceFormatted: formatPesosFromCents(balanceCents),
      dueDate: dueDateIso,
      pawnLoanId: layawayRow.pawnLoanId == null ? null : Number(layawayRow.pawnLoanId),
      pawnedAt: pawnedAtIso,
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
      overdueDays,
      isOverdue: overdueDays > 0,
    },
    order: orderRow
      ? {
          id: Number(orderRow.id),
          orderNumber: orderRow.orderNumber,
          subtotalCents: Number(orderRow.subtotalCents ?? 0),
          taxCents: Number(orderRow.taxCents ?? 0),
          totalCents: Number(orderRow.totalCents ?? 0),
          status: orderRow.status,
          createdAt: orderRow.createdAt?.toISOString?.() ?? orderRow.createdAt,
        }
      : null,
    items: itemRows.map((item) => ({
      id: Number(item.id),
      productCodeVersionId: Number(item.productCodeVersionId),
      qty: Number(item.qty ?? 0),
      unitPriceCents: Number(item.unitPriceCents ?? 0),
      totalCents: Number(item.totalCents ?? 0),
      productCode: item.productCode,
      productName: item.productName,
      totalFormatted: formatPesosFromCents(item.totalCents),
      unitPriceFormatted: formatPesosFromCents(item.unitPriceCents),
    })),
    payments: paymentRows.map((payment) => ({
      id: Number(payment.id),
      amountCents: Number(payment.amountCents ?? 0),
      method: payment.method,
      note: payment.note,
      createdAt: payment.createdAt?.toISOString?.() ?? payment.createdAt,
      amountFormatted: formatPesosFromCents(payment.amountCents),
    })),
  };
}

async function generateUniqueBarcodeToken(executor, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = crypto.randomBytes(16).toString('hex');
    const [existing] = await executor
      .select({ id: instapawnIntakes.id })
      .from(instapawnIntakes)
      .where(eq(instapawnIntakes.barcodeToken, token))
      .limit(1);

    if (!existing) {
      return token;
    }
  }

  throw new Error('FAILED_TO_GENERATE_TOKEN');
}

function calculateBarcodeExpiry(hours) {
  const normalizedHours = Number(hours);
  const clamped = Number.isFinite(normalizedHours)
    ? Math.min(Math.max(normalizedHours, 1), 168)
    : 72;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + clamped);
  return expiresAt;
}

function serializeInstapawnIntake(row) {
  const collateralValue = Array.isArray(row.collateral)
    ? row.collateral
    : row.collateral == null
    ? []
    : (() => {
        try {
          const parsed = typeof row.collateral === 'string' ? JSON.parse(row.collateral) : row.collateral;
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          return [];
        }
      })();

  return {
    id: Number(row.id),
    branchId: Number(row.branchId),
    customerFirstName: row.customerFirstName,
    customerLastName: row.customerLastName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    governmentId: row.governmentId,
    itemCategory: row.itemCategory,
    itemDescription: row.itemDescription,
    collateral: collateralValue,
    requestedPrincipalCents:
      row.requestedPrincipalCents == null ? null : Number(row.requestedPrincipalCents),
    autoAppraisedValueCents:
      row.autoAppraisedValueCents == null ? null : Number(row.autoAppraisedValueCents),
    interestModelId: row.interestModelId == null ? null : Number(row.interestModelId),
    notes: row.notes,
    status: row.status,
    barcodeToken: row.barcodeToken,
    barcodeExpiresAt: row.barcodeExpiresAt?.toISOString?.() ?? row.barcodeExpiresAt,
    barcodeScannedAt: row.barcodeScannedAt?.toISOString?.() ?? row.barcodeScannedAt,
    notifiedAt: row.notifiedAt?.toISOString?.() ?? row.notifiedAt,
    convertedLoanId: row.convertedLoanId == null ? null : Number(row.convertedLoanId),
    convertedAt: row.convertedAt?.toISOString?.() ?? row.convertedAt,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    barcodeUrl: `${frontendBaseUrl}/loans/instapawn?token=${row.barcodeToken}`,
  };
};

const repairSelection = {
  id: repairs.id,
  branchId: repairs.branchId,
  customerId: repairs.customerId,
  jobNumber: repairs.jobNumber,
  itemDescription: repairs.itemDescription,
  issueDescription: repairs.issueDescription,
  diagnosis: repairs.diagnosis,
  estimateCents: repairs.estimateCents,
  depositCents: repairs.depositCents,
  approvalStatus: repairs.approvalStatus,
  approvalRequestedAt: repairs.approvalRequestedAt,
  approvalDecisionAt: repairs.approvalDecisionAt,
  status: repairs.status,
  promisedAt: repairs.promisedAt,
  totalPaidCents: repairs.totalPaidCents,
  notes: repairs.notes,
  createdAt: repairs.createdAt,
  updatedAt: repairs.updatedAt,
};

const repairPaymentSelection = {
  id: repairPayments.id,
  repairId: repairPayments.repairId,
  amountCents: repairPayments.amountCents,
  method: repairPayments.method,
  reference: repairPayments.reference,
  note: repairPayments.note,
  createdAt: repairPayments.createdAt,
};

const repairMaterialSelection = {
  id: repairMaterials.id,
  repairId: repairMaterials.repairId,
  productCodeVersionId: repairMaterials.productCodeVersionId,
  qtyIssued: repairMaterials.qtyIssued,
  qtyReturned: repairMaterials.qtyReturned,
  createdAt: repairMaterials.createdAt,
  updatedAt: repairMaterials.updatedAt,
};

const repairPhotoSelection = {
  id: repairPhotos.id,
  repairId: repairPhotos.repairId,
  storagePath: repairPhotos.storagePath,
  createdAt: repairPhotos.createdAt,
};

async function queueNotificationMessage(
  executor,
  { intakeId = null, loanId = null, repairId = null, customerId = null, channel, recipient, message }
) {
  await executor.insert(notificationMessages).values({
    intakeId,
    loanId,
    repairId,
    customerId,
    channel,
    recipient,
    message,
  });
}

function buildInstapawnNotificationMessage(intake, expiresAt) {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt ?? intake.barcodeExpiresAt);
  const expiryString = Number.isNaN(expiry.getTime())
    ? null
    : `${expiry.toLocaleDateString('es-DO')} ${expiry.toLocaleTimeString('es-DO', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;

  const greetingName = intake.customerFirstName || 'cliente';

  return [
    `Hola ${greetingName},`,
    'tu solicitud InstaPawn está lista.',
    `Código: ${intake.barcodeToken}`,
    expiryString ? `Vence: ${expiryString}` : null,
    'Preséntalo en la sucursal para convertirlo en préstamo.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildInstapawnConversionMessage(intake, ticketNumber) {
  const greetingName = intake.customerFirstName || 'cliente';
  const ticketInfo = ticketNumber ? `Ticket ${ticketNumber}.` : '';
  return `Hola ${greetingName}, tu préstamo ya fue creado. ${ticketInfo}`.trim();
}

const repairStatuses = [
  'intake',
  'diagnosing',
  'waiting_approval',
  'in_progress',
  'qa',
  'ready',
  'completed',
  'cancelled',
];

const repairApprovalStatuses = ['not_requested', 'pending', 'approved', 'denied'];
const repairPaymentMethods = ['cash', 'card', 'transfer', 'store_credit', 'other'];

function generateRepairJobNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RP-${stamp}-${random}`;
}

function normalizeNullableText(value, maxLength = 2000) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function parseOptionalDateTimeInput(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isValidRepairStatus(status) {
  return repairStatuses.includes(status);
}

function mapRepairListRow(row) {
  const estimateCents = row.estimateCents == null ? null : Number(row.estimateCents);
  const totalPaidCents = row.totalPaidCents == null ? 0 : Number(row.totalPaidCents);
  const balanceDueCents = estimateCents == null ? null : Math.max(estimateCents - totalPaidCents, 0);

  return {
    id: Number(row.id),
    branchId: Number(row.branchId),
    branchName: row.branchName ?? null,
    customerId: Number(row.customerId),
    customerName: [row.customerFirstName, row.customerLastName].filter(Boolean).join(' ') || null,
    jobNumber: row.jobNumber,
    itemDescription: row.itemDescription ?? null,
    issueDescription: row.issueDescription ?? null,
    status: row.status,
    approvalStatus: row.approvalStatus,
    estimateCents,
    depositCents: row.depositCents == null ? 0 : Number(row.depositCents),
    totalPaidCents,
    balanceDueCents,
    promisedAt: toIsoString(row.promisedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapRepairDetailRow(row) {
  const estimateCents = row.estimateCents == null ? null : Number(row.estimateCents);
  const totalPaidCents = row.totalPaidCents == null ? 0 : Number(row.totalPaidCents);
  const balanceDueCents = estimateCents == null ? null : Math.max(estimateCents - totalPaidCents, 0);

  return {
    id: Number(row.id),
    branch: {
      id: Number(row.branchId),
      name: row.branchName ?? null,
    },
    customer: {
      id: Number(row.customerId),
      firstName: row.customerFirstName ?? null,
      lastName: row.customerLastName ?? null,
      phone: row.customerPhone ?? null,
      email: row.customerEmail ?? null,
    },
    jobNumber: row.jobNumber,
    itemDescription: row.itemDescription ?? null,
    issueDescription: row.issueDescription ?? null,
    diagnosis: row.diagnosis ?? null,
    estimateCents,
    depositCents: row.depositCents == null ? 0 : Number(row.depositCents),
    approvalStatus: row.approvalStatus,
    approvalRequestedAt: toIsoString(row.approvalRequestedAt),
    approvalDecisionAt: toIsoString(row.approvalDecisionAt),
    status: row.status,
    promisedAt: toIsoString(row.promisedAt),
    totalPaidCents,
    balanceDueCents,
    notes: row.notes ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapRepairPhotoRow(row) {
  return {
    id: Number(row.id),
    storagePath: row.storagePath,
    createdAt: toIsoString(row.createdAt),
  };
}

function mapRepairPaymentRow(row) {
  return {
    id: Number(row.id),
    amountCents: Number(row.amountCents),
    method: row.method,
    reference: row.reference ?? null,
    note: row.note ?? null,
    createdAt: toIsoString(row.createdAt),
  };
}

function mapRepairMaterialRow(row) {
  return {
    id: Number(row.id),
    productCodeVersionId: Number(row.productCodeVersionId),
    productCodeId: row.productCodeId == null ? null : Number(row.productCodeId),
    code: row.code ?? null,
    name: row.name ?? null,
    qtyIssued: Number(row.qtyIssued ?? 0),
    qtyReturned: Number(row.qtyReturned ?? 0),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function getRepairDetail(executor, repairId) {
  const [repairRow] = await executor
    .select({
      ...repairSelection,
      branchName: branches.name,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerPhone: customers.phone,
      customerEmail: customers.email,
    })
    .from(repairs)
    .leftJoin(branches, eq(repairs.branchId, branches.id))
    .leftJoin(customers, eq(repairs.customerId, customers.id))
    .where(eq(repairs.id, repairId))
    .limit(1);

  if (!repairRow) {
    return null;
  }

  const [photos, payments, materials] = await Promise.all([
    executor
      .select(repairPhotoSelection)
      .from(repairPhotos)
      .where(eq(repairPhotos.repairId, repairId))
      .orderBy(asc(repairPhotos.createdAt), asc(repairPhotos.id)),
    executor
      .select(repairPaymentSelection)
      .from(repairPayments)
      .where(eq(repairPayments.repairId, repairId))
      .orderBy(asc(repairPayments.createdAt), asc(repairPayments.id)),
    executor
      .select({
        ...repairMaterialSelection,
        productCodeId: productCodes.id,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(repairMaterials)
      .innerJoin(
        productCodeVersions,
        eq(repairMaterials.productCodeVersionId, productCodeVersions.id)
      )
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .where(eq(repairMaterials.repairId, repairId))
      .orderBy(asc(repairMaterials.createdAt), asc(repairMaterials.id)),
  ]);

  const detail = mapRepairDetailRow(repairRow);

  return {
    ...detail,
    photos: photos.map(mapRepairPhotoRow),
    payments: payments.map(mapRepairPaymentRow),
    materials: materials.map(mapRepairMaterialRow),
  };
}

function determineIntakeExpirationState(intake) {
  if (!intake.barcodeExpiresAt) {
    return false;
  }

  const expiresAt = new Date(intake.barcodeExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() < Date.now();
}

function serializeNotificationMessage(row) {
  return {
    id: Number(row.id),
    intakeId: row.intakeId == null ? null : Number(row.intakeId),
    loanId: row.loanId == null ? null : Number(row.loanId),
    customerId: row.customerId == null ? null : Number(row.customerId),
    channel: row.channel,
    recipient: row.recipient,
    message: row.message,
    status: row.status,
    error: row.error,
    sentAt: row.sentAt?.toISOString?.() ?? row.sentAt,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  };
}

async function fetchNotificationMap(executor, intakeIds) {
  if (!Array.isArray(intakeIds) || intakeIds.length === 0) {
    return new Map();
  }

  const rows = await executor
    .select({
      id: notificationMessages.id,
      intakeId: notificationMessages.intakeId,
      loanId: notificationMessages.loanId,
      customerId: notificationMessages.customerId,
      channel: notificationMessages.channel,
      recipient: notificationMessages.recipient,
      message: notificationMessages.message,
      status: notificationMessages.status,
      error: notificationMessages.error,
      sentAt: notificationMessages.sentAt,
      createdAt: notificationMessages.createdAt,
    })
    .from(notificationMessages)
    .where(inArray(notificationMessages.intakeId, intakeIds))
    .orderBy(asc(notificationMessages.createdAt), asc(notificationMessages.id));

  const grouped = new Map();

  for (const row of rows) {
    const intakeId = row.intakeId == null ? null : Number(row.intakeId);

    if (intakeId == null) {
      continue;
    }

    if (!grouped.has(intakeId)) {
      grouped.set(intakeId, []);
    }

    grouped.get(intakeId).push(serializeNotificationMessage(row));
  }

  return grouped;
}

async function fetchLoanNotificationMap(executor, loanIds) {
  if (!Array.isArray(loanIds) || loanIds.length === 0) {
    return new Map();
  }

  const rows = await executor
    .select({
      id: notificationMessages.id,
      intakeId: notificationMessages.intakeId,
      loanId: notificationMessages.loanId,
      customerId: notificationMessages.customerId,
      channel: notificationMessages.channel,
      recipient: notificationMessages.recipient,
      message: notificationMessages.message,
      status: notificationMessages.status,
      error: notificationMessages.error,
      sentAt: notificationMessages.sentAt,
      createdAt: notificationMessages.createdAt,
    })
    .from(notificationMessages)
    .where(inArray(notificationMessages.loanId, loanIds))
    .orderBy(asc(notificationMessages.createdAt), asc(notificationMessages.id));

  const grouped = new Map();

  for (const row of rows) {
    const loanId = row.loanId == null ? null : Number(row.loanId);

    if (loanId == null) {
      continue;
    }

    if (!grouped.has(loanId)) {
      grouped.set(loanId, []);
    }

    grouped.get(loanId).push(serializeNotificationMessage(row));
  }

  return grouped;
}

function sanitizeProductCode(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function buildDefaultForfeitCode(ticketNumber, collateralId) {
  const base = `PF-${ticketNumber ?? 'TKT'}-${collateralId}`;
  return sanitizeProductCode(base) || `PF-${collateralId}`;
}

function computeLoanBalance(loan, schedule, payments) {
  const principalCents = Math.max(0, Number(loan.principalCents ?? 0));
  const interestAccruedCents = schedule.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.interestCents ?? 0)),
    0
  );
  const feeAccruedCents = schedule.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.feeCents ?? 0)),
    0
  );

  const interestKinds = new Set(['interest', 'renew', 'extension']);
  const principalKinds = new Set(['advance', 'redeem', 'rewrite']);

  const totals = payments.reduce(
    (acc, payment) => {
      const amount = Math.max(0, Number(payment.amountCents ?? 0));

      if (interestKinds.has(payment.kind)) {
        acc.interestPaid += amount;
      }

      if (principalKinds.has(payment.kind)) {
        acc.principalPaid += amount;
      }

      acc.totalPaid += amount;
      return acc;
    },
    { interestPaid: 0, principalPaid: 0, totalPaid: 0 }
  );

  const outstandingPrincipal = Math.max(0, principalCents - totals.principalPaid);
  const outstandingInterest = Math.max(0, interestAccruedCents + feeAccruedCents - totals.interestPaid);

  return {
    principalCents,
    interestAccruedCents,
    feeAccruedCents,
    interestPaidCents: totals.interestPaid,
    principalPaidCents: totals.principalPaid,
    totalPaidCents: totals.totalPaid,
    outstandingPrincipalCents: outstandingPrincipal,
    outstandingInterestCents: outstandingInterest,
    totalDueCents: outstandingPrincipal + outstandingInterest,
  };
}

function deriveLoanAlerts(loan, balance, schedule) {
  const alerts = [];
  const dueDateValue = formatDateValue(loan.dueDate);

  if (loan.status === 'redeemed') {
    alerts.push({ type: 'success', message: 'Ticket redimido' });
  } else if (loan.status === 'forfeited') {
    alerts.push({ type: 'warning', message: 'Ticket marcado como abandonado' });
  }

  if (dueDateValue && loan.status !== 'redeemed' && loan.status !== 'forfeited') {
    const today = new Date();
    const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const dueDate = Date.parse(`${dueDateValue}T00:00:00Z`);

    if (!Number.isNaN(dueDate)) {
      const diffDays = Math.floor((dueDate - utcToday) / 86_400_000);

      if (diffDays < 0) {
        alerts.push({ type: 'danger', message: `Atraso de ${Math.abs(diffDays)} día(s)` });
      } else if (diffDays === 0) {
        alerts.push({ type: 'warning', message: 'Vence hoy' });
      } else if (diffDays <= 3) {
        alerts.push({ type: 'warning', message: `Vence en ${diffDays} día(s)` });
      }
    }
  }

  if (balance.outstandingInterestCents > 0 && loan.status !== 'redeemed' && loan.status !== 'forfeited') {
    alerts.push({
      type: 'info',
      message: 'Intereses pendientes',
      interestDueCents: balance.outstandingInterestCents,
    });
  }

  if (schedule.length === 0 && loan.status !== 'redeemed' && loan.status !== 'forfeited') {
    alerts.push({ type: 'warning', message: 'Sin calendario registrado' });
  }

  return alerts;
}

function buildPastDueLoanSnapshot(loanRow, scheduleRows, paymentRows, { now = new Date(), notifications = [] } = {}) {
  const dueDate = formatDateValue(loanRow.dueDate);
  const calendarDaysLate = calculateCalendarDaysLate(dueDate, now);
  const graceDays = loanRow.graceDays == null ? 0 : Math.max(0, Number(loanRow.graceDays));
  const effectiveDaysLate = calendarDaysLate == null ? null : Math.max(0, calendarDaysLate - graceDays);

  if (effectiveDaysLate == null || effectiveDaysLate <= 0) {
    return null;
  }

  const balance = computeLoanBalance(loanRow, scheduleRows, paymentRows);
  const outstandingPrincipal = Math.max(0, Number(balance.outstandingPrincipalCents ?? 0));
  const outstandingInterest = Math.max(0, Number(balance.outstandingInterestCents ?? 0));
  const totalDue = Math.max(0, Number(balance.totalDueCents ?? 0));

  const lastPaymentRow = paymentRows.length > 0 ? paymentRows[0] : null;
  const lastNotification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  const customerFirstName = loanRow.customerFirstName ?? null;
  const customerLastName = loanRow.customerLastName ?? null;
  const fullName = [customerFirstName, customerLastName].filter(Boolean).join(' ') || null;

  return {
    id: Number(loanRow.id),
    branchId: Number(loanRow.branchId),
    branchName: loanRow.branchName ?? null,
    customerId: loanRow.customerId == null ? null : Number(loanRow.customerId),
    ticketNumber: loanRow.ticketNumber,
    status: loanRow.status,
    dueDate,
    graceDays,
    calendarDaysLate,
    daysLate: effectiveDaysLate,
    bucket: determinePastDueBucket(effectiveDaysLate),
    principalCents: Math.max(0, Number(loanRow.principalCents ?? 0)),
    interestModelId: loanRow.interestModelId == null ? null : Number(loanRow.interestModelId),
    interestModelName: loanRow.interestModelName ?? null,
    outstandingPrincipalCents: outstandingPrincipal,
    outstandingInterestCents: outstandingInterest,
    totalDueCents: totalDue,
    balance,
    customer: {
      id: loanRow.customerId == null ? null : Number(loanRow.customerId),
      firstName: customerFirstName,
      lastName: customerLastName,
      fullName,
      phone: loanRow.customerPhone ?? null,
      email: loanRow.customerEmail ?? null,
    },
    contactPhone: loanRow.customerPhone ?? null,
    lastPayment:
      lastPaymentRow == null
        ? null
        : {
            id: Number(lastPaymentRow.id),
            amountCents: Math.max(0, Number(lastPaymentRow.amountCents ?? 0)),
            kind: lastPaymentRow.kind,
            method: lastPaymentRow.method,
            createdAt: lastPaymentRow.createdAt,
          },
    paymentsCount: paymentRows.length,
    notifications,
    lastOutreachAt: lastNotification?.createdAt ?? null,
  };
}

async function hydratePastDueLoans(executor, loanRows, { includeNotifications = false, now = new Date() } = {}) {
  if (!Array.isArray(loanRows) || loanRows.length === 0) {
    return [];
  }

  const loanIds = loanRows
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (loanIds.length === 0) {
    return [];
  }

  const scheduleRows = await executor
    .select({
      id: loanSchedules.id,
      loanId: loanSchedules.loanId,
      dueOn: loanSchedules.dueOn,
      interestCents: loanSchedules.interestCents,
      feeCents: loanSchedules.feeCents,
      createdAt: loanSchedules.createdAt,
    })
    .from(loanSchedules)
    .where(inArray(loanSchedules.loanId, loanIds))
    .orderBy(asc(loanSchedules.dueOn), asc(loanSchedules.id));

  const paymentRows = await executor
    .select({
      id: loanPayments.id,
      loanId: loanPayments.loanId,
      kind: loanPayments.kind,
      amountCents: loanPayments.amountCents,
      method: loanPayments.method,
      createdAt: loanPayments.createdAt,
    })
    .from(loanPayments)
    .where(inArray(loanPayments.loanId, loanIds))
    .orderBy(desc(loanPayments.createdAt), desc(loanPayments.id));

  const schedulesByLoan = new Map();
  for (const row of scheduleRows) {
    const loanId = Number(row.loanId);
    if (!schedulesByLoan.has(loanId)) {
      schedulesByLoan.set(loanId, []);
    }

    schedulesByLoan.get(loanId).push({
      id: Number(row.id),
      loanId,
      dueOn: formatDateValue(row.dueOn),
      interestCents: Math.max(0, Number(row.interestCents ?? 0)),
      feeCents: Math.max(0, Number(row.feeCents ?? 0)),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    });
  }

  const paymentsByLoan = new Map();
  for (const row of paymentRows) {
    const loanId = Number(row.loanId);
    if (!paymentsByLoan.has(loanId)) {
      paymentsByLoan.set(loanId, []);
    }

    paymentsByLoan.get(loanId).push({
      id: Number(row.id),
      loanId,
      kind: row.kind,
      method: row.method,
      amountCents: Math.max(0, Number(row.amountCents ?? 0)),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    });
  }

  let notificationMap = null;
  if (includeNotifications) {
    notificationMap = await fetchLoanNotificationMap(executor, loanIds);
  }

  const snapshots = [];

  for (const loanRow of loanRows) {
    const loanId = Number(loanRow.id);
    const schedule = schedulesByLoan.get(loanId) ?? [];
    const payments = paymentsByLoan.get(loanId) ?? [];
    const notifications = notificationMap?.get(loanId) ?? [];
    const snapshot = buildPastDueLoanSnapshot(loanRow, schedule, payments, { now, notifications });

    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}

async function hydrateLoanAgingSnapshots(executor, loanRows, { now = new Date() } = {}) {
  if (!Array.isArray(loanRows) || loanRows.length === 0) {
    return [];
  }

  const loanIds = loanRows
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (loanIds.length === 0) {
    return [];
  }

  const scheduleRows = await executor
    .select({
      id: loanSchedules.id,
      loanId: loanSchedules.loanId,
      dueOn: loanSchedules.dueOn,
      interestCents: loanSchedules.interestCents,
      feeCents: loanSchedules.feeCents,
      createdAt: loanSchedules.createdAt,
    })
    .from(loanSchedules)
    .where(inArray(loanSchedules.loanId, loanIds))
    .orderBy(asc(loanSchedules.dueOn), asc(loanSchedules.id));

  const paymentRows = await executor
    .select({
      id: loanPayments.id,
      loanId: loanPayments.loanId,
      kind: loanPayments.kind,
      amountCents: loanPayments.amountCents,
      method: loanPayments.method,
      createdAt: loanPayments.createdAt,
    })
    .from(loanPayments)
    .where(inArray(loanPayments.loanId, loanIds))
    .orderBy(desc(loanPayments.createdAt), desc(loanPayments.id));

  const schedulesByLoan = new Map();
  for (const row of scheduleRows) {
    const loanId = Number(row.loanId);
    if (!schedulesByLoan.has(loanId)) {
      schedulesByLoan.set(loanId, []);
    }

    schedulesByLoan.get(loanId).push({
      id: Number(row.id),
      loanId,
      dueOn: formatDateValue(row.dueOn),
      interestCents: Math.max(0, Number(row.interestCents ?? 0)),
      feeCents: Math.max(0, Number(row.feeCents ?? 0)),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    });
  }

  const paymentsByLoan = new Map();
  for (const row of paymentRows) {
    const loanId = Number(row.loanId);
    if (!paymentsByLoan.has(loanId)) {
      paymentsByLoan.set(loanId, []);
    }

    paymentsByLoan.get(loanId).push({
      id: Number(row.id),
      loanId,
      kind: row.kind,
      method: row.method,
      amountCents: Math.max(0, Number(row.amountCents ?? 0)),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    });
  }

  const snapshots = [];

  for (const loanRow of loanRows) {
    const loanId = Number(loanRow.id);
    const schedule = schedulesByLoan.get(loanId) ?? [];
    const payments = paymentsByLoan.get(loanId) ?? [];
    const balance = computeLoanBalance(loanRow, schedule, payments);

    const dueDate = formatDateValue(loanRow.dueDate);
    const calendarDaysLate = calculateCalendarDaysLate(dueDate, now);
    const graceDays = loanRow.graceDays == null ? 0 : Math.max(0, Number(loanRow.graceDays));
    const effectiveDaysLate = calendarDaysLate == null ? null : Math.max(0, calendarDaysLate - graceDays);
    const bucket = determinePastDueBucket(effectiveDaysLate);

    const outstandingPrincipal = Math.max(0, Number(balance.outstandingPrincipalCents ?? 0));
    const outstandingInterest = Math.max(0, Number(balance.outstandingInterestCents ?? 0));
    const totalDue = Math.max(0, Number(balance.totalDueCents ?? 0));

    const customerFirstName = loanRow.customerFirstName ?? null;
    const customerLastName = loanRow.customerLastName ?? null;
    const fullName = [customerFirstName, customerLastName].filter(Boolean).join(' ') || null;

    snapshots.push({
      id: loanId,
      branchId: loanRow.branchId == null ? null : Number(loanRow.branchId),
      branchName: loanRow.branchName ?? null,
      customerId: loanRow.customerId == null ? null : Number(loanRow.customerId),
      ticketNumber: loanRow.ticketNumber,
      status: loanRow.status,
      dueDate,
      graceDays,
      calendarDaysLate,
      daysLate: effectiveDaysLate,
      bucket,
      principalCents: Math.max(0, Number(loanRow.principalCents ?? 0)),
      outstandingPrincipalCents: outstandingPrincipal,
      outstandingInterestCents: outstandingInterest,
      totalDueCents: totalDue,
      balance,
      customer: {
        id: loanRow.customerId == null ? null : Number(loanRow.customerId),
        firstName: customerFirstName,
        lastName: customerLastName,
        fullName,
        phone: loanRow.customerPhone ?? null,
        email: loanRow.customerEmail ?? null,
      },
    });
  }

  return snapshots;
}

function buildLoanOutreachContext(snapshot) {
  const totalDueCents = Math.max(0, Number(snapshot?.totalDueCents ?? 0));
  const outstandingPrincipalCents = Math.max(0, Number(snapshot?.outstandingPrincipalCents ?? 0));
  const outstandingInterestCents = Math.max(0, Number(snapshot?.outstandingInterestCents ?? 0));

  return {
    customerFirstName: snapshot?.customer?.firstName ?? '',
    customerLastName: snapshot?.customer?.lastName ?? '',
    customerName:
      snapshot?.customer?.fullName || [snapshot?.customer?.firstName, snapshot?.customer?.lastName].filter(Boolean).join(' '),
    ticketNumber: snapshot?.ticketNumber ?? '',
    dueDate: snapshot?.dueDate ?? '',
    daysLate: snapshot?.daysLate ?? 0,
    calendarDaysLate: snapshot?.calendarDaysLate ?? snapshot?.daysLate ?? 0,
    graceDays: snapshot?.graceDays ?? 0,
    totalDueCents,
    outstandingPrincipalCents,
    outstandingInterestCents,
    totalDueFormatted: formatPesosFromCents(totalDueCents),
    outstandingPrincipalFormatted: formatPesosFromCents(outstandingPrincipalCents),
    outstandingInterestFormatted: formatPesosFromCents(outstandingInterestCents),
    branchName: snapshot?.branchName ?? '',
  };
}

function renderOutreachTemplate(template, context) {
  if (typeof template !== 'string') {
    return '';
  }

  const replacements = new Map(
    Object.entries({
      customerfirstname: context.customerFirstName ?? '',
      customerlastname: context.customerLastName ?? '',
      customername: context.customerName ?? '',
      ticketnumber: context.ticketNumber ?? '',
      duedate: context.dueDate ?? '',
      dayslate: context.daysLate == null ? '' : String(context.daysLate),
      calendardayslate:
        context.calendarDaysLate == null ? '' : String(context.calendarDaysLate ?? context.daysLate ?? ''),
      gracedays: context.graceDays == null ? '' : String(context.graceDays),
      totaldue: context.totalDueFormatted ?? '',
      totalduecents: context.totalDueCents == null ? '' : String(context.totalDueCents),
      principaldue: context.outstandingPrincipalFormatted ?? '',
      principalduecents:
        context.outstandingPrincipalCents == null ? '' : String(context.outstandingPrincipalCents),
      interestdue: context.outstandingInterestFormatted ?? '',
      interestduecents:
        context.outstandingInterestCents == null ? '' : String(context.outstandingInterestCents),
      branchname: context.branchName ?? '',
    })
  );

  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    const normalized = String(key ?? '').toLowerCase();
    return replacements.get(normalized) ?? '';
  });
}

async function getLoanDetail(loanId) {
  const [loanRow] = await db
    .select({
      id: loans.id,
      branchId: loans.branchId,
      customerId: loans.customerId,
      ticketNumber: loans.ticketNumber,
      principalCents: loans.principalCents,
      interestModelId: loans.interestModelId,
      interestRate: loans.interestRate,
      dueDate: loans.dueDate,
      status: loans.status,
      comments: loans.comments,
      createdAt: loans.createdAt,
      updatedAt: loans.updatedAt,
      interestModelName: interestModels.name,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerPhone: customers.phone,
      customerEmail: customers.email,
    })
    .from(loans)
    .leftJoin(interestModels, eq(interestModels.id, loans.interestModelId))
    .leftJoin(customers, eq(customers.id, loans.customerId))
    .where(eq(loans.id, loanId))
    .limit(1);

  if (!loanRow) {
    throw new HttpError(404, 'Loan not found');
  }

  const collateralRows = await db
    .select({
      id: loanCollateral.id,
      description: loanCollateral.description,
      estimatedValueCents: loanCollateral.estimatedValueCents,
      photoPath: loanCollateral.photoPath,
    })
    .from(loanCollateral)
    .where(eq(loanCollateral.loanId, loanId))
    .orderBy(asc(loanCollateral.id));

  const scheduleRows = await db
    .select({
      id: loanSchedules.id,
      dueOn: loanSchedules.dueOn,
      interestCents: loanSchedules.interestCents,
      feeCents: loanSchedules.feeCents,
      createdAt: loanSchedules.createdAt,
    })
    .from(loanSchedules)
    .where(eq(loanSchedules.loanId, loanId))
    .orderBy(asc(loanSchedules.dueOn), asc(loanSchedules.id));

  const paymentRows = await db
    .select({
      id: loanPayments.id,
      kind: loanPayments.kind,
      amountCents: loanPayments.amountCents,
      method: loanPayments.method,
      createdAt: loanPayments.createdAt,
    })
    .from(loanPayments)
    .where(eq(loanPayments.loanId, loanId))
    .orderBy(desc(loanPayments.createdAt), desc(loanPayments.id));

  const [forfeitureRow] = await db
    .select({
      id: loanForfeitures.id,
      productCodeId: loanForfeitures.codeId,
      createdAt: loanForfeitures.createdAt,
      productCode: productCodes.code,
      productName: productCodes.name,
    })
    .from(loanForfeitures)
    .leftJoin(productCodes, eq(productCodes.id, loanForfeitures.codeId))
    .where(eq(loanForfeitures.loanId, loanId))
    .orderBy(desc(loanForfeitures.id))
    .limit(1);

  const balance = computeLoanBalance(loanRow, scheduleRows, paymentRows);
  const alerts = deriveLoanAlerts(loanRow, balance, scheduleRows);

  const loanDetail = {
    id: loanRow.id,
    branchId: loanRow.branchId,
    customerId: loanRow.customerId,
    ticketNumber: loanRow.ticketNumber,
    principalCents: Math.max(0, Number(loanRow.principalCents ?? 0)),
    interestModelId: loanRow.interestModelId,
    interestModelName: loanRow.interestModelName ?? null,
    interestRate: loanRow.interestRate == null ? null : Number(loanRow.interestRate),
    dueDate: formatDateValue(loanRow.dueDate),
    status: loanRow.status,
    comments: loanRow.comments,
    createdAt: loanRow.createdAt?.toISOString?.() ?? loanRow.createdAt,
    updatedAt: loanRow.updatedAt?.toISOString?.() ?? loanRow.updatedAt,
    customer: {
      id: loanRow.customerId,
      firstName: loanRow.customerFirstName ?? null,
      lastName: loanRow.customerLastName ?? null,
      phone: loanRow.customerPhone ?? null,
      email: loanRow.customerEmail ?? null,
    },
  };

  return {
    loan: loanDetail,
    collateral: collateralRows.map((item) => ({
      ...item,
      estimatedValueCents: item.estimatedValueCents == null ? null : Number(item.estimatedValueCents),
    })),
    schedule: scheduleRows.map((entry) => ({
      ...entry,
      dueOn: formatDateValue(entry.dueOn),
      createdAt: entry.createdAt?.toISOString?.() ?? entry.createdAt,
    })),
    history: paymentRows.map((payment) => ({
      ...payment,
      amountCents: Math.max(0, Number(payment.amountCents ?? 0)),
      createdAt: payment.createdAt?.toISOString?.() ?? payment.createdAt,
    })),
    balance,
    alerts,
    forfeiture: forfeitureRow
      ? {
          id: forfeitureRow.id,
          productCodeId: forfeitureRow.productCodeId,
          productCode: forfeitureRow.productCode ?? null,
          productName: forfeitureRow.productName ?? null,
          createdAt: forfeitureRow.createdAt?.toISOString?.() ?? forfeitureRow.createdAt,
        }
      : null,
  };
}

async function recordShiftMovement({
  shiftId,
  performerId,
  pin,
  amountCents,
  reason,
  kind,
  direction,
}) {
  const amount = Number(amountCents);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'amountCents must be a positive number');
  }

  if (!Number.isInteger(shiftId) || shiftId <= 0) {
    throw new HttpError(400, 'shiftId must be a positive number');
  }

  if (!Number.isInteger(performerId) || performerId <= 0) {
    throw new HttpError(400, 'performedBy must be a positive number');
  }

  if (!pin) {
    throw new HttpError(400, 'pin is required');
  }

  if (typeof direction !== 'number') {
    throw new HttpError(400, 'Unsupported cash movement kind');
  }

  if (direction < 0 && !reason) {
    const formattedKind = typeof kind === 'string' ? kind.replace(/_/g, ' ') : 'this';
    throw new HttpError(400, `reason is required for ${formattedKind} movements`);
  }

  const [shift] = await db
    .select(shiftSelection)
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (!shift) {
    throw new HttpError(404, 'Shift not found');
  }

  if (shift.closedAt) {
    throw new HttpError(409, 'Shift is already closed');
  }

  const [user] = await db
    .select({ id: users.id, branchId: users.branchId, pinHash: users.pinHash })
    .from(users)
    .where(eq(users.id, performerId))
    .limit(1);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  if (Number(user.branchId) !== Number(shift.branchId)) {
    throw new HttpError(403, 'User is not assigned to this branch');
  }

  if (!verifyPin(pin, user.pinHash)) {
    throw new HttpError(403, 'Invalid PIN');
  }

  const baseExpected = Number(shift.expectedCashCents ?? shift.openingCashCents ?? 0);
  const nextExpected = baseExpected + direction * amount;

  if (nextExpected < 0) {
    throw new HttpError(400, 'Movement would result in negative expected cash');
  }

  const result = await db.transaction(async (tx) => {
    await tx.insert(cashMovements).values({
      shiftId,
      kind,
      amountCents: amount,
      reason,
    });

    await tx
      .update(shifts)
      .set({ expectedCashCents: nextExpected })
      .where(eq(shifts.id, shiftId));

    const [[updatedShift], [movement]] = await Promise.all([
      tx.select(shiftSelection).from(shifts).where(eq(shifts.id, shiftId)).limit(1),
      tx
        .select(cashMovementSelection)
        .from(cashMovements)
        .where(eq(cashMovements.shiftId, shiftId))
        .orderBy(desc(cashMovements.id))
        .limit(1),
    ]);

    if (!updatedShift || !movement) {
      throw new Error('FAILED_TO_RECORD_MOVEMENT');
    }

    return { shift: updatedShift, movement };
  });

  return result;
}

async function loadShiftMovements(shiftId) {
  const [shift] = await db
    .select(shiftSelection)
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (!shift) {
    return null;
  }

  const movementRows = await db
    .select(cashMovementSelection)
    .from(cashMovements)
    .where(eq(cashMovements.shiftId, shiftId))
    .orderBy(desc(cashMovements.id));

  const totalsByKind = movementRows.reduce((acc, row) => {
    const key = row.kind;
    const amount = Number(row.amountCents ?? 0);

    if (!acc[key]) {
      acc[key] = { totalCents: 0, count: 0 };
    }

    acc[key].totalCents += amount;
    acc[key].count += 1;
    return acc;
  }, {});

  const netMovementCents = movementRows.reduce((sum, row) => {
    const direction = cashMovementDirection[row.kind] ?? 0;
    return sum + direction * Number(row.amountCents ?? 0);
  }, 0);

  return {
    shift,
    movements: movementRows,
    summary: {
      totalsByKind,
      netMovementCents,
    },
  };
}

function createShiftMovementHandler(kind, direction) {
  return async (req, res, next) => {
    try {
      const shiftId = Number(req.params.id);

      const { amountCents, performedBy, pin, reason = null } = req.body ?? {};

      if (!performedBy || !pin) {
        return res.status(400).json({ error: 'performedBy and pin are required' });
      }

      const performerId = Number(performedBy);

      const amount = parseAmount(amountCents);

      if (amount === null) {
        return res.status(400).json({ error: 'amountCents must be a positive number' });
      }

      const normalizedReason = normalizeReasonInput(reason);

      const result = await recordShiftMovement({
        shiftId,
        performerId,
        pin,
        amountCents: amount,
        reason: normalizedReason,
        kind,
        direction,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      if (error instanceof Error && error.message === 'FAILED_TO_RECORD_MOVEMENT') {
        return res.status(500).json({ error: 'Unable to record cash movement' });
      }

      next(error);
    }
  };
}

async function findLatestClosedShiftId(branchId = null) {
  const filters = [isNotNull(shifts.closedAt)];

  if (branchId != null) {
    filters.push(eq(shifts.branchId, branchId));
  }

  const condition = filters.length === 1 ? filters[0] : and(...filters);

  const [row] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(condition)
    .orderBy(desc(shifts.closedAt), desc(shifts.id))
    .limit(1);

  return row ? Number(row.id) : null;
}

async function buildShiftEndReport(shiftId) {
  const numericShiftId = Number(shiftId);

  if (!Number.isInteger(numericShiftId) || numericShiftId <= 0) {
    throw new HttpError(400, 'shiftId must be a positive integer');
  }

  // Use raw SQL to avoid alias conflict when joining users table twice
  const result = await db.execute(sql`
    SELECT 
      s.id,
      s.branch_id as branchId,
      b.name as branchName,
      s.opened_by as openedBy,
      opened_user.full_name as openedByName,
      s.closed_by as closedBy,
      closed_user.full_name as closedByName,
      s.opening_cash_cents as openingCashCents,
      s.closing_cash_cents as closingCashCents,
      s.expected_cash_cents as expectedCashCents,
      s.over_short_cents as overShortCents,
      s.opened_at as openedAt,
      s.closed_at as closedAt
    FROM shifts s
    LEFT JOIN branches b ON s.branch_id = b.id
    LEFT JOIN users opened_user ON s.opened_by = opened_user.id
    LEFT JOIN users closed_user ON s.closed_by = closed_user.id
    WHERE s.id = ${numericShiftId}
    LIMIT 1
  `);

  const shiftRow = result[0]?.[0];

  if (!shiftRow) {
    return null;
  }

  const [snapshotRows, paymentAggregateRows, paymentRows, movementRows, recentShiftsRows] =
    await Promise.all([
    db
      .select({ snapshot: shiftReports.snapshot })
      .from(shiftReports)
      .where(eq(shiftReports.shiftId, numericShiftId))
      .limit(1),
    db
      .select({
        method: payments.method,
        totalCents: sql`COALESCE(SUM(${payments.amountCents}), 0)`,
        count: sql`COUNT(*)`,
      })
      .from(payments)
      .where(eq(payments.shiftId, numericShiftId))
      .groupBy(payments.method),
    db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        invoiceId: payments.invoiceId,
        method: payments.method,
        amountCents: payments.amountCents,
        meta: payments.meta,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.shiftId, numericShiftId))
      .orderBy(asc(payments.createdAt), asc(payments.id)),
    db
      .select({
        id: cashMovements.id,
        kind: cashMovements.kind,
        amountCents: cashMovements.amountCents,
        reason: cashMovements.reason,
        createdAt: cashMovements.createdAt,
      })
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, numericShiftId))
      .orderBy(asc(cashMovements.createdAt), asc(cashMovements.id)),
    (async () => {
      const recentFilters = [isNotNull(shifts.closedAt)];
      if (shiftRow.branchId != null) {
        recentFilters.push(eq(shifts.branchId, Number(shiftRow.branchId)));
      }
      const condition = recentFilters.length === 1 ? recentFilters[0] : and(...recentFilters);

      const rows = await db
        .select({
          id: shifts.id,
          branchId: shifts.branchId,
          branchName: branches.name,
          openedAt: shifts.openedAt,
          closedAt: shifts.closedAt,
          overShortCents: shifts.overShortCents,
        })
        .from(shifts)
        .leftJoin(branches, eq(branches.id, shifts.branchId))
        .where(condition)
        .orderBy(desc(shifts.closedAt), desc(shifts.id))
        .limit(10);

      return rows;
    })(),
  ]);

  const paymentsByMethod = paymentAggregateRows.reduce((acc, row) => {
    const total = Number(row.totalCents ?? 0);
    const count = Number(row.count ?? 0);
    acc[row.method] = { totalCents: total, count };
    return acc;
  }, {});

  const totalPaymentsCents = Object.values(paymentsByMethod).reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.totalCents ?? 0)),
    0
  );

  const cashPaymentsCents = paymentsByMethod.cash?.totalCents ?? 0;

  const paymentDetails = paymentRows.map((row) => ({
    id: Number(row.id),
    orderId: row.orderId == null ? null : Number(row.orderId),
    invoiceId: row.invoiceId == null ? null : Number(row.invoiceId),
    method: row.method,
    amountCents: Math.max(0, Number(row.amountCents ?? 0)),
    meta: row.meta ?? null,
    createdAt: toIsoString(row.createdAt),
  }));

  const movementTotals = movementRows.reduce((acc, row) => {
    const key = row.kind;
    const amount = Math.max(0, Number(row.amountCents ?? 0));

    if (!acc[key]) {
      acc[key] = { totalCents: 0, count: 0 };
    }

    acc[key].totalCents += amount;
    acc[key].count += 1;
    return acc;
  }, {});

  const movementEntries = movementRows.map((row) => ({
    id: Number(row.id),
    kind: row.kind,
    amountCents: Math.max(0, Number(row.amountCents ?? 0)),
    direction: cashMovementDirection[row.kind] ?? 0,
    reason: row.reason ?? null,
    createdAt: toIsoString(row.createdAt),
  }));

  const netMovementCents = movementEntries.reduce(
    (sum, entry) => sum + entry.direction * Math.max(0, Number(entry.amountCents ?? 0)),
    0
  );

  const refundMovements = movementEntries.filter((entry) => entry.kind === 'refund');
  const refundTotalCents = refundMovements.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.amountCents ?? 0)),
    0
  );

  const openingCashCents = Math.max(0, Number(shiftRow.openingCashCents ?? 0));
  const closingCashCents =
    shiftRow.closingCashCents == null ? null : Math.max(0, Number(shiftRow.closingCashCents));

  const expectedCashCents =
    shiftRow.expectedCashCents == null
      ? Math.max(0, openingCashCents + cashPaymentsCents + netMovementCents)
      : Math.max(0, Number(shiftRow.expectedCashCents ?? 0));

  let overShortCents = shiftRow.overShortCents == null ? null : Number(shiftRow.overShortCents);
  if (closingCashCents != null) {
    overShortCents = closingCashCents - expectedCashCents;
  }

  const varianceFlag = overShortCents != null && Math.abs(overShortCents) >= 5000;

  const shiftInfo = {
    id: Number(shiftRow.id),
    branchId: Number(shiftRow.branchId),
    branchName: shiftRow.branchName ?? null,
    openedBy: shiftRow.openedBy == null ? null : Number(shiftRow.openedBy),
    openedByName: shiftRow.openedByName ?? null,
    closedBy: shiftRow.closedBy == null ? null : Number(shiftRow.closedBy),
    closedByName: shiftRow.closedByName ?? null,
    openedAt: toIsoString(shiftRow.openedAt),
    closedAt: toIsoString(shiftRow.closedAt),
    openingCashCents,
    closingCashCents,
    expectedCashCents,
    overShortCents,
  };

  const recentShifts = recentShiftsRows.map((row) => ({
    id: Number(row.id),
    branchId: row.branchId == null ? null : Number(row.branchId),
    branchName: row.branchName ?? null,
    openedAt: toIsoString(row.openedAt),
    closedAt: toIsoString(row.closedAt),
    overShortCents: row.overShortCents == null ? null : Number(row.overShortCents),
  }));

  const snapshot = snapshotRows?.[0]?.snapshot ?? null;
  const reportSource = snapshot ? 'snapshot' : 'live';

  return {
    generatedAt: new Date().toISOString(),
    reportSource,
    shift: shiftInfo,
    totals: {
      openingCashCents,
      closingCashCents,
      expectedCashCents,
      overShortCents,
      cashPaymentsCents,
      totalPaymentsCents,
      netMovementCents,
      totalTransactions: paymentDetails.length,
      flagged: varianceFlag,
    },
    payments: {
      summary: {
        totalCents: totalPaymentsCents,
        cashPaymentsCents,
        methods: paymentsByMethod,
      },
      entries: paymentDetails,
    },
    cashMovements: {
      summary: {
        netMovementCents,
        totalsByKind: movementTotals,
      },
      entries: movementEntries,
    },
    refunds: {
      totalCents: refundTotalCents,
      count: refundMovements.length,
    },
    countedCashCents: closingCashCents,
    snapshot,
    recentShifts,
  };
}

function escapePdfText(value) {
  if (value == null) {
    return '';
  }

  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createShiftReportPdfBuffer(report) {
  const openedAt = report.shift.openedAt ? new Date(report.shift.openedAt) : null;
  const closedAt = report.shift.closedAt ? new Date(report.shift.closedAt) : null;
  const dateFormatter = new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const headerLines = [
    `Reporte de cierre - Turno #${report.shift.id} (${report.shift.branchName ?? `Sucursal ${report.shift.branchId}`})`,
    `Abierto por: ${report.shift.openedByName ?? `Usuario ${report.shift.openedBy ?? 'N/D'}`} · ${
      openedAt ? dateFormatter.format(openedAt) : 'sin hora'
    }`,
    `Cerrado por: ${report.shift.closedByName ?? '—'} · ${
      closedAt ? dateFormatter.format(closedAt) : 'sin hora'
    }`,
    `Generado: ${dateFormatter.format(new Date(report.generatedAt))}`,
    '',
  ];

  const totalLines = [
    `Efectivo inicial: ${formatPesosFromCents(report.totals.openingCashCents)}`,
    `Pagos en efectivo: ${formatPesosFromCents(report.totals.cashPaymentsCents)}`,
    `Movimientos netos: ${formatPesosFromCents(report.totals.netMovementCents)}`,
    `Efectivo esperado: ${formatPesosFromCents(report.totals.expectedCashCents)}`,
    `Efectivo contado: ${formatPesosFromCents(report.totals.closingCashCents ?? 0)}`,
    `Diferencia: ${formatPesosFromCents(report.totals.overShortCents ?? 0)}`,
    '',
  ];

  const methodKeys = Object.keys(report.payments.summary.methods).sort();
  const paymentLines = ['Formas de pago:'];
  for (const key of methodKeys) {
    const entry = report.payments.summary.methods[key];
    paymentLines.push(
      ` - ${key}: ${formatPesosFromCents(entry.totalCents ?? 0)} · ${entry.count ?? 0} transacciones`
    );
  }

  const movementKeys = Object.keys(report.cashMovements.summary.totalsByKind || {}).sort();
  const movementLines = ['Movimientos de caja:'];
  for (const key of movementKeys) {
    const entry = report.cashMovements.summary.totalsByKind[key];
    movementLines.push(
      ` - ${key}: ${formatPesosFromCents(entry.totalCents ?? 0)} · ${entry.count ?? 0} eventos`
    );
  }

  const lines = [...headerLines, ...totalLines, '', ...paymentLines, '', ...movementLines];

  const contentParts = ['BT', '/F1 12 Tf', '72 770 Td'];
  lines.forEach((line, index) => {
    if (index === 0) {
      contentParts.push(`(${escapePdfText(line)}) Tj`);
    } else {
      contentParts.push('T*', `(${escapePdfText(line)}) Tj`);
    }
  });
  contentParts.push('ET');

  const contentStream = contentParts.join('\n');
  const streamLength = Buffer.byteLength(contentStream, 'utf8');

  let pdf = '%PDF-1.4\n';
  const offsets = [];

  function pushObject(objectContent) {
    offsets.push(pdf.length);
    pdf += `${objectContent}\n`;
  }

  pushObject('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  pushObject('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
  pushObject(
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj'
  );
  pushObject(`4 0 obj << /Length ${streamLength} >> stream\n${contentStream}\nendstream endobj`);
  pushObject('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');

  const xrefOffset = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += 'trailer << /Size 6 /Root 1 0 R >>\n';
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

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

app.get('/api/branches', async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
      })
      .from(branches)
      .orderBy(asc(branches.name));

    res.json({
      branches: rows.map((row) => ({
        id: Number(row.id),
        code: row.code,
        name: row.name,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/shifts/open', async (req, res, next) => {
  try {
    const { branchId, openedBy, openingCashCents, pin } = req.body ?? {};

    if (!branchId || !openedBy) {
      return res.status(400).json({ error: 'branchId and openedBy are required' });
    }

    const normalizedOpening = Number(openingCashCents);
    if (!Number.isFinite(normalizedOpening) || normalizedOpening < 0) {
      return res.status(400).json({ error: 'openingCashCents must be a non-negative number' });
    }

    const [user] = await db
      .select({ id: users.id, branchId: users.branchId, pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, openedBy))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (Number(user.branchId) !== Number(branchId)) {
      return res.status(403).json({ error: 'User is not assigned to this branch' });
    }

    if (!verifyPin(pin, user.pinHash)) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    const [existingShift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.branchId, Number(branchId)), isNull(shifts.closedAt)))
      .limit(1);

    if (existingShift) {
      return res.status(409).json({ error: 'A shift is already open for this branch' });
    }

    const createdShift = await db.transaction(async (tx) => {
      await tx.insert(shifts).values({
        branchId: Number(branchId),
        openedBy: Number(openedBy),
        openingCashCents: Math.round(normalizedOpening),
        expectedCashCents: Math.round(normalizedOpening),
      });

      const [shiftRow] = await tx
        .select(shiftSelection)
        .from(shifts)
        .orderBy(desc(shifts.id))
        .limit(1);

      if (!shiftRow) {
        throw new Error('FAILED_TO_CREATE_SHIFT');
      }

      return shiftRow;
    });

    res.status(201).json({ shift: createdShift });
  } catch (error) {
    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_SHIFT') {
      return res.status(500).json({ error: 'Unable to open shift' });
    }

    next(error);
  }
});

app.post('/api/inventory/count-sessions', async (req, res, next) => {
  try {
    const { branchId, scope = 'cycle', createdBy } = req.body ?? {};

    const numericBranchId = Number(branchId);
    if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
      return res.status(400).json({ error: 'branchId must be a positive integer' });
    }

    const normalizedScope = typeof scope === 'string' ? scope.toLowerCase() : 'cycle';
    if (!['cycle', 'full'].includes(normalizedScope)) {
      return res.status(400).json({ error: 'scope must be "cycle" or "full"' });
    }

    const numericCreatedBy = Number(createdBy);
    if (!Number.isInteger(numericCreatedBy) || numericCreatedBy <= 0) {
      return res.status(400).json({ error: 'createdBy must be a positive integer' });
    }

    const [branchRow] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, numericBranchId))
      .limit(1);

    if (!branchRow) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const detail = await db.transaction(async (tx) => {
      await tx.insert(inventoryCountSessions).values({
        branchId: numericBranchId,
        scope: normalizedScope,
        status: 'open',
        createdBy: numericCreatedBy,
      });

      const [sessionRow] = await tx
        .select({ id: inventoryCountSessions.id })
        .from(inventoryCountSessions)
        .where(
          and(
            eq(inventoryCountSessions.branchId, numericBranchId),
            eq(inventoryCountSessions.createdBy, numericCreatedBy)
          )
        )
        .orderBy(desc(inventoryCountSessions.id))
        .limit(1);

      if (!sessionRow) {
        throw new Error('FAILED_TO_CREATE_INVENTORY_COUNT_SESSION');
      }

      return getCountSessionWithLines(tx, sessionRow.id);
    });

    res.status(201).json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_INVENTORY_COUNT_SESSION') {
      return res.status(500).json({ error: 'Unable to create inventory count session' });
    }

    next(error);
  }
});

app.post('/api/inventory/count-lines', async (req, res, next) => {
  try {
    const {
      sessionId,
      productCodeVersionId,
      countedQty = 1,
      mode = 'add',
      status = 'counted',
    } = req.body ?? {};

    const numericSessionId = Number(sessionId);
    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      return res.status(400).json({ error: 'sessionId must be a positive integer' });
    }

    const numericVersionId = Number(productCodeVersionId);
    if (!Number.isInteger(numericVersionId) || numericVersionId <= 0) {
      return res.status(400).json({ error: 'productCodeVersionId must be a positive integer' });
    }

    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : 'counted';
    if (!['counted', 'recount', 'resolved'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'status must be one of counted, recount, or resolved' });
    }

    const normalizedMode = typeof mode === 'string' && mode.toLowerCase() === 'set' ? 'set' : 'add';

    const numericCount = Number(countedQty);
    if (!Number.isFinite(numericCount) || numericCount < 0) {
      return res.status(400).json({ error: 'countedQty must be a non-negative number' });
    }

    const detail = await db.transaction(async (tx) => {
      const [sessionRow] = await tx
        .select({
          id: inventoryCountSessions.id,
          branchId: inventoryCountSessions.branchId,
          status: inventoryCountSessions.status,
        })
        .from(inventoryCountSessions)
        .where(eq(inventoryCountSessions.id, numericSessionId))
        .limit(1);

      if (!sessionRow) {
        throw new HttpError(404, 'Inventory count session not found');
      }

      if (sessionRow.status === 'posted' || sessionRow.status === 'cancelled') {
        throw new HttpError(409, 'Inventory count session is closed');
      }

      const [versionRow] = await tx
        .select({
          id: productCodeVersions.id,
          branchId: productCodeVersions.branchId,
          qtyOnHand: productCodeVersions.qtyOnHand,
        })
        .from(productCodeVersions)
        .where(eq(productCodeVersions.id, numericVersionId))
        .limit(1);

      if (!versionRow) {
        throw new HttpError(404, 'Product code version not found');
      }

      if (versionRow.branchId !== sessionRow.branchId) {
        throw new HttpError(400, 'Product code version does not belong to the session branch');
      }

      const [existingLine] = await tx
        .select({
          id: inventoryCountLines.id,
          countedQty: inventoryCountLines.countedQty,
        })
        .from(inventoryCountLines)
        .where(
          and(
            eq(inventoryCountLines.sessionId, numericSessionId),
            eq(inventoryCountLines.productCodeVersionId, numericVersionId)
          )
        )
        .limit(1);

      if (existingLine) {
        const currentCount = toNumber(existingLine.countedQty);
        const nextCount = normalizedMode === 'set' ? numericCount : currentCount + numericCount;

        await tx
          .update(inventoryCountLines)
          .set({ countedQty: nextCount, status: normalizedStatus })
          .where(eq(inventoryCountLines.id, existingLine.id));
      } else {
        const expected = toNumber(versionRow.qtyOnHand);

        await tx.insert(inventoryCountLines).values({
          sessionId: numericSessionId,
          productCodeVersionId: numericVersionId,
          expectedQty: expected,
          countedQty: numericCount,
          status: normalizedStatus,
        });
      }

      if (sessionRow.status === 'open') {
        await tx
          .update(inventoryCountSessions)
          .set({ status: 'review' })
          .where(eq(inventoryCountSessions.id, numericSessionId));
      }

      return getCountSessionWithLines(tx, numericSessionId);
    });

    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/inventory/count-post', async (req, res, next) => {
  try {
    const { sessionId, postedBy = null } = req.body ?? {};

    const numericSessionId = Number(sessionId);
    if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
      return res.status(400).json({ error: 'sessionId must be a positive integer' });
    }

    const postedByValue = Number(postedBy);
    const normalizedPostedBy = Number.isInteger(postedByValue) && postedByValue > 0 ? postedByValue : null;

    const detail = await db.transaction(async (tx) => {
      const { session, lines } = await getCountSessionWithLines(tx, numericSessionId);

      if (session.status === 'posted' || session.status === 'cancelled') {
        throw new HttpError(409, 'Inventory count session is already closed');
      }

      if (lines.length === 0) {
        throw new HttpError(400, 'Inventory count session has no lines to post');
      }

      for (const line of lines) {
        const expected = toNumber(line.expectedQty);
        const counted = Math.max(0, Math.round(toNumber(line.countedQty)));
        const delta = Math.round(counted - expected);

        await tx
          .update(productCodeVersions)
          .set({ qtyOnHand: counted, updatedAt: new Date() })
          .where(eq(productCodeVersions.id, line.productCodeVersionId));

        await tx
          .update(inventoryCountLines)
          .set({ countedQty: counted, status: 'resolved' })
          .where(eq(inventoryCountLines.id, line.id));

        if (delta !== 0) {
          await tx.insert(stockLedger).values({
            productCodeVersionId: line.productCodeVersionId,
            reason: 'count_post',
            qtyChange: delta,
            referenceId: numericSessionId,
            referenceType: 'inventory_count',
            notes: 'Inventory count adjustment',
          });
        }
      }

      await tx
        .update(inventoryCountSessions)
        .set({
          status: 'posted',
          postedBy: normalizedPostedBy,
          postedAt: new Date(),
        })
        .where(eq(inventoryCountSessions.id, numericSessionId));

      return getCountSessionWithLines(tx, numericSessionId);
    });

    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/inventory/transfers', async (req, res, next) => {
  try {
    const { fromBranchId, toBranchId, createdBy, lines = [] } = req.body ?? {};

    const numericFromBranchId = Number(fromBranchId);
    if (!Number.isInteger(numericFromBranchId) || numericFromBranchId <= 0) {
      return res.status(400).json({ error: 'fromBranchId must be a positive integer' });
    }

    const numericToBranchId = Number(toBranchId);
    if (!Number.isInteger(numericToBranchId) || numericToBranchId <= 0) {
      return res.status(400).json({ error: 'toBranchId must be a positive integer' });
    }

    if (numericFromBranchId === numericToBranchId) {
      return res.status(400).json({ error: 'fromBranchId and toBranchId must be different' });
    }

    const numericCreatedBy = Number(createdBy);
    if (!Number.isInteger(numericCreatedBy) || numericCreatedBy <= 0) {
      return res.status(400).json({ error: 'createdBy must be a positive integer' });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'lines must be a non-empty array' });
    }

    const normalizedLines = lines.map((entry, index) => {
      const versionId = Number(entry?.productCodeVersionId);
      const qtyValue = Number(entry?.qty ?? 0);

      if (!Number.isInteger(versionId) || versionId <= 0) {
        throw new HttpError(400, `lines[${index}].productCodeVersionId must be a positive integer`);
      }

      if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
        throw new HttpError(400, `lines[${index}].qty must be a positive number`);
      }

      return { productCodeVersionId: versionId, qty: Math.round(qtyValue) };
    });

    const detail = await db.transaction(async (tx) => {
      const [fromBranch] = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.id, numericFromBranchId))
        .limit(1);

      if (!fromBranch) {
        throw new HttpError(404, 'Origin branch not found');
      }

      const [toBranch] = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.id, numericToBranchId))
        .limit(1);

      if (!toBranch) {
        throw new HttpError(404, 'Destination branch not found');
      }

      const versionIds = normalizedLines.map((line) => line.productCodeVersionId);
      const versionRows = await tx
        .select({ id: productCodeVersions.id, branchId: productCodeVersions.branchId })
        .from(productCodeVersions)
        .where(inArray(productCodeVersions.id, versionIds));

      const versionMap = new Map(versionRows.map((row) => [row.id, row]));

      for (const line of normalizedLines) {
        const version = versionMap.get(line.productCodeVersionId);
        if (!version) {
          throw new HttpError(404, 'One or more product code versions were not found');
        }

        if (version.branchId !== numericFromBranchId) {
          throw new HttpError(400, 'Product code version does not belong to origin branch');
        }
      }

      await tx.insert(inventoryTransfers).values({
        fromBranchId: numericFromBranchId,
        toBranchId: numericToBranchId,
        status: 'draft',
        createdBy: numericCreatedBy,
      });

      const [transferRow] = await tx
        .select({ id: inventoryTransfers.id })
        .from(inventoryTransfers)
        .where(
          and(
            eq(inventoryTransfers.fromBranchId, numericFromBranchId),
            eq(inventoryTransfers.toBranchId, numericToBranchId),
            eq(inventoryTransfers.createdBy, numericCreatedBy)
          )
        )
        .orderBy(desc(inventoryTransfers.id))
        .limit(1);

      if (!transferRow) {
        throw new Error('FAILED_TO_CREATE_INVENTORY_TRANSFER');
      }

      await tx.insert(inventoryTransferLines).values(
        normalizedLines.map((line) => ({
          transferId: transferRow.id,
          productCodeVersionId: line.productCodeVersionId,
          qty: line.qty,
        }))
      );

      return getTransferDetail(tx, transferRow.id);
    });

    res.status(201).json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_INVENTORY_TRANSFER') {
      return res.status(500).json({ error: 'Unable to create inventory transfer' });
    }

    next(error);
  }
});

app.post(
  '/api/inventory/transfers/approve',
  auditTrail('inventory.transfer.approve', 'inventory_transfer', {
    payloadResolver: (req) => {
      const { transferId, approvedBy } = req.body ?? {};
      return {
        transferId: transferId ?? null,
        approvedBy: approvedBy ?? null,
      };
    },
    resourceResolver: (req) => {
      const { transferId } = req.body ?? {};
      const numeric = Number(transferId);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
  }),
  async (req, res, next) => {
    try {
      const { transferId, approvedBy } = req.body ?? {};

      const numericTransferId = Number(transferId);
      if (!Number.isInteger(numericTransferId) || numericTransferId <= 0) {
        return res.status(400).json({ error: 'transferId must be a positive integer' });
      }

      const numericApprovedBy = Number(approvedBy);
      if (!Number.isInteger(numericApprovedBy) || numericApprovedBy <= 0) {
        return res.status(400).json({ error: 'approvedBy must be a positive integer' });
      }

      const detail = await db.transaction(async (tx) => {
        const [transferRow] = await tx
          .select({ id: inventoryTransfers.id, status: inventoryTransfers.status })
          .from(inventoryTransfers)
          .where(eq(inventoryTransfers.id, numericTransferId))
          .limit(1);

        if (!transferRow) {
          throw new HttpError(404, 'Inventory transfer not found');
        }

        if (transferRow.status !== 'draft') {
          throw new HttpError(409, 'Only draft transfers can be approved');
        }

        await tx
          .update(inventoryTransfers)
          .set({ status: 'approved', approvedBy: numericApprovedBy, updatedAt: new Date() })
          .where(eq(inventoryTransfers.id, numericTransferId));

        return getTransferDetail(tx, numericTransferId);
      });

      res.locals.auditResourceId = numericTransferId;

      res.json(detail);
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      next(error);
    }
  }
);

app.post('/api/inventory/transfers/ship', async (req, res, next) => {
  try {
    const { transferId, shippedBy } = req.body ?? {};

    const numericTransferId = Number(transferId);
    if (!Number.isInteger(numericTransferId) || numericTransferId <= 0) {
      return res.status(400).json({ error: 'transferId must be a positive integer' });
    }

    const numericShippedBy = Number(shippedBy);
    if (!Number.isInteger(numericShippedBy) || numericShippedBy <= 0) {
      return res.status(400).json({ error: 'shippedBy must be a positive integer' });
    }

    const detail = await db.transaction(async (tx) => {
      const [transferRow] = await tx
        .select({
          id: inventoryTransfers.id,
          status: inventoryTransfers.status,
          fromBranchId: inventoryTransfers.fromBranchId,
        })
        .from(inventoryTransfers)
        .where(eq(inventoryTransfers.id, numericTransferId))
        .limit(1);

      if (!transferRow) {
        throw new HttpError(404, 'Inventory transfer not found');
      }

      if (transferRow.status !== 'approved') {
        throw new HttpError(409, 'Only approved transfers can be shipped');
      }

      const lineRows = await tx
        .select({
          id: inventoryTransferLines.id,
          productCodeVersionId: inventoryTransferLines.productCodeVersionId,
          qty: inventoryTransferLines.qty,
        })
        .from(inventoryTransferLines)
        .where(eq(inventoryTransferLines.transferId, numericTransferId));

      if (lineRows.length === 0) {
        throw new HttpError(400, 'Transfer has no lines to ship');
      }

      const versionIds = lineRows.map((line) => line.productCodeVersionId);
      const versionRows = await tx
        .select({
          id: productCodeVersions.id,
          branchId: productCodeVersions.branchId,
          qtyOnHand: productCodeVersions.qtyOnHand,
        })
        .from(productCodeVersions)
        .where(inArray(productCodeVersions.id, versionIds));

      const versionMap = new Map(versionRows.map((row) => [row.id, row]));

      for (const line of lineRows) {
        const version = versionMap.get(line.productCodeVersionId);
        if (!version) {
          throw new HttpError(404, 'Product code version not found for transfer line');
        }

        if (version.branchId !== transferRow.fromBranchId) {
          throw new HttpError(400, 'Transfer line does not belong to origin branch');
        }

        const qty = Math.max(0, Math.round(toNumber(line.qty)));
        if (qty <= 0) {
          throw new HttpError(400, 'Transfer line quantity must be positive');
        }

        const available = toNumber(version.qtyOnHand);
        if (available < qty) {
          throw new HttpError(409, 'Insufficient quantity to ship transfer');
        }

        await tx
          .update(productCodeVersions)
          .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${qty}` })
          .where(eq(productCodeVersions.id, version.id));

        await tx.insert(stockLedger).values({
          productCodeVersionId: version.id,
          reason: 'transfer_out',
          qtyChange: -qty,
          referenceId: numericTransferId,
          referenceType: 'inventory_transfer',
          notes: 'Inventory transfer shipped',
        });
      }

      await tx
        .update(inventoryTransfers)
        .set({ status: 'shipped', shippedBy: numericShippedBy, shippedAt: new Date() })
        .where(eq(inventoryTransfers.id, numericTransferId));

      return getTransferDetail(tx, numericTransferId);
    });

    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/inventory/transfers/receive', async (req, res, next) => {
  try {
    const { transferId, receivedBy } = req.body ?? {};

    const numericTransferId = Number(transferId);
    if (!Number.isInteger(numericTransferId) || numericTransferId <= 0) {
      return res.status(400).json({ error: 'transferId must be a positive integer' });
    }

    const numericReceivedBy = Number(receivedBy);
    if (!Number.isInteger(numericReceivedBy) || numericReceivedBy <= 0) {
      return res.status(400).json({ error: 'receivedBy must be a positive integer' });
    }

    const detail = await db.transaction(async (tx) => {
      const [transferRow] = await tx
        .select({
          id: inventoryTransfers.id,
          status: inventoryTransfers.status,
          fromBranchId: inventoryTransfers.fromBranchId,
          toBranchId: inventoryTransfers.toBranchId,
        })
        .from(inventoryTransfers)
        .where(eq(inventoryTransfers.id, numericTransferId))
        .limit(1);

      if (!transferRow) {
        throw new HttpError(404, 'Inventory transfer not found');
      }

      if (transferRow.status !== 'shipped') {
        throw new HttpError(409, 'Only shipped transfers can be received');
      }

      const lineRows = await tx
        .select({
          id: inventoryTransferLines.id,
          productCodeVersionId: inventoryTransferLines.productCodeVersionId,
          qty: inventoryTransferLines.qty,
        })
        .from(inventoryTransferLines)
        .where(eq(inventoryTransferLines.transferId, numericTransferId));

      if (lineRows.length === 0) {
        throw new HttpError(400, 'Transfer has no lines to receive');
      }

      const versionIds = lineRows.map((line) => line.productCodeVersionId);
      const versionRows = await tx
        .select({
          id: productCodeVersions.id,
          productCodeId: productCodeVersions.productCodeId,
          branchId: productCodeVersions.branchId,
          priceCents: productCodeVersions.priceCents,
          costCents: productCodeVersions.costCents,
        })
        .from(productCodeVersions)
        .where(inArray(productCodeVersions.id, versionIds));

      const versionMap = new Map(versionRows.map((row) => [row.id, row]));

      for (const line of lineRows) {
        const version = versionMap.get(line.productCodeVersionId);
        if (!version) {
          throw new HttpError(404, 'Product code version not found for transfer line');
        }

        if (version.branchId !== transferRow.fromBranchId) {
          throw new HttpError(400, 'Transfer line does not belong to origin branch');
        }

        const qty = Math.max(0, Math.round(toNumber(line.qty)));
        if (qty <= 0) {
          throw new HttpError(400, 'Transfer line quantity must be positive');
        }

        let targetVersionId = null;

        const [targetVersion] = await tx
          .select({ id: productCodeVersions.id })
          .from(productCodeVersions)
          .where(
            and(
              eq(productCodeVersions.productCodeId, version.productCodeId),
              eq(productCodeVersions.branchId, transferRow.toBranchId)
            )
          )
          .limit(1);

        if (targetVersion) {
          targetVersionId = targetVersion.id;
        } else {
          await tx.insert(productCodeVersions).values({
            productCodeId: version.productCodeId,
            branchId: transferRow.toBranchId,
            priceCents: toNumber(version.priceCents),
            costCents: toNumber(version.costCents),
            qtyOnHand: 0,
            qtyReserved: 0,
          });

          const [createdVersion] = await tx
            .select({ id: productCodeVersions.id })
            .from(productCodeVersions)
            .where(
              and(
                eq(productCodeVersions.productCodeId, version.productCodeId),
                eq(productCodeVersions.branchId, transferRow.toBranchId)
              )
            )
            .orderBy(desc(productCodeVersions.id))
            .limit(1);

          if (!createdVersion) {
            throw new Error('FAILED_TO_CREATE_TARGET_VERSION');
          }

          targetVersionId = createdVersion.id;
        }

        await tx
          .update(productCodeVersions)
          .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${qty}` })
          .where(eq(productCodeVersions.id, targetVersionId));

        await tx.insert(stockLedger).values({
          productCodeVersionId: targetVersionId,
          reason: 'transfer_in',
          qtyChange: qty,
          referenceId: numericTransferId,
          referenceType: 'inventory_transfer',
          notes: 'Inventory transfer received',
        });
      }

      await tx
        .update(inventoryTransfers)
        .set({ status: 'received', receivedBy: numericReceivedBy, receivedAt: new Date() })
        .where(eq(inventoryTransfers.id, numericTransferId));

      return getTransferDetail(tx, numericTransferId);
    });

    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_TARGET_VERSION') {
      return res.status(500).json({ error: 'Unable to create target branch version' });
    }

    next(error);
  }
});

app.post('/api/inventory/quarantine/queue', async (req, res, next) => {
  try {
    const { branchId, productCodeVersionId, qty, reason = null, createdBy = null } = req.body ?? {};

    const numericBranchId = Number(branchId);
    if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
      return res.status(400).json({ error: 'branchId must be a positive integer' });
    }

    const numericVersionId = Number(productCodeVersionId);
    if (!Number.isInteger(numericVersionId) || numericVersionId <= 0) {
      return res.status(400).json({ error: 'productCodeVersionId must be a positive integer' });
    }

    const qtyValue = Number(qty);
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
      return res.status(400).json({ error: 'qty must be a positive number' });
    }

    const normalizedQty = Math.round(qtyValue);
    const normalizedReason = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : null;
    const createdByValue = Number(createdBy);
    const normalizedCreatedBy = Number.isInteger(createdByValue) && createdByValue > 0 ? createdByValue : null;

    const quarantine = await db.transaction(async (tx) => {
      const [versionRow] = await tx
        .select({
          id: productCodeVersions.id,
          branchId: productCodeVersions.branchId,
          qtyOnHand: productCodeVersions.qtyOnHand,
        })
        .from(productCodeVersions)
        .where(eq(productCodeVersions.id, numericVersionId))
        .limit(1);

      if (!versionRow) {
        throw new HttpError(404, 'Product code version not found');
      }

      if (versionRow.branchId !== numericBranchId) {
        throw new HttpError(400, 'Product code version does not belong to branch');
      }

      const available = toNumber(versionRow.qtyOnHand);
      if (available < normalizedQty) {
        throw new HttpError(409, 'Insufficient quantity to queue for quarantine');
      }

      await tx
        .update(productCodeVersions)
        .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${normalizedQty}` })
        .where(eq(productCodeVersions.id, numericVersionId));

      await tx.insert(inventoryQuarantines).values({
        branchId: numericBranchId,
        productCodeVersionId: numericVersionId,
        qty: normalizedQty,
        reason: normalizedReason,
        status: 'open',
        outcome: 'return',
        createdBy: normalizedCreatedBy,
      });

      const [entry] = await tx
        .select({ id: inventoryQuarantines.id })
        .from(inventoryQuarantines)
        .where(
          and(
            eq(inventoryQuarantines.branchId, numericBranchId),
            eq(inventoryQuarantines.productCodeVersionId, numericVersionId)
          )
        )
        .orderBy(desc(inventoryQuarantines.id))
        .limit(1);

      if (!entry) {
        throw new Error('FAILED_TO_QUEUE_QUARANTINE');
      }

      await tx.insert(stockLedger).values({
        productCodeVersionId: numericVersionId,
        reason: 'quarantine_out',
        qtyChange: -normalizedQty,
        referenceId: entry.id,
        referenceType: 'quarantine',
        notes: 'Item queued for quarantine',
      });

      return getQuarantineEntry(tx, entry.id);
    });

    res.status(201).json({ quarantine });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_QUEUE_QUARANTINE') {
      return res.status(500).json({ error: 'Unable to queue quarantine entry' });
    }

    next(error);
  }
});

app.post('/api/inventory/quarantine/resolve', async (req, res, next) => {
  try {
    const { quarantineId, outcome = 'return', resolvedBy = null } = req.body ?? {};

    const numericQuarantineId = Number(quarantineId);
    if (!Number.isInteger(numericQuarantineId) || numericQuarantineId <= 0) {
      return res.status(400).json({ error: 'quarantineId must be a positive integer' });
    }

    const normalizedOutcome = typeof outcome === 'string' ? outcome.toLowerCase() : 'return';
    if (!['return', 'dispose'].includes(normalizedOutcome)) {
      return res.status(400).json({ error: 'outcome must be "return" or "dispose"' });
    }

    const resolvedByValue = Number(resolvedBy);
    const normalizedResolvedBy = Number.isInteger(resolvedByValue) && resolvedByValue > 0 ? resolvedByValue : null;

    const quarantine = await db.transaction(async (tx) => {
      const [entry] = await tx
        .select({
          id: inventoryQuarantines.id,
          status: inventoryQuarantines.status,
          productCodeVersionId: inventoryQuarantines.productCodeVersionId,
          qty: inventoryQuarantines.qty,
        })
        .from(inventoryQuarantines)
        .where(eq(inventoryQuarantines.id, numericQuarantineId))
        .limit(1);

      if (!entry) {
        throw new HttpError(404, 'Quarantine entry not found');
      }

      if (entry.status !== 'open') {
        throw new HttpError(409, 'Only open quarantine entries can be resolved');
      }

      const qty = Math.max(0, Math.round(toNumber(entry.qty)));

      if (normalizedOutcome === 'return' && qty > 0) {
        await tx
          .update(productCodeVersions)
          .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${qty}` })
          .where(eq(productCodeVersions.id, entry.productCodeVersionId));

        await tx.insert(stockLedger).values({
          productCodeVersionId: entry.productCodeVersionId,
          reason: 'quarantine_in',
          qtyChange: qty,
          referenceId: numericQuarantineId,
          referenceType: 'quarantine',
          notes: 'Quarantine resolved - returned to stock',
        });
      }

      await tx
        .update(inventoryQuarantines)
        .set({
          status: 'resolved',
          outcome: normalizedOutcome,
          resolvedBy: normalizedResolvedBy,
          resolvedAt: new Date(),
        })
        .where(eq(inventoryQuarantines.id, numericQuarantineId));

      return getQuarantineEntry(tx, numericQuarantineId);
    });

    res.json({ quarantine });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/shifts/:id/close', async (req, res, next) => {
  try {
    const shiftId = Number(req.params.id);

    if (!Number.isFinite(shiftId) || shiftId <= 0) {
      return res.status(400).json({ error: 'Shift id must be a positive number' });
    }

    const { closedBy, pin, closingCashCents } = req.body ?? {};

    if (!closedBy || !pin) {
      return res.status(400).json({ error: 'closedBy and pin are required' });
    }

    const normalizedClosing = Number(closingCashCents);
    if (!Number.isFinite(normalizedClosing) || normalizedClosing < 0) {
      return res.status(400).json({ error: 'closingCashCents must be a non-negative number' });
    }

    const [shift] = await db
      .select(shiftSelection)
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .limit(1);

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (shift.closedAt) {
      return res.status(409).json({ error: 'Shift is already closed' });
    }

    const [user] = await db
      .select({ id: users.id, branchId: users.branchId, pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, closedBy))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (Number(user.branchId) !== Number(shift.branchId)) {
      return res.status(403).json({ error: 'User is not assigned to this branch' });
    }

    if (!verifyPin(pin, user.pinHash)) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    const closing = Math.round(normalizedClosing);
    const opening = Math.round(Number(shift.openingCashCents ?? 0));

    const result = await db.transaction(async (tx) => {
      const [paymentRows, movementRows] = await Promise.all([
        tx
          .select({
            method: payments.method,
            totalCents: sql`COALESCE(SUM(${payments.amountCents}), 0)`,
            count: sql`COUNT(*)`,
          })
          .from(payments)
          .where(eq(payments.shiftId, shiftId))
          .groupBy(payments.method),
        tx
          .select({
            kind: cashMovements.kind,
            totalCents: sql`COALESCE(SUM(${cashMovements.amountCents}), 0)`,
            count: sql`COUNT(*)`,
          })
          .from(cashMovements)
          .where(eq(cashMovements.shiftId, shiftId))
          .groupBy(cashMovements.kind),
      ]);

      const paymentsByMethod = paymentRows.reduce((acc, row) => {
        const total = Number(row.totalCents ?? 0);
        const count = Number(row.count ?? 0);
        acc[row.method] = { totalCents: total, count };
        return acc;
      }, {});

      const cashPaymentsCents = paymentsByMethod.cash?.totalCents ?? 0;

      const movementTotals = movementRows.reduce((acc, row) => {
        const total = Number(row.totalCents ?? 0);
        const count = Number(row.count ?? 0);
        acc[row.kind] = { totalCents: total, count };
        return acc;
      }, {});

      const netMovementCents = movementRows.reduce((sum, row) => {
        const direction = cashMovementDirection[row.kind] ?? 0;
        const total = Number(row.totalCents ?? 0);
        return sum + direction * total;
      }, 0);

      const computedExpected = Math.max(0, opening + cashPaymentsCents + netMovementCents);
      const variance = closing - computedExpected;
      const closedAt = new Date();

      await tx
        .update(shifts)
        .set({
          closedBy: Number(closedBy),
          closingCashCents: closing,
          expectedCashCents: computedExpected,
          overShortCents: variance,
          closedAt,
        })
        .where(eq(shifts.id, shiftId));

      const [row] = await tx
        .select(shiftSelection)
        .from(shifts)
        .where(eq(shifts.id, shiftId))
        .limit(1);

      if (!row) {
        throw new Error('FAILED_TO_CLOSE_SHIFT');
      }

      await tx.delete(shiftReports).where(eq(shiftReports.shiftId, shiftId));

      const snapshot = {
        computedAt: closedAt.toISOString(),
        shift: {
          id: shiftId,
          branchId: Number(shift.branchId),
          openedBy: Number(shift.openedBy),
          closedBy: Number(closedBy),
          openedAt: shift.openedAt instanceof Date ? shift.openedAt.toISOString() : shift.openedAt,
          closedAt: closedAt.toISOString(),
        },
        openingCashCents: opening,
        closingCashCents: closing,
        expectedCashCents: computedExpected,
        overShortCents: variance,
        cashPaymentsCents,
        paymentsByMethod,
        cashMovements: {
          totalsByKind: movementTotals,
          netMovementCents,
        },
      };

      await tx.insert(shiftReports).values({ shiftId, snapshot });

      return { shift: row, snapshot };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'FAILED_TO_CLOSE_SHIFT') {
      return res.status(500).json({ error: 'Unable to close shift' });
    }

    next(error);
  }
});

app.post('/api/shifts/:id/drop', createShiftMovementHandler('drop', -1));
app.post('/api/shifts/:id/paid-in', createShiftMovementHandler('paid_in', 1));
app.post('/api/shifts/:id/paid-out', createShiftMovementHandler('paid_out', -1));

app.get('/api/cash-movements', async (req, res, next) => {
  try {
    const shiftId = Number(req.query.shiftId);

    if (!Number.isInteger(shiftId) || shiftId <= 0) {
      return res.status(400).json({ error: 'shiftId query parameter is required' });
    }

    const data = await loadShiftMovements(shiftId);

    if (!data) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get('/api/shifts/active', async (req, res, next) => {
  try {
    const branchId = Number(req.query.branchId);

    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(400).json({ error: 'branchId query parameter is required' });
    }

    const [shift] = await db
      .select(shiftSelection)
      .from(shifts)
      .where(and(eq(shifts.branchId, branchId), isNull(shifts.closedAt)))
      .orderBy(desc(shifts.id))
      .limit(1);

    if (!shift) {
      return res.status(404).json({ error: 'No active shift found for branch' });
    }

    const data = await loadShiftMovements(shift.id);

    if (!data) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/shift-end', async (req, res, next) => {
  try {
    const queryShiftId = req.query.shiftId;
    const queryBranchId = req.query.branchId;

    let resolvedShiftId = null;
    let branchIdFilter = null;

    if (queryBranchId != null && queryBranchId !== '') {
      const parsedBranchId = Number(Array.isArray(queryBranchId) ? queryBranchId[0] : queryBranchId);
      if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
        return res.status(400).json({ error: 'branchId must be a positive integer when provided' });
      }
      branchIdFilter = parsedBranchId;
    }

    if (queryShiftId != null && queryShiftId !== '') {
      const parsedShiftId = Number(Array.isArray(queryShiftId) ? queryShiftId[0] : queryShiftId);
      if (!Number.isInteger(parsedShiftId) || parsedShiftId <= 0) {
        return res.status(400).json({ error: 'shiftId must be a positive integer' });
      }
      resolvedShiftId = parsedShiftId;
    }

    if (resolvedShiftId == null) {
      resolvedShiftId = await findLatestClosedShiftId(branchIdFilter);
      if (resolvedShiftId == null) {
        return res.status(404).json({ error: 'No closed shifts found' });
      }
    }

    const report = await buildShiftEndReport(resolvedShiftId);

    if (!report) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    res.json({
      generatedAt: report.generatedAt,
      reportSource: report.reportSource,
      shift: report.shift,
      totals: report.totals,
      payments: report.payments,
      cashMovements: report.cashMovements,
      refunds: report.refunds,
      countedCashCents: report.countedCashCents,
      snapshot: report.snapshot,
      recentShifts: report.recentShifts,
      resolvedShiftId: report.shift.id,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/reports/shift-end/export', async (req, res, next) => {
  try {
    const { shiftId } = req.body ?? {};
    const numericShiftId = Number(shiftId);

    if (!Number.isInteger(numericShiftId) || numericShiftId <= 0) {
      return res.status(400).json({ error: 'shiftId must be a positive integer' });
    }

    const report = await buildShiftEndReport(numericShiftId);

    if (!report) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    const pdfBuffer = createShiftReportPdfBuffer(report);
    const filename = `shift-${report.shift.id}-end-report.pdf`;

    res.json({
      shiftId: report.shift.id,
      filename,
      contentType: 'application/pdf',
      data: pdfBuffer.toString('base64'),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/cash-movements', async (req, res, next) => {
  try {
    const { shiftId, kind, amountCents, performedBy, pin, reason = null } = req.body ?? {};

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    if (!performedBy || !pin) {
      return res.status(400).json({ error: 'performedBy and pin are required' });
    }

    const amount = parseAmount(amountCents);

    if (amount === null) {
      return res.status(400).json({ error: 'amountCents must be a positive number' });
    }

    const movementKind = typeof kind === 'string' ? kind.trim() : '';

    if (!manualMovementKinds.has(movementKind)) {
      return res.status(400).json({
        error: 'kind must be one of deposit, cash_to_safe, drop, paid_in, paid_out, expense, or income',
      });
    }

    const direction = cashMovementDirection[movementKind];
    const normalizedReason = normalizeReasonInput(reason);

    const result = await recordShiftMovement({
      shiftId: Number(shiftId),
      performerId: Number(performedBy),
      pin,
      amountCents: amount,
      reason: normalizedReason,
      kind: movementKind,
      direction,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_RECORD_MOVEMENT') {
      return res.status(500).json({ error: 'Unable to record cash movement' });
    }

    next(error);
  }
});

app.get('/api/interest-models', async (req, res, next) => {
  try {
    const models = await db
      .select({
        id: interestModels.id,
        name: interestModels.name,
        description: interestModels.description,
        rateType: interestModels.rateType,
        periodDays: interestModels.periodDays,
        interestRateBps: interestModels.interestRateBps,
        graceDays: interestModels.graceDays,
        minPrincipalCents: interestModels.minPrincipalCents,
        maxPrincipalCents: interestModels.maxPrincipalCents,
        lateFeeBps: interestModels.lateFeeBps,
      })
      .from(interestModels)
      .orderBy(asc(interestModels.name));

    res.json({ interestModels: models });
  } catch (error) {
    next(error);
  }
});

app.post('/api/loans', async (req, res, next) => {
  try {
    const prepared = await prepareLoanCreationInput(db, req.body ?? {});
    const createdLoan = await db.transaction(async (tx) => createLoanWithPreparedPayload(tx, prepared));
    res.status(201).json(serializeLoanResponsePayload(createdLoan));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_LOAN') {
      return res.status(500).json({ error: 'Unable to create loan' });
    }

    next(error);
  }
});

app.get('/api/loans/:id', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({ error: 'Loan id must be a positive integer' });
    }

    const detail = await getLoanDetail(loanId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/loans/:id/pay', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({ error: 'Loan id must be a positive integer' });
    }

    const { kind, amountCents, method = 'cash' } = req.body ?? {};

    const allowedKinds = new Set(['interest', 'advance']);

    if (!kind || typeof kind !== 'string' || !allowedKinds.has(kind)) {
      return res.status(400).json({ error: 'kind must be "interest" or "advance"' });
    }

    const normalizedAmount = Number(amountCents);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ error: 'amountCents must be greater than 0' });
    }

    const roundedAmount = Math.round(normalizedAmount);
    const normalizedMethod = typeof method === 'string' ? method.toLowerCase() : '';

    if (!allowedLoanPaymentMethods.has(normalizedMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    await db.transaction(async (tx) => {
      const [loanRow] = await tx
        .select({ id: loans.id, status: loans.status })
        .from(loans)
        .where(eq(loans.id, loanId))
        .limit(1);

      if (!loanRow) {
        throw new HttpError(404, 'Loan not found');
      }

      if (closedLoanStatuses.has(loanRow.status)) {
        throw new HttpError(409, 'Loan is already closed');
      }

      await tx.insert(loanPayments).values({
        loanId,
        kind,
        amountCents: roundedAmount,
        method: normalizedMethod,
      });
    });

    const detail = await getLoanDetail(loanId);
    res.status(201).json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/loans/:id/renew', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({ error: 'Loan id must be a positive integer' });
    }

    const { amountCents = null, method = 'cash', schedule = [] } = req.body ?? {};

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ error: 'schedule must include at least one entry' });
    }

    const normalizedSchedule = normalizeLoanScheduleEntries(schedule);
    const normalizedMethod = typeof method === 'string' ? method.toLowerCase() : '';

    if (!allowedLoanPaymentMethods.has(normalizedMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    let roundedAmount = null;
    if (amountCents != null) {
      const normalizedAmount = Number(amountCents);

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return res.status(400).json({ error: 'amountCents must be greater than 0 when provided' });
      }

      roundedAmount = Math.round(normalizedAmount);
    }

    const newDueDate = normalizedSchedule[normalizedSchedule.length - 1]?.dueOn ?? null;

    await db.transaction(async (tx) => {
      const [loanRow] = await tx
        .select({ id: loans.id, status: loans.status })
        .from(loans)
        .where(eq(loans.id, loanId))
        .limit(1);

      if (!loanRow) {
        throw new HttpError(404, 'Loan not found');
      }

      if (closedLoanStatuses.has(loanRow.status)) {
        throw new HttpError(409, 'Loan is already closed');
      }

      await tx.delete(loanSchedules).where(eq(loanSchedules.loanId, loanId));

      for (const entry of normalizedSchedule) {
        await tx.insert(loanSchedules).values({
          loanId,
          dueOn: entry.dueOn,
          interestCents: entry.interestCents,
          feeCents: entry.feeCents,
        });
      }

      await tx
        .update(loans)
        .set({ dueDate: newDueDate, status: 'renewed' })
        .where(eq(loans.id, loanId));

      if (roundedAmount != null) {
        await tx.insert(loanPayments).values({
          loanId,
          kind: 'renew',
          amountCents: roundedAmount,
          method: normalizedMethod,
        });
      }
    });

    const detail = await getLoanDetail(loanId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/loans/:id/redeem', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({ error: 'Loan id must be a positive integer' });
    }

    const { amountCents, method = 'cash' } = req.body ?? {};

    const normalizedAmount = Number(amountCents);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ error: 'amountCents must be greater than 0' });
    }

    const roundedAmount = Math.round(normalizedAmount);
    const normalizedMethod = typeof method === 'string' ? method.toLowerCase() : '';

    if (!allowedLoanPaymentMethods.has(normalizedMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    await db.transaction(async (tx) => {
      const [loanRow] = await tx
        .select({ id: loans.id, status: loans.status })
        .from(loans)
        .where(eq(loans.id, loanId))
        .limit(1);

      if (!loanRow) {
        throw new HttpError(404, 'Loan not found');
      }

      if (closedLoanStatuses.has(loanRow.status)) {
        throw new HttpError(409, 'Loan is already closed');
      }

      await tx
        .update(loans)
        .set({ status: 'redeemed' })
        .where(eq(loans.id, loanId));

      await tx.insert(loanPayments).values({
        loanId,
        kind: 'redeem',
        amountCents: roundedAmount,
        method: normalizedMethod,
      });
    });

    const detail = await getLoanDetail(loanId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/loans/:id/extension', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({ error: 'Loan id must be a positive integer' });
    }

    const { amountCents = null, method = 'cash', schedule = [], dueDate = null } = req.body ?? {};

    const normalizedMethod = typeof method === 'string' ? method.toLowerCase() : '';

    if (!allowedLoanPaymentMethods.has(normalizedMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    let roundedAmount = null;
    if (amountCents != null) {
      const normalizedAmount = Number(amountCents);

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return res.status(400).json({ error: 'amountCents must be greater than 0 when provided' });
      }

      roundedAmount = Math.round(normalizedAmount);
    }

    let normalizedDueDate = null;
    if (dueDate != null) {
      if (typeof dueDate !== 'string') {
        return res.status(400).json({ error: 'dueDate must be an ISO date string when provided' });
      }

      const parsed = new Date(dueDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'dueDate is invalid' });
      }

      normalizedDueDate = parsed.toISOString().slice(0, 10);
    }

    let normalizedSchedule = [];
    if (Array.isArray(schedule) && schedule.length > 0) {
      normalizedSchedule = normalizeLoanScheduleEntries(schedule, { allowZeroInterest: true });
      normalizedDueDate = normalizedSchedule[normalizedSchedule.length - 1]?.dueOn ?? normalizedDueDate;
    }

    if (!normalizedDueDate && normalizedSchedule.length === 0) {
      return res.status(400).json({ error: 'Provide dueDate or schedule entries for the extension' });
    }

    await db.transaction(async (tx) => {
      const [loanRow] = await tx
        .select({ id: loans.id, status: loans.status })
        .from(loans)
        .where(eq(loans.id, loanId))
        .limit(1);

      if (!loanRow) {
        throw new HttpError(404, 'Loan not found');
      }

      if (closedLoanStatuses.has(loanRow.status)) {
        throw new HttpError(409, 'Loan is already closed');
      }

      for (const entry of normalizedSchedule) {
        await tx.insert(loanSchedules).values({
          loanId,
          dueOn: entry.dueOn,
          interestCents: entry.interestCents,
          feeCents: entry.feeCents,
        });
      }

      if (normalizedDueDate) {
        await tx
          .update(loans)
          .set({ dueDate: normalizedDueDate, status: 'active' })
          .where(eq(loans.id, loanId));
      }

      if (roundedAmount != null) {
        await tx.insert(loanPayments).values({
          loanId,
          kind: 'extension',
          amountCents: roundedAmount,
          method: normalizedMethod,
        });
      }
    });

    const detail = await getLoanDetail(loanId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/loans/:id/rewrite', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({ error: 'Loan id must be a positive integer' });
    }

    const {
      principalCents,
      interestRate = null,
      interestModelId = null,
      schedule = [],
      amountCents = null,
      method = 'cash',
    } = req.body ?? {};

    const normalizedPrincipal = Number(principalCents);

    if (!Number.isFinite(normalizedPrincipal) || normalizedPrincipal <= 0) {
      return res.status(400).json({ error: 'principalCents must be greater than 0' });
    }

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ error: 'schedule must include at least one entry' });
    }

    const normalizedSchedule = normalizeLoanScheduleEntries(schedule);
    const normalizedMethod = typeof method === 'string' ? method.toLowerCase() : '';

    if (!allowedLoanPaymentMethods.has(normalizedMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    let normalizedRate = null;
    if (interestRate != null) {
      const rateValue = Number(interestRate);
      if (!Number.isFinite(rateValue) || rateValue <= 0) {
        return res.status(400).json({ error: 'interestRate must be greater than 0 when provided' });
      }

      normalizedRate = rateValue;
    }

    let normalizedInterestModelId = null;
    if (interestModelId != null) {
      const modelIdValue = Number(interestModelId);
      if (!Number.isInteger(modelIdValue) || modelIdValue <= 0) {
        return res.status(400).json({ error: 'interestModelId must be a positive integer when provided' });
      }

      normalizedInterestModelId = modelIdValue;
    }

    let roundedAmount = null;
    if (amountCents != null) {
      const normalizedAmount = Number(amountCents);

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return res.status(400).json({ error: 'amountCents must be greater than 0 when provided' });
      }

      roundedAmount = Math.round(normalizedAmount);
    }

    const newDueDate = normalizedSchedule[normalizedSchedule.length - 1]?.dueOn ?? null;

    await db.transaction(async (tx) => {
      const [loanRow] = await tx
        .select({ id: loans.id, status: loans.status })
        .from(loans)
        .where(eq(loans.id, loanId))
        .limit(1);

      if (!loanRow) {
        throw new HttpError(404, 'Loan not found');
      }

      if (closedLoanStatuses.has(loanRow.status)) {
        throw new HttpError(409, 'Loan is already closed');
      }

      await tx.delete(loanSchedules).where(eq(loanSchedules.loanId, loanId));

      for (const entry of normalizedSchedule) {
        await tx.insert(loanSchedules).values({
          loanId,
          dueOn: entry.dueOn,
          interestCents: entry.interestCents,
          feeCents: entry.feeCents,
        });
      }

      const updatePayload = {
        principalCents: Math.round(normalizedPrincipal),
        dueDate: newDueDate,
        status: 'active',
      };

      if (normalizedRate != null) {
        updatePayload.interestRate = normalizedRate;
      }

      if (normalizedInterestModelId != null) {
        updatePayload.interestModelId = normalizedInterestModelId;
      }

      await tx
        .update(loans)
        .set(updatePayload)
        .where(eq(loans.id, loanId));

      if (roundedAmount != null) {
        await tx.insert(loanPayments).values({
          loanId,
          kind: 'rewrite',
          amountCents: roundedAmount,
          method: normalizedMethod,
        });
      }
    });

    const detail = await getLoanDetail(loanId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/loans/:id/forfeit', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      return res.status(400).json({ error: 'Loan id must be a positive integer' });
    }

    const {
      collateralId,
      branchId,
      priceCents,
      costCents = null,
      code = null,
      name = null,
      sku = null,
    } = req.body ?? {};

    const numericCollateralId = Number(collateralId);
    if (!Number.isInteger(numericCollateralId) || numericCollateralId <= 0) {
      return res.status(400).json({ error: 'collateralId must be a positive integer' });
    }

    const numericBranchId = Number(branchId);
    if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
      return res.status(400).json({ error: 'branchId must be a positive integer' });
    }

    const normalizedPrice = Number(priceCents);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return res.status(400).json({ error: 'priceCents must be greater than 0' });
    }

    const roundedPrice = Math.round(normalizedPrice);

    let roundedCost = roundedPrice;
    if (costCents != null) {
      const normalizedCost = Number(costCents);
      if (!Number.isFinite(normalizedCost) || normalizedCost < 0) {
        return res.status(400).json({ error: 'costCents must be zero or greater when provided' });
      }

      roundedCost = Math.round(normalizedCost);
    }

    const requestedCode = sanitizeProductCode(code ?? '');
    const providedName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
    const providedSku = typeof sku === 'string' && sku.trim().length > 0 ? sku.trim().slice(0, 60) : null;

    const result = await db.transaction(async (tx) => {
      const [loanRow] = await tx
        .select({ id: loans.id, status: loans.status, ticketNumber: loans.ticketNumber })
        .from(loans)
        .where(eq(loans.id, loanId))
        .limit(1);

      if (!loanRow) {
        throw new HttpError(404, 'Loan not found');
      }

      if (closedLoanStatuses.has(loanRow.status)) {
        throw new HttpError(409, 'Loan is already closed');
      }

      const [collateralRow] = await tx
        .select({
          id: loanCollateral.id,
          description: loanCollateral.description,
          estimatedValueCents: loanCollateral.estimatedValueCents,
          photoPath: loanCollateral.photoPath,
        })
        .from(loanCollateral)
        .where(and(eq(loanCollateral.id, numericCollateralId), eq(loanCollateral.loanId, loanId)))
        .limit(1);

      if (!collateralRow) {
        throw new HttpError(404, 'Collateral not found for this loan');
      }

      const baseCode = requestedCode || buildDefaultForfeitCode(loanRow.ticketNumber, collateralRow.id);

      let uniqueCode = baseCode;
      let attempts = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const existing = await tx
          .select({ id: productCodes.id })
          .from(productCodes)
          .where(eq(productCodes.code, uniqueCode))
          .limit(1);

        if (existing.length === 0) {
          break;
        }

        attempts += 1;
        if (attempts > 25) {
          throw new HttpError(409, 'Unable to generate unique product code');
        }

        uniqueCode = sanitizeProductCode(`${baseCode}-${attempts}`) || `${baseCode}${attempts}`.slice(0, 40);
      }

      const productName = (providedName ?? collateralRow.description ?? `Colateral ${collateralRow.id}`).slice(0, 200);

      await tx.insert(productCodes).values({
        code: uniqueCode,
        name: productName,
        sku: providedSku,
        description: collateralRow.description,
      });

      const [productCodeRow] = await tx
        .select({
          id: productCodes.id,
          code: productCodes.code,
          name: productCodes.name,
          sku: productCodes.sku,
          description: productCodes.description,
        })
        .from(productCodes)
        .where(eq(productCodes.code, uniqueCode))
        .limit(1);

      if (!productCodeRow) {
        throw new Error('FAILED_TO_CREATE_PRODUCT_CODE');
      }

      await tx.insert(productCodeVersions).values({
        productCodeId: productCodeRow.id,
        branchId: numericBranchId,
        priceCents: roundedPrice,
        costCents: roundedCost,
        qtyOnHand: 1,
        qtyReserved: 0,
      });

      const [versionRow] = await tx
        .select({
          id: productCodeVersions.id,
          productCodeId: productCodeVersions.productCodeId,
          branchId: productCodeVersions.branchId,
          priceCents: productCodeVersions.priceCents,
          costCents: productCodeVersions.costCents,
          qtyOnHand: productCodeVersions.qtyOnHand,
          qtyReserved: productCodeVersions.qtyReserved,
          createdAt: productCodeVersions.createdAt,
        })
        .from(productCodeVersions)
        .where(
          and(
            eq(productCodeVersions.productCodeId, productCodeRow.id),
            eq(productCodeVersions.branchId, numericBranchId)
          )
        )
        .orderBy(desc(productCodeVersions.id))
        .limit(1);

      if (!versionRow) {
        throw new Error('FAILED_TO_CREATE_PRODUCT_CODE_VERSION');
      }

      await tx.insert(loanForfeitures).values({
        loanId,
        codeId: productCodeRow.id,
      });

      await tx.insert(stockLedger).values({
        productCodeVersionId: versionRow.id,
        reason: 'pawn_forfeit_in',
        qtyChange: 1,
        referenceId: loanId,
        referenceType: 'loan',
        notes: `Forfeit collateral ${collateralRow.id}`,
      });

      const [ledgerRow] = await tx
        .select({
          id: stockLedger.id,
          productCodeVersionId: stockLedger.productCodeVersionId,
          reason: stockLedger.reason,
          qtyChange: stockLedger.qtyChange,
          referenceId: stockLedger.referenceId,
          referenceType: stockLedger.referenceType,
          notes: stockLedger.notes,
          createdAt: stockLedger.createdAt,
        })
        .from(stockLedger)
        .where(
          and(
            eq(stockLedger.productCodeVersionId, versionRow.id),
            eq(stockLedger.referenceId, loanId),
            eq(stockLedger.reason, 'pawn_forfeit_in')
          )
        )
        .orderBy(desc(stockLedger.id))
        .limit(1);

      await tx
        .update(loans)
        .set({ status: 'forfeited' })
        .where(eq(loans.id, loanId));

      return {
        collateral: collateralRow,
        productCode: productCodeRow,
        version: versionRow,
        ledger: ledgerRow,
      };
    });

    const detail = await getLoanDetail(loanId);

    res.status(201).json({
      ...detail,
      forfeiture: {
        collateral: result.collateral,
        productCode: result.productCode,
        productCodeVersion: result.version,
        ledgerEntry: result.ledger,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_PRODUCT_CODE') {
      return res.status(500).json({ error: 'Unable to create product code' });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_PRODUCT_CODE_VERSION') {
      return res.status(500).json({ error: 'Unable to create product code version' });
    }

    next(error);
  }
});

app.get('/api/loans/past-due', async (req, res, next) => {
  try {
    const {
      branchId = null,
      status = null,
      search = '',
      bucket = null,
      limit = '300',
      minDaysLate = null,
      maxDaysLate = null,
      asOf = null,
    } = req.query ?? {};

    const normalizedBranchId =
      branchId == null || branchId === '' ? null : Number(Array.isArray(branchId) ? branchId[0] : branchId);

    if (normalizedBranchId != null && (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0)) {
      return res.status(400).json({ error: 'branchId must be a positive integer when provided' });
    }

    const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
    let statusFilter = null;
    if (normalizedStatus) {
      if (!['active', 'renewed'].includes(normalizedStatus)) {
        return res.status(400).json({ error: 'status must be "active" or "renewed" when provided' });
      }

      statusFilter = normalizedStatus;
    }

    const statusList = statusFilter ? [statusFilter] : ['active', 'renewed'];

    const searchTerm = typeof search === 'string' ? search.trim() : '';

    const normalizedBucket =
      typeof bucket === 'string' && allowedPastDueBuckets.has(bucket.trim()) ? bucket.trim() : null;

    const minDaysValue =
      minDaysLate == null || minDaysLate === '' ? null : Number(Array.isArray(minDaysLate) ? minDaysLate[0] : minDaysLate);
    if (minDaysValue != null && (!Number.isFinite(minDaysValue) || minDaysValue < 0)) {
      return res.status(400).json({ error: 'minDaysLate must be zero or greater when provided' });
    }

    const maxDaysValue =
      maxDaysLate == null || maxDaysLate === '' ? null : Number(Array.isArray(maxDaysLate) ? maxDaysLate[0] : maxDaysLate);
    if (maxDaysValue != null && (!Number.isFinite(maxDaysValue) || maxDaysValue < 0)) {
      return res.status(400).json({ error: 'maxDaysLate must be zero or greater when provided' });
    }

    if (minDaysValue != null && maxDaysValue != null && minDaysValue > maxDaysValue) {
      return res.status(400).json({ error: 'minDaysLate cannot be greater than maxDaysLate' });
    }

    const limitValue = Number(Array.isArray(limit) ? limit[0] : limit);
    const safeLimit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 1000) : 300;

    let referenceDate = new Date();
    if (typeof asOf === 'string' && asOf.trim()) {
      const parsed = parseDateOnly(asOf.trim());
      if (parsed) {
        referenceDate = parsed;
      }
    }

    const asOfIso = referenceDate.toISOString().slice(0, 10);

    const filters = [inArray(loans.status, statusList), sql`${loans.dueDate} <= ${asOfIso}`];

    if (normalizedBranchId != null) {
      filters.push(eq(loans.branchId, normalizedBranchId));
    }

    if (searchTerm) {
      const safeSearch = searchTerm.replace(/[%_]/g, '\\$&');
      const likePattern = `%${safeSearch}%`;
      filters.push(
        or(
          like(loans.ticketNumber, likePattern),
          like(customers.firstName, likePattern),
          like(customers.lastName, likePattern),
          like(customers.phone, likePattern)
        )
      );
    }

    const baseRows = await db
      .select({
        id: loans.id,
        branchId: loans.branchId,
        branchName: branches.name,
        customerId: loans.customerId,
        ticketNumber: loans.ticketNumber,
        principalCents: loans.principalCents,
        interestModelId: loans.interestModelId,
        interestModelName: interestModels.name,
        graceDays: interestModels.graceDays,
        dueDate: loans.dueDate,
        status: loans.status,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        customerEmail: customers.email,
      })
      .from(loans)
      .leftJoin(customers, eq(customers.id, loans.customerId))
      .leftJoin(interestModels, eq(interestModels.id, loans.interestModelId))
      .leftJoin(branches, eq(branches.id, loans.branchId))
      .where(and(...filters))
      .orderBy(asc(loans.dueDate), asc(loans.id))
      .limit(safeLimit);

    const snapshots = await hydratePastDueLoans(db, baseRows, {
      includeNotifications: true,
      now: referenceDate,
    });

    const branchOptionMap = new Map();
    for (const snapshot of snapshots) {
      if (snapshot.branchId != null && !branchOptionMap.has(snapshot.branchId)) {
        branchOptionMap.set(snapshot.branchId, {
          id: snapshot.branchId,
          name: snapshot.branchName ?? `Sucursal ${snapshot.branchId}`,
        });
      }
    }

    let filteredSnapshots = snapshots;

    if (normalizedBucket) {
      filteredSnapshots = filteredSnapshots.filter((loan) => loan.bucket === normalizedBucket);
    }

    if (minDaysValue != null) {
      filteredSnapshots = filteredSnapshots.filter((loan) => (loan.daysLate ?? 0) >= minDaysValue);
    }

    if (maxDaysValue != null) {
      filteredSnapshots = filteredSnapshots.filter((loan) => (loan.daysLate ?? 0) <= maxDaysValue);
    }

    if (normalizedBranchId != null) {
      filteredSnapshots = filteredSnapshots.filter((loan) => loan.branchId === normalizedBranchId);
    }

    filteredSnapshots.sort((a, b) => {
      const diffDays = (b.daysLate ?? 0) - (a.daysLate ?? 0);
      if (diffDays !== 0) {
        return diffDays;
      }

      const diffDue = (b.totalDueCents ?? 0) - (a.totalDueCents ?? 0);
      if (diffDue !== 0) {
        return diffDue;
      }

      return (a.ticketNumber ?? '').localeCompare(b.ticketNumber ?? '');
    });

    const summary = {
      totalCount: filteredSnapshots.length,
      totalPrincipalCents: 0,
      totalInterestCents: 0,
      totalDueCents: 0,
      bucketCounts: Object.fromEntries(pastDueBucketOrder.map((bucketKey) => [bucketKey, 0])),
    };

    for (const loan of filteredSnapshots) {
      summary.totalPrincipalCents += Math.max(0, Number(loan.outstandingPrincipalCents ?? 0));
      summary.totalInterestCents += Math.max(0, Number(loan.outstandingInterestCents ?? 0));
      summary.totalDueCents += Math.max(0, Number(loan.totalDueCents ?? 0));

      if (loan.bucket && summary.bucketCounts[loan.bucket] != null) {
        summary.bucketCounts[loan.bucket] += 1;
      }
    }

    res.json({
      generatedAt: new Date().toISOString(),
      asOf: asOfIso,
      filters: {
        branchId: normalizedBranchId,
        statuses: statusList,
        bucket: normalizedBucket,
        minDaysLate: minDaysValue,
        maxDaysLate: maxDaysValue,
        search: searchTerm,
        limit: safeLimit,
      },
      availableBranches: Array.from(branchOptionMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      summary,
      loans: filteredSnapshots,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/loans/outreach', async (req, res, next) => {
  try {
    const { loanIds = [], channel, message, dryRun = false } = req.body ?? {};

    if (!Array.isArray(loanIds) || loanIds.length === 0) {
      return res.status(400).json({ error: 'loanIds must include at least one id' });
    }

    const normalizedLoanIds = Array.from(
      new Set(
        loanIds
          .map((value) => Number(value))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    if (normalizedLoanIds.length === 0) {
      return res.status(400).json({ error: 'loanIds must include at least one valid id' });
    }

    const normalizedChannel = typeof channel === 'string' ? channel.trim().toLowerCase() : '';
    if (!['sms', 'whatsapp'].includes(normalizedChannel)) {
      return res.status(400).json({ error: 'channel must be "sms" or "whatsapp"' });
    }

    const template = typeof message === 'string' ? message.trim() : '';
    if (!template) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (template.length > 640) {
      return res.status(400).json({ error: 'message must be 640 characters or fewer' });
    }

    const loanRows = await db
      .select({
        id: loans.id,
        branchId: loans.branchId,
        branchName: branches.name,
        customerId: loans.customerId,
        ticketNumber: loans.ticketNumber,
        principalCents: loans.principalCents,
        interestModelId: loans.interestModelId,
        interestModelName: interestModels.name,
        graceDays: interestModels.graceDays,
        dueDate: loans.dueDate,
        status: loans.status,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        customerEmail: customers.email,
      })
      .from(loans)
      .leftJoin(customers, eq(customers.id, loans.customerId))
      .leftJoin(interestModels, eq(interestModels.id, loans.interestModelId))
      .leftJoin(branches, eq(branches.id, loans.branchId))
      .where(inArray(loans.id, normalizedLoanIds));

    if (loanRows.length === 0) {
      return res.status(404).json({ error: 'No matching loans found' });
    }

    const snapshots = await hydratePastDueLoans(db, loanRows, { includeNotifications: false });
    const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

    const queued = [];
    const skipped = [];

    await db.transaction(async (tx) => {
      for (const loanId of normalizedLoanIds) {
        const snapshot = snapshotMap.get(loanId);

        if (!snapshot) {
          skipped.push({ loanId, reason: 'not_past_due' });
          continue;
        }

        const recipient = normalizePhoneInput(snapshot.contactPhone);
        if (!recipient) {
          skipped.push({ loanId, reason: 'missing_phone' });
          continue;
        }

        const context = buildLoanOutreachContext(snapshot);
        const rendered = renderOutreachTemplate(template, context).trim();

        if (!rendered) {
          skipped.push({ loanId, reason: 'empty_message' });
          continue;
        }

        if (!dryRun) {
          await queueNotificationMessage(tx, {
            loanId,
            customerId: snapshot.customerId ?? null,
            channel: normalizedChannel,
            recipient,
            message: rendered,
          });
        }

        queued.push({
          loanId,
          recipient,
          message: rendered,
          preview: {
            customerName: context.customerName,
            totalDue: context.totalDueFormatted,
            daysLate: context.daysLate,
          },
        });
      }
    });

    const summary = {
      requested: normalizedLoanIds.length,
      queued: queued.length,
      skipped: skipped.length,
    };

    res.status(dryRun ? 200 : 201).json({
      channel: normalizedChannel,
      message: template,
      queued,
      skipped,
      summary,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports/loans-aging', async (req, res, next) => {
  try {
    const {
      branchId = null,
      statuses = null,
      bucket = null,
      minDaysLate = null,
      maxDaysLate = null,
      asOf = null,
      limit = '2000',
    } = req.query ?? {};

    let branchFilter = null;
    if (branchId != null && branchId !== '') {
      const parsedBranchId = Number(Array.isArray(branchId) ? branchId[0] : branchId);
      if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
        return res.status(400).json({ error: 'branchId must be a positive integer when provided' });
      }
      branchFilter = parsedBranchId;
    }

    const statusValues = Array.isArray(statuses)
      ? statuses
      : typeof statuses === 'string' && statuses
      ? statuses.split(',')
      : [];

    const allowedStatuses = new Set(['active', 'renewed', 'redeemed', 'forfeited']);
    const normalizedStatuses = Array.from(
      new Set(
        statusValues
          .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
          .filter((value) => allowedStatuses.has(value))
      )
    );

    const statusList = normalizedStatuses.length > 0 ? normalizedStatuses : ['active', 'renewed'];

    const bucketValue =
      typeof bucket === 'string' && bucket.trim() ? bucket.trim().toLowerCase() : null;
    if (bucketValue && bucketValue !== 'all' && !loanAgingBucketSet.has(bucketValue)) {
      return res.status(400).json({ error: 'bucket is invalid' });
    }
    const normalizedBucket = bucketValue === 'all' ? null : bucketValue;

    const minDaysValue =
      minDaysLate == null || minDaysLate === ''
        ? null
        : Number(Array.isArray(minDaysLate) ? minDaysLate[0] : minDaysLate);
    if (minDaysValue != null && (!Number.isFinite(minDaysValue) || minDaysValue < 0)) {
      return res.status(400).json({ error: 'minDaysLate must be zero or greater when provided' });
    }

    const maxDaysValue =
      maxDaysLate == null || maxDaysLate === ''
        ? null
        : Number(Array.isArray(maxDaysLate) ? maxDaysLate[0] : maxDaysLate);
    if (maxDaysValue != null && (!Number.isFinite(maxDaysValue) || maxDaysValue < 0)) {
      return res.status(400).json({ error: 'maxDaysLate must be zero or greater when provided' });
    }

    if (minDaysValue != null && maxDaysValue != null && minDaysValue > maxDaysValue) {
      return res.status(400).json({ error: 'minDaysLate cannot be greater than maxDaysLate' });
    }

    const limitValue = Number(Array.isArray(limit) ? limit[0] : limit);
    const safeLimit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 5000) : 2000;

    let referenceDate = new Date();
    if (typeof asOf === 'string' && asOf.trim()) {
      const parsed = parseDateOnly(asOf.trim());
      if (parsed) {
        referenceDate = parsed;
      }
    }

    const asOfIso = referenceDate.toISOString().slice(0, 10);

    const filters = [inArray(loans.status, statusList)];
    if (branchFilter != null) {
      filters.push(eq(loans.branchId, branchFilter));
    }

    const condition = filters.length === 1 ? filters[0] : and(...filters);

    const loanRows = await db
      .select({
        id: loans.id,
        branchId: loans.branchId,
        branchName: branches.name,
        customerId: loans.customerId,
        ticketNumber: loans.ticketNumber,
        principalCents: loans.principalCents,
        interestModelId: loans.interestModelId,
        interestModelName: interestModels.name,
        graceDays: interestModels.graceDays,
        dueDate: loans.dueDate,
        status: loans.status,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        customerEmail: customers.email,
      })
      .from(loans)
      .leftJoin(customers, eq(customers.id, loans.customerId))
      .leftJoin(interestModels, eq(interestModels.id, loans.interestModelId))
      .leftJoin(branches, eq(branches.id, loans.branchId))
      .where(condition)
      .orderBy(asc(loans.dueDate), asc(loans.id))
      .limit(safeLimit);

    const snapshots = await hydrateLoanAgingSnapshots(db, loanRows, { now: referenceDate });

    const branchOptionMap = new Map();
    for (const snapshot of snapshots) {
      if (snapshot.branchId != null && !branchOptionMap.has(snapshot.branchId)) {
        branchOptionMap.set(snapshot.branchId, {
          id: snapshot.branchId,
          name: snapshot.branchName ?? `Sucursal ${snapshot.branchId}`,
        });
      }
    }

    let filteredSnapshots = snapshots;
    if (normalizedBucket) {
      filteredSnapshots = filteredSnapshots.filter((loan) => loan.bucket === normalizedBucket);
    }

    if (minDaysValue != null) {
      filteredSnapshots = filteredSnapshots.filter((loan) => (loan.daysLate ?? 0) >= minDaysValue);
    }

    if (maxDaysValue != null) {
      filteredSnapshots = filteredSnapshots.filter((loan) => (loan.daysLate ?? 0) <= maxDaysValue);
    }

    if (branchFilter != null) {
      filteredSnapshots = filteredSnapshots.filter((loan) => loan.branchId === branchFilter);
    }

    filteredSnapshots.sort((a, b) => {
      const bucketIndexA = loanAgingBucketOrder.indexOf(a.bucket ?? 'current');
      const bucketIndexB = loanAgingBucketOrder.indexOf(b.bucket ?? 'current');
      if (bucketIndexA !== bucketIndexB) {
        return bucketIndexA - bucketIndexB;
      }

      const daysLateA = a.daysLate ?? 0;
      const daysLateB = b.daysLate ?? 0;
      if (daysLateA !== daysLateB) {
        return daysLateB - daysLateA;
      }

      const totalDueDiff = (b.totalDueCents ?? 0) - (a.totalDueCents ?? 0);
      if (totalDueDiff !== 0) {
        return totalDueDiff;
      }

      return (a.ticketNumber ?? '').localeCompare(b.ticketNumber ?? '');
    });

    const summary = {
      totalCount: filteredSnapshots.length,
      totalPrincipalCents: 0,
      totalInterestCents: 0,
      totalDueCents: 0,
      bucketTotals: Object.fromEntries(
        loanAgingBucketOrder.map((bucketKey) => [bucketKey, {
          count: 0,
          principalCents: 0,
          interestCents: 0,
          totalDueCents: 0,
        }])
      ),
    };

    for (const loan of filteredSnapshots) {
      summary.totalPrincipalCents += Math.max(0, Number(loan.outstandingPrincipalCents ?? 0));
      summary.totalInterestCents += Math.max(0, Number(loan.outstandingInterestCents ?? 0));
      summary.totalDueCents += Math.max(0, Number(loan.totalDueCents ?? 0));

      const bucketKey = loan.bucket ?? 'current';
      const bucketSummary = summary.bucketTotals[bucketKey];
      if (bucketSummary) {
        bucketSummary.count += 1;
        bucketSummary.principalCents += Math.max(0, Number(loan.outstandingPrincipalCents ?? 0));
        bucketSummary.interestCents += Math.max(0, Number(loan.outstandingInterestCents ?? 0));
        bucketSummary.totalDueCents += Math.max(0, Number(loan.totalDueCents ?? 0));
      }
    }

    res.json({
      generatedAt: new Date().toISOString(),
      asOf: asOfIso,
      filters: {
        branchId: branchFilter,
        statuses: statusList,
        bucket: normalizedBucket,
        minDaysLate: minDaysValue,
        maxDaysLate: maxDaysValue,
        limit: safeLimit,
      },
      bucketOrder: loanAgingBucketOrder,
      availableBranches: Array.from(branchOptionMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      summary,
      loans: filteredSnapshots,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/instapawn', async (req, res, next) => {
  try {
    const {
      branchId,
      customerFirstName,
      customerLastName = null,
      customerPhone,
      customerEmail = null,
      governmentId = null,
      itemCategory = null,
      itemDescription,
      collateral = [],
      requestedPrincipalCents = null,
      autoAppraisedValueCents = null,
      interestModelId = null,
      notes = null,
      expiresInHours = null,
    } = req.body ?? {};

    if (branchId == null) {
      return res.status(400).json({ error: 'branchId is required' });
    }

    const numericBranchId = Number(branchId);
    if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
      return res.status(400).json({ error: 'branchId must be a positive integer' });
    }

    const firstName = normalizeOptionalString(customerFirstName, { maxLength: 120 });
    if (!firstName) {
      return res.status(400).json({ error: 'customerFirstName is required' });
    }

    const phone = normalizePhoneInput(customerPhone);
    if (!phone) {
      return res.status(400).json({ error: 'customerPhone must include at least 8 digits' });
    }

    const lastName = normalizeOptionalString(customerLastName, { maxLength: 120 });
    const email = normalizeOptionalString(customerEmail, { maxLength: 190 });
    const govId = normalizeOptionalString(governmentId, { maxLength: 32 });
    const category = normalizeOptionalString(itemCategory, { maxLength: 120 });
    const description = normalizeOptionalString(itemDescription, { maxLength: 4000 });

    if (!description) {
      return res.status(400).json({ error: 'itemDescription is required' });
    }

    const normalizedNotes = normalizeOptionalString(notes, { maxLength: 4000 });

    const requestedPrincipal =
      requestedPrincipalCents == null ? null : Number(requestedPrincipalCents);
    if (requestedPrincipal != null && (!Number.isFinite(requestedPrincipal) || requestedPrincipal <= 0)) {
      return res.status(400).json({
        error: 'requestedPrincipalCents must be greater than 0 when provided',
      });
    }

    const autoAppraised =
      autoAppraisedValueCents == null ? null : Number(autoAppraisedValueCents);
    if (autoAppraised != null && (!Number.isFinite(autoAppraised) || autoAppraised < 0)) {
      return res.status(400).json({
        error: 'autoAppraisedValueCents must be zero or greater when provided',
      });
    }

    const normalizedInterestModelId =
      interestModelId == null ? null : Number(interestModelId);
    if (
      normalizedInterestModelId != null &&
      (!Number.isInteger(normalizedInterestModelId) || normalizedInterestModelId <= 0)
    ) {
      return res.status(400).json({
        error: 'interestModelId must be a positive integer when provided',
      });
    }

    const collateralInput =
      Array.isArray(collateral) && collateral.length > 0
        ? collateral
        : [
            {
              description,
              estimatedValueCents:
                requestedPrincipal != null
                  ? Math.round(requestedPrincipal)
                  : autoAppraised != null
                  ? Math.round(autoAppraised)
                  : null,
            },
          ];

    const normalizedCollateral = normalizeCollateralDraftList(collateralInput);

    if (normalizedCollateral.length === 0) {
      normalizedCollateral.push({ description, estimatedValueCents: null, photoPath: null });
    }

    const expiresAt = calculateBarcodeExpiry(expiresInHours);

    const result = await db.transaction(async (tx) => {
      const token = await generateUniqueBarcodeToken(tx);
      await tx.insert(instapawnIntakes).values({
        branchId: numericBranchId,
        customerFirstName: firstName,
        customerLastName: lastName,
        customerPhone: phone,
        customerEmail: email,
        governmentId: govId,
        itemCategory: category,
        itemDescription: description,
        collateral: normalizedCollateral,
        requestedPrincipalCents:
          requestedPrincipal == null ? null : Math.round(requestedPrincipal),
        autoAppraisedValueCents:
          autoAppraised == null ? null : Math.round(autoAppraised),
        interestModelId: normalizedInterestModelId,
        notes: normalizedNotes,
        barcodeToken: token,
        barcodeExpiresAt: expiresAt,
      });

      const [intakeRow] = await tx
        .select(instapawnSelection)
        .from(instapawnIntakes)
        .where(eq(instapawnIntakes.barcodeToken, token))
        .limit(1);

      if (!intakeRow) {
        throw new Error('FAILED_TO_CREATE_INSTAPAWN');
      }

      const message = buildInstapawnNotificationMessage(intakeRow, expiresAt);
      await queueNotificationMessage(tx, {
        intakeId: intakeRow.id,
        customerId: null,
        channel: 'sms',
        recipient: phone,
        message,
      });
      await queueNotificationMessage(tx, {
        intakeId: intakeRow.id,
        customerId: null,
        channel: 'whatsapp',
        recipient: phone,
        message,
      });

      await tx
        .update(instapawnIntakes)
        .set({ status: 'notified', notifiedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(instapawnIntakes.id, intakeRow.id));

      const [[finalRow], notificationRows] = await Promise.all([
        tx
          .select(instapawnSelection)
          .from(instapawnIntakes)
          .where(eq(instapawnIntakes.id, intakeRow.id))
          .limit(1),
        tx
          .select({
            id: notificationMessages.id,
            intakeId: notificationMessages.intakeId,
            customerId: notificationMessages.customerId,
            channel: notificationMessages.channel,
            recipient: notificationMessages.recipient,
            message: notificationMessages.message,
            status: notificationMessages.status,
            error: notificationMessages.error,
            sentAt: notificationMessages.sentAt,
            createdAt: notificationMessages.createdAt,
          })
          .from(notificationMessages)
          .where(eq(notificationMessages.intakeId, intakeRow.id)),
      ]);

      if (!finalRow) {
        throw new Error('FAILED_TO_CREATE_INSTAPAWN');
      }

      return {
        intake: finalRow,
        notifications: notificationRows,
      };
    });

    res.status(201).json({
      intake: serializeInstapawnIntake(result.intake),
      notifications: result.notifications.map(serializeNotificationMessage),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_INSTAPAWN') {
      return res.status(500).json({ error: 'Unable to create InstaPawn intake' });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_GENERATE_TOKEN') {
      return res.status(500).json({ error: 'Unable to generate barcode token' });
    }

    next(error);
  }
});

app.get('/api/instapawn', async (req, res, next) => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : null;

    let statement = db.select(instapawnSelection).from(instapawnIntakes);

    if (statusFilter) {
      statement = statement.where(eq(instapawnIntakes.status, statusFilter));
    }

    let intakeRows = await statement.orderBy(desc(instapawnIntakes.createdAt));

    const expirable = new Set(['pending', 'notified']);
    const expiredIds = intakeRows
      .filter((row) => expirable.has(row.status) && determineIntakeExpirationState(row))
      .map((row) => Number(row.id));

    if (expiredIds.length > 0) {
      await db
        .update(instapawnIntakes)
        .set({ status: 'expired' })
        .where(inArray(instapawnIntakes.id, expiredIds));

      const refreshedRows = await db
        .select(instapawnSelection)
        .from(instapawnIntakes)
        .where(inArray(instapawnIntakes.id, expiredIds));

      const refreshedMap = new Map(refreshedRows.map((row) => [Number(row.id), row]));
      intakeRows = intakeRows.map((row) => refreshedMap.get(Number(row.id)) ?? row);
    }

    const ids = intakeRows.map((row) => Number(row.id));
    const notificationMap = await fetchNotificationMap(db, ids);

    const payload = intakeRows.map((row) => {
      const serialized = serializeInstapawnIntake(row);
      return {
        ...serialized,
        notifications: notificationMap.get(Number(row.id)) ?? [],
      };
    });

    res.json({ intakes: payload });
  } catch (error) {
    next(error);
  }
});

app.get('/api/instapawn/:token', async (req, res, next) => {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token.trim() : '';

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const [row] = await db
      .select(instapawnSelection)
      .from(instapawnIntakes)
      .where(eq(instapawnIntakes.barcodeToken, token))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'InstaPawn intake not found' });
    }

    let intakeRow = row;

    if (row.status !== 'converted' && row.status !== 'cancelled' && determineIntakeExpirationState(row)) {
      await db
        .update(instapawnIntakes)
        .set({ status: 'expired' })
        .where(eq(instapawnIntakes.id, row.id));

      const [refreshed] = await db
        .select(instapawnSelection)
        .from(instapawnIntakes)
        .where(eq(instapawnIntakes.id, row.id))
        .limit(1);

      if (refreshed) {
        intakeRow = refreshed;
      }
    }

    const notificationMap = await fetchNotificationMap(db, [Number(intakeRow.id)]);

    res.json({
      intake: serializeInstapawnIntake(intakeRow),
      notifications: notificationMap.get(Number(intakeRow.id)) ?? [],
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/instapawn/:token/convert', async (req, res, next) => {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token.trim() : '';

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const [row] = await db
      .select(instapawnSelection)
      .from(instapawnIntakes)
      .where(eq(instapawnIntakes.barcodeToken, token))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'InstaPawn intake not found' });
    }

    if (row.status === 'converted') {
      return res.status(409).json({ error: 'InstaPawn intake already converted' });
    }

    if (row.status === 'cancelled') {
      return res.status(409).json({ error: 'InstaPawn intake has been cancelled' });
    }

    if (determineIntakeExpirationState(row)) {
      await db
        .update(instapawnIntakes)
        .set({ status: 'expired' })
        .where(eq(instapawnIntakes.id, row.id));

      return res.status(410).json({ error: 'InstaPawn token has expired' });
    }

    const {
      branchId = null,
      customerId,
      ticketNumber,
      interestModelId = null,
      principalCents = null,
      schedule = [],
      collateral = null,
      idImagePaths = [],
      comments = null,
    } = req.body ?? {};

    if (customerId == null) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    if (!ticketNumber || typeof ticketNumber !== 'string' || !ticketNumber.trim()) {
      return res.status(400).json({ error: 'ticketNumber is required' });
    }

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ error: 'schedule must include at least one entry' });
    }

    const intakeData = serializeInstapawnIntake(row);
    const effectiveBranchId = branchId ?? intakeData.branchId;
    const effectiveInterestModelId = interestModelId ?? intakeData.interestModelId;

    if (effectiveInterestModelId == null) {
      return res.status(400).json({ error: 'interestModelId is required to convert intake' });
    }

    const effectivePrincipal =
      principalCents ??
      intakeData.requestedPrincipalCents ??
      intakeData.autoAppraisedValueCents;

    if (effectivePrincipal == null) {
      return res.status(400).json({ error: 'principalCents is required to convert intake' });
    }

    const collateralSource =
      collateral != null
        ? collateral
        : intakeData.collateral.length > 0
        ? intakeData.collateral
        : [
            {
              description: intakeData.itemDescription,
              estimatedValueCents: effectivePrincipal,
            },
          ];

    const prepared = await prepareLoanCreationInput(
      db,
      {
        branchId: effectiveBranchId,
        customerId,
        ticketNumber,
        interestModelId: effectiveInterestModelId,
        principalCents: effectivePrincipal,
        comments: comments ?? intakeData.notes ?? null,
        schedule,
        collateral: collateralSource,
        idImagePaths,
      },
      { allowZeroInterest: true }
    );

    const conversionResult = await db.transaction(async (tx) => {
      const createdLoan = await createLoanWithPreparedPayload(tx, prepared);

      await tx
        .update(instapawnIntakes)
        .set({
          status: 'converted',
          convertedLoanId: createdLoan.loan.id,
          convertedAt: sql`CURRENT_TIMESTAMP`,
          barcodeScannedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(instapawnIntakes.id, row.id));

      const [updatedIntake] = await tx
        .select(instapawnSelection)
        .from(instapawnIntakes)
        .where(eq(instapawnIntakes.id, row.id))
        .limit(1);

      if (!updatedIntake) {
        throw new Error('FAILED_TO_CONVERT_INSTAPAWN');
      }

      const conversionMessage = buildInstapawnConversionMessage(updatedIntake, prepared.ticketNumber);
      await queueNotificationMessage(tx, {
        intakeId: updatedIntake.id,
        channel: 'sms',
        recipient: row.customerPhone,
        message: conversionMessage,
      });
      await queueNotificationMessage(tx, {
        intakeId: updatedIntake.id,
        channel: 'whatsapp',
        recipient: row.customerPhone,
        message: conversionMessage,
      });

      return { intake: updatedIntake, loan: createdLoan };
    });

    const notificationMap = await fetchNotificationMap(db, [Number(conversionResult.intake.id)]);
    const loanPayload = serializeLoanResponsePayload(conversionResult.loan);

    res.status(201).json({
      intake: serializeInstapawnIntake(conversionResult.intake),
      loan: loanPayload.loan,
      collateral: loanPayload.collateral,
      schedule: loanPayload.schedule,
      idImagePaths: loanPayload.idImagePaths,
      notifications: notificationMap.get(Number(conversionResult.intake.id)) ?? [],
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_LOAN') {
      return res.status(500).json({ error: 'Unable to create loan' });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CONVERT_INSTAPAWN') {
      return res.status(500).json({ error: 'Unable to convert InstaPawn intake' });
    }

    next(error);
  }
});

async function signIdImageUploadRequest(req, res, next) {
  try {
    const { fileName = 'id-image', contentType, expiresInSeconds = 300, contentLength = null } = req.body ?? {};

    if (!contentType || typeof contentType !== 'string') {
      return res.status(400).json({ error: 'contentType is required' });
    }

    const normalizedContentType = contentType.toLowerCase();

    if (!allowedIdImageContentTypes.has(normalizedContentType)) {
      return res.status(415).json({ error: 'Unsupported content type' });
    }

    if (contentLength != null) {
      const numericLength = Number(contentLength);
      if (!Number.isFinite(numericLength) || numericLength <= 0) {
        return res.status(400).json({ error: 'contentLength must be a positive number when provided' });
      }

      if (numericLength > maxIdImageBytes) {
        return res.status(413).json({ error: 'contentLength exceeds the allowed limit' });
      }
    }

    const requestedExpiry = Number(expiresInSeconds);
    const expirySeconds = Number.isFinite(requestedExpiry) && requestedExpiry > 0
      ? Math.min(Math.max(60, Math.round(requestedExpiry)), maxUploadExpirySeconds)
      : Math.min(300, maxUploadExpirySeconds);

    const expiresAt = new Date(Date.now() + expirySeconds * 1000);
    const expiresAtIso = expiresAt.toISOString();
    const storagePath = buildIdImageStoragePath(fileName, normalizedContentType);
    const signature = signUploadPayload(storagePath, normalizedContentType, expiresAtIso);

    const actorId = parseActorId(req);

    await db
      .insert(idImageUploadTokens)
      .values({
        path: storagePath,
        signature,
        expiresAt,
        issuedTo: actorId ?? null,
      })
      .onDuplicateKeyUpdate({
        set: {
          signature,
          expiresAt,
          issuedTo: actorId ?? null,
          issuedAt: sql`CURRENT_TIMESTAMP`,
          usedAt: null,
        },
      });

    const uploadUrl = `${uploadBaseUrl}/${storagePath}`;
    const publicUrl = `${uploadPublicUrl}/${storagePath}`;

    return res.json({
      upload: {
        url: uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': normalizedContentType,
          'x-upload-signature': signature,
          'x-upload-expires': expiresAtIso,
        },
        expiresAt: expiresAtIso,
        maxBytes: maxIdImageBytes,
      },
      asset: {
        path: storagePath,
        url: publicUrl,
        contentType: normalizedContentType,
      },
      signature,
    });
  } catch (error) {
    next(error);
  }
}

app.post('/api/uploads/id-images/sign', signIdImageUploadRequest);

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

function normalizeComponentLines(rawComponents) {
  if (!Array.isArray(rawComponents) || rawComponents.length === 0) {
    throw new HttpError(400, 'components must be a non-empty array');
  }

  const normalized = [];
  const seen = new Set();

  rawComponents.forEach((entry, index) => {
    const versionId = Number(entry?.childVersionId ?? entry?.productCodeVersionId ?? entry?.versionId);

    if (!Number.isInteger(versionId) || versionId <= 0) {
      throw new HttpError(400, `components[${index}].childVersionId must be a positive integer`);
    }

    if (seen.has(versionId)) {
      throw new HttpError(400, 'Each component version can only be listed once');
    }

    const qtyCandidate = Number(entry?.quantity ?? entry?.qty ?? entry?.qtyPerParent ?? entry?.ratio);
    if (!Number.isFinite(qtyCandidate) || qtyCandidate <= 0) {
      throw new HttpError(400, `components[${index}].quantity must be a positive number`);
    }

    if (!Number.isInteger(qtyCandidate)) {
      throw new HttpError(400, `components[${index}].quantity must be an integer count`);
    }

    seen.add(versionId);
    normalized.push({
      versionId,
      qtyPerParent: Math.round(qtyCandidate),
    });
  });

  return normalized;
}

async function getInventoryComponentSnapshot() {
  // Use raw SQL for the component query to avoid alias conflicts with self-join
  const componentRowsResult = await db.execute(sql`
    SELECT 
      pc.parent_code_id as parentCodeId,
      pc.child_code_id as childCodeId,
      pc.qty_ratio as qtyRatio,
      parent.code as parentCode,
      parent.name as parentName,
      child.code as childCode,
      child.name as childName
    FROM product_code_components pc
    INNER JOIN product_codes parent ON pc.parent_code_id = parent.id
    INNER JOIN product_codes child ON pc.child_code_id = child.id
    ORDER BY parent.code, child.code
  `);

  const [componentRows, versionRows] = await Promise.all([
    Promise.resolve(componentRowsResult[0] || []),
    db
      .select({
        productCodeVersionId: productCodeVersions.id,
        productCodeId: productCodeVersions.productCodeId,
        branchId: productCodeVersions.branchId,
        branchName: branches.name,
        qtyOnHand: productCodeVersions.qtyOnHand,
        costCents: productCodeVersions.costCents,
        priceCents: productCodeVersions.priceCents,
        code: productCodes.code,
        name: productCodes.name,
        sku: productCodes.sku,
      })
      .from(productCodeVersions)
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .leftJoin(branches, eq(productCodeVersions.branchId, branches.id))
      .orderBy(asc(productCodes.code), asc(productCodeVersions.branchId), asc(productCodeVersions.id)),
  ]);

  const treeMap = new Map();

  for (const version of versionRows) {
    const productCodeId = Number(version.productCodeId);
    if (!treeMap.has(productCodeId)) {
      treeMap.set(productCodeId, {
        productCodeId,
        code: version.code,
        name: version.name,
        components: [],
      });
    }
  }

  for (const row of componentRows) {
    const parentId = Number(row.parentCodeId);
    let node = treeMap.get(parentId);

    if (!node) {
      node = {
        productCodeId: parentId,
        code: row.parentCode,
        name: row.parentName,
        components: [],
      };
      treeMap.set(parentId, node);
    }

    node.components.push({
      childProductCodeId: Number(row.childCodeId),
      code: row.childCode,
      name: row.childName,
      qtyRatio: Number(row.qtyRatio),
    });

    if (!treeMap.has(Number(row.childCodeId))) {
      treeMap.set(Number(row.childCodeId), {
        productCodeId: Number(row.childCodeId),
        code: row.childCode,
        name: row.childName,
        components: [],
      });
    }
  }

  const tree = Array.from(treeMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  tree.forEach((entry) => entry.components.sort((a, b) => a.code.localeCompare(b.code)));

  const versions = versionRows.map((row) => {
    const branchId = row.branchId == null ? null : Number(row.branchId);
    return {
      productCodeVersionId: Number(row.productCodeVersionId),
      productCodeId: Number(row.productCodeId),
      branchId,
      branchName: branchId == null ? null : row.branchName ?? null,
      qtyOnHand: Number(row.qtyOnHand ?? 0),
      costCents: row.costCents == null ? null : Number(row.costCents),
      priceCents: row.priceCents == null ? null : Number(row.priceCents),
      code: row.code,
      name: row.name,
      sku: row.sku ?? null,
    };
  });

  return { components: tree, versions };
}

app.get('/api/inventory/component-tree', async (req, res, next) => {
  try {
    const snapshot = await getInventoryComponentSnapshot();
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard/summary', async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = startOfTomorrow(now);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const ninetyDaysAgo = new Date(todayStart);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const openLoanStatuses = ['active', 'renewed'];

    const [
      [principalOutRow],
      [loansTodayRow],
      [pawnsPastDueRow],
      [renewalsTodayRow],
      [renewalsYesterdayRow],
      [layawaysTodayRow],
      [layawayPaymentsRow],
      [salesTotalTodayRow],
      [salesTotalYesterdayRow],
      [salesQtyTodayRow],
      [purchasesTodayRow],
      [lowStockRow],
      [agingRow],
      [inventoryValueRow],
      [transfersPendingRow],
      [repairsInProgressRow],
      [repairsReadyRow],
      [avgTurnaroundRow],
      [diagnosticsTodayRow],
      [messagesPendingRow],
      [newReviewsRow],
      [averageRatingRow],
      [responsesRequiredRow],
    ] = await Promise.all([
      db
        .select({ total: sql`COALESCE(SUM(${loans.principalCents}), 0)` })
        .from(loans)
        .where(inArray(loans.status, openLoanStatuses)),
      db
        .select({ count: sql`COUNT(*)` })
        .from(loans)
        .where(and(gte(loans.createdAt, todayStart), lt(loans.createdAt, tomorrowStart))),
      db
        .select({ count: sql`COUNT(*)` })
        .from(loans)
        .where(and(inArray(loans.status, openLoanStatuses), lt(loans.dueDate, todayStart))),
      db
        .select({ count: sql`COUNT(*)` })
        .from(loanPayments)
        .where(
          and(
            eq(loanPayments.kind, 'renew'),
            gte(loanPayments.createdAt, todayStart),
            lt(loanPayments.createdAt, tomorrowStart),
          ),
        ),
      db
        .select({ count: sql`COUNT(*)` })
        .from(loanPayments)
        .where(
          and(
            eq(loanPayments.kind, 'renew'),
            gte(loanPayments.createdAt, yesterdayStart),
            lt(loanPayments.createdAt, todayStart),
          ),
        ),
      db
        .select({ count: sql`COUNT(*)` })
        .from(layaways)
        .where(and(gte(layaways.createdAt, todayStart), lt(layaways.createdAt, tomorrowStart))),
      db
        .select({
          total: sql`COALESCE(SUM(${layawayPayments.amountCents}), 0)`,
          count: sql`COUNT(*)`,
        })
        .from(layawayPayments)
        .where(
          and(
            gte(layawayPayments.createdAt, todayStart),
            lt(layawayPayments.createdAt, tomorrowStart),
          ),
        ),
      db
        .select({
          total: sql`COALESCE(SUM(ROUND(order_items.qty * order_items.price_cents) - COALESCE(order_items.discount_cents, 0)), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.status, 'completed'),
            gte(orders.createdAt, todayStart),
            lt(orders.createdAt, tomorrowStart),
          ),
        ),
      db
        .select({
          total: sql`COALESCE(SUM(ROUND(order_items.qty * order_items.price_cents) - COALESCE(order_items.discount_cents, 0)), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.status, 'completed'),
            gte(orders.createdAt, yesterdayStart),
            lt(orders.createdAt, todayStart),
          ),
        ),
      db
        .select({ total: sql`COALESCE(SUM(${orderItems.qty}), 0)` })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.status, 'completed'),
            gte(orders.createdAt, todayStart),
            lt(orders.createdAt, tomorrowStart),
          ),
        ),
      db
        .select({ total: sql`COALESCE(SUM(${purchases.totalCostCents}), 0)` })
        .from(purchases)
        .where(and(gte(purchases.createdAt, todayStart), lt(purchases.createdAt, tomorrowStart))),
      db
        .select({ count: sql`COUNT(*)` })
        .from(productCodeVersions)
        .where(and(eq(productCodeVersions.isActive, true), lt(productCodeVersions.qtyOnHand, 3))),
      db
        .select({ count: sql`COUNT(*)` })
        .from(productCodeVersions)
        .where(
          and(
            eq(productCodeVersions.isActive, true),
            gt(productCodeVersions.qtyOnHand, 0),
            lt(productCodeVersions.updatedAt, ninetyDaysAgo),
          ),
        ),
      db
        .select({
          total: sql`COALESCE(SUM(${productCodeVersions.qtyOnHand} * COALESCE(${productCodeVersions.costCents}, ${productCodeVersions.priceCents}, 0)), 0)`,
        })
        .from(productCodeVersions)
        .where(eq(productCodeVersions.isActive, true)),
      db
        .select({ count: sql`COUNT(*)` })
        .from(inventoryTransfers)
        .where(inArray(inventoryTransfers.status, ['approved', 'shipped'])),
      db
        .select({ count: sql`COUNT(*)` })
        .from(repairs)
        .where(inArray(repairs.status, ['diagnosing', 'waiting_approval', 'in_progress', 'qa'])),
      db
        .select({ count: sql`COUNT(*)` })
        .from(repairs)
        .where(eq(repairs.status, 'ready')),
      db
        .select({
          avgHours: sql`COALESCE(AVG(TIMESTAMPDIFF(HOUR, ${repairs.createdAt}, COALESCE(${repairs.updatedAt}, ${repairs.createdAt}))), 0)`,
        })
        .from(repairs)
        .where(and(eq(repairs.status, 'completed'), gte(repairs.updatedAt, thirtyDaysAgo))),
      db
        .select({ count: sql`COUNT(*)` })
        .from(repairs)
        .where(
          and(
            eq(repairs.status, 'diagnosing'),
            gte(repairs.updatedAt, todayStart),
            lt(repairs.updatedAt, tomorrowStart),
          ),
        ),
      db
        .select({ count: sql`COUNT(*)` })
        .from(notificationMessages)
        .where(eq(notificationMessages.status, 'pending')),
      db
        .select({ count: sql`COUNT(*)` })
        .from(reviews)
        .where(gte(reviews.createdAt, sevenDaysAgo)),
      db.select({ avgRating: sql`COALESCE(AVG(${reviews.rating}), 0)` }).from(reviews),
      db
        .select({ count: sql`COUNT(*)` })
        .from(reviews)
        .where(eq(reviews.status, 'new')),
    ]);

    const summary = {
      loans: {
        principalOutCents: Number(principalOutRow?.total ?? 0),
        loansToday: Number(loansTodayRow?.count ?? 0),
        pawnsPastDue: Number(pawnsPastDueRow?.count ?? 0),
        renewalsToday: Number(renewalsTodayRow?.count ?? 0),
        renewalsYesterday: Number(renewalsYesterdayRow?.count ?? 0),
      },
      layaways: {
        newToday: Number(layawaysTodayRow?.count ?? 0),
        paymentsTodayCents: Number(layawayPaymentsRow?.total ?? 0),
        paymentsCount: Number(layawayPaymentsRow?.count ?? 0),
      },
      sales: {
        salesTotalTodayCents: Number(salesTotalTodayRow?.total ?? 0),
        salesTotalYesterdayCents: Number(salesTotalYesterdayRow?.total ?? 0),
        salesQtyToday: Number(salesQtyTodayRow?.total ?? 0),
        purchasesTodayCents: Number(purchasesTodayRow?.total ?? 0),
      },
      inventory: {
        lowStock: Number(lowStockRow?.count ?? 0),
        aging: Number(agingRow?.count ?? 0),
        totalValueCents: Number(inventoryValueRow?.total ?? 0),
        transfersPending: Number(transfersPendingRow?.count ?? 0),
      },
      repairs: {
        inProgress: Number(repairsInProgressRow?.count ?? 0),
        readyForPickup: Number(repairsReadyRow?.count ?? 0),
        avgTurnaroundHours: Number(avgTurnaroundRow?.avgHours ?? 0),
        diagnosticsToday: Number(diagnosticsTodayRow?.count ?? 0),
      },
      marketing: {
        messagesPending: Number(messagesPendingRow?.count ?? 0),
        newReviews: Number(newReviewsRow?.count ?? 0),
        averageRating: Number(averageRatingRow?.avgRating ?? 0),
        responsesRequired: Number(responsesRequiredRow?.count ?? 0),
      },
    };

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/purchases/overview', async (req, res, next) => {
  try {
    const branchCandidate = req.query?.branchId ?? req.query?.branch_id;
    let branchId = null;

    if (branchCandidate !== undefined && branchCandidate !== null && String(branchCandidate).trim() !== '') {
      branchId = parsePositiveInteger(branchCandidate, 'branchId');
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const ninetyDaysAgo = new Date(startOfToday);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);

    const purchaseConditions = [gte(purchases.createdAt, ninetyDaysAgo)];
    if (branchId != null) {
      purchaseConditions.push(eq(purchases.branchId, branchId));
    }

    const purchaseRows = await db
      .select({
        id: purchases.id,
        branchId: purchases.branchId,
        supplierName: purchases.supplierName,
        supplierInvoice: purchases.supplierInvoice,
        referenceNo: purchases.referenceNo,
        receivedAt: purchases.receivedAt,
        createdAt: purchases.createdAt,
        totalCostCents: purchases.totalCostCents,
        totalQuantity: purchases.totalQuantity,
      })
      .from(purchases)
      .where(combineConditions(purchaseConditions))
      .orderBy(desc(purchases.createdAt))
      .limit(500);

    const metrics = {
      today: { totalCostCents: 0, totalQuantity: 0, count: 0 },
      week: { totalCostCents: 0, totalQuantity: 0, count: 0 },
      month: { totalCostCents: 0, totalQuantity: 0, count: 0 },
    };

    const supplierTotals = new Map();

    for (const row of purchaseRows) {
      const recordedAt = row.receivedAt ?? row.createdAt;
      if (!(recordedAt instanceof Date) || Number.isNaN(recordedAt.getTime())) {
        continue;
      }

      const amount = Number(row.totalCostCents ?? 0);
      const quantity = Number(row.totalQuantity ?? 0);

      if (recordedAt >= startOfToday) {
        metrics.today.totalCostCents += amount;
        metrics.today.totalQuantity += quantity;
        metrics.today.count += 1;
      }

      if (recordedAt >= startOfWeek) {
        metrics.week.totalCostCents += amount;
        metrics.week.totalQuantity += quantity;
        metrics.week.count += 1;
      }

      if (recordedAt >= startOfMonth) {
        metrics.month.totalCostCents += amount;
        metrics.month.totalQuantity += quantity;
        metrics.month.count += 1;
      }

      const supplierKey = (row.supplierName ?? '').trim() || 'Sin proveedor';
      const entry = supplierTotals.get(supplierKey) ?? {
        supplierName: supplierKey,
        totalCostCents: 0,
        purchaseCount: 0,
        totalQuantity: 0,
      };
      entry.totalCostCents += amount;
      entry.purchaseCount += 1;
      entry.totalQuantity += quantity;
      supplierTotals.set(supplierKey, entry);
    }

    const topSuppliers = Array.from(supplierTotals.values())
      .sort((a, b) => b.totalCostCents - a.totalCostCents)
      .slice(0, 5)
      .map((entry) => ({
        supplierName: entry.supplierName,
        totalCostCents: entry.totalCostCents,
        purchaseCount: entry.purchaseCount,
        totalQuantity: entry.totalQuantity,
      }));

    const recentPurchases = purchaseRows.slice(0, 5).map((row) => ({
      id: Number(row.id),
      branchId: Number(row.branchId),
      supplierName: row.supplierName ?? null,
      supplierInvoice: row.supplierInvoice ?? null,
      referenceNo: row.referenceNo ?? null,
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      totalCostCents: Number(row.totalCostCents ?? 0),
      totalQuantity: Number(row.totalQuantity ?? 0),
    }));

    const returnConditions = [gte(purchaseReturns.createdAt, ninetyDaysAgo)];
    if (branchId != null) {
      returnConditions.push(eq(purchaseReturns.branchId, branchId));
    }

    const recentReturns = await db
      .select({
        id: purchaseReturns.id,
        purchaseId: purchaseReturns.purchaseId,
        supplierName: purchaseReturns.supplierName,
        totalCostCents: purchaseReturns.totalCostCents,
        totalQuantity: purchaseReturns.totalQuantity,
        createdAt: purchaseReturns.createdAt,
      })
      .from(purchaseReturns)
      .where(combineConditions(returnConditions))
      .orderBy(desc(purchaseReturns.createdAt))
      .limit(5);

    const creditConditions = [];
    if (branchId != null) {
      creditConditions.push(eq(supplierCredits.branchId, branchId));
    }

    let creditsQuery = db
      .select({
        totalOutstandingCents: sql`COALESCE(SUM(${supplierCredits.balanceCents}), 0)`,
        creditCount: sql`COUNT(*)`,
      })
      .from(supplierCredits);

    const creditFilter = combineConditions(creditConditions);
    if (creditFilter) {
      creditsQuery = creditsQuery.where(creditFilter);
    }

    const [creditsRow] = await creditsQuery;

    res.json({
      metrics,
      recentPurchases,
      topSuppliers,
      recentReturns: recentReturns.map((row) => ({
        id: Number(row.id),
        purchaseId: Number(row.purchaseId),
        supplierName: row.supplierName ?? null,
        totalCostCents: Number(row.totalCostCents ?? 0),
        totalQuantity: Number(row.totalQuantity ?? 0),
        createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      })),
      credits: {
        totalOutstandingCents: Number(creditsRow?.totalOutstandingCents ?? 0),
        creditCount: Number(creditsRow?.creditCount ?? 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/purchases/search', async (req, res, next) => {
  try {
    const queryRaw = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    const branchCandidate = req.query?.branchId ?? req.query?.branch_id;
    const limitCandidate = req.query?.limit ?? req.query?.pageSize ?? req.query?.page_size;

    let branchId = null;
    if (branchCandidate !== undefined && branchCandidate !== null && branchCandidate !== '') {
      branchId = parsePositiveInteger(branchCandidate, 'branchId');
    }

    let limit = 8;
    if (limitCandidate !== undefined && limitCandidate !== null && limitCandidate !== '') {
      const numericLimit = Number(limitCandidate);
      if (Number.isInteger(numericLimit) && numericLimit > 0) {
        limit = Math.min(25, Math.max(1, numericLimit));
      }
    }

    const numericQuery = Number(queryRaw);
    const isNumericQuery = Number.isInteger(numericQuery) && numericQuery > 0;

    if (!isNumericQuery && queryRaw.length < 2) {
      throw new HttpError(400, 'q must be at least 2 characters');
    }

    const pattern = `%${queryRaw.replace(/\s+/g, '%')}%`;
    const filters = [];

    if (isNumericQuery) {
      filters.push(eq(purchases.id, numericQuery));
    }

    filters.push(
      or(
        like(purchases.supplierName, pattern),
        like(purchases.supplierInvoice, pattern),
        like(purchases.referenceNo, pattern)
      )
    );

    let condition = filters[0];
    if (filters.length > 1) {
      condition = or(...filters);
    }

    if (branchId != null) {
      condition = and(condition, eq(purchases.branchId, branchId));
    }

    let queryBuilder = db
      .select({
        id: purchases.id,
        branchId: purchases.branchId,
        supplierName: purchases.supplierName,
        supplierInvoice: purchases.supplierInvoice,
        referenceNo: purchases.referenceNo,
        receivedAt: purchases.receivedAt,
        totalCostCents: purchases.totalCostCents,
        totalQuantity: purchases.totalQuantity,
        createdAt: purchases.createdAt,
      })
      .from(purchases);

    if (condition) {
      queryBuilder = queryBuilder.where(condition);
    }

    const rows = await queryBuilder
      .orderBy(desc(purchases.receivedAt), desc(purchases.createdAt))
      .limit(limit);

    const items = rows.map((row) => ({
      id: Number(row.id),
      branchId: Number(row.branchId),
      supplierName: row.supplierName ?? null,
      supplierInvoice: row.supplierInvoice ?? null,
      referenceNo: row.referenceNo ?? null,
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      totalCostCents: Number(row.totalCostCents ?? 0),
      totalQuantity: Number(row.totalQuantity ?? 0),
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    }));

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/purchases/:id', async (req, res, next) => {
  try {
    const purchaseId = parsePositiveInteger(req.params.id, 'id');

    const [purchaseRow] = await db
      .select(purchaseSelection)
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchaseRow) {
      throw new HttpError(404, 'Purchase not found');
    }

    const lineRows = await db
      .select({
        id: purchaseLines.id,
        productCodeVersionId: purchaseLines.productCodeVersionId,
        quantity: purchaseLines.quantity,
        unitCostCents: purchaseLines.unitCostCents,
        lineTotalCents: purchaseLines.lineTotalCents,
        labelQuantity: purchaseLines.labelQuantity,
        note: purchaseLines.notes,
        code: productCodes.code,
        name: productCodes.name,
        sku: productCodes.sku,
        branchId: productCodeVersions.branchId,
        branchName: branches.name,
        qtyOnHand: productCodeVersions.qtyOnHand,
        returnedQuantity: sql`COALESCE(SUM(${purchaseReturnLines.quantity}), 0)`,
      })
      .from(purchaseLines)
      .innerJoin(
        productCodeVersions,
        eq(purchaseLines.productCodeVersionId, productCodeVersions.id)
      )
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .leftJoin(branches, eq(productCodeVersions.branchId, branches.id))
      .leftJoin(
        purchaseReturnLines,
        eq(purchaseReturnLines.purchaseLineId, purchaseLines.id)
      )
      .where(eq(purchaseLines.purchaseId, purchaseId))
      .groupBy(
        purchaseLines.id,
        purchaseLines.productCodeVersionId,
        purchaseLines.quantity,
        purchaseLines.unitCostCents,
        purchaseLines.lineTotalCents,
        purchaseLines.labelQuantity,
        purchaseLines.notes,
        productCodeVersions.id,
        productCodeVersions.branchId,
        productCodeVersions.qtyOnHand,
        productCodes.id,
        productCodes.code,
        productCodes.name,
        productCodes.sku,
        branches.id,
        branches.name
      )
      .orderBy(asc(purchaseLines.id));

    const lines = lineRows.map((row) => {
      const quantity = Number(row.quantity ?? 0);
      const returnedQuantity = Number(row.returnedQuantity ?? 0);
      const availableQuantity = Math.max(0, quantity - returnedQuantity);

      return {
        id: Number(row.id),
        productCodeVersionId: Number(row.productCodeVersionId),
        code: row.code ?? null,
        name: row.name ?? null,
        sku: row.sku ?? null,
        quantity,
        unitCostCents: Number(row.unitCostCents ?? 0),
        lineTotalCents: Number(row.lineTotalCents ?? 0),
        labelQuantity: Number(row.labelQuantity ?? 0),
        note: row.note ?? null,
        branchId: Number(row.branchId ?? purchaseRow.branchId),
        branchName: row.branchName ?? null,
        qtyOnHand: Number(row.qtyOnHand ?? 0),
        returnedQuantity,
        availableQuantity,
      };
    });

    res.json({
      purchase: {
        id: Number(purchaseRow.id),
        branchId: Number(purchaseRow.branchId),
        supplierName: purchaseRow.supplierName ?? null,
        supplierInvoice: purchaseRow.supplierInvoice ?? null,
        referenceNo: purchaseRow.referenceNo ?? null,
        receivedAt: purchaseRow.receivedAt ? purchaseRow.receivedAt.toISOString() : null,
        createdBy: purchaseRow.createdBy ?? null,
        totalCostCents: Number(purchaseRow.totalCostCents ?? 0),
        totalQuantity: Number(purchaseRow.totalQuantity ?? 0),
        notes: purchaseRow.notes ?? null,
        createdAt: purchaseRow.createdAt ? purchaseRow.createdAt.toISOString() : null,
        updatedAt: purchaseRow.updatedAt ? purchaseRow.updatedAt.toISOString() : null,
      },
      lines,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/purchases', async (req, res, next) => {
  try {
    const branchId = parsePositiveInteger(req.body?.branchId ?? req.body?.branch_id, 'branchId');
    const createdByCandidate = req.body?.createdBy ?? req.body?.created_by ?? null;
    const createdById =
      createdByCandidate === null || createdByCandidate === undefined || createdByCandidate === ''
        ? null
        : parsePositiveInteger(createdByCandidate, 'createdBy');

    const supplierNameRaw = typeof req.body?.supplierName === 'string' ? req.body.supplierName.trim() : '';
    const supplierName = supplierNameRaw ? supplierNameRaw.slice(0, 160) : null;
    const supplierInvoiceRaw =
      typeof req.body?.supplierInvoice === 'string' ? req.body.supplierInvoice.trim() : '';
    const supplierInvoice = supplierInvoiceRaw ? supplierInvoiceRaw.slice(0, 80) : null;
    const referenceRaw = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
    const referenceNo = referenceRaw ? referenceRaw.slice(0, 80) : null;
    const receivedAt = parseReceivedAt(req.body?.receivedAt ?? req.body?.received_at);
    const notes = normalizeReasonInput(req.body?.notes ?? req.body?.note);

    const layout = resolveLabelLayout(req.body?.layout ?? req.body?.labelLayout);
    const includePrice =
      req.body?.includePrice === undefined ? true : Boolean(req.body.includePrice);
    const labelNote = normalizeLabelNote(req.body?.labelNote ?? req.body?.label_note);

    const { normalizedLines, totalQuantity, totalCostCents, totalLabels } = normalizePurchaseLines(
      req.body?.lines ?? req.body?.items
    );

    if (totalLabels > maxLabelsPerRequest) {
      throw new HttpError(400, `Too many labels requested (max ${maxLabelsPerRequest})`);
    }

    const [branchRow] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    if (!branchRow) {
      throw new HttpError(404, 'Branch not found');
    }

    const versionIds = Array.from(new Set(normalizedLines.map((line) => line.productCodeVersionId)));

    const versionRows = await db
      .select({
        productCodeVersionId: productCodeVersions.id,
        productCodeId: productCodes.id,
        code: productCodes.code,
        name: productCodes.name,
        sku: productCodes.sku,
        branchId: productCodeVersions.branchId,
        branchName: branches.name,
        qtyOnHand: productCodeVersions.qtyOnHand,
        costCents: productCodeVersions.costCents,
        priceCents: productCodeVersions.priceCents,
      })
      .from(productCodeVersions)
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .leftJoin(branches, eq(productCodeVersions.branchId, branches.id))
      .where(inArray(productCodeVersions.id, versionIds));

    if (versionRows.length !== versionIds.length) {
      const foundIds = new Set(versionRows.map((row) => Number(row.productCodeVersionId)));
      const missing = versionIds.filter((id) => !foundIds.has(id));
      throw new HttpError(
        404,
        `Unable to locate product code versions: ${missing.join(', ')}`
      );
    }

    const versionState = new Map();
    const versionMetadata = new Map();

    for (const row of versionRows) {
      if (Number(row.branchId) !== Number(branchId)) {
        throw new HttpError(400, 'All products must belong to the selected branch');
      }

      versionState.set(Number(row.productCodeVersionId), {
        qtyOnHand: Number(row.qtyOnHand ?? 0),
        costCents: row.costCents == null ? null : Number(row.costCents),
      });

      versionMetadata.set(Number(row.productCodeVersionId), {
        productCodeVersionId: Number(row.productCodeVersionId),
        productCodeId: Number(row.productCodeId),
        code: row.code,
        name: row.name,
        sku: row.sku ?? null,
        branchId: Number(row.branchId),
        branchName: row.branchName ?? null,
        priceCents: row.priceCents == null ? null : Number(row.priceCents),
      });
    }

    const lineInserts = [];
    const ledgerEntries = [];

    const createdPurchase = await db.transaction(async (tx) => {
      await tx.insert(purchases).values({
        branchId,
        supplierName,
        supplierInvoice,
        referenceNo,
        receivedAt,
        createdBy: createdById,
        totalCostCents,
        totalQuantity,
        labelLayout: layout.id,
        labelIncludePrice: includePrice,
        labelCount: totalLabels,
        labelNote,
        notes,
      });

      const [purchaseRow] = await tx
        .select(purchaseSelection)
        .from(purchases)
        .orderBy(desc(purchases.id))
        .limit(1);

      if (!purchaseRow) {
        throw new Error('FAILED_TO_CREATE_PURCHASE');
      }

      for (const line of normalizedLines) {
        const state = versionState.get(line.productCodeVersionId);
        if (!state) {
          throw new HttpError(404, `Product version ${line.productCodeVersionId} not found`);
        }

        const priorQty = Number(state.qtyOnHand ?? 0);
        const priorCost = state.costCents == null ? null : Number(state.costCents);
        const newQty = priorQty + line.quantity;
        let newCostCents = line.unitCostCents;

        if (priorCost != null && priorQty > 0) {
          newCostCents = Math.round(
            (priorQty * priorCost + line.quantity * line.unitCostCents) / newQty
          );
        }

        state.qtyOnHand = newQty;
        state.costCents = newCostCents;

        await tx
          .update(productCodeVersions)
          .set({
            qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${line.quantity}`,
            costCents: newCostCents,
          })
          .where(eq(productCodeVersions.id, line.productCodeVersionId));

        lineInserts.push({
          purchaseId: purchaseRow.id,
          productCodeVersionId: line.productCodeVersionId,
          quantity: line.quantity,
          unitCostCents: line.unitCostCents,
          lineTotalCents: line.lineTotalCents,
          labelQuantity: line.labelQuantity,
          notes: line.note,
        });

        ledgerEntries.push({
          productCodeVersionId: line.productCodeVersionId,
          reason: 'purchase',
          qtyChange: line.quantity,
          referenceId: purchaseRow.id,
          referenceType: 'purchase',
          notes: supplierName ? `Compra ${supplierName}` : 'Purchase receipt',
        });
      }

      if (lineInserts.length > 0) {
        await tx.insert(purchaseLines).values(lineInserts);
      }

      if (ledgerEntries.length > 0) {
        await tx.insert(stockLedger).values(ledgerEntries);
      }

      return purchaseRow;
    });

    const lineSummaries = normalizedLines.map((line) => {
      const meta = versionMetadata.get(line.productCodeVersionId);
      return {
        productCodeVersionId: line.productCodeVersionId,
        productCodeId: meta?.productCodeId ?? null,
        code: meta?.code ?? null,
        name: meta?.name ?? null,
        sku: meta?.sku ?? null,
        branchId: meta?.branchId ?? null,
        branchName: meta?.branchName ?? null,
        quantity: line.quantity,
        unitCostCents: line.unitCostCents,
        lineTotalCents: line.lineTotalCents,
        labelQuantity: line.labelQuantity,
      };
    });

    const purchasePayload = {
      id: createdPurchase.id,
      branchId: createdPurchase.branchId,
      supplierName: createdPurchase.supplierName ?? null,
      supplierInvoice: createdPurchase.supplierInvoice ?? null,
      referenceNo: createdPurchase.referenceNo ?? null,
      receivedAt: createdPurchase.receivedAt ? createdPurchase.receivedAt.toISOString() : null,
      createdBy: createdPurchase.createdBy ?? null,
      totalCostCents: createdPurchase.totalCostCents ?? totalCostCents,
      totalQuantity: createdPurchase.totalQuantity ?? totalQuantity,
      labelLayout: createdPurchase.labelLayout ?? layout.id,
      labelIncludePrice: Boolean(createdPurchase.labelIncludePrice ?? includePrice),
      labelCount: createdPurchase.labelCount ?? totalLabels,
      labelNote: createdPurchase.labelNote ?? labelNote,
      notes: createdPurchase.notes ?? notes,
      createdAt: createdPurchase.createdAt ? createdPurchase.createdAt.toISOString() : null,
      updatedAt: createdPurchase.updatedAt ? createdPurchase.updatedAt.toISOString() : null,
    };

    const baseLabels = [];
    if (totalLabels > 0) {
      for (const line of normalizedLines) {
        if (line.labelQuantity <= 0) {
          continue;
        }

        const meta = versionMetadata.get(line.productCodeVersionId);
        if (!meta) {
          continue;
        }

        const priceCents =
          includePrice && meta.priceCents != null ? Number(meta.priceCents) : null;

        for (let i = 0; i < line.labelQuantity; i += 1) {
          baseLabels.push({
            productCodeVersionId: line.productCodeVersionId,
            productCodeId: meta.productCodeId,
            code: meta.code,
            name: meta.name,
            sku: meta.sku,
            branchId: meta.branchId,
            branchName: meta.branchName,
            priceCents,
            qrPayload: `POS|INV|${meta.code}|${line.productCodeVersionId}`,
            note: labelNote,
          });
        }
      }
    }

    let labelPayload = {
      generatedAt: new Date().toISOString(),
      layout: serializeLabelLayout(layout),
      totalLabels: 0,
      labels: [],
      pages: buildLabelPages([], layout),
      availableLayouts: availableLabelLayouts,
    };

    if (baseLabels.length > 0) {
      const positionedLabels = positionLabelsForLayout(baseLabels, layout);
      const pages = buildLabelPages(positionedLabels, layout);
      labelPayload = {
        generatedAt: new Date().toISOString(),
        layout: serializeLabelLayout(layout),
        totalLabels: positionedLabels.length,
        labels: positionedLabels,
        pages,
        availableLayouts: availableLabelLayouts,
      };
    }

    res.status(201).json({
      purchase: purchasePayload,
      lines: lineSummaries,
      totals: {
        totalQuantity,
        totalCostCents,
      },
      labels: labelPayload,
      metadata: {
        availableLayouts: availableLabelLayouts,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_PURCHASE') {
      return res.status(500).json({ error: 'Unable to record purchase' });
    }

    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/purchase-returns', async (req, res, next) => {
  try {
    const purchaseId = parsePositiveInteger(
      req.body?.purchaseId ?? req.body?.purchase_id,
      'purchaseId'
    );
    const createdByCandidate = req.body?.createdBy ?? req.body?.created_by;
    const reason = normalizeReasonInput(req.body?.reason);
    const notes = normalizeReasonInput(req.body?.notes ?? req.body?.note);

    let createdById = null;
    if (createdByCandidate !== undefined && createdByCandidate !== null && createdByCandidate !== '') {
      createdById = parsePositiveInteger(createdByCandidate, 'createdBy');
    }

    const [purchaseRow] = await db
      .select(purchaseSelection)
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!purchaseRow) {
      throw new HttpError(404, 'Purchase not found');
    }

    const purchaseLineRows = await db
      .select({
        id: purchaseLines.id,
        productCodeVersionId: purchaseLines.productCodeVersionId,
        quantity: purchaseLines.quantity,
        unitCostCents: purchaseLines.unitCostCents,
        lineTotalCents: purchaseLines.lineTotalCents,
        code: productCodes.code,
        name: productCodes.name,
        sku: productCodes.sku,
        branchId: productCodeVersions.branchId,
        branchName: branches.name,
        returnedQuantity: sql`COALESCE(SUM(${purchaseReturnLines.quantity}), 0)`,
      })
      .from(purchaseLines)
      .innerJoin(
        productCodeVersions,
        eq(purchaseLines.productCodeVersionId, productCodeVersions.id)
      )
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .leftJoin(branches, eq(productCodeVersions.branchId, branches.id))
      .leftJoin(
        purchaseReturnLines,
        eq(purchaseReturnLines.purchaseLineId, purchaseLines.id)
      )
      .where(eq(purchaseLines.purchaseId, purchaseId))
      .groupBy(
        purchaseLines.id,
        purchaseLines.productCodeVersionId,
        purchaseLines.quantity,
        purchaseLines.unitCostCents,
        purchaseLines.lineTotalCents,
        productCodeVersions.id,
        productCodeVersions.branchId,
        productCodes.id,
        productCodes.code,
        productCodes.name,
        productCodes.sku,
        branches.id,
        branches.name
      )
      .orderBy(asc(purchaseLines.id));

    if (purchaseLineRows.length === 0) {
      throw new HttpError(400, 'Purchase has no lines to return');
    }

    const purchaseLineMap = new Map();

    for (const row of purchaseLineRows) {
      const lineId = Number(row.id);
      const quantity = Number(row.quantity ?? 0);
      const returnedQuantity = Number(row.returnedQuantity ?? 0);
      const availableQuantity = Math.max(0, quantity - returnedQuantity);

      if (Number(row.branchId ?? purchaseRow.branchId) !== Number(purchaseRow.branchId)) {
        throw new HttpError(400, 'Purchase line belongs to a different branch');
      }

      purchaseLineMap.set(lineId, {
        purchaseLineId: lineId,
        productCodeVersionId: Number(row.productCodeVersionId),
        unitCostCents: Number(row.unitCostCents ?? 0),
        lineTotalCents: Number(row.lineTotalCents ?? 0),
        availableQuantity,
        code: row.code ?? null,
        name: row.name ?? null,
        sku: row.sku ?? null,
      });
    }

    const { normalizedLines, totalQuantity, totalCostCents } = normalizePurchaseReturnLines(
      req.body?.lines ?? req.body?.items,
      purchaseLineMap
    );

    if (totalQuantity <= 0 || totalCostCents <= 0) {
      throw new HttpError(400, 'Return totals must be greater than zero');
    }

    const created = await db.transaction(async (tx) => {
      await tx.insert(purchaseReturns).values({
        purchaseId,
        branchId: Number(purchaseRow.branchId),
        supplierName: purchaseRow.supplierName ?? null,
        supplierInvoice: purchaseRow.supplierInvoice ?? null,
        reason,
        notes,
        createdBy: createdById,
        totalQuantity,
        totalCostCents,
      });

      const [returnRow] = await tx
        .select(purchaseReturnSelection)
        .from(purchaseReturns)
        .orderBy(desc(purchaseReturns.id))
        .limit(1);

      if (!returnRow) {
        throw new HttpError(500, 'FAILED_TO_CREATE_PURCHASE_RETURN');
      }

      const now = new Date();
      const lineInserts = [];
      const ledgerEntries = [];
      const versionState = new Map();

      for (const line of normalizedLines) {
        if (!versionState.has(line.productCodeVersionId)) {
          const [stateRow] = await tx
            .select({ qtyOnHand: productCodeVersions.qtyOnHand })
            .from(productCodeVersions)
            .where(eq(productCodeVersions.id, line.productCodeVersionId))
            .limit(1);

          if (!stateRow) {
            throw new HttpError(404, `Product code version ${line.productCodeVersionId} not found`);
          }

          versionState.set(line.productCodeVersionId, Number(stateRow.qtyOnHand ?? 0));
        }

        const remaining = versionState.get(line.productCodeVersionId);
        if (remaining < line.quantity) {
          throw new HttpError(409, 'Insufficient quantity on hand to return selected items');
        }

        versionState.set(line.productCodeVersionId, remaining - line.quantity);

        await tx
          .update(productCodeVersions)
          .set({
            qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${line.quantity}`,
            updatedAt: now,
          })
          .where(eq(productCodeVersions.id, line.productCodeVersionId));

        lineInserts.push({
          purchaseReturnId: Number(returnRow.id),
          purchaseLineId: line.purchaseLineId,
          productCodeVersionId: line.productCodeVersionId,
          quantity: line.quantity,
          unitCostCents: line.unitCostCents,
          lineTotalCents: line.lineTotalCents,
          note: line.note,
        });

        const meta = purchaseLineMap.get(line.purchaseLineId);
        ledgerEntries.push({
          productCodeVersionId: line.productCodeVersionId,
          qtyChange: -line.quantity,
          reason: 'return',
          referenceType: 'purchase_return',
          referenceId: Number(returnRow.id),
          notes:
            reason ??
            (meta?.code ? `Devolución ${meta.code}` : 'Supplier return'),
        });
      }

      if (lineInserts.length > 0) {
        await tx.insert(purchaseReturnLines).values(lineInserts);
      }

      if (ledgerEntries.length > 0) {
        await tx.insert(stockLedger).values(ledgerEntries);
      }

      await tx.insert(supplierCredits).values({
        branchId: Number(purchaseRow.branchId),
        supplierName: purchaseRow.supplierName ?? null,
        supplierInvoice: purchaseRow.supplierInvoice ?? null,
        purchaseId,
        purchaseReturnId: Number(returnRow.id),
        amountCents: totalCostCents,
        balanceCents: totalCostCents,
        reason,
        notes,
      });

      const [creditRow] = await tx
        .select(supplierCreditSelection)
        .from(supplierCredits)
        .orderBy(desc(supplierCredits.id))
        .limit(1);

      if (!creditRow) {
        throw new HttpError(500, 'FAILED_TO_CREATE_SUPPLIER_CREDIT');
      }

      await tx.insert(supplierCreditLedger).values({
        supplierCreditId: Number(creditRow.id),
        deltaCents: totalCostCents,
        referenceType: 'purchase_return',
        referenceId: Number(returnRow.id),
        reason: reason ?? 'Supplier return credit',
      });

      return { returnRow, creditRow };
    });

    const [returnRow] = await db
      .select(purchaseReturnSelection)
      .from(purchaseReturns)
      .where(eq(purchaseReturns.id, created.returnRow.id))
      .limit(1);

    const returnLines = await db
      .select({
        id: purchaseReturnLines.id,
        purchaseLineId: purchaseReturnLines.purchaseLineId,
        productCodeVersionId: purchaseReturnLines.productCodeVersionId,
        quantity: purchaseReturnLines.quantity,
        unitCostCents: purchaseReturnLines.unitCostCents,
        lineTotalCents: purchaseReturnLines.lineTotalCents,
        note: purchaseReturnLines.note,
        code: productCodes.code,
        name: productCodes.name,
        sku: productCodes.sku,
      })
      .from(purchaseReturnLines)
      .innerJoin(
        productCodeVersions,
        eq(purchaseReturnLines.productCodeVersionId, productCodeVersions.id)
      )
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .where(eq(purchaseReturnLines.purchaseReturnId, created.returnRow.id))
      .orderBy(asc(purchaseReturnLines.id));

    const creditRow = created.creditRow;

    res.status(201).json({
      purchaseReturn: {
        id: Number(returnRow?.id ?? created.returnRow.id),
        purchaseId: Number(returnRow?.purchaseId ?? purchaseId),
        branchId: Number(returnRow?.branchId ?? purchaseRow.branchId),
        supplierName: returnRow?.supplierName ?? purchaseRow.supplierName ?? null,
        supplierInvoice: returnRow?.supplierInvoice ?? purchaseRow.supplierInvoice ?? null,
        reason: returnRow?.reason ?? reason ?? null,
        notes: returnRow?.notes ?? notes ?? null,
        createdBy: returnRow?.createdBy ?? createdById,
        totalQuantity: Number(returnRow?.totalQuantity ?? totalQuantity),
        totalCostCents: Number(returnRow?.totalCostCents ?? totalCostCents),
        createdAt: returnRow?.createdAt ? returnRow.createdAt.toISOString() : null,
        updatedAt: returnRow?.updatedAt ? returnRow.updatedAt.toISOString() : null,
      },
      lines: returnLines.map((line) => ({
        id: Number(line.id),
        purchaseLineId: Number(line.purchaseLineId),
        productCodeVersionId: Number(line.productCodeVersionId),
        code: line.code ?? null,
        name: line.name ?? null,
        sku: line.sku ?? null,
        quantity: Number(line.quantity ?? 0),
        unitCostCents: Number(line.unitCostCents ?? 0),
        lineTotalCents: Number(line.lineTotalCents ?? 0),
        note: line.note ?? null,
      })),
      totals: {
        totalQuantity,
        totalCostCents,
      },
      supplierCredit: {
        id: Number(creditRow.id),
        branchId: Number(creditRow.branchId),
        supplierName: creditRow.supplierName ?? null,
        supplierInvoice: creditRow.supplierInvoice ?? null,
        purchaseId: creditRow.purchaseId ? Number(creditRow.purchaseId) : null,
        purchaseReturnId: creditRow.purchaseReturnId
          ? Number(creditRow.purchaseReturnId)
          : null,
        amountCents: Number(creditRow.amountCents ?? totalCostCents),
        balanceCents: Number(creditRow.balanceCents ?? totalCostCents),
        reason: creditRow.reason ?? reason ?? null,
        notes: creditRow.notes ?? notes ?? null,
        createdAt: creditRow.createdAt ? creditRow.createdAt.toISOString() : null,
        updatedAt: creditRow.updatedAt ? creditRow.updatedAt.toISOString() : null,
      },
      remaining: Array.from(purchaseLineMap.values()).map((line) => ({
        purchaseLineId: line.purchaseLineId,
        availableQuantity: line.availableQuantity,
      })),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/inventory/split', async (req, res, next) => {
  try {
    const parentVersionId = Number(req.body?.parentVersionId ?? req.body?.versionId);
    const requestedQty = Number(req.body?.quantity ?? req.body?.parentQty ?? req.body?.qty);

    if (!Number.isInteger(parentVersionId) || parentVersionId <= 0) {
      throw new HttpError(400, 'parentVersionId must be a positive integer');
    }

    if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
      throw new HttpError(400, 'quantity must be a positive integer');
    }

    const components = normalizeComponentLines(req.body?.components);

    const [parent] = await db
      .select({
        id: productCodeVersions.id,
        productCodeId: productCodeVersions.productCodeId,
        branchId: productCodeVersions.branchId,
        qtyOnHand: productCodeVersions.qtyOnHand,
        costCents: productCodeVersions.costCents,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(productCodeVersions)
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .where(eq(productCodeVersions.id, parentVersionId));

    if (!parent) {
      throw new HttpError(404, 'Parent product version not found');
    }

    const childVersionIds = components.map((entry) => entry.versionId);
    const childRows = await db
      .select({
        id: productCodeVersions.id,
        productCodeId: productCodeVersions.productCodeId,
        branchId: productCodeVersions.branchId,
        qtyOnHand: productCodeVersions.qtyOnHand,
        costCents: productCodeVersions.costCents,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(productCodeVersions)
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .where(inArray(productCodeVersions.id, childVersionIds));

    if (childRows.length !== components.length) {
      const foundIds = new Set(childRows.map((row) => Number(row.id)));
      const missing = childVersionIds.filter((id) => !foundIds.has(id));
      throw new HttpError(404, `Unable to locate component versions: ${missing.join(', ')}`);
    }

    const childMap = new Map(childRows.map((row) => [Number(row.id), row]));

    for (const entry of components) {
      const child = childMap.get(entry.versionId);
      if (!child) {
        throw new HttpError(404, `Component version ${entry.versionId} not found`);
      }

      if (Number(child.branchId) !== Number(parent.branchId)) {
        throw new HttpError(400, 'All components must belong to the same branch as the parent');
      }
    }

    const parentCost = parent.costCents == null ? null : Number(parent.costCents);
    let costMismatch = false;

    if (parentCost != null) {
      let childCostSum = 0;
      let canValidate = true;

      for (const entry of components) {
        const child = childMap.get(entry.versionId);
        if (!child || child.costCents == null) {
          canValidate = false;
          break;
        }

        childCostSum += Number(child.costCents) * entry.qtyPerParent;
      }

      if (canValidate) {
        const allowedDelta = Math.max(1, components.length);
        costMismatch = Math.abs(parentCost - childCostSum) > allowedDelta;
      }
    }

    if (costMismatch) {
      throw new HttpError(400, 'Component costs must add up to the parent cost (within rounding rules)');
    }

    await db.transaction(async (tx) => {
      const [latestParent] = await tx
        .select({ qtyOnHand: productCodeVersions.qtyOnHand })
        .from(productCodeVersions)
        .where(eq(productCodeVersions.id, parentVersionId));

      const availableParentQty = Number(latestParent?.qtyOnHand ?? parent.qtyOnHand ?? 0);
      if (availableParentQty < requestedQty) {
        throw new HttpError(409, 'Insufficient parent quantity to split');
      }

      const now = new Date();

      await tx
        .update(productCodeVersions)
        .set({
          qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${requestedQty}`,
          updatedAt: now,
        })
        .where(eq(productCodeVersions.id, parentVersionId));

      const ledgerEntries = [
        {
          productCodeVersionId: parentVersionId,
          qtyChange: -requestedQty,
          reason: 'split_out',
          referenceType: 'inventory_split',
          referenceId: parentVersionId,
          notes: `Split into ${components.length} component(s)`,
        },
      ];

      for (const entry of components) {
        const child = childMap.get(entry.versionId);
        const qtyIncrease = entry.qtyPerParent * requestedQty;

        await tx
          .update(productCodeVersions)
          .set({
            qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${qtyIncrease}`,
            updatedAt: now,
          })
          .where(eq(productCodeVersions.id, entry.versionId));

        await tx
          .insert(productCodeComponents)
          .values({
            parentCodeId: Number(parent.productCodeId),
            childCodeId: Number(child.productCodeId),
            qtyRatio: entry.qtyPerParent,
          })
          .onDuplicateKeyUpdate({
            set: {
              qtyRatio: entry.qtyPerParent,
              updatedAt: now,
            },
          });

        ledgerEntries.push({
          productCodeVersionId: entry.versionId,
          qtyChange: qtyIncrease,
          reason: 'split_in',
          referenceType: 'inventory_split',
          referenceId: parentVersionId,
          notes: `From ${parent.code}`,
        });
      }

      await tx.insert(stockLedger).values(ledgerEntries);
    });

    const snapshot = await getInventoryComponentSnapshot();
    res.json({
      message: 'Split completed successfully',
      components: snapshot.components,
      versions: snapshot.versions,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/inventory/combine', async (req, res, next) => {
  try {
    const parentVersionId = Number(req.body?.parentVersionId ?? req.body?.versionId);
    const requestedQty = Number(req.body?.quantity ?? req.body?.outputQty ?? req.body?.qty);

    if (!Number.isInteger(parentVersionId) || parentVersionId <= 0) {
      throw new HttpError(400, 'parentVersionId must be a positive integer');
    }

    if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
      throw new HttpError(400, 'quantity must be a positive integer');
    }

    const components = normalizeComponentLines(req.body?.components);

    const [parent] = await db
      .select({
        id: productCodeVersions.id,
        productCodeId: productCodeVersions.productCodeId,
        branchId: productCodeVersions.branchId,
        qtyOnHand: productCodeVersions.qtyOnHand,
        costCents: productCodeVersions.costCents,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(productCodeVersions)
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .where(eq(productCodeVersions.id, parentVersionId));

    if (!parent) {
      throw new HttpError(404, 'Parent product version not found');
    }

    const childVersionIds = components.map((entry) => entry.versionId);
    const childRows = await db
      .select({
        id: productCodeVersions.id,
        productCodeId: productCodeVersions.productCodeId,
        branchId: productCodeVersions.branchId,
        qtyOnHand: productCodeVersions.qtyOnHand,
        costCents: productCodeVersions.costCents,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(productCodeVersions)
      .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
      .where(inArray(productCodeVersions.id, childVersionIds));

    if (childRows.length !== components.length) {
      const foundIds = new Set(childRows.map((row) => Number(row.id)));
      const missing = childVersionIds.filter((id) => !foundIds.has(id));
      throw new HttpError(404, `Unable to locate component versions: ${missing.join(', ')}`);
    }

    const childMap = new Map(childRows.map((row) => [Number(row.id), row]));

    for (const entry of components) {
      const child = childMap.get(entry.versionId);
      if (!child) {
        throw new HttpError(404, `Component version ${entry.versionId} not found`);
      }

      if (Number(child.branchId) !== Number(parent.branchId)) {
        throw new HttpError(400, 'All components must belong to the same branch as the parent');
      }

      const availableChildQty = Number(child.qtyOnHand ?? 0);
      const requiredQty = entry.qtyPerParent * requestedQty;
      if (availableChildQty < requiredQty) {
        throw new HttpError(409, `Insufficient quantity for component ${child.code}`);
      }
    }

    let targetParentCost = parent.costCents == null ? null : Number(parent.costCents);
    let costMismatch = false;

    let childCostSum = 0;
    let canValidateCost = true;

    for (const entry of components) {
      const child = childMap.get(entry.versionId);
      if (!child || child.costCents == null) {
        canValidateCost = false;
        break;
      }

      childCostSum += Number(child.costCents) * entry.qtyPerParent;
    }

    if (canValidateCost) {
      if (targetParentCost == null) {
        targetParentCost = Math.round(childCostSum);
      } else {
        const allowedDelta = Math.max(1, components.length);
        costMismatch = Math.abs(targetParentCost - childCostSum) > allowedDelta;
      }
    }

    if (costMismatch) {
      throw new HttpError(400, 'Component costs must add up to the parent cost (within rounding rules)');
    }

    await db.transaction(async (tx) => {
      const now = new Date();

      const ledgerEntries = [];

      for (const entry of components) {
        const child = childMap.get(entry.versionId);
        const qtyDecrease = entry.qtyPerParent * requestedQty;

        await tx
          .update(productCodeVersions)
          .set({
            qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${qtyDecrease}`,
            updatedAt: now,
          })
          .where(eq(productCodeVersions.id, entry.versionId));

        await tx
          .insert(productCodeComponents)
          .values({
            parentCodeId: Number(parent.productCodeId),
            childCodeId: Number(child.productCodeId),
            qtyRatio: entry.qtyPerParent,
          })
          .onDuplicateKeyUpdate({
            set: {
              qtyRatio: entry.qtyPerParent,
              updatedAt: now,
            },
          });

        ledgerEntries.push({
          productCodeVersionId: entry.versionId,
          qtyChange: -qtyDecrease,
          reason: 'combine_out',
          referenceType: 'inventory_combine',
          referenceId: parentVersionId,
          notes: `Combined into ${parent.code}`,
        });
      }

      const parentUpdate = {
        qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${requestedQty}`,
        updatedAt: now,
      };

      if (targetParentCost != null) {
        parentUpdate.costCents = Math.round(targetParentCost);
      }

      await tx
        .update(productCodeVersions)
        .set(parentUpdate)
        .where(eq(productCodeVersions.id, parentVersionId));

      ledgerEntries.push({
        productCodeVersionId: parentVersionId,
        qtyChange: requestedQty,
        reason: 'combine_in',
        referenceType: 'inventory_combine',
        referenceId: parentVersionId,
        notes: `Combined from ${components.length} component(s)`,
      });

      await tx.insert(stockLedger).values(ledgerEntries);
    });

    const snapshot = await getInventoryComponentSnapshot();
    res.json({
      message: 'Combine completed successfully',
      components: snapshot.components,
      versions: snapshot.versions,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

function isMissingProductCategoriesTableError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const cause = error.cause && typeof error.cause === 'object' ? error.cause : null;
  const candidateMessages = [
    typeof error.message === 'string' ? error.message : '',
    cause && typeof cause.message === 'string' ? cause.message : '',
    cause && typeof cause.sqlMessage === 'string' ? cause.sqlMessage : '',
  ];

  if (cause && (cause.code === 'ER_NO_SUCH_TABLE' || cause.errno === 1146)) {
    if (candidateMessages.some((msg) => msg && msg.includes('product_categories'))) {
      return true;
    }
  }

  return candidateMessages.some((msg) => msg && msg.includes('product_categories'));
}

async function runInventoryQuery(rawFilters = {}, attemptOptions = {}) {
  const search = typeof rawFilters.search === 'string' ? rawFilters.search.trim() : '';
  const branchIds = coerceIdArray(rawFilters.branchIds ?? rawFilters.branchId ?? []);
  const categoryIds = coerceIdArray(rawFilters.categoryIds ?? rawFilters.categoryId ?? []);
  const productCodeIds = coerceIdArray(rawFilters.productCodeIds ?? rawFilters.productCodeId ?? []);
  const productCodeVersionIds = coerceIdArray(rawFilters.productCodeVersionIds ?? rawFilters.versionIds ?? []);
  const statusCandidate = typeof rawFilters.status === 'string' ? rawFilters.status.toLowerCase() : 'all';
  const availabilityCandidate = typeof rawFilters.availability === 'string' ? rawFilters.availability.toLowerCase() : 'all';
  const status = ['active', 'inactive'].includes(statusCandidate) ? statusCandidate : 'all';
  const availability = ['in_stock', 'out_of_stock', 'reserved', 'low_stock'].includes(availabilityCandidate)
    ? availabilityCandidate
    : 'all';
  const requestedLowStockThreshold = Number(rawFilters.lowStockThreshold);
  const lowStockThreshold = Number.isFinite(requestedLowStockThreshold) && requestedLowStockThreshold > 0
    ? Math.round(requestedLowStockThreshold)
    : 3;
  const requestedPage = Number(rawFilters.page);
  const requestedPageSize = Number(rawFilters.pageSize);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, maxInventoryPageSize)
    : defaultInventoryPageSize;
  const offset = (page - 1) * pageSize;
  const limitPlusOne = Math.min(pageSize + 1, maxInventoryPageSize + 1);

  let sortFieldCandidate = null;
  if (typeof rawFilters.sortField === 'string') {
    sortFieldCandidate = rawFilters.sortField;
  } else if (rawFilters.sort && typeof rawFilters.sort === 'object' && typeof rawFilters.sort.field === 'string') {
    sortFieldCandidate = rawFilters.sort.field;
  }

  const normalizedSortField =
    typeof sortFieldCandidate === 'string' && Object.hasOwn(inventorySortColumnMap, sortFieldCandidate)
      ? sortFieldCandidate
      : 'name';

  let sortDirectionCandidate = null;
  if (typeof rawFilters.sortDirection === 'string') {
    sortDirectionCandidate = rawFilters.sortDirection;
  } else if (rawFilters.sort && typeof rawFilters.sort === 'object' && typeof rawFilters.sort.direction === 'string') {
    sortDirectionCandidate = rawFilters.sort.direction;
  }

  const normalizedSortDirection = sortDirectionCandidate && sortDirectionCandidate.toLowerCase() === 'desc' ? 'desc' : 'asc';

  const conditions = [];

  if (search) {
    const likeQuery = `%${search}%`;
    conditions.push(
      or(
        like(productCodes.name, likeQuery),
        like(productCodes.code, likeQuery),
        like(productCodes.sku, likeQuery)
      )
    );
  }

  if (branchIds.length > 0) {
    conditions.push(inArray(productCodeVersions.branchId, branchIds));
  }

  if (categoryIds.length > 0) {
    conditions.push(inArray(productCodes.categoryId, categoryIds));
  }

  if (productCodeIds.length > 0) {
    conditions.push(inArray(productCodes.id, productCodeIds));
  }

  if (productCodeVersionIds.length > 0) {
    conditions.push(inArray(productCodeVersions.id, productCodeVersionIds));
  }

  if (status === 'active') {
    conditions.push(eq(productCodeVersions.isActive, true));
  } else if (status === 'inactive') {
    conditions.push(eq(productCodeVersions.isActive, false));
  }

  if (availability === 'in_stock') {
    conditions.push(gt(productCodeVersions.qtyOnHand, productCodeVersions.qtyReserved));
  } else if (availability === 'out_of_stock') {
    conditions.push(lte(productCodeVersions.qtyOnHand, productCodeVersions.qtyReserved));
  } else if (availability === 'reserved') {
    conditions.push(gt(productCodeVersions.qtyReserved, 0));
  } else if (availability === 'low_stock') {
    conditions.push(gt(productCodeVersions.qtyOnHand, productCodeVersions.qtyReserved));
    conditions.push(lte(productCodeVersions.qtyOnHand, lowStockThreshold));
  }

  const includeCategories =
    Object.prototype.hasOwnProperty.call(attemptOptions, 'forceCategoryJoin')
      ? Boolean(attemptOptions.forceCategoryJoin)
      : inventoryCategoriesAvailable !== false;

  let query = db
    .select({
      productCodeId: productCodes.id,
      productCodeVersionId: productCodeVersions.id,
      code: productCodes.code,
      name: productCodes.name,
      sku: productCodes.sku,
      description: productCodes.description,
      categoryId: productCodes.categoryId,
      categoryName: includeCategories ? productCategories.name : sql`NULL`,
      branchId: productCodeVersions.branchId,
      branchName: branches.name,
      priceCents: productCodeVersions.priceCents,
      costCents: productCodeVersions.costCents,
      qtyOnHand: productCodeVersions.qtyOnHand,
      qtyReserved: productCodeVersions.qtyReserved,
      isActive: productCodeVersions.isActive,
      updatedAt: productCodeVersions.updatedAt,
    })
    .from(productCodeVersions)
    .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
    .leftJoin(branches, eq(productCodeVersions.branchId, branches.id));

  if (includeCategories) {
    query = query.leftJoin(productCategories, eq(productCodes.categoryId, productCategories.id));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const sortColumn = inventorySortColumnMap[normalizedSortField] ?? productCodes.name;
  const orderClauses = [
    normalizedSortDirection === 'desc' ? desc(sortColumn) : asc(sortColumn),
    asc(productCodes.code),
    asc(productCodeVersions.branchId),
  ];

  let rows;

  try {
    rows = await query.orderBy(...orderClauses).limit(limitPlusOne).offset(offset);
    if (includeCategories) {
      inventoryCategoriesAvailable = true;
    }
  } catch (error) {
    if (includeCategories && isMissingProductCategoriesTableError(error)) {
      inventoryCategoriesAvailable = false;
      return runInventoryQuery(rawFilters, { forceCategoryJoin: false });
    }

    throw error;
  }

  const items = rows.slice(0, pageSize).map((row) => {
    const qtyOnHand = Number(row.qtyOnHand ?? 0);
    const qtyReserved = Number(row.qtyReserved ?? 0);
    const availableQty = Math.max(0, qtyOnHand - qtyReserved);
    const priceCents = row.priceCents == null ? null : Number(row.priceCents);
    const costCents = row.costCents == null ? null : Number(row.costCents);

    return {
      productCodeId: row.productCodeId,
      productCodeVersionId: row.productCodeVersionId,
      code: row.code,
      name: row.name,
      sku: row.sku,
      description: row.description,
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? null,
      branchId: row.branchId,
      branchName: row.branchName ?? null,
      priceCents,
      costCents,
      qtyOnHand,
      qtyReserved,
      availableQty,
      isActive: Boolean(row.isActive),
      updatedAt: row.updatedAt ?? null,
    };
  });

  const hasMore = rows.length > pageSize;
  const skuSet = new Set();
  const branchMap = new Map();
  const categoryMap = new Map();

  for (const item of items) {
    skuSet.add(item.productCodeId);

    if (item.branchId && !branchMap.has(item.branchId)) {
      branchMap.set(item.branchId, {
        id: item.branchId,
        name: item.branchName ?? `Sucursal ${item.branchId}`,
      });
    }

    if (item.categoryId && !categoryMap.has(item.categoryId)) {
      categoryMap.set(item.categoryId, {
        id: item.categoryId,
        name: item.categoryName ?? `Categoría ${item.categoryId}`,
      });
    }
  }

  const totalQtyOnHand = items.reduce((sum, item) => sum + item.qtyOnHand, 0);
  const totalReserved = items.reduce((sum, item) => sum + item.qtyReserved, 0);
  const totalAvailable = items.reduce((sum, item) => sum + item.availableQty, 0);
  const totalRetailValueCents = items.reduce((sum, item) => {
    const price = Number.isFinite(item.priceCents) ? Number(item.priceCents) : 0;
    return sum + price * item.qtyOnHand;
  }, 0);

  const summary = {
    totalVariants: items.length,
    totalSkus: skuSet.size,
    totalQtyOnHand,
    totalReserved,
    totalAvailable,
    totalRetailValueCents,
  };

  const filtersApplied = {
    search,
    branchIds,
    categoryIds,
    productCodeIds,
    productCodeVersionIds,
    status,
    availability,
    lowStockThreshold,
    page,
    pageSize,
    sortField: normalizedSortField,
    sortDirection: normalizedSortDirection,
  };

  const branchOptions = Array.from(branchMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const categoryOptions = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return {
    items,
    summary,
    pagination: {
      page,
      pageSize,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    },
    metadata: {
      branches: branchOptions,
      categories: categoryOptions,
    },
    filtersApplied,
  };
}

app.get('/api/codes', async (req, res, next) => {
  try {
    let filters = {};

    if (typeof req.query.filters === 'string' && req.query.filters.trim()) {
      try {
        filters = JSON.parse(req.query.filters);
      } catch (error) {
        return res.status(400).json({ error: 'filters must be valid JSON' });
      }
    }

    if (typeof req.query.q === 'string' && !filters.search) {
      filters.search = req.query.q;
    }

    if (req.query.branchId && !filters.branchIds) {
      filters.branchIds = req.query.branchId;
    }

    if (req.query.categoryId && !filters.categoryIds) {
      filters.categoryIds = req.query.categoryId;
    }

    if (req.query.productCodeId && !filters.productCodeIds) {
      filters.productCodeIds = req.query.productCodeId;
    }

    if (req.query.productCodeVersionId && !filters.productCodeVersionIds) {
      filters.productCodeVersionIds = req.query.productCodeVersionId;
    }

    if (req.query.status && !filters.status) {
      filters.status = req.query.status;
    }

    if (req.query.availability && !filters.availability) {
      filters.availability = req.query.availability;
    }

    if (req.query.page && !filters.page) {
      filters.page = Number(req.query.page);
    }

    if (req.query.pageSize && !filters.pageSize) {
      filters.pageSize = Number(req.query.pageSize);
    }

    if (req.query.sortField && !filters.sortField) {
      filters.sortField = req.query.sortField;
    }

    if (req.query.sortDirection && !filters.sortDirection) {
      filters.sortDirection = req.query.sortDirection;
    }

    if (!filters.status) {
      filters.status = 'active';
    }

    if (!filters.pageSize) {
      filters.pageSize = 100;
    }

    if (!filters.sortField) {
      filters.sortField = 'name';
    }

    const result = await runInventoryQuery(filters);

    res.json({
      ...result,
      metadata: {
        ...result.metadata,
        layouts: availableLabelLayouts,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/inventory', async (req, res, next) => {
  try {
    let filters = {};

    if (typeof req.query.filters === 'string' && req.query.filters.trim()) {
      try {
        filters = JSON.parse(req.query.filters);
      } catch (error) {
        return res.status(400).json({ error: 'filters must be valid JSON' });
      }
    }

    if (typeof req.query.q === 'string' && !filters.search) {
      filters.search = req.query.q;
    }

    if (req.query.branchId && !filters.branchIds) {
      filters.branchIds = req.query.branchId;
    }

    if (req.query.categoryId && !filters.categoryIds) {
      filters.categoryIds = req.query.categoryId;
    }

    if (req.query.status && !filters.status) {
      filters.status = req.query.status;
    }

    if (req.query.availability && !filters.availability) {
      filters.availability = req.query.availability;
    }

    if (req.query.page && !filters.page) {
      filters.page = Number(req.query.page);
    }

    if (req.query.pageSize && !filters.pageSize) {
      filters.pageSize = Number(req.query.pageSize);
    }

    if (req.query.sortField && !filters.sortField) {
      filters.sortField = req.query.sortField;
    }

    if (req.query.sortDirection && !filters.sortDirection) {
      filters.sortDirection = req.query.sortDirection;
    }

    if (req.query.lowStockThreshold && !filters.lowStockThreshold) {
      filters.lowStockThreshold = Number(req.query.lowStockThreshold);
    }

    const result = await runInventoryQuery(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/product-codes/:id', async (req, res, next) => {
  try {
    const productCodeId = Number(req.params.id);

    if (!Number.isInteger(productCodeId) || productCodeId <= 0) {
      return res.status(400).json({ error: 'Product code id must be a positive integer' });
    }

    const {
      name,
      description,
      sku,
      categoryId = null,
      versionUpdates = [],
    } = req.body ?? {};

    const productUpdates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }

      productUpdates.name = name.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string or null' });
      }

      productUpdates.description = description === null ? null : description.trim();
    }

    if (sku !== undefined) {
      if (sku !== null && typeof sku !== 'string') {
        return res.status(400).json({ error: 'sku must be a string or null' });
      }

      productUpdates.sku = sku === null ? null : sku.trim();
    }

    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === '') {
        productUpdates.categoryId = null;
      } else {
        const numericCategoryId = Number(categoryId);
        if (!Number.isInteger(numericCategoryId) || numericCategoryId <= 0) {
          return res.status(400).json({ error: 'categoryId must be a positive integer when provided' });
        }
        productUpdates.categoryId = numericCategoryId;
      }
    }

    const normalizedVersionUpdates = Array.isArray(versionUpdates) ? versionUpdates : [];

    if (
      Object.keys(productUpdates).length === 0 &&
      normalizedVersionUpdates.length === 0
    ) {
      return res.status(400).json({ error: 'At least one field must be provided for update' });
    }

    let updatedCount = 0;
    const missingBranchIds = new Set();

    await db.transaction(async (tx) => {
      if (Object.keys(productUpdates).length > 0) {
        await tx.update(productCodes).set(productUpdates).where(eq(productCodes.id, productCodeId));
        updatedCount += 1;
      }

      if (normalizedVersionUpdates.length === 0) {
        return;
      }

      const existingVersions = await tx
        .select({
          id: productCodeVersions.id,
          branchId: productCodeVersions.branchId,
        })
        .from(productCodeVersions)
        .where(eq(productCodeVersions.productCodeId, productCodeId));

      const versionIdByBranch = new Map(existingVersions.map((row) => [row.branchId, row.id]));

      for (const entry of normalizedVersionUpdates) {
        const branchId = Number(entry?.branchId);

        if (!Number.isInteger(branchId) || branchId <= 0) {
          continue;
        }

        const versionId = versionIdByBranch.get(branchId);

        if (!versionId) {
          missingBranchIds.add(branchId);
          continue;
        }

        const updatePayload = {};

        if (entry.priceCents !== undefined) {
          const numericPrice = Number(entry.priceCents);
          if (!Number.isFinite(numericPrice) || numericPrice < 0) {
            throw new Error(`priceCents must be a non-negative number for branch ${branchId}`);
          }
          updatePayload.priceCents = Math.round(numericPrice);
        }

        if (entry.costCents !== undefined) {
          const numericCost = Number(entry.costCents);
          if (!Number.isFinite(numericCost) || numericCost < 0) {
            throw new Error(`costCents must be a non-negative number for branch ${branchId}`);
          }
          updatePayload.costCents = Math.round(numericCost);
        }

        if (entry.qtyOnHand !== undefined) {
          const numericQty = Number(entry.qtyOnHand);
          if (!Number.isFinite(numericQty) || numericQty < 0) {
            throw new Error(`qtyOnHand must be a non-negative number for branch ${branchId}`);
          }
          updatePayload.qtyOnHand = Math.round(numericQty);
        }

        if (entry.qtyReserved !== undefined) {
          const numericQty = Number(entry.qtyReserved);
          if (!Number.isFinite(numericQty) || numericQty < 0) {
            throw new Error(`qtyReserved must be a non-negative number for branch ${branchId}`);
          }
          updatePayload.qtyReserved = Math.round(numericQty);
        }

        if (entry.isActive !== undefined) {
          updatePayload.isActive = Boolean(entry.isActive);
        }

        if (Object.keys(updatePayload).length === 0) {
          continue;
        }

        updatePayload.updatedAt = new Date();

        await tx
          .update(productCodeVersions)
          .set(updatePayload)
          .where(eq(productCodeVersions.id, versionId));

        updatedCount += 1;
      }
    });

    if (updatedCount === 0) {
      if (missingBranchIds.size > 0) {
        return res.status(404).json({
          error: 'No matching product versions found for requested branches',
          missingBranchIds: Array.from(missingBranchIds.values()),
        });
      }

      return res.status(400).json({ error: 'No valid updates were provided' });
    }

    const refreshed = await runInventoryQuery({
      productCodeIds: [productCodeId],
      page: 1,
      pageSize: maxInventoryPageSize,
    });

    const responsePayload = {
      ...refreshed,
    };

    if (missingBranchIds.size > 0) {
      responsePayload.warnings = {
        missingBranchIds: Array.from(missingBranchIds.values()),
      };
    }

    res.json(responsePayload);
  } catch (error) {
    if (error instanceof Error && /must be a non-negative number/.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/labels/qr', async (req, res, next) => {
  try {
    const includePrice = req.body?.includePrice === undefined ? true : Boolean(req.body.includePrice);
    const labelNote = normalizeLabelNote(req.body?.labelNote);

    const { normalizedItems, versionMap, missingVersionIds } = await resolveLabelVersions(req.body?.items);

    if (versionMap.size === 0) {
      return res.status(404).json({
        error: 'No matching product code versions were found',
        missingVersionIds,
      });
    }

    const labels = [];

    for (const { productCodeVersionId, quantity } of normalizedItems) {
      const version = versionMap.get(productCodeVersionId);

      if (!version) {
        continue;
      }

      const priceCents = includePrice && version.priceCents != null ? Number(version.priceCents) : null;

      for (let i = 0; i < quantity; i += 1) {
        labels.push({
          productCodeVersionId,
          productCodeId: version.productCodeId,
          code: version.code,
          name: version.name,
          sku: version.sku,
          branchId: version.branchId,
          branchName: version.branchName ?? null,
          priceCents,
          qrPayload: `POS|INV|${version.code}|${productCodeVersionId}`,
          note: labelNote,
        });
      }
    }

    if (labels.length === 0) {
      return res.status(404).json({
        error: 'No matching product code versions were found',
        missingVersionIds,
      });
    }

    const responsePayload = {
      generatedAt: new Date().toISOString(),
      totalLabels: labels.length,
      labels,
    };

    if (missingVersionIds.length > 0) {
      responsePayload.warnings = {
        missingVersionIds,
      };
    }

    res.json(responsePayload);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/labels/print', async (req, res, next) => {
  try {
    const layout = resolveLabelLayout(req.body?.layout);
    const includePrice = req.body?.includePrice === undefined ? true : Boolean(req.body.includePrice);
    const labelNote = normalizeLabelNote(req.body?.labelNote);

    const { normalizedItems, versionMap, missingVersionIds } = await resolveLabelVersions(req.body?.items);

    if (versionMap.size === 0) {
      return res.status(404).json({
        error: 'No matching product code versions were found',
        missingVersionIds,
      });
    }

    const baseLabels = [];

    for (const { productCodeVersionId, quantity } of normalizedItems) {
      const version = versionMap.get(productCodeVersionId);

      if (!version) {
        continue;
      }

      const priceCents = includePrice && version.priceCents != null ? Number(version.priceCents) : null;

      for (let i = 0; i < quantity; i += 1) {
        baseLabels.push({
          productCodeVersionId,
          productCodeId: version.productCodeId,
          code: version.code,
          name: version.name,
          sku: version.sku,
          branchId: version.branchId,
          branchName: version.branchName ?? null,
          priceCents,
          qrPayload: `POS|INV|${version.code}|${productCodeVersionId}`,
          note: labelNote,
        });
      }
    }

    if (baseLabels.length === 0) {
      return res.status(404).json({
        error: 'No matching product code versions were found',
        missingVersionIds,
      });
    }

    const positionedLabels = positionLabelsForLayout(baseLabels, layout);
    const pages = buildLabelPages(positionedLabels, layout);

    const responsePayload = {
      generatedAt: new Date().toISOString(),
      layout: serializeLabelLayout(layout),
      totalLabels: positionedLabels.length,
      labels: positionedLabels,
      pages,
      availableLayouts: availableLabelLayouts,
    };

    if (missingVersionIds.length > 0) {
      responsePayload.warnings = {
        missingVersionIds,
      };
    }

    res.json(responsePayload);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post(
  '/api/cart/price-override',
  auditTrail('pos.price_override', 'pos_cart', {
    payloadResolver: (req) => {
      const { lineItemId, overridePriceCents, reason } = req.body ?? {};
      const numericOverride = Number(overridePriceCents);
      return {
        lineItemId: lineItemId ?? null,
        overridePriceCents: Number.isFinite(numericOverride) ? Math.round(numericOverride) : null,
        reason: typeof reason === 'string' ? reason : null,
      };
    },
    resourceResolver: (req) => {
      const { lineItemId } = req.body ?? {};
      const numeric = Number(lineItemId);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
  }),
  async (req, res) => {
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

    const numericLineId = Number(lineItemId);
    if (Number.isInteger(numericLineId) && numericLineId > 0) {
      res.locals.auditResourceId = numericLineId;
    }

    res.json({
      approved: true,
      lineItemId,
      overridePriceCents,
      reason: reason ?? null,
      approvedAt: new Date().toISOString(),
    });
  }
);

app.get('/api/invoices', async (req, res, next) => {
  try {
    const from = parseOptionalDate(req.query.from ?? req.query.startDate ?? null, 'from');
    const to = parseOptionalDate(req.query.to ?? req.query.endDate ?? null, 'to');
    const queryRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const branchIdRaw = req.query.branchId ?? req.query.branch_id ?? null;
    let branchIdFilter = null;

    if (branchIdRaw !== null && branchIdRaw !== undefined && String(branchIdRaw).trim().length > 0) {
      try {
        branchIdFilter = parsePositiveInteger(branchIdRaw, 'branchId');
      } catch (error) {
        if (error instanceof HttpError) {
          branchIdFilter = null;
        } else {
          throw error;
        }
      }
    }

    const limitRaw = req.query.limit ?? req.query.pageSize ?? null;
    let limit = 25;
    const parsedLimit = Number(limitRaw);
    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, 50);
    }

    const conditions = [isNotNull(invoices.invoiceNo)];

    if (from) {
      conditions.push(gte(invoices.createdAt, startOfDay(from)));
    }

    if (to) {
      conditions.push(lt(invoices.createdAt, startOfTomorrow(to)));
    }

    if (branchIdFilter) {
      conditions.push(eq(orders.branchId, branchIdFilter));
    }

    if (queryRaw) {
      const safe = escapeForLike(queryRaw);
      const likePattern = `%${safe}%`;
      conditions.push(
        or(
          like(invoices.invoiceNo, likePattern),
          like(customers.firstName, likePattern),
          like(customers.lastName, likePattern)
        )
      );
    }

    let statement = db
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        createdAt: invoices.createdAt,
        totalCents: invoices.totalCents,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
      })
      .from(invoices)
      .innerJoin(orders, eq(invoices.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id));

    if (conditions.length > 0) {
      statement = statement.where(and(...conditions));
    }

    const rows = await statement.orderBy(desc(invoices.createdAt), desc(invoices.id)).limit(limit);

    const invoicesList = rows.map((row) => {
      const customerName = [row.customerFirstName, row.customerLastName]
        .filter((part) => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();

      return {
        id: Number(row.id),
        invoiceNo: row.invoiceNo ?? null,
        customerName: customerName || null,
        totalCents: Number(row.totalCents ?? 0),
        createdAt: toIsoString(row.createdAt),
      };
    });

    res.json({ invoices: invoicesList });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.get('/api/invoices/:invoiceNo', async (req, res, next) => {
  try {
    const invoiceNo = req.params.invoiceNo?.trim();

    if (!invoiceNo) {
      return res.status(400).json({ error: 'invoiceNo is required' });
    }

    const detail = await loadInvoiceWithDetails(db, { invoiceNo });

    res.json({
      invoice: detail.invoice,
      lines: detail.lines,
      payments: detail.payments,
      policyFlags: detail.policyFlags,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/gift-cards/issue', async (req, res, next) => {
  try {
    const amountCentsRaw =
      req.body?.amountCents ?? req.body?.amount_cents ?? req.body?.amount ?? req.body?.value ?? null;

    let amountCents;
    if (amountCentsRaw === null || amountCentsRaw === undefined || amountCentsRaw === '') {
      throw new HttpError(400, 'amountCents is required');
    }

    if (typeof amountCentsRaw === 'string' && amountCentsRaw.includes('.')) {
      amountCents = parseMoneyToCents(amountCentsRaw, 'amount');
    } else {
      amountCents = parsePositiveInteger(amountCentsRaw, 'amountCents');
    }

    if (amountCents <= 0) {
      throw new HttpError(400, 'amountCents must be greater than zero');
    }

    let requestedCode = normalizeGiftCardCode(req.body?.code ?? req.body?.giftCode ?? null);
    const expiresOn = parseOptionalDate(req.body?.expiresOn ?? req.body?.expires_on, 'expiresOn');

    if (requestedCode) {
      const [existing] = await db
        .select({ id: giftCards.id })
        .from(giftCards)
        .where(eq(giftCards.code, requestedCode))
        .limit(1);

      if (existing) {
        return res.status(409).json({ error: 'Gift card code already exists' });
      }
    } else {
      requestedCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    }

    const cardRow = await db.transaction(async (tx) => {
      await tx.insert(giftCards).values({
        code: requestedCode,
        balanceCents: amountCents,
        expiresOn: expiresOn ?? null,
      });

      const card = await getGiftCardByIdentifier(tx, { code: requestedCode });

      await tx.insert(giftCardLedger).values({
        giftCardId: Number(card.id),
        deltaCents: amountCents,
        refTable: 'gift_card_issue',
        refId: Number(card.id),
      });

      return card;
    });

    res.status(201).json(serializeGiftCardRow(cardRow));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/gift-cards/reload', async (req, res, next) => {
  try {
    const amountCentsRaw =
      req.body?.amountCents ?? req.body?.amount_cents ?? req.body?.amount ?? req.body?.value ?? null;

    if (amountCentsRaw === null || amountCentsRaw === undefined || amountCentsRaw === '') {
      throw new HttpError(400, 'amountCents is required');
    }

    const amountCents = parsePositiveInteger(amountCentsRaw, 'amountCents');

    const cardId = req.body?.cardId ?? req.body?.id ?? null;
    const code = req.body?.code ?? null;

    const updatedCard = await db.transaction(async (tx) => {
      const card = await getGiftCardByIdentifier(tx, { cardId, code });

      await tx
        .update(giftCards)
        .set({ balanceCents: sql`${giftCards.balanceCents} + ${amountCents}` })
        .where(eq(giftCards.id, card.id));

      await tx.insert(giftCardLedger).values({
        giftCardId: Number(card.id),
        deltaCents: amountCents,
        refTable: 'gift_card_reload',
        refId: Number(card.id),
      });

      return getGiftCardByIdentifier(tx, { cardId: card.id });
    });

    res.json(serializeGiftCardRow(updatedCard));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/gift-cards/redeem', async (req, res, next) => {
  try {
    const amountCentsRaw =
      req.body?.amountCents ?? req.body?.amount_cents ?? req.body?.amount ?? req.body?.value ?? null;

    if (amountCentsRaw === null || amountCentsRaw === undefined || amountCentsRaw === '') {
      throw new HttpError(400, 'amountCents is required');
    }

    const amountCents = parsePositiveInteger(amountCentsRaw, 'amountCents');

    const cardId = req.body?.cardId ?? req.body?.id ?? null;
    const code = req.body?.code ?? null;

    const updatedCard = await db.transaction(async (tx) => {
      const card = await getGiftCardByIdentifier(tx, { cardId, code });

      if (Number(card.balanceCents ?? 0) < amountCents) {
        throw new HttpError(400, 'Gift card has insufficient balance');
      }

      await tx
        .update(giftCards)
        .set({ balanceCents: sql`${giftCards.balanceCents} - ${amountCents}` })
        .where(eq(giftCards.id, card.id));

      await tx.insert(giftCardLedger).values({
        giftCardId: Number(card.id),
        deltaCents: -amountCents,
        refTable: 'gift_card_redeem',
        refId: Number(card.id),
      });

      return getGiftCardByIdentifier(tx, { cardId: card.id });
    });

    res.json(serializeGiftCardRow(updatedCard));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.get('/api/loans/next-ticket', async (req, res, next) => {
  try {
    const prefix = typeof req.query.prefix === 'string' && req.query.prefix.trim().length > 0
      ? req.query.prefix.trim()
      : 'PAWN-';
    const branchIdRaw = req.query.branchId ?? req.query.branch_id ?? null;
    let branchIdFilter = null;

    if (branchIdRaw !== null && branchIdRaw !== undefined && String(branchIdRaw).trim().length > 0) {
      try {
        branchIdFilter = parsePositiveInteger(branchIdRaw, 'branchId');
      } catch (error) {
        if (error instanceof HttpError) {
          branchIdFilter = null;
        } else {
          throw error;
        }
      }
    }

    const filters = [isNotNull(loans.ticketNumber)];

    if (branchIdFilter) {
      filters.push(eq(loans.branchId, branchIdFilter));
    }

    if (prefix) {
      filters.push(like(loans.ticketNumber, `${prefix}%`));
    }

    let query = db
      .select({ ticketNumber: loans.ticketNumber })
      .from(loans);

    if (filters.length > 0) {
      query = query.where(and(...filters));
    }

    const [latest] = await query.orderBy(desc(loans.createdAt), desc(loans.id)).limit(1);

    let nextNumeric = 1;
    let padLength = 6;

    if (latest?.ticketNumber) {
      const match = String(latest.ticketNumber).match(/(\d+)(?!.*\d)/);
      if (match) {
        padLength = Math.max(match[1].length, padLength);
        nextNumeric = Number(match[1]) + 1;
      }
    }

    const nextTicket = `${prefix}${String(nextNumeric).padStart(padLength, '0')}`;

    res.json({ ticketNumber: nextTicket });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/pos/buys', async (req, res, next) => {
  try {
    const branchId = parsePositiveInteger(req.body?.branchId ?? req.body?.branch_id ?? 0, 'branchId');
    const userIdRaw = req.body?.userId ?? req.body?.user_id ?? null;
    const userId =
      userIdRaw === null || userIdRaw === undefined || userIdRaw === ''
        ? null
        : parsePositiveInteger(userIdRaw, 'userId');
    const shiftIdRaw = req.body?.shiftId ?? req.body?.shift_id ?? null;
    const shiftId =
      shiftIdRaw === null || shiftIdRaw === undefined || shiftIdRaw === ''
        ? null
        : parsePositiveInteger(shiftIdRaw, 'shiftId');

    const payoutMethod = req.body?.payoutMethod === 'transfer' ? 'transfer' : 'cash';

    const seller = req.body?.seller ?? {};
    const sellerNameRaw = typeof seller?.name === 'string' ? seller.name.trim() : '';
    const sellerName = sellerNameRaw || 'Walk-in seller';
    const sellerDocument = typeof seller?.document === 'string' ? seller.document.trim() : null;
    const sellerPhone = typeof seller?.phone === 'string' ? seller.phone.trim() : null;
    const sellerNotes = typeof seller?.notes === 'string' ? seller.notes.trim() : null;
    const managerNotes = typeof req.body?.managerNotes === 'string' ? req.body.managerNotes.trim() : null;

    const itemsInput = Array.isArray(req.body?.items) ? req.body.items : [];
    if (itemsInput.length === 0) {
      throw new HttpError(400, 'items must be a non-empty array');
    }

    const normalizedItems = itemsInput.map((item, index) => {
      if (item == null || typeof item !== 'object') {
        throw new HttpError(400, `items[${index}] must be an object`);
      }

      const descriptionRaw = typeof item.description === 'string' ? item.description.trim() : '';
      if (!descriptionRaw) {
        throw new HttpError(400, `items[${index}].description is required`);
      }

      const resaleValue = Number(item.resaleValue ?? item.resale_value ?? 0);
      if (!Number.isFinite(resaleValue) || resaleValue <= 0) {
        throw new HttpError(400, `items[${index}].resaleValue must be greater than zero`);
      }

      const targetMargin = Number(item.targetMargin ?? item.target_margin ?? 0);
      const normalizedMargin = Number.isFinite(targetMargin) ? Math.min(Math.max(targetMargin, 0), 95) : 0;

      const resaleValueCents = Math.round(resaleValue * 100);
      const offerCents = Math.max(0, Math.round(resaleValueCents * (1 - normalizedMargin / 100)));

      const accessories = typeof item.accessories === 'string' ? item.accessories.trim() : null;
      const notes = typeof item.notes === 'string' ? item.notes.trim() : null;
      const serial = typeof item.serial === 'string' ? item.serial.trim() : null;
      const condition = typeof item.condition === 'string' ? item.condition.trim() : null;
      const photos = Array.isArray(item.photos)
        ? item.photos.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
        : [];

      return {
        description: descriptionRaw,
        resaleValueCents,
        offerCents,
        accessories,
        notes,
        serial,
        condition,
        photos,
      };
    });

    const totalCostCents = normalizedItems.reduce((sum, item) => sum + item.offerCents, 0);
    const totalQuantity = normalizedItems.length;

    const payoutNotes = {
      payoutMethod,
      seller: {
        name: sellerName,
        document: sellerDocument,
        phone: sellerPhone,
        notes: sellerNotes,
      },
      managerNotes,
    };

    const result = await db.transaction(async (tx) => {
      await tx.insert(purchases).values({
        branchId,
        supplierName: sellerName,
        createdBy: userId,
        totalCostCents,
        totalQuantity,
        notes: JSON.stringify(payoutNotes),
      });

      const [purchaseRow] = await tx
        .select({
          id: purchases.id,
          totalCostCents: purchases.totalCostCents,
          totalQuantity: purchases.totalQuantity,
          createdAt: purchases.createdAt,
        })
        .from(purchases)
        .orderBy(desc(purchases.id))
        .limit(1);

      if (!purchaseRow) {
        throw new HttpError(500, 'FAILED_TO_CREATE_PURCHASE');
      }

      const lineSummaries = [];

      for (let index = 0; index < normalizedItems.length; index += 1) {
        const item = normalizedItems[index];
        const code = generateCustomerBuyCode(index);

        await tx.insert(productCodes).values({
          code,
          name: item.description,
          description: item.notes,
        });

        const [codeRow] = await tx
          .select({ id: productCodes.id })
          .from(productCodes)
          .where(eq(productCodes.code, code))
          .orderBy(desc(productCodes.id))
          .limit(1);

        if (!codeRow) {
          throw new HttpError(500, 'FAILED_TO_CREATE_PRODUCT_CODE');
        }

        await tx.insert(productCodeVersions).values({
          productCodeId: Number(codeRow.id),
          branchId,
          priceCents: item.resaleValueCents,
          costCents: item.offerCents,
          qtyOnHand: 1,
          qtyReserved: 0,
        });

        const [versionRow] = await tx
          .select({ id: productCodeVersions.id })
          .from(productCodeVersions)
          .where(eq(productCodeVersions.productCodeId, Number(codeRow.id)))
          .orderBy(desc(productCodeVersions.id))
          .limit(1);

        if (!versionRow) {
          throw new HttpError(500, 'FAILED_TO_CREATE_PRODUCT_VERSION');
        }

        await tx.insert(purchaseLines).values({
          purchaseId: Number(purchaseRow.id),
          productCodeVersionId: Number(versionRow.id),
          quantity: 1,
          unitCostCents: item.offerCents,
          lineTotalCents: item.offerCents,
          labelQuantity: 1,
          notes: item.notes,
        });

        await tx.insert(stockLedger).values({
          productCodeVersionId: Number(versionRow.id),
          reason: 'purchase',
          qtyChange: 1,
          referenceType: 'purchase',
          referenceId: Number(purchaseRow.id),
          notes: `Customer buy intake ${code}`,
        });

        lineSummaries.push({
          productCodeId: Number(codeRow.id),
          productCodeVersionId: Number(versionRow.id),
          code,
          description: item.description,
          resaleValueCents: item.resaleValueCents,
          offerCents: item.offerCents,
          serial: item.serial,
          accessories: item.accessories,
          condition: item.condition,
          photos: item.photos,
        });
      }

      if (payoutMethod === 'cash' && shiftId != null) {
        await tx.insert(cashMovements).values({
          shiftId,
          kind: 'paid_out',
          amountCents: totalCostCents,
          reason: `Customer buy payout for purchase #${purchaseRow.id}`,
        });
      }

      return {
        purchase: purchaseRow,
        lines: lineSummaries,
      };
    });

    res.status(201).json({
      purchase: {
        id: Number(result.purchase.id),
        totalCostCents: Number(result.purchase.totalCostCents ?? totalCostCents),
        totalQuantity: Number(result.purchase.totalQuantity ?? totalQuantity),
        createdAt:
          result.purchase.createdAt instanceof Date
            ? result.purchase.createdAt.toISOString()
            : toIsoString(result.purchase.createdAt),
        supplierName: sellerName,
        payoutMethod,
      },
      items: result.lines,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
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
        createdBy: userId,
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

app.post('/api/refunds', async (req, res, next) => {
  try {
    const {
      invoiceNo = null,
      invoiceId = null,
      method,
      lines: rawLines = [],
      shiftId = null,
      createdBy = null,
      reason = null,
      notes = null,
    } = req.body ?? {};

    const normalizedMethod = typeof method === 'string' ? method.toLowerCase() : '';
    if (!['cash', 'store_credit'].includes(normalizedMethod)) {
      return res.status(400).json({ error: 'method must be cash or store_credit' });
    }

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return res.status(400).json({ error: 'lines must be a non-empty array' });
    }

    const detail = await loadInvoiceWithDetails(db, { invoiceId, invoiceNo });

    const lineMap = new Map(detail.lines.map((line) => [Number(line.orderItemId), line]));
    const normalizedLines = [];

    rawLines.forEach((entry, index) => {
      if (entry == null || typeof entry !== 'object') {
        throw new HttpError(400, `lines[${index}] must be an object`);
      }

      const idCandidate = entry.orderItemId ?? entry.order_item_id ?? entry.id;
      const orderItemId = parsePositiveInteger(idCandidate, `lines[${index}].orderItemId`);
      const source = lineMap.get(orderItemId);

      if (!source) {
        throw new HttpError(404, `Order item ${orderItemId} not found on invoice`);
      }

      const qtyValue = entry.qty ?? entry.quantity ?? source.qty;
      const qty = parsePositiveInteger(qtyValue, `lines[${index}].qty`);

      if (qty > source.qty) {
        throw new HttpError(400, `lines[${index}].qty cannot exceed original quantity`);
      }

      const restock = entry.restock === undefined ? source.restockable : Boolean(entry.restock);
      const unitPriceCents = Number(source.unitPriceCents ?? 0);
      const subtotalCents = unitPriceCents * qty;
      const taxPerUnitCents = Number(source.taxPerUnitCents ?? 0);
      const taxCents = taxPerUnitCents * qty;
      const totalCents = subtotalCents + taxCents;

      normalizedLines.push({
        orderItemId,
        productCodeVersionId: Number(source.productCodeVersionId),
        qty,
        unitPriceCents,
        subtotalCents,
        taxCents,
        totalCents,
        restock,
      });
    });

    const subtotalRefundCents = normalizedLines.reduce((sum, line) => sum + line.subtotalCents, 0);
    const taxRefundCents = normalizedLines.reduce((sum, line) => sum + line.taxCents, 0);
    const totalRefundCents = subtotalRefundCents + taxRefundCents;
    const restockValueCents = normalizedLines.reduce(
      (sum, line) => sum + (line.restock ? line.subtotalCents : 0),
      0,
    );

    if (totalRefundCents <= 0) {
      return res.status(400).json({ error: 'No refundable value selected' });
    }

    const createdById =
      createdBy === null || createdBy === undefined || createdBy === ''
        ? null
        : parsePositiveInteger(createdBy, 'createdBy');

    const shiftIdValue =
      shiftId === null || shiftId === undefined || shiftId === ''
        ? null
        : parsePositiveInteger(shiftId, 'shiftId');

    const normalizedReason = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : null;
    const normalizedNotes = typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null;

    const result = await db.transaction(async (tx) => {
      await tx.insert(salesReturns).values({
        invoiceId: detail.invoice.id,
        orderId: detail.invoice.orderId,
        branchId: detail.invoice.branchId,
        customerId: detail.invoice.customerId,
        createdBy: createdById,
        refundMethod: normalizedMethod,
        totalRefundCents,
        restockValueCents,
        reason: normalizedReason,
        notes: normalizedNotes,
      });

      const [salesReturnRow] = await tx
        .select({
          id: salesReturns.id,
          invoiceId: salesReturns.invoiceId,
          orderId: salesReturns.orderId,
          refundMethod: salesReturns.refundMethod,
          totalRefundCents: salesReturns.totalRefundCents,
          restockValueCents: salesReturns.restockValueCents,
          createdAt: salesReturns.createdAt,
        })
        .from(salesReturns)
        .where(eq(salesReturns.invoiceId, detail.invoice.id))
        .orderBy(desc(salesReturns.id))
        .limit(1);

      if (!salesReturnRow) {
        throw new HttpError(500, 'FAILED_TO_CREATE_REFUND');
      }

      if (normalizedLines.length > 0) {
        await tx.insert(salesReturnItems).values(
          normalizedLines.map((line) => ({
            salesReturnId: Number(salesReturnRow.id),
            orderItemId: line.orderItemId,
            productCodeVersionId: line.productCodeVersionId,
            qty: line.qty,
            unitPriceCents: line.unitPriceCents,
            taxCents: line.taxCents,
            restock: line.restock,
          })),
        );
      }

      const restockLines = normalizedLines.filter((line) => line.restock);

      if (restockLines.length > 0) {
        for (const line of restockLines) {
          await tx
            .update(productCodeVersions)
            .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${line.qty}` })
            .where(eq(productCodeVersions.id, line.productCodeVersionId));
        }

        await tx.insert(stockLedger).values(
          restockLines.map((line) => ({
            productCodeVersionId: line.productCodeVersionId,
            reason: 'return',
            qtyChange: line.qty,
            referenceType: 'sales_return',
            referenceId: Number(salesReturnRow.id),
            notes:
              normalizedReason ??
              (detail.invoice.invoiceNo
                ? `Refund ${detail.invoice.invoiceNo}`
                : `Refund invoice ${detail.invoice.id}`),
          })),
        );
      }

      let creditNoteRow = null;

      if (normalizedMethod === 'cash') {
        if (shiftIdValue != null) {
          await tx.insert(cashMovements).values({
            shiftId: shiftIdValue,
            kind: 'refund',
            amountCents: totalRefundCents,
            reason:
              normalizedReason ??
              (detail.invoice.invoiceNo
                ? `Refund ${detail.invoice.invoiceNo}`
                : `Refund invoice ${detail.invoice.id}`),
          });
        }
      } else if (normalizedMethod === 'store_credit') {
        if (detail.invoice.customerId == null) {
          throw new HttpError(400, 'Customer is required for store credit refunds');
        }

        await tx.insert(creditNotes).values({
          customerId: detail.invoice.customerId,
          balanceCents: totalRefundCents,
          reason:
            normalizedReason ??
            (detail.invoice.invoiceNo
              ? `Refund ${detail.invoice.invoiceNo}`
              : `Refund invoice ${detail.invoice.id}`),
        });

        const [row] = await tx
          .select({
            id: creditNotes.id,
            customerId: creditNotes.customerId,
            balanceCents: creditNotes.balanceCents,
            createdAt: creditNotes.createdAt,
          })
          .from(creditNotes)
          .where(eq(creditNotes.customerId, detail.invoice.customerId))
          .orderBy(desc(creditNotes.id))
          .limit(1);

        if (row) {
          creditNoteRow = row;

          await tx.insert(creditNoteLedger).values({
            creditNoteId: Number(row.id),
            deltaCents: totalRefundCents,
            refTable: 'sales_return',
            refId: Number(salesReturnRow.id),
          });
        }
      }

      return { salesReturnRow, creditNoteRow };
    });

    res.status(201).json({
      salesReturn: {
        id: Number(result.salesReturnRow.id),
        invoiceId: Number(result.salesReturnRow.invoiceId),
        orderId: Number(result.salesReturnRow.orderId),
        refundMethod: result.salesReturnRow.refundMethod,
        totalRefundCents: Number(result.salesReturnRow.totalRefundCents ?? totalRefundCents),
        restockValueCents: Number(result.salesReturnRow.restockValueCents ?? restockValueCents),
        createdAt:
          result.salesReturnRow.createdAt instanceof Date
            ? result.salesReturnRow.createdAt.toISOString()
            : toIsoString(result.salesReturnRow.createdAt),
        reason: normalizedReason,
        notes: normalizedNotes,
      },
      totals: {
        subtotalCents: subtotalRefundCents,
        taxCents: taxRefundCents,
        totalCents: totalRefundCents,
        restockValueCents,
      },
      lines: normalizedLines.map((line) => ({
        orderItemId: line.orderItemId,
        productCodeVersionId: line.productCodeVersionId,
        qty: line.qty,
        unitPriceCents: line.unitPriceCents,
        subtotalCents: line.subtotalCents,
        taxCents: line.taxCents,
        totalCents: line.totalCents,
        restock: line.restock,
      })),
      creditNote: result.creditNoteRow
        ? {
            id: Number(result.creditNoteRow.id),
            customerId: Number(result.creditNoteRow.customerId),
            balanceCents: Number(result.creditNoteRow.balanceCents ?? totalRefundCents),
            createdAt:
              result.creditNoteRow.createdAt instanceof Date
                ? result.creditNoteRow.createdAt.toISOString()
                : toIsoString(result.creditNoteRow.createdAt),
          }
        : null,
      invoice: detail.invoice,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

// Repairs & Fabrication
app.get('/api/repairs', async (req, res, next) => {
  try {
    const stateParam = typeof req.query.state === 'string' ? req.query.state : null;
    const statuses = stateParam
      ? stateParam
          .split(',')
          .map((value) => value.trim())
          .filter((value) => repairStatuses.includes(value))
      : [];

    let statement = db
      .select({
        ...repairSelection,
        branchName: branches.name,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
      })
      .from(repairs)
      .leftJoin(branches, eq(repairs.branchId, branches.id))
      .leftJoin(customers, eq(repairs.customerId, customers.id));

    if (statuses.length > 0) {
      statement = statement.where(inArray(repairs.status, statuses));
    }

    const rows = await statement.orderBy(desc(repairs.createdAt), desc(repairs.id));

    res.json({ repairs: rows.map(mapRepairListRow) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/repairs', async (req, res, next) => {
  try {
    const branchId = parsePositiveInteger(req.body?.branchId ?? req.body?.branch_id, 'branchId');
    const customerId = parsePositiveInteger(req.body?.customerId ?? req.body?.customer_id, 'customerId');
    const jobNumberInput =
      typeof req.body?.jobNumber === 'string'
        ? req.body.jobNumber.trim().slice(0, 40)
        : typeof req.body?.job_number === 'string'
        ? req.body.job_number.trim().slice(0, 40)
        : '';
    const jobNumber = jobNumberInput || generateRepairJobNumber();
    const itemDescription = normalizeNullableText(
      req.body?.itemDescription ?? req.body?.item_description,
      2000
    );
    const issueDescription = normalizeNullableText(
      req.body?.issueDescription ?? req.body?.issue_description,
      2000
    );
    const diagnosis = normalizeNullableText(req.body?.diagnosis, 2000);
    const estimateCents = parseNonNegativeInteger(
      req.body?.estimateCents ?? req.body?.estimate_cents ?? 0,
      'estimateCents'
    );
    const depositCents = parseNonNegativeInteger(
      req.body?.depositCents ?? req.body?.deposit_cents ?? 0,
      'depositCents'
    );
    const promisedAt = parseOptionalDateTimeInput(req.body?.promisedAt ?? req.body?.promised_at);
    const notes = normalizeReasonInput(req.body?.notes);

    const depositMethodRaw =
      typeof req.body?.depositMethod === 'string'
        ? req.body.depositMethod.trim().toLowerCase()
        : typeof req.body?.deposit_method === 'string'
        ? req.body.deposit_method.trim().toLowerCase()
        : '';
    const depositMethod = depositMethodRaw
      ? repairPaymentMethods.includes(depositMethodRaw)
        ? depositMethodRaw
        : null
      : 'cash';

    if (depositMethod === null) {
      return res.status(400).json({ error: 'depositMethod is invalid' });
    }

    const depositReference = normalizeNullableText(
      req.body?.depositReference ?? req.body?.deposit_reference,
      120
    );
    const depositNote = normalizeReasonInput(req.body?.depositNote ?? req.body?.deposit_note);

    const photoPaths = (Array.isArray(req.body?.photos) ? req.body.photos : [])
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0)
      .slice(0, 20);

    const [branchRow] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    if (!branchRow) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const [customerRow] = await db
      .select({ id: customers.id, branchId: customers.branchId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customerRow) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (Number(customerRow.branchId) !== Number(branchId)) {
      return res.status(400).json({ error: 'Customer must belong to the same branch as the repair' });
    }

    const result = await db.transaction(async (tx) => {
      await tx.insert(repairs).values({
        branchId,
        customerId,
        jobNumber,
        itemDescription,
        issueDescription,
        diagnosis,
        estimateCents,
        depositCents,
        approvalStatus: 'not_requested',
        status: 'intake',
        promisedAt,
        totalPaidCents: depositCents,
        notes,
      });

      const [created] = await tx
        .select(repairSelection)
        .from(repairs)
        .where(eq(repairs.jobNumber, jobNumber))
        .orderBy(desc(repairs.id))
        .limit(1);

      if (!created) {
        throw new Error('FAILED_TO_CREATE_REPAIR');
      }

      const repairId = Number(created.id);

      if (photoPaths.length > 0) {
        await tx.insert(repairPhotos).values(
          photoPaths.map((path) => ({
            repairId,
            storagePath: path.slice(0, 512),
          }))
        );
      }

      if (depositCents > 0) {
        await tx.insert(repairPayments).values({
          repairId,
          amountCents: depositCents,
          method: depositMethod,
          reference: depositReference,
          note: depositNote,
        });
      }

      return getRepairDetail(tx, repairId);
    });

    if (!result) {
      throw new Error('FAILED_TO_CREATE_REPAIR');
    }

    res.status(201).json({ repair: result });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_REPAIR') {
      return res.status(500).json({ error: 'Unable to create repair' });
    }

    next(error);
  }
});

app.get('/api/repairs/:id', async (req, res, next) => {
  try {
    const repairId = parsePositiveInteger(req.params.id, 'repairId');
    const detail = await getRepairDetail(db, repairId);

    if (!detail) {
      return res.status(404).json({ error: 'Repair not found' });
    }

    res.json({ repair: detail });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post(
  '/api/repairs/:id/request-approval',
  auditTrail('repair.request_approval', 'repair', {
    resourceResolver: (req) => {
      const id = Number(req.params.id);
      return Number.isInteger(id) && id > 0 ? id : null;
    },
  }),
  async (req, res, next) => {
    try {
      const repairId = parsePositiveInteger(req.params.id, 'repairId');

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select(repairSelection)
          .from(repairs)
          .where(eq(repairs.id, repairId))
          .limit(1);

        if (!existing) {
          throw new HttpError(404, 'Repair not found');
        }

        const nextStatus =
          existing.status === 'intake' || existing.status === 'diagnosing'
            ? 'waiting_approval'
            : existing.status;

        await tx
          .update(repairs)
          .set({
            approvalStatus: 'pending',
            approvalRequestedAt: new Date(),
            status: nextStatus,
          })
          .where(eq(repairs.id, repairId));

        return getRepairDetail(tx, repairId);
      });

      res.locals.auditResourceId = repairId;

      res.json({ repair: result });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      next(error);
    }
  }
);

app.post(
  '/api/repairs/:id/move',
  auditTrail('repair.move', 'repair', {
    payloadResolver: (req) => {
      const { status, targetStatus, approvalStatus } = req.body ?? {};
      return {
        status: status ?? targetStatus ?? null,
        approvalStatus: approvalStatus ?? null,
      };
    },
    resourceResolver: (req) => {
      const id = Number(req.params.id);
      return Number.isInteger(id) && id > 0 ? id : null;
    },
  }),
  async (req, res, next) => {
    try {
      const repairId = parsePositiveInteger(req.params.id, 'repairId');
      const statusRaw =
        typeof req.body?.status === 'string'
          ? req.body.status.trim().toLowerCase()
          : typeof req.body?.targetStatus === 'string'
          ? req.body.targetStatus.trim().toLowerCase()
          : '';

      if (!isValidRepairStatus(statusRaw)) {
        return res.status(400).json({ error: 'status is invalid' });
      }

      const approvalRaw =
        typeof req.body?.approvalStatus === 'string'
          ? req.body.approvalStatus.trim().toLowerCase()
          : null;

      if (approvalRaw && !repairApprovalStatuses.includes(approvalRaw)) {
        return res.status(400).json({ error: 'approvalStatus is invalid' });
      }

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select(repairSelection)
          .from(repairs)
          .where(eq(repairs.id, repairId))
          .limit(1);

        if (!existing) {
          throw new HttpError(404, 'Repair not found');
        }

        const updatePayload = {
          status: statusRaw,
        };

        if (approvalRaw) {
          updatePayload.approvalStatus = approvalRaw;
          updatePayload.approvalDecisionAt = new Date();
        }

        await tx.update(repairs).set(updatePayload).where(eq(repairs.id, repairId));

        return getRepairDetail(tx, repairId);
      });

      res.locals.auditResourceId = repairId;

      res.json({ repair: result });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      next(error);
    }
  }
);

app.post('/api/repairs/:id/materials/issue', async (req, res, next) => {
  try {
    const repairId = parsePositiveInteger(req.params.id, 'repairId');
    const productCodeVersionId = parsePositiveInteger(
      req.body?.productCodeVersionId ?? req.body?.product_code_version_id,
      'productCodeVersionId'
    );
    const quantity = parsePositiveInteger(req.body?.quantity ?? req.body?.qty, 'quantity');

    const result = await db.transaction(async (tx) => {
      const [repairRow] = await tx
        .select({
          id: repairs.id,
          branchId: repairs.branchId,
          status: repairs.status,
          jobNumber: repairs.jobNumber,
        })
        .from(repairs)
        .where(eq(repairs.id, repairId))
        .limit(1);

      if (!repairRow) {
        throw new HttpError(404, 'Repair not found');
      }

      if (repairRow.status === 'completed' || repairRow.status === 'cancelled') {
        throw new HttpError(400, 'Cannot issue materials for closed repairs');
      }

      const [versionRow] = await tx
        .select({
          id: productCodeVersions.id,
          branchId: productCodeVersions.branchId,
          qtyOnHand: productCodeVersions.qtyOnHand,
        })
        .from(productCodeVersions)
        .where(eq(productCodeVersions.id, productCodeVersionId))
        .limit(1);

      if (!versionRow) {
        throw new HttpError(404, 'Product code version not found');
      }

      if (Number(versionRow.branchId ?? 0) !== Number(repairRow.branchId ?? 0)) {
        throw new HttpError(400, 'Material must belong to the same branch as the repair');
      }

      const availableQty = Number(versionRow.qtyOnHand ?? 0);
      if (availableQty < quantity) {
        throw new HttpError(400, 'Insufficient inventory to issue material');
      }

      const [existingMaterial] = await tx
        .select(repairMaterialSelection)
        .from(repairMaterials)
        .where(
          and(
            eq(repairMaterials.repairId, repairId),
            eq(repairMaterials.productCodeVersionId, productCodeVersionId)
          )
        )
        .limit(1);

      if (existingMaterial) {
        await tx
          .update(repairMaterials)
          .set({ qtyIssued: Number(existingMaterial.qtyIssued ?? 0) + quantity })
          .where(eq(repairMaterials.id, existingMaterial.id));
      } else {
        await tx.insert(repairMaterials).values({
          repairId,
          productCodeVersionId,
          qtyIssued: quantity,
          qtyReturned: 0,
        });
      }

      await tx
        .update(productCodeVersions)
        .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${quantity}` })
        .where(eq(productCodeVersions.id, productCodeVersionId));

      await tx.insert(stockLedger).values({
        productCodeVersionId,
        reason: 'repair_issue',
        qtyChange: -quantity,
        referenceId: repairId,
        referenceType: 'repair',
        notes: `Materials issued for repair ${repairRow.jobNumber}`,
      });

      return getRepairDetail(tx, repairId);
    });

    res.status(201).json({ repair: result });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/repairs/:id/materials/return', async (req, res, next) => {
  try {
    const repairId = parsePositiveInteger(req.params.id, 'repairId');
    const productCodeVersionId = parsePositiveInteger(
      req.body?.productCodeVersionId ?? req.body?.product_code_version_id,
      'productCodeVersionId'
    );
    const quantity = parsePositiveInteger(req.body?.quantity ?? req.body?.qty, 'quantity');

    const result = await db.transaction(async (tx) => {
      const [repairRow] = await tx
        .select({
          id: repairs.id,
          branchId: repairs.branchId,
          jobNumber: repairs.jobNumber,
        })
        .from(repairs)
        .where(eq(repairs.id, repairId))
        .limit(1);

      if (!repairRow) {
        throw new HttpError(404, 'Repair not found');
      }

      const [existingMaterial] = await tx
        .select(repairMaterialSelection)
        .from(repairMaterials)
        .where(
          and(
            eq(repairMaterials.repairId, repairId),
            eq(repairMaterials.productCodeVersionId, productCodeVersionId)
          )
        )
        .limit(1);

      if (!existingMaterial) {
        throw new HttpError(404, 'Material issue record not found');
      }

      const outstanding =
        Number(existingMaterial.qtyIssued ?? 0) - Number(existingMaterial.qtyReturned ?? 0);

      if (quantity > outstanding) {
        throw new HttpError(400, 'Return quantity exceeds issued amount');
      }

      await tx
        .update(repairMaterials)
        .set({ qtyReturned: Number(existingMaterial.qtyReturned ?? 0) + quantity })
        .where(eq(repairMaterials.id, existingMaterial.id));

      await tx
        .update(productCodeVersions)
        .set({ qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${quantity}` })
        .where(eq(productCodeVersions.id, productCodeVersionId));

      await tx.insert(stockLedger).values({
        productCodeVersionId,
        reason: 'repair_return',
        qtyChange: quantity,
        referenceId: repairId,
        referenceType: 'repair',
        notes: `Materials returned for repair ${repairRow.jobNumber}`,
      });

      return getRepairDetail(tx, repairId);
    });

    res.status(201).json({ repair: result });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/repairs/:id/pay', async (req, res, next) => {
  try {
    const repairId = parsePositiveInteger(req.params.id, 'repairId');
    const amount = parseAmount(
      req.body?.amountCents ?? req.body?.amount_cents ?? req.body?.amount
    );

    if (amount === null) {
      return res.status(400).json({ error: 'amountCents must be a positive number' });
    }

    let method =
      typeof req.body?.method === 'string'
        ? req.body.method.trim().toLowerCase()
        : 'cash';

    if (!repairPaymentMethods.includes(method)) {
      if (!req.body?.method) {
        method = 'cash';
      } else {
        return res.status(400).json({ error: 'method is invalid' });
      }
    }

    const isDeposit = Boolean(req.body?.isDeposit ?? req.body?.deposit ?? false);
    const reference = normalizeNullableText(req.body?.reference, 120);
    const note = normalizeReasonInput(req.body?.note);

    const result = await db.transaction(async (tx) => {
      const [repairRow] = await tx
        .select({
          id: repairs.id,
          depositCents: repairs.depositCents,
          totalPaidCents: repairs.totalPaidCents,
        })
        .from(repairs)
        .where(eq(repairs.id, repairId))
        .limit(1);

      if (!repairRow) {
        throw new HttpError(404, 'Repair not found');
      }

      await tx.insert(repairPayments).values({
        repairId,
        amountCents: amount,
        method,
        reference,
        note,
      });

      const currentDeposit = Number(repairRow.depositCents ?? 0);
      const currentTotal = Number(repairRow.totalPaidCents ?? 0);

      await tx
        .update(repairs)
        .set({
          depositCents: isDeposit ? currentDeposit + amount : currentDeposit,
          totalPaidCents: currentTotal + amount,
        })
        .where(eq(repairs.id, repairId));

      return getRepairDetail(tx, repairId);
    });

    res.status(201).json({ repair: result });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/repairs/:id/close', async (req, res, next) => {
  try {
    const repairId = parsePositiveInteger(req.params.id, 'repairId');

    const result = await db.transaction(async (tx) => {
      const detailBefore = await getRepairDetail(tx, repairId);

      if (!detailBefore) {
        throw new HttpError(404, 'Repair not found');
      }

      const now = new Date();

      await tx
        .update(repairs)
        .set({
          status: 'completed',
          approvalStatus:
            detailBefore.approvalStatus === 'pending' || detailBefore.approvalStatus === 'not_requested'
              ? 'approved'
              : detailBefore.approvalStatus,
          approvalDecisionAt: now,
        })
        .where(eq(repairs.id, repairId));

      const detailAfter = await getRepairDetail(tx, repairId);

      if (detailAfter?.customer?.phone) {
        const message = `Tu trabajo ${detailAfter.jobNumber} está listo para recoger.`;
        await queueNotificationMessage(tx, {
          repairId,
          customerId: detailAfter.customer?.id ?? null,
          channel: 'sms',
          recipient: detailAfter.customer.phone,
          message,
        });
        await queueNotificationMessage(tx, {
          repairId,
          customerId: detailAfter.customer?.id ?? null,
          channel: 'whatsapp',
          recipient: detailAfter.customer.phone,
          message,
        });
      }

      return detailAfter;
    });

    const warrantyDocumentUrl = `${frontendBaseUrl}/repairs/${repairId}/warranty.pdf`;

    res.json({ repair: result, warrantyDocumentUrl });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/repairs/:id/warranty', async (req, res, next) => {
  try {
    const repairId = parsePositiveInteger(req.params.id, 'repairId');
    const detail = await getRepairDetail(db, repairId);

    if (!detail) {
      return res.status(404).json({ error: 'Repair not found' });
    }

    const warrantyDocumentUrl = `${frontendBaseUrl}/repairs/${repairId}/warranty.pdf`;
    res.json({ repair: detail, warrantyDocumentUrl });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/repairs/:id/notify', async (req, res, next) => {
  try {
    const repairId = parsePositiveInteger(req.params.id, 'repairId');
    const channelRaw =
      typeof req.body?.channel === 'string'
        ? req.body.channel.trim().toLowerCase()
        : 'sms';
    const channel = channelRaw === 'whatsapp' ? 'whatsapp' : 'sms';
    const message = normalizeNullableText(req.body?.message, 2000);

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const detail = await getRepairDetail(db, repairId);

    if (!detail) {
      return res.status(404).json({ error: 'Repair not found' });
    }

    let recipient =
      typeof req.body?.recipient === 'string' ? req.body.recipient.trim() : detail.customer?.phone ?? '';

    if (!recipient) {
      return res.status(400).json({ error: 'recipient is required' });
    }

    await queueNotificationMessage(db, {
      repairId,
      customerId: detail.customer?.id ?? null,
      channel,
      recipient,
      message,
    });

    res.status(202).json({ repair: detail, queued: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.get('/api/layaways/dashboard', async (req, res, next) => {
  try {
    const snapshot = await buildLayawayDashboardSnapshot();
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.post('/api/layaways', async (req, res, next) => {
  try {
    const { orderId, dueDate, initialPayment = null } = req.body ?? {};

    const numericOrderId = Number(orderId);

    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      return res.status(400).json({ error: 'orderId must be a positive integer' });
    }

    if (!dueDate) {
      return res.status(400).json({ error: 'dueDate is required' });
    }

    const dueDateValue = new Date(dueDate);

    if (Number.isNaN(dueDateValue.getTime())) {
      return res.status(400).json({ error: 'dueDate must be a valid date' });
    }

    let initialPaymentCents = 0;
    let initialPaymentMethod = 'cash';
    let initialPaymentNote = null;

    if (initialPayment && typeof initialPayment === 'object') {
      const rawMethod = typeof initialPayment.method === 'string' ? initialPayment.method.toLowerCase() : 'cash';

      if (initialPayment.method && !allowedLayawayPaymentMethods.has(rawMethod)) {
        return res.status(400).json({ error: 'Unsupported initial payment method' });
      }

      initialPaymentMethod = rawMethod;

      if (initialPayment.amountCents != null) {
        const parsed = parseAmount(initialPayment.amountCents);

        if (parsed === null) {
          return res.status(400).json({ error: 'initialPayment.amountCents must be greater than 0' });
        }

        initialPaymentCents = parsed;
      }

      initialPaymentNote = normalizeOptionalString(initialPayment.note, { maxLength: 500 });
    }

    const layawayId = await db.transaction(async (tx) => {
      const [orderRow] = await tx
        .select({
          id: orders.id,
          branchId: orders.branchId,
          customerId: orders.customerId,
          totalCents: orders.totalCents,
          status: orders.status,
        })
        .from(orders)
        .where(eq(orders.id, numericOrderId))
        .limit(1);

      if (!orderRow) {
        throw new HttpError(404, 'Order not found');
      }

      if (orderRow.customerId == null) {
        throw new HttpError(400, 'Order must be linked to a customer before starting a layaway');
      }

      const [existingLayaway] = await tx
        .select({ id: layaways.id })
        .from(layaways)
        .where(eq(layaways.orderId, numericOrderId))
        .limit(1);

      if (existingLayaway) {
        throw new HttpError(409, 'Layaway already exists for this order');
      }

      await reserveLayawayInventory(tx, { orderId: numericOrderId, branchId: orderRow.branchId });

      const orderTotal = Number(orderRow.totalCents ?? 0);

      if (initialPaymentCents > orderTotal) {
        throw new HttpError(400, 'Initial payment cannot exceed order total');
      }

      await tx.insert(layaways).values({
        branchId: orderRow.branchId,
        customerId: orderRow.customerId,
        orderId: numericOrderId,
        totalCents: orderRow.totalCents,
        paidCents: 0,
        dueDate: dueDateValue,
        status: 'active',
      });

      const [layawayRow] = await tx
        .select({ id: layaways.id })
        .from(layaways)
        .where(eq(layaways.orderId, numericOrderId))
        .orderBy(desc(layaways.id))
        .limit(1);

      if (!layawayRow) {
        throw new Error('FAILED_TO_CREATE_LAYAWAY');
      }

      if (initialPaymentCents > 0) {
        await tx.insert(layawayPayments).values({
          layawayId: layawayRow.id,
          amountCents: initialPaymentCents,
          method: initialPaymentMethod,
          note: initialPaymentNote,
        });

        await tx
          .update(layaways)
          .set({ paidCents: sql`${layaways.paidCents} + ${initialPaymentCents}` })
          .where(eq(layaways.id, layawayRow.id));
      }

      await tx
        .update(orders)
        .set({ status: orderRow.status === 'completed' ? orderRow.status : 'pending' })
        .where(eq(orders.id, numericOrderId));

      return layawayRow.id;
    });

    const detail = await getLayawayDetail(layawayId);
    res.status(201).json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_LAYAWAY') {
      return res.status(500).json({ error: 'Unable to create layaway' });
    }

    next(error);
  }
});

app.get('/api/layaways/:id', async (req, res, next) => {
  try {
    const layawayId = Number(req.params.id);

    if (!Number.isInteger(layawayId) || layawayId <= 0) {
      return res.status(400).json({ error: 'Layaway id must be a positive integer' });
    }

    const detail = await getLayawayDetail(layawayId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/layaways/:id/pay', async (req, res, next) => {
  try {
    const layawayId = Number(req.params.id);
    const { amountCents, method, note = null } = req.body ?? {};

    if (!Number.isInteger(layawayId) || layawayId <= 0) {
      return res.status(400).json({ error: 'Layaway id must be a positive integer' });
    }

    const normalizedAmount = parseAmount(amountCents);

    if (normalizedAmount === null) {
      return res.status(400).json({ error: 'amountCents must be greater than 0' });
    }

    const normalizedMethod = typeof method === 'string' ? method.toLowerCase() : '';

    if (!allowedLayawayPaymentMethods.has(normalizedMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    const normalizedNote = normalizeOptionalString(note, { maxLength: 500 });

    await db.transaction(async (tx) => {
      const [layawayRow] = await tx
        .select({ id: layaways.id, status: layaways.status })
        .from(layaways)
        .where(eq(layaways.id, layawayId))
        .limit(1);

      if (!layawayRow) {
        throw new HttpError(404, 'Layaway not found');
      }

      if (layawayRow.status !== 'active') {
        throw new HttpError(409, 'Only active layaways can receive payments');
      }

      await tx.insert(layawayPayments).values({
        layawayId,
        amountCents: normalizedAmount,
        method: normalizedMethod,
        note: normalizedNote,
      });

      await tx
        .update(layaways)
        .set({ paidCents: sql`${layaways.paidCents} + ${normalizedAmount}` })
        .where(eq(layaways.id, layawayId));
    });

    const detail = await getLayawayDetail(layawayId);
    res.status(201).json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/layaways/:id/cancel', async (req, res, next) => {
  try {
    const layawayId = Number(req.params.id);

    if (!Number.isInteger(layawayId) || layawayId <= 0) {
      return res.status(400).json({ error: 'Layaway id must be a positive integer' });
    }

    await db.transaction(async (tx) => {
      const [layawayRow] = await tx
        .select({ id: layaways.id, status: layaways.status, orderId: layaways.orderId })
        .from(layaways)
        .where(eq(layaways.id, layawayId))
        .limit(1);

      if (!layawayRow) {
        throw new HttpError(404, 'Layaway not found');
      }

      if (layawayRow.status !== 'active') {
        throw new HttpError(409, 'Only active layaways can be cancelled');
      }

      await releaseLayawayInventory(tx, layawayRow.orderId);

      await tx
        .update(layaways)
        .set({ status: 'cancelled', updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(layaways.id, layawayId));

      await tx
        .update(orders)
        .set({ status: 'cancelled' })
        .where(eq(orders.id, layawayRow.orderId));
    });

    const detail = await getLayawayDetail(layawayId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/layaways/:id/complete', async (req, res, next) => {
  try {
    const layawayId = Number(req.params.id);

    if (!Number.isInteger(layawayId) || layawayId <= 0) {
      return res.status(400).json({ error: 'Layaway id must be a positive integer' });
    }

    await db.transaction(async (tx) => {
      const [layawayRow] = await tx
        .select({
          id: layaways.id,
          status: layaways.status,
          orderId: layaways.orderId,
          totalCents: layaways.totalCents,
          paidCents: layaways.paidCents,
        })
        .from(layaways)
        .where(eq(layaways.id, layawayId))
        .limit(1);

      if (!layawayRow) {
        throw new HttpError(404, 'Layaway not found');
      }

      if (layawayRow.status !== 'active') {
        throw new HttpError(409, 'Only active layaways can be completed');
      }

      const total = Number(layawayRow.totalCents ?? 0);
      const paid = Number(layawayRow.paidCents ?? 0);

      if (paid < total) {
        throw new HttpError(409, 'Outstanding balance must be paid before completion');
      }

      await fulfillLayawayInventory(tx, layawayId, layawayRow.orderId);

      await tx
        .update(layaways)
        .set({ status: 'completed', updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(layaways.id, layawayId));

      await tx
        .update(orders)
        .set({ status: 'completed' })
        .where(eq(orders.id, layawayRow.orderId));
    });

    const detail = await getLayawayDetail(layawayId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/layaways/:id/pawn', async (req, res, next) => {
  try {
    const layawayId = Number(req.params.id);
    const {
      ticketNumber,
      interestModelId,
      dueDate,
      comments = null,
      collateralDescription = null,
    } = req.body ?? {};

    if (!Number.isInteger(layawayId) || layawayId <= 0) {
      return res.status(400).json({ error: 'Layaway id must be a positive integer' });
    }

    if (!ticketNumber || typeof ticketNumber !== 'string' || !ticketNumber.trim()) {
      return res.status(400).json({ error: 'ticketNumber is required' });
    }

    if (interestModelId == null) {
      return res.status(400).json({ error: 'interestModelId is required' });
    }

    if (!dueDate) {
      return res.status(400).json({ error: 'dueDate is required' });
    }

    const pawnDueDate = new Date(dueDate);

    if (Number.isNaN(pawnDueDate.getTime())) {
      return res.status(400).json({ error: 'dueDate must be a valid date' });
    }

    const normalizedComments = normalizeOptionalString(comments, { maxLength: 2000 });
    const normalizedCollateralDescription = normalizeOptionalString(collateralDescription, { maxLength: 1000 });

    await db.transaction(async (tx) => {
      const [layawayRow] = await tx
        .select({
          id: layaways.id,
          status: layaways.status,
          branchId: layaways.branchId,
          customerId: layaways.customerId,
          orderId: layaways.orderId,
          totalCents: layaways.totalCents,
          paidCents: layaways.paidCents,
          dueDate: layaways.dueDate,
        })
        .from(layaways)
        .where(eq(layaways.id, layawayId))
        .limit(1);

      if (!layawayRow) {
        throw new HttpError(404, 'Layaway not found');
      }

      if (layawayRow.status !== 'active') {
        throw new HttpError(409, 'Only active layaways can be converted to a pawn loan');
      }

      const layawayDueDate = layawayRow.dueDate instanceof Date
        ? layawayRow.dueDate
        : layawayRow.dueDate
        ? new Date(layawayRow.dueDate)
        : null;

      if (!layawayDueDate || Number.isNaN(layawayDueDate.getTime()) || layawayDueDate.getTime() > Date.now()) {
        throw new HttpError(400, 'Layaway must be overdue before converting to a pawn loan');
      }

      const outstanding = Math.max(Number(layawayRow.totalCents ?? 0) - Number(layawayRow.paidCents ?? 0), 0);

      if (outstanding <= 0) {
        throw new HttpError(409, 'Layaway has no outstanding balance to convert');
      }

      const orderItemsForCollateral = await tx
        .select({
          qty: orderItems.qty,
          productName: productCodes.name,
          productCode: productCodes.code,
        })
        .from(orderItems)
        .leftJoin(productCodeVersions, eq(productCodeVersions.id, orderItems.productCodeVersionId))
        .leftJoin(productCodes, eq(productCodes.id, productCodeVersions.productCodeId))
        .where(eq(orderItems.orderId, layawayRow.orderId));

      const collateralEntries = orderItemsForCollateral.map((item) => {
        const qty = Number(item.qty ?? 0);
        const descriptionParts = [qty > 0 ? `${qty}x` : null, item.productName ?? null];

        if (item.productCode) {
          descriptionParts.push(`(${item.productCode})`);
        }

        return {
          description: descriptionParts.filter(Boolean).join(' '),
          estimatedValueCents: Math.floor(outstanding / Math.max(orderItemsForCollateral.length, 1)),
          photoPath: null,
        };
      });

      if (normalizedCollateralDescription) {
        collateralEntries.unshift({
          description: normalizedCollateralDescription,
          estimatedValueCents: outstanding,
          photoPath: null,
        });
      }

      if (collateralEntries.length === 0) {
        collateralEntries.push({
          description: 'Converted from layaway balance',
          estimatedValueCents: outstanding,
          photoPath: null,
        });
      }

      const prepared = await prepareLoanCreationInput(
        tx,
        {
          branchId: layawayRow.branchId,
          customerId: layawayRow.customerId,
          ticketNumber: ticketNumber.trim(),
          interestModelId,
          principalCents: outstanding,
          comments: normalizedComments,
          schedule: [
            {
              dueOn: pawnDueDate.toISOString().slice(0, 10),
              interestCents: 0,
              feeCents: 0,
            },
          ],
          collateral: collateralEntries,
          idImagePaths: [],
        },
        { allowZeroInterest: true },
      );

      const loan = await createLoanWithPreparedPayload(tx, prepared);

      await releaseLayawayInventory(tx, layawayRow.orderId);

      await tx
        .update(layaways)
        .set({
          status: 'pawned',
          pawnLoanId: loan.loan.id,
          pawnedAt: new Date(),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(layaways.id, layawayId));

      await tx
        .update(orders)
        .set({ status: 'cancelled' })
        .where(eq(orders.id, layawayRow.orderId));
    });

    const detail = await getLayawayDetail(layawayId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

// ========= CRM & MARKETING =========
const customerSelection = {
  id: customers.id,
  branchId: customers.branchId,
  firstName: customers.firstName,
  lastName: customers.lastName,
  email: customers.email,
  phone: customers.phone,
  address: customers.address,
  isBlacklisted: customers.isBlacklisted,
  loyaltyPoints: customers.loyaltyPoints,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
};

const customerNoteSelection = {
  id: customerNotes.id,
  customerId: customerNotes.customerId,
  authorId: customerNotes.authorId,
  note: customerNotes.note,
  createdAt: customerNotes.createdAt,
};

const loyaltyLedgerSelection = {
  id: loyaltyLedger.id,
  customerId: loyaltyLedger.customerId,
  pointsDelta: loyaltyLedger.pointsDelta,
  reason: loyaltyLedger.reason,
  refTable: loyaltyLedger.refTable,
  refId: loyaltyLedger.refId,
  createdAt: loyaltyLedger.createdAt,
};

function serializeCustomer(row) {
  return {
    id: Number(row.id),
    branchId: Number(row.branchId),
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    address: row.address,
    isBlacklisted: !!row.isBlacklisted,
    loyaltyPoints: Number(row.loyaltyPoints ?? 0),
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

function buildCustomerWhereClause({ search, branchId, blacklisted }) {
  const clauses = [];

  if (branchId != null) {
    clauses.push(eq(customers.branchId, branchId));
  }

  if (typeof blacklisted === 'boolean') {
    clauses.push(eq(customers.isBlacklisted, blacklisted));
  }

  if (search) {
    const likeValue = `%${search}%`;
    clauses.push(
      or(
        like(customers.firstName, likeValue),
        like(customers.lastName, likeValue),
        like(customers.email, likeValue),
        like(customers.phone, likeValue),
      ),
    );
  }

  if (clauses.length === 0) {
    return undefined;
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return and(...clauses);
}

async function loadCustomerDetail(customerId) {
  const [customerRow] = await db
    .select(customerSelection)
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customerRow) {
    return null;
  }

  const customer = serializeCustomer(customerRow);

  const [images, notes, loyaltyEntries] = await Promise.all([
    db
      .select({
        id: idImages.id,
        storagePath: idImages.storagePath,
        createdAt: idImages.createdAt,
      })
      .from(idImages)
      .where(eq(idImages.customerId, customerId))
      .orderBy(desc(idImages.createdAt)),
    db
      .select(customerNoteSelection)
      .from(customerNotes)
      .where(eq(customerNotes.customerId, customerId))
      .orderBy(desc(customerNotes.createdAt))
      .limit(50),
    db
      .select(loyaltyLedgerSelection)
      .from(loyaltyLedger)
      .where(eq(loyaltyLedger.customerId, customerId))
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(100),
  ]);

  const transactions = await collectCustomerTransactions(customerId);
  const messages = await collectCustomerMessages(customerId);

  return {
    customer,
    idImages: images.map((image) => ({
      id: Number(image.id),
      storagePath: image.storagePath,
      createdAt: image.createdAt?.toISOString?.() ?? image.createdAt,
    })),
    notes: notes.map((note) => ({
      id: Number(note.id),
      customerId: Number(note.customerId),
      authorId: Number(note.authorId),
      note: note.note,
      createdAt: note.createdAt?.toISOString?.() ?? note.createdAt,
    })),
    loyaltyLedger: {
      points: customer.loyaltyPoints,
      entries: loyaltyEntries.map((entry) => ({
        id: Number(entry.id),
        customerId: Number(entry.customerId),
        pointsDelta: Number(entry.pointsDelta),
        reason: entry.reason,
        refTable: entry.refTable,
        refId: entry.refId == null ? null : Number(entry.refId),
        createdAt: entry.createdAt?.toISOString?.() ?? entry.createdAt,
      })),
    },
    messages,
    transactions,
  };
}

async function collectCustomerTransactions(customerId) {
  const [orderRows, loanRows, layawayRows, repairRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        totalCents: orders.totalCents,
        status: orders.status,
        invoiceNo: orders.invoiceNo,
      })
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(25),
    db
      .select({
        id: loans.id,
        createdAt: loans.createdAt,
        status: loans.status,
        ticketNumber: loans.ticketNumber,
        principalCents: loans.principalCents,
      })
      .from(loans)
      .where(eq(loans.customerId, customerId))
      .orderBy(desc(loans.createdAt))
      .limit(25),
    db
      .select({
        id: layaways.id,
        createdAt: layaways.createdAt,
        status: layaways.status,
        totalCents: layaways.totalCents,
        dueDate: layaways.dueDate,
      })
      .from(layaways)
      .where(eq(layaways.customerId, customerId))
      .orderBy(desc(layaways.createdAt))
      .limit(25),
    db
      .select({
        id: repairs.id,
        createdAt: repairs.createdAt,
        status: repairs.status,
        jobNumber: repairs.jobNumber,
      })
      .from(repairs)
      .where(eq(repairs.customerId, customerId))
      .orderBy(desc(repairs.createdAt))
      .limit(25),
  ]);

  const combined = [];

  for (const row of orderRows) {
    combined.push({
      type: 'order',
      id: Number(row.id),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      amountCents: row.totalCents == null ? null : Number(row.totalCents),
      status: row.status,
      reference: row.invoiceNo,
    });
  }

  for (const row of loanRows) {
    combined.push({
      type: 'loan',
      id: Number(row.id),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      amountCents: row.principalCents == null ? null : Number(row.principalCents),
      status: row.status,
      reference: row.ticketNumber,
    });
  }

  for (const row of layawayRows) {
    combined.push({
      type: 'layaway',
      id: Number(row.id),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      amountCents: row.totalCents == null ? null : Number(row.totalCents),
      status: row.status,
      reference: row.dueDate instanceof Date ? row.dueDate.toISOString() : row.dueDate,
    });
  }

  for (const row of repairRows) {
    combined.push({
      type: 'repair',
      id: Number(row.id),
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      amountCents: null,
      status: row.status,
      reference: row.jobNumber,
    });
  }

  return combined
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return Number.isNaN(bTime) - Number.isNaN(aTime) || bTime - aTime;
    })
    .slice(0, 50);
}

async function collectCustomerMessages(customerId) {
  const rows = await db
    .select({
      id: notificationMessages.id,
      channel: notificationMessages.channel,
      recipient: notificationMessages.recipient,
      message: notificationMessages.message,
      status: notificationMessages.status,
      error: notificationMessages.error,
      sentAt: notificationMessages.sentAt,
      createdAt: notificationMessages.createdAt,
    })
    .from(notificationMessages)
    .where(eq(notificationMessages.customerId, customerId))
    .orderBy(desc(notificationMessages.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: Number(row.id),
    channel: row.channel,
    recipient: row.recipient,
    message: row.message,
    status: row.status,
    error: row.error,
    sentAt: row.sentAt?.toISOString?.() ?? row.sentAt,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  }));
}

function parseActorId(req) {
  const header = req.headers['x-user-id'];
  if (!header) {
    return null;
  }

  const value = Number(header);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function appendAuditLog(executor, { actorId, action, resourceType, resourceId = null, payload = null }) {
  await executor.insert(auditLogs).values({
    actorId: actorId ?? null,
    action,
    resourceType,
    resourceId,
    payload,
  });
}

function auditTrail(action, resourceType, { payloadResolver = null, resourceResolver = null } = {}) {
  return (req, res, next) => {
    const actorId = parseActorId(req);
    const startedAt = Date.now();

    res.locals.auditContext = {
      actorId,
      action,
      resourceType,
      startedAt,
    };

    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        try {
          const payload = payloadResolver ? payloadResolver(req, res) : null;
          const resolvedResourceId = resourceResolver
            ? resourceResolver(req, res)
            : res.locals.auditResourceId ?? null;

          appendAuditLog(db, {
            actorId,
            action,
            resourceType,
            resourceId: resolvedResourceId,
            payload: payload ?? null,
          }).catch((error) => {
            console.error('Failed to record audit log', error);
          });
        } catch (error) {
          console.error('Failed to resolve audit payload', error);
        }
      }
    });

    next();
  };
}

function mapChannelRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    provider: row.provider,
    status: row.status,
    config: row.config ?? {},
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
  };
}

async function loadChannel(channelId, executor = db) {
  const [row] = await executor
    .select({
      id: ecomChannels.id,
      name: ecomChannels.name,
      provider: ecomChannels.provider,
      status: ecomChannels.status,
      config: ecomChannels.config,
      createdAt: ecomChannels.createdAt,
      updatedAt: ecomChannels.updatedAt,
    })
    .from(ecomChannels)
    .where(eq(ecomChannels.id, channelId))
    .limit(1);

  if (!row) {
    throw new HttpError(404, 'Channel not found');
  }

  return mapChannelRow(row);
}

async function appendChannelLog(executor, channelId, event, payload = null) {
  await executor.insert(ecomChannelLogs).values({
    channelId,
    event,
    payload,
  });
}

async function appendWebhookLog(executor, channelId, event, payload = null) {
  const result = await executor.insert(ecomWebhookLogs).values({
    channelId,
    event,
    payload,
  });

  if (result && typeof result.insertId === 'number') {
    return Number(result.insertId);
  }

  return null;
}

function mapListing(row) {
  return {
    id: Number(row.id),
    productCodeId: row.productCodeId ? Number(row.productCodeId) : null,
    code: row.code ?? null,
    name: row.name ?? null,
    title: row.title,
    description: row.description ?? null,
    priceCents: row.priceCents == null ? null : Number(row.priceCents),
    status: row.status,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
  };
}

function mapOrder(row) {
  return {
    id: Number(row.id),
    channelId: Number(row.channelId),
    channelName: row.channelName ?? null,
    provider: row.provider ?? null,
    externalId: row.externalId,
    customerName: row.customerName,
    status: row.status,
    totalCents: Number(row.totalCents ?? 0),
    currency: row.currency ?? 'DOP',
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
    shippingAddress: row.shippingAddress ?? null,
  };
}

function mapReturn(row) {
  return {
    id: Number(row.id),
    orderId: Number(row.orderId),
    channelId: Number(row.channelId),
    channelName: row.channelName ?? null,
    externalOrderId: row.externalOrderId ?? null,
    status: row.status,
    reason: row.reason ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
  };
}

async function loadListingsByIds(listingIds, executor = db) {
  if (listingIds.length === 0) {
    return new Map();
  }

  const rows = await executor
    .select({
      id: ecomListings.id,
      productCodeId: ecomListings.productCodeId,
      title: ecomListings.title,
      description: ecomListings.description,
      priceCents: ecomListings.priceCents,
      status: ecomListings.status,
      createdAt: ecomListings.createdAt,
      updatedAt: ecomListings.updatedAt,
      code: productCodes.code,
      name: productCodes.name,
    })
    .from(ecomListings)
    .leftJoin(productCodes, eq(ecomListings.productCodeId, productCodes.id))
    .where(inArray(ecomListings.id, listingIds));

  if (rows.length !== listingIds.length) {
    const found = new Set(rows.map((row) => Number(row.id)));
    const missing = listingIds.filter((id) => !found.has(id));
    throw new HttpError(404, `Unknown listing ids: ${missing.join(', ')}`);
  }

  return new Map(rows.map((row) => [Number(row.id), mapListing(row)]));
}

async function loadOrderById(orderId, executor = db) {
  const [row] = await executor
    .select({
      id: ecomOrders.id,
      channelId: ecomOrders.channelId,
      externalId: ecomOrders.externalId,
      customerName: ecomOrders.customerName,
      status: ecomOrders.status,
      totalCents: ecomOrders.totalCents,
      currency: ecomOrders.currency,
      shippingAddress: ecomOrders.shippingAddress,
      createdAt: ecomOrders.createdAt,
      updatedAt: ecomOrders.updatedAt,
      channelName: ecomChannels.name,
      provider: ecomChannels.provider,
    })
    .from(ecomOrders)
    .leftJoin(ecomChannels, eq(ecomOrders.channelId, ecomChannels.id))
    .where(eq(ecomOrders.id, orderId))
    .limit(1);

  if (!row) {
    throw new HttpError(404, 'Order not found');
  }

  return mapOrder(row);
}

async function loadReturnById(returnId, executor = db) {
  const [row] = await executor
    .select({
      id: ecomReturns.id,
      orderId: ecomReturns.orderId,
      status: ecomReturns.status,
      reason: ecomReturns.reason,
      createdAt: ecomReturns.createdAt,
      updatedAt: ecomReturns.updatedAt,
      channelId: ecomOrders.channelId,
      externalOrderId: ecomOrders.externalId,
      channelName: ecomChannels.name,
    })
    .from(ecomReturns)
    .innerJoin(ecomOrders, eq(ecomReturns.orderId, ecomOrders.id))
    .leftJoin(ecomChannels, eq(ecomOrders.channelId, ecomChannels.id))
    .where(eq(ecomReturns.id, returnId))
    .limit(1);

  if (!row) {
    throw new HttpError(404, 'Return not found');
  }

  return mapReturn(row);
}

async function ensureChannelIds(channelIds, executor = db) {
  if (channelIds.length === 0) {
    return [];
  }

  const rows = await executor
    .select({ id: ecomChannels.id })
    .from(ecomChannels)
    .where(inArray(ecomChannels.id, channelIds));

  if (rows.length !== channelIds.length) {
    const found = new Set(rows.map((row) => Number(row.id)));
    const missing = channelIds.filter((id) => !found.has(id));
    throw new HttpError(404, `Unknown channel ids: ${missing.join(', ')}`);
  }

  return rows.map((row) => Number(row.id));
}

function normalizeOrderItems(rawItems, orderIndex) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpError(400, `orders[${orderIndex}].items must be a non-empty array`);
  }

  return rawItems.map((item, itemIndex) => {
    if (item == null || typeof item !== 'object') {
      throw new HttpError(400, `orders[${orderIndex}].items[${itemIndex}] must be an object`);
    }

    const quantity = parsePositiveInteger(
      item.quantity ?? item.qty ?? item.quantityOrdered,
      `orders[${orderIndex}].items[${itemIndex}].quantity`
    );

    let priceCents;
    if (item.priceCents != null) {
      priceCents = parseNonNegativeInteger(
        item.priceCents,
        `orders[${orderIndex}].items[${itemIndex}].priceCents`
      );
    } else if (item.price != null || item.unitPrice != null) {
      priceCents = parseMoneyToCents(
        item.price ?? item.unitPrice,
        `orders[${orderIndex}].items[${itemIndex}].price`,
        { allowZero: true }
      );
    } else {
      priceCents = 0;
    }

    const listingId =
      item.listingId != null
        ? parsePositiveInteger(item.listingId, `orders[${orderIndex}].items[${itemIndex}].listingId`)
        : null;
    const productCodeId =
      item.productCodeId != null
        ? parsePositiveInteger(item.productCodeId, `orders[${orderIndex}].items[${itemIndex}].productCodeId`)
        : null;

    return {
      listingId,
      productCodeId,
      quantity,
      priceCents,
    };
  });
}

function normalizeOrdersPayload(rawOrders) {
  if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
    throw new HttpError(400, 'orders must be a non-empty array');
  }

  return rawOrders.map((order, index) => {
    if (order == null || typeof order !== 'object') {
      throw new HttpError(400, `orders[${index}] must be an object`);
    }

    const externalId = typeof order.externalId === 'string' ? order.externalId.trim() : '';
    if (!externalId) {
      throw new HttpError(400, `orders[${index}].externalId is required`);
    }

    const customerNameRaw =
      typeof order.customerName === 'string'
        ? order.customerName.trim()
        : typeof order.customer === 'string'
          ? order.customer.trim()
          : '';
    const customerName = customerNameRaw || 'Online';

    const statusRaw = typeof order.status === 'string' ? order.status.trim().toLowerCase() : 'pending';
    const status = allowedEcomOrderStatuses.has(statusRaw) ? statusRaw : 'pending';

    let totalCents;
    if (order.totalCents != null) {
      totalCents = parseNonNegativeInteger(order.totalCents, `orders[${index}].totalCents`);
    } else if (order.total != null || order.totalAmount != null) {
      totalCents = parseMoneyToCents(order.total ?? order.totalAmount, `orders[${index}].total`, {
        allowZero: true,
      });
    } else {
      throw new HttpError(400, `orders[${index}] must include total or totalCents`);
    }

    const currencyRaw = typeof order.currency === 'string' ? order.currency.trim().toUpperCase() : 'DOP';
    const currency = currencyRaw || 'DOP';

    const shippingAddress =
      order.shippingAddress && typeof order.shippingAddress === 'object'
        ? order.shippingAddress
        : order.shippingAddress && typeof order.shippingAddress === 'string'
          ? { raw: order.shippingAddress }
          : null;

    const createdAt = parseOptionalDate(order.createdAt ?? order.placedAt ?? null, `orders[${index}].createdAt`);
    const updatedAt = parseOptionalDate(
      order.updatedAt ?? order.modifiedAt ?? order.updated_at ?? order.modified_at ?? null,
      `orders[${index}].updatedAt`
    );

    return {
      externalId,
      customerName,
      status,
      totalCents,
      currency,
      shippingAddress,
      createdAt,
      updatedAt,
      items: normalizeOrderItems(order.items ?? [], index),
    };
  });
}

app.get('/api/ecom/channels', async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: ecomChannels.id,
        name: ecomChannels.name,
        provider: ecomChannels.provider,
        status: ecomChannels.status,
        config: ecomChannels.config,
        createdAt: ecomChannels.createdAt,
        updatedAt: ecomChannels.updatedAt,
      })
      .from(ecomChannels)
      .orderBy(asc(ecomChannels.name));

    const channels = rows.map(mapChannelRow);
    const channelIds = channels.map((channel) => channel.id);

    let recentLogs = [];

    if (channelIds.length > 0) {
      const logLimit = Math.min(50, channelIds.length * 5);
      const [actionLogs, webhookLogs] = await Promise.all([
        db
          .select({
            id: ecomChannelLogs.id,
            channelId: ecomChannelLogs.channelId,
            event: ecomChannelLogs.event,
            payload: ecomChannelLogs.payload,
            createdAt: ecomChannelLogs.createdAt,
          })
          .from(ecomChannelLogs)
          .where(inArray(ecomChannelLogs.channelId, channelIds))
          .orderBy(desc(ecomChannelLogs.createdAt))
          .limit(logLimit),
        db
          .select({
            id: ecomWebhookLogs.id,
            channelId: ecomWebhookLogs.channelId,
            event: ecomWebhookLogs.event,
            payload: ecomWebhookLogs.payload,
            receivedAt: ecomWebhookLogs.receivedAt,
          })
          .from(ecomWebhookLogs)
          .where(inArray(ecomWebhookLogs.channelId, channelIds))
          .orderBy(desc(ecomWebhookLogs.receivedAt))
          .limit(logLimit),
      ]);

      const combinedLogs = [
        ...actionLogs.map((row) => ({
          id: Number(row.id),
          channelId: Number(row.channelId),
          event: row.event,
          payload: row.payload ?? null,
          createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? null,
          source: 'system',
        })),
        ...webhookLogs.map((row) => ({
          id: Number(row.id),
          channelId: Number(row.channelId),
          event: row.event,
          payload: row.payload ?? null,
          createdAt: row.receivedAt?.toISOString?.() ?? row.receivedAt ?? null,
          source: 'webhook',
        })),
      ];

      combinedLogs.sort((a, b) => {
        const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return right - left;
      });

      recentLogs = combinedLogs.slice(0, logLimit);
    }

    res.json({ channels, recentLogs });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecom/channels/:id/logs', async (req, res, next) => {
  try {
    const channelId = parsePositiveInteger(req.params.id, 'channelId');
    const limit = Math.min(Math.max(Number(req.query.limit ?? 25) || 25, 1), 100);

    const [actionLogs, webhookLogs] = await Promise.all([
      db
        .select({
          id: ecomChannelLogs.id,
          event: ecomChannelLogs.event,
          payload: ecomChannelLogs.payload,
          createdAt: ecomChannelLogs.createdAt,
        })
        .from(ecomChannelLogs)
        .where(eq(ecomChannelLogs.channelId, channelId))
        .orderBy(desc(ecomChannelLogs.createdAt))
        .limit(limit),
      db
        .select({
          id: ecomWebhookLogs.id,
          event: ecomWebhookLogs.event,
          payload: ecomWebhookLogs.payload,
          receivedAt: ecomWebhookLogs.receivedAt,
        })
        .from(ecomWebhookLogs)
        .where(eq(ecomWebhookLogs.channelId, channelId))
        .orderBy(desc(ecomWebhookLogs.receivedAt))
        .limit(limit),
    ]);

    const combined = [
      ...actionLogs.map((row) => ({
        id: Number(row.id),
        event: row.event,
        payload: row.payload ?? null,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? null,
        source: 'system',
      })),
      ...webhookLogs.map((row) => ({
        id: Number(row.id),
        event: row.event,
        payload: row.payload ?? null,
        createdAt: row.receivedAt?.toISOString?.() ?? row.receivedAt ?? null,
        source: 'webhook',
      })),
    ];

    combined.sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });

    res.json({
      channel: await loadChannel(channelId),
      logs: combined.slice(0, limit),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecom/channels', async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const providerRaw = typeof req.body?.provider === 'string' ? req.body.provider.trim().toLowerCase() : '';
    const shouldTest = req.body?.testConnection === undefined ? true : Boolean(req.body.testConnection);

    if (!name) {
      throw new HttpError(400, 'name is required');
    }

    if (!allowedEcomProviders.has(providerRaw)) {
      throw new HttpError(400, 'provider is invalid');
    }

    const config = normalizeEcomConfig(providerRaw, req.body?.config ?? {});
    const actorId = parseActorId(req);

    const channel = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ existingCount: sql`COUNT(*)` })
        .from(ecomChannels)
        .where(and(eq(ecomChannels.provider, providerRaw), like(ecomChannels.name, name)))
        .limit(1);

      if (existing?.[0]?.existingCount > 0) {
        throw new HttpError(409, 'A channel with this name already exists for the provider');
      }

      let status = 'disconnected';
      let connectionTestResult = null;

      if (shouldTest) {
        connectionTestResult = evaluateChannelConnection(providerRaw, config);
        status = connectionTestResult.ok ? 'connected' : 'error';
      }

      await tx.insert(ecomChannels).values({
        name,
        provider: providerRaw,
        status,
        config,
      });

      const [row] = await tx
        .select({
          id: ecomChannels.id,
          name: ecomChannels.name,
          provider: ecomChannels.provider,
          status: ecomChannels.status,
          config: ecomChannels.config,
          createdAt: ecomChannels.createdAt,
          updatedAt: ecomChannels.updatedAt,
        })
        .from(ecomChannels)
        .orderBy(desc(ecomChannels.id))
        .limit(1);

      if (!row) {
        throw new Error('FAILED_TO_CREATE_ECOM_CHANNEL');
      }

      if (shouldTest && connectionTestResult) {
        await appendChannelLog(tx, Number(row.id), 'connection_test', {
          success: connectionTestResult.ok,
          message: connectionTestResult.message,
        });
      }

      await appendAuditLog(tx, {
        actorId,
        action: 'ecom.channel.create',
        resourceType: 'ecom_channel',
        resourceId: Number(row.id),
        payload: { provider: providerRaw, status: row.status },
      });

      return { row, connectionTestResult };
    });

    res.status(201).json({
      channel: mapChannelRow(channel.row),
      connectionTest: channel.connectionTestResult,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_ECOM_CHANNEL') {
      return res.status(500).json({ error: 'Unable to create channel' });
    }

    next(error);
  }
});

app.post('/api/ecom/channels/:id/test', async (req, res, next) => {
  try {
    const channelId = parsePositiveInteger(req.params.id, 'channelId');
    const actorId = parseActorId(req);
    const existing = await loadChannel(channelId);
    const connectionTest = evaluateChannelConnection(existing.provider, existing.config);

    await db.transaction(async (tx) => {
      await tx
        .update(ecomChannels)
        .set({
          status: connectionTest.ok ? 'connected' : 'error',
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(ecomChannels.id, channelId));

      await appendChannelLog(tx, channelId, 'connection_test', {
        success: connectionTest.ok,
        message: connectionTest.message,
      });

      await appendAuditLog(tx, {
        actorId,
        action: 'ecom.channel.test',
        resourceType: 'ecom_channel',
        resourceId: channelId,
        payload: { status: connectionTest.ok ? 'connected' : 'error' },
      });
    });

    const refreshed = await loadChannel(channelId);

    res.json({ channel: refreshed, connectionTest });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecom/channels/:id/webhooks', async (req, res, next) => {
  try {
    const channelId = parsePositiveInteger(req.params.id, 'channelId');
    const event = typeof req.body?.event === 'string' ? req.body.event.trim() : '';

    if (!event) {
      throw new HttpError(400, 'event is required');
    }

    const payload = req.body?.payload ?? null;

    await loadChannel(channelId);

    let loggedId = null;

    await db.transaction(async (tx) => {
      loggedId = await appendWebhookLog(tx, channelId, event, payload);
    });

    res.status(202).json({ status: 'logged', channelId, event, id: loggedId });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecom/channels/:id/sync', async (req, res, next) => {
  try {
    const channelId = parsePositiveInteger(req.params.id, 'channelId');
    const actorId = parseActorId(req);

    const [listingCount] = await db
      .select({ count: sql`COUNT(*)` })
      .from(ecomListingChannels)
      .where(eq(ecomListingChannels.channelId, channelId));

    const [orderCount] = await db
      .select({ count: sql`COUNT(*)` })
      .from(ecomOrders)
      .where(eq(ecomOrders.channelId, channelId));

    const syncSummary = {
      listingsLinked: Number(listingCount?.count ?? 0),
      ordersIngested: Number(orderCount?.count ?? 0),
      startedAt: new Date().toISOString(),
    };

    await loadChannel(channelId);

    await db.transaction(async (tx) => {
      await tx
        .update(ecomChannels)
        .set({ status: 'connected', updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(ecomChannels.id, channelId));

      await appendChannelLog(tx, channelId, 'full_sync', {
        listingsLinked: syncSummary.listingsLinked,
        ordersIngested: syncSummary.ordersIngested,
      });

      await appendAuditLog(tx, {
        actorId,
        action: 'ecom.channel.sync',
        resourceType: 'ecom_channel',
        resourceId: channelId,
        payload: syncSummary,
      });
    });

    const refreshed = await loadChannel(channelId);

    res.json({ channel: refreshed, sync: syncSummary });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecom/listings', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
    const channelParam = req.query.channelId ?? req.query.channel_id ?? null;
    const channelId = channelParam == null || channelParam === '' ? null : parsePositiveInteger(channelParam, 'channelId');
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? req.query.limit ?? 25) || 25, 1), 100);

    const filters = [];

    if (search) {
      const likePattern = `%${search}%`;
      filters.push(
        or(
          like(ecomListings.title, likePattern),
          like(ecomListings.description, likePattern),
          like(productCodes.name, likePattern),
          like(productCodes.code, likePattern)
        )
      );
    }

    if (statusParam && statusParam !== 'all') {
      if (!allowedEcomListingStatuses.has(statusParam)) {
        throw new HttpError(400, 'status filter is invalid');
      }

      filters.push(eq(ecomListings.status, statusParam));
    }

    let channelFilterIds = [];
    if (channelId) {
      const mappingRows = await db
        .select({ listingId: ecomListingChannels.listingId })
        .from(ecomListingChannels)
        .where(eq(ecomListingChannels.channelId, channelId));

      channelFilterIds = mappingRows.map((row) => Number(row.listingId));

      if (channelFilterIds.length === 0) {
        const [channelRows, summaryRows] = await Promise.all([
          db
            .select({ id: ecomChannels.id, name: ecomChannels.name, provider: ecomChannels.provider, status: ecomChannels.status })
            .from(ecomChannels)
            .orderBy(asc(ecomChannels.name)),
          db
            .select({ status: ecomListings.status, count: sql`COUNT(*)` })
            .from(ecomListings)
            .groupBy(ecomListings.status),
        ]);

        const summary = summaryRows.reduce(
          (acc, row) => {
            const count = Number(row.count ?? 0);
            acc.total += count;
            acc.byStatus[row.status] = count;
            return acc;
          },
          { total: 0, byStatus: {} }
        );

        return res.json({
          listings: [],
          pagination: { page, pageSize, hasMore: false, nextPage: null },
          summary,
          metadata: {
            channels: channelRows.map((row) => ({
              id: Number(row.id),
              name: row.name,
              provider: row.provider,
              status: row.status,
            })),
          },
          filtersApplied: { search, status: statusParam, channelId },
          warnings: { channelHasNoListings: true },
        });
      }

      filters.push(inArray(ecomListings.id, channelFilterIds));
    }

    let query = db
      .select({
        id: ecomListings.id,
        productCodeId: ecomListings.productCodeId,
        title: ecomListings.title,
        description: ecomListings.description,
        priceCents: ecomListings.priceCents,
        status: ecomListings.status,
        createdAt: ecomListings.createdAt,
        updatedAt: ecomListings.updatedAt,
        code: productCodes.code,
        name: productCodes.name,
      })
      .from(ecomListings)
      .leftJoin(productCodes, eq(ecomListings.productCodeId, productCodes.id));

    if (filters.length > 0) {
      query = query.where(and(...filters));
    }

    const rows = await query
      .orderBy(desc(ecomListings.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const listingIds = rows.map((row) => Number(row.id));

    let listingChannels = new Map();
    if (listingIds.length > 0) {
      const channelRows = await db
        .select({
          listingId: ecomListingChannels.listingId,
          channelId: ecomListingChannels.channelId,
          status: ecomListingChannels.status,
          lastSyncedAt: ecomListingChannels.lastSyncedAt,
          channelName: ecomChannels.name,
          provider: ecomChannels.provider,
        })
        .from(ecomListingChannels)
        .innerJoin(ecomChannels, eq(ecomListingChannels.channelId, ecomChannels.id))
        .where(inArray(ecomListingChannels.listingId, listingIds));

      listingChannels = new Map();

      for (const row of channelRows) {
        const id = Number(row.listingId);
        const entry = listingChannels.get(id) ?? [];
        entry.push({
          channelId: Number(row.channelId),
          channelName: row.channelName,
          provider: row.provider,
          status: row.status,
          lastSyncedAt: row.lastSyncedAt?.toISOString?.() ?? row.lastSyncedAt ?? null,
        });
        listingChannels.set(id, entry);
      }
    }

    const [channelRows, summaryRows] = await Promise.all([
      db
        .select({ id: ecomChannels.id, name: ecomChannels.name, provider: ecomChannels.provider, status: ecomChannels.status })
        .from(ecomChannels)
        .orderBy(asc(ecomChannels.name)),
      db
        .select({ status: ecomListings.status, count: sql`COUNT(*)` })
        .from(ecomListings)
        .groupBy(ecomListings.status),
    ]);

    const summary = summaryRows.reduce(
      (acc, row) => {
        const count = Number(row.count ?? 0);
        acc.total += count;
        acc.byStatus[row.status] = count;
        return acc;
      },
      { total: 0, byStatus: {} }
    );

    res.json({
      listings: rows.map((row) => {
        const listing = mapListing(row);
        return { ...listing, channels: listingChannels.get(listing.id) ?? [] };
      }),
      pagination: {
        page,
        pageSize,
        hasMore: rows.length === pageSize,
        nextPage: rows.length === pageSize ? page + 1 : null,
      },
      summary,
      metadata: {
        channels: channelRows.map((row) => ({
          id: Number(row.id),
          name: row.name,
          provider: row.provider,
          status: row.status,
        })),
      },
      filtersApplied: { search, status: statusParam, channelId },
      warnings: channelFilterIds.length > 0 && listingIds.length === 0 ? { noResults: true } : undefined,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecom/listings/bulk', async (req, res, next) => {
  try {
    const action = typeof req.body?.action === 'string' ? req.body.action.trim().toLowerCase() : '';
    const listingIds = parseIdArray(req.body?.listingIds ?? req.body?.listings ?? [], 'listingIds');
    const actorId = parseActorId(req);

    if (!['publish', 'unpublish', 'update', 'sync'].includes(action)) {
      throw new HttpError(400, 'action is invalid');
    }

    const result = await db.transaction(async (tx) => {
      await loadListingsByIds(listingIds, tx);

      if (action === 'publish' || action === 'unpublish') {
        const status = action === 'publish' ? 'active' : 'inactive';
        await tx
          .update(ecomListings)
          .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(inArray(ecomListings.id, listingIds));

        await appendAuditLog(tx, {
          actorId,
          action: `ecom.listings.${action}`,
          resourceType: 'ecom_listing',
          resourceId: listingIds.length === 1 ? listingIds[0] : null,
          payload: { listingIds, status },
        });

        return { status };
      }

      if (action === 'update') {
        const updates = {};
        if (typeof req.body?.title === 'string') {
          const trimmed = req.body.title.trim();
          if (!trimmed) {
            throw new HttpError(400, 'title cannot be empty');
          }
          updates.title = trimmed.slice(0, 240);
        }

        if (req.body?.description !== undefined) {
          updates.description =
            typeof req.body.description === 'string' ? req.body.description.slice(0, 4000) : null;
        }

        if (req.body?.priceCents != null || req.body?.price != null) {
          const priceCents =
            req.body.priceCents != null
              ? parseNonNegativeInteger(req.body.priceCents, 'priceCents')
              : parseMoneyToCents(req.body.price, 'price', { allowZero: true });
          updates.priceCents = priceCents;
        }

        if (req.body?.status) {
          const statusValue = String(req.body.status).trim().toLowerCase();
          if (!allowedEcomListingStatuses.has(statusValue)) {
            throw new HttpError(400, 'status is invalid');
          }
          updates.status = statusValue;
        }

        if (Object.keys(updates).length === 0) {
          throw new HttpError(400, 'No updatable fields provided');
        }

        updates.updatedAt = sql`CURRENT_TIMESTAMP`;

        await tx.update(ecomListings).set(updates).where(inArray(ecomListings.id, listingIds));

        await appendAuditLog(tx, {
          actorId,
          action: 'ecom.listings.update',
          resourceType: 'ecom_listing',
          resourceId: listingIds.length === 1 ? listingIds[0] : null,
          payload: { listingIds, updates },
        });

        return { status: updates.status ?? null };
      }

      // sync
      const channelIds = parseIdArray(req.body?.channelIds ?? req.body?.channels ?? [], 'channelIds');
      await ensureChannelIds(channelIds, tx);

      const existing = await tx
        .select({ listingId: ecomListingChannels.listingId, channelId: ecomListingChannels.channelId })
        .from(ecomListingChannels)
        .where(
          and(
            inArray(ecomListingChannels.listingId, listingIds),
            inArray(ecomListingChannels.channelId, channelIds)
          )
        );

      const existingSet = new Set(existing.map((row) => `${row.listingId}:${row.channelId}`));
      const inserts = [];

      for (const listingId of listingIds) {
        for (const channelId of channelIds) {
          const key = `${listingId}:${channelId}`;
          if (!existingSet.has(key)) {
            inserts.push({ listingId, channelId, status: 'pending' });
          }
        }
      }

      if (inserts.length > 0) {
        await tx.insert(ecomListingChannels).values(inserts);
      }

      await tx
        .update(ecomListingChannels)
        .set({ status: 'synced', lastSyncedAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            inArray(ecomListingChannels.listingId, listingIds),
            inArray(ecomListingChannels.channelId, channelIds)
          )
        );

      await tx
        .update(ecomListings)
        .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(inArray(ecomListings.id, listingIds));

      for (const channelId of channelIds) {
        await appendChannelLog(tx, channelId, 'listing_sync', {
          listingIds,
          syncedAt: new Date().toISOString(),
        });
      }

      await appendAuditLog(tx, {
        actorId,
        action: 'ecom.listings.sync',
        resourceType: 'ecom_listing',
        resourceId: listingIds.length === 1 ? listingIds[0] : null,
        payload: { listingIds, channelIds },
      });

      return { synced: true, channelIds };
    });

    res.json({ action, listingIds, result });
  } catch (error) {
    next(error);
  }
});

function normalizeSettingKey(key) {
  if (typeof key !== 'string') {
    throw new HttpError(400, 'Setting key must be a string');
  }

  const trimmed = key.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Setting key cannot be empty');
  }

  if (trimmed.length > 160) {
    throw new HttpError(400, 'Setting key exceeds allowed length');
  }

  return trimmed;
}

function isSensitiveKey(key) {
  return sensitiveKeyPattern.test(key);
}

function sanitizeTenderConfig(value) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'pos.tenders must be an array');
  }

  return value.map((entry, index) => {
    if (entry == null || typeof entry !== 'object') {
      throw new HttpError(400, `pos.tenders[${index}] must be an object`);
    }

    const code = typeof entry.code === 'string' ? entry.code.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const enabled = Boolean(entry.enabled);

    if (!code || !label) {
      throw new HttpError(400, `pos.tenders[${index}] must include code and label`);
    }

    return { code: code.slice(0, 32), label: label.slice(0, 80), enabled };
  });
}

function sanitizeDrawerConfig(value) {
  if (value == null || typeof value !== 'object') {
    throw new HttpError(400, 'pos.drawer must be an object');
  }

  const maxOverShortCents = parseNonNegativeInteger(
    value.maxOverShortCents ?? value.max_over_short_cents ?? 0,
    'pos.drawer.maxOverShortCents'
  );
  const requirePin = Boolean(value.requirePin ?? value.require_pin ?? false);
  const allowBlindOpen = Boolean(value.allowBlindOpen ?? value.allow_blind_open ?? false);

  return { maxOverShortCents, requirePin, allowBlindOpen };
}

function sanitizeReceiptConfig(value) {
  if (value == null || typeof value !== 'object') {
    throw new HttpError(400, 'pos.receipt must be an object');
  }

  const header = typeof value.header === 'string' ? value.header.slice(0, 400) : '';
  const footer = typeof value.footer === 'string' ? value.footer.slice(0, 400) : '';
  const showLogo = Boolean(value.showLogo ?? value.show_logo ?? true);

  return { header, footer, showLogo };
}

function sanitizeSettingValue(key, value) {
  switch (key) {
    case 'pos.tenders':
      return sanitizeTenderConfig(value);
    case 'pos.drawer':
      return sanitizeDrawerConfig(value);
    case 'pos.receipt':
      return sanitizeReceiptConfig(value);
    case 'system.activeBranchId':
      return parsePositiveInteger(value, 'system.activeBranchId');
    default:
      return value;
  }
}

async function loadActiveBranch(executor = db) {
  const [entry] = await loadSettingsEntries(
    { scope: 'global', branchId: null, userId: null },
    ['system.activeBranchId'],
    executor
  );

  if (entry?.value == null) {
    throw new HttpError(404, 'Configura una sucursal activa en ajustes');
  }

  let desiredBranchId;
  try {
    desiredBranchId = parsePositiveInteger(entry.value, 'system.activeBranchId');
  } catch (error) {
    throw new HttpError(400, 'La sucursal activa configurada es inválida');
  }

  const [branchRow] = await executor
    .select({
      id: branches.id,
      code: branches.code,
      name: branches.name,
    })
    .from(branches)
    .where(eq(branches.id, desiredBranchId))
    .limit(1);

  if (!branchRow) {
    throw new HttpError(404, 'La sucursal activa configurada ya no existe');
  }

  return {
    id: Number(branchRow.id),
    code: branchRow.code,
    name: branchRow.name,
  };
}

function maskSettingEntry(row) {
  const masked = isSensitiveKey(row.key);
  return {
    key: row.key,
    value: masked ? null : row.value,
    masked,
    scope: row.scope,
    branchId: row.branchId,
    userId: row.userId,
    updatedAt: row.updatedAt,
  };
}

function resolveScopeIdentifiers({ scope: rawScope, branchId: rawBranchId, userId: rawUserId }) {
  const scope = typeof rawScope === 'string' ? rawScope.trim().toLowerCase() : 'global';

  if (!allowedSettingScopes.has(scope)) {
    throw new HttpError(400, 'Invalid scope');
  }

  let branchId = null;
  let userId = null;

  if (scope === 'branch' || scope === 'user') {
    if (rawBranchId == null || String(rawBranchId).trim() === '') {
      throw new HttpError(400, 'branchId is required for branch or user scope');
    }

    branchId = parsePositiveInteger(rawBranchId, 'branchId');
  } else if (rawBranchId != null && rawBranchId !== '') {
    throw new HttpError(400, 'branchId only allowed for branch scope');
  }

  if (scope === 'user') {
    if (rawUserId == null || String(rawUserId).trim() === '') {
      throw new HttpError(400, 'userId is required for user scope');
    }

    userId = parsePositiveInteger(rawUserId, 'userId');
  } else if (rawUserId != null && rawUserId !== '') {
    throw new HttpError(400, 'userId only allowed for user scope');
  }

  return { scope, branchId, userId };
}

async function loadSettingValueRaw({ scope, branchId, userId }, key, executor = db) {
  const conditions = [eq(settings.scope, scope), eq(settings.k, key)];

  if (scope === 'branch' || scope === 'user') {
    conditions.push(eq(settings.branchId, branchId));
  } else {
    conditions.push(isNull(settings.branchId));
  }

  if (scope === 'user') {
    conditions.push(eq(settings.userId, userId));
  } else {
    conditions.push(isNull(settings.userId));
  }

  const [row] = await executor
    .select({ value: settings.v })
    .from(settings)
    .where(and(...conditions))
    .limit(1);

  return row?.value ?? null;
}

async function loadSettingsEntries({ scope, branchId, userId }, keys = null, executor = db) {
  const conditions = [eq(settings.scope, scope)];

  if (scope === 'branch' || scope === 'user') {
    conditions.push(eq(settings.branchId, branchId));
  } else {
    conditions.push(isNull(settings.branchId));
  }

  if (scope === 'user') {
    conditions.push(eq(settings.userId, userId));
  } else {
    conditions.push(isNull(settings.userId));
  }

  if (Array.isArray(keys) && keys.length > 0) {
    conditions.push(inArray(settings.k, keys));
  }

  const rows = await executor
    .select({
      key: settings.k,
      value: settings.v,
      scope: settings.scope,
      branchId: settings.branchId,
      userId: settings.userId,
      updatedAt: settings.updatedAt,
    })
    .from(settings)
    .where(and(...conditions))
    .orderBy(asc(settings.k));

  return rows.map((row) =>
    maskSettingEntry({
      key: row.key,
      value: row.value,
      scope: row.scope,
      branchId: row.branchId,
      userId: row.userId,
      updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
    })
  );
}

function validateProviderCredentials(provider, credentials) {
  const requirements = {
    sms: ['apiKey', 'apiSecret'],
    whatsapp: ['accountSid', 'authToken'],
    email: ['smtpHost', 'smtpUser', 'smtpPassword'],
  }[provider];

  if (!requirements) {
    throw new HttpError(400, 'Unsupported provider');
  }

  if (credentials == null || typeof credentials !== 'object') {
    throw new HttpError(400, 'credentials must be an object');
  }

  const missing = requirements.filter((field) => {
    const value = credentials[field];
    return typeof value !== 'string' || !value.trim();
  });

  if (missing.length > 0) {
    throw new HttpError(400, `Missing credentials: ${missing.join(', ')}`);
  }
}

app.get('/api/ecom/orders', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
    const channelParam = req.query.channelId ?? req.query.channel_id ?? null;
    const channelId = channelParam == null || channelParam === '' ? null : parsePositiveInteger(channelParam, 'channelId');
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? req.query.limit ?? 25) || 25, 1), 100);

    const filters = [];

    if (search) {
      const likePattern = `%${search}%`;
      filters.push(or(like(ecomOrders.externalId, likePattern), like(ecomOrders.customerName, likePattern)));
    }

    if (statusParam && statusParam !== 'all') {
      if (!allowedEcomOrderStatuses.has(statusParam)) {
        throw new HttpError(400, 'status filter is invalid');
      }
      filters.push(eq(ecomOrders.status, statusParam));
    }

    if (channelId) {
      filters.push(eq(ecomOrders.channelId, channelId));
    }

    let query = db
      .select({
        id: ecomOrders.id,
        channelId: ecomOrders.channelId,
        externalId: ecomOrders.externalId,
        customerName: ecomOrders.customerName,
        status: ecomOrders.status,
        totalCents: ecomOrders.totalCents,
        currency: ecomOrders.currency,
        shippingAddress: ecomOrders.shippingAddress,
        createdAt: ecomOrders.createdAt,
        updatedAt: ecomOrders.updatedAt,
        channelName: ecomChannels.name,
        provider: ecomChannels.provider,
      })
      .from(ecomOrders)
      .leftJoin(ecomChannels, eq(ecomOrders.channelId, ecomChannels.id));

    if (filters.length > 0) {
      query = query.where(and(...filters));
    }

    const rows = await query
      .orderBy(desc(ecomOrders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const orderIds = rows.map((row) => Number(row.id));
    const itemsByOrder = new Map();

    if (orderIds.length > 0) {
      const itemRows = await db
        .select({
          orderId: ecomOrderItems.orderId,
          listingId: ecomOrderItems.listingId,
          productCodeId: ecomOrderItems.productCodeId,
          quantity: ecomOrderItems.quantity,
          priceCents: ecomOrderItems.priceCents,
        })
        .from(ecomOrderItems)
        .where(inArray(ecomOrderItems.orderId, orderIds));

      for (const row of itemRows) {
        const id = Number(row.orderId);
        const items = itemsByOrder.get(id) ?? [];
        items.push({
          listingId: row.listingId == null ? null : Number(row.listingId),
          productCodeId: row.productCodeId == null ? null : Number(row.productCodeId),
          quantity: Number(row.quantity ?? 0),
          priceCents: Number(row.priceCents ?? 0),
        });
        itemsByOrder.set(id, items);
      }
    }

    const channels = await db
      .select({ id: ecomChannels.id, name: ecomChannels.name, provider: ecomChannels.provider, status: ecomChannels.status })
      .from(ecomChannels)
      .orderBy(asc(ecomChannels.name));

    res.json({
      orders: rows.map((row) => {
        const order = mapOrder(row);
        return { ...order, items: itemsByOrder.get(order.id) ?? [] };
      }),
      pagination: {
        page,
        pageSize,
        hasMore: rows.length === pageSize,
        nextPage: rows.length === pageSize ? page + 1 : null,
      },
      metadata: {
        channels: channels.map((row) => ({
          id: Number(row.id),
          name: row.name,
          provider: row.provider,
          status: row.status,
        })),
      },
      filtersApplied: { search, status: statusParam, channelId },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecom/orders/import', async (req, res, next) => {
  try {
    const channelId = parsePositiveInteger(req.body?.channelId ?? req.body?.channel_id, 'channelId');
    const actorId = parseActorId(req);
    const orders = normalizeOrdersPayload(req.body?.orders ?? []);

    await loadChannel(channelId);

    const importResult = await db.transaction(async (tx) => {
      let created = 0;
      let updated = 0;

      for (const order of orders) {
        const [existing] = await tx
          .select({ id: ecomOrders.id })
          .from(ecomOrders)
          .where(and(eq(ecomOrders.channelId, channelId), eq(ecomOrders.externalId, order.externalId)))
          .limit(1);

        let orderId;

        if (existing) {
          orderId = Number(existing.id);
          await tx
            .update(ecomOrders)
            .set({
              customerName: order.customerName,
              status: order.status,
              totalCents: order.totalCents,
              currency: order.currency,
              shippingAddress: order.shippingAddress,
              updatedAt: order.updatedAt ?? sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(ecomOrders.id, orderId));

          await tx.delete(ecomOrderItems).where(eq(ecomOrderItems.orderId, orderId));
          updated += 1;
        } else {
          await tx.insert(ecomOrders).values({
            channelId,
            externalId: order.externalId,
            customerName: order.customerName,
            status: order.status,
            totalCents: order.totalCents,
            currency: order.currency,
            shippingAddress: order.shippingAddress,
            createdAt: order.createdAt ?? new Date(),
            updatedAt: order.updatedAt ?? order.createdAt ?? new Date(),
          });

          const [inserted] = await tx
            .select({ id: ecomOrders.id })
            .from(ecomOrders)
            .orderBy(desc(ecomOrders.id))
            .limit(1);

          if (!inserted) {
            throw new Error('FAILED_TO_CREATE_ECOM_ORDER');
          }

          orderId = Number(inserted.id);
          created += 1;
        }

        if (order.items.length > 0) {
          await tx.insert(ecomOrderItems).values(
            order.items.map((item) => ({
              orderId,
              listingId: item.listingId,
              productCodeId: item.productCodeId,
              quantity: item.quantity,
              priceCents: item.priceCents,
            }))
          );
        }
      }

      await appendChannelLog(tx, channelId, 'orders_import', { created, updated });
      await appendAuditLog(tx, {
        actorId,
        action: 'ecom.orders.import',
        resourceType: 'ecom_order',
        resourceId: null,
        payload: { channelId, created, updated },
      });

      return { created, updated };
    });

    res.status(201).json({ channelId, ...importResult });
  } catch (error) {
    if (error instanceof Error && error.message === 'FAILED_TO_CREATE_ECOM_ORDER') {
      return res.status(500).json({ error: 'Unable to create order' });
    }

    next(error);
  }
});

const orderActionStatus = {
  pick: 'pending',
  pack: 'paid',
  label: 'paid',
  ship: 'fulfilled',
  cancel: 'cancelled',
};

app.post('/api/ecom/orders/:id/:action', async (req, res, next) => {
  try {
    const orderId = parsePositiveInteger(req.params.id, 'orderId');
    const action = String(req.params.action ?? '').toLowerCase();

    if (!(action in orderActionStatus)) {
      return res.status(404).json({ error: 'Unknown action' });
    }

    const actorId = parseActorId(req);
    const order = await loadOrderById(orderId);
    const nextStatus = orderActionStatus[action];
    const payload = {};

    if (req.body?.trackingNumber) {
      payload.trackingNumber = String(req.body.trackingNumber).trim();
    }

    if (req.body?.note) {
      payload.note = String(req.body.note).slice(0, 400);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(ecomOrders)
        .set({ status: nextStatus, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(ecomOrders.id, orderId));

      await appendChannelLog(tx, order.channelId, `order_${action}`, {
        orderId,
        status: nextStatus,
        ...payload,
      });

      await appendAuditLog(tx, {
        actorId,
        action: `ecom.orders.${action}`,
        resourceType: 'ecom_order',
        resourceId: orderId,
        payload: { status: nextStatus, ...payload },
      });
    });

    const refreshed = await loadOrderById(orderId);
    res.json({ order: refreshed, status: nextStatus });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ecom/returns', async (req, res, next) => {
  try {
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';
    const channelParam = req.query.channelId ?? req.query.channel_id ?? null;
    const channelId = channelParam == null || channelParam === '' ? null : parsePositiveInteger(channelParam, 'channelId');
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? req.query.limit ?? 25) || 25, 1), 100);

    const filters = [];

    if (statusParam && statusParam !== 'all') {
      const allowed = new Set(['requested', 'approved', 'received', 'refunded', 'denied']);
      if (!allowed.has(statusParam)) {
        throw new HttpError(400, 'status filter is invalid');
      }
      filters.push(eq(ecomReturns.status, statusParam));
    }

    if (channelId) {
      filters.push(eq(ecomOrders.channelId, channelId));
    }

    let query = db
      .select({
        id: ecomReturns.id,
        orderId: ecomReturns.orderId,
        status: ecomReturns.status,
        reason: ecomReturns.reason,
        createdAt: ecomReturns.createdAt,
        updatedAt: ecomReturns.updatedAt,
        channelId: ecomOrders.channelId,
        externalOrderId: ecomOrders.externalId,
        channelName: ecomChannels.name,
      })
      .from(ecomReturns)
      .innerJoin(ecomOrders, eq(ecomReturns.orderId, ecomOrders.id))
      .leftJoin(ecomChannels, eq(ecomOrders.channelId, ecomChannels.id));

    if (filters.length > 0) {
      query = query.where(and(...filters));
    }

    const rows = await query
      .orderBy(desc(ecomReturns.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const returnIds = rows.map((row) => Number(row.id));
    const itemsByReturn = new Map();

    if (returnIds.length > 0) {
      const itemRows = await db
        .select({
          id: ecomReturnItems.id,
          returnId: ecomReturnItems.returnId,
          orderItemId: ecomReturnItems.orderItemId,
          condition: ecomReturnItems.condition,
          restock: ecomReturnItems.restock,
        })
        .from(ecomReturnItems)
        .where(inArray(ecomReturnItems.returnId, returnIds));

      for (const row of itemRows) {
        const id = Number(row.returnId);
        const items = itemsByReturn.get(id) ?? [];
        items.push({
          id: Number(row.id),
          orderItemId: Number(row.orderItemId),
          condition: row.condition,
          restock: !!row.restock,
        });
        itemsByReturn.set(id, items);
      }
    }

    res.json({
      returns: rows.map((row) => {
        const record = mapReturn(row);
        return { ...record, items: itemsByReturn.get(record.id) ?? [] };
      }),
      pagination: {
        page,
        pageSize,
        hasMore: rows.length === pageSize,
        nextPage: rows.length === pageSize ? page + 1 : null,
      },
      filtersApplied: { status: statusParam, channelId },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ecom/returns/:id/:action', async (req, res, next) => {
  try {
    const returnId = parsePositiveInteger(req.params.id, 'returnId');
    const action = String(req.params.action ?? '').toLowerCase();
    const nextStatus = returnStatusByAction.get(action);

    if (!nextStatus) {
      return res.status(404).json({ error: 'Unknown action' });
    }

    const actorId = parseActorId(req);
    const returnRecord = await loadReturnById(returnId);

    const restockedItems = [];

    await db.transaction(async (tx) => {
      await tx
        .update(ecomReturns)
        .set({ status: nextStatus, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(ecomReturns.id, returnId));

      if (action === 'receive') {
        const items = await tx
          .select({
            id: ecomReturnItems.id,
            orderItemId: ecomReturnItems.orderItemId,
            condition: ecomReturnItems.condition,
            restock: ecomReturnItems.restock,
          })
          .from(ecomReturnItems)
          .where(eq(ecomReturnItems.returnId, returnId));

        for (const item of items) {
          if (item.restock && item.condition !== 'damaged') {
            restockedItems.push(Number(item.orderItemId));
          }
        }
      }

      await appendChannelLog(tx, returnRecord.channelId, `return_${action}`, {
        returnId,
        status: nextStatus,
        restockedItems,
      });

      await appendAuditLog(tx, {
        actorId,
        action: `ecom.returns.${action}`,
        resourceType: 'ecom_return',
        resourceId: returnId,
        payload: { status: nextStatus, restockedItems },
      });
    });

    const refreshed = await loadReturnById(returnId);
    res.json({ return: refreshed, status: nextStatus, restockedItems });
  } catch (error) {
    next(error);
  }
});

app.get('/api/settings', async (req, res, next) => {
  try {
    const identifiers = resolveScopeIdentifiers({
      scope: req.query.scope,
      branchId: req.query.branchId ?? req.query.branch_id,
      userId: req.query.userId ?? req.query.user_id,
    });

    const keysParam = typeof req.query.keys === 'string' ? req.query.keys : null;
    const keys = keysParam
      ? Array.from(
          new Set(
            keysParam
              .split(',')
              .map((key) => key.trim())
              .filter((key) => key)
              .map((key) => normalizeSettingKey(key))
          )
        )
      : null;

    const includeFallback = String(req.query.includeGlobal ?? req.query.includeFallback ?? '')
      .toLowerCase()
      .startsWith('t');

    const entries = await loadSettingsEntries(identifiers, keys);
    let fallback = null;

    if (includeFallback && identifiers.scope !== 'global') {
      fallback = await loadSettingsEntries({ scope: 'global', branchId: null, userId: null }, keys);
    }

    res.json({
      scope: identifiers.scope,
      branchId: identifiers.branchId,
      userId: identifiers.userId,
      entries,
      fallback,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.get('/api/settings/active-branch', async (req, res, next) => {
  try {
    const branch = await loadActiveBranch();
    res.json({ branch });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/settings', async (req, res, next) => {
  try {
    const identifiers = resolveScopeIdentifiers({
      scope: req.body?.scope,
      branchId: req.body?.branchId ?? req.body?.branch_id,
      userId: req.body?.userId ?? req.body?.user_id,
    });

    const rawEntries = req.body?.entries;
    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      throw new HttpError(400, 'entries must be a non-empty array');
    }

    const normalizedEntries = rawEntries.map((entry, index) => {
      if (entry == null || typeof entry !== 'object') {
        throw new HttpError(400, `entries[${index}] must be an object`);
      }

      const key = normalizeSettingKey(entry.key ?? entry.name);
      const value = sanitizeSettingValue(key, entry.value);
      return { key, value };
    });

    const actorId = parseActorId(req);

    await db.transaction(async (tx) => {
      for (const entry of normalizedEntries) {
        const conditions = [eq(settings.scope, identifiers.scope), eq(settings.k, entry.key)];

        if (identifiers.scope === 'branch' || identifiers.scope === 'user') {
          conditions.push(eq(settings.branchId, identifiers.branchId));
        } else {
          conditions.push(isNull(settings.branchId));
        }

        if (identifiers.scope === 'user') {
          conditions.push(eq(settings.userId, identifiers.userId));
        } else {
          conditions.push(isNull(settings.userId));
        }

        const [existing] = await tx
          .select({ id: settings.id })
          .from(settings)
          .where(and(...conditions))
          .limit(1);

        if (existing) {
          await tx
            .update(settings)
            .set({ v: entry.value, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(settings.id, existing.id));
        } else {
          await tx.insert(settings).values({
            scope: identifiers.scope,
            branchId: identifiers.scope === 'global' ? null : identifiers.branchId,
            userId: identifiers.scope === 'user' ? identifiers.userId : null,
            k: entry.key,
            v: entry.value,
          });
        }
      }

      await appendAuditLog(tx, {
        actorId,
        action: 'settings.save',
        resourceType: 'settings',
        resourceId: null,
        payload: {
          scope: identifiers.scope,
          branchId: identifiers.branchId,
          userId: identifiers.userId,
          keys: normalizedEntries.map((entry) => entry.key),
        },
      });
    });

    const entries = await loadSettingsEntries(identifiers);
    res.json({ scope: identifiers.scope, branchId: identifiers.branchId, userId: identifiers.userId, entries });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.post('/api/settings/providers/test', async (req, res, next) => {
  try {
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim().toLowerCase() : '';
    const actorId = parseActorId(req);
    const useStored = Boolean(req.body?.useStored);

    if (!providerSettingsKey.has(provider)) {
      throw new HttpError(400, 'Unsupported provider');
    }

    let identifiers = null;
    let credentials = null;

    if (useStored) {
      identifiers = resolveScopeIdentifiers({
        scope: req.body?.scope,
        branchId: req.body?.branchId ?? req.body?.branch_id,
        userId: req.body?.userId ?? req.body?.user_id,
      });

      const stored = await loadSettingValueRaw(identifiers, providerSettingsKey.get(provider));

      if (stored == null || typeof stored !== 'object') {
        throw new HttpError(404, 'No stored credentials available for this provider and scope');
      }

      credentials = stored;
      validateProviderCredentials(provider, credentials);
    } else {
      credentials = req.body?.credentials ?? {};
      validateProviderCredentials(provider, credentials);

      const hasScopeHints =
        req.body?.scope != null ||
        req.body?.branchId != null ||
        req.body?.branch_id != null ||
        req.body?.userId != null ||
        req.body?.user_id != null;

      if (hasScopeHints) {
        identifiers = resolveScopeIdentifiers({
          scope: req.body?.scope,
          branchId: req.body?.branchId ?? req.body?.branch_id,
          userId: req.body?.userId ?? req.body?.user_id,
        });
      }
    }

    await appendAuditLog(db, {
      actorId,
      action: 'settings.provider.test',
      resourceType: 'settings_provider',
      resourceId: null,
      payload: {
        provider,
        scope: identifiers?.scope ?? null,
        branchId: identifiers?.branchId ?? null,
        userId: identifiers?.userId ?? null,
        mode: useStored ? 'stored' : 'inline',
      },
    });

    res.json({
      ok: true,
      provider,
      message: 'Credentials validated successfully',
      mode: useStored ? 'stored' : 'inline',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.get('/api/customers', async (req, res, next) => {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const branchId = req.query.branchId != null ? Number(req.query.branchId) : null;
    const blacklistedParam = typeof req.query.blacklisted === 'string' ? req.query.blacklisted.toLowerCase() : null;
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.limit ?? 25) || 25, 1), 100);

    const whereClause = buildCustomerWhereClause({
      search,
      branchId: Number.isInteger(branchId) && branchId > 0 ? branchId : null,
      blacklisted:
        blacklistedParam === 'true' ? true : blacklistedParam === 'false' ? false : undefined,
    });

    const query = db.select(customerSelection).from(customers);

    if (whereClause) {
      query.where(whereClause);
    }

    const rows = await query
      .orderBy(desc(customers.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const customerIds = rows.map((row) => Number(row.id));

    let lastActivityByCustomer = new Map();

    if (customerIds.length > 0) {
      const [orderActivity, loanActivity, layawayActivity, repairActivity] = await Promise.all([
        db
          .select({ customerId: orders.customerId, lastActivity: max(orders.createdAt) })
          .from(orders)
          .where(inArray(orders.customerId, customerIds))
          .groupBy(orders.customerId),
        db
          .select({ customerId: loans.customerId, lastActivity: max(loans.updatedAt) })
          .from(loans)
          .where(inArray(loans.customerId, customerIds))
          .groupBy(loans.customerId),
        db
          .select({ customerId: layaways.customerId, lastActivity: max(layaways.updatedAt) })
          .from(layaways)
          .where(inArray(layaways.customerId, customerIds))
          .groupBy(layaways.customerId),
        db
          .select({ customerId: repairs.customerId, lastActivity: max(repairs.updatedAt) })
          .from(repairs)
          .where(inArray(repairs.customerId, customerIds))
          .groupBy(repairs.customerId),
      ]);

      lastActivityByCustomer = new Map();

      for (const row of [...orderActivity, ...loanActivity, ...layawayActivity, ...repairActivity]) {
        const id = Number(row.customerId);
        const existing = lastActivityByCustomer.get(id);
        const value = row.lastActivity instanceof Date ? row.lastActivity : row.lastActivity ? new Date(row.lastActivity) : null;

        if (!value || Number.isNaN(value.getTime())) {
          continue;
        }

        if (!existing || existing.getTime() < value.getTime()) {
          lastActivityByCustomer.set(id, value);
        }
      }
    }

    res.json({
      customers: rows.map((row) => {
        const serialized = serializeCustomer(row);
        const activity = lastActivityByCustomer.get(serialized.id);
        return {
          ...serialized,
          lastActivityAt: activity ? activity.toISOString() : null,
        };
      }),
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/customers/:id', async (req, res, next) => {
  try {
    const customerId = Number(req.params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const detail = await loadCustomerDetail(customerId);

    if (!detail) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(detail);
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers', async (req, res, next) => {
  try {
    const actorId = parseActorId(req);
    const {
      branchId,
      firstName,
      lastName,
      email = null,
      phone = null,
      address = null,
      loyaltyPoints = 0,
    } = req.body ?? {};

    const numericBranchId = Number(branchId);

    if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
      return res.status(400).json({ error: 'branchId is required' });
    }

    const normalizedFirst = normalizeOptionalString(firstName, { maxLength: 80 });
    const normalizedLast = normalizeOptionalString(lastName, { maxLength: 80 });
    const normalizedEmail = normalizeOptionalString(email, { maxLength: 190 });
    const normalizedPhone = normalizeOptionalString(phone, { maxLength: 40 });
    const normalizedAddress = normalizeNullableText(address, 2000);
    const normalizedPoints = Number(loyaltyPoints) || 0;

    if (!normalizedFirst) {
      return res.status(400).json({ error: 'firstName is required' });
    }

    if (!normalizedLast) {
      return res.status(400).json({ error: 'lastName is required' });
    }

    const createdCustomer = await db.transaction(async (tx) => {
      await tx.insert(customers).values({
        branchId: numericBranchId,
        firstName: normalizedFirst,
        lastName: normalizedLast,
        email: normalizedEmail,
        phone: normalizedPhone,
        address: normalizedAddress,
        loyaltyPoints: normalizedPoints,
      });

      const [row] = await tx
        .select(customerSelection)
        .from(customers)
        .orderBy(desc(customers.id))
        .limit(1);

      if (!row) {
        throw new Error('FAILED_TO_CREATE_CUSTOMER');
      }

      return row;
    });

    await appendAuditLog(db, {
      actorId,
      action: 'customer.create',
      resourceType: 'customer',
      resourceId: Number(createdCustomer.id),
      payload: {
        branchId: numericBranchId,
        firstName: normalizedFirst,
        lastName: normalizedLast,
        email: normalizedEmail,
        phone: normalizedPhone,
      },
    });

    const detail = await loadCustomerDetail(Number(createdCustomer.id));
    res.status(201).json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    next(error);
  }
});

app.patch('/api/customers/:id', async (req, res, next) => {
  try {
    const customerId = Number(req.params.id);
    const actorId = parseActorId(req);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const detailBefore = await loadCustomerDetail(customerId);

    if (!detailBefore) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updates = {};

    if ('firstName' in req.body) {
      updates.firstName = normalizeOptionalString(req.body.firstName, { maxLength: 80 });
      if (!updates.firstName) {
        return res.status(400).json({ error: 'firstName cannot be empty' });
      }
    }

    if ('lastName' in req.body) {
      updates.lastName = normalizeOptionalString(req.body.lastName, { maxLength: 80 });
      if (!updates.lastName) {
        return res.status(400).json({ error: 'lastName cannot be empty' });
      }
    }

    if ('email' in req.body) {
      updates.email = normalizeOptionalString(req.body.email, { maxLength: 190 }) || null;
    }

    if ('phone' in req.body) {
      updates.phone = normalizeOptionalString(req.body.phone, { maxLength: 40 }) || null;
    }

    if ('address' in req.body) {
      updates.address = normalizeNullableText(req.body.address, 2000);
    }

    if ('loyaltyPoints' in req.body) {
      const numericPoints = Number(req.body.loyaltyPoints) || 0;
      updates.loyaltyPoints = numericPoints;

      const delta = numericPoints - detailBefore.customer.loyaltyPoints;
      if (delta !== 0) {
        await db.insert(loyaltyLedger).values({
          customerId,
          pointsDelta: delta,
          reason: 'manual_adjustment',
          refTable: 'customers',
          refId: customerId,
        });
      }
    }

    if ('isBlacklisted' in req.body) {
      updates.isBlacklisted = !!req.body.isBlacklisted;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(customers)
        .set(updates)
        .where(eq(customers.id, customerId));
    }

    await appendAuditLog(db, {
      actorId,
      action: 'customer.update',
      resourceType: 'customer',
      resourceId: customerId,
      payload: updates,
    });

    const detail = await loadCustomerDetail(customerId);
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers/:id/notes', async (req, res, next) => {
  try {
    const customerId = Number(req.params.id);
    const actorId = parseActorId(req);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const note = normalizeNullableText(req.body?.note, 2000);

    if (!note) {
      return res.status(400).json({ error: 'note is required' });
    }

    const inserted = await db.transaction(async (tx) => {
      await tx.insert(customerNotes).values({
        customerId,
        authorId: actorId ?? 0,
        note,
      });

      const [row] = await tx
        .select(customerNoteSelection)
        .from(customerNotes)
        .where(eq(customerNotes.customerId, customerId))
        .orderBy(desc(customerNotes.createdAt), desc(customerNotes.id))
        .limit(1);

      if (!row) {
        throw new Error('FAILED_TO_CREATE_CUSTOMER_NOTE');
      }

      return row;
    });

    await appendAuditLog(db, {
      actorId,
      action: 'customer.note.create',
      resourceType: 'customer',
      resourceId: customerId,
      payload: { note },
    });

    res.status(201).json({
      note: {
        id: Number(inserted.id),
        customerId: Number(inserted.customerId),
        authorId: Number(inserted.authorId),
        note: inserted.note,
        createdAt: inserted.createdAt?.toISOString?.() ?? inserted.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers/:id/loyalty', async (req, res, next) => {
  try {
    const customerId = Number(req.params.id);
    const actorId = parseActorId(req);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const pointsDelta = Number(req.body?.pointsDelta);

    if (!Number.isFinite(pointsDelta) || pointsDelta === 0) {
      return res.status(400).json({ error: 'pointsDelta must be a non-zero number' });
    }

    const reason = normalizeOptionalString(req.body?.reason, { maxLength: 160 }) || 'manual_adjustment';

    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ loyaltyPoints: customers.loyaltyPoints })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!current) {
        throw new HttpError(404, 'Customer not found');
      }

      const newPoints = Number(current.loyaltyPoints ?? 0) + Math.round(pointsDelta);

      await tx.insert(loyaltyLedger).values({
        customerId,
        pointsDelta: Math.round(pointsDelta),
        reason,
        refTable: 'customers',
        refId: customerId,
      });

      await tx
        .update(customers)
        .set({
          loyaltyPoints: newPoints,
        })
        .where(eq(customers.id, customerId));
    });

    await appendAuditLog(db, {
      actorId,
      action: 'customer.loyalty.adjust',
      resourceType: 'customer',
      resourceId: customerId,
      payload: { pointsDelta, reason },
    });

    const detail = await loadCustomerDetail(customerId);
    res.json(detail.loyaltyLedger);
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers/:id/message', async (req, res, next) => {
  try {
    const customerId = Number(req.params.id);
    const actorId = parseActorId(req);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const detail = await loadCustomerDetail(customerId);

    if (!detail) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const channelRaw = typeof req.body?.channel === 'string' ? req.body.channel.trim().toLowerCase() : 'sms';
    const channel = channelRaw === 'email' ? 'email' : channelRaw === 'whatsapp' ? 'whatsapp' : 'sms';
    const message = normalizeNullableText(req.body?.message, 2000);
    let recipient = normalizeOptionalString(req.body?.recipient, { maxLength: 120 });

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!recipient) {
      recipient =
        channel === 'email'
          ? detail.customer.email ?? ''
          : detail.customer.phone ?? '';
    }

    if (!recipient) {
      return res.status(400).json({ error: 'recipient is required' });
    }

    await queueNotificationMessage(db, {
      customerId,
      channel,
      recipient,
      message,
    });

    await appendAuditLog(db, {
      actorId,
      action: 'customer.message.queue',
      resourceType: 'customer',
      resourceId: customerId,
      payload: { channel, recipient },
    });

    res.status(202).json({ queued: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers/id-images/sign', signIdImageUploadRequest);

const marketingTemplateSelection = {
  id: marketingTemplates.id,
  name: marketingTemplates.name,
  channel: marketingTemplates.channel,
  subject: marketingTemplates.subject,
  body: marketingTemplates.body,
  variables: marketingTemplates.variables,
  createdBy: marketingTemplates.createdBy,
  updatedBy: marketingTemplates.updatedBy,
  createdAt: marketingTemplates.createdAt,
  updatedAt: marketingTemplates.updatedAt,
};

const marketingSegmentSelection = {
  id: marketingSegments.id,
  name: marketingSegments.name,
  description: marketingSegments.description,
  filters: marketingSegments.filters,
  createdBy: marketingSegments.createdBy,
  updatedBy: marketingSegments.updatedBy,
  createdAt: marketingSegments.createdAt,
  updatedAt: marketingSegments.updatedAt,
};

const marketingCampaignSelection = {
  id: marketingCampaigns.id,
  name: marketingCampaigns.name,
  templateId: marketingCampaigns.templateId,
  segmentId: marketingCampaigns.segmentId,
  scheduledAt: marketingCampaigns.scheduledAt,
  status: marketingCampaigns.status,
  createdBy: marketingCampaigns.createdBy,
  createdAt: marketingCampaigns.createdAt,
  updatedAt: marketingCampaigns.updatedAt,
};

const marketingSendSelection = {
  id: marketingSends.id,
  campaignId: marketingSends.campaignId,
  customerId: marketingSends.customerId,
  notificationId: marketingSends.notificationId,
  channel: marketingSends.channel,
  status: marketingSends.status,
  error: marketingSends.error,
  sentAt: marketingSends.sentAt,
  createdAt: marketingSends.createdAt,
};

function serializeMarketingTemplate(row) {
  return {
    id: Number(row.id),
    name: row.name,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    variables: row.variables ?? [],
    createdBy: row.createdBy == null ? null : Number(row.createdBy),
    updatedBy: row.updatedBy == null ? null : Number(row.updatedBy),
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

function serializeMarketingSegment(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    filters: row.filters ?? {},
    createdBy: row.createdBy == null ? null : Number(row.createdBy),
    updatedBy: row.updatedBy == null ? null : Number(row.updatedBy),
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

function serializeMarketingCampaign(row) {
  return {
    id: Number(row.id),
    name: row.name,
    templateId: Number(row.templateId),
    segmentId: Number(row.segmentId),
    scheduledAt: row.scheduledAt?.toISOString?.() ?? row.scheduledAt,
    status: row.status,
    createdBy: row.createdBy == null ? null : Number(row.createdBy),
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

function sanitizeSegmentFilters(filters) {
  const result = {};

  if (filters == null || typeof filters !== 'object') {
    return result;
  }

  if (Array.isArray(filters.branchIds)) {
    result.branchIds = filters.branchIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  if (typeof filters.blacklisted === 'boolean') {
    result.blacklisted = filters.blacklisted;
  }

  if (filters.minLoyalty != null) {
    const numeric = Number(filters.minLoyalty);
    if (Number.isFinite(numeric) && numeric >= 0) {
      result.minLoyalty = numeric;
    }
  }

  if (filters.tags && Array.isArray(filters.tags)) {
    result.tags = filters.tags.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim());
  }

  return result;
}

function buildSegmentFilterWhere(filters) {
  const conditions = [];
  const safeFilters = sanitizeSegmentFilters(filters);

  if (safeFilters.branchIds && safeFilters.branchIds.length > 0) {
    conditions.push(inArray(customers.branchId, safeFilters.branchIds));
  }

  if (typeof safeFilters.blacklisted === 'boolean') {
    conditions.push(eq(customers.isBlacklisted, safeFilters.blacklisted));
  }

  if (typeof safeFilters.minLoyalty === 'number') {
    conditions.push(gte(customers.loyaltyPoints, Math.floor(safeFilters.minLoyalty)));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

function renderTemplate(template, context) {
  if (!template) {
    return '';
  }

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const normalizedKey = String(key || '').trim().toLowerCase();
    const value = context[normalizedKey];
    if (value == null) {
      return '';
    }
    return String(value);
  });
}

function buildMarketingContext(customer) {
  const fullName = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
  return {
    first_name: customer.firstName ?? '',
    last_name: customer.lastName ?? '',
    full_name: fullName || 'cliente',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    loyalty_points: Number(customer.loyaltyPoints ?? 0),
  };
}

app.get('/api/marketing/templates', async (req, res, next) => {
  try {
    const rows = await db.select(marketingTemplateSelection).from(marketingTemplates).orderBy(desc(marketingTemplates.updatedAt));
    res.json({ templates: rows.map(serializeMarketingTemplate) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mkt/templates', async (req, res, next) => {
  try {
    const actorId = parseActorId(req);
    const { name, channel = 'sms', subject = null, body, variables = [] } = req.body ?? {};

    const normalizedName = normalizeOptionalString(name, { maxLength: 160 });
    if (!normalizedName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const normalizedChannel = typeof channel === 'string' ? channel.trim().toLowerCase() : 'sms';
    if (!['sms', 'whatsapp', 'email'].includes(normalizedChannel)) {
      return res.status(400).json({ error: 'channel must be sms, whatsapp, or email' });
    }

    const normalizedBody = normalizeNullableText(body, 2000);
    if (!normalizedBody) {
      return res.status(400).json({ error: 'body is required' });
    }

    const normalizedSubject = normalizedChannel === 'email' ? normalizeOptionalString(subject, { maxLength: 180 }) : null;
    const normalizedVariables = Array.isArray(variables)
      ? variables.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim().toLowerCase())
      : [];

    const row = await db.transaction(async (tx) => {
      await tx.insert(marketingTemplates).values({
        name: normalizedName,
        channel: normalizedChannel,
        subject: normalizedSubject,
        body: normalizedBody,
        variables: normalizedVariables,
        createdBy: actorId ?? 0,
        updatedBy: actorId ?? null,
      });

      const [created] = await tx
        .select(marketingTemplateSelection)
        .from(marketingTemplates)
        .orderBy(desc(marketingTemplates.id))
        .limit(1);

      return created ?? null;
    });

    await appendAuditLog(db, {
      actorId,
      action: 'marketing.template.create',
      resourceType: 'marketing_template',
      resourceId: row ? Number(row.id) : null,
      payload: { name: normalizedName, channel: normalizedChannel },
    });

    res.status(201).json({ template: row ? serializeMarketingTemplate(row) : null });
  } catch (error) {
    next(error);
  }
});

app.get('/api/marketing/segments', async (req, res, next) => {
  try {
    const rows = await db.select(marketingSegmentSelection).from(marketingSegments).orderBy(desc(marketingSegments.updatedAt));
    res.json({ segments: rows.map(serializeMarketingSegment) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mkt/segments', async (req, res, next) => {
  try {
    const actorId = parseActorId(req);
    const { name, description = null, filters = {} } = req.body ?? {};

    const normalizedName = normalizeOptionalString(name, { maxLength: 160 });
    if (!normalizedName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const normalizedDescription = normalizeNullableText(description, 1000);
    const sanitizedFilters = sanitizeSegmentFilters(filters);

    const row = await db.transaction(async (tx) => {
      await tx.insert(marketingSegments).values({
        name: normalizedName,
        description: normalizedDescription,
        filters: sanitizedFilters,
        createdBy: actorId ?? 0,
        updatedBy: actorId ?? null,
      });

      const [created] = await tx
        .select(marketingSegmentSelection)
        .from(marketingSegments)
        .orderBy(desc(marketingSegments.id))
        .limit(1);

      return created ?? null;
    });

    await appendAuditLog(db, {
      actorId,
      action: 'marketing.segment.create',
      resourceType: 'marketing_segment',
      resourceId: row ? Number(row.id) : null,
      payload: { name: normalizedName },
    });

    res.status(201).json({ segment: row ? serializeMarketingSegment(row) : null });
  } catch (error) {
    next(error);
  }
});

app.get('/api/marketing/campaigns', async (req, res, next) => {
  try {
    const [campaignRows, templateRows, segmentRows, sendRows] = await Promise.all([
      db.select(marketingCampaignSelection).from(marketingCampaigns).orderBy(desc(marketingCampaigns.updatedAt)),
      db.select(marketingTemplateSelection).from(marketingTemplates),
      db.select(marketingSegmentSelection).from(marketingSegments),
      db.select(marketingSendSelection).from(marketingSends),
    ]);

    const templateMap = new Map(templateRows.map((row) => [Number(row.id), serializeMarketingTemplate(row)]));
    const segmentMap = new Map(segmentRows.map((row) => [Number(row.id), serializeMarketingSegment(row)]));
    const sendCountMap = new Map();

    for (const send of sendRows) {
      const id = Number(send.campaignId ?? 0);
      if (!id) continue;
      sendCountMap.set(id, (sendCountMap.get(id) ?? 0) + 1);
    }

    const campaigns = campaignRows.map((row) => {
      const serialized = serializeMarketingCampaign(row);
      const template = templateMap.get(serialized.templateId) ?? null;
      const segment = segmentMap.get(serialized.segmentId) ?? null;

      return {
        ...serialized,
        templateName: template?.name ?? null,
        segmentName: segment?.name ?? null,
        sendCount: sendCountMap.get(serialized.id) ?? 0,
      };
    });

    res.json({ campaigns });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mkt/campaigns', async (req, res, next) => {
  try {
    const actorId = parseActorId(req);
    const { name, templateId, segmentId, scheduledAt = null } = req.body ?? {};

    const normalizedName = normalizeOptionalString(name, { maxLength: 160 });
    if (!normalizedName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const normalizedTemplateId = Number(templateId);
    const normalizedSegmentId = Number(segmentId);

    if (!Number.isInteger(normalizedTemplateId) || normalizedTemplateId <= 0) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    if (!Number.isInteger(normalizedSegmentId) || normalizedSegmentId <= 0) {
      return res.status(400).json({ error: 'segmentId is required' });
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    if (scheduledDate && Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'scheduledAt must be a valid date' });
    }

    await db.insert(marketingCampaigns).values({
      name: normalizedName,
      templateId: normalizedTemplateId,
      segmentId: normalizedSegmentId,
      scheduledAt: scheduledDate,
      status: scheduledDate ? 'scheduled' : 'draft',
      createdBy: actorId ?? 0,
    });

    const [row] = await db
      .select(marketingCampaignSelection)
      .from(marketingCampaigns)
      .orderBy(desc(marketingCampaigns.id))
      .limit(1);

    await appendAuditLog(db, {
      actorId,
      action: 'marketing.campaign.create',
      resourceType: 'marketing_campaign',
      resourceId: row ? Number(row.id) : null,
      payload: { name: normalizedName, templateId: normalizedTemplateId, segmentId: normalizedSegmentId },
    });

    res.status(201).json({ campaign: row ? serializeMarketingCampaign(row) : null });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mkt/campaigns/:id/send', async (req, res, next) => {
  try {
    const campaignId = Number(req.params.id);
    const actorId = parseActorId(req);

    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return res.status(400).json({ error: 'Invalid campaign id' });
    }

    const [campaignRow] = await db
      .select({
        campaign: marketingCampaignSelection,
        template: marketingTemplateSelection,
        segment: marketingSegmentSelection,
      })
      .from(marketingCampaigns)
      .leftJoin(marketingTemplates, eq(marketingTemplates.id, marketingCampaigns.templateId))
      .leftJoin(marketingSegments, eq(marketingSegments.id, marketingCampaigns.segmentId))
      .where(eq(marketingCampaigns.id, campaignId))
      .limit(1);

    if (!campaignRow) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = serializeMarketingCampaign(campaignRow.campaign);
    const template = campaignRow.template ? serializeMarketingTemplate(campaignRow.template) : null;
    const segment = campaignRow.segment ? serializeMarketingSegment(campaignRow.segment) : null;

    if (!template) {
      return res.status(409).json({ error: 'Campaign template missing' });
    }

    if (!segment) {
      return res.status(409).json({ error: 'Campaign segment missing' });
    }

    const whereClause = buildSegmentFilterWhere(segment.filters);
    const query = db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        loyaltyPoints: customers.loyaltyPoints,
      })
      .from(customers);

    if (whereClause) {
      query.where(whereClause);
    }

    const recipients = await query.limit(1000);

    const queued = [];

    await db.transaction(async (tx) => {
      await tx
        .update(marketingCampaigns)
        .set({ status: 'sending', updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(marketingCampaigns.id, campaignId));

      for (const recipient of recipients) {
        const context = buildMarketingContext(recipient);
        const message = renderTemplate(template.body, context).trim();

        if (!message) {
          continue;
        }

        const destination = template.channel === 'email' ? recipient.email : recipient.phone;
        if (!destination) {
          continue;
        }

        await queueNotificationMessage(tx, {
          customerId: recipient.id ? Number(recipient.id) : null,
          channel: template.channel,
          recipient: destination,
          message,
        });

        await tx.insert(marketingSends).values({
          campaignId,
          customerId: Number(recipient.id),
          channel: template.channel,
          status: 'pending',
        });

        queued.push({
          customerId: Number(recipient.id),
          channel: template.channel,
          recipient: destination,
        });
      }

      await tx
        .update(marketingCampaigns)
        .set({ status: 'completed', updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(marketingCampaigns.id, campaignId));
    });

    await appendAuditLog(db, {
      actorId,
      action: 'marketing.campaign.send',
      resourceType: 'marketing_campaign',
      resourceId: campaignId,
      payload: { queued: queued.length },
    });

    res.status(202).json({ campaign, queuedCount: queued.length, queued });
  } catch (error) {
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
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
  const errorId = crypto.randomUUID();
  const requestInfo = `${req.method ?? 'UNKNOWN'} ${req.originalUrl ?? req.url ?? ''}`.trim();

  console.error(`[${errorId}] Unexpected error for ${requestInfo}:`, err);

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: 'Internal Server Error',
    errorId,
  });
});

// 404 handler
app.use((req, res) => {
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
