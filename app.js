(function () {
  'use strict';

  const API_URL = (window.CONFIG && window.CONFIG.API_URL || '').trim();
  const DEMO = !API_URL;

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
    const calabazas = Array.from({ length: 40 }, (_, i) => ({
      id: String(i + 1),
      nombre: ['Calabaza vampira', 'La bruja sonriente', 'Jack el farolero', 'Gato negro', 'Fantasma feliz'][i % 5],
      autor: (i % 6 + 1) + 'º ' + 'ABC'[i % 3],
      foto: '',
    }));
    const votos = JSON.parse(local.get('demo-votos') || '{}');
    switch (datos.accion) {
      case 'calabazas':
        return { calabazas, maxVotos: 27, abierta: true };
      case 'entrar':
        if (String(datos.codigo).trim().toUpperCase() !== 'DEMO') throw new Error('Código no válido');
        return { nombre: 'Docente de prueba', seleccion: votos.DEMO || [] };
      case 'votar':
        if (!datos.ids.length) throw new Error('Elige al menos una calabaza');
        if (datos.ids.length > 27) throw new Error('Puedes votar como máximo 27 calabazas');
        votos.DEMO = datos.ids;
        local.set('demo-votos', JSON.stringify(votos));
        return { ok: true, total: datos.ids.length };
      case 'resultados': {
        if (datos.clave !== 'demo') throw new Error('Clave incorrecta (en demo es: demo)');
        const cuenta = {};
        Object.values(votos).flat().forEach((id) => (cuenta[id] = (cuenta[id] || 0) + 1));
        const ranking = calabazas.map((c) => Object.assign({}, c, { votos: cuenta[c.id] || 0 }))
          .sort((a, b) => b.votos - a.votos);
        return { ranking, votantes: Object.keys(votos).length, docentes: 1 };
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
        foto.setAttribute('aria-label', 'Ver foto de ' + (c.nombre || 'calabaza ' + c.id));
        const img = document.createElement('img');
        img.className = 'foto';
        img.loading = 'lazy';
        img.alt = c.nombre;
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
      numero.textContent = '#' + c.id;

      const info = document.createElement('div');
      info.className = 'info';
      const nombre = document.createElement('p');
      nombre.className = 'nombre';
      nombre.textContent = c.nombre || 'Calabaza ' + c.id;
      const autor = document.createElement('p');
      autor.className = 'autor';
      autor.textContent = c.autor;
      info.append(nombre, autor);

      const votar = document.createElement('button');
      votar.type = 'button';
      votar.className = 'votar';
      votar.addEventListener('click', () => alternar(c.id));

      li.append(foto, numero, info, votar);
      lista.appendChild(li);
    });
    actualizar();
  }

  function actualizar() {
    const total = estado.seleccion.size;
    const lleno = total >= estado.maxVotos;
    const filtro = $('buscar').value.trim().toLowerCase();
    const soloElegidas = $('solo-elegidas').checked;
    let visibles = 0;

    document.querySelectorAll('.calabaza').forEach((li) => {
      const c = estado.calabazas.find((x) => x.id === li.dataset.id);
      const elegida = estado.seleccion.has(c.id);
      const boton = li.querySelector('.votar');
      li.classList.toggle('elegida', elegida);
      li.classList.toggle('bloqueada', lleno && !elegida);
      boton.disabled = lleno && !elegida;
      boton.textContent = elegida ? '✓ Elegida' : (lleno ? 'Límite alcanzado' : 'Votar');
      boton.setAttribute('aria-pressed', elegida);

      const texto = (c.id + ' ' + c.nombre + ' ' + c.autor).toLowerCase();
      const visible = (!filtro || texto.includes(filtro)) && (!soloElegidas || elegida);
      li.hidden = !visible;
      if (visible) visibles++;
    });

    $('sin-resultados').hidden = visibles > 0;
    $('contador').textContent = total;
    $('contador').parentElement.classList.toggle('lleno', lleno);
    const sinCambios = total === estado.enviada.size && [...estado.seleccion].every((id) => estado.enviada.has(id));
    $('btn-enviar').disabled = total === 0 || sinCambios || !estado.abierta;
    $('btn-enviar').textContent = estado.enviada.size ? 'Actualizar votos' : 'Enviar votos';
  }

  function alternar(id) {
    if (estado.seleccion.has(id)) {
      estado.seleccion.delete(id);
    } else if (estado.seleccion.size >= estado.maxVotos) {
      avisar('Ya elegiste ' + estado.maxVotos + ' calabazas. Quita alguna para elegir otra.', true);
      return;
    } else {
      estado.seleccion.add(id);
      if (estado.seleccion.size === estado.maxVotos) avisar('¡Has llegado al máximo de ' + estado.maxVotos + '!');
    }
    local.set('borrador-' + estado.codigo, JSON.stringify([...estado.seleccion]));
    actualizar();
  }

  function abrirVisor(c) {
    $('visor-img').src = c.foto;
    $('visor-img').alt = c.nombre;
    $('visor-texto').textContent = '#' + c.id + ' · ' + (c.nombre || '') + (c.autor ? ' — ' + c.autor : '');
    $('visor').showModal();
  }

  // ---------- Flujo ----------

  async function entrar(codigo, silencioso) {
    const datos = await llamar('POST', { accion: 'entrar', codigo });
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
    $('saludo').textContent = '';
    $('codigo').value = '';
    mostrar('entrar');
  }

  async function enviar() {
    if (!confirm('¿Enviar ' + estado.seleccion.size + ' votos?')) return;
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
    } catch (e) {
      avisar(e.message, true);
    } finally {
      ocupado(boton, null);
      actualizar();
    }
  }

  async function verResultados(evento) {
    evento.preventDefault();
    const boton = evento.submitter || evento.target.querySelector('button');
    ocupado(boton, 'Cargando…');
    try {
      const datos = await llamar('POST', { accion: 'resultados', clave: $('clave').value });
      $('resumen').textContent = datos.votantes + ' de ' + datos.docentes + ' docentes han votado.';
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
        titulo.textContent = '#' + c.id + ' ' + (c.nombre || '');
        const autor = document.createElement('small');
        autor.textContent = c.autor;
        titulo.appendChild(autor);
        const votos = document.createElement('span');
        votos.className = 'votos';
        votos.textContent = c.votos;
        li.append(mini, titulo, votos);
        ranking.appendChild(li);
      });
      $('form-resultados').hidden = true;
      $('resultados').hidden = false;
    } catch (e) {
      avisar(e.message, true);
    } finally {
      ocupado(boton, null);
    }
  }

  async function iniciar() {
    $('demo-aviso').hidden = !DEMO;

    $('form-resultados').addEventListener('submit', verResultados);
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
    $('btn-enviar').addEventListener('click', enviar);
    $('btn-cambiar').addEventListener('click', () => { mostrar('votar'); actualizar(); });
    $('btn-salir').addEventListener('click', salir);
    $('buscar').addEventListener('input', actualizar);
    $('solo-elegidas').addEventListener('change', actualizar);

    window.addEventListener('hashchange', () => location.reload());
    if (location.hash === '#resultados') {
      mostrar('resultados');
      return;
    }

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

  iniciar();
})();
