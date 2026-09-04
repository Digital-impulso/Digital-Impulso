// Mails de la agenda, enviados por SMTP desde la casilla de la empresa (info@digitalimpulso.com).
// El prospecto nunca ve la cuenta de Google que guarda el calendario: sólo este remitente.
import nodemailer from 'nodemailer';
import { AGENDA } from './config.js';

const env = (k, def = '') => (process.env[k] && process.env[k].trim()) || def;

export const mailConfigurado = () => Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS'));

const REMITENTE = () => env('SMTP_FROM') || `Digital Impulso <${env('SMTP_USER')}>`;

/** Destinatarios del aviso interno: la casilla de la empresa + los de AGENDA_AVISO_EMAIL (separados por coma). */
const AVISO_A = () => {
  const lista = [env('SMTP_USER'), ...env('AGENDA_AVISO_EMAIL').split(/[,;\s]+/)]
    .map((e) => e.trim().toLowerCase()).filter(Boolean);
  return [...new Set(lista)];
};

let transporter = null;
function transporte() {
  if (transporter) return transporter;
  const port = Number(env('SMTP_PORT', 587));
  transporter = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure: port === 465, // 465 = TLS implícito; 587 = STARTTLS
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  });
  return transporter;
}

/** Comprueba conexión y credenciales SMTP (no manda nada). */
export async function verificarSmtp() {
  if (!mailConfigurado()) throw new Error('SMTP sin configurar (SMTP_HOST / SMTP_USER / SMTP_PASS)');
  await transporte().verify();
  return true;
}

