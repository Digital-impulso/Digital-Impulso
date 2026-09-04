// Base de datos del panel /admin (prospección + usuarios). Turso (libSQL) en producción;
// sin TURSO_DATABASE_URL configurado, cae a un archivo SQLite local para desarrollar
// sin depender de una cuenta de Turso (mismo espíritu que AGENDA_MODO=simulada).
import { createClient } from '@libsql/client';
import { randomBytes } from 'node:crypto';

const env = (k, def = '') => (process.env[k] && process.env[k].trim()) || def;

let client = null;
function db() {
  if (client) return client;
  client = createClient({
    url: env('TURSO_DATABASE_URL', 'file:./data/admin-local.db'),
    authToken: env('TURSO_AUTH_TOKEN') || undefined,
  });
  return client;
}

let listo = null;
function schemaListo() {
  if (!listo) {
    listo = db().batch(
      [
        `CREATE TABLE IF NOT EXISTS prospectos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          empresa TEXT NOT NULL,
          categoria TEXT NOT NULL DEFAULT '',
          web TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          telefono TEXT NOT NULL DEFAULT '',
          linkedin TEXT NOT NULL DEFAULT '',
          decisor_nombre TEXT NOT NULL DEFAULT '',
          decisor_cargo TEXT NOT NULL DEFAULT '',
          canal TEXT NOT NULL DEFAULT 'email',
          notas TEXT NOT NULL DEFAULT '',
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS mensajes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prospecto_id INTEGER NOT NULL REFERENCES prospectos(id) ON DELETE CASCADE,
          canal TEXT NOT NULL DEFAULT 'email',
          asunto TEXT NOT NULL DEFAULT '',
          contenido TEXT NOT NULL DEFAULT '',
          enviado INTEGER NOT NULL DEFAULT 0,
          fecha_envio TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_mensajes_prospecto ON mensajes(prospecto_id)`,
        `CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        // Config interna (ej. el secreto que firma las cookies de sesión). Nada de esto
        // se toca a mano: se genera y guarda solo la primera vez que arranca el panel.
        `CREATE TABLE IF NOT EXISTS config (
          clave TEXT PRIMARY KEY,
          valor TEXT NOT NULL
        )`,
      ],
      'write'
    );
  }
  return listo;
}

/** Ejecuta un SQL ya con el esquema garantizado. */
export async function query(sql, args = []) {
  await schemaListo();
  return db().execute({ sql, args });
}

/** Varias sentencias en una sola transacción (ej: alta de prospecto + su primer mensaje). */
export async function transaccion(sentencias) {
  await schemaListo();
  return db().batch(sentencias, 'write');
}

/** true si ya existe al menos un usuario (para saber si mostrar el alta inicial o el login). */
export async function hayUsuarios() {
  const rs = await query('SELECT 1 FROM usuarios LIMIT 1');
  return rs.rows.length > 0;
}

let secretoCache = null;
/**
 * Secreto que firma las cookies de sesión. Se genera una sola vez (en el primer arranque)
 * y queda guardado en la tabla `config`; así no hace falta cargarlo a mano como variable
 * de entorno. INSERT OR IGNORE evita que dos instancias frías lo pisen entre sí: la que
 * llega segunda simplemente relee el valor que ya quedó guardado.
 */
export async function obtenerSecretoSesion() {
  if (secretoCache) return secretoCache;
  const candidato = randomBytes(32).toString('hex');
  await query('INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)', ['session_secret', candidato]);
  const rs = await query('SELECT valor FROM config WHERE clave = ?', ['session_secret']);
  secretoCache = rs.rows[0].valor;
  return secretoCache;
}
