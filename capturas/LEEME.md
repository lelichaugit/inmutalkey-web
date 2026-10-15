# Capturas originales

Sube aquí (GitHub → Add file → Upload files) las imágenes tal cual salen de la app o de Drive.

- **Capturas de la app** (`.png`, `.jpg`, `.webp`): aparecen en la galería "Así se ve trabajando".
  Título, descripción y orden opcionales en `textos.json` (la clave es el nombre exacto del archivo).
- **`cleanmainweblogo.svg`**: logo principal (llave 3D) tal como lo exporta Canva. Trae dentro tres imágenes alineadas
  píxel a píxel que se guardaron aparte:
  - **`logomain-3d.png`**: render 3D sobre negro (el mismo de `logomainscroll.jpg`, sin compresión).
  - **`logomain-silueta.png`**: máscara de la silueta → transparencia real de la llave.
  - **`logomain-contorno.png`**: versión en contorno → "plano técnico" (`npm run vectorizar:llave`).
  Si cambia el logo, reemplaza esos tres PNG (1024×1024, mismo encuadre) y corre `npm run marca`.
- **`logomainscroll.jpg`**: render 3D original; solo se usa si faltan los PNG de arriba.
- **`*logowsp*.jpg`**: avatar del chat simulado de WhatsApp.
- Otros archivos con "logo" en el nombre se ignoran en la galería.

Después: `npm run activos` (marca + capturas) y commit.
