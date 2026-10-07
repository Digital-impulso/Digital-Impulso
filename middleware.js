import { next, rewrite } from '@vercel/functions';

// expo.digitalimpulso.com sirve la página de /expo sin cambiar la barra de
// direcciones.
//
// Esto no se puede resolver con un rewrite de vercel.json: Vercel resuelve el
// filesystem antes de aplicar los rewrites, y "/" siempre encuentra index.html,
// así que la regla nunca llega a evaluarse. El middleware, en cambio, corre
// antes del filesystem.
//
// El matcher limita la función a la raíz: el resto del sitio (assets, /totems,
// /proyectos, las APIs) no pasa por acá y se sirve como siempre.

const HOST_EXPO = 'expo.digitalimpulso.com';

export const config = {
  matcher: '/',
  runtime: 'nodejs',
};

export default function middleware(request) {
  try {
    const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];
    if (host === HOST_EXPO) {
      return rewrite(new URL('/expo', request.url));
    }
  } catch {
    // Ante cualquier problema, la home del sitio principal se sirve igual.
  }
  return next();
}
