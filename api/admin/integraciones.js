// /api/admin/integraciones → configura la casilla SMTP de prospección, las reglas de envío
// y la API key de Claude para "Buscar con IA". Todo guardado en Turso vía _lib/configAdmin.js.
// GET: config actual (contraseñas/keys nunca se devuelven, solo si hay una guardada).
// PUT: guarda cambios por grupo (smtp / reglas / ia) — dejar una clave vacía = no tocarla.
// POST: prueba conexión (SMTP o Claude, según body.objetivo), sin mandar ningún mail ni gastar de más.
import { obtenerConfig, guardarConfig } from '../_lib/configAdmin.js';
import { verificarSmtpProspeccion } from '../_lib/mail.js';
import { probarIA } from '../_lib/ia.js';
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';

const CLAVES = [
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
  'envio_espera_seg', 'envio_tope_diario',
  'ia_api_key', 'ia_modelo', 'ia_auto_enviar',
];

export async function GET(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  const c = await obtenerConfig(CLAVES);
  return json({
    ok: true,
    smtp: { host: c.smtp_host, port: c.smtp_port, user: c.smtp_user, from: c.smtp_from, passConfigurada: Boolean(c.smtp_pass) },
    reglas: { esperaSeg: c.envio_espera_seg, topeDiario: c.envio_tope_diario },
    ia: { modelo: c.ia_modelo || 'claude-opus-5', autoEnviar: c.ia_auto_enviar === '1', apiKeyConfigurada: Boolean(c.ia_api_key) },
  });
}

export async function PUT(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }

  // El panel manda "smtp", "reglas" o "ia" por separado (formularios distintos); solo se
  // tocan las claves del grupo que llegó, para no pisar los otros grupos con valores vacíos.
  const pares = {};
  if (body.smtp) {
    const clave = String(body.smtp.pass || '').trim();
    pares.smtp_host = String(body.smtp.host ?? '').trim();
    pares.smtp_port = String(body.smtp.port ?? '').trim();
    pares.smtp_user = String(body.smtp.user ?? '').trim();
    if (clave) pares.smtp_pass = clave; // vacío = no tocar la ya guardada
    pares.smtp_from = String(body.smtp.from ?? '').trim();
  }
  if (body.reglas) {
    pares.envio_espera_seg = String(body.reglas.esperaSeg ?? '').trim();
    pares.envio_tope_diario = String(body.reglas.topeDiario ?? '').trim();
  }
  if (body.ia) {
    const key = String(body.ia.apiKey || '').trim();
    if (key) pares.ia_api_key = key; // vacío = no tocar la ya guardada
    if (body.ia.modelo) pares.ia_modelo = String(body.ia.modelo).trim();
    pares.ia_auto_enviar = body.ia.autoEnviar ? '1' : '0';
  }
  if (!Object.keys(pares).length) return error('Nada para guardar.');

  await guardarConfig(pares);
  return json({ ok: true });
}

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  let body = {};
  try { body = await request.json(); } catch { /* sin cuerpo = probar SMTP, por compatibilidad */ }

  try {
    if (body.objetivo === 'ia') {
      await probarIA();
    } else {
      await verificarSmtpProspeccion();
    }
  } catch (e) {
    return error(`No se pudo conectar: ${e.message}`, 502);
  }
  return json({ ok: true });
}
