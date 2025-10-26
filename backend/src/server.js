import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { connectDB, closeConnection, db } from './db/connection.js';
import {
  cashMovements,
  creditNoteLedger,
  creditNotes,
  giftCardLedger,
  giftCards,
  interestModels,
  invoices,
  idImages,
  loanCollateral,
  loanSchedules,
  orderItems,
  orders,
  payments,
  productCodes,
  productCodeVersions,
  shiftReports,
  shifts,
  stockLedger,
  users,
} from './db/schema.js';
import { and, asc, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';

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
    } = req.body ?? {};

    if (branchId == null || customerId == null) {
      return res.status(400).json({ error: 'branchId and customerId are required' });
    }

    const numericBranchId = Number(branchId);
    const numericCustomerId = Number(customerId);

    if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
      return res.status(400).json({ error: 'branchId must be a positive integer' });
    }

    if (!Number.isInteger(numericCustomerId) || numericCustomerId <= 0) {
      return res.status(400).json({ error: 'customerId must be a positive integer' });
    }

    if (!ticketNumber || typeof ticketNumber !== 'string' || !ticketNumber.trim()) {
      return res.status(400).json({ error: 'ticketNumber is required' });
    }

    if (interestModelId == null) {
      return res.status(400).json({ error: 'interestModelId is required' });
    }

    const numericInterestModelId = Number(interestModelId);

    if (!Number.isInteger(numericInterestModelId) || numericInterestModelId <= 0) {
      return res.status(400).json({ error: 'interestModelId must be a positive integer' });
    }

    const normalizedPrincipal = Number(principalCents);
    if (!Number.isFinite(normalizedPrincipal) || normalizedPrincipal <= 0) {
      return res.status(400).json({ error: 'principalCents must be greater than 0' });
    }

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ error: 'schedule must include at least one entry' });
    }

    const normalizedTicket = ticketNumber.trim();
    const normalizedSchedule = schedule.map((entry, index) => {
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

      if (!Number.isFinite(interestValue) || interestValue <= 0) {
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

    const normalizedCollateral = Array.isArray(collateral)
      ? collateral
          .filter((item) => item && typeof item === 'object')
          .map((item, index) => {
            const description = typeof item.description === 'string' ? item.description.trim() : '';

            if (!description) {
              throw new HttpError(400, `collateral[${index}].description is required`);
            }

            const valueCents = item.estimatedValueCents == null ? null : Number(item.estimatedValueCents);

            if (valueCents != null && (!Number.isFinite(valueCents) || valueCents < 0)) {
              throw new HttpError(400, `collateral[${index}].estimatedValueCents must be zero or greater`);
            }

            const photoPath = typeof item.photoPath === 'string' ? item.photoPath.trim() : null;

            return {
              description,
              estimatedValueCents: valueCents == null ? null : Math.round(valueCents),
              photoPath,
            };
          })
      : [];

    const normalizedIdImagePaths = Array.isArray(idImagePaths)
      ? idImagePaths.map((value, index) => {
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
        })
      : [];

    const [model] = await db
      .select({
        id: interestModels.id,
        name: interestModels.name,
        interestRateBps: interestModels.interestRateBps,
        minPrincipalCents: interestModels.minPrincipalCents,
        maxPrincipalCents: interestModels.maxPrincipalCents,
      })
      .from(interestModels)
      .where(eq(interestModels.id, numericInterestModelId))
      .limit(1);

    if (!model) {
      return res.status(404).json({ error: 'Interest model not found' });
    }

    const roundedPrincipal = Math.round(normalizedPrincipal);

    if (model.minPrincipalCents != null && roundedPrincipal < Number(model.minPrincipalCents)) {
      return res.status(400).json({ error: 'principalCents is below the minimum for this model' });
    }

    if (model.maxPrincipalCents != null && roundedPrincipal > Number(model.maxPrincipalCents)) {
      return res.status(400).json({ error: 'principalCents exceeds the maximum for this model' });
    }

    const [existingTicket] = await db
      .select({ id: loans.id })
      .from(loans)
      .where(eq(loans.ticketNumber, normalizedTicket))
      .limit(1);

    if (existingTicket) {
      return res.status(409).json({ error: 'Ticket number already exists' });
    }

    const dueDateString = normalizedSchedule.reduce((latest, entry) => {
      return entry.dueOn > latest ? entry.dueOn : latest;
    }, normalizedSchedule[0].dueOn);

    const rateDecimal = (Number(model.interestRateBps) / 10000).toFixed(4);
    const normalizedComments = typeof comments === 'string' && comments.trim().length > 0 ? comments.trim() : null;

    const createdLoan = await db.transaction(async (tx) => {
      await tx.insert(loans).values({
        branchId: numericBranchId,
        customerId: numericCustomerId,
        ticketNumber: normalizedTicket,
        principalCents: roundedPrincipal,
        interestModelId: Number(model.id),
        interestRate: rateDecimal,
        dueDate: dueDateString,
        comments: normalizedComments,
      });

      const [loanRow] = await tx
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
        .where(eq(loans.ticketNumber, normalizedTicket))
        .limit(1);

      if (!loanRow) {
        throw new Error('FAILED_TO_CREATE_LOAN');
      }

      for (const entry of normalizedSchedule) {
        await tx.insert(loanSchedules).values({
          loanId: loanRow.id,
          dueOn: entry.dueOn,
          interestCents: entry.interestCents,
          feeCents: entry.feeCents,
        });
      }

      for (const item of normalizedCollateral) {
        await tx.insert(loanCollateral).values({
          loanId: loanRow.id,
          description: item.description,
          estimatedValueCents: item.estimatedValueCents,
          photoPath: item.photoPath,
        });
      }

      const collateralRows = await tx
        .select({
          id: loanCollateral.id,
          loanId: loanCollateral.loanId,
          description: loanCollateral.description,
          estimatedValueCents: loanCollateral.estimatedValueCents,
          photoPath: loanCollateral.photoPath,
        })
        .from(loanCollateral)
        .where(eq(loanCollateral.loanId, loanRow.id));

      const scheduleRows = await tx
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

      if (normalizedIdImagePaths.length > 0) {
        const existingImageRows = await tx
          .select({ storagePath: idImages.storagePath })
          .from(idImages)
          .where(
            and(
              eq(idImages.customerId, loanRow.customerId),
              inArray(idImages.storagePath, normalizedIdImagePaths)
            )
          );

        const existingPaths = new Set(existingImageRows.map((row) => row.storagePath));

        for (const path of normalizedIdImagePaths) {
          if (!existingPaths.has(path)) {
            await tx.insert(idImages).values({
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
        idImagePaths: normalizedIdImagePaths,
      };
    });

    const formatDateValue = (value) => {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }

      if (typeof value === 'string') {
        return value;
      }

      return null;
    };

    res.status(201).json({
      loan: {
        ...createdLoan.loan,
        dueDate: formatDateValue(createdLoan.loan.dueDate),
        createdAt: createdLoan.loan.createdAt?.toISOString?.() ?? createdLoan.loan.createdAt,
        updatedAt: createdLoan.loan.updatedAt?.toISOString?.() ?? createdLoan.loan.updatedAt,
      },
      collateral: createdLoan.collateral.map((item) => ({
        ...item,
        estimatedValueCents: item.estimatedValueCents == null ? null : Number(item.estimatedValueCents),
      })),
      schedule: createdLoan.schedule.map((entry) => ({
        ...entry,
        dueOn: formatDateValue(entry.dueOn),
        createdAt: entry.createdAt?.toISOString?.() ?? entry.createdAt,
      })),
      idImagePaths: createdLoan.idImagePaths,
    });
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

app.post('/api/uploads/id-images/sign', (req, res) => {
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
