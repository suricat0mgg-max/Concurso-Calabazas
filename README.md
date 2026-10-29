# 🎃 Concurso de Calabazas

Página web para que los docentes voten desde el móvil las calabazas de Halloween.
Cada docente entra con su **nombre** y puede elegir **hasta 27 calabazas**
(sin repetir). Si vuelve a entrar con el mismo nombre, ve su voto y puede cambiarlo.
Solo quien tiene el código de administración ve los resultados y quién ha votado.

- **Frontend:** `index.html`, `styles.css`, `app.js`, `config.js` (HTML estático, sin dependencias).
- **Backend:** `apps-script/Code.gs` (Google Apps Script) que guarda todo en una hoja de cálculo de Google.

## Probarlo ya (modo demostración)

Abre `index.html` en el navegador. Si `config.js` no tiene URL, funciona en modo demo:

- Para votar: escribe cualquier nombre
- Resultados: entra con el código `ADMIN`

## Dónde se guardan los votos

Los votos están en un documento de restful-api.dev (servicio gratuito sin cuenta), configurado en
`config.js` (`ALMACEN_URL`). `ADMIN` es la huella del código de administración, que genera
`node herramientas/generar-codigos.js`; el código en sí no se sube al repositorio.

Para crear un almacén nuevo, abre `https://suricat0mgg-max.github.io/Concurso-Calabazas/#preparar`
y pulsa «Crear almacén»: prueba varios servicios y muestra la dirección para `config.js`.

> La opción de Google de abajo sigue usando códigos de docente en lugar de nombres.

## Puesta en marcha (unos 10 minutos, desde un ordenador)

1. Entra en https://sheets.new con tu cuenta de Google. Se crea una hoja de cálculo vacía.
   Ponle un nombre, por ejemplo «Concurso de Calabazas».
2. Menú **Extensiones → Apps Script**. Se abre el editor en otra pestaña.
3. Borra todo lo que haya y pega el contenido de
   [`apps-script/Code.gs`](apps-script/Code.gs) (botón «Copy raw file» en GitHub).
4. Pulsa el icono de guardar 💾. En la lista de funciones de arriba elige **configurar** y pulsa **Ejecutar**.
   Google pedirá permiso: **Revisar permisos → tu cuenta → Configuración avanzada →
   Ir a (proyecto) → Permitir**. Es normal: el script solo usa esta hoja.
5. **Implementar → Nueva implementación** → en el engranaje elige **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
6. Pega esa URL en `config.js` → `API_URL` (o pásasela a quien mantenga la página).
   La página se vuelve a publicar sola en https://suricat0mgg-max.github.io/Concurso-Calabazas/

En la hoja de cálculo tendrás:
- **Config:** número de calabazas, de docentes, votos por docente y si la votación está abierta
  (`SÍ` / `NO`). Se cambia ahí directamente, sin tocar el código. Si subes el número de docentes,
  usa el menú **🎃 Concurso → Generar códigos de docentes**.
- **Docentes:** un código por docente. Escribe al lado el nombre de cada uno y reparte los códigos.
- **Admin:** el código de administración para ver los resultados. No lo compartas.
- **Votos:** una fila por docente con las calabazas que ha elegido.

> Si cambias algo en `Code.gs`, guarda y ve a
> **Implementar → Gestionar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar**.
> La URL no cambia.

## Durante y después del concurso

- **Ver resultados:** entra en la página con el código de administración (hoja `Admin`). Verás el
  ranking y cuántos docentes han votado. Solo funciona con ese código, y el servidor lo comprueba.
  Si alguien lo descubre, usa el menú **🎃 Concurso → Cambiar código de administración**.
  También puedes usar el menú **🎃 Concurso → Ver resultados**, que crea la hoja `Resultados`.
- **Cerrar la votación:** en la hoja `Config`, pon `NO` en «Votación abierta».
- Los votos quedan en la hoja `Votos` (una fila por docente con las calabazas elegidas),
  así que también se pueden revisar o exportar desde Google Sheets.
