/**
 * Backend del Concurso de Calabazas (Google Apps Script + Google Sheets).
 *
 * Hojas que usa (se crean con la función `configurar`):
 *   Calabazas: id | nombre | autor | foto
 *   Docentes:  codigo | nombre
 *   Votos:     codigo | nombre | fecha | calabazas (ids separados por coma)
 *
 * Cada docente tiene un código personal. Puede elegir hasta MAX_VOTOS
 * calabazas distintas y cambiar su selección mientras la votación esté abierta.
 * Solo pueden votar los códigos de la hoja Docentes (genéralos con generarCodigos).
 *
 * Resultados: menú «🎃 Concurso → Ver resultados» en la hoja de cálculo
 * (solo quien tenga acceso a la hoja), o en la página con CLAVE_ADMIN.
 */

const MAX_VOTOS = 27;
const VOTACION_ABIERTA = true;
// Cambia esta clave y no la compartas: permite ver los resultados en la página.
// Si la dejas vacía, los resultados solo se ven desde la hoja de cálculo.
const CLAVE_ADMIN = '';
// Número de docentes que pueden votar (lo usa generarCodigos).
const CANTIDAD_DOCENTES = 30;

const HOJA_CALABAZAS = 'Calabazas';
const HOJA_DOCENTES = 'Docentes';
const HOJA_VOTOS = 'Votos';
const HOJA_RESULTADOS = 'Resultados';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎃 Concurso')
    .addItem('Ver resultados', 'verResultados')
    .addItem('Generar códigos de docentes', 'generarCodigos')
    .addToUi();
}

function doGet(e) {
  return responder_(() => {
    const accion = (e && e.parameter && e.parameter.accion) || 'calabazas';
    if (accion === 'calabazas') {
      return { calabazas: leerCalabazas_(), maxVotos: MAX_VOTOS, abierta: VOTACION_ABIERTA };
    }
    throw new Error('Acción desconocida');
  });
}

function doPost(e) {
  return responder_(() => {
    const datos = JSON.parse(e.postData.contents || '{}');
    switch (datos.accion) {
      case 'entrar':
        return entrar_(datos.codigo);
      case 'votar':
        return votar_(datos.codigo, datos.ids);
      case 'resultados':
        return resultados_(datos.clave);
      default:
        throw new Error('Acción desconocida');
    }
  });
}

function entrar_(codigo) {
  const docente = buscarDocente_(codigo);
  const voto = buscarVoto_(docente.codigo);
  return {
    nombre: docente.nombre,
    seleccion: voto ? voto.ids : [],
    fecha: voto ? voto.fecha : null,
  };
}

function votar_(codigo, ids) {
  if (!VOTACION_ABIERTA) throw new Error('La votación está cerrada');
  const docente = buscarDocente_(codigo);

  if (!Array.isArray(ids)) throw new Error('Selección no válida');
  const validos = new Set(leerCalabazas_().map((c) => c.id));
  const unicos = [...new Set(ids.map(String))];
  if (unicos.some((id) => !validos.has(id))) throw new Error('Hay calabazas que no existen');
  if (unicos.length === 0) throw new Error('Elige al menos una calabaza');
  if (unicos.length > MAX_VOTOS) throw new Error('Puedes votar como máximo ' + MAX_VOTOS + ' calabazas');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = hoja_(HOJA_VOTOS);
    const fila = [docente.codigo, docente.nombre, new Date(), unicos.join(',')];
    const existente = buscarVoto_(docente.codigo);
    if (existente) {
      hoja.getRange(existente.fila, 1, 1, fila.length).setValues([fila]);
    } else {
      hoja.appendRow(fila);
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, total: unicos.length };
}

function resultados_(clave) {
  if (!CLAVE_ADMIN || clave !== CLAVE_ADMIN) throw new Error('Clave incorrecta');
  return contar_();
}

function contar_() {
  const calabazas = leerCalabazas_();
  const cuenta = {};
  calabazas.forEach((c) => (cuenta[c.id] = 0));

  const filas = filas_(HOJA_VOTOS);
  filas.forEach((f) => {
    String(f[3]).split(',').filter(Boolean).forEach((id) => {
      if (id in cuenta) cuenta[id]++;
    });
  });

  const ranking = calabazas
    .map((c) => Object.assign({}, c, { votos: cuenta[c.id] }))
    .sort((a, b) => b.votos - a.votos);
  return { ranking, votantes: filas.length, docentes: filas_(HOJA_DOCENTES).length };
}

