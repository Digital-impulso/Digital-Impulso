// Cálculo de turnos libres: cruza los turnos teóricos con lo ocupado en el calendario.
import { AGENDA } from './config.js';
import { fechaLocal, horaLocal, diaSemana, sumarDias, inicioTurnosDelDia } from './tiempo.js';

/** Fechas hábiles dentro de la ventana [hoy, hoy + diasMax]. */
export function fechasOfrecidas(ahora = new Date()) {
  const hoy = fechaLocal(ahora);
  const out = [];
  for (let i = 0; i <= AGENDA.diasMax; i++) {
    const f = sumarDias(hoy, i);
    if (AGENDA.diasHabiles.includes(diaSemana(f))) out.push(f);
  }
  return out;
}

const seSolapan = (aIni, aFin, bIni, bFin) => aIni < bFin && bIni < aFin;

/**
 * Turnos libres de una fecha.
 * @param {string} fecha 'YYYY-MM-DD'
 * @param {{start:string,end:string}[]} ocupados bloques ocupados (ISO) del calendario
 * @param {Date} ahora
 */
export function turnosLibres(fecha, ocupados, ahora = new Date()) {
  if (!AGENDA.diasHabiles.includes(diaSemana(fecha))) return [];
  const minInicio = ahora.getTime() + AGENDA.anticipacionMin * 60_000;
  const buffer = AGENDA.bufferMin * 60_000;
  const bloques = ocupados.map((b) => [new Date(b.start).getTime() - buffer, new Date(b.end).getTime() + buffer]);

  return inicioTurnosDelDia(fecha)
    .filter((ini) => ini.getTime() >= minInicio)
    .filter((ini) => {
      const fin = ini.getTime() + AGENDA.duracionMin * 60_000;
      return !bloques.some(([bIni, bFin]) => seSolapan(ini.getTime(), fin, bIni, bFin));
    })
    .map((ini) => ({ inicio: ini.toISOString(), hora: horaLocal(ini) }));
}

/** ¿Este instante es un inicio de turno válido y libre? Se usa al reservar, para no confiar en el cliente. */
export function turnoDisponible(inicioIso, ocupados, ahora = new Date()) {
  const ini = new Date(inicioIso);
  if (Number.isNaN(ini.getTime())) return false;
  const fecha = fechaLocal(ini);
  if (!fechasOfrecidas(ahora).includes(fecha)) return false;
  return turnosLibres(fecha, ocupados, ahora).some((t) => t.inicio === ini.toISOString());
}
