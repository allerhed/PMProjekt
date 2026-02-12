import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';
import s3Client from '../config/s3';
import config from '../config';
import { logger } from '../utils/logger';

const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes in seconds

function isLocalStorage(): boolean {
  return config.storage.provider === 'local';
}

/**
 * Resolve a storage key to an absolute local filesystem path.
 */
function localFilePath(key: string): string {
  return path.join(config.storage.localPath, key);
}

/**
 * Rewrite internal Docker endpoint (e.g. http://minio:9000) to the
 * browser-accessible public endpoint (e.g. http://localhost:9000)
 * so presigned URLs work from the client.
 */
function rewriteUrlForClient(url: string): string {
  const { publicEndpoint, endpoint } = config.aws.s3;
  if (publicEndpoint && endpoint) {
    return url.replace(endpoint, publicEndpoint);
  }
  return url;
}

export interface UploadTokenPayload {
  key: string;
  contentType: string;
  contentLength: number;
  purpose: 'storage-upload';
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

/**
 * Build the S3 key for a resource.
 * Pattern: {type}/{orgId}/{parentId}/{resourceId}/{filename}
 */
export function buildS3Key(
  type: 'blueprints' | 'photos' | 'protocols' | 'product-images',
  orgId: string,
  parentId: string,
  resourceId: string,
  filename: string,
): string {
  return `${type}/${orgId}/${parentId}/${resourceId}/${filename}`;
}

/**
 * Generate a presigned URL for uploading a file directly to S3,
 * or a signed token URL for local storage.
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<PresignedUploadResult> {
  const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString();

  if (isLocalStorage()) {
    const token = jwt.sign(
      { key, contentType, contentLength, purpose: 'storage-upload' } as UploadTokenPayload,
      config.jwt.secret,
      { expiresIn: PRESIGNED_URL_EXPIRY },
    );
    const uploadUrl = `${config.storage.publicUrl}/api/v1/storage/upload/${token}`;
    return { uploadUrl, key, expiresAt };
  }

  const command = new PutObjectCommand({
    Bucket: config.aws.s3.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  return { uploadUrl: rewriteUrlForClient(uploadUrl), key, expiresAt };
}

/**
 * Generate a presigned URL for downloading a file from S3,
 * or a direct file-serving URL for local storage.
 */
export async function generatePresignedDownloadUrl(key: string): Promise<string> {
  if (isLocalStorage()) {
    const encodedKey = Buffer.from(key).toString('base64url');
    return `${config.storage.publicUrl}/api/v1/storage/files/${encodedKey}`;
  }

  const command = new GetObjectCommand({
    Bucket: config.aws.s3.bucket,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  return rewriteUrlForClient(url);
}

/**
 * Check if a file exists in S3 or on local filesystem.
 * Returns the content length if exists, null otherwise.
 */
export async function checkFileExists(key: string): Promise<number | null> {
  if (isLocalStorage()) {
    try {
      const stat = await fs.stat(localFilePath(key));
      return stat.size;
    } catch {
      return null;
    }
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: config.aws.s3.bucket,
      Key: key,
    });
    const response = await s3Client.send(command);
    return response.ContentLength ?? null;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Delete an object from S3 or local filesystem.
 */
export async function deleteObject(key: string): Promise<void> {
  if (isLocalStorage()) {
    try {
      await fs.unlink(localFilePath(key));
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logger.error({ err, key }, 'Failed to delete local file');
        throw err;
      }
    }
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3.bucket,
      Key: key,
    });
    await s3Client.send(command);
  } catch (err) {
    logger.error({ err, key }, 'Failed to delete S3 object');
    throw err;
  }
}

/**
 * Read a file from S3 or local filesystem.
 * Used by thumbnail service and other internal consumers.
 */
export async function readFile(key: string): Promise<Buffer> {
  if (isLocalStorage()) {
    return fs.readFile(localFilePath(key));
  }

  const command = new GetObjectCommand({
    Bucket: config.aws.s3.bucket,
    Key: key,
  });
  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`Empty body for S3 key: ${key}`);
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Write a file to S3 or local filesystem.
 * Used by thumbnail service, protocol service, and the local upload route.
 */
export async function writeFile(key: string, data: Buffer, contentType: string): Promise<void> {
  if (isLocalStorage()) {
    const filePath = localFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    logger.debug({ key, size: data.length }, 'File written to local storage');
    return;
  }

  const command = new PutObjectCommand({
    Bucket: config.aws.s3.bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  });
  await s3Client.send(command);
}
