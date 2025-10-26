import { Router } from 'express';
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { db } from '../db/connection.js';
import {
  priceOverrideApprovals,
  roles,
  users,
} from '../db/schema.js';
import { toPositiveInteger } from '../utils/validation.js';

const cartRouter = Router();

const timingSafeCompare = (a, b) => {
  const bufferA = Buffer.isBuffer(a) ? a : Buffer.from(String(a), 'utf8');
  const bufferB = Buffer.isBuffer(b) ? b : Buffer.from(String(b), 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

const verifyPin = (candidatePin, storedValue) => {
  if (!storedValue) {
    return false;
  }

  const normalizedStored = typeof storedValue === 'string'
    ? storedValue
    : Buffer.isBuffer(storedValue)
      ? storedValue.toString('utf8')
      : '';

  if (!normalizedStored) {
    return false;
  }

  if (normalizedStored.startsWith('scrypt:')) {
    const [, saltBase64, hashBase64] = normalizedStored.split(':');
    if (!saltBase64 || !hashBase64) {
      return false;
    }

    const salt = Buffer.from(saltBase64, 'base64');
    const expected = Buffer.from(hashBase64, 'base64');

    try {
      const derived = crypto.scryptSync(candidatePin, salt, expected.length);
      return timingSafeCompare(derived, expected);
    } catch (error) {
      return false;
    }
  }

  if (normalizedStored.startsWith('sha256:')) {
    const expectedHex = normalizedStored.slice('sha256:'.length);
    const candidateHex = crypto.createHash('sha256').update(candidatePin).digest('hex');
    return timingSafeCompare(candidateHex, expectedHex);
  }

  const candidateHex = crypto.createHash('sha256').update(candidatePin).digest('hex');
  if (timingSafeCompare(candidateHex, normalizedStored)) {
    return true;
  }

  return timingSafeCompare(candidatePin, normalizedStored);
};

cartRouter.post('/price-override', async (req, res, next) => {
  try {
    const {
      managerId: managerIdInput,
      pin,
      cartTotalCents: cartTotalInput,
      overrideTotalCents: overrideTotalInput,
      reason,
    } = req.body ?? {};

    const managerId = toPositiveInteger(managerIdInput);

    if (!managerId) {
      return res.status(400).json({
        error: 'InvalidManagerId',
        message: 'The "managerId" field must be a positive integer.',
      });
    }

    if (typeof pin !== 'string' || pin.trim().length < 4 || pin.trim().length > 12) {
      return res.status(400).json({
        error: 'InvalidPin',
        message: 'The "pin" field must be a string between 4 and 12 characters.',
      });
    }

    const cartTotalCents = toPositiveInteger(cartTotalInput);

    if (!cartTotalCents) {
      return res.status(400).json({
        error: 'InvalidCartTotal',
        message: 'The "cartTotalCents" field must be a positive integer.',
      });
    }

    const overrideTotalCents = toPositiveInteger(overrideTotalInput);

    if (!overrideTotalCents) {
      return res.status(400).json({
        error: 'InvalidOverrideTotal',
        message: 'The "overrideTotalCents" field must be a positive integer.',
      });
    }

    if (overrideTotalCents > cartTotalCents) {
      return res.status(400).json({
        error: 'OverrideExceedsCart',
        message: 'The override total cannot exceed the original cart total.',
      });
    }

    if (reason !== undefined && typeof reason !== 'string') {
      return res.status(400).json({
        error: 'InvalidReason',
        message: 'When provided, the "reason" field must be a string.',
      });
    }

    const normalizedPin = pin.trim();

    const [manager] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        isActive: users.isActive,
        pinHash: users.pinHash,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, managerId))
      .limit(1);

    if (!manager) {
      return res.status(404).json({
        error: 'ManagerNotFound',
        message: 'No manager was found for the provided identifier.',
      });
    }

    if (!manager.isActive) {
      return res.status(403).json({
        error: 'ManagerInactive',
        message: 'The selected manager is inactive and cannot approve overrides.',
      });
    }

    if (!['manager', 'admin'].includes(manager.roleName)) {
      return res.status(403).json({
        error: 'InsufficientRole',
        message: 'Only users with a manager or admin role can approve price overrides.',
      });
    }

    if (!manager.pinHash) {
      return res.status(400).json({
        error: 'MissingPinHash',
        message: 'The manager does not have a PIN configured.',
      });
    }

    if (!verifyPin(normalizedPin, manager.pinHash)) {
      return res.status(401).json({
        error: 'InvalidCredentials',
        message: 'The provided PIN is invalid.',
      });
    }

    const overrideDeltaCents = cartTotalCents - overrideTotalCents;

    const approvalCode = crypto.randomUUID();
    const sanitizedReason = typeof reason === 'string' ? reason.trim() || null : null;

    await db
      .insert(priceOverrideApprovals)
      .values({
        managerId,
        cartTotalCents,
        overrideTotalCents,
        overrideDeltaCents,
        reason: sanitizedReason,
        approvalCode,
      })
      .execute();

    const [approvalRecord] = await db
      .select({
        id: priceOverrideApprovals.id,
        createdAt: priceOverrideApprovals.createdAt,
      })
      .from(priceOverrideApprovals)
      .where(and(eq(priceOverrideApprovals.managerId, managerId), eq(priceOverrideApprovals.approvalCode, approvalCode)))
      .limit(1);

    res.status(201).json({
      data: {
        approvalId: approvalRecord?.id ?? null,
        approvalCode,
        manager: {
          id: manager.id,
          fullName: manager.fullName,
          role: manager.roleName,
        },
        cartTotalCents,
        overrideTotalCents,
        overrideDeltaCents,
        reason: sanitizedReason,
        createdAt: approvalRecord?.createdAt ?? null,
      },
      meta: {
        approved: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default cartRouter;
