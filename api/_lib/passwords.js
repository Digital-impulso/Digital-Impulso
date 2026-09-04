// Hash de contraseñas de usuarios del panel. scrypt de node:crypto — sin dependencias nuevas.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verificarPassword(password, almacenado) {
  const [salt, hashGuardado] = String(almacenado || '').split(':');
  if (!salt || !hashGuardado) return false;
  const hash = scryptSync(String(password), salt, 64);
  const guardado = Buffer.from(hashGuardado, 'hex');
  return hash.length === guardado.length && timingSafeEqual(hash, guardado);
}
