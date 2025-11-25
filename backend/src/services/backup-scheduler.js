import cron from 'node-cron';
import { createDatabaseDump } from './database-dump.js';
import { uploadToS3 } from './cloud-storage.js';
import { db } from '../db/connection.js';
import { settings } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

let scheduledTask = null;

/**
 * Map frequency string to cron schedule
 * @param {string} frequency - Frequency string from settings
 * @returns {string} Cron expression
 */
function getCronSchedule(frequency) {
  switch (frequency) {
    case 'tres veces al dia':
      // 8am, 2pm, 8pm
      return '0 8,14,20 * * *';
    case 'dos veces al dia':
      // 9am, 5pm
      return '0 9,17 * * *';
    case 'diario':
      // 2am daily
      return '0 2 * * *';
    case 'semanal':
      // 2am on Sunday
      return '0 2 * * 0';
    case 'mensual':
      // 2am on 1st of month
      return '0 2 1 * *';
    default:
      // Default to daily at 2am
      return '0 2 * * *';
  }
}

/**
 * Load maintenance settings from database
 * @returns {Promise<Object>} Maintenance settings
 */
async function loadMaintenanceSettings() {
  try {
    const [entry] = await db
      .select({ value: settings.v })
      .from(settings)
      .where(
        and(
          eq(settings.k, 'maintenance.settings'),
          eq(settings.scope, 'global'),
          isNull(settings.branchId),
          isNull(settings.userId)
        )
      )
      .limit(1);

    if (!entry || !entry.value) {
      return null;
    }

    return entry.value;
  } catch (error) {
    console.error('Error loading maintenance settings:', error);
    return null;
  }
}

/**
 * Execute a backup
 * @param {Object} config - Backup configuration
 */
async function executeBackup(config) {
  try {
    console.log(`[Backup Scheduler] Starting scheduled backup at ${new Date().toISOString()}`);

    const {
      backupIdentificador = 'backup',
      backupFolderPath = './backups',
      autoCloudSync = false,
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion,
      awsBucket,
    } = config;

    // Create database dump
    const { filename, filePath, fileSize } = await createDatabaseDump(
      backupFolderPath,
      backupIdentificador
    );

    console.log(`[Backup Scheduler] Database dump created: ${filename} (${fileSize} bytes)`);

    // Upload to S3 if enabled
    if (autoCloudSync && awsAccessKeyId && awsSecretAccessKey && awsBucket && awsRegion) {
      try {
        const s3Result = await uploadToS3(
          filePath,
          awsBucket,
          filename,
          awsAccessKeyId,
          awsSecretAccessKey,
          awsRegion
        );
        console.log(`[Backup Scheduler] Uploaded to S3: ${s3Result.url}`);
      } catch (s3Error) {
        console.error(`[Backup Scheduler] Failed to upload to S3: ${s3Error.message}`);
        // Continue even if S3 upload fails - local backup is still available
      }
    }

    console.log(`[Backup Scheduler] Backup completed successfully: ${filename}`);
  } catch (error) {
    console.error(`[Backup Scheduler] Backup failed: ${error.message}`);
  }
}

/**
 * Start the backup scheduler
 */
export async function startBackupScheduler() {
  // Stop existing scheduler if running
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  // Load settings
  const maintenanceSettings = await loadMaintenanceSettings();

  if (!maintenanceSettings || !maintenanceSettings.backupFrequency) {
    console.log('[Backup Scheduler] No backup frequency configured, scheduler not started');
    return;
  }

  const frequency = maintenanceSettings.backupFrequency;
  const cronSchedule = getCronSchedule(frequency);

  console.log(`[Backup Scheduler] Starting with frequency: ${frequency} (${cronSchedule})`);

  // Schedule the backup task
  // Note: We reload settings on each execution to get the latest configuration
  scheduledTask = cron.schedule(cronSchedule, async () => {
    const currentSettings = await loadMaintenanceSettings();
    if (currentSettings && currentSettings.backupFrequency) {
      await executeBackup(currentSettings);
    } else {
      console.log('[Backup Scheduler] Settings not found or frequency not configured, skipping backup');
    }
  }, {
    scheduled: true,
    timezone: 'America/Santo_Domingo', // Adjust to your timezone
  });

  console.log('[Backup Scheduler] Scheduler started successfully');
}

/**
 * Stop the backup scheduler
 */
export function stopBackupScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Backup Scheduler] Scheduler stopped');
  }
}

/**
 * Restart the backup scheduler (useful when settings change)
 */
export async function restartBackupScheduler() {
  stopBackupScheduler();
  await startBackupScheduler();
}

