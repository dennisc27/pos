import { Router } from 'express';
import { and, eq, like, or } from 'drizzle-orm';

import { db } from '../db/connection.js';
import { productCodes, productCodeVersions } from '../db/schema.js';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

const productsRouter = Router();

productsRouter.get('/', async (req, res, next) => {
  try {
    const queryParam = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!queryParam) {
      return res.status(400).json({
        error: 'MissingQuery',
        message: 'The "q" query parameter is required to search products by code, SKU, or name.',
      });
    }

    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, MAX_LIMIT))
      : DEFAULT_LIMIT;

    let branchIdNumber;
    if (typeof req.query.branchId === 'string' && req.query.branchId.trim().length > 0) {
      branchIdNumber = Number.parseInt(req.query.branchId, 10);
      if (!Number.isInteger(branchIdNumber) || branchIdNumber <= 0) {
        return res.status(400).json({
          error: 'InvalidBranchId',
          message: 'The "branchId" query parameter must be a positive integer when provided.',
        });
      }
    }

    const likeTerm = `%${queryParam}%`;

    const joinConditions = [eq(productCodeVersions.productCodeId, productCodes.id)];
    if (branchIdNumber !== undefined) {
      joinConditions.push(eq(productCodeVersions.branchId, branchIdNumber));
    }

    const joinCondition =
      joinConditions.length === 1 ? joinConditions[0] : and(...joinConditions);

    const statement = db
      .select({
        id: productCodes.id,
        code: productCodes.code,
        name: productCodes.name,
        sku: productCodes.sku,
        description: productCodes.description,
        versionId: productCodeVersions.id,
        branchId: productCodeVersions.branchId,
        priceCents: productCodeVersions.priceCents,
        costCents: productCodeVersions.costCents,
        qtyOnHand: productCodeVersions.qtyOnHand,
        qtyReserved: productCodeVersions.qtyReserved,
        isActive: productCodeVersions.isActive,
      })
      .from(productCodes)
      .leftJoin(productCodeVersions, joinCondition)
      .where(
        or(
          like(productCodes.name, likeTerm),
          like(productCodes.code, likeTerm),
          like(productCodes.sku, likeTerm),
        ),
      )
      .orderBy(productCodes.name)
      .limit(limit);

    const results = await statement;

    res.json({
      data: results,
      meta: {
        query: queryParam,
        branchId: branchIdNumber,
        limit,
        count: results.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default productsRouter;

