import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { B2File } from './types';

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || 'us-west-004',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME || 'cv-uploads';
const CV_RAW_PREFIX = process.env.B2_BUCKET_CV_RAW || 'cv-raw';
const CV_FINAL_PREFIX = process.env.B2_BUCKET_CV_FINAL || 'cv-final';

export async function listRawCVs(): Promise<B2File[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: `${CV_RAW_PREFIX}/`,
  });

  const response = await s3Client.send(command);

  if (!response.Contents) {
    return [];
  }

  return response.Contents
    .filter(obj => obj.Key && !obj.Key.endsWith('/'))
    .map(obj => ({
      key: obj.Key!,
      name: obj.Key!.replace(`${CV_RAW_PREFIX}/`, ''),
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
}

export async function downloadFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`Failed to download file: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return the full URL
  return `${process.env.B2_ENDPOINT}/${BUCKET_NAME}/${key}`;
}

export async function uploadFinalCV(
  filename: string,
  buffer: Buffer
): Promise<{ key: string; url: string }> {
  const key = `${CV_FINAL_PREFIX}/${filename}`;
  const url = await uploadFile(
    key,
    buffer,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  return { key, url };
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Renames a file by copying to new key and deleting the old one.
 * Returns the new URL and any deletion error that occurred.
 * Deletion failures are logged but do not throw - the rename is considered
 * successful if the new file was created.
 */
export async function renameFile(
  oldKey: string,
  newKey: string,
  contentType: string
): Promise<{ url: string; deleteError?: Error }> {
  const buffer = await downloadFile(oldKey);
  const url = await uploadFile(newKey, buffer, contentType);
  try {
    await deleteFile(oldKey);
    return { url };
  } catch (deleteError) {
    const error = deleteError instanceof Error ? deleteError : new Error(String(deleteError));
    console.error('File renamed but old file could not be deleted:', {
      oldKey,
      newKey,
      error: error.message,
    });
    return { url, deleteError: error };
  }
}

export function getRawCVKey(filename: string): string {
  return `${CV_RAW_PREFIX}/${filename}`;
}

export function getFinalCVKey(filename: string): string {
  return `${CV_FINAL_PREFIX}/${filename}`;
}

export { s3Client, BUCKET_NAME, CV_RAW_PREFIX, CV_FINAL_PREFIX };
