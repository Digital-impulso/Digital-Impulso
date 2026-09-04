// POST /api/admin/ia-importar → alternativa a "Buscar con IA" sin API key: el panel arma un
// prompt, lo abre en claude.ai (con la suscripción que ya tengan), y esto recibe el JSON que
// Claude respondió, pegado a mano. Mismo guardado (dedupe + auto-envío si corresponde) que
// la búsqueda automática — normalizarResultado usa el mismo esquema de campos en los dos casos.
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';
import { normalizarResultado } from '../_lib/ia.js';
import { guardarProspectosConMensaje } from '../_lib/prospectosIA.js';

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const candidatos = Array.isArray(body.candidatos) ? body.candidatos : null;
  if (!candidatos || !candidatos.length) return error('No se recibió una lista de empresas válida.');

  const normalizados = candidatos.filter((c) => c && typeof c === 'object').map(normalizarResultado);
  const items = await guardarProspectosConMensaje(normalizados);
  return json({ ok: true, items });
}
