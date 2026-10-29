// Dónde se guardan los votos y ajustes del concurso.
// Los votos se envían al Formulario de Google; el recuento se lee de su hoja de
// respuestas publicada como CSV. ADMIN es la huella del código de administración
// (el código no está aquí).
window.CONFIG = {
  FORMULARIO_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSdTWFfe4MPXsUyi6egFbhQyy1r7O-R8hsgP9FgiTxLnh_q5oQ/formResponse',
  CAMPO_NOMBRE: 'entry.1197551579',
  CAMPO_VOTOS: 'entry.725055496',
  RESULTADOS_CSV: 'https://docs.google.com/spreadsheets/d/19_YVg1kQOTH4M4eqT-LyuvBnTA4XLhr7MsP_ojREKaQ/edit?usp=drivesdk',
  CALABAZAS: 250,
  MAX_VOTOS: 26,
  ADMIN: "35fd779a541e47801ad6629e7cb343e00de992da070e97b4cd4f5309dda0a0d1",
};
