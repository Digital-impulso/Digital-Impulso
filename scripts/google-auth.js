// Obtiene el GOOGLE_REFRESH_TOKEN para la agenda de demos. Se corre UNA vez:
//
//   bun scripts/google-auth.js
//
// Requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env (Bun lo carga solo).
// En Google Cloud, el cliente OAuth tiene que ser de tipo "Aplicación web" y tener
// http://localhost:3999/callback como URI de redirección autorizada.
// Ver AGENDAR.md para el paso a paso.

const PORT = 3999;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const id = process.env.GOOGLE_CLIENT_ID;
const secret = process.env.GOOGLE_CLIENT_SECRET;
if (!id || !secret) {
  console.error('Faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en .env');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // fuerza que Google devuelva refresh_token aunque ya se haya autorizado antes
  });

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== '/callback') return new Response('Esperando el callback de Google…');
    const code = url.searchParams.get('code');
    if (!code) return new Response('Google no devolvió código: ' + url.searchParams.get('error'), { status: 400 });

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    });
    const j = await r.json();
    if (!j.refresh_token) {
      console.error('Respuesta sin refresh_token:', j);
      return new Response('No vino refresh_token. Mirá la consola.', { status: 500 });
    }
    console.log('\n✅ Listo. Agregá esto a tu .env local y a las variables de entorno de Vercel:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${j.refresh_token}\n`);
    setTimeout(() => { server.stop(); process.exit(0); }, 500);
    return new Response('Autorizado. Ya podés cerrar esta pestaña y volver a la terminal.', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
});

console.log('Abrí esta URL en el navegador, con la cuenta de Google cuyo calendario recibirá las demos:\n');
console.log(authUrl + '\n');
try {
  // En Windows NO usar `cmd /c start`: los "&" de la URL cortan los parámetros. rundll32 abre la URL entera.
  const abrir = process.platform === 'win32'
    ? ['rundll32', 'url.dll,FileProtocolHandler', authUrl]
    : process.platform === 'darwin' ? ['open', authUrl] : ['xdg-open', authUrl];
  Bun.spawn(abrir, { stdio: ['ignore', 'ignore', 'ignore'] });
} catch {}
console.log('(Si el navegador no abre bien, copiá la URL de arriba completa y pegala en la barra de direcciones.)\n');