/** Escribe el ranking en la hoja Resultados (solo visible para quien tiene la hoja). */
function verResultados() {
  const datos = contar_();
  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(HOJA_RESULTADOS) || libro.insertSheet(HOJA_RESULTADOS);
  hoja.clear();
  const filas = [['puesto', 'id', 'nombre', 'autor', 'votos']].concat(
    datos.ranking.map((c, i) => [i + 1, c.id, c.nombre, c.autor, c.votos])
  );
  hoja.getRange(1, 1, filas.length, 5).setValues(filas);
  hoja.getRange(1, 1, 1, 5).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.getRange(1, 7).setValue('Han votado ' + datos.votantes + ' de ' + datos.docentes + ' docentes · ' + new Date().toLocaleString('es-ES'));
  libro.setActiveSheet(hoja);
}

/**
 * Rellena la hoja Docentes hasta tener CANTIDAD_DOCENTES códigos únicos.
 * No borra los que ya existen. Escribe el nombre de cada docente al lado de su código.
 */
function generarCodigos() {
  const hoja = hoja_(HOJA_DOCENTES);
  const existentes = new Set(filas_(HOJA_DOCENTES).map((f) => normalizar_(f[0])).filter(Boolean));
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const nuevos = [];
  while (existentes.size < CANTIDAD_DOCENTES) {
    let codigo = '';
    for (let i = 0; i < 6; i++) codigo += letras[Math.floor(Math.random() * letras.length)];
    if (!existentes.has(codigo)) {
      existentes.add(codigo);
      nuevos.push([codigo, '']);
    }
  }
  if (nuevos.length) hoja.getRange(hoja.getLastRow() + 1, 1, nuevos.length, 2).setValues(nuevos);
}

// ---------- Utilidades ----------

function leerCalabazas_() {
  return filas_(HOJA_CALABAZAS)
    .filter((f) => String(f[0]).trim() !== '')
    .map((f) => ({
      id: String(f[0]).trim(),
      nombre: String(f[1] || '').trim(),
      autor: String(f[2] || '').trim(),
      foto: urlFoto_(String(f[3] || '').trim()),
    }));
}

function buscarDocente_(codigo) {
  const buscado = normalizar_(codigo);
  if (!buscado) throw new Error('Escribe tu código');
  const fila = filas_(HOJA_DOCENTES).find((f) => normalizar_(f[0]) === buscado);
  if (!fila) throw new Error('Código no válido');
  return { codigo: normalizar_(fila[0]), nombre: String(fila[1] || '').trim() };
}

function buscarVoto_(codigo) {
  const filas = filas_(HOJA_VOTOS);
  for (let i = 0; i < filas.length; i++) {
    if (normalizar_(filas[i][0]) === codigo) {
      return {
        fila: i + 2,
        fecha: filas[i][2],
        ids: String(filas[i][3]).split(',').filter(Boolean),
      };
    }
  }
  return null;
}

// Convierte enlaces de Google Drive en URLs que se pueden mostrar como imagen.
function urlFoto_(url) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  return m ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800' : url;
}

function normalizar_(texto) {
  return String(texto || '').trim().toUpperCase();
}

function hoja_(nombre) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!hoja) throw new Error('Falta la hoja "' + nombre + '". Ejecuta la función configurar.');
  return hoja;
}

function filas_(nombre) {
  const hoja = hoja_(nombre);
  if (hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn()).getValues();
}

function responder_(fn) {
  let salida;
  try {
    salida = fn();
  } catch (err) {
    salida = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ejecuta esta función una vez desde el editor de Apps Script para crear
 * las hojas con sus encabezados y algunos datos de ejemplo.
 */
function configurar() {
  const libro = SpreadsheetApp.getActive();
  const plantillas = {
    [HOJA_CALABAZAS]: [
      ['id', 'nombre', 'autor', 'foto'],
      ['1', 'Calabaza vampira', '3º A', ''],
      ['2', 'La bruja sonriente', '4º B', ''],
    ],
    [HOJA_DOCENTES]: [['codigo', 'nombre']],
    [HOJA_VOTOS]: [['codigo', 'nombre', 'fecha', 'calabazas']],
  };
  Object.keys(plantillas).forEach((nombre) => {
    if (libro.getSheetByName(nombre)) return;
    const hoja = libro.insertSheet(nombre);
    const datos = plantillas[nombre];
    hoja.getRange(1, 1, datos.length, datos[0].length).setValues(datos);
    hoja.getRange(1, 1, 1, datos[0].length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  });
  generarCodigos();
}
