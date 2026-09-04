// Lógica de "mandar un mensaje de prospección por email", compartida entre el botón manual
// (api/admin/enviar.js) y el auto-envío de la búsqueda con IA (api/admin/ia-buscar.js) — así
// las mismas reglas anti-spam (espera mínima, tope diario, no reenviar sin confirmar) aplican
// sin importar quién dispara el envío.
import { query } from './db.js';
import { mailProspeccionConfigurado, enviarProspeccion } from './mail.js';
import { obtenerConfig } from './configAdmin.js';
import { fechaLocal, aDate } from './tiempo.js';

const ESPERA_DEFECTO_SEG = 20;

export class ErrorEnvio extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

export async function enviarMensajeEmail(mensajeId, { forzarReenvio = false, emailOverride } = {}) {
  if (!(await mailProspeccionConfigurado())) {
    throw new ErrorEnvio('Falta configurar el email de prospección en Integraciones (host / usuario / contraseña).', 500);
  }

  const rs = await query(
    `SELECT m.*, p.empresa AS prospecto_empresa, p.email AS prospecto_email
     FROM mensajes m JOIN prospectos p ON p.id = m.prospecto_id
     WHERE m.id = ?`,
    [mensajeId]
  );
  const m = rs.rows[0];
  if (!m) throw new ErrorEnvio('Mensaje no encontrado.', 404);
  if (m.canal !== 'email') throw new ErrorEnvio('Este mensaje no es de canal email. Marcalo como enviado a mano.', 400);
  if (m.enviado && !forzarReenvio) {
    throw new ErrorEnvio('Este mensaje ya figura como enviado. Si es intencional, reenviá con forzarReenvio.', 409);
  }
  const destino = limpiarEmail(emailOverride || m.prospecto_email);
  if (!destino) throw new ErrorEnvio('El prospecto no tiene un email cargado.', 400);
  if (!m.asunto) throw new ErrorEnvio('Falta el asunto del mensaje.', 400);

  const reglas = await obtenerConfig(['envio_espera_seg', 'envio_tope_diario']);
  const esperaMs = (Number(reglas.envio_espera_seg) || ESPERA_DEFECTO_SEG) * 1000;
  const topeDiario = Number(reglas.envio_tope_diario) || 0;

  const espera = await query("SELECT MAX(fecha_envio) AS ultimo FROM mensajes WHERE canal = 'email' AND enviado = 1");
  const ultimo = espera.rows[0]?.ultimo;
  const ultimoEnvio = ultimo ? new Date(ultimo.replace(' ', 'T') + 'Z').getTime() : 0;
  const faltan = esperaMs - (Date.now() - ultimoEnvio);
  if (faltan > 0) {
    throw new ErrorEnvio(`Esperá ${Math.ceil(faltan / 1000)} s antes del próximo envío (evita mandar en ráfaga).`, 429);
  }

  if (topeDiario > 0) {
    const inicioHoy = aDate(fechaLocal(new Date()), '00:00').toISOString().slice(0, 19).replace('T', ' ');
    const hoy = await query(
      "SELECT COUNT(*) AS n FROM mensajes WHERE canal = 'email' AND enviado = 1 AND fecha_envio >= ?",
      [inicioHoy]
    );
    if (Number(hoy.rows[0].n) >= topeDiario) {
      throw new ErrorEnvio(`Ya se llegó al tope diario de ${topeDiario} envíos. Se puede subir en Integraciones.`, 429);
    }
  }

  await enviarProspeccion({ paraEmail: destino, paraNombre: m.prospecto_empresa, asunto: m.asunto, contenido: m.contenido });

  const upd = await query(
    "UPDATE mensajes SET enviado = 1, fecha_envio = datetime('now'), actualizado_en = datetime('now') WHERE id = ? RETURNING *",
    [mensajeId]
  );
  return upd.rows[0];
}

function limpiarEmail(v) {
  const s = String(v || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : '';
}
