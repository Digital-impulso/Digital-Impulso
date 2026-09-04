// POST /api/admin/enviar → manda un mensaje de prospección por email real (SMTP propio)
// y recién si el envío no tira error, lo marca enviado=1 con su fecha. Así "enviado" en la
// base siempre refleja un envío que realmente salió, no una intención.
//
// Resguardos anti-spam:
// - Sale por la casilla del dominio ya configurada para /agendar (SMTP_HOST/USER/PASS),
//   nunca por una API de bulk mail de terceros: mismo remitente autenticado de siempre.
// - No permite reenviar un mensaje ya marcado como enviado sin pedirlo explícitamente
//   (forzarReenvio), para no duplicar contactos a la misma empresa.
// - Espacia los envíos: no deja mandar dos mails de prospección con menos de
//   ESPERA_MIN_MS entre sí (evita ráfagas que un proveedor de correo podría frenar).
import { query } from '../_lib/db.js';
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';
import { mailConfigurado, enviarProspeccion } from '../_lib/mail.js';

const ESPERA_MIN_MS = 20_000;

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  if (!mailConfigurado()) return error('SMTP sin configurar (SMTP_HOST / SMTP_USER / SMTP_PASS).', 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const mensajeId = Number(body.mensajeId);
  if (!mensajeId) return error('Falta mensajeId.');

  const rs = await query(
    `SELECT m.*, p.empresa AS prospecto_empresa, p.email AS prospecto_email
     FROM mensajes m JOIN prospectos p ON p.id = m.prospecto_id
     WHERE m.id = ?`,
    [mensajeId]
  );
  const m = rs.rows[0];
  if (!m) return error('Mensaje no encontrado.', 404);
  if (m.canal !== 'email') return error('Este mensaje no es de canal email. Marcalo como enviado a mano.', 400);
  if (m.enviado && !body.forzarReenvio) {
    return error('Este mensaje ya figura como enviado. Si es intencional, reenviá con forzarReenvio.', 409);
  }
  const destino = limpiarEmail(body.email || m.prospecto_email);
  if (!destino) return error('El prospecto no tiene un email cargado.', 400);
  if (!m.asunto) return error('Falta el asunto del mensaje.', 400);

  const espera = await query(
    "SELECT MAX(fecha_envio) AS ultimo FROM mensajes WHERE canal = 'email' AND enviado = 1"
  );
  const ultimo = espera.rows[0]?.ultimo;
  const ultimoEnvio = ultimo ? new Date(ultimo.replace(' ', 'T') + 'Z').getTime() : 0;
  const faltan = ESPERA_MIN_MS - (Date.now() - ultimoEnvio);
  if (faltan > 0) {
    return error(`Esperá ${Math.ceil(faltan / 1000)} s antes del próximo envío (evita mandar en ráfaga).`, 429);
  }

  try {
    await enviarProspeccion({ paraEmail: destino, paraNombre: m.prospecto_empresa, asunto: m.asunto, contenido: m.contenido });
  } catch (e) {
    console.error('[admin/enviar]', e);
    return error('No se pudo enviar el mail. Probá de nuevo en un momento.', 502);
  }

  const upd = await query(
    "UPDATE mensajes SET enviado = 1, fecha_envio = datetime('now'), actualizado_en = datetime('now') WHERE id = ? RETURNING *",
    [mensajeId]
  );
  return json({ ok: true, mensaje: upd.rows[0] });
}

function limpiarEmail(v) {
  const s = String(v || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : '';
}