// ---------- Formato ----------
const fmt = (opts) => new Intl.DateTimeFormat('es-AR', { timeZone: AGENDA.tz, ...opts });
const fLargo = (d) => { const s = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d); return s.charAt(0).toUpperCase() + s.slice(1); };
const fHora = (d) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icsTxt = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Archivo .ics para que el prospecto lo agregue a su calendario (organizador: la casilla de la empresa). */
export function generarIcs({ inicio, fin, meet, uid }) {
  const from = env('SMTP_USER');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Digital Impulso//Agenda//ES', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@digitalimpulso.com`,
    `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(inicio)}`, `DTEND:${stamp(fin)}`,
    `SUMMARY:${icsTxt(AGENDA.titulo)}`,
    `DESCRIPTION:${icsTxt((meet ? 'Google Meet: ' + meet + '\n' : '') + 'Demo de ' + AGENDA.duracionMin + ' minutos con Digital Impulso.')}`,
    meet ? `URL:${meet}` : '',
    meet ? `LOCATION:${icsTxt(meet)}` : '',
    from ? `ORGANIZER;CN=Digital Impulso:mailto:${from}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

// ---------- Confirmación al prospecto ----------
export async function enviarConfirmacion({ lead, inicio, fin, meet, eventoId }) {
  const nombre = (lead.nombre || '').split(' ')[0];
  const cuando = `${fLargo(inicio)} · ${fHora(inicio)} hs (Argentina)`;
  const asunto = `Tu demo con Digital Impulso: ${fLargo(inicio)} a las ${fHora(inicio)}`;

  const texto = [
    `Hola ${nombre},`,
    '',
    `Tu demo quedó agendada para el ${cuando}. Dura ${AGENDA.duracionMin} minutos y es por Google Meet.`,
    '',
    meet ? `Link de la reunión: ${meet}` : '',
    '',
    'Adjuntamos el evento (.ics) para que lo agregues a tu calendario.',
    'Si necesitás cambiar el horario, respondé este mail o escribinos por WhatsApp: +54 9 11 7166-8769.',
    '',
    '¡Nos vemos!',
    'Equipo Digital Impulso · digitalimpulso.com',
  ].filter((l) => l !== null).join('\n');

  const html = `
<div style="font-family:Geist,Inter,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827;background:#ffffff">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0D9488;font-weight:700">Demo agendada</p>
  <h1 style="margin:0 0 16px;font-size:24px;letter-spacing:-.02em">¡Listo, ${esc(nombre)}!</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">Tu demo con Digital Impulso quedó confirmada. Dura ${AGENDA.duracionMin} minutos y es por Google Meet.</p>
  <div style="border:1px solid #E5E7EB;border-radius:12px;padding:18px 20px;margin:0 0 22px;background:#F9FAFB">
    <p style="margin:0 0 4px;font-size:13px;color:#6B7280">Cuándo</p>
    <p style="margin:0 0 14px;font-size:17px;font-weight:700">${esc(cuando)}</p>
    ${meet ? `<a href="${esc(meet)}" style="display:inline-block;background:#0D9488;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;font-size:14px">Entrar a Google Meet →</a>
    <p style="margin:12px 0 0;font-size:12px;color:#6B7280;word-break:break-all">${esc(meet)}</p>` : ''}
  </div>
  <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#374151">Adjuntamos el evento (<b>.ics</b>) para que lo agregues a tu calendario con un clic.</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#374151">¿Necesitás cambiar el horario? Respondé este mail o escribinos por <a href="https://wa.me/5491171668769" style="color:#0D9488">WhatsApp</a>.</p>
  <p style="margin:0;font-size:13px;color:#6B7280">Equipo Digital Impulso · <a href="https://digitalimpulso.com" style="color:#0D9488">digitalimpulso.com</a></p>
</div>`;

  const ics = generarIcs({ inicio, fin, meet, uid: eventoId || stamp(inicio) });
  await transporte().sendMail({
    from: REMITENTE(),
    to: `${lead.nombre} <${lead.email}>`,
    replyTo: REMITENTE(),
    subject: asunto,
    text: texto,
    html,
    icalEvent: { method: 'PUBLISH', content: ics, filename: 'demo-digital-impulso.ics' },
  });
}

// ---------- Aviso interno al equipo ----------
export async function avisarEquipo({ lead, inicio, meet, eventoId }) {
  const respuestas = Object.entries(lead.respuestas || {}).map(([clave, v]) => {
    const titulo = AGENDA.preguntas[clave]?.titulo || clave;
    return `<tr><td style="padding:6px 10px 6px 0;color:#6B7280;vertical-align:top">${esc(titulo)}</td><td style="padding:6px 0">${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>`;
  }).join('');
  const html = `
<div style="font-family:Geist,Inter,-apple-system,Segoe UI,Roboto,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 4px;font-size:20px">Nueva demo agendada</h2>
  <p style="margin:0 0 18px;font-size:16px;font-weight:700;color:#0D9488">${esc(fLargo(inicio))} · ${esc(fHora(inicio))} hs</p>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:18px">
    <tr><td style="padding:6px 10px 6px 0;color:#6B7280">Nombre</td><td style="padding:6px 0"><b>${esc(lead.nombre)}</b></td></tr>
    <tr><td style="padding:6px 10px 6px 0;color:#6B7280">Email</td><td style="padding:6px 0"><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td></tr>
    <tr><td style="padding:6px 10px 6px 0;color:#6B7280">WhatsApp</td><td style="padding:6px 0"><a href="https://wa.me/${esc((lead.whatsapp || '').replace(/\D/g, ''))}">${esc(lead.whatsapp || '-')}</a></td></tr>
    <tr><td style="padding:6px 10px 6px 0;color:#6B7280">Sitio web</td><td style="padding:6px 0">${esc(lead.sitioWeb || '-')}</td></tr>
    ${respuestas}
    ${lead.comentario ? `<tr><td style="padding:6px 10px 6px 0;color:#6B7280;vertical-align:top">Sobre el negocio</td><td style="padding:6px 0;white-space:pre-wrap">${esc(lead.comentario)}</td></tr>` : ''}
  </table>
  ${meet ? `<p style="margin:0 0 6px;font-size:14px">Meet: <a href="${esc(meet)}">${esc(meet)}</a></p>` : ''}
  <p style="margin:0;font-size:12px;color:#9CA3AF">Evento ${esc(eventoId || '')} · agendado desde digitalimpulso.com/agendar</p>
</div>`;
  await transporte().sendMail({
    from: REMITENTE(),
    to: AVISO_A(),
    replyTo: `${lead.nombre} <${lead.email}>`,
    subject: `Nueva demo: ${lead.nombre}${lead.empresa ? ' (' + lead.empresa + ')' : ''} · ${fLargo(inicio)} ${fHora(inicio)}`,
    html,
  });
}

// ---------- Mensajes de prospección (panel /admin) ----------
// Mismo remitente y transporte que el resto del sitio: la casilla propia del dominio
// (con SPF/DKIM/DMARC ya alineados para digitalimpulso.com), nunca un servicio de bulk mail.
export async function enviarProspeccion({ paraEmail, paraNombre, asunto, contenido }) {
  const html = `
<div style="font-family:Geist,Inter,-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;white-space:pre-wrap;line-height:1.6;font-size:15px">${esc(contenido)}</div>`;
  await transporte().sendMail({
    from: REMITENTE(),
    to: paraNombre ? `${paraNombre} <${paraEmail}>` : paraEmail,
    replyTo: REMITENTE(),
    subject: asunto,
    text: contenido,
    html,
  });
}
