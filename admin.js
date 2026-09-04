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

  // ---------- Navegación del panel lateral ----------
  const CARGA_POR_VISTA = { usuarios: cargarUsuarios, integraciones: cargarIntegraciones, borradores: cargarBorradores };

  $$('.adm-nav-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const vista = btn.dataset.vista;
      $$('.adm-nav-item').forEach((b) => b.classList.toggle('is-activa', b === btn));
      $$('.adm-view').forEach((v) => v.classList.toggle('adm-hidden', v.id !== `adm-view-${vista}`));
      if (CARGA_POR_VISTA[vista]) await CARGA_POR_VISTA[vista]();
    });
  });

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
      cont.appendChild(crearItemMensaje(m, {
        mostrarEmpresa: false,
        linkedin: MP.linkedin.value,
        onCambio: async () => { await cargarMensajes(prospectoActualId); await cargarProspectos(); },
      }));
    }
  }

  /**
   * Un mensaje con sus acciones (guardar, marcar enviado, enviar por email, abrir y copiar,
   * eliminar). Lo usan tanto la ficha de un prospecto (renderMensajes) como la vista Borradores
   * (renderBorradores, que además muestra a qué empresa pertenece cada uno).
   * ctx: { mostrarEmpresa, empresa?, prospectoId?, linkedin, onCambio }
   */
  function crearItemMensaje(m, ctx) {
    const item = document.createElement('div');
    item.className = 'adm-msg-item';
    const badge = m.enviado
      ? `<span class="adm-pill adm-pill-si">Enviado</span> <span class="adm-fecha">${fmtFecha(m.fecha_envio)}</span>`
      : '<span class="adm-pill adm-pill-no">Sin enviar</span>';
    const encabezado = ctx.mostrarEmpresa ? `<b>${escapeHtml(ctx.empresa)}</b> · ` : '';
    item.innerHTML = `
      <div class="adm-msg-head">
        <div>${encabezado}${badge} <span class="adm-muted" style="margin-left:8px">${escapeHtml(m.canal)}</span></div>
        ${ctx.mostrarEmpresa ? '<button class="adm-btn adm-btn-ghost adm-i-ver">Ver ficha →</button>' : ''}
      </div>
      <div class="adm-field"><label>Asunto</label><input class="adm-i-asunto" value="${escapeAttr(m.asunto)}"></div>
      <div class="adm-field"><label>Contenido</label><textarea class="adm-i-contenido">${escapeHtml(m.contenido)}</textarea></div>
      <p class="adm-error adm-i-error"></p>
      <div class="adm-actions">
        <button class="adm-btn adm-btn-ghost adm-i-guardar">Guardar</button>
        <button class="adm-btn adm-btn-ghost adm-i-toggle">${m.enviado ? 'Desmarcar enviado' : 'Marcar enviado (a mano)'}</button>
        ${m.canal === 'email' ? `<button class="adm-btn adm-i-enviar">${m.enviado ? 'Reenviar por email' : 'Enviar por email ahora'}</button>` : ''}
        ${m.canal === 'linkedin' || m.canal === 'instagram' ? '<button class="adm-btn adm-i-abrir">Abrir y copiar →</button>' : ''}
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
        await ctx.onCambio();
      } catch (err) { errorEl.textContent = err.message; }
    });

    item.querySelector('.adm-i-toggle').addEventListener('click', async () => {
      errorEl.textContent = '';
      try {
        await api('/api/admin/mensajes', { method: 'PUT', body: { id: m.id, enviado: !m.enviado } });
        await ctx.onCambio();
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
          await ctx.onCambio();
        } catch (err) {
          errorEl.textContent = err.message;
        } finally {
          btnEnviar.disabled = false;
        }
      });
    }

    const btnAbrir = item.querySelector('.adm-i-abrir');
    if (btnAbrir) {
      btnAbrir.addEventListener('click', () => abrirDrawerEnvio(m, ctx.linkedin));
    }

    const btnVer = item.querySelector('.adm-i-ver');
    if (btnVer) {
      btnVer.addEventListener('click', () => abrirProspecto(ctx.prospectoId));
    }

    item.querySelector('.adm-i-borrar').addEventListener('click', async () => {
      if (!confirm('¿Eliminar este mensaje?')) return;
      try {
        await api(`/api/admin/mensajes?id=${m.id}`, { method: 'DELETE' });
        await ctx.onCambio();
      } catch (err) { errorEl.textContent = err.message; }
    });

    return item;
  }

  // ---------- Borradores (todos los mensajes de todas las empresas, en un solo lugar) ----------
  async function cargarBorradores() {
    const estado = $('#adm-bo-filtro').value || 'pendiente';
    const data = await api(`/api/admin/mensajes?estado=${estado}`);
    renderBorradores(data.mensajes);
  }

  function renderBorradores(mensajes) {
    const cont = $('#adm-bo-lista');
    cont.innerHTML = '';
    $('#adm-bo-empty').classList.toggle('adm-hidden', mensajes.length > 0);
    for (const m of mensajes) {
      cont.appendChild(crearItemMensaje(m, {
        mostrarEmpresa: true,
        empresa: m.prospecto_empresa,
        prospectoId: m.prospecto_id,
        linkedin: m.prospecto_linkedin,
        onCambio: async () => { await cargarBorradores(); await cargarProspectos(); },
      }));
    }
  }

  $('#adm-bo-filtro').addEventListener('change', cargarBorradores);

  // ---------- Drawer: enviar por LinkedIn/Instagram (copiar + abrir el perfil) ----------
  // No se puede embeber LinkedIn/Instagram dentro de esta página (ellos mismos lo bloquean,
  // vía X-Frame-Options/CSP, para evitar clickjacking — ni un <iframe> ni ningún truco de
  // frontend lo evita). Lo más parecido a "verlos juntos" sin eso es abrir una ventana aparte
  // ya ubicada al lado de esta, en vez de una pestaña más — ver abrirVentanaAlLado más abajo.
  let drawerMensajeId = null;

  function urlRedSocial(valor, canal) {
    const v = (valor || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (/linkedin\.com/i.test(v)) return `https://${v.replace(/^\/+/, '')}`;
    if (/instagram\.com/i.test(v)) return `https://${v.replace(/^\/+/, '')}`;
    const usuario = v.replace(/^@/, '');
    // ig.me/m/<usuario> es un link que el propio Instagram provee para ir directo al chat con
    // esa persona (el mismo que usan en las bios como "Enviame un mensaje"), no una ficha.
    return canal === 'instagram' ? `https://ig.me/m/${usuario}` : `https://www.linkedin.com/in/${usuario}`;
  }

  /**
   * Abre la red social en una ventana aparte (no una pestaña más), ya ubicada al lado de esta.
   * Si el navegador soporta la Window Management API (Chrome/Edge) y hay un segundo monitor,
   * la manda ahí entera; si no, la deja en la mitad derecha de la pantalla actual. Ninguna de
   * las dos formas embebe nada — son ventanas del sistema operativo, no iframes.
   */
  async function abrirVentanaAlLado(url) {
    let left = Math.round(window.screen.availWidth / 2);
    let top = window.screen.availTop || 0;
    let width = Math.round(window.screen.availWidth / 2);
    let height = window.screen.availHeight;

    if (window.getScreenDetails) {
      try {
        const detalles = await window.getScreenDetails();
        const otra = detalles.screens.find((s) => s !== detalles.currentScreen);
        if (otra) { left = otra.availLeft; top = otra.availTop; width = otra.availWidth; height = otra.availHeight; }
      } catch { /* sin permiso o sin segundo monitor: se usa la mitad de la pantalla actual */ }
    }

    window.open(url, 'adm_red_social', `noopener,left=${left},top=${top},width=${width},height=${height}`);
  }

  function abrirDrawerEnvio(mensaje, valorContacto) {
    drawerMensajeId = mensaje.id;
    const redNombre = mensaje.canal === 'instagram' ? 'Instagram' : 'LinkedIn';
    $('#adm-dr-titulo').textContent = `Enviar por ${redNombre}`;
    $('#adm-dr-sub').textContent = mensaje.enviado ? 'Ya está marcado como enviado.' : 'Todavía sin enviar.';
    $('#adm-dr-mensaje').value = mensaje.contenido;
    $('#adm-dr-ok').textContent = '';
    $('#adm-dr-marcar').textContent = mensaje.enviado ? 'Ya está marcado como enviado' : 'Ya lo mandé — marcar como enviado';
    $('#adm-dr-marcar').disabled = mensaje.enviado;

    const url = urlRedSocial(valorContacto, mensaje.canal);
    const btnAbrir = $('#adm-dr-abrir');
    btnAbrir.disabled = !url;
    btnAbrir.dataset.url = url;
    $('#adm-dr-sin-url').textContent = url ? '' : `No hay LinkedIn/Instagram cargado para este prospecto — completalo en la ficha para poder abrirlo directo.`;

    $('#adm-drawer-overlay').classList.remove('adm-hidden');
  }

  $('#adm-dr-cerrar').addEventListener('click', () => $('#adm-drawer-overlay').classList.add('adm-hidden'));
  $('#adm-drawer-overlay').addEventListener('click', (e) => { if (e.target.id === 'adm-drawer-overlay') $('#adm-drawer-overlay').classList.add('adm-hidden'); });

  $('#adm-dr-copiar').addEventListener('click', async () => {
    const okEl = $('#adm-dr-ok');
    try {
      await navigator.clipboard.writeText($('#adm-dr-mensaje').value);
      okEl.textContent = '¡Copiado!';
    } catch {
      $('#adm-dr-mensaje').select();
      okEl.textContent = 'No se pudo copiar solo — seleccioná el texto (Ctrl/Cmd+C).';
    }
  });

  $('#adm-dr-abrir').addEventListener('click', () => {
    const url = $('#adm-dr-abrir').dataset.url;
    if (url) abrirVentanaAlLado(url);
  });

  $('#adm-dr-marcar').addEventListener('click', async () => {
    if (!drawerMensajeId) return;
    try {
      await api('/api/admin/mensajes', { method: 'PUT', body: { id: drawerMensajeId, enviado: true } });
      $('#adm-drawer-overlay').classList.add('adm-hidden');
      await cargarMensajes(prospectoActualId);
      await cargarProspectos();
    } catch (err) {
      $('#adm-dr-ok').textContent = err.message;
    }
  });

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

  // ---------- Usuarios (vista del panel lateral) ----------
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

  // ---------- Integraciones (email de prospección + reglas de envío + IA) ----------
  async function cargarIntegraciones() {
    ['adm-int-smtp-error', 'adm-int-smtp-ok', 'adm-int-reglas-error', 'adm-int-reglas-ok', 'adm-int-ia-error', 'adm-int-ia-ok']
      .forEach((id) => { $('#' + id).textContent = ''; });
    try {
      const data = await api('/api/admin/integraciones');
      $('#adm-int-host').value = data.smtp.host || '';
      $('#adm-int-port').value = data.smtp.port || '';
      $('#adm-int-user').value = data.smtp.user || '';
      $('#adm-int-from').value = data.smtp.from || '';
      $('#adm-int-pass').value = '';
      $('#adm-int-pass').placeholder = data.smtp.passConfigurada ? '••••••••  (ya configurada; dejar vacío para no cambiarla)' : 'Sin configurar';
      $('#adm-int-pass-hint').textContent = data.smtp.passConfigurada
        ? 'Ya hay una contraseña guardada. Escribí una nueva solo si querés reemplazarla.'
        : 'Sin host/usuario/contraseña acá, se usa la misma casilla que /agendar (si está configurada por variables de entorno).';
      $('#adm-int-espera').value = data.reglas.esperaSeg || '';
      $('#adm-int-tope').value = data.reglas.topeDiario || '';

      $('#adm-int-ia-key').value = '';
      $('#adm-int-ia-key').placeholder = data.ia.apiKeyConfigurada ? '••••••••••••  (ya configurada; dejar vacío para no cambiarla)' : 'sk-ant-...';
      $('#adm-int-ia-modelo').value = data.ia.modelo || 'claude-opus-5';
      $('#adm-int-ia-auto').checked = Boolean(data.ia.autoEnviar);
    } catch (err) {
      $('#adm-int-smtp-error').textContent = err.message;
    }
  }

  $('#adm-int-ia-guardar').addEventListener('click', async () => {
    const errorEl = $('#adm-int-ia-error'); const okEl = $('#adm-int-ia-ok');
    errorEl.textContent = ''; okEl.textContent = '';
    try {
      await api('/api/admin/integraciones', { method: 'PUT', body: {
        ia: { apiKey: $('#adm-int-ia-key').value, modelo: $('#adm-int-ia-modelo').value, autoEnviar: $('#adm-int-ia-auto').checked },
      } });
      okEl.textContent = 'Guardado.';
      await cargarIntegraciones();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  $('#adm-int-ia-probar').addEventListener('click', async () => {
    const errorEl = $('#adm-int-ia-error'); const okEl = $('#adm-int-ia-ok');
    errorEl.textContent = ''; okEl.textContent = '';
    const btn = $('#adm-int-ia-probar');
    btn.disabled = true;
    try {
      await api('/api/admin/integraciones', { method: 'POST', body: { objetivo: 'ia' } });
      okEl.textContent = 'Conexión OK.';
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#adm-int-guardar').addEventListener('click', async () => {
    const errorEl = $('#adm-int-smtp-error'); const okEl = $('#adm-int-smtp-ok');
    errorEl.textContent = ''; okEl.textContent = '';
    try {
      await api('/api/admin/integraciones', { method: 'PUT', body: {
        smtp: { host: $('#adm-int-host').value, port: $('#adm-int-port').value, user: $('#adm-int-user').value, pass: $('#adm-int-pass').value, from: $('#adm-int-from').value },
      } });
      okEl.textContent = 'Guardado.';
      await cargarIntegraciones();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  $('#adm-int-probar').addEventListener('click', async () => {
    const errorEl = $('#adm-int-smtp-error'); const okEl = $('#adm-int-smtp-ok');
    errorEl.textContent = ''; okEl.textContent = '';
    const btn = $('#adm-int-probar');
    btn.disabled = true;
    try {
      await api('/api/admin/integraciones', { method: 'POST' });
      okEl.textContent = 'Conexión OK.';
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#adm-int-reglas-guardar').addEventListener('click', async () => {
    const errorEl = $('#adm-int-reglas-error'); const okEl = $('#adm-int-reglas-ok');
    errorEl.textContent = ''; okEl.textContent = '';
    try {
      await api('/api/admin/integraciones', { method: 'PUT', body: {
        reglas: { esperaSeg: $('#adm-int-espera').value, topeDiario: $('#adm-int-tope').value },
      } });
      okEl.textContent = 'Guardado.';
      await cargarIntegraciones();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // ---------- Buscar con IA ----------
  $('#adm-ia-buscar-btn').addEventListener('click', async () => {
    const errorEl = $('#adm-ia-error');
    const resultadoEl = $('#adm-ia-resultado');
    const btn = $('#adm-ia-buscar-btn');
    errorEl.textContent = '';

    const descripcion = $('#adm-ia-descripcion').value.trim();
    if (!descripcion) { errorEl.textContent = 'Describí qué tipo de empresas buscar.'; return; }

    btn.disabled = true;
    btn.textContent = 'Buscando… (puede tardar 1-2 minutos)';
    resultadoEl.innerHTML = '';
    try {
      const data = await api('/api/admin/ia-buscar', { method: 'POST', body: {
        descripcion, cantidad: $('#adm-ia-cantidad').value,
      } });
      renderResultadoIA(data.items);
      await cargarProspectos();
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Buscar automático (con API key)';
    }
  });

  // ---------- Abrir en Claude.ai (alternativa sin API key) ----------
  const CAMPOS_PROMPT_IA =
    'empresa, categoria, web, email, telefono, linkedin, decisor_nombre, decisor_cargo, canal, notas, mensaje_asunto, mensaje_contenido';

  function armarPromptIA(descripcion, cantidad) {
    const excluir = prospectos.map((p) => p.empresa);
    return [
      'Actuá como el equipo de prospección comercial de Digital Impulso (digitalimpulso.com), una empresa',
      'argentina de tecnología, IA y automatización: tótems de autogestión, cobro con Mercado Pago/QR, chatbots',
      'y atención por WhatsApp con IA, automatización de procesos internos, apps y sistemas a medida, y tableros/BI.',
      '',
      `Buscá en la web ${cantidad} empresas reales que encajen con esto: ${descripcion}`,
      '',
      `No repitas ninguna de estas (ya son prospectos cargados): ${excluir.length ? excluir.join(', ') : '(ninguna todavía)'}`,
      '',
      'Reglas:',
      '- Nunca inventes un email, teléfono, nombre de decisor o cargo. Si no lo encontrás publicado en una fuente',
      '  real, dejá ese campo vacío (mejor vacío que inventado).',
      '- Para cada empresa, redactá un mensaje de prospección específico (4-8 líneas, español rioplatense, tono',
      '  directo): qué hace la empresa, qué oportunidad/fricción detectaste, qué le propondría Digital Impulso.',
      '  Nada de plantilla genérica ("Hola, somos Digital Impulso...").',
      '- Elegí canal: "email" si hay un email público real, "linkedin" si solo hay LinkedIn, "instagram" si tiene',
      '  más presencia ahí, "otro" si no hay ninguno claro.',
      '',
      `Respondé ÚNICAMENTE con un bloque de código \`\`\`json que contenga un array con este formato exacto por`,
      `empresa (sin texto antes ni después del bloque), con estas claves: ${CAMPOS_PROMPT_IA}.`,
    ].join('\n');
  }

  $('#adm-ia-abrir-claude').addEventListener('click', () => {
    const errorEl = $('#adm-ia-error');
    errorEl.textContent = '';
    const descripcion = $('#adm-ia-descripcion').value.trim();
    if (!descripcion) { errorEl.textContent = 'Describí qué tipo de empresas buscar.'; return; }
    const cantidad = $('#adm-ia-cantidad').value || '3';
    const prompt = armarPromptIA(descripcion, cantidad);
    window.open('https://claude.ai/new?q=' + encodeURIComponent(prompt), '_blank', 'noopener');
  });

  function extraerJSON(texto) {
    const m = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/```\s*([\s\S]*?)```/);
    return JSON.parse(m ? m[1] : texto);
  }

  $('#adm-ia-pegado-importar').addEventListener('click', async () => {
    const errorEl = $('#adm-ia-pegado-error');
    errorEl.textContent = '';
    let candidatos;
    try {
      candidatos = extraerJSON($('#adm-ia-pegado').value);
      if (!Array.isArray(candidatos)) throw new Error('no es un array');
    } catch {
      errorEl.textContent = 'No pude leer eso como JSON — revisá que hayas pegado el bloque completo (con los corchetes [ ]).';
      return;
    }
    try {
      const data = await api('/api/admin/ia-importar', { method: 'POST', body: { candidatos } });
      renderResultadoIA(data.items);
      $('#adm-ia-pegado').value = '';
      await cargarProspectos();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  function renderResultadoIA(items) {
    const cont = $('#adm-ia-resultado');
    if (!items.length) {
      cont.innerHTML = '<p class="adm-muted" style="font-size:13px">No se encontraron empresas nuevas (o ya estaban todas cargadas).</p>';
      return;
    }
    cont.innerHTML = `<p class="adm-sub" style="margin-bottom:10px">${items.length} empresa(s) agregadas a Prospectos:</p>`;
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'adm-msg-item';
      const estado = it.autoEnviado
        ? '<span class="adm-pill adm-pill-si">Enviado automáticamente</span>'
        : `<span class="adm-pill adm-pill-no">Borrador pendiente</span>${it.motivoNoEnvio ? ` <span class="adm-muted">— ${escapeHtml(it.motivoNoEnvio)}</span>` : ''}`;
      div.innerHTML = `
        <div class="adm-msg-head"><div><b>${escapeHtml(it.prospecto.empresa)}</b> <span class="adm-muted">(${escapeHtml(it.prospecto.canal)})</span></div></div>
        <p class="adm-sub" style="margin-bottom:8px">${escapeHtml(it.prospecto.notas)}</p>
        ${estado}
      `;
      cont.appendChild(div);
    }
  }

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  chequearSesion();
})();
