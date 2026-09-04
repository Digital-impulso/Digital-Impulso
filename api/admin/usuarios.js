// /api/admin/usuarios → alta, cambio de contraseña y baja de usuarios del panel.
// Cualquier usuario logueado puede administrar a los demás (son 2-3 personas de confianza,
// no hay roles). Nunca se expone password_hash. No se permite borrar al último usuario
// (dejaría el panel sin forma de entrar).
import { query, hayUsuarios } from '../_lib/db.js';
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';
import { hashPassword } from '../_lib/passwords.js';

const fila = (u) => ({ id: u.id, usuario: u.usuario, creado_en: u.creado_en });

export async function GET(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  const rs = await query('SELECT id, usuario, creado_en FROM usuarios ORDER BY id ASC');
  return json({ ok: true, usuarios: rs.rows.map(fila) });
}

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
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

  const existe = await query('SELECT 1 FROM usuarios WHERE lower(usuario) = ?', [usuario]);
  if (existe.rows.length) return error('Ya existe un usuario con ese nombre.', 409);

  const rs = await query('INSERT INTO usuarios (usuario, password_hash) VALUES (?, ?) RETURNING id, usuario, creado_en', [usuario, hashPassword(clave)]);
  return json({ ok: true, usuario: fila(rs.rows[0]) }, 201);
}

export async function PUT(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const id = Number(body.id);
  if (!id) return error('Falta id.');
  if (!body.clave || String(body.clave).length < 8) return error('La contraseña debe tener al menos 8 caracteres.');

  const rs = await query('UPDATE usuarios SET password_hash = ? WHERE id = ? RETURNING id, usuario, creado_en', [hashPassword(body.clave), id]);
  if (!rs.rows.length) return error('No encontrado.', 404);
  return json({ ok: true, usuario: fila(rs.rows[0]) });
}

export async function DELETE(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return error('Falta id.');

  const total = await query('SELECT COUNT(*) AS n FROM usuarios');
  if (Number(total.rows[0].n) <= 1) return error('No podés borrar el último usuario: te quedarías sin forma de entrar.', 409);

  await query('DELETE FROM usuarios WHERE id = ?', [id]);
  return json({ ok: true });
}
