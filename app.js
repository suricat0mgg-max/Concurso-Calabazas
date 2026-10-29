(function () {
  'use strict';

  const CONFIG = window.CONFIG || {};
  const API_URL = (CONFIG.API_URL || '').trim();
  const ALMACEN = (CONFIG.ALMACEN_URL || '').trim().replace(/\/+$/, '');
  const FORMULARIO = (CONFIG.FORMULARIO_URL || '').trim();
  const DEMO = !API_URL && !ALMACEN && !FORMULARIO;

  const estado = {
    calabazas: [],
    maxVotos: 26,
    abierta: true,
    codigo: null,
    nombre: '',
    seleccion: new Set(),
    enviada: new Set(),
  };

  const $ = (id) => document.getElementById(id);

  // «  maría  López » y «Maria lopez» son la misma persona.
  function normalizarNombre(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Nombre tal como se mostrará: «maría lópez» → «María López».
  function nombreBonito(texto) {
    return String(texto || '').trim().replace(/\s+/g, ' ')
      .split(' ').map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }

  function comprobarNombre(texto) {
    const nombre = normalizarNombre(texto);
    if (nombre.replace(/ /g, '').length < 2) throw new Error('Escribe tu nombre');
    return nombre;
  }

  function esCodigoAdminDemo(texto) {
    return String(texto || '').trim().toUpperCase() === 'ADMIN';
  }

  // ---------- Almacenamiento local (solo comodidad, puede fallar) ----------

  const local = {
    get(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } },
    set(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } },
    del(clave) { try { localStorage.removeItem(clave); } catch (e) { /* sin almacenamiento */ } },
  };

  // ---------- API ----------

  async function llamar(metodo, datos) {
    if (DEMO) return demo(metodo === 'GET' ? { accion: 'calabazas' } : datos);
    if (FORMULARIO) return formulario(metodo === 'GET' ? { accion: 'calabazas' } : datos);
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
    const calabazas = Array.from({ length: 250 }, (_, i) => ({ id: String(i + 1), foto: '' }));
    const votos = JSON.parse(local.get('demo-votos') || '{}');
    switch (datos.accion) {
      case 'calabazas':
        return { calabazas, maxVotos: 26, abierta: true };
      case 'entrar': {
        if (esCodigoAdminDemo(datos.codigo)) return { admin: true };
        const guardado = votos[comprobarNombre(datos.codigo)];
        return { nombre: nombreBonito(datos.codigo), seleccion: (guardado && guardado.ids) || [] };
      }
      case 'votar':
        if (!datos.ids.length) throw new Error('Elige al menos una calabaza');
        if (datos.ids.length > 26) throw new Error('Puedes votar como máximo 26 calabazas');
        votos[comprobarNombre(datos.codigo)] = { nombre: nombreBonito(datos.codigo), ids: datos.ids };
        local.set('demo-votos', JSON.stringify(votos));
        return { ok: true, total: datos.ids.length };
      case 'borrar':
        if (!esCodigoAdminDemo(datos.clave)) throw new Error('Código no válido');
        local.del('demo-votos');
        return { ok: true };
      case 'resultados': {
        if (!esCodigoAdminDemo(datos.clave)) throw new Error('Código no válido');
        const lista = Object.values(votos).filter((v) => v && Array.isArray(v.ids));
        const cuenta = {};
        lista.forEach((v) => v.ids.forEach((id) => (cuenta[id] = (cuenta[id] || 0) + 1)));
        const ranking = calabazas.map((c) => Object.assign({}, c, { votos: cuenta[c.id] || 0 }))
          .sort((a, b) => b.votos - a.votos);
        return { ranking, votantes: lista.map((v) => v.nombre) };
      }
    }
    throw new Error('Acción desconocida');
  }

  // Almacén de claves público (kvdb.io). El voto de cada docente va en la clave
  // huella('voto:' + nombre normalizado), así que volver a votar con el mismo
  // nombre sustituye el voto anterior. CONFIG.ADMIN es huella('admin:' + código
  // de administración): el código no aparece en la página.
  async function huella(texto) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Todos los votos van en un único documento JSON {votos: {clave: voto}} guardado
  // en un servicio gratuito sin cuenta. El tipo de servicio se deduce de la dirección.
  function tipoAlmacen(base) {
    if (/extendsclass\.com/.test(base)) return 'extendsclass';
    if (/restful-api\.dev/.test(base)) return 'restful';
    return 'jsonblob';
  }

  async function http(url, opciones) {
    let r;
    try {
      r = await fetch(url, Object.assign({ cache: 'no-store' }, opciones));
    } catch (e) {
      throw new Error('Sin conexión. Inténtalo de nuevo.');
    }
    const texto = await r.text();
    if (r.status === 429) throw new Error('El servicio de votos ha llegado a su límite de hoy. Prueba con datos móviles en vez de wifi, o avisa a quien organiza.');
    if (!r.ok) throw new Error('El servidor respondió ' + r.status + (texto ? ': ' + texto.slice(0, 100) : ''));
    return { r, texto };
  }

  const JSON_CABECERAS = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  function crearAdaptador(base) {
    const tipo = tipoAlmacen(base);
    const envolver = (doc) => JSON.stringify(tipo === 'restful' ? { name: 'concurso-calabazas', data: doc } : doc);

    async function leer() {
      const { texto } = await http(base, { headers: { Accept: 'application/json' } });
      let doc = texto ? JSON.parse(texto) : {};
      if (tipo === 'restful') doc = doc.data;
      return doc && typeof doc.votos === 'object' && doc.votos ? doc : { votos: {} };
    }

    const escribir = (doc) => http(base, { method: 'PUT', headers: JSON_CABECERAS, body: envolver(doc) });

    // Si otro docente guarda justo a la vez, puede escribir el documento sin este
    // voto. Por eso se comprueba al momento y otra vez pasados unos segundos,
    // salvo en restful-api.dev, que solo permite unas 50 peticiones al día: ahí
    // se hace una sola comprobación para gastar 3 peticiones por voto.
    const comprobarDosVeces = tipo !== 'restful';
    async function guardarVoto(clave, voto) {
      const sigue = async () => {
        const v = (await leer()).votos[clave];
        return !!v && v.fecha === voto.fecha;
      };
      for (let intento = 0; intento < 6; intento++) {
        if (tipo === 'extendsclass') {
          // Fusiona solo este voto en el documento, sin reescribir los demás.
          await http(base, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/merge-patch+json' },
            body: JSON.stringify({ votos: { [clave]: voto } }),
          });
        } else {
          const doc = await leer();
          doc.votos[clave] = voto;
          await escribir(doc);
        }
        if (await sigue()) {
          if (!comprobarDosVeces) return;
          await espera(2500);
          if (await sigue()) return;
        }
        await espera(300 + Math.random() * 900);
      }
      throw new Error('No se pudo guardar el voto. Inténtalo de nuevo.');
    }

    return {
      leerVoto: async (clave) => (await leer()).votos[clave] || null,
      guardarVoto,
      listarVotos: async () => Object.values((await leer()).votos),
      borrarTodo: () => escribir({ votos: {} }),
    };
  }

  // Crea un documento nuevo en cada servicio y devuelve su dirección.
  const SERVICIOS = [
    {
      nombre: 'extendsclass.com',
      crear: async () => {
        const { texto } = await http('https://json.extendsclass.com/bin', { method: 'POST', headers: JSON_CABECERAS, body: '{"votos":{}}' });
        const id = JSON.parse(texto).id;
        if (!id) throw new Error('no devolvió la dirección');
        return 'https://json.extendsclass.com/bin/' + id;
      },
    },
    {
      nombre: 'restful-api.dev',
      crear: async () => {
        const { texto } = await http('https://api.restful-api.dev/objects', {
          method: 'POST', headers: JSON_CABECERAS, body: JSON.stringify({ name: 'concurso-calabazas', data: { votos: {} } }),
        });
        const id = JSON.parse(texto).id;
        if (!id) throw new Error('no devolvió la dirección');
        return 'https://api.restful-api.dev/objects/' + id;
      },
    },
    {
      nombre: 'jsonblob.com',
      crear: async () => {
        const { r } = await http('https://jsonblob.com/api/jsonBlob', { method: 'POST', headers: JSON_CABECERAS, body: '{"votos":{}}' });
        const id = r.headers.get('X-jsonblob-id') || (r.headers.get('Location') || '').split('/').pop();
        if (!/^[\w-]+$/.test(id || '')) throw new Error('no se pudo leer la dirección');
        return 'https://jsonblob.com/api/jsonBlob/' + id;
      },
    },
  ];

  const tienda = ALMACEN ? crearAdaptador(ALMACEN) : null;

  // ---------- Formulario de Google ----------
  // Cada voto se envía como una respuesta del formulario (Nombre, Votos). El
  // recuento se lee de la hoja de respuestas publicada como CSV: cuenta el último
  // voto de cada nombre. «Borrar todos los votos» envía una respuesta con el
  // nombre MARCA_BORRADO, y solo cuentan las respuestas posteriores a la última.
  const MARCA_BORRADO = '__borrar_votos__';

  function leerCSV(texto) {
    const filas = [];
    let fila = [], campo = '', comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ',') { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }

  // Lee la hoja con JSONP (una etiqueta <script>), que Google permite aunque la
  // lectura normal esté bloqueada por el navegador. Devuelve las filas sin cabecera.
  function leerHojaJSONP(id) {
    return new Promise((resolver, rechazar) => {
      const nombre = 'hojaCalabazas' + Date.now();
      const script = document.createElement('script');
      const limpiar = () => { delete window[nombre]; script.remove(); clearTimeout(reloj); };
      const reloj = setTimeout(() => { limpiar(); rechazar(new Error('La hoja de resultados no responde.')); }, 15000);
      window[nombre] = (respuesta) => {
        limpiar();
        if (!respuesta || respuesta.status === 'error' || !respuesta.table) {
          rechazar(new Error('No se puede leer la hoja de resultados. ¿Está compartida con «cualquier persona con el enlace»?'));
          return;
        }
        resolver(respuesta.table.rows.map((r) => (r.c || []).map((celda) => (celda ? String(celda.f != null ? celda.f : celda.v) : ''))));
      };
      script.onerror = () => { limpiar(); rechazar(new Error('No se puede leer la hoja de resultados.')); };
      script.src = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?headers=1&tqx=out:json;responseHandler:' + nombre + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  }

  async function filasDeLaHoja() {
    const url = (CONFIG.RESULTADOS_CSV || '').trim();
    if (!url) return null;
    // Un enlace normal de la hoja (compartida con «cualquier persona con el enlace»)
    // se lee como CSV a través de su exportación de consultas y, si el navegador no
    // lo permite, con JSONP. Un enlace «Publicar en la Web» (/d/e/…) se lee tal cual.
    const hoja = !/\/d\/e\//.test(url) && url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]{20,})/);
    const csv = hoja ? 'https://docs.google.com/spreadsheets/d/' + hoja[1] + '/gviz/tq?tqx=out:csv' : url;
    try {
      const { texto } = await http(csv + (csv.includes('?') ? '&' : '?') + 't=' + Date.now());
      return leerCSV(texto).slice(1);
    } catch (e) {
      if (!hoja) throw e;
      return leerHojaJSONP(hoja[1]);
    }
  }

  // Devuelve {nombreNormalizado: {nombre, ids}} con el último voto de cada docente.
  async function leerRespuestas() {
    const filas = await filasDeLaHoja();
    if (!filas) return null;
    const votos = {};
    for (const f of filas) {
      const nombre = String(f[1] || '').trim();
      if (!nombre) continue;
      if (nombre === MARCA_BORRADO) { for (const k in votos) delete votos[k]; continue; }
      const ids = String(f[2] || '').split(/[^0-9]+/).filter(Boolean);
      votos[normalizarNombre(nombre)] = { nombre: nombreBonito(nombre), ids };
    }
    return votos;
  }

  async function enviarRespuesta(nombre, votos) {
    const cuerpo = new URLSearchParams();
    cuerpo.set(CONFIG.CAMPO_NOMBRE, nombre);
    cuerpo.set(CONFIG.CAMPO_VOTOS, votos);
    try {
      // Google no deja leer la respuesta desde otra web (no-cors): si la petición
      // sale sin error de red, el voto ha llegado.
      await fetch(FORMULARIO, { method: 'POST', mode: 'no-cors', body: cuerpo });
    } catch (e) {
      throw new Error('Sin conexión. Inténtalo de nuevo.');
    }
  }

  async function formulario(datos) {
    const maxVotos = CONFIG.MAX_VOTOS || 26;
    const calabazas = Array.from({ length: CONFIG.CALABAZAS || 250 }, (_, i) => ({ id: String(i + 1), foto: '' }));
    const texto = String(datos.codigo || datos.clave || '').trim();
    const esAdmin = async () => !!texto && (await huella('admin:' + texto.toUpperCase())) === CONFIG.ADMIN;

    switch (datos.accion) {
      case 'calabazas':
        return { calabazas, maxVotos, abierta: CONFIG.ABIERTA !== false };
      case 'entrar': {
        if (await esAdmin()) return { admin: true };
        const clave = comprobarNombre(texto);
        let anteriores = [];
        try {
          const votos = await leerRespuestas();
          if (votos && votos[clave]) anteriores = votos[clave].ids;
        } catch (e) { /* sin recuento disponible: se empieza en blanco */ }
        return { nombre: nombreBonito(texto), seleccion: anteriores };
      }
      case 'votar': {
        if (CONFIG.ABIERTA === false) throw new Error('La votación está cerrada');
        comprobarNombre(texto);
        const existen = new Set(calabazas.map((c) => c.id));
        const ids = [...new Set(datos.ids.map(String))];
        if (!ids.length) throw new Error('Elige al menos una calabaza');
        if (ids.length > maxVotos) throw new Error('Puedes votar como máximo ' + maxVotos + ' calabazas');
        if (ids.some((id) => !existen.has(id))) throw new Error('Hay calabazas que no existen');
        // «#3 #15 #120»: siempre es texto, también con una sola calabaza, para que
        // la hoja no lo convierta en número y lo pierda al leerla.
        await enviarRespuesta(nombreBonito(texto), ids.map((id) => '#' + id).join(' '));
        return { ok: true, total: ids.length };
      }
      case 'borrar':
        if (!(await esAdmin())) throw new Error('Código no válido');
        await enviarRespuesta(MARCA_BORRADO, '-');
        return { ok: true };
      case 'resultados': {
        if (!(await esAdmin())) throw new Error('Código no válido');
        const votos = await leerRespuestas();
        if (!votos) throw new Error('Los resultados aún no están conectados. Míralos en el formulario, en «Respuestas».');
        const cuenta = {};
        const lista = Object.values(votos);
        lista.forEach((v) => [...new Set(v.ids)].slice(0, maxVotos).forEach((id) => (cuenta[id] = (cuenta[id] || 0) + 1)));
        const ranking = calabazas.map((c) => Object.assign({}, c, { votos: cuenta[c.id] || 0 }))
          .sort((a, b) => b.votos - a.votos);
        return { ranking, votantes: lista.map((v) => v.nombre) };
      }
    }
    throw new Error('Acción desconocida');
  }

  async function almacen(datos) {
    const maxVotos = CONFIG.MAX_VOTOS || 26;
    const calabazas = Array.from({ length: CONFIG.CALABAZAS || 250 }, (_, i) => ({ id: String(i + 1), foto: '' }));
    const texto = String(datos.codigo || datos.clave || '').trim();
    const esAdmin = async () => !!texto && (await huella('admin:' + texto.toUpperCase())) === CONFIG.ADMIN;
    const claveVoto = () => huella('voto:' + comprobarNombre(texto));

    switch (datos.accion) {
      case 'calabazas':
        return { calabazas, maxVotos, abierta: CONFIG.ABIERTA !== false };
      case 'entrar': {
        if (await esAdmin()) return { admin: true };
        const guardado = await tienda.leerVoto(await claveVoto());
        return { nombre: nombreBonito(texto), seleccion: (guardado && guardado.ids) || [] };
      }
      case 'votar': {
        if (CONFIG.ABIERTA === false) throw new Error('La votación está cerrada');
        const clave = await claveVoto();
        const existen = new Set(calabazas.map((c) => c.id));
        const ids = [...new Set(datos.ids.map(String))];
        if (!ids.length) throw new Error('Elige al menos una calabaza');
        if (ids.length > maxVotos) throw new Error('Puedes votar como máximo ' + maxVotos + ' calabazas');
        if (ids.some((id) => !existen.has(id))) throw new Error('Hay calabazas que no existen');
        const voto = { nombre: nombreBonito(texto), ids, fecha: new Date().toISOString() };
        await tienda.guardarVoto(clave, voto);
        return { ok: true, total: ids.length };
      }
      case 'borrar':
        if (!(await esAdmin())) throw new Error('Código no válido');
        await tienda.borrarTodo();
        return { ok: true };
      case 'resultados': {
        if (!(await esAdmin())) throw new Error('Código no válido');
        const cuenta = {};
        const votantes = [];
        for (const voto of await tienda.listarVotos()) {
          if (!voto || !Array.isArray(voto.ids)) continue;
          votantes.push(String(voto.nombre || '?'));
          [...new Set(voto.ids.map(String))].slice(0, maxVotos).forEach((id) => (cuenta[id] = (cuenta[id] || 0) + 1));
        }
        const ranking = calabazas.map((c) => Object.assign({}, c, { votos: cuenta[c.id] || 0 }))
          .sort((a, b) => b.votos - a.votos);
        return { ranking, votantes };
      }
    }
    throw new Error('Acción desconocida');
  }

  // ---------- Interfaz ----------

  function mostrar(pantalla) {
    ['entrar', 'votar', 'gracias', 'resultados', 'preparar'].forEach((p) => {
      $('pantalla-' + p).hidden = p !== pantalla;
    });
    $('barra').hidden = pantalla !== 'votar';
    $('btn-salir-sesion').hidden = pantalla !== 'votar' && pantalla !== 'resultados';
    $('btn-salir-sesion').textContent = pantalla === 'resultados' ? 'Salir del modo organización' : 'Salir (no soy yo)';
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
        foto.setAttribute('aria-hidden', 'true');
        // Tocar la calabaza también la vota, que el botón es pequeño.
        foto.addEventListener('click', () => alternar(c.id));
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
    local.set('borrador-' + normalizarNombre(estado.codigo), JSON.stringify([...estado.seleccion]));
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
    estado.codigo = codigo.trim();
    estado.nombre = datos.nombre;
    // Si el servidor no puede devolver el voto anterior (el Formulario de Google no
    // deja leer sus respuestas), se usa el último voto enviado desde este móvil.
    const clave = normalizarNombre(estado.codigo);
    let enviado = [];
    try { enviado = JSON.parse(local.get('enviado-' + clave) || '[]'); } catch (e) { enviado = []; }
    const anteriores = datos.seleccion.length ? datos.seleccion : enviado;
    estado.enviada = new Set(anteriores);
    let borrador = null;
    try { borrador = JSON.parse(local.get('borrador-' + clave) || 'null'); } catch (e) { borrador = null; }
    estado.seleccion = new Set(borrador || anteriores);
    local.set('codigo', estado.codigo);

    $('saludo').textContent = 'Hola, ' + (estado.nombre.split(' ')[0] || 'docente') + ' 👋';
    pintarLista();
    mostrar('votar');
    if (!silencioso && anteriores.length) {
      avisar('Ya votaste ' + anteriores.length + ' calabazas. Puedes cambiarlas.');
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
      local.set('enviado-' + normalizarNombre(estado.codigo), JSON.stringify(ids));
      local.del('borrador-' + normalizarNombre(estado.codigo));
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
    const votantes = datos.votantes.slice().sort((a, b) => a.localeCompare(b, 'es'));
    estado.votantes = votantes.length;
    $('resumen').textContent = (votantes.length === 1 ? 'Ha votado 1 docente.' : 'Han votado ' + votantes.length + ' docentes.') +
      (DEMO ? ' (Versión de prueba: solo cuenta los votos de este móvil.)' : '');
    $('votantes').textContent = votantes.length ? 'Quién ha votado: ' + votantes.join(', ') + '.' : '';
    const ranking = $('ranking');
    ranking.innerHTML = '';
    // Los empates comparten puesto: 4, 4, 4, 3 votos → 1º, 1º, 1º, 4º.
    let puesto = 0;
    datos.ranking.forEach((c, i) => {
      if (i === 0 || c.votos !== datos.ranking[i - 1].votos) puesto = i + 1;
      const li = document.createElement('li');
      li.dataset.puesto = puesto + 'º';
      if (c.votos > 0 && puesto <= 3) li.className = ['oro', 'plata', 'bronce'][puesto - 1];
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

  // Prueba los servicios uno a uno desde el móvil de quien organiza: crea el
  // documento, guarda y lee un voto de prueba y lo deja vacío. Se queda con el
  // primero que funcione y muestra su dirección para ponerla en config.js.
  async function prepararAlmacen() {
    const boton = $('btn-preparar');
    const paso = (texto) => ($('preparar-estado').textContent = texto);
    ocupado(boton, 'Preparando…');
    $('preparar-ok').hidden = true;
    const fallos = [];
    try {
      for (const servicio of SERVICIOS) {
        let etapa = 'crear el almacén';
        try {
          paso('Probando ' + servicio.nombre + '…');
          const base = await servicio.crear();
          const prueba = crearAdaptador(base);
          etapa = 'guardar un voto de prueba';
          await prueba.guardarVoto('prueba', { nombre: 'Prueba', ids: ['1'], fecha: new Date().toISOString() });
          etapa = 'leer los votos';
          const votos = await prueba.listarVotos();
          if (!votos.some((v) => v && v.nombre === 'Prueba')) throw new Error('no aparece el voto de prueba');
          etapa = 'dejarlo vacío';
          await prueba.borrarTodo();
          paso('✅ Todo funciona con ' + servicio.nombre + '.');
          $('preparar-texto').value = 'ALMACEN ' + base;
          $('preparar-ok').hidden = false;
          return;
        } catch (e) {
          fallos.push(servicio.nombre + ': falló al ' + etapa + ' (' + (e.message || 'sin conexión') + ')');
        }
      }
      paso('❌ Ningún servicio ha funcionado. ' + fallos.join(' · ') + '. Haz una captura y envíasela a Claude.');
    } finally {
      ocupado(boton, null);
    }
  }

  // Borra todos los votos (solo desde la pantalla de resultados del administrador).
  // Envía 20 votos de prueba como si fueran profesores, para ver el ranking lleno.
  // Unas cuantas calabazas salen más a menudo, para que haya un podio claro.
  async function simularVotos() {
    $('simular').close();
    const boton = $('btn-simular');
    const total = estado.calabazas.length || 250;
    const favoritas = [7, 42, 99, 150, total];
    const aleatoria = () => (Math.random() < 0.35
      ? favoritas[Math.floor(Math.random() * favoritas.length)]
      : 1 + Math.floor(Math.random() * total));
    let enviados = 0;
    ocupado(boton, 'Enviando 0 de 20…');
    try {
      for (let i = 1; i <= 20; i++) {
        const ids = new Set();
        const cuantas = 1 + Math.floor(Math.random() * estado.maxVotos);
        while (ids.size < cuantas) ids.add(String(aleatoria()));
        await llamar('POST', { accion: 'votar', codigo: 'Simulación ' + i, ids: [...ids] });
        enviados++;
        boton.textContent = 'Enviando ' + enviados + ' de 20…';
      }
      avisar('20 votos de prueba enviados. Cargando el ranking…');
      await espera(2500);
      await cargarResultados(estado.claveAdmin);
    } catch (e) {
      avisar('Se enviaron ' + enviados + ' de 20: ' + e.message, true);
    } finally {
      ocupado(boton, null);
    }
  }

  async function borrarVotos() {
    $('borrar').close();
    const boton = $('btn-borrar');
    ocupado(boton, 'Borrando…');
    try {
      await llamar('POST', { accion: 'borrar', clave: estado.claveAdmin });
      avisar('Votos borrados. La votación empieza de cero.');
      await cargarResultados(estado.claveAdmin);
    } catch (e) {
      avisar(e.message, true);
    } finally {
      ocupado(boton, null);
    }
  }

  async function copiarTexto() {
    const campo = $('preparar-texto');
    try {
      await navigator.clipboard.writeText(campo.value);
      avisar('Copiado. Pégaselo a Claude.');
    } catch (e) {
      campo.select();
      avisar('Mantén el dedo sobre el texto y pulsa Copiar.');
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
    al('btn-borrar', 'click', () => {
      const n = estado.votantes || 0;
      $('borrar-texto').textContent = (n === 1 ? 'Se borrará el voto de 1 docente' : 'Se borrarán los votos de ' + n + ' docentes') +
        ' y la votación empezará de cero.';
      $('borrar').showModal();
    });
    al('borrar-si', 'click', borrarVotos);
    al('borrar-no', 'click', () => $('borrar').close());
    al('btn-simular', 'click', () => $('simular').showModal());
    al('simular-si', 'click', simularVotos);
    al('simular-no', 'click', () => $('simular').close());
    al('btn-enviar', 'click', pedirConfirmacion);
    al('confirmar-si', 'click', enviar);
    al('confirmar-no', 'click', () => $('confirmar').close());
    al('btn-cambiar', 'click', () => { mostrar('votar'); actualizar(); });
    al('btn-salir', 'click', salir);
    al('btn-salir-sesion', 'click', salir);
    al('buscar', 'input', actualizar);
    al('solo-elegidas', 'change', actualizar);

    window.addEventListener('hashchange', () => location.reload());
    if (location.hash === '#preparar') {
      al('btn-preparar', 'click', prepararAlmacen);
      al('btn-copiar', 'click', copiarTexto);
      mostrar('preparar');
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

  window.addEventListener('error', () => {
    avisar('Algo ha fallado. Recarga la página; si sigue igual, ábrela en una pestaña de incógnito.', true);
  });

  iniciar();
})();
