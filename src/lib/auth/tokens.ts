/**
 * JWT Token Utilities for Reconnection Support
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { randomBytes } from 'crypto';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
};

interface ReconnectTokenPayload extends JWTPayload {
  teamId: string;
  gameSessionId: string;
}

/**
 * Generate a secure random token (32 bytes, base64url encoded)
 */
export function generateRandomToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Create a JWT reconnect token for a team
 */
export async function createReconnectToken(
  teamId: string,
  gameSessionId: string
): Promise<string> {
  const token = await new SignJWT({ teamId, gameSessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
  
  return token;
}

/**
 * Verify and decode a reconnect token
 */
export async function verifyReconnectToken(
  token: string
): Promise<ReconnectTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    
    if (!payload.teamId || !payload.gameSessionId) {
      return null;
    }
    
    return payload as ReconnectTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Create a simple reconnect token (non-JWT, for database storage)
 * This is used as the primary reconnect mechanism
 */
export function createSimpleReconnectToken(): string {
  return randomBytes(32).toString('base64url');
}
