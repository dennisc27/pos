import { Router } from 'express';
import crypto from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';

import { db } from '../db/connection.js';
import {
  orderItems,
  orders,
  productCodeVersions,
} from '../db/schema.js';
import { toPositiveInteger } from '../utils/validation.js';

const ALLOWED_ORDER_STATUSES = new Set(['draft', 'pending', 'completed', 'cancelled']);
const ORDER_NUMBER_ATTEMPTS = 7;

class HttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

const parseOrderItemsInput = (itemsInput) => {
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
    throw new HttpError(
      400,
      'InvalidItems',
      'The order must include at least one line item.',
    );
  }

  return itemsInput.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new HttpError(
        400,
        'InvalidItem',
        `Item at index ${index} must be an object with productCodeVersionId, qty, and unitPriceCents fields.`,
      );
    }

    const productCodeVersionId = toPositiveInteger(item.productCodeVersionId);
    if (!productCodeVersionId) {
      throw new HttpError(
        400,
        'InvalidItemProduct',
        `Item at index ${index} is missing a valid "productCodeVersionId".`,
      );
    }

    const qty = toPositiveInteger(item.qty);
    if (!qty) {
      throw new HttpError(
        400,
        'InvalidItemQuantity',
        `Item at index ${index} is missing a valid "qty" greater than zero.`,
      );
    }

    let providedUnitPrice = null;
    if (item.unitPriceCents !== undefined) {
      providedUnitPrice = toPositiveInteger(item.unitPriceCents, { allowZero: true });
      if (providedUnitPrice === null) {
        throw new HttpError(
          400,
          'InvalidItemPrice',
          `Item at index ${index} has an invalid "unitPriceCents" value.`,
        );
      }
    }

    return {
      index,
      productCodeVersionId,
      qty,
      providedUnitPrice,
    };
  });
};

const resolveOrderItems = async (branchId, normalizedInputItems) => {
  const versionIds = [...new Set(normalizedInputItems.map((item) => item.productCodeVersionId))];
  const productVersions = await db
    .select({
      id: productCodeVersions.id,
      branchId: productCodeVersions.branchId,
      priceCents: productCodeVersions.priceCents,
      isActive: productCodeVersions.isActive,
    })
    .from(productCodeVersions)
    .where(inArray(productCodeVersions.id, versionIds));

  if (productVersions.length !== versionIds.length) {
    throw new HttpError(
      404,
      'ProductVersionNotFound',
      'One or more product code versions referenced by the items were not found.',
    );
  }

  const versionMap = new Map(productVersions.map((version) => [version.id, version]));

  let subtotalBigInt = 0n;
  let discountBigInt = 0n;

  const orderItemsPayload = normalizedInputItems.map((item) => {
    const version = versionMap.get(item.productCodeVersionId);

    if (!version) {
      throw new HttpError(
        404,
        'ProductVersionNotFound',
        `Product code version ${item.productCodeVersionId} was not found.`,
      );
    }

    if (!version.isActive) {
      throw new HttpError(
        409,
        'ProductVersionInactive',
        `Product code version ${item.productCodeVersionId} is inactive.`,
      );
    }

    if (version.branchId !== branchId) {
      throw new HttpError(
        400,
        'BranchMismatch',
        `Item at index ${item.index} does not belong to branch ${branchId}.`,
      );
    }

    const unitPriceCents = item.providedUnitPrice ?? version.priceCents;
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new HttpError(
        400,
        'InvalidResolvedPrice',
        `Item at index ${item.index} resulted in an invalid unit price.`,
      );
    }

    const lineTotal = BigInt(item.qty) * BigInt(unitPriceCents);
    if (lineTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(
        400,
        'LineTotalOutOfRange',
        `Item at index ${item.index} exceeds the supported monetary range.`,
      );
    }

    subtotalBigInt += lineTotal;

    const listTotal = BigInt(item.qty) * BigInt(version.priceCents);
    if (listTotal > lineTotal) {
      discountBigInt += listTotal - lineTotal;
    }

    return {
      productCodeVersionId: item.productCodeVersionId,
      qty: item.qty,
      unitPriceCents,
      totalCents: Number(lineTotal),
      listPriceCents: version.priceCents,
      overrideApplied: item.providedUnitPrice !== null && item.providedUnitPrice !== version.priceCents,
    };
  });

  if (subtotalBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new HttpError(
      400,
      'SubtotalOutOfRange',
      'The computed order subtotal exceeds the supported monetary range.',
    );
  }

  const subtotalCents = Number(subtotalBigInt);
  const discountCents = discountBigInt > 0n ? Number(discountBigInt) : 0;

  return { orderItemsPayload, subtotalCents, discountCents };
};

