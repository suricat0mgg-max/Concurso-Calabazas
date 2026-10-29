# 🎃 Concurso de Calabazas

Página web para que los docentes voten desde el móvil las calabazas de Halloween.
Cada docente entra con su código personal y puede elegir **hasta 27 calabazas**
(sin repetir). Puede cambiar sus votos mientras la votación siga abierta.

- **Frontend:** `index.html`, `styles.css`, `app.js`, `config.js` (HTML estático, sin dependencias).
- **Backend:** `apps-script/Code.gs` (Google Apps Script) que guarda todo en una hoja de cálculo de Google.

## Probarlo ya (modo demostración)

Abre `index.html` en el navegador. Si `config.js` no tiene URL, funciona en modo demo:

- Código de docente: `DEMO`
- Resultados: abre `index.html#resultados` con la clave `demo`

## Puesta en marcha

### 1. Hoja de cálculo y backend

1. Crea una hoja de cálculo nueva en Google Sheets.
2. Menú **Extensiones → Apps Script**. Borra el contenido y pega `apps-script/Code.gs`.
3. Al principio del archivo ajusta:
   - `CANTIDAD_DOCENTES`: cuántas personas pueden votar.
   - `MAX_VOTOS`: cuántas calabazas puede elegir cada una (27).
   - `CLAVE_ADMIN`: déjala vacía para que los resultados **solo** se vean desde la hoja de cálculo,
     o pon una clave secreta para verlos también en la página (`#resultados`).
4. Selecciona la función `configurar` y pulsa **Ejecutar** (acepta los permisos).
   Se crean las hojas `Calabazas`, `Docentes` y `Votos`, y se generan los códigos de los docentes.
5. Rellena las hojas:
   - **Calabazas:** `id` (número que se ve en la tarjeta), `nombre`, `autor` (p. ej. el grupo) y `foto`.
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
2. Publica la página, por ejemplo con GitHub Pages:
   **Settings → Pages → Deploy from a branch** y elige la rama y la carpeta `/ (root)`.
3. Comparte el enlace (o un código QR) con los docentes.

> Si cambias `Code.gs`, vuelve a **Implementar → Gestionar implementaciones → Editar → Nueva versión**
> para que los cambios se apliquen en la misma URL.

## Durante y después del concurso

- **Ver resultados:** en la hoja de cálculo, menú **🎃 Concurso → Ver resultados**. Crea la hoja
  `Resultados` con el ranking y cuántos docentes han votado. Solo lo ve quien tenga acceso a la hoja
  (no la compartas). Si pusiste `CLAVE_ADMIN`, también en `https://tu-pagina/#resultados`.
- **Cerrar la votación:** pon `VOTACION_ABIERTA = false` en `Code.gs` y publica una nueva versión.
- Los votos quedan en la hoja `Votos` (una fila por docente con las calabazas elegidas),
  así que también se pueden revisar o exportar desde Google Sheets.
