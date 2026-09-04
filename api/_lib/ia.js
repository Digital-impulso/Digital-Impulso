// Buscador de leads con Claude (panel /admin → Buscar con IA). Una sola llamada a la
// Messages API: Claude busca en la web (tool server-side, corre solo, sin loop de cliente)
// y por cada empresa que encuentra llama la tool `guardar_prospecto` con los datos y el
// mensaje ya redactado. Nunca inventa contactos: si no encuentra un dato público, lo deja vacío.
import Anthropic from '@anthropic-ai/sdk';
import { obtenerConfig } from './configAdmin.js';

const MODELOS_VALIDOS = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const CANALES_VALIDOS = new Set(['email', 'linkedin', 'instagram', 'otro']);

export async function configIA() {
  const c = await obtenerConfig(['ia_api_key', 'ia_modelo', 'ia_auto_enviar']);
  return {
    apiKey: c.ia_api_key || '',
    modelo: MODELOS_VALIDOS.has(c.ia_modelo) ? c.ia_modelo : 'claude-opus-5',
    autoEnviar: c.ia_auto_enviar === '1',
  };
}

export async function iaConfigurada() {
  const c = await configIA();
  return Boolean(c.apiKey);
}

/** Llamada mínima para validar la API key sin gastar casi nada (1 token de salida). */
export async function probarIA() {
  const { apiKey, modelo } = await configIA();
  if (!apiKey) throw new Error('Falta la API key de Claude.');
  const client = new Anthropic({ apiKey });
  await client.messages.create({
    model: modelo,
    max_tokens: 8,
    messages: [{ role: 'user', content: 'Respondé solo "ok".' }],
  });
  return true;
}

const HERRAMIENTA_GUARDAR = {
  name: 'guardar_prospecto',
  description:
    'Registra una empresa encontrada como prospecto, con el mensaje de prospección ya redactado para ella.',
  input_schema: {
    type: 'object',
    properties: {
      empresa: { type: 'string', description: 'Razón social o nombre comercial.' },
      categoria: { type: 'string', description: 'Rubro/categoría corta (ej. "Retail", "Gastronomía").' },
      web: { type: 'string', description: 'Dominio del sitio, sin http(s)://. Vacío si no se encontró.' },
      email: { type: 'string', description: 'Email de contacto público. Vacío si no se encontró uno real.' },
      telefono: { type: 'string', description: 'Teléfono público. Vacío si no se encontró.' },
      linkedin: { type: 'string', description: 'URL del perfil/página de LinkedIn. Vacío si no se encontró.' },
      decisor_nombre: { type: 'string', description: 'Nombre del decisor identificado públicamente. Vacío si no hay uno verificable.' },
      decisor_cargo: { type: 'string', description: 'Cargo del decisor. Vacío si no aplica.' },
      canal: { type: 'string', enum: ['email', 'linkedin', 'instagram', 'otro'], description: 'Mejor canal para el primer contacto.' },
      notas: { type: 'string', description: 'Qué necesidad/oportunidad concreta se detectó (2-4 líneas).' },
      mensaje_asunto: { type: 'string', description: 'Asunto del mensaje (para email; puede ir vacío en otros canales).' },
      mensaje_contenido: { type: 'string', description: 'Mensaje de prospección completo, personalizado para esta empresa puntual.' },
    },
    required: ['empresa', 'canal', 'notas', 'mensaje_contenido'],
    additionalProperties: false,
  },
  strict: true,
};

const SYSTEM = `Sos el equipo de prospección comercial de Digital Impulso (digitalimpulso.com), una empresa argentina de
tecnología, IA y automatización: tótems de autogestión, cobro con Mercado Pago/QR, chatbots y atención por WhatsApp
con IA, automatización de procesos internos, apps y sistemas a medida, y tableros/BI para ver cómo va el negocio.

Tu tarea: buscar empresas reales (usando la herramienta de búsqueda web) que encajen con lo que te pida el usuario,
y por cada una llamar a la herramienta guardar_prospecto con sus datos y un mensaje de prospección ya redactado.

Reglas estrictas:
- Nunca inventes un email, teléfono, nombre de decisor o cargo. Si no lo encontrás publicado en una fuente real,
  dejá ese campo vacío. Es preferible un dato vacío a uno inventado.
- No repitas ninguna empresa que ya esté en esta lista (ya son prospectos cargados): {EXCLUIR}
- El mensaje de guardar_prospecto tiene que ser específico de ESA empresa: qué hace, qué tecnología parece tener
  o no tener, qué fricción/oportunidad concreta detectaste, y qué le propondría Digital Impulso. Nada de plantilla
  genérica ("Hola, somos Digital Impulso..."); vender el problema encontrado, no un catálogo de servicios.
- Mensaje corto (4-8 líneas), tono directo y profesional, en español rioplatense.
- Elegí el canal ("email" si hay un email público real, "linkedin" si solo hay LinkedIn, "instagram" si es un
  negocio con más presencia en Instagram que web/LinkedIn, "otro" si no hay ninguno claro).
- Llamá guardar_prospecto exactamente una vez por empresa nueva, hasta la cantidad pedida.`;

export async function buscarYRedactarLeads({ descripcion, cantidad, excluir }) {
  const { apiKey, modelo } = await configIA();
  if (!apiKey) throw new Error('Falta configurar la API key de Claude en Integraciones.');

  const client = new Anthropic({ apiKey });
  const n = Math.max(1, Math.min(5, Number(cantidad) || 3));

  const response = await client.messages.create({
    model: modelo,
    max_tokens: 16000,
    system: SYSTEM.replace('{EXCLUIR}', excluir.length ? excluir.join(', ') : '(ninguna todavía)'),
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 12 },
      HERRAMIENTA_GUARDAR,
    ],
    messages: [
      {
        role: 'user',
        content: `Buscá ${n} empresas nuevas que encajen con esto: ${descripcion}\n\nLlamá guardar_prospecto una vez por cada una que encuentres.`,
      },
    ],
  });

  const encontrados = [];
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'guardar_prospecto') {
      encontrados.push(normalizarResultado(block.input));
    }
  }
  return { encontrados, detenidoPor: response.stop_reason };
}

export function normalizarResultado(input) {
  const limpiar = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const canal = CANALES_VALIDOS.has(input.canal) ? input.canal : 'otro';
  return {
    empresa: limpiar(input.empresa, 160),
    categoria: limpiar(input.categoria, 20),
    web: limpiar(input.web, 200),
    email: limpiar(input.email, 160).toLowerCase(),
    telefono: limpiar(input.telefono, 60),
    linkedin: limpiar(input.linkedin, 300),
    decisorNombre: limpiar(input.decisor_nombre, 120),
    decisorCargo: limpiar(input.decisor_cargo, 120),
    canal,
    notas: limpiar(input.notas, 4000),
    mensajeAsunto: limpiar(input.mensaje_asunto, 200),
    mensajeContenido: limpiar(input.mensaje_contenido, 8000),
  };
}

/**
 * Verificación real (no la sola palabra del modelo) para decidir si un email es lo bastante
 * confiable como para auto-enviar: el dominio del email tiene que coincidir con el del sitio
 * web que el propio modelo reportó para esa empresa. Si no hay web informada, no se autoenvía.
 */
export function emailVerificado({ email, web }) {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]{2,})$/.exec(String(email || '').toLowerCase());
  if (!m) return false;
  const dominioEmail = m[1];
  const dominioWeb = String(web || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  if (!dominioWeb) return false;
  return dominioEmail === dominioWeb || dominioEmail.endsWith('.' + dominioWeb) || dominioWeb.endsWith('.' + dominioEmail);
}
