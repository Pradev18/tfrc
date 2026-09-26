import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export function isR2Configured(): boolean {
  return (
    (process.env.MEDIA_STORAGE || "").toLowerCase() === "r2" &&
    Boolean(
      process.env.R2_ACCOUNT_ID?.trim() &&
        process.env.R2_ACCESS_KEY_ID?.trim() &&
        process.env.R2_SECRET_ACCESS_KEY?.trim() &&
        process.env.R2_BUCKET?.trim() &&
        process.env.R2_PUBLIC_URL?.trim()
    )
  );
}

function r2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

function publicBaseUrl(): string {
  return process.env.R2_PUBLIC_URL!.trim().replace(/\/+$/, "");
}

/** Upload bytes to Cloudflare R2 and return the public HTTPS URL. */
export async function uploadBufferToR2(opts: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured (MEDIA_STORAGE=r2 + R2_* env vars).");
  }

  const bucket = process.env.R2_BUCKET!.trim();
  await r2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${publicBaseUrl()}/${opts.key.replace(/^\/+/, "")}`;
}
