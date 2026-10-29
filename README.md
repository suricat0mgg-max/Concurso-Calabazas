# 🎃 Concurso de Calabazas

Página web para que los docentes voten desde el móvil las calabazas de Halloween.
Cada docente entra con su código personal y puede elegir **hasta 27 calabazas**
(sin repetir). Puede cambiar sus votos mientras la votación siga abierta.

- **Frontend:** `index.html`, `styles.css`, `app.js`, `config.js` (HTML estático, sin dependencias).
- **Backend:** `apps-script/Code.gs` (Google Apps Script) que guarda todo en una hoja de cálculo de Google.

## Probarlo ya (modo demostración)

Abre `index.html` en el navegador. Si `config.js` no tiene URL, funciona en modo demo:

- Código de docente: `DEMO`
- Resultados: entra con el código `ADMIN`

## Puesta en marcha

### 1. Hoja de cálculo y backend

1. Crea una hoja de cálculo nueva en Google Sheets.
2. Menú **Extensiones → Apps Script**. Borra el contenido y pega `apps-script/Code.gs`.
3. Al principio del archivo ajusta:
   - `CANTIDAD_DOCENTES`: cuántas personas pueden votar.
   - `MAX_VOTOS`: cuántas calabazas puede elegir cada una (27).
4. Selecciona la función `configurar` y pulsa **Ejecutar** (acepta los permisos).
   Se crean las hojas `Calabazas`, `Docentes`, `Votos` y `Admin`, se generan los códigos de los
   docentes y un **código de administración** (hoja `Admin`) para ver los resultados.
5. Rellena las hojas:
   - **Calabazas:** `numero` (1, 2, 3…) y `foto`.
     En `foto` puedes poner cualquier URL de imagen o un enlace de Google Drive
     (el archivo debe estar compartido como "Cualquier persona con el enlace").
   - **Docentes:** ya tiene un código por docente. Escribe al lado el `nombre` de cada uno y
     reparte los códigos. Solo esos códigos pueden votar, y cada uno vota una sola vez
     (si vuelve a enviar, se reemplaza su voto anterior).
     Si necesitas más, sube `CANTIDAD_DOCENTES` y usa el menú **🎃 Concurso → Generar códigos de docentes**.
6. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: *Yo*
   - Quién tiene acceso: *Cualquier usuario*
7. Copia la URL que termina en `/exec`.

### 2. Página

1. Pega la URL en `config.js` → `API_URL`.
2. La página ya está publicada en https://suricat0mgg-max.github.io/Concurso-Calabazas/ y se
   actualiza sola con cada cambio (el flujo `.github/workflows/pages.yml` la copia a la rama `gh-pages`).
3. Comparte el enlace (o un código QR) con los docentes.

> Si cambias `Code.gs`, vuelve a **Implementar → Gestionar implementaciones → Editar → Nueva versión**
> para que los cambios se apliquen en la misma URL.

## Durante y después del concurso

- **Ver resultados:** entra en la página con el código de administración (hoja `Admin`). Verás el
  ranking y cuántos docentes han votado. Solo funciona con ese código, y el servidor lo comprueba.
  Si alguien lo descubre, usa el menú **🎃 Concurso → Cambiar código de administración**.
  También puedes usar el menú **🎃 Concurso → Ver resultados**, que crea la hoja `Resultados`.
- **Cerrar la votación:** pon `VOTACION_ABIERTA = false` en `Code.gs` y publica una nueva versión.
- Los votos quedan en la hoja `Votos` (una fila por docente con las calabazas elegidas),
  así que también se pueden revisar o exportar desde Google Sheets.