const generateOrderNumberCandidate = () => {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const randomSegment = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${timestamp}-${randomSegment}`;
};

const getUniqueOrderNumber = async (tx) => {
  for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt += 1) {
    const candidate = generateOrderNumberCandidate();
    const [existing] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  throw new HttpError(
    500,
    'OrderNumberGenerationFailed',
    'Unable to generate a unique order number at this time. Please retry.',
  );
};

const ordersRouter = Router();

ordersRouter.post('/validate', async (req, res, next) => {
  try {
    const { branchId: branchIdInput, taxCents: taxCentsInput, items: itemsInput } = req.body ?? {};

    const branchId = toPositiveInteger(branchIdInput);
    if (!branchId) {
      return res.status(400).json({
        error: 'InvalidBranchId',
        message: 'The "branchId" field must be a positive integer.',
      });
    }

    const normalizedInputItems = parseOrderItemsInput(itemsInput);
    const { orderItemsPayload, subtotalCents, discountCents } = await resolveOrderItems(branchId, normalizedInputItems);

    let taxCents = 0;
    if (taxCentsInput !== undefined && taxCentsInput !== null) {
      const parsedTax = toPositiveInteger(taxCentsInput, { allowZero: true });
      if (parsedTax === null) {
        return res.status(400).json({
          error: 'InvalidTaxCents',
          message: 'The "taxCents" field must be a non-negative integer when provided.',
        });
      }
      taxCents = parsedTax;
    }

    const totalBigInt = BigInt(subtotalCents) + BigInt(taxCents);
    if (totalBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(
        400,
        'TotalOutOfRange',
        'The computed order total exceeds the supported monetary range.',
      );
    }

    const totalCents = Number(totalBigInt);

    return res.json({
      data: {
        subtotalCents,
        taxCents,
        totalCents,
        discountCents,
        items: orderItemsPayload,
      },
      meta: { validated: true },
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

ordersRouter.post('/', async (req, res, next) => {
  try {
    const {
      branchId: branchIdInput,
      userId: userIdInput,
      customerId: customerIdInput,
      orderNumber: orderNumberInput,
      status: statusInput,
      taxCents: taxCentsInput,
      items: itemsInput,
    } = req.body ?? {};

    const branchId = toPositiveInteger(branchIdInput);
    if (!branchId) {
      return res.status(400).json({
        error: 'InvalidBranchId',
        message: 'The "branchId" field must be a positive integer.',
      });
    }

    const userId = toPositiveInteger(userIdInput);
    if (!userId) {
      return res.status(400).json({
        error: 'InvalidUserId',
        message: 'The "userId" field must be a positive integer.',
      });
    }

    let customerId = null;
    if (customerIdInput !== undefined && customerIdInput !== null) {
      customerId = toPositiveInteger(customerIdInput);
      if (customerId === null) {
        return res.status(400).json({
          error: 'InvalidCustomerId',
          message: 'When provided, "customerId" must be a positive integer.',
        });
      }
    }

    const normalizedInputItems = parseOrderItemsInput(itemsInput);
    const { orderItemsPayload, subtotalCents } = await resolveOrderItems(branchId, normalizedInputItems);

    let taxCents = 0;
    if (taxCentsInput !== undefined && taxCentsInput !== null) {
      const parsedTax = toPositiveInteger(taxCentsInput, { allowZero: true });
      if (parsedTax === null) {
        return res.status(400).json({
          error: 'InvalidTaxCents',
          message: 'The "taxCents" field must be a non-negative integer when provided.',
        });
      }
      taxCents = parsedTax;
    }

    const totalBigInt = BigInt(subtotalCents) + BigInt(taxCents);
    if (totalBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(
        400,
        'TotalOutOfRange',
        'The computed order total exceeds the supported monetary range.',
      );
    }

    const totalCents = Number(totalBigInt);

    let status = 'pending';
    if (typeof statusInput === 'string' && statusInput.trim().length > 0) {
      const normalizedStatus = statusInput.trim().toLowerCase();
      if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
        return res.status(400).json({
          error: 'InvalidStatus',
          message: `Status must be one of: ${Array.from(ALLOWED_ORDER_STATUSES).join(', ')}.`,
        });
      }
      status = normalizedStatus;
    }

    let providedOrderNumber = '';
    if (typeof orderNumberInput === 'string') {
      providedOrderNumber = orderNumberInput.trim();
      if (providedOrderNumber.length > 40) {
        return res.status(400).json({
          error: 'OrderNumberTooLong',
          message: 'The "orderNumber" field must be 40 characters or fewer.',
        });
      }

      if (providedOrderNumber && !/^[A-Za-z0-9_-]+$/.test(providedOrderNumber)) {
        return res.status(400).json({
          error: 'OrderNumberInvalidFormat',
          message: 'The "orderNumber" field may only contain letters, numbers, underscores, or hyphens.',
        });
      }

      providedOrderNumber = providedOrderNumber.toUpperCase();
    }

    const result = await db.transaction(async (tx) => {
      let orderNumber = providedOrderNumber;

      if (orderNumber) {
        const [existing] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.orderNumber, orderNumber))
          .limit(1);

        if (existing) {
          throw new HttpError(
            409,
            'OrderNumberExists',
            `The order number "${orderNumber}" is already in use.`,
          );
        }
      } else {
        orderNumber = await getUniqueOrderNumber(tx);
      }

      const orderInsertResult = await tx
        .insert(orders)
        .values({
          branchId,
          userId,
          customerId,
          orderNumber,
          status,
          subtotalCents,
          taxCents,
          totalCents,
        })
        .execute();

      const orderId = orderInsertResult.insertId;
      if (!orderId) {
        throw new HttpError(
          500,
          'OrderCreationFailed',
          'The order could not be created due to an unexpected error.',
        );
      }

      await tx
        .insert(orderItems)
        .values(
          orderItemsPayload.map((item) => ({
            orderId,
            productCodeVersionId: item.productCodeVersionId,
            qty: item.qty,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
          })),
        )
        .execute();

      const [orderRecord] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          branchId: orders.branchId,
          userId: orders.userId,
          customerId: orders.customerId,
          status: orders.status,
          subtotalCents: orders.subtotalCents,
          taxCents: orders.taxCents,
          totalCents: orders.totalCents,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      return {
        order: orderRecord,
        orderNumber,
        orderId,
      };
    });

    res.status(201).json({
      data: {
        order: result.order,
        items: orderItemsPayload.map((item) => ({
          productCodeVersionId: item.productCodeVersionId,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
          listPriceCents: item.listPriceCents,
          overrideApplied: item.overrideApplied,
        })),
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

export default ordersRouter;
