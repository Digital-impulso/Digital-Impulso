# Agenda de demos (`/agendar`)

Página propia con un **acordeón de 3 bloques** (estética tomada de radiant.ag/agendar, pero sin
el scroll largo: se abre un bloque a la vez, los completados se colapsan con ✓ y resumen, y se
pueden reabrir con "Editar"):

1. **Tus datos** — nombre, email, WhatsApp (obligatorios) y sitio web (opcional).
2. **Tu operación** — 7 preguntas de calificación en chips orientadas a consultoría y tótems
   (qué querés resolver, rubro, cantidad de locales, cómo atienden hoy, urgencia, rol, cómo llegaron) y un
   campo libre "Contanos brevemente sobre tu negocio". Las preguntas y sus opciones viven en
   `api/_lib/config.js` → `preguntas` (y el campo libre en → `comentario`); la página las renderiza
   desde ahí y el backend sólo acepta esas opciones.
3. **Día y horario** — días y turnos libres reales de Google Calendar, confirmar.

Al confirmar:
- Se crea el evento **sin invitados** en el calendario del equipo (una cuenta Gmail), con link de
  Google Meet. Como no hay invitados, Google no manda nada y **el prospecto nunca ve esa cuenta**.
- La confirmación al prospecto sale por **SMTP desde info@digitalimpulso.com** (`api/_lib/mail.js`):
  fecha, hora, botón de Meet y el `.ics` adjunto para agregarlo a su calendario.
- Llega un **aviso interno** a la casilla SMTP y a los mails de `AGENDA_AVISO_EMAIL` (varios,
  separados por coma; hoy cflopez.86@gmail.com) con todas las respuestas del lead, y con
  *Responder* se le contesta directo al prospecto.
- Si el mail falla, la reserva igual queda hecha y la página muestra el link de Meet y el `.ics`.

Al entrar al Meet, el prospecto ve el **nombre** de la cuenta anfitriona (conviene que sea
"Digital Impulso"), y como es externo tiene que "pedir unirse": el anfitrión lo admite.

```
agendar.html                 ← la página (calendario + formulario + confirmación)
api/disponibilidad.js        ← GET  días/turnos libres (freeBusy de Google)
api/agendar.js               ← POST valida, re-chequea el turno, crea el evento + Meet y manda los mails
api/_lib/mail.js             ← confirmación al prospecto + aviso interno por SMTP (nodemailer)
api/_lib/config.js           ← reglas: duración, horarios, buffer, días hábiles, intereses
api/_lib/{tiempo,slots}.js   ← cálculo de turnos (sin dependencias)
api/_lib/google.js           ← cliente mínimo de Calendar (OAuth2 refresh token, sin SDK)
scripts/google-auth.js       ← se corre una vez para obtener el refresh token
```

Las carpetas/archivos que empiezan con `_` dentro de `api/` no se publican como funciones (regla de Vercel).

## Reglas por defecto (se cambian por env, ver `.env.example`)

- Lunes a viernes, 10:00 a 17:00 (Argentina, GMT-3), turnos de 30 min cada 30 min.
- 15 min de aire antes y después de cualquier otro evento del calendario.
- No se puede agendar con menos de 3 h de anticipación ni a más de 21 días.
- La página muestra los horarios en la zona horaria del visitante y lo aclara.

## Puesta en marcha (una sola vez)

1. **Google Cloud** → crear proyecto (o usar uno existente) → *APIs y servicios* →
   habilitar **Google Calendar API**.
2. *Pantalla de consentimiento OAuth*: tipo Externo, agregar como **usuario de prueba** la cuenta
   de Google cuyo calendario recibirá las demos (con eso alcanza; no hace falta publicar la app).
3. *Credenciales* → **ID de cliente OAuth** → tipo **Aplicación web** → URI de redirección
   autorizada: `http://localhost:3999/callback`. Copiar client ID y secret.
4. En el repo: `cp .env.example .env` y completar `GOOGLE_OAUTH_CLIENT` y `GOOGLE_OAUTH_SECRET`.
5. `bun scripts/google-auth.js` → se abre el navegador → iniciar sesión con la cuenta del
   calendario → aceptar. La consola imprime `GOOGLE_REFRESH_TOKEN=...`; pegarlo en `.env`
   y **sacar** `AGENDA_MODO=simulada`.
6. Probar local: `bun run dev` → http://localhost:3000/agendar. Agendar un turno de prueba y
   verificar que aparece en el calendario con Meet y que llega el mail.
7. **Vercel** → Settings → Environment Variables: cargar `GOOGLE_OAUTH_CLIENT`, `GOOGLE_OAUTH_SECRET`,
   `GOOGLE_REFRESH_TOKEN` (y `GOOGLE_CALENDAR_ID` si no es `primary`). Deploy.

Si el calendario es de **otra persona del equipo**, esa persona corre el paso 5 con su cuenta.
Alternativa: un calendario secundario compartido ("Demos") y `GOOGLE_CALENDAR_ID` con su ID.

## Modo simulado

Sin `GOOGLE_REFRESH_TOKEN` (o con `AGENDA_MODO=simulada`) la agenda funciona completa pero
muestra todos los turnos libres y no crea eventos. La página avisa con un cartel.

## Leads → monday / Sheets / CRM

Si `LEAD_WEBHOOK_URL` está definida, cada reserva se manda como POST JSON con:
`nombre, email, whatsapp, sitioWeb, empresa (dominio del sitio), comentario,
respuestas{areas[], rubro, locales, resuelven, urgencia, rol, origen}, inicio, fin, fecha, hora, meet, eventoId`.
Sirve para un webhook de monday, Make, n8n o un Apps Script de Sheets.

## Qué NO hace todavía

- Cancelar / reprogramar desde la web (el prospecto lo hace desde la invitación de Google).
- Recordatorio por WhatsApp (hoy: mail de Google + recordatorio del calendario).
- Round-robin entre varias personas (hoy: un calendario).
