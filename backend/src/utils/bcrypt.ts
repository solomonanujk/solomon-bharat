import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, SALT_ROUNDS);
}

export function compareToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
