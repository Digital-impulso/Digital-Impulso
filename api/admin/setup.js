// Alta inicial del panel: mientras no exista NINGÚN usuario, permite crear el primero
// sin login previo (huevo y gallina). En cuanto hay uno, esta ruta se cierra sola:
// el resto de las altas se hacen ya logueado, desde /api/admin/usuarios.
//
// GET  → { necesario: true/false } — si el front debe mostrar "crear el primer usuario" o el login.
// POST → crea el primer usuario. 409 si ya hay alguno cargado.
import { query, hayUsuarios } from '../_lib/db.js';
import { json, error } from '../_lib/http.js';
import { crearCookie } from '../_lib/session.js';
import { hashPassword } from '../_lib/passwords.js';

export async function GET() {
  return json({ ok: true, necesario: !(await hayUsuarios()) });
}

export async function POST(request) {
  if (await hayUsuarios()) return error('El panel ya tiene usuarios creados. Pedile a alguno que te dé de alta desde Configuración.', 409);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const usuario = String(body.usuario || '').trim().toLowerCase();
  const clave = String(body.clave || '');
  if (usuario.length < 2) return error('Elegí un nombre de usuario.');
  if (clave.length < 8) return error('La contraseña debe tener al menos 8 caracteres.');

  await query('INSERT INTO usuarios (usuario, password_hash) VALUES (?, ?)', [usuario, hashPassword(clave)]);

  return new Response(JSON.stringify({ ok: true, usuario }), {
    status: 201,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': await crearCookie() },
  });
}
