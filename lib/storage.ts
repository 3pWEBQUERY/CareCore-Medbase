import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Bilder in einem S3-kompatiblen Bucket (Railway Bucket). Eingerichtet über S3_ENDPOINT, S3_BUCKET, S3_REGION,
// S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY (S3_FORCE_PATH_STYLE=true für Pfad-Adressen). Der Bucket ist privat;
// ausgeliefert wird über /api/bilder/… mit langen Cache-Zeiten. Ohne Bucket (lokal, Tests) liegen die Bilder in der
// Datenbank.

let client: S3Client | null = null;

function config() {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    bucket: S3_BUCKET,
    endpoint: S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

export const storageConfigured = () => config() !== null;

function s3() {
  const settings = config();
  if (!settings) throw new Error("STORAGE_NOT_CONFIGURED");
  client ??= new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: settings.forcePathStyle,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  });
  return { client, bucket: settings.bucket };
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const { client, bucket } = s3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function getObject(key: string): Promise<Buffer | null> {
  const { client, bucket } = s3();
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return result.Body ? Buffer.from(await result.Body.transformToByteArray()) : null;
  } catch (error) {
    if ((error as { name?: string }).name === "NoSuchKey") return null;
    throw error;
  }
}

// Nach dem Löschen in der Datenbank; ein Fehler des Buckets verhindert das Löschen nicht, wird aber gemeldet.
export async function deleteObjects(keys: (string | null | undefined)[]) {
  const list = keys.filter((key): key is string => typeof key === "string" && key.length > 0);
  if (!list.length || !storageConfigured()) return;
  const { client, bucket } = s3();
  await Promise.all(
    list.map((key) =>
      client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        .catch((error) => console.error("Bucket delete failed", key, error)),
    ),
  );
}
