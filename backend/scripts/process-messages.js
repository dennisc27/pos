/**
 * Message Processor Script
 * 
 * Run this script to process pending notification messages.
 * Can be run as a standalone process or scheduled via cron.
 * 
 * Usage:
 *   node scripts/process-messages.js        # Process once
 *   node scripts/process-messages.js --watch # Run continuously
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const watchMode = process.argv.includes('--watch');

if (watchMode) {
  // Run continuously
  const { startMessageProcessor } = await import('../src/workers/message-processor.js');
  startMessageProcessor().catch((error) => {
    console.error('Failed to start message processor:', error);
    process.exit(1);
  });
} else {
  // Run once and exit
  const { db } = await import('../src/db/connection.js');
  const { notificationMessages } = await import('../src/db/schema.js');
  const { eq, and, isNull } = await import('drizzle-orm');
  const { sendMessage } = await import('../src/services/messaging.js');

  try {
    const pendingMessages = await db
      .select()
      .from(notificationMessages)
      .where(
        and(
          eq(notificationMessages.status, 'pending'),
          isNull(notificationMessages.sentAt)
        )
      )
      .limit(10)
      .orderBy(notificationMessages.createdAt);

    if (pendingMessages.length === 0) {
      console.log('No pending messages to process.');
      process.exit(0);
    }

    console.log(`Processing ${pendingMessages.length} message(s)...`);

    for (const message of pendingMessages) {
      try {
        await sendMessage(message.channel, message.recipient, message.message);
        await db
          .update(notificationMessages)
          .set({
            status: 'sent',
            sentAt: new Date(),
            error: null,
          })
          .where(eq(notificationMessages.id, message.id));
        console.log(`✅ Sent message ${message.id}`);
      } catch (error) {
        console.error(`❌ Failed to send message ${message.id}:`, error.message);
        await db
          .update(notificationMessages)
          .set({
            status: 'failed',
            error: error.message,
          })
          .where(eq(notificationMessages.id, message.id));
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error processing messages:', error);
    process.exit(1);
  }
}
