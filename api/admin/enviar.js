// POST /api/admin/enviar → manda un mensaje de prospección por email real (SMTP propio)
// y recién si el envío no tira error, lo marca enviado=1 con su fecha. La lógica (resguardos
// anti-spam incluidos) vive en api/_lib/envios.js, compartida con el auto-envío de la IA.
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';
import { enviarMensajeEmail, ErrorEnvio } from '../_lib/envios.js';

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const mensajeId = Number(body.mensajeId);
  if (!mensajeId) return error('Falta mensajeId.');

  try {
    const mensaje = await enviarMensajeEmail(mensajeId, { forzarReenvio: !!body.forzarReenvio, emailOverride: body.email });
    return json({ ok: true, mensaje });
  } catch (e) {
    if (e instanceof ErrorEnvio) return error(e.message, e.status);
    console.error('[admin/enviar]', e);
    return error('No se pudo enviar el mail. Probá de nuevo en un momento.', 502);
  }
}
