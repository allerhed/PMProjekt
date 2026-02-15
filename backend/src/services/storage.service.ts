import {
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from '@azure/storage-blob';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';
import { containerClient, sharedKeyCredential } from '../config/azure-storage';
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
 * Build the storage key for a resource.
 * Pattern: {type}/{orgId}/{parentId}/{resourceId}/{filename}
 */
export function buildS3Key(
  type: 'blueprints' | 'photos' | 'protocols' | 'product-images' | 'project-images' | 'org-logos' | 'backups' | 'bug-screenshots',
  orgId: string,
  parentId: string,
  resourceId: string,
  filename: string,
): string {
  return `${type}/${orgId}/${parentId}/${resourceId}/${filename}`;
}

/**
 * Generate a SAS URL for uploading a file directly to Azure Blob Storage,
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

  if (!sharedKeyCredential) {
    throw new Error('Azure storage credentials not configured');
  }

  const blockBlobClient = containerClient.getBlockBlobClient(key);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: containerClient.containerName,
      blobName: key,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000),
      contentType,
      protocol: SASProtocol.Https,
    },
    sharedKeyCredential,
  ).toString();

  const uploadUrl = `${blockBlobClient.url}?${sasToken}`;
  return { uploadUrl, key, expiresAt };
}

/**
 * Generate a SAS URL for downloading a file from Azure Blob Storage,
 * or a direct file-serving URL for local storage.
 */
export async function generatePresignedDownloadUrl(key: string): Promise<string> {
  if (isLocalStorage()) {
    const encodedKey = Buffer.from(key).toString('base64url');
    return `${config.storage.publicUrl}/api/v1/storage/files/${encodedKey}`;
  }

  if (!sharedKeyCredential) {
    throw new Error('Azure storage credentials not configured');
  }

  const blobClient = containerClient.getBlobClient(key);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: containerClient.containerName,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000),
      protocol: SASProtocol.Https,
    },
    sharedKeyCredential,
  ).toString();

  return `${blobClient.url}?${sasToken}`;
}

/**
 * Check if a file exists in Azure Blob Storage or on local filesystem.
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
    const blobClient = containerClient.getBlobClient(key);
    const properties = await blobClient.getProperties();
    return properties.contentLength ?? null;
  } catch (err: any) {
    if (err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Delete an object from Azure Blob Storage or local filesystem.
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
    const blobClient = containerClient.getBlobClient(key);
    await blobClient.deleteIfExists();
  } catch (err) {
    logger.error({ err, key }, 'Failed to delete blob');
    throw err;
  }
}

/**
 * Read a file from Azure Blob Storage or local filesystem.
 */
export async function readFile(key: string): Promise<Buffer> {
  if (isLocalStorage()) {
    return fs.readFile(localFilePath(key));
  }

  const blobClient = containerClient.getBlobClient(key);
  const downloadResponse = await blobClient.download(0);

  if (!downloadResponse.readableStreamBody) {
    throw new Error(`Empty body for blob key: ${key}`);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Write a file to Azure Blob Storage or local filesystem.
 */
export async function writeFile(key: string, data: Buffer, contentType: string): Promise<void> {
  if (isLocalStorage()) {
    const filePath = localFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    logger.debug({ key, size: data.length }, 'File written to local storage');
    return;
  }

  const blockBlobClient = containerClient.getBlockBlobClient(key);
  await blockBlobClient.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}
