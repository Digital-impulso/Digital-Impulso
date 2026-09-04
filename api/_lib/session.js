// Sesión del panel /admin: cookie firmada (HMAC). El secreto vive en la base
// (ver obtenerSecretoSesion en db.js), no en variables de entorno.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { obtenerSecretoSesion } from './db.js';

const env = (k, def = '') => (process.env[k] && process.env[k].trim()) || def;
const COOKIE = 'di_admin';
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 h

const firmar = (payload, secreto) => createHmac('sha256', secreto).update(payload).digest('base64url');

/** Compara dos strings en tiempo constante (evita timing attacks en login/cookie). */
export function igual(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

/** Set-Cookie de una sesión nueva, válida por DURACION_MS. */
export async function crearCookie() {
  const secreto = await obtenerSecretoSesion();
  const payload = String(Date.now() + DURACION_MS);
  const valor = `${payload}.${firmar(payload, secreto)}`;
  const seguro = env('NODE_ENV') === 'production' || env('VERCEL') ? '; Secure' : '';
  return `${COOKIE}=${valor}; HttpOnly${seguro}; SameSite=Strict; Path=/; Max-Age=${Math.floor(DURACION_MS / 1000)}`;
}

/** Set-Cookie que borra la sesión (logout). */
export function cookieBorrada() {
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

function leerCookie(request, nombre) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** true si el request trae una cookie de sesión vigente y con firma válida. */
export async function sesionValida(request) {
  const valor = leerCookie(request, COOKIE);
  if (!valor) return false;
  const [payload, firma] = valor.split('.');
  if (!payload || !firma) return false;
  const secreto = await obtenerSecretoSesion();
  if (!igual(firma, firmar(payload, secreto))) return false;
  return Number(payload) > Date.now();
}
