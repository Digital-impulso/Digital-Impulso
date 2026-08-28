// GET /api/disponibilidad → días y turnos libres para agendar una demo.
// Función serverless de Vercel (runtime Node, firma Web: Request → Response).
import { AGENDA, modoSimulado } from './_lib/config.js';
import { aDate } from './_lib/tiempo.js';
import { fechasOfrecidas, turnosLibres } from './_lib/slots.js';
import { ocupados } from './_lib/google.js';
import { json, error } from './_lib/http.js';

export async function GET() {
  try {
    const ahora = new Date();
    const fechas = fechasOfrecidas(ahora);
    if (!fechas.length) return json({ ok: true, tz: AGENDA.tz, duracionMin: AGENDA.duracionMin, dias: [] });

    // Una sola consulta freeBusy para toda la ventana.
    const desde = aDate(fechas[0], '00:00');
    const hasta = aDate(fechas[fechas.length - 1], '23:59');
    const busy = await ocupados(desde, hasta);

    const dias = fechas
      .map((fecha) => ({ fecha, turnos: turnosLibres(fecha, busy, ahora) }))
      .filter((d) => d.turnos.length);

    return json({
      ok: true,
      tz: AGENDA.tz,
      offset: AGENDA.offset,
      duracionMin: AGENDA.duracionMin,
      preguntas: AGENDA.preguntas,
      comentario: AGENDA.comentario,
      simulado: modoSimulado(),
      dias,
    });
  } catch (e) {
    console.error('[disponibilidad]', e);
    return error('No pudimos consultar la agenda. Probá de nuevo en un momento.', 502);
  }
}
