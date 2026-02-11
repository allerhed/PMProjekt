import { S3Client } from '@aws-sdk/client-s3';
import config from './index';

const s3ClientConfig: ConstructorParameters<typeof S3Client>[0] = {
  region: config.aws.region,
};

// Use MinIO endpoint in development
if (config.aws.s3.endpoint) {
  s3ClientConfig.endpoint = config.aws.s3.endpoint;
  s3ClientConfig.forcePathStyle = true; // Required for MinIO
}

if (config.aws.s3.accessKeyId && config.aws.s3.secretAccessKey) {
  s3ClientConfig.credentials = {
    accessKeyId: config.aws.s3.accessKeyId,
    secretAccessKey: config.aws.s3.secretAccessKey,
  };
}

const s3Client = new S3Client(s3ClientConfig);

export default s3Client;
