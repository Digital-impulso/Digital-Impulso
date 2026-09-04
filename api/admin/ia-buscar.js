// POST /api/admin/ia-buscar → Claude busca empresas nuevas (con web search, requiere API key
// configurada en Integraciones), redacta un mensaje para cada una y las deja como prospecto +
// mensaje borrador (guardarProspectosConMensaje se encarga del auto-envío si corresponde).
import { query } from '../_lib/db.js';
import { json, error } from '../_lib/http.js';
import { sesionValida } from '../_lib/session.js';
import { buscarYRedactarLeads, iaConfigurada } from '../_lib/ia.js';
import { guardarProspectosConMensaje } from '../_lib/prospectosIA.js';

export async function POST(request) {
  if (!(await sesionValida(request))) return error('No autorizado.', 401);
  if (!(await iaConfigurada())) return error('Falta configurar la API key de Claude en Integraciones.', 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Cuerpo inválido.');
  }
  const descripcion = String(body.descripcion || '').trim();
  if (!descripcion) return error('Describí qué tipo de empresas buscar.');
  const cantidad = Math.max(1, Math.min(5, Number(body.cantidad) || 3));

  const existentes = await query('SELECT empresa FROM prospectos');
  const excluir = existentes.rows.map((r) => r.empresa);

  let resultado;
  try {
    resultado = await buscarYRedactarLeads({ descripcion, cantidad, excluir });
  } catch (e) {
    console.error('[admin/ia-buscar]', e);
    return error(`No se pudo completar la búsqueda: ${e.message}`, 502);
  }

  const items = await guardarProspectosConMensaje(resultado.encontrados);
  return json({ ok: true, items, detenidoPor: resultado.detenidoPor });
}
