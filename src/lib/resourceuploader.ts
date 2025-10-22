import axios from "axios";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "../../config";
import { v4 as uuidv4 } from "uuid";
import { withRetry } from "./utils";
import path from "path";
import { Readable } from "stream";

// Generate a random string of specified length
function makeid(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

const s3client = new S3Client({
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_KEY_ID!,
  },
  forcePathStyle: false,
});

export async function deleteFileFromBucket(
  url: string,
  dryRun = false
): Promise<void> {
  try {
    const key = extractKeyFromUrl(url);
    if (!key) {
      console.warn(`Could not extract key from URL: ${url}`);
      return;
    }

    if (dryRun) {
      console.log(`[dry run] Would delete file from bucket: ${key}`);
      return;
    }

    await s3client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      })
    );
    console.log(`✓ Deleted old file from bucket: ${key}`);
  } catch (error) {
    console.error(`Failed to delete file from bucket: ${url}`, error);
  }
}

function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === new URL(env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname) {
      return urlObj.pathname.substring(1);
    }
  } catch (error) {
    console.error(`Invalid URL: ${url}`);
  }
  return null;
}

export async function uploadFile(
  fileUrl: string,
  dryRun = false
): Promise<string> {
  return await withRetry(async () => {
    // Extract filename from URL
    const urlPath = new URL(fileUrl).pathname;
    const filename = path.basename(urlPath) || `file-${Date.now()}`;

    // Generate resource ID and construct file path
    const resourceId = uuidv4();
    const _filePath = `resources/${resourceId}`;

    // Parse filename components
    const extension = filename.split(".").pop() || "bin";
    const _filename = filename.split(".")[0] || "unnamed";
    const key = `${_filename}-${makeid(6)}`;

    // Full key with path
    const fullKey = `${_filePath}/${key}.${extension}`;
    const publicUrl = `${env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fullKey}`;

    if (dryRun) {
      console.log(`[dry run] Would upload ${filename} to ${fullKey}`);
      console.log(`[dry run] Would return URL: ${publicUrl}`);
      return publicUrl;
    }

    console.log(`Uploading ${filename} to ${fullKey}`);

    const res = await axios.get(fileUrl, {
      responseType: "stream",
      timeout: 60_000,
    });
    const stream = res.data as Readable;
    const contentType =
      (res.headers["content-type"] as string) || "application/octet-stream";

    const uploader = new Upload({
      client: s3client,
      params: {
        Bucket: env.R2_BUCKET_NAME,
        Key: fullKey,
        Body: stream,
        ContentType: contentType,
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    });

    await uploader.done();
    console.log(`Upload complete: ${publicUrl}`);
    return publicUrl;
  }, `upload file ${fileUrl}`);
}
