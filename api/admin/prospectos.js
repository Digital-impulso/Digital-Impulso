// /api/admin/prospectos → alta, listado, edición y baja de empresas prospectadas.
// GET: lista todas (con su último mensaje, para ver de un vistazo a quién ya se le escribió).
// POST: crea uno o varios (acepta un objeto o un array, para pegar la tabla de prospección entera).
// PUT: edita por id. DELETE: borra por id (?id=), arrastra sus mensajes (ON DELETE CASCADE).
import { query } from '../_lib/db.js';
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';

const limpiar = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const CAMPOS = {
  empresa: 160, categoria: 20, web: 200, email: 160, telefono: 60,
  linkedin: 300, decisorNombre: 120, decisorCargo: 120, canal: 20, notas: 4000,
};
const A_COLUMNA = { decisorNombre: 'decisor_nombre', decisorCargo: 'decisor_cargo' };
const CANALES = new Set(['email', 'linkedin', 'otro']);

function normalizar(it) {
  const out = {};
  for (const [campo, max] of Object.entries(CAMPOS)) out[A_COLUMNA[campo] || campo] = limpiar(it[campo], max);
  out.email = out.email.toLowerCase();
  if (!CANALES.has(out.canal)) out.canal = 'email';
  return out;
}

export async function GET(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  const rs = await query(`
    SELECT p.*,
      (SELECT COUNT(*) FROM mensajes m WHERE m.prospecto_id = p.id) AS mensajes_total,
      (SELECT COUNT(*) FROM mensajes m WHERE m.prospecto_id = p.id AND m.enviado = 1) AS mensajes_enviados,
      (SELECT MAX(fecha_envio) FROM mensajes m WHERE m.prospecto_id = p.id AND m.enviado = 1) AS ultimo_envio
    FROM prospectos p
    ORDER BY p.id DESC
  `);
  return json({ ok: true, prospectos: rs.rows });
}

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [body];

  const creados = [];
  const descartados = [];
  for (const it of items) {
    const c = normalizar(it || {});
    if (!c.empresa) {
      descartados.push(it);
      continue;
    }
    const rs = await query(
      `INSERT INTO prospectos (empresa, categoria, web, email, telefono, linkedin, decisor_nombre, decisor_cargo, canal, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING *`,
      [c.empresa, c.categoria, c.web, c.email, c.telefono, c.linkedin, c.decisor_nombre, c.decisor_cargo, c.canal, c.notas]
    );
    creados.push(rs.rows[0]);
  }
  if (!creados.length) return error('Ningún prospecto válido (falta el nombre de la empresa).');
  return json({ ok: true, prospectos: creados, descartados: descartados.length }, 201);
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

  const c = normalizar(body);
  const rs = await query(
    `UPDATE prospectos SET empresa=?, categoria=?, web=?, email=?, telefono=?, linkedin=?, decisor_nombre=?, decisor_cargo=?, canal=?, notas=?
     WHERE id = ? RETURNING *`,
    [c.empresa, c.categoria, c.web, c.email, c.telefono, c.linkedin, c.decisor_nombre, c.decisor_cargo, c.canal, c.notas, id]
  );
  if (!rs.rows.length) return error('No encontrado.', 404);
  return json({ ok: true, prospecto: rs.rows[0] });
}

export async function DELETE(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return error('Falta id.');
  await query('DELETE FROM prospectos WHERE id = ?', [id]);
  return json({ ok: true });
}
