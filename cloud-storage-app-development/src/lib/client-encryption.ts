const KDF_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AES_KEY_BYTES = 32;
const encoder = new TextEncoder();

export type KeyEnvelope = {
  version: 1;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  wrappedKey: string;
};

export type VaultSetup = {
  keyEnvelope: KeyEnvelope;
  recoveryEnvelope: KeyEnvelope;
  recoveryKey: string;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveWrappingKey(secret: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function wrapKey(rawVaultKey: Uint8Array, secret: string): Promise<KeyEnvelope> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrappingKey = await deriveWrappingKey(secret, salt, KDF_ITERATIONS);
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, rawVaultKey);
  return {
    version: 1,
    kdf: "PBKDF2-SHA-256",
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    wrappedKey: toBase64(new Uint8Array(wrapped)),
  };
}

/** Create a random vault key and two independently salted, client-side wraps. */
export async function createVault(passphrase: string): Promise<VaultSetup> {
  if (passphrase.length < 12) throw new Error("passphrase_too_short");
  const vaultKey = randomBytes(AES_KEY_BYTES);
  const recoveryKey = toBase64(randomBytes(32));
  try {
    const [keyEnvelope, recoveryEnvelope] = await Promise.all([
      wrapKey(vaultKey, passphrase),
      wrapKey(vaultKey, recoveryKey),
    ]);
    return { keyEnvelope, recoveryEnvelope, recoveryKey };
  } finally {
    vaultKey.fill(0);
  }
}

/** Unlock the vault in this browser; the passphrase is never sent by this module. */
export async function unlockVault(envelope: KeyEnvelope, secret: string): Promise<CryptoKey> {
  if (envelope.version !== 1 || envelope.kdf !== "PBKDF2-SHA-256") {
    throw new Error("unsupported_key_envelope");
  }
  if (!Number.isInteger(envelope.iterations) || envelope.iterations < 600_000 || envelope.iterations > 2_000_000) {
    throw new Error("invalid_key_envelope");
  }
  const wrappingKey = await deriveWrappingKey(secret, fromBase64(envelope.salt), envelope.iterations);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) },
    wrappingKey,
    fromBase64(envelope.wrappedKey),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** AES-256-GCM encrypts the supplied bytes with a fresh nonce. */
export async function encryptBytes(key: CryptoKey, plaintext: ArrayBuffer): Promise<{ iv: string; ciphertext: ArrayBuffer }> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { iv: toBase64(iv), ciphertext };
}

export async function decryptBytes(key: CryptoKey, iv: string, ciphertext: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, ciphertext);
}

/** Drop the caller's reference on logout; JavaScript cannot guarantee memory zeroization. */
export function clearVaultKey(key: CryptoKey | null): null {
  void key;
  return null;
}
