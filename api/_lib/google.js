// Cliente mínimo de Google Calendar (OAuth2 con refresh token), sin SDK.
// Con AGENDA_MODO=simulada (o sin GOOGLE_REFRESH_TOKEN) no toca Google: útil en dev.
import { AGENDA, modoSimulado } from './config.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL = 'https://www.googleapis.com/calendar/v3';

let cache = { token: null, vence: 0 };

async function accessToken() {
  if (cache.token && Date.now() < cache.vence - 30_000) return cache.token;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
    grant_type: 'refresh_token',
  });
  const r = await fetch(TOKEN_URL, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error(`No pude renovar el token de Google: ${j.error_description || j.error || r.status}`);
  }
  cache = { token: j.access_token, vence: Date.now() + (j.expires_in || 3600) * 1000 };
  return cache.token;
}

async function gapi(path, init = {}) {
  const token = await accessToken();
  const r = await fetch(`${CAL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Calendar ${r.status}: ${j.error?.message || JSON.stringify(j)}`);
  return j;
}

/** Bloques ocupados del calendario entre dos instantes. */
export async function ocupados(desde, hasta) {
  if (modoSimulado()) return [];
  const j = await gapi('/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      timeZone: AGENDA.tz,
      items: [{ id: AGENDA.calendarId }],
    }),
  });
  const cal = j.calendars?.[AGENDA.calendarId] || Object.values(j.calendars || {})[0] || {};
  if (cal.errors?.length) throw new Error(`freeBusy: ${JSON.stringify(cal.errors)}`);
  return cal.busy || [];
}

/**
 * Crea el evento con Google Meet en el calendario del equipo, SIN invitados: así Google no manda
 * ninguna invitación y el prospecto nunca ve la cuenta dueña del calendario. La confirmación
 * al prospecto sale por mail.js desde la casilla de la empresa.
 */
export async function crearEvento({ inicio, fin, lead }) {
  const respuestas = Object.entries(lead.respuestas || {}).map(([clave, v]) => {
    const titulo = AGENDA.preguntas[clave]?.titulo || clave;
    return `${titulo}\n  → ${Array.isArray(v) ? v.join(', ') : v}`;
  });
  const descripcion = [
    'Demo agendada desde digitalimpulso.com',
    '',
    `Nombre: ${lead.nombre}`,
    `Email: ${lead.email}`,
    `WhatsApp: ${lead.whatsapp || '-'}`,
    `Sitio web: ${lead.sitioWeb || '-'}`,
    ...(respuestas.length ? ['', ...respuestas] : []),
    ...(lead.comentario ? ['', 'Sobre el negocio:', lead.comentario] : []),
  ].join('\n');

  if (modoSimulado()) {
    return {
      id: `simulado-${Date.now()}`,
      htmlLink: '#',
      hangoutLink: 'https://meet.google.com/xxx-simulado',
      simulado: true,
    };
  }

  const ev = await gapi(
    `/calendars/${encodeURIComponent(AGENDA.calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: 'POST',
      body: JSON.stringify({
        summary: `${AGENDA.titulo} · ${lead.empresa || lead.nombre}`,
        description: descripcion,
        start: { dateTime: inicio.toISOString(), timeZone: AGENDA.tz },
        end: { dateTime: fin.toISOString(), timeZone: AGENDA.tz },
        conferenceData: {
          createRequest: {
            requestId: `di-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 10 }],
        },
      }),
    },
  );
  return {
    id: ev.id,
    htmlLink: ev.htmlLink,
    hangoutLink: ev.hangoutLink || ev.conferenceData?.entryPoints?.[0]?.uri || null,
    simulado: false,
  };
}
