// Panel /admin — prospección. Vanilla JS, sin build ni framework (mismo criterio que el resto del sitio).
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let prospectos = [];
  let prospectoActualId = null;

  // ---------- API ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- Vistas ----------
  // Tres pantallas posibles: alta del primer usuario (setup), login, o la app ya adentro.
  function mostrarVista(vista) {
    $('#adm-setup').classList.toggle('adm-hidden', vista !== 'setup');
    $('#adm-login').classList.toggle('adm-hidden', vista !== 'login');
    $('#adm-app').classList.toggle('adm-hidden', vista !== 'app');
  }

  function abrirModal(id) { $('#' + id).classList.remove('adm-hidden'); }
  function cerrarModal(id) { $('#' + id).classList.add('adm-hidden'); }
  $$('[data-cerrar]').forEach((el) => el.addEventListener('click', () => cerrarModal(el.dataset.cerrar)));

  // ---------- Setup (alta del primer usuario) ----------
  $('#adm-setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = $('#adm-setup-error');
    errorEl.textContent = '';
    try {
      await api('/api/admin/setup', { method: 'POST', body: { usuario: $('#adm-setup-usuario').value, clave: $('#adm-setup-clave').value } });
      $('#adm-setup-clave').value = '';
      mostrarVista('app');
      await cargarProspectos();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // ---------- Login ----------
  $('#adm-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = $('#adm-login-error');
    errorEl.textContent = '';
    try {
      await api('/api/admin/login', { method: 'POST', body: { usuario: $('#adm-usuario').value, clave: $('#adm-clave').value } });
      $('#adm-clave').value = '';
      mostrarVista('app');
      await cargarProspectos();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  $('#adm-logout').addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* no bloquea el logout visual */ }
    mostrarVista('login');
  });

  async function chequearSesion() {
    try {
      const setup = await api('/api/admin/setup');
      if (setup.necesario) { mostrarVista('setup'); return; }
    } catch { /* si esto falla, probamos directo con la sesión */ }
    try {
      await cargarProspectos();
      mostrarVista('app');
    } catch {
      mostrarVista('login');
    }
  }

  // ---------- Tabla ----------
  async function cargarProspectos() {
    const data = await api('/api/admin/prospectos');
    prospectos = data.prospectos;
    renderTabla();
  }

  const fmtFecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  function renderTabla() {
    const texto = $('#adm-buscar').value.trim().toLowerCase();
    const canal = $('#adm-filtro-canal').value;
    const estado = $('#adm-filtro-estado').value;

    const filas = prospectos.filter((p) => {
      if (texto && !`${p.empresa} ${p.decisor_nombre}`.toLowerCase().includes(texto)) return false;
      if (canal && p.canal !== canal) return false;
      if (estado === 'pendiente' && p.mensajes_enviados > 0) return false;
      if (estado === 'enviado' && p.mensajes_enviados === 0) return false;
      return true;
    });

    const tbody = $('#adm-tbody');
    tbody.innerHTML = '';
    $('#adm-empty').classList.toggle('adm-hidden', filas.length > 0);

    for (const p of filas) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b>${escapeHtml(p.empresa)}</b>${p.web ? `<div class="adm-muted">${escapeHtml(p.web)}</div>` : ''}</td>
        <td>${escapeHtml(p.categoria) || '—'}</td>
        <td>${escapeHtml(p.canal)}</td>
        <td>${escapeHtml(p.decisor_nombre) || '<span class="adm-muted">Sin identificar</span>'}${p.decisor_cargo ? `<div class="adm-muted">${escapeHtml(p.decisor_cargo)}</div>` : ''}</td>
        <td>${p.email ? escapeHtml(p.email) : '<span class="adm-muted">—</span>'}${p.telefono ? `<div class="adm-muted">${escapeHtml(p.telefono)}</div>` : ''}</td>
        <td><span class="adm-pill ${p.mensajes_enviados > 0 ? 'adm-pill-si' : 'adm-pill-no'}">${p.mensajes_enviados}/${p.mensajes_total} enviados</span></td>
        <td>${fmtFecha(p.ultimo_envio)}</td>
      `;
      tr.addEventListener('click', () => abrirProspecto(p.id));
      tbody.appendChild(tr);
    }
  }

  $('#adm-buscar').addEventListener('input', renderTabla);
  $('#adm-filtro-canal').addEventListener('change', renderTabla);
  $('#adm-filtro-estado').addEventListener('change', renderTabla);

  // ---------- Modal prospecto ----------
  const MP = {
    id: $('#adm-mp-id'), empresa: $('#adm-mp-empresa'), categoria: $('#adm-mp-categoria'),
    web: $('#adm-mp-web'), email: $('#adm-mp-email'), telefono: $('#adm-mp-telefono'),
    linkedin: $('#adm-mp-linkedin'), decisorNombre: $('#adm-mp-decisor-nombre'), decisorCargo: $('#adm-mp-decisor-cargo'),
    canal: $('#adm-mp-canal'), notas: $('#adm-mp-notas'),
  };

  function limpiarFormularioProspecto() {
    Object.values(MP).forEach((el) => (el.value = ''));
    MP.canal.value = 'email';
  }

  $('#adm-btn-nuevo').addEventListener('click', () => {
    prospectoActualId = null;
    limpiarFormularioProspecto();
    $('#adm-mp-titulo').textContent = 'Nuevo prospecto';
    $('#adm-mp-error').textContent = '';
    $('#adm-mp-eliminar').classList.add('adm-hidden');
    $('#adm-mp-mensajes-wrap').classList.add('adm-hidden');
    abrirModal('adm-modal-prospecto');
  });

  async function abrirProspecto(id) {
    const p = prospectos.find((x) => x.id === id);
    if (!p) return;
    prospectoActualId = id;
    MP.id.value = p.id;
    MP.empresa.value = p.empresa; MP.categoria.value = p.categoria; MP.web.value = p.web;
    MP.email.value = p.email; MP.telefono.value = p.telefono; MP.linkedin.value = p.linkedin;
    MP.decisorNombre.value = p.decisor_nombre; MP.decisorCargo.value = p.decisor_cargo;
    MP.canal.value = p.canal; MP.notas.value = p.notas;

    $('#adm-mp-titulo').textContent = p.empresa;
    $('#adm-mp-error').textContent = '';
    $('#adm-mp-eliminar').classList.remove('adm-hidden');
    $('#adm-mp-mensajes-wrap').classList.remove('adm-hidden');
    abrirModal('adm-modal-prospecto');
    await cargarMensajes(id);
  }

  $('#adm-mp-guardar').addEventListener('click', async () => {
    const errorEl = $('#adm-mp-error');
    errorEl.textContent = '';
    const payload = {
      empresa: MP.empresa.value, categoria: MP.categoria.value, web: MP.web.value,
      email: MP.email.value, telefono: MP.telefono.value, linkedin: MP.linkedin.value,
      decisorNombre: MP.decisorNombre.value, decisorCargo: MP.decisorCargo.value,
      canal: MP.canal.value, notas: MP.notas.value,
    };
    if (!payload.empresa.trim()) { errorEl.textContent = 'Falta el nombre de la empresa.'; return; }
    try {
      if (prospectoActualId) {
        await api('/api/admin/prospectos', { method: 'PUT', body: { id: prospectoActualId, ...payload } });
      } else {
        await api('/api/admin/prospectos', { method: 'POST', body: payload });
      }
      await cargarProspectos();
      cerrarModal('adm-modal-prospecto');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  $('#adm-mp-eliminar').addEventListener('click', async () => {
    if (!prospectoActualId) return;
    if (!confirm('¿Eliminar este prospecto y todos sus mensajes?')) return;
    try {
      await api(`/api/admin/prospectos?id=${prospectoActualId}`, { method: 'DELETE' });
      await cargarProspectos();
      cerrarModal('adm-modal-prospecto');
    } catch (err) {
      $('#adm-mp-error').textContent = err.message;
    }
  });

  // ---------- Mensajes ----------
  async function cargarMensajes(prospectoId) {
    const data = await api(`/api/admin/mensajes?prospecto_id=${prospectoId}`);
    renderMensajes(data.mensajes);
  }

  function renderMensajes(mensajes) {
    const cont = $('#adm-mp-mensajes');
    cont.innerHTML = '';
    if (!mensajes.length) {
      cont.innerHTML = '<p class="adm-muted" style="font-size:13px">Todavía no hay mensajes para este prospecto.</p>';
      return;
    }
    for (const m of mensajes) {
      const item = document.createElement('div');
      item.className = 'adm-msg-item';
      const badge = m.enviado
        ? `<span class="adm-pill adm-pill-si">Enviado</span> <span class="adm-fecha">${fmtFecha(m.fecha_envio)}</span>`
        : '<span class="adm-pill adm-pill-no">Sin enviar</span>';
      item.innerHTML = `
        <div class="adm-msg-head">
          <div>${badge} <span class="adm-muted" style="margin-left:8px">${escapeHtml(m.canal)}</span></div>
        </div>
        <div class="adm-field"><label>Asunto</label><input class="adm-i-asunto" value="${escapeAttr(m.asunto)}"></div>
        <div class="adm-field"><label>Contenido</label><textarea class="adm-i-contenido">${escapeHtml(m.contenido)}</textarea></div>
        <p class="adm-error adm-i-error"></p>
        <div class="adm-actions">
          <button class="adm-btn adm-btn-ghost adm-i-guardar">Guardar</button>
          <button class="adm-btn adm-btn-ghost adm-i-toggle">${m.enviado ? 'Desmarcar enviado' : 'Marcar enviado (a mano)'}</button>
          ${m.canal === 'email' ? `<button class="adm-btn adm-i-enviar">${m.enviado ? 'Reenviar por email' : 'Enviar por email ahora'}</button>` : ''}
          <span class="adm-spacer"></span>
          <button class="adm-btn adm-btn-danger adm-i-borrar">Eliminar</button>
        </div>
      `;
      const errorEl = item.querySelector('.adm-i-error');

      item.querySelector('.adm-i-guardar').addEventListener('click', async () => {
        errorEl.textContent = '';
        try {
          await api('/api/admin/mensajes', { method: 'PUT', body: {
            id: m.id,
            asunto: item.querySelector('.adm-i-asunto').value,
            contenido: item.querySelector('.adm-i-contenido').value,
          } });
          await cargarMensajes(prospectoActualId);
          await cargarProspectos();
        } catch (err) { errorEl.textContent = err.message; }
      });

      item.querySelector('.adm-i-toggle').addEventListener('click', async () => {
        errorEl.textContent = '';
        try {
          await api('/api/admin/mensajes', { method: 'PUT', body: { id: m.id, enviado: !m.enviado } });
          await cargarMensajes(prospectoActualId);
          await cargarProspectos();
        } catch (err) { errorEl.textContent = err.message; }
      });

      const btnEnviar = item.querySelector('.adm-i-enviar');
      if (btnEnviar) {
        btnEnviar.addEventListener('click', async () => {
          errorEl.textContent = '';
          if (m.enviado && !confirm('Este mensaje ya figura como enviado. ¿Reenviar de todas formas?')) return;
          btnEnviar.disabled = true;
          try {
            await api('/api/admin/enviar', { method: 'POST', body: { mensajeId: m.id, forzarReenvio: !!m.enviado } });
            await cargarMensajes(prospectoActualId);
            await cargarProspectos();
          } catch (err) {
            errorEl.textContent = err.message;
          } finally {
            btnEnviar.disabled = false;
          }
        });
      }

      item.querySelector('.adm-i-borrar').addEventListener('click', async () => {
        if (!confirm('¿Eliminar este mensaje?')) return;
        try {
          await api(`/api/admin/mensajes?id=${m.id}`, { method: 'DELETE' });
          await cargarMensajes(prospectoActualId);
          await cargarProspectos();
        } catch (err) { errorEl.textContent = err.message; }
      });

      cont.appendChild(item);
    }
  }

  $('#adm-nm-crear').addEventListener('click', async () => {
    const errorEl = $('#adm-nm-error');
    errorEl.textContent = '';
    const contenido = $('#adm-nm-contenido').value;
    if (!contenido.trim()) { errorEl.textContent = 'Escribí el contenido del mensaje.'; return; }
    try {
      await api('/api/admin/mensajes', { method: 'POST', body: {
        prospectoId: prospectoActualId, canal: $('#adm-nm-canal').value,
        asunto: $('#adm-nm-asunto').value, contenido,
      } });
      $('#adm-nm-asunto').value = ''; $('#adm-nm-contenido').value = '';
      await cargarMensajes(prospectoActualId);
      await cargarProspectos();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // ---------- Importar varios ----------
  $('#adm-btn-importar').addEventListener('click', () => {
    $('#adm-imp-texto').value = '';
    $('#adm-imp-error').textContent = '';
    $('#adm-imp-ok').textContent = '';
    abrirModal('adm-modal-importar');
  });

  const CAMPOS_IMPORT = ['empresa', 'categoria', 'web', 'email', 'telefono', 'linkedin', 'decisorNombre', 'decisorCargo', 'canal', 'notas'];

  function parseImportacion(texto) {
    return texto.split('\n').map((l) => l.trim()).filter(Boolean).map((linea) => {
      const partes = (linea.includes('\t') ? linea.split('\t') : linea.split('|')).map((c) => c.trim());
      const obj = {};
      CAMPOS_IMPORT.forEach((campo, i) => { obj[campo] = partes[i] || ''; });
      return obj;
    }).filter((o) => o.empresa);
  }

  $('#adm-imp-confirmar').addEventListener('click', async () => {
    const errorEl = $('#adm-imp-error');
    const okEl = $('#adm-imp-ok');
    errorEl.textContent = ''; okEl.textContent = '';
    const items = parseImportacion($('#adm-imp-texto').value);
    if (!items.length) { errorEl.textContent = 'No encontré ninguna fila con nombre de empresa.'; return; }
    try {
      const data = await api('/api/admin/prospectos', { method: 'POST', body: { items } });
      okEl.textContent = `Se importaron ${data.prospectos.length} prospectos.`;
      await cargarProspectos();
      setTimeout(() => cerrarModal('adm-modal-importar'), 900);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // ---------- Configuración / usuarios ----------
  $('#adm-btn-config').addEventListener('click', async () => {
    $('#adm-nu-error').textContent = '';
    $('#adm-nu-usuario').value = ''; $('#adm-nu-clave').value = '';
    abrirModal('adm-modal-config');
    await cargarUsuarios();
  });

  async function cargarUsuarios() {
    const lista = $('#adm-usuarios-lista');
    lista.innerHTML = '<p class="adm-muted" style="font-size:13px">Cargando…</p>';
    try {
      const data = await api('/api/admin/usuarios');
      renderUsuarios(data.usuarios);
    } catch (err) {
      lista.innerHTML = `<p class="adm-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderUsuarios(usuarios) {
    const lista = $('#adm-usuarios-lista');
    lista.innerHTML = '';
    const puedeBorrar = usuarios.length > 1;
    for (const u of usuarios) {
      const item = document.createElement('div');
      item.className = 'adm-msg-item';
      item.innerHTML = `
        <div class="adm-msg-head">
          <div><b>${escapeHtml(u.usuario)}</b> <span class="adm-muted">desde ${fmtFecha(u.creado_en)}</span></div>
        </div>
        <div class="adm-grid2">
          <div class="adm-field"><label>Nueva contraseña</label><input type="password" class="adm-u-clave" placeholder="mín. 8 caracteres"></div>
        </div>
        <p class="adm-error adm-u-error"></p>
        <div class="adm-actions">
          <button class="adm-btn adm-btn-ghost adm-u-cambiar">Cambiar contraseña</button>
          <span class="adm-spacer"></span>
          <button class="adm-btn adm-btn-danger adm-u-borrar" ${puedeBorrar ? '' : 'disabled title="Es el único usuario"'}>Eliminar</button>
        </div>
      `;
      const errorEl = item.querySelector('.adm-u-error');

      item.querySelector('.adm-u-cambiar').addEventListener('click', async () => {
        errorEl.textContent = '';
        const clave = item.querySelector('.adm-u-clave').value;
        try {
          await api('/api/admin/usuarios', { method: 'PUT', body: { id: u.id, clave } });
          item.querySelector('.adm-u-clave').value = '';
          errorEl.classList.remove('adm-error'); errorEl.classList.add('adm-ok');
          errorEl.textContent = 'Contraseña actualizada.';
        } catch (err) {
          errorEl.classList.remove('adm-ok'); errorEl.classList.add('adm-error');
          errorEl.textContent = err.message;
        }
      });

      item.querySelector('.adm-u-borrar').addEventListener('click', async () => {
        if (!confirm(`¿Eliminar el usuario "${u.usuario}"?`)) return;
        try {
          await api(`/api/admin/usuarios?id=${u.id}`, { method: 'DELETE' });
          await cargarUsuarios();
        } catch (err) { errorEl.textContent = err.message; }
      });

      lista.appendChild(item);
    }
  }

  $('#adm-nu-crear').addEventListener('click', async () => {
    const errorEl = $('#adm-nu-error');
    errorEl.textContent = '';
    try {
      await api('/api/admin/usuarios', { method: 'POST', body: { usuario: $('#adm-nu-usuario').value, clave: $('#adm-nu-clave').value } });
      $('#adm-nu-usuario').value = ''; $('#adm-nu-clave').value = '';
      await cargarUsuarios();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  chequearSesion();
})();
