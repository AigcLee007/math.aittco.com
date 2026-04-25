import jwt from 'jsonwebtoken';
import { env } from '../env.server';

/**
 * JWT Utility Functions for Access and Refresh Tokens
 */

const ACCESS_TOKEN_EXPIRES_IN = '7d'; // 7 days (for development/testing)
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

/**
 * 签发 Access Token (短期)
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

/**
 * 签发 Refresh Token (长期)
 */
export function signRefreshToken(payload: RefreshTokenPayload): string {
  if (!env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

/**
 * 验证 Access Token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

/**
 * 验证 Refresh Token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  if (!env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
