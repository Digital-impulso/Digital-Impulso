// Guarda candidatos ya normalizados (empresa + mensaje) como prospecto + mensaje borrador.
// Lo usan tanto "Buscar con IA" (api/admin/ia-buscar.js, resultado de la API de Claude) como
// "Pegar desde Claude.ai" (api/admin/ia-importar.js, JSON pegado a mano) — mismo dedupe,
// misma regla de auto-envío verificado, para que el resultado sea idéntico venga de donde venga.
import { query } from './db.js';
import { emailVerificado, configIA } from './ia.js';
import { enviarMensajeEmail, ErrorEnvio } from './envios.js';

export async function guardarProspectosConMensaje(candidatos) {
  const existentes = await query('SELECT empresa FROM prospectos');
  const yaVistos = new Set(existentes.rows.map((r) => r.empresa.toLowerCase()));
  const { autoEnviar } = await configIA();
  const items = [];

  for (const c of candidatos) {
    if (!c.empresa || yaVistos.has(c.empresa.toLowerCase())) continue;
    yaVistos.add(c.empresa.toLowerCase());

    const rsP = await query(
      `INSERT INTO prospectos (empresa, categoria, web, email, telefono, linkedin, decisor_nombre, decisor_cargo, canal, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING *`,
      [c.empresa, c.categoria, c.web, c.email, c.telefono, c.linkedin, c.decisorNombre, c.decisorCargo, c.canal, c.notas]
    );
    const prospecto = rsP.rows[0];

    const rsM = await query(
      'INSERT INTO mensajes (prospecto_id, canal, asunto, contenido) VALUES (?,?,?,?) RETURNING *',
      [prospecto.id, c.canal, c.mensajeAsunto, c.mensajeContenido]
    );
    let mensaje = rsM.rows[0];
    let autoEnviado = false;
    let motivoNoEnvio = null;

    if (autoEnviar && c.canal === 'email' && c.email) {
      if (emailVerificado({ email: c.email, web: c.web })) {
        try {
          mensaje = await enviarMensajeEmail(mensaje.id, {});
          autoEnviado = true;
        } catch (e) {
          motivoNoEnvio = e instanceof ErrorEnvio ? e.message : 'No se pudo enviar automáticamente.';
        }
      } else {
        motivoNoEnvio = 'El email no coincide con el dominio del sitio web informado; queda como borrador para revisar a mano.';
      }
    }

    items.push({ prospecto, mensaje, autoEnviado, motivoNoEnvio });
  }
  return items;
}
