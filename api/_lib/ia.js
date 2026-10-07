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
- Respetá el tamaño de empresa que pida la descripción del usuario (ej. "gastronomía chica" significa chica, no una
  cadena grande). Regla por defecto salvo que el usuario pida explícitamente otra cosa: nada de cadenas grandes,
  franquicias conocidas ni negocios con múltiples sucursales — pero tampoco algo tan chico/informal que
  probablemente no pueda pagar un desarrollo a medida. El target por defecto es un local o negocio independiente
  (1-3 sucursales como máximo) con estructura para invertir en tecnología: local propio, cierta antigüedad,
  presencia online cuidada, volumen visible de clientes. Si la empresa que ibas a guardar es una cadena grande o
  muy conocida, descartala y seguí buscando otra, aunque encaje con el rubro pedido.
- El mensaje de guardar_prospecto tiene que seguir esta estructura fija (formal, en español rioplatense):
  1. Saludo: "Estimados" (o "Estimado/a [Nombre]" si hay un decisor identificado).
  2. Párrafo de apertura: arranca con una presentación CONCISA (una frase corta) de quiénes somos y qué hacemos
     — ej. "Somos Digital Impulso: hacemos tótems de autogestión, WhatsApp con IA y paneles de gestión para
     negocios gastronómicos." — fundida en la misma frase u oración siguiente con UN SOLO detalle relevante de
     ESA empresa puntual (la fricción/oportunidad más concreta que hayas detectado). PROHIBIDO abrir con un
     listado de datos investigados de la empresa (horario de atención, ubicación, volumen, cantidad de
     sucursales, antigüedad, etc.) a modo de informe — eso sea a que le estás explicando su propio negocio o
     leyendo un research en voz alta, no es una propuesta. El dato tiene que aparecer disuelto dentro de la
     propuesta, nunca como preámbulo separado antes de ella. Está bien nombrar una fricción o necesidad real (no
     hace falta esconderla), pero SIEMPRE en tono suave y como una oportunidad que nace de algo bueno (mucha
     demanda, popularidad, reconocimiento) — nunca como una falla, atraso o incoherencia del negocio. PROHIBIDO
     el tono de reclamo/crítica directa (ej. "el reclamo que más se repite", "recién están incorporando lo que
     cualquiera ya tiene", "ni siquiera sus propios canales se ponen de acuerdo", "por la desorganización del
     mostrador", "eso espanta clientes", "mala impresión") — el negocio se tiene que llevar una impresión positiva
     de Digital Impulso, no sentir que lo estamos criticando. Regla práctica: cuando se pueda, arrancar por lo
     bueno (antigüedad, reconocimiento, buenas reseñas, popularidad) y que la fricción aparezca como una
     consecuencia lógica de ESE éxito, no como un defecto aislado. PROHIBIDO presentar una suposición no
     verificada como si fuera un hecho cierto — nada de "seguro", "seguramente", "debe ser", "imaginamos que" para
     afirmar algo que no surge de una fuente real (ej. cómo gestionan internamente sus pedidos, si algo les genera
     tal volumen, etc.); si es una inferencia razonable, decila como tal ("suele", "puede", "ese tipo de demanda
     suele traer...") o mejor, apoyate solo en lo que la fuente realmente dice.
  3. Párrafo de propuesta: qué le propondría Digital Impulso concretamente (de tótems de autogestión, cobro con
     Mercado Pago/QR, chatbots y atención por WhatsApp con IA, automatización de procesos, apps/sistemas a medida,
     o tableros/BI) conectado a la fricción u oportunidad mencionada arriba — no un catálogo completo de servicios.
  4. Pregunta de cierre corta invitando a charlar (ej: "¿Tenés 20 minutos para charlar sobre qué sistemas usan
     hoy?"), adaptada al tema puntual de esa empresa.
  5. Cierre: "Saludos," seguido de "Equipo Digital Impulso · digitalimpulso.com" en la línea siguiente.
- Mensaje corto (el cuerpo entre saludo y cierre, 4-8 líneas), tono directo y profesional. Tratamiento formal en
  plural ("ustedes"/"tienen"/"vimos que..."), nunca "vos"/"tenés" — coherente con el saludo "Estimados".
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
