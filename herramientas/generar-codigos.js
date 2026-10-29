// Genera el código de administración y su huella para config.js.
// Uso: node herramientas/generar-codigos.js
// El código sale por pantalla: guárdalo y NO lo subas al repositorio.
const crypto = require('crypto');

const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const admin = 'ADM-' + Array.from(crypto.randomBytes(8), (b) => letras[b % letras.length]).join('');

console.log('CÓDIGO DE ADMINISTRACIÓN: ' + admin);
console.log('Para config.js: ADMIN: ' + JSON.stringify(crypto.createHash('sha256').update('admin:' + admin).digest('hex')));
