/**
 * Error Handling & Logging Service
 * Provides centralized error handling, retry logic, and error categorization for ecommerce operations
 */

import { db } from '../../db/connection.js';
import { ecomChannels, ecomChannelLogs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Custom error class for ecommerce operations
 */
export class EcomError extends Error {
  constructor(message, category = 'CRITICAL', code = null, originalError = null) {
    super(message);
    this.name = 'EcomError';
    this.category = category; // AUTH_FAILED, RATE_LIMIT, CRITICAL, VALIDATION
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date();
  }
}

/**
 * Categorize error based on error message and type
 * @param {Error} error - Error object
 * @returns {string} Error category
 */
function categorizeError(error) {
  const message = error.message?.toLowerCase() || '';
  const statusCode = error.response?.status || error.statusCode;

  // Authentication errors
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('token') ||
    message.includes('invalid credentials')
  ) {
    return 'AUTH_FAILED';
  }

  // Rate limiting errors
  if (
    statusCode === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded')
  ) {
    return 'RATE_LIMIT';
  }

  // Validation errors
  if (
    statusCode === 400 ||
    statusCode === 422 ||
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('bad request')
  ) {
    return 'VALIDATION';
  }

  // Default to critical
  return 'CRITICAL';
}

/**
 * Handle sync error - log and update channel status
 * @param {number} channelId - Channel ID
 * @param {Error} error - Error object
 * @param {string} operation - Operation name (e.g., 'sync_inventory', 'sync_orders')
 * @returns {Promise<void>}
 */
export async function handleSyncError(channelId, error, operation) {
  const category = categorizeError(error);

  console.error(`❌ [${category}] Error in ${operation} for channel ${channelId}:`, error.message);

  // Update channel status based on error category
  if (category === 'AUTH_FAILED') {
    await db
      .update(ecomChannels)
      .set({ status: 'error' })
      .where(eq(ecomChannels.id, channelId));
  }

  // Log error to channel logs
  try {
    await db.insert(ecomChannelLogs).values({
      channelId,
      operation,
      status: 'error',
      recordsProcessed: 0,
      recordsFailed: 0,
      errorMessage: error.message,
      metadata: {
        category,
        code: error.code || error.response?.status,
        stack: error.stack,
      },
      startedAt: new Date(),
      completedAt: new Date(),
    });
  } catch (logError) {
    console.error('Failed to log error:', logError.message);
  }

  // TODO: Add alerting for critical errors (email/Slack integration)
  if (category === 'CRITICAL' || category === 'AUTH_FAILED') {
    // await sendAlert({ channelId, error, operation, category });
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @param {string} options.operation - Operation name for logging
 * @returns {Promise<any>} Function result
 */
export async function syncWithRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = null,
    operation = 'unknown',
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Don't retry on auth failures (they won't succeed on retry)
      const category = categorizeError(error);
      if (category === 'AUTH_FAILED') {
        throw error;
      }

      // Don't retry on validation errors (they won't succeed on retry)
      if (category === 'VALIDATION') {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`❌ [${operation}] Failed after ${maxRetries + 1} attempts:`, error.message);
        throw error;
      }

      // Wait before retrying with exponential backoff
      console.warn(`⚠️  [${operation}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Send alert for critical errors (placeholder for email/Slack integration)
 * @param {Object} alertData - Alert data
 * @returns {Promise<void>}
 */
export async function sendAlert(alertData) {
  // TODO: Implement email/Slack alerting
  // Example:
  // if (process.env.SLACK_WEBHOOK_URL) {
  //   await sendSlackMessage({
  //     text: `🚨 Ecommerce Error: ${alertData.operation}`,
  //     fields: [
  //       { title: 'Channel ID', value: alertData.channelId },
  //       { title: 'Category', value: alertData.category },
  //       { title: 'Error', value: alertData.error.message },
  //     ],
  //   });
  // }
  console.warn('🚨 Alert (not implemented):', alertData);
}

