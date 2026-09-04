// /api/admin/mensajes → borradores y registro de envío.
// GET ?prospecto_id= : lista los mensajes de un prospecto.
// GET ?estado=pendiente|enviado|todos (sin prospecto_id): listado global con el nombre de la
//     empresa de cada uno — para la vista "Borradores" (default: pendiente).
// POST: crea un mensaje (borrador; enviado=0 salvo que se marque a mano).
// PUT: edita contenido, o marca/desmarca "enviado" a mano (para envíos hechos fuera del panel,
//      ej. por LinkedIn) — siempre guarda fecha_envio para saber a quién ya se le escribió.
// DELETE ?id= : borra un mensaje.
import { query } from '../_lib/db.js';
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';

const limpiar = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const CANALES = new Set(['email', 'linkedin', 'instagram', 'otro']);

export async function GET(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  const params = new URL(request.url).searchParams;
  const prospectoId = Number(params.get('prospecto_id'));

  if (prospectoId) {
    const rs = await query('SELECT * FROM mensajes WHERE prospecto_id = ? ORDER BY id DESC', [prospectoId]);
    return json({ ok: true, mensajes: rs.rows });
  }

  const estado = params.get('estado') || 'pendiente';
  const filtro = estado === 'enviado' ? 'WHERE m.enviado = 1' : estado === 'todos' ? '' : 'WHERE m.enviado = 0';
  const rs = await query(`
    SELECT m.*, p.empresa AS prospecto_empresa, p.web AS prospecto_web,
           p.email AS prospecto_email, p.linkedin AS prospecto_linkedin
    FROM mensajes m JOIN prospectos p ON p.id = m.prospecto_id
    ${filtro}
    ORDER BY m.creado_en DESC
  `);
  return json({ ok: true, mensajes: rs.rows });
}

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const prospectoId = Number(body.prospectoId);
  if (!prospectoId) return error('Falta prospectoId.');
  const contenido = limpiar(body.contenido, 8000);
  if (!contenido) return error('El mensaje no puede estar vacío.');
  const canal = CANALES.has(body.canal) ? body.canal : 'email';
  const asunto = limpiar(body.asunto, 200);

  // Marcar como ya enviado al crearlo sirve para cargar mensajes que se mandaron
  // antes de tener el panel (o por un canal sin integración, como LinkedIn).
  const enviado = body.enviado ? 1 : 0;
  const fechaEnvio = enviado ? "datetime('now')" : 'NULL';

  const rs = await query(
    `INSERT INTO mensajes (prospecto_id, canal, asunto, contenido, enviado, fecha_envio)
     VALUES (?, ?, ?, ?, ?, ${fechaEnvio}) RETURNING *`,
    [prospectoId, canal, asunto, contenido, enviado]
  );
  return json({ ok: true, mensaje: rs.rows[0] }, 201);
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

  const sets = ['actualizado_en = datetime(\'now\')'];
  const args = [];

  if (typeof body.contenido === 'string') { sets.push('contenido = ?'); args.push(limpiar(body.contenido, 8000)); }
  if (typeof body.asunto === 'string') { sets.push('asunto = ?'); args.push(limpiar(body.asunto, 200)); }
  if (typeof body.canal === 'string' && CANALES.has(body.canal)) { sets.push('canal = ?'); args.push(body.canal); }

  // "enviado" se pisa siempre junto con su fecha, para que nunca quede enviado=1 sin fecha.
  if (typeof body.enviado === 'boolean') {
    sets.push('enviado = ?');
    args.push(body.enviado ? 1 : 0);
    sets.push(`fecha_envio = ${body.enviado ? "COALESCE(fecha_envio, datetime('now'))" : 'NULL'}`);
  }

  if (sets.length === 1) return error('Nada para actualizar.');
  args.push(id);
  const rs = await query(`UPDATE mensajes SET ${sets.join(', ')} WHERE id = ? RETURNING *`, args);
  if (!rs.rows.length) return error('No encontrado.', 404);
  return json({ ok: true, mensaje: rs.rows[0] });
}

export async function DELETE(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return error('Falta id.');
  await query('DELETE FROM mensajes WHERE id = ?', [id]);
  return json({ ok: true });
}
