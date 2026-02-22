/**
 * Heimdell CRM — AES-256-GCM Encryption Utility
 *
 * Used to encrypt/decrypt SMTP passwords stored in SenderAccount.
 * Key comes from APP_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 *
 * Ciphertext format: <iv_hex>:<auth_tag_hex>:<encrypted_hex>
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;      // 128-bit auth tag

function getKey(): Buffer {
  const hex = config.encryptionKey;
  if (!hex || hex.length < 64) {
    throw new Error(
      'APP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext → "iv:tag:cipher" (all hex).
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt "iv:tag:cipher" → plaintext.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format — expected iv:tag:cipher');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encData = parts[2];

  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
