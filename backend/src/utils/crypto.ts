import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { env } from '../config/env';
import { AppError } from './errors';

// AES-256-GCM, for encrypting a third-party credential we must be able to
// decrypt later (e.g. a Shopify Admin API access token) — unlike bcrypt
// (one-way, for passwords), this is genuinely reversible. The key is derived
// once via scrypt from SHOPIFY_TOKEN_ENCRYPTION_KEY rather than used raw, so
// any configured secret (not just exactly 32 bytes) works.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT = 'solomon-bharat-shopify-token-v1'; // fixed, non-secret — only the key material is secret

function deriveKey(): Buffer {
  if (!env.SHOPIFY_TOKEN_ENCRYPTION_KEY) {
    // Fails only at the point something actually needs to encrypt/decrypt a
    // secret — never crashes the whole server at startup over this one var,
    // matching this codebase's existing lenient-optional-provider pattern.
    throw AppError.internal('SHOPIFY_TOKEN_ENCRYPTION_KEY is not configured');
  }
  return scryptSync(env.SHOPIFY_TOKEN_ENCRYPTION_KEY, SALT, 32);
}

/** Returns `${iv}:${authTag}:${ciphertext}`, each base64. */
export function encryptSecret(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(packed: string): string {
  const key = deriveKey();
  const [ivB64, authTagB64, ciphertextB64] = packed.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw AppError.internal('Malformed encrypted secret');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
  return plain.toString('utf8');
}
