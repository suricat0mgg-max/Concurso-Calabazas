// Genera los códigos de docente y el de administración, y las huellas para config.js.
// Uso: node herramientas/generar-codigos.js 30
// Los códigos salen por pantalla: repártelos y NO los subas al repositorio.
const crypto = require('crypto');

const cantidad = parseInt(process.argv[2], 10) || 30;
const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const huella = (texto) => crypto.createHash('sha256').update(texto).digest('hex');
const codigo = (largo) => Array.from(crypto.randomBytes(largo), (b) => letras[b % letras.length]).join('');

const docentes = new Set();
while (docentes.size < cantidad) docentes.add(codigo(6));
const admin = 'ADM-' + codigo(8);

console.log('CÓDIGO DE ADMINISTRACIÓN: ' + admin + '\n');
console.log('CÓDIGOS DE DOCENTE:');
[...docentes].forEach((c, i) => console.log(String(i + 1).padStart(3) + '. ' + c));
console.log('\nPara config.js:');
console.log(JSON.stringify({
  ADMIN: huella('admin:' + admin),
  VALIDOS: [...docentes].map((c) => huella('ok:' + huella('voto:' + c))).sort(),
}));
