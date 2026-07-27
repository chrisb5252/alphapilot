import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

function encryptionKey() {
  const value = process.env.PROVIDER_SECRETS_ENCRYPTION_KEY;
  if (!value) throw new Error("PROVIDER_SECRETS_ENCRYPTION_KEY is required for brokerage connections.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("PROVIDER_SECRETS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptProviderSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptProviderSecret(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Invalid encrypted provider secret.");
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64")), decipher.final()]).toString("utf8");
}
