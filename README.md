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
3. Cambia `CLAVE_ADMIN` al principio del archivo (y `MAX_VOTOS` si algún día cambia el límite).
4. Selecciona la función `configurar` y pulsa **Ejecutar** (acepta los permisos).
   Se crean las hojas `Calabazas`, `Docentes` y `Votos`.
5. Rellena las hojas:
   - **Calabazas:** `id` (número que se ve en la tarjeta), `nombre`, `autor` (p. ej. el grupo) y `foto`.
     En `foto` puedes poner cualquier URL de imagen o un enlace de Google Drive
     (el archivo debe estar compartido como "Cualquier persona con el enlace").
   - **Docentes:** un `codigo` único por docente y su `nombre`. Reparte a cada docente su código.
     Así cada persona vota solo una vez.
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

- **Ver resultados:** abre `https://tu-pagina/#resultados` e introduce `CLAVE_ADMIN`.
  Muestra el ranking y cuántos docentes han votado.
- **Cerrar la votación:** pon `VOTACION_ABIERTA = false` en `Code.gs` y publica una nueva versión.
- Los votos quedan en la hoja `Votos` (una fila por docente con las calabazas elegidas),
  así que también se pueden revisar o exportar desde Google Sheets.
