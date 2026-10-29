/**
 * Backend del Concurso de Calabazas (Google Apps Script + Google Sheets).
 *
 * Hojas que usa (se crean con la función `configurar`):
 *   Config:    número de calabazas, de docentes, votos por docente y si está abierta
 *   Admin:     el código de administración (solo lo ve quien tiene la hoja)
 *   Docentes:  codigo | nombre
 *   Votos:     codigo | nombre | fecha | calabazas (ids separados por coma)
 *
 * Cada docente tiene un código personal. Puede elegir hasta los votos que diga Config
 * calabazas distintas y cambiar su selección mientras la votación esté abierta.
 * Solo pueden votar los códigos de la hoja Docentes (genéralos con generarCodigos).
 *
 * Resultados: se ven en la página entrando con el código de administración,
 * o en la hoja con el menú «🎃 Concurso → Ver resultados».
 * El código de administración se guarda en las propiedades del script, no en
 * este archivo, para que no aparezca en el repositorio.
 */

// Valores iniciales de la hoja Config. Después se cambian en la hoja, no aquí.
const CONFIG_INICIAL = [
  ['Calabazas', 120],
  ['Docentes', 30],
  ['Votos por docente', 27],
  ['Votación abierta', 'SÍ'],
];

const HOJA_DOCENTES = 'Docentes';
const HOJA_VOTOS = 'Votos';
const HOJA_RESULTADOS = 'Resultados';
const HOJA_ADMIN = 'Admin';
const HOJA_CONFIG = 'Config';

function config_() {
  const valores = {};
  filas_(HOJA_CONFIG).forEach((f) => (valores[String(f[0]).trim()] = f[1]));
  const numero = (clave, porDefecto) => {
    const n = parseInt(valores[clave], 10);
    return n > 0 ? n : porDefecto;
  };
  return {
    calabazas: numero('Calabazas', 120),
    docentes: numero('Docentes', 30),
    maxVotos: numero('Votos por docente', 27),
    abierta: !/^\s*no\s*$/i.test(String(valores['Votación abierta'] || 'SÍ')),
  };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎃 Concurso')
    .addItem('Ver resultados', 'verResultados')
    .addItem('Generar códigos de docentes', 'generarCodigos')
    .addItem('Cambiar código de administración', 'crearCodigoAdmin')
    .addToUi();
}

function doGet(e) {
  return responder_(() => {
    const accion = (e && e.parameter && e.parameter.accion) || 'calabazas';
    if (accion === 'calabazas') {
      const cfg = config_();
      return { calabazas: leerCalabazas_(), maxVotos: cfg.maxVotos, abierta: cfg.abierta };
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
  if (esAdmin_(codigo)) return { admin: true };
  const docente = buscarDocente_(codigo);
  const voto = buscarVoto_(docente.codigo);
  return {
    nombre: docente.nombre,
    seleccion: voto ? voto.ids : [],
    fecha: voto ? voto.fecha : null,
  };
}

function votar_(codigo, ids) {
  const cfg = config_();
  if (!cfg.abierta) throw new Error('La votación está cerrada');
  const docente = buscarDocente_(codigo);

  if (!Array.isArray(ids)) throw new Error('Selección no válida');
  const validos = new Set(leerCalabazas_().map((c) => c.id));
  const unicos = [...new Set(ids.map(String))];
  if (unicos.some((id) => !validos.has(id))) throw new Error('Hay calabazas que no existen');
  if (unicos.length === 0) throw new Error('Elige al menos una calabaza');
  if (unicos.length > cfg.maxVotos) throw new Error('Puedes votar como máximo ' + cfg.maxVotos + ' calabazas');

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
  if (!esAdmin_(clave)) throw new Error('Código no válido');
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
  const filas = [['puesto', 'calabaza', 'votos']].concat(
    datos.ranking.map((c, i) => [i + 1, c.id, c.votos])
  );
  hoja.getRange(1, 1, filas.length, 3).setValues(filas);
  hoja.getRange(1, 1, 1, 3).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.getRange(1, 5).setValue('Han votado ' + datos.votantes + ' de ' + datos.docentes + ' docentes · ' + new Date().toLocaleString('es-ES'));
  libro.setActiveSheet(hoja);
}

/**
 * Rellena la hoja Docentes hasta tener tantos códigos como indica Config.
 * No borra los que ya existen. Escribe el nombre de cada docente al lado de su código.
 */
function generarCodigos() {
  const hoja = hoja_(HOJA_DOCENTES);
  const existentes = new Set(filas_(HOJA_DOCENTES).map((f) => normalizar_(f[0])).filter(Boolean));
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const nuevos = [];
  const total = config_().docentes;
  while (existentes.size < total) {
    let codigo = '';
    for (let i = 0; i < 6; i++) codigo += letras[Math.floor(Math.random() * letras.length)];
    if (!existentes.has(codigo)) {
      existentes.add(codigo);
      nuevos.push([codigo, '']);
    }
  }
  if (nuevos.length) hoja.getRange(hoja.getLastRow() + 1, 1, nuevos.length, 2).setValues(nuevos);
}

/** Crea un código de administración nuevo (el anterior deja de valer) y lo muestra. */
function crearCodigoAdmin() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = 'ADM-';
  for (let i = 0; i < 8; i++) codigo += letras[Math.floor(Math.random() * letras.length)];
  PropertiesService.getScriptProperties().setProperty('CLAVE_ADMIN', codigo);

  const libro = SpreadsheetApp.getActive();
  const hoja = libro.getSheetByName(HOJA_ADMIN) || libro.insertSheet(HOJA_ADMIN);
  hoja.clear();
  hoja.getRange(1, 1, 2, 2).setValues([
    ['Código de administración', codigo],
    ['Uso', 'Escríbelo en la página como si fuera un código de docente para ver los resultados. No lo compartas.'],
  ]);
  hoja.getRange(1, 1, 2, 1).setFontWeight('bold');
  return codigo;
}

function esAdmin_(codigo) {
  const clave = PropertiesService.getScriptProperties().getProperty('CLAVE_ADMIN');
  return !!clave && normalizar_(codigo) === clave;
}

// ---------- Utilidades ----------

function leerCalabazas_() {
  return Array.from({ length: config_().calabazas }, (_, i) => ({ id: String(i + 1), foto: '' }));
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
    [HOJA_CONFIG]: [['Ajuste', 'Valor']].concat(CONFIG_INICIAL),
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
  if (!PropertiesService.getScriptProperties().getProperty('CLAVE_ADMIN')) crearCodigoAdmin();
}
