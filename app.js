(function () {
  'use strict';

  const CONFIG = window.CONFIG || {};
  const API_URL = (CONFIG.API_URL || '').trim();
  const ALMACEN = (CONFIG.ALMACEN_URL || '').trim().replace(/\/+$/, '');
  const DEMO = !API_URL && !ALMACEN;

  const estado = {
    calabazas: [],
    maxVotos: 27,
    abierta: true,
    codigo: null,
    nombre: '',
    seleccion: new Set(),
    enviada: new Set(),
  };

  const $ = (id) => document.getElementById(id);

  // ---------- Almacenamiento local (solo comodidad, puede fallar) ----------

  const local = {
    get(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } },
    set(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } },
    del(clave) { try { localStorage.removeItem(clave); } catch (e) { /* sin almacenamiento */ } },
  };

  // ---------- API ----------

  async function llamar(metodo, datos) {
    if (DEMO) return demo(metodo === 'GET' ? { accion: 'calabazas' } : datos);
    if (ALMACEN) return almacen(metodo === 'GET' ? { accion: 'calabazas' } : datos);
    const opciones = metodo === 'GET'
      ? {}
      // text/plain evita la petición previa CORS que Apps Script no admite.
      : { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) };
    const url = metodo === 'GET' ? API_URL + '?accion=calabazas' : API_URL;
    let respuesta;
    try {
      respuesta = await fetch(url, opciones);
    } catch (e) {
      throw new Error('Sin conexión. Inténtalo de nuevo.');
    }
    const json = await respuesta.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  // Modo demostración: datos de ejemplo guardados en este navegador.
  function demo(datos) {
    const calabazas = Array.from({ length: 120 }, (_, i) => ({ id: String(i + 1), foto: '' }));
    const votos = JSON.parse(local.get('demo-votos') || '{}');
    switch (datos.accion) {
      case 'calabazas':
        return { calabazas, maxVotos: 27, abierta: true };
      case 'entrar':
        if (String(datos.codigo).trim().toUpperCase() === 'ADMIN') return { admin: true };
        if (String(datos.codigo).trim().toUpperCase() !== 'DEMO') throw new Error('Código no válido');
        return { nombre: 'Docente de prueba', seleccion: votos.DEMO || [] };
      case 'votar':
        if (!datos.ids.length) throw new Error('Elige al menos una calabaza');
        if (datos.ids.length > 27) throw new Error('Puedes votar como máximo 27 calabazas');
        votos.DEMO = datos.ids;
        local.set('demo-votos', JSON.stringify(votos));
        return { ok: true, total: datos.ids.length };
      case 'resultados': {
        if (String(datos.clave).trim().toUpperCase() !== 'ADMIN') throw new Error('Código no válido');
        const cuenta = {};
        Object.values(votos).flat().forEach((id) => (cuenta[id] = (cuenta[id] || 0) + 1));
        const ranking = calabazas.map((c) => Object.assign({}, c, { votos: cuenta[c.id] || 0 }))
          .sort((a, b) => b.votos - a.votos);
        return { ranking, votantes: Object.keys(votos).length, docentes: 1 };
      }
    }
    throw new Error('Acción desconocida');
  }

  // Almacén de claves público (kvdb.io). La página solo guarda huellas SHA-256:
  // - el voto de cada docente va en la clave huella('voto:' + código), que solo
  //   puede calcular quien conoce el código;
  // - CONFIG.VALIDOS tiene huella('ok:' + esa clave), que sirve para saber qué
  //   claves son de docentes válidos sin revelar cuáles son;
  // - CONFIG.ADMIN es huella('admin:' + código de administración).
  async function huella(texto) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function pedir(ruta, opciones) {
    let respuesta;
    try {
      respuesta = await fetch(ALMACEN + ruta, opciones);
    } catch (e) {
      throw new Error('Sin conexión. Inténtalo de nuevo.');
    }
    if (respuesta.status === 404) return null;
    if (!respuesta.ok) throw new Error('El servidor no responde. Inténtalo en un momento.');
    return respuesta.text();
  }

  async function almacen(datos) {
    const validos = new Set(CONFIG.VALIDOS || []);
    const maxVotos = CONFIG.MAX_VOTOS || 27;
    const calabazas = Array.from({ length: CONFIG.CALABAZAS || 120 }, (_, i) => ({ id: String(i + 1), foto: '' }));
    const codigo = String(datos.codigo || datos.clave || '').trim().toUpperCase();
    const esAdmin = async () => !!codigo && (await huella('admin:' + codigo)) === CONFIG.ADMIN;
    const claveVoto = async () => {
      if (!codigo) throw new Error('Escribe tu código');
      const clave = await huella('voto:' + codigo);
      if (!validos.has(await huella('ok:' + clave))) throw new Error('Código no válido');
      return clave;
    };

    switch (datos.accion) {
      case 'calabazas':
        return { calabazas, maxVotos, abierta: CONFIG.ABIERTA !== false };
      case 'entrar': {
        if (await esAdmin()) return { admin: true };
        const guardado = await pedir('/' + (await claveVoto()));
        return { nombre: '', seleccion: guardado ? JSON.parse(guardado).ids || [] : [] };
      }
      case 'votar': {
        if (CONFIG.ABIERTA === false) throw new Error('La votación está cerrada');
        const clave = await claveVoto();
        const existen = new Set(calabazas.map((c) => c.id));
        const ids = [...new Set(datos.ids.map(String))];
        if (!ids.length) throw new Error('Elige al menos una calabaza');
        if (ids.length > maxVotos) throw new Error('Puedes votar como máximo ' + maxVotos + ' calabazas');
        if (ids.some((id) => !existen.has(id))) throw new Error('Hay calabazas que no existen');
        await pedir('/' + clave, { method: 'PUT', body: JSON.stringify({ ids, fecha: new Date().toISOString() }) });
        return { ok: true, total: ids.length };
      }
      case 'resultados': {
        if (!(await esAdmin())) throw new Error('Código no válido');
        const lista = JSON.parse((await pedir('/?values=true&format=json')) || '[]');
        const cuenta = {};
        let votantes = 0;
        for (const [clave, valor] of lista) {
          if (!validos.has(await huella('ok:' + clave))) continue;
          let ids = [];
          try { ids = JSON.parse(valor).ids || []; } catch (e) { continue; }
          votantes++;
          [...new Set(ids.map(String))].slice(0, maxVotos).forEach((id) => (cuenta[id] = (cuenta[id] || 0) + 1));
        }
        const ranking = calabazas.map((c) => Object.assign({}, c, { votos: cuenta[c.id] || 0 }))
          .sort((a, b) => b.votos - a.votos);
        return { ranking, votantes, docentes: validos.size };
      }
    }
    throw new Error('Acción desconocida');
  }

  // ---------- Interfaz ----------

  function mostrar(pantalla) {
    ['entrar', 'votar', 'gracias', 'resultados'].forEach((p) => {
      $('pantalla-' + p).hidden = p !== pantalla;
    });
    $('barra').hidden = pantalla !== 'votar';
    window.scrollTo(0, 0);
  }

  let temporizadorToast;
  function avisar(texto, esError) {
    const t = $('toast');
    t.textContent = texto;
    t.classList.toggle('error', !!esError);
    t.classList.add('visible');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => t.classList.remove('visible'), 3000);
  }

  function ocupado(boton, texto) {
    boton.dataset.texto = boton.dataset.texto || boton.textContent;
    boton.disabled = !!texto;
    boton.textContent = texto || boton.dataset.texto;
  }

  function pintarLista() {
    const lista = $('lista');
    lista.innerHTML = '';
    estado.calabazas.forEach((c) => {
      const li = document.createElement('li');
      li.className = 'calabaza';
      li.dataset.id = c.id;

      let foto;
      if (c.foto) {
        foto = document.createElement('button');
        foto.type = 'button';
        foto.className = 'foto';
        foto.setAttribute('aria-label', 'Ver foto de la calabaza ' + c.id);
        const img = document.createElement('img');
        img.className = 'foto';
        img.loading = 'lazy';
        img.alt = 'Calabaza ' + c.id;
        img.src = c.foto;
        foto.appendChild(img);
        foto.addEventListener('click', () => abrirVisor(c));
      } else {
        foto = document.createElement('div');
        foto.className = 'foto sin-foto';
        foto.textContent = '🎃';
      }

      const numero = document.createElement('span');
      numero.className = 'numero';
      numero.textContent = c.id;
      const sello = document.createElement('span');
      sello.className = 'sello';
      sello.setAttribute('aria-hidden', 'true');
      sello.textContent = '⭐';

      const votar = document.createElement('button');
      votar.type = 'button';
      votar.className = 'votar';
      votar.setAttribute('aria-label', 'Votar la calabaza ' + c.id);
      votar.addEventListener('click', () => alternar(c.id));

      li.append(foto, numero, sello, votar);
      lista.appendChild(li);
    });
    actualizar();
  }

  function actualizar() {
    const total = estado.seleccion.size;
    const lleno = total >= estado.maxVotos;
    const filtro = $('buscar').value.trim();
    const soloElegidas = $('solo-elegidas').checked;
    let visibles = 0;

    document.querySelectorAll('.calabaza').forEach((li) => {
      const c = estado.calabazas.find((x) => x.id === li.dataset.id);
      const elegida = estado.seleccion.has(c.id);
      const boton = li.querySelector('.votar');
      li.classList.toggle('elegida', elegida);
      li.classList.toggle('bloqueada', lleno && !elegida);
      boton.disabled = lleno && !elegida;
      boton.textContent = elegida ? '⭐ Elegida' : (lleno ? 'Completo' : 'Votar');
      boton.setAttribute('aria-pressed', elegida);

      const visible = (!filtro || c.id.startsWith(filtro)) && (!soloElegidas || elegida);
      li.hidden = !visible;
      if (visible) visibles++;
    });

    $('sin-resultados').hidden = visibles > 0;
    $('contador').textContent = total;
    $('contador-caja').classList.toggle('lleno', lleno);
    $('progreso').style.width = Math.min(100, total / estado.maxVotos * 100) + '%';
    const sinCambios = total === estado.enviada.size && [...estado.seleccion].every((id) => estado.enviada.has(id));
    $('btn-enviar').disabled = total === 0 || sinCambios || !estado.abierta;
    $('btn-enviar').textContent = estado.enviada.size ? 'Actualizar votos' : 'Enviar votos';
  }

  function alternar(id) {
    if (estado.seleccion.has(id)) {
      estado.seleccion.delete(id);
    } else if (estado.seleccion.size >= estado.maxVotos) {
      avisar('¡Ya tienes ' + estado.maxVotos + '! Quita una para elegir otra.', true);
      return;
    } else {
      estado.seleccion.add(id);
      if (estado.seleccion.size === estado.maxVotos) avisar('🍬 ¡Cubo lleno! Ya tienes ' + estado.maxVotos + ' calabazas.');
    }
    local.set('borrador-' + estado.codigo, JSON.stringify([...estado.seleccion]));
    actualizar();
  }

  function abrirVisor(c) {
    $('visor-img').src = c.foto;
    $('visor-img').alt = 'Calabaza ' + c.id;
    $('visor-texto').textContent = 'Calabaza nº ' + c.id;
    $('visor').showModal();
  }

  // ---------- Flujo ----------

  async function entrar(codigo, silencioso) {
    const datos = await llamar('POST', { accion: 'entrar', codigo });
    if (datos.admin) {
      await cargarResultados(codigo);
      return;
    }
    estado.codigo = codigo.trim().toUpperCase();
    estado.nombre = datos.nombre;
    estado.enviada = new Set(datos.seleccion);
    const borrador = JSON.parse(local.get('borrador-' + estado.codigo) || 'null');
    estado.seleccion = new Set(borrador || datos.seleccion);
    local.set('codigo', estado.codigo);

    $('saludo').textContent = 'Hola, ' + (estado.nombre || 'docente') + ' 👋';
    pintarLista();
    mostrar('votar');
    if (!silencioso && datos.seleccion.length) {
      avisar('Ya votaste ' + datos.seleccion.length + ' calabazas. Puedes cambiarlas.');
    }
  }

  function salir() {
    local.del('codigo');
    estado.codigo = null;
    estado.claveAdmin = null;
    $('ranking').innerHTML = '';
    $('saludo').textContent = '';
    $('codigo').value = '';
    mostrar('entrar');
  }

  function lluviaDeCaramelos() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dulces = ['🍬', '🍭', '🎃', '🍫', '👻', '⭐'];
    for (let i = 0; i < 28; i++) {
      const d = document.createElement('span');
      d.className = 'caramelo';
      d.textContent = dulces[i % dulces.length];
      d.style.left = Math.random() * 95 + 'vw';
      d.style.animationDelay = Math.random() * 0.8 + 's';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3200);
    }
  }

  function pedirConfirmacion() {
    const total = estado.seleccion.size;
    const faltan = estado.maxVotos - total;
    $('confirmar-texto').textContent = 'Has elegido ' + total + (total === 1 ? ' calabaza' : ' calabazas') +
      (faltan > 0 ? '. Aún podrías elegir ' + faltan + ' más.' : '.');
    $('confirmar').showModal();
  }

  async function enviar() {
    $('confirmar').close();
    const boton = $('btn-enviar');
    ocupado(boton, 'Enviando…');
    try {
      const ids = [...estado.seleccion];
      await llamar('POST', { accion: 'votar', codigo: estado.codigo, ids });
      estado.enviada = new Set(ids);
      local.del('borrador-' + estado.codigo);
      $('gracias-texto').textContent = 'Has votado ' + ids.length + ' de ' + estado.maxVotos +
        ' calabazas posibles. Puedes cambiar tus votos mientras la votación esté abierta.';
      mostrar('gracias');
      lluviaDeCaramelos();
    } catch (e) {
      avisar(e.message, true);
    } finally {
      ocupado(boton, null);
      actualizar();
    }
  }

  // Solo para el código de administración: el servidor comprueba la clave en cada petición.
  async function cargarResultados(clave) {
    const datos = await llamar('POST', { accion: 'resultados', clave });
    estado.claveAdmin = clave;
    $('saludo').textContent = 'Modo organización 🏆';
    $('resumen').textContent = datos.votantes + ' de ' + datos.docentes + ' docentes han votado.' +
      (DEMO ? ' (Versión de prueba: solo cuenta los votos de este móvil.)' : '');
    const ranking = $('ranking');
    ranking.innerHTML = '';
    datos.ranking.forEach((c) => {
      const li = document.createElement('li');
      let mini;
      if (c.foto) {
        mini = document.createElement('img');
        mini.src = c.foto;
        mini.alt = '';
        mini.loading = 'lazy';
      } else {
        mini = document.createElement('span');
        mini.className = 'mini';
        mini.textContent = '🎃';
      }
      const titulo = document.createElement('span');
      titulo.className = 'titulo';
      titulo.textContent = 'Nº ' + c.id;
      const votos = document.createElement('span');
      votos.className = 'votos';
      votos.textContent = c.votos + (c.votos === 1 ? ' voto' : ' votos');
      li.append(mini, titulo, votos);
      ranking.appendChild(li);
    });
    mostrar('resultados');
  }

  async function actualizarResultados() {
    const boton = $('btn-actualizar');
    ocupado(boton, 'Actualizando…');
    try {
      await cargarResultados(estado.claveAdmin);
    } catch (e) {
      avisar(e.message, true);
    } finally {
      ocupado(boton, null);
    }
  }

  async function iniciar() {
    $('demo-aviso').hidden = !DEMO;

    // Lo primero es el acceso: si el móvil tiene una página vieja en caché y falta
    // algún botón, el resto no debe impedir entrar.
    $('form-entrar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const boton = e.target.querySelector('button');
      ocupado(boton, 'Entrando…');
      try {
        await entrar($('codigo').value);
      } catch (err) {
        avisar(err.message, true);
      } finally {
        ocupado(boton, null);
      }
    });
    const al = (id, evento, fn) => { const el = $(id); if (el) el.addEventListener(evento, fn); };
    al('btn-actualizar', 'click', actualizarResultados);
    al('btn-salir-admin', 'click', salir);
    al('btn-enviar', 'click', pedirConfirmacion);
    al('confirmar-si', 'click', enviar);
    al('confirmar-no', 'click', () => $('confirmar').close());
    al('btn-cambiar', 'click', () => { mostrar('votar'); actualizar(); });
    al('btn-salir', 'click', salir);
    al('buscar', 'input', actualizar);
    al('solo-elegidas', 'change', actualizar);

    try {
      const datos = await llamar('GET');
      estado.calabazas = datos.calabazas;
      estado.maxVotos = datos.maxVotos;
      estado.abierta = datos.abierta;
      document.querySelectorAll('.max-votos').forEach((el) => (el.textContent = datos.maxVotos));
      if (!datos.abierta) avisar('La votación está cerrada.', true);
    } catch (e) {
      avisar('No se pudieron cargar las calabazas: ' + e.message, true);
      return;
    }

    const guardado = local.get('codigo');
    if (guardado) {
      try {
        await entrar(guardado, true);
        return;
      } catch (e) {
        local.del('codigo');
      }
    }
    mostrar('entrar');
  }

  window.addEventListener('error', () => {
    avisar('Algo ha fallado. Recarga la página; si sigue igual, ábrela en una pestaña de incógnito.', true);
  });

  iniciar();
})();
