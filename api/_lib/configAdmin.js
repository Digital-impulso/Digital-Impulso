// Config editable desde /admin (Integraciones), guardada en la tabla `config` de Turso.
// Mismo mecanismo que el secreto de sesión: clave/valor, sin variables de entorno.
import { query } from './db.js';

export async function obtenerConfig(claves) {
  if (!claves.length) return {};
  const rs = await query(`SELECT clave, valor FROM config WHERE clave IN (${claves.map(() => '?').join(',')})`, claves);
  const out = {};
  for (const c of claves) out[c] = '';
  for (const row of rs.rows) out[row.clave] = row.valor;
  return out;
}

/** Guarda cada par clave/valor. Si `valor` es undefined, esa clave se deja como está (no se pisa). */
export async function guardarConfig(pares) {
  for (const [clave, valor] of Object.entries(pares)) {
    if (valor === undefined) continue;
    await query(
      "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      [clave, String(valor ?? '')]
    );
  }
}
