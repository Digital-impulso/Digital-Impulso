// Aritmética de fechas en la zona horaria de la agenda, sin dependencias.
// "fecha local" = 'YYYY-MM-DD' y "hora local" = 'HH:MM', siempre en AGENDA.offset.
import { AGENDA } from './config.js';

const offsetMs = (() => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(AGENDA.offset);
  if (!m) throw new Error(`AGENDA_OFFSET inválido: ${AGENDA.offset}`);
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000;
})();

/** Date → 'YYYY-MM-DD' en la zona de la agenda. */
export const fechaLocal = (d) => new Date(d.getTime() + offsetMs).toISOString().slice(0, 10);

/** Date → 'HH:MM' en la zona de la agenda. */
export const horaLocal = (d) => new Date(d.getTime() + offsetMs).toISOString().slice(11, 16);

/** ('YYYY-MM-DD', 'HH:MM') → Date (instante absoluto). */
export const aDate = (fecha, hhmm) => new Date(`${fecha}T${hhmm}:00${AGENDA.offset}`);

/** 0=domingo … 6=sábado, según la zona de la agenda. */
export const diaSemana = (fecha) => aDate(fecha, '12:00').getUTCDay();

export const sumarDias = (fecha, n) =>
  fechaLocal(new Date(aDate(fecha, '12:00').getTime() + n * 86_400_000));

export const esFechaValida = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(aDate(s, '12:00').getTime());

const minutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Inicios de turno teóricos de un día (sin mirar ocupación). */
export function inicioTurnosDelDia(fecha) {
  const out = [];
  const fin = minutos(AGENDA.horaFin);
  for (let t = minutos(AGENDA.horaInicio); t + AGENDA.duracionMin <= fin; t += AGENDA.pasoMin) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    out.push(aDate(fecha, `${hh}:${mm}`));
  }
  return out;
}
