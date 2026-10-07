# Videos de tótems

Los consume `/totems/videos` (galería agrupada por tótem). Las instrucciones para
sumar un video están como comentario HTML arriba del primer grupo en
`totems/videos/index.html`.

## Convención de nombres

```
<totem>-<tema>.mp4            abuelojulio-ruleta.mp4
<totem>-<tema>-poster.webp    abuelojulio-ruleta-poster.webp
```

`<totem>` tiene que coincidir con el `id` de la sección: `abuelojulio`, `platense`,
`viacargo`, `delsud`.

## Compresión

El video sale del celular con un bitrate muy por encima de lo que necesita una
galería web. Antes de subirlo:

```bash
# Vertical (9:16). Para horizontal: scale=1280:-2
ffmpeg -i original.mp4 \
  -vf "scale=720:-2" \
  -c:v libx264 -preset slow -crf 27 -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 96k -movflags +faststart \
  totem-tema.mp4

# Poster: primer frame representativo (ajustá el segundo con -ss)
ffmpeg -i totem-tema.mp4 -ss 00:00:01 -frames:v 1 -vf "scale=576:-2" -q:v 70 totem-tema-poster.webp
```

`-movflags +faststart` es importante: mueve el índice al principio del archivo para
que el navegador pueda empezar a reproducir sin descargarlo entero.

Objetivo por video: **menos de 2,5 MB**. Un reel de 20 segundos a 720p/CRF 27 ronda
los 1,5 MB.

## Dónde viven los archivos

Hoy se sirven desde este directorio, cacheados una semana por la regla
`/assets/(.*)` de `vercel.json`.

Esto funciona bien mientras el total se mantenga por debajo de unos **100 MB**. Por
encima de eso conviene sacarlos del repositorio —cada versión de cada video queda
para siempre en el historial de git— y moverlos a almacenamiento de objetos
(Vercel Blob, Cloudflare R2, Bunny). La migración no toca el código: sólo hay que
cambiar el `data-src` de cada `<video>` por la URL absoluta del CDN.

Estado actual: ~25 MB en 7 videos.
