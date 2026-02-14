import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import config from './index';

let blobServiceClient: BlobServiceClient;
let sharedKeyCredential: StorageSharedKeyCredential | null = null;

if (config.azure.storage.connectionString) {
  blobServiceClient = BlobServiceClient.fromConnectionString(
    config.azure.storage.connectionString,
  );
}

if (config.azure.storage.accountName && config.azure.storage.accountKey) {
  sharedKeyCredential = new StorageSharedKeyCredential(
    config.azure.storage.accountName,
    config.azure.storage.accountKey,
  );
  if (!blobServiceClient!) {
    blobServiceClient = new BlobServiceClient(
      `https://${config.azure.storage.accountName}.blob.core.windows.net`,
      sharedKeyCredential,
    );
  }
}

// Fallback for local dev when storage provider is 'local'
if (!blobServiceClient!) {
  blobServiceClient = new BlobServiceClient(
    'https://devstoreaccount1.blob.core.windows.net',
  );
}

export const containerClient = blobServiceClient.getContainerClient(
  config.azure.storage.container,
);

export { sharedKeyCredential, blobServiceClient };
