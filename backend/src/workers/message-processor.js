/**
 * Message Processor Worker
 * 
 * This worker processes pending notification messages from the queue
 * and sends them via the appropriate messaging service.
 * 
 * Run this as a separate process or scheduled job (e.g., via cron, PM2, etc.)
 */

import { db } from '../db/connection.js';
import { notificationMessages } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { sendMessage } from '../services/messaging.js';

const PROCESSING_INTERVAL_MS = 5000; // Process every 5 seconds
const MAX_RETRIES = 3;
const BATCH_SIZE = 10; // Process up to 10 messages at a time

/**
 * Process a single notification message
 */
async function processMessage(message) {
  try {
    console.log(`Processing message ${message.id} via ${message.channel} to ${message.recipient}`);

    // Send the message via the appropriate channel
    const result = await sendMessage(
      message.channel,
      message.recipient,
      message.message
    );

    // Update message status to 'sent'
    await db
      .update(notificationMessages)
      .set({
        status: 'sent',
        sentAt: new Date(),
        error: null,
      })
      .where(eq(notificationMessages.id, message.id));

    console.log(`✅ Message ${message.id} sent successfully (${result.provider})`);
    return { success: true, messageId: message.id, result };
  } catch (error) {
    console.error(`❌ Failed to send message ${message.id}:`, error.message);

    // Determine if we should retry
    const retryCount = (message.error ? JSON.parse(message.error).retryCount || 0 : 0) + 1;
    const shouldRetry = retryCount < MAX_RETRIES;

    // Update message status
    await db
      .update(notificationMessages)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        error: JSON.stringify({
          message: error.message,
          retryCount,
          lastAttempt: new Date().toISOString(),
        }),
      })
      .where(eq(notificationMessages.id, message.id));

    if (shouldRetry) {
      console.log(`🔄 Message ${message.id} will be retried (attempt ${retryCount}/${MAX_RETRIES})`);
    } else {
      console.log(`❌ Message ${message.id} failed after ${retryCount} attempts`);
    }

    return { success: false, messageId: message.id, error: error.message };
  }
}

/**
 * Process pending messages
 */
async function processPendingMessages() {
  try {
    // Fetch pending messages
    const pendingMessages = await db
      .select()
      .from(notificationMessages)
      .where(
        and(
          eq(notificationMessages.status, 'pending'),
          isNull(notificationMessages.sentAt)
        )
      )
      .limit(BATCH_SIZE)
      .orderBy(notificationMessages.createdAt);

    if (pendingMessages.length === 0) {
      return;
    }

    console.log(`📨 Processing ${pendingMessages.length} pending message(s)...`);

    // Process messages sequentially to avoid rate limits
    for (const message of pendingMessages) {
      await processMessage(message);
      // Small delay between messages to avoid overwhelming the provider
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('Error processing messages:', error);
  }
}

/**
 * Start the message processor
 */
export async function startMessageProcessor() {
  console.log('🚀 Starting message processor...');
  console.log(`⏱️  Processing interval: ${PROCESSING_INTERVAL_MS}ms`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`🔄 Max retries: ${MAX_RETRIES}`);

  // Process immediately on start
  await processPendingMessages();

  // Then process on interval
  const intervalId = setInterval(async () => {
    await processPendingMessages();
  }, PROCESSING_INTERVAL_MS);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping message processor...');
    clearInterval(intervalId);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping message processor...');
    clearInterval(intervalId);
    process.exit(0);
  });
}

// Export functions for use in scripts
export { startMessageProcessor, processPendingMessages };

