import express from 'express';
import { createDatabaseDump } from '../services/database-dump.js';
import { uploadToS3 } from '../services/cloud-storage.js';
import { db } from '../db/connection.js';
import { settings } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { restartBackupScheduler } from '../services/backup-scheduler.js';

const router = express.Router();

/**
 * Load maintenance settings from database
 */
async function loadMaintenanceSettings() {
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
}

/**
 * POST /api/backup/create
 * Create a manual backup
 */
router.post('/create', async (req, res, next) => {
  try {
    const maintenanceSettings = await loadMaintenanceSettings();

    if (!maintenanceSettings) {
      return res.status(400).json({
        error: 'Maintenance settings not configured',
      });
    }

    const {
      backupIdentificador = 'backup',
      backupFolderPath = './backups',
      autoCloudSync = false,
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion,
      awsBucket,
    } = maintenanceSettings;

    // Create database dump
    const { filename, filePath, fileSize } = await createDatabaseDump(
      backupFolderPath,
      backupIdentificador
    );

    const result = {
      filename,
      filePath,
      fileSize,
      createdAt: new Date().toISOString(),
      cloudUrl: null,
    };

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
        result.cloudUrl = s3Result.url;
      } catch (s3Error) {
        // Log error but don't fail the request - local backup was successful
        console.error('Failed to upload to S3:', s3Error.message);
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup/restart-scheduler
 * Restart the backup scheduler (called when settings are updated)
 */
router.post('/restart-scheduler', async (req, res, next) => {
  try {
    await restartBackupScheduler();
    res.json({ message: 'Backup scheduler restarted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

