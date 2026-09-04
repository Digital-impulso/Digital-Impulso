// POST /api/admin/login → valida contra la tabla `usuarios` (creados desde /admin, no por env vars).
import { query } from '../_lib/db.js';
import { json, error } from '../_lib/http.js';
import { crearCookie } from '../_lib/session.js';
import { verificarPassword } from '../_lib/passwords.js';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }

  const usuario = String(body.usuario || '').trim().toLowerCase();
  const clave = String(body.clave || '');
  if (!usuario || !clave) return error('Faltan usuario o contraseña.');

  const rs = await query('SELECT * FROM usuarios WHERE lower(usuario) = ?', [usuario]);
  const u = rs.rows[0];
  if (!u || !verificarPassword(clave, u.password_hash)) return error('Usuario o contraseña incorrectos.', 401);

  return new Response(JSON.stringify({ ok: true, usuario: u.usuario }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': await crearCookie() },
  });
}
