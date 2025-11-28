/**
 * Sync Queue Service (Optional - Bull/Redis)
 * Provides job queue for async sync operations
 * Falls back to direct execution if Redis is not available
 */

let queue = null;
let redisAvailable = false;

/**
 * Initialize queue with Redis connection
 * @param {Object} redisConfig - Redis configuration
 * @returns {Promise<boolean>} True if queue initialized successfully
 */
export async function initializeQueue(redisConfig = {}) {
  try {
    // Try to import Bull (optional dependency)
    const { default: Queue } = await import('bull');
    
    const config = {
      host: redisConfig.host || process.env.REDIS_HOST || 'localhost',
      port: redisConfig.port || process.env.REDIS_PORT || 6379,
      password: redisConfig.password || process.env.REDIS_PASSWORD,
      db: redisConfig.db || process.env.REDIS_DB || 0,
    };

    queue = new Queue('ecom-sync', {
      redis: config,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Test Redis connection
    await queue.client.ping();
    redisAvailable = true;

    console.log('✅ Redis queue initialized successfully');
    return true;
  } catch (error) {
    console.warn('⚠️  Redis not available, queue operations will execute directly:', error.message);
    redisAvailable = false;
    return false;
  }
}

/**
 * Process sync-listings job
 * @param {Object} job - Bull job object
 * @returns {Promise<Object>} Job result
 */
async function processSyncListings(job) {
  const { channelId, listingIds } = job.data;
  
  // Import sync functions
  const { syncInventoryForChannel } = await import('./sync-scheduler.js');
  const { db } = await import('../../db/connection.js');
  const { ecomChannels } = await import('../../db/schema.js');
  const { eq } = await import('drizzle-orm');

  const [channel] = await db
    .select()
    .from(ecomChannels)
    .where(eq(ecomChannels.id, channelId))
    .limit(1);

  if (!channel) {
    throw new Error(`Channel ${channelId} not found`);
  }

  // Sync specific listings or all active listings
  if (listingIds && listingIds.length > 0) {
    // TODO: Implement selective listing sync
    // For now, sync all active listings
  }

  return await syncInventoryForChannel(channel);
}

/**
 * Process sync-orders job
 * @param {Object} job - Bull job object
 * @returns {Promise<Object>} Job result
 */
async function processSyncOrders(job) {
  const { channelId } = job.data;
  
  // Import sync functions
  const { syncOrdersForChannel } = await import('./sync-scheduler.js');
  const { db } = await import('../../db/connection.js');
  const { ecomChannels } = await import('../../db/schema.js');
  const { eq } = await import('drizzle-orm');

  const [channel] = await db
    .select()
    .from(ecomChannels)
    .where(eq(ecomChannels.id, channelId))
    .limit(1);

  if (!channel) {
    throw new Error(`Channel ${channelId} not found`);
  }

  return await syncOrdersForChannel(channel);
}

/**
 * Start queue processors
 */
export function startQueueProcessors() {
  if (!redisAvailable || !queue) {
    console.warn('⚠️  Queue processors not started (Redis not available)');
    return;
  }

  // Process sync-listings jobs
  queue.process('sync-listings', async (job) => {
    console.log(`📦 Processing sync-listings job for channel ${job.data.channelId}`);
    return await processSyncListings(job);
  });

  // Process sync-orders jobs
  queue.process('sync-orders', async (job) => {
    console.log(`📋 Processing sync-orders job for channel ${job.data.channelId}`);
    return await processSyncOrders(job);
  });

  // Handle job completion
  queue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
  });

  // Handle job failure
  queue.on('failed', (job, error) => {
    console.error(`❌ Job ${job.id} failed:`, error.message);
  });

  console.log('✅ Queue processors started');
}

/**
 * Queue listing sync job
 * @param {number} channelId - Channel ID
 * @param {number[]} listingIds - Listing IDs to sync (optional, syncs all if not provided)
 * @returns {Promise<Object>} Job info or direct result
 */
export async function queueListingSync(channelId, listingIds = null) {
  if (!redisAvailable || !queue) {
    // Fallback to direct execution
    console.warn('⚠️  Executing listing sync directly (queue not available)');
    const { syncInventoryForChannel } = await import('./sync-scheduler.js');
    const { db } = await import('../../db/connection.js');
    const { ecomChannels } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    return await syncInventoryForChannel(channel);
  }

  const job = await queue.add('sync-listings', {
    channelId,
    listingIds,
  }, {
    priority: listingIds ? 10 : 5, // Higher priority for specific listings
  });

  return {
    jobId: job.id,
    status: 'queued',
  };
}

/**
 * Queue order sync job
 * @param {number} channelId - Channel ID
 * @returns {Promise<Object>} Job info or direct result
 */
export async function queueOrderSync(channelId) {
  if (!redisAvailable || !queue) {
    // Fallback to direct execution
    console.warn('⚠️  Executing order sync directly (queue not available)');
    const { syncOrdersForChannel } = await import('./sync-scheduler.js');
    const { db } = await import('../../db/connection.js');
    const { ecomChannels } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    return await syncOrdersForChannel(channel);
  }

  const job = await queue.add('sync-orders', {
    channelId,
  }, {
    priority: 5,
  });

  return {
    jobId: job.id,
    status: 'queued',
  };
}

/**
 * Get queue status
 * @returns {Promise<Object>} Queue status
 */
export async function getQueueStatus() {
  if (!redisAvailable || !queue) {
    return {
      available: false,
      message: 'Queue not available (Redis not configured)',
    };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return {
    available: true,
    waiting,
    active,
    completed,
    failed,
  };
}

/**
 * Close queue connection
 */
export async function closeQueue() {
  if (queue) {
    await queue.close();
    console.log('✅ Queue connection closed');
  }
}

