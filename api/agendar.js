// POST /api/agendar → reserva un turno: valida, re-chequea disponibilidad, crea el evento con Meet.
// Función serverless de Vercel (runtime Node, firma Web: Request → Response).
import { AGENDA } from './_lib/config.js';
import { fechaLocal, horaLocal } from './_lib/tiempo.js';
import { turnoDisponible } from './_lib/slots.js';
import { ocupados, crearEvento } from './_lib/google.js';
import { mailConfigurado, enviarConfirmacion, avisarEquipo } from './_lib/mail.js';
import { json, error } from './_lib/http.js';

const limpiar = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validar(body) {
  const lead = {
    nombre: limpiar(body.nombre, 80),
    email: limpiar(body.email, 120).toLowerCase(),
    whatsapp: limpiar(body.whatsapp, 30),
    sitioWeb: limpiar(body.sitioWeb, 120),
    comentario: limpiar(body.comentario, 800),
    respuestas: {},
  };
  if (lead.nombre.length < 2) return { err: 'Contanos tu nombre.' };
  if (!EMAIL.test(lead.email)) return { err: 'El email no parece válido.' };
  if (lead.whatsapp.replace(/\D/g, '').length < 6) return { err: 'Dejanos un WhatsApp para poder contactarte.' };

  // Respuestas de calificación: sólo se aceptan opciones definidas en la config.
  const resp = body.respuestas && typeof body.respuestas === 'object' ? body.respuestas : {};
  for (const [clave, p] of Object.entries(AGENDA.preguntas)) {
    const v = resp[clave];
    if (p.multiple) {
      const lista = (Array.isArray(v) ? v : [v]).filter((x) => p.opciones.includes(x));
      if (lista.length) lead.respuestas[clave] = lista;
    } else if (p.opciones.includes(v)) {
      lead.respuestas[clave] = v;
    }
  }
  // Nombre "de empresa" para el título del evento: dominio del sitio web si lo dejaron.
  lead.empresa = lead.sitioWeb.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];
  return { lead };
}

async function avisarWebhook(payload) {
  if (!AGENDA.leadWebhook) return;
  try {
    await fetch(AGENDA.leadWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[agendar] webhook falló', e);
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }

  // Honeypot: los bots llenan todos los campos; los humanos no ven este.
  if (limpiar(body.web, 10)) return json({ ok: true });

  const { lead, err } = validar(body);
  if (err) return error(err);

  const inicio = new Date(body.inicio || '');
  if (Number.isNaN(inicio.getTime())) return error('Elegí un horario.');
  const fin = new Date(inicio.getTime() + AGENDA.duracionMin * 60_000);

  try {
    const ahora = new Date();
    // Re-chequeo contra el calendario justo antes de crear: evita dobles reservas
    // si dos personas eligieron el mismo turno a la vez.
    const busy = await ocupados(new Date(inicio.getTime() - 86_400_000), new Date(fin.getTime() + 86_400_000));
    if (!turnoDisponible(inicio.toISOString(), busy, ahora)) {
      return error('Ese horario ya no está disponible. Elegí otro, por favor.', 409);
    }

    const ev = await crearEvento({ inicio, fin, lead });

    // Confirmación al prospecto + aviso interno, desde la casilla de la empresa (no desde Google).
    // Si el mail falla, la reserva igual queda hecha: la página muestra el link de Meet y el .ics.
    let emailEnviado = false;
    if (mailConfigurado()) {
      try {
        await enviarConfirmacion({ lead, inicio, fin, meet: ev.hangoutLink, eventoId: ev.id });
        emailEnviado = true;
      } catch (e) {
        console.error('[agendar] no se pudo mandar la confirmación', e);
      }
      avisarEquipo({ lead, inicio, meet: ev.hangoutLink, eventoId: ev.id }).catch((e) => console.error('[agendar] aviso interno falló', e));
    } else {
      console.warn('[agendar] SMTP sin configurar: no se mandó confirmación');
    }

    const resumen = {
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      fecha: fechaLocal(inicio),
      hora: horaLocal(inicio),
      tz: AGENDA.tz,
      meet: ev.hangoutLink,
      simulado: ev.simulado,
      emailEnviado,
    };

    await avisarWebhook({ origen: 'digitalimpulso.com/agendar', ...lead, ...resumen, eventoId: ev.id });

    return json({ ok: true, ...resumen });
  } catch (e) {
    console.error('[agendar]', e);
    return error('No pudimos crear la reunión. Escribinos por WhatsApp y lo agendamos a mano.', 502);
  }
}
