import bcrypt from 'bcryptjs';

/**
 * Password Hashing and Verification
 */

const SALT_ROUNDS = 10;

/**
 * 将明文密码转换为哈希值
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证明文密码与哈希值是否匹配
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
