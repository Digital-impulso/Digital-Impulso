// Reglas de la agenda de demos. Todo lo que un humano querría tocar está acá.
// Cualquier valor se puede pisar por variable de entorno (AGENDA_*) sin tocar código.

const env = (k, def) => (process.env[k] && process.env[k].trim()) || def;

export const AGENDA = {
  // Zona horaria de la agenda. Argentina no tiene horario de verano, por eso
  // alcanza con un offset fijo (si algún día cambia, se ajusta acá).
  tz: env('AGENDA_TZ', 'America/Argentina/Buenos_Aires'),
  offset: env('AGENDA_OFFSET', '-03:00'),

  duracionMin: Number(env('AGENDA_DURACION_MIN', 30)),   // largo de la demo
  pasoMin: Number(env('AGENDA_PASO_MIN', 30)),           // cada cuánto arranca un turno
  bufferMin: Number(env('AGENDA_BUFFER_MIN', 15)),       // aire antes/después de otros eventos
  horaInicio: env('AGENDA_HORA_INICIO', '10:00'),
  horaFin: env('AGENDA_HORA_FIN', '17:00'),
  diasHabiles: env('AGENDA_DIAS_HABILES', '1,2,3,4,5').split(',').map(Number), // 0=dom … 6=sáb
  anticipacionMin: Number(env('AGENDA_ANTICIPACION_MIN', 180)), // no se puede agendar con menos de 3 h
  diasMax: Number(env('AGENDA_DIAS_MAX', 21)),                  // ventana hacia adelante

  titulo: env('AGENDA_TITULO', 'Demo Digital Impulso'),
  calendarId: env('GOOGLE_CALENDAR_ID', 'primary'),

  // Opcional: a dónde mandar cada lead (monday, Sheets, Make, n8n…). Recibe un POST JSON.
  leadWebhook: env('LEAD_WEBHOOK_URL', ''),

  // Preguntas de calificación del paso 1 (la página las renderiza en este orden).
  // `multiple: true` → checkboxes; si no, radios. Las respuestas se validan contra estas opciones.
  preguntas: {
    areas: {
      titulo: '¿Qué te gustaría resolver?',
      multiple: true,
      opciones: [
        'Tótems de autogestión para pedidos',
        'Cobro con Mercado Pago / QR en el tótem',
        'Atención automática por WhatsApp o chatbot con IA',
        'Automatizar procesos internos',
        'App o sistema a medida',
        'Tableros para ver cómo va el negocio',
        'Todavía no sé, quiero que me orienten',
      ],
    },
    rubro: {
      titulo: '¿De qué rubro es tu negocio?',
      opciones: [
        'Gastronomía (restaurante, heladería, cafetería)',
        'Retail / comercio',
        'Farmacia o droguería',
        'Clubes, museos o eventos',
        'Logística / servicios',
        'Otro',
      ],
    },
    locales: {
      titulo: '¿Cuántos locales o puntos de venta tienen?',
      opciones: ['1', 'Entre 2 y 5', 'Entre 6 y 20', 'Más de 20', 'No aplica / Otra'],
    },
    resuelven: {
      titulo: '¿Cómo toman los pedidos y atienden hoy?',
      opciones: [
        'En mostrador, todo a mano',
        'Con un sistema o POS, pero sin autogestión',
        'Ya tenemos tótem o app de otro proveedor',
        'Otra',
      ],
    },
    urgencia: {
      titulo: '¿Cuándo buscás resolver esto?',
      opciones: ['Urgente (este mes)', 'Próximos 3 meses', 'Solo estoy explorando', 'Otra'],
    },
    rol: {
      titulo: '¿Cuál es tu rol en la empresa?',
      opciones: ['Dueño / CEO', 'Gerente / Director', 'Operaciones / Sistemas', 'Analista / Operativo', 'Otra'],
    },
    origen: {
      titulo: '¿Cómo llegaste a nosotros?',
      opciones: ['Instagram / LinkedIn', 'Google', 'Recomendación de un cliente', 'Vi un tótem instalado', 'Evento / feria', 'Otra'],
    },
  },

  // Campo libre del paso 1 (textarea). Título y placeholder editables acá.
  comentario: {
    titulo: 'Contanos brevemente sobre tu negocio',
    placeholder: 'Cómo atienden hoy, qué te gustaría mejorar, qué te llamó la atención de los tótems…',
  },
};

/** Sin credenciales de Google (o con AGENDA_MODO=simulada) la agenda no toca el calendario. */
export const modoSimulado = () =>
  process.env.AGENDA_MODO === 'simulada' || !process.env.GOOGLE_REFRESH_TOKEN;
