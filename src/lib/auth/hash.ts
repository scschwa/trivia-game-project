/**
 * Password/PIN Hashing Utilities
 */

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash a host PIN
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verify a host PIN against its hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
