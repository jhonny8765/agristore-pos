/**
 * Optional client-side backup encryption. This does not change the existing
 * recovery JSON protocol; integration must preserve legacy restore support.
 * No key or passphrase is persisted or sent to the server.
 */
export const BACKUP_ENCRYPTION_FORMAT = "agristore-recovery-encrypted";
const VERSION = 1;
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MAX_CIPHERTEXT_BASE64 = 96 * 1024 * 1024;
const encoding = new TextEncoder();

export type EncryptedRecoveryBackup = {
  format: typeof BACKUP_ENCRYPTION_FORMAT;
  version: 1;
  cipher: "AES-256-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: typeof ITERATIONS;
  salt: string;
  iv: string;
  ciphertext: string;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
function fromBase64(value: string, limit: number): Uint8Array {
  if (!/^[a-zA-Z0-9+/]*={0,2}$/.test(value) || value.length > limit || value.length % 4 !== 0)
    throw new Error("Invalid encrypted backup");
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
function validatePassphrase(passphrase: string) {
  if (Array.from(passphrase).length < 12 || passphrase.length > 1024)
    throw new Error("Choose a unique backup passphrase of at least 12 characters.");
}
async function keyFor(passphrase: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", encoding.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2",salt:new Uint8Array(salt),iterations:ITERATIONS,hash:"SHA-256"},
    base,
    {name:"AES-GCM",length:256},
    false,
    ["encrypt","decrypt"],
  );
}

export function isEncryptedRecoveryBackup(value: unknown): value is EncryptedRecoveryBackup {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string,unknown>;
  return item.format === BACKUP_ENCRYPTION_FORMAT;
}

function requireEnvelope(value: unknown): EncryptedRecoveryBackup {
  if (!isEncryptedRecoveryBackup(value)) throw new Error("Not an encrypted recovery backup");
  const item = value as EncryptedRecoveryBackup;
  if (item.version !== VERSION || item.cipher !== "AES-256-GCM" ||
      item.kdf !== "PBKDF2-SHA256" || item.iterations !== ITERATIONS ||
      typeof item.salt !== "string" || typeof item.iv !== "string" ||
      typeof item.ciphertext !== "string" || item.ciphertext.length > MAX_CIPHERTEXT_BASE64)
    throw new Error("Unsupported or invalid encrypted backup");
  return item;
}

export async function encryptRecoveryBackup(data: unknown, passphrase: string): Promise<EncryptedRecoveryBackup> {
  validatePassphrase(passphrase);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await keyFor(passphrase,salt);
  const clear = encoding.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    {name:"AES-GCM",iv,additionalData:encoding.encode(`${BACKUP_ENCRYPTION_FORMAT}:${VERSION}`)},
    key,clear,
  );
  return {format:BACKUP_ENCRYPTION_FORMAT,version:1,cipher:"AES-256-GCM",kdf:"PBKDF2-SHA256",
    iterations:ITERATIONS,salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(ciphertext))};
}

export async function decryptRecoveryBackup(envelope: unknown, passphrase: string): Promise<unknown> {
  const file=requireEnvelope(envelope);
  // Reject malformed files before the expensive key derivation.
  const salt=fromBase64(file.salt,24),iv=fromBase64(file.iv,16);
  if(salt.length!==SALT_BYTES || iv.length!==IV_BYTES)throw new Error("Invalid encrypted backup");
  const ciphertext=fromBase64(file.ciphertext,MAX_CIPHERTEXT_BASE64);
  try {
    const key=await keyFor(passphrase,salt);
    const clear=await crypto.subtle.decrypt(
      {name:"AES-GCM",iv,additionalData:encoding.encode(`${BACKUP_ENCRYPTION_FORMAT}:${VERSION}`)},
      key,ciphertext,
    );
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(clear)) as unknown;
  } catch {
    throw new Error("Cannot decrypt backup. Check the passphrase and file integrity.");
  }
}
