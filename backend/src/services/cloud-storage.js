import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

/**
 * Upload a file to AWS S3
 * @param {string} filePath - Local file path to upload
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key (filename in bucket)
 * @param {string} accessKeyId - AWS Access Key ID
 * @param {string} secretAccessKey - AWS Secret Access Key
 * @param {string} region - AWS region
 * @returns {Promise<{url: string, key: string}>}
 */
export async function uploadToS3(filePath, bucket, key, accessKeyId, secretAccessKey, region) {
  if (!accessKeyId || !secretAccessKey || !bucket || !region) {
    throw new Error('AWS credentials and bucket configuration are required');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    // Initialize S3 client
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Read file content
    const fileContent = fs.readFileSync(filePath);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: 'application/sql',
    });

    await s3Client.send(command);

    // Construct S3 URL
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      url,
      key,
    };
  } catch (error) {
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

