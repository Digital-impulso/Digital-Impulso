// POST /api/admin/logout → cierra la sesión del panel.
import { cookieBorrada } from '../_lib/session.js';

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': cookieBorrada() },
  });
}
