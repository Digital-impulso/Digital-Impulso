// Carga inicial de los 29 prospectos C/D investigados, con su mensaje borrador ya redactado.
//
// Uso: completar TURSO_DATABASE_URL / TURSO_AUTH_TOKEN en .env (los mismos que usa Vercel en
// producción) y correr:
//   bun scripts/seed-prospectos.mjs
//
// Es idempotente: si una empresa ya existe (comparando por nombre), se saltea en vez de duplicarla.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from '../api/_lib/db.js';

const here = dirname(fileURLToPath(import.meta.url));
const datos = JSON.parse(readFileSync(join(here, 'seed-data', 'prospectos-c-d.json'), 'utf8'));

let creados = 0;
let saltados = 0;

for (const it of datos) {
  const existe = await query('SELECT id FROM prospectos WHERE lower(empresa) = lower(?)', [it.empresa]);
  if (existe.rows.length) {
    console.log('· ya existe, salteada:', it.empresa);
    saltados++;
    continue;
  }

  const p = await query(
    `INSERT INTO prospectos (empresa, categoria, web, email, telefono, linkedin, decisor_nombre, decisor_cargo, canal, notas)
     VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`,
    [it.empresa, it.categoria, it.web, it.email, it.telefono, it.linkedin, it.decisorNombre, it.decisorCargo, it.canal, it.notas]
  );
  await query(
    'INSERT INTO mensajes (prospecto_id, canal, asunto, contenido) VALUES (?,?,?,?)',
    [p.rows[0].id, it.canal, it.mensajeAsunto, it.mensajeContenido]
  );
  console.log('✓ creada:', it.empresa);
  creados++;
}

console.log(`\nListo: ${creados} prospectos nuevos, ${saltados} ya existían.`);
process.exit(0);
