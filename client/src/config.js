// Configuración central de la URL del servidor.
//
// EN DESARROLLO LOCAL: deja la IP de tu red local (ej: "http://192.168.1.12:3000").
// EN PRODUCCIÓN (subido a internet): cambia esto por la URL pública de tu
// servidor (ej: "https://tu-app.onrender.com"). Si el frontend y el backend
// se sirven desde el mismo dominio, puedes dejarlo como cadena vacía ""
// para que use automáticamente el mismo origen donde está cargada la página.

export const SERVER_URL = "https://crew-media.onrender.com";

// URL del endpoint WHEP de tu servidor MediaMTX, expuesto por tu túnel de
// Cloudflare (cloudflared). Cambia esto CADA VEZ que reinicies el túnel
// "quick tunnel" gratis, porque la URL cambia sola (ver LEEME.md si
// quieres automatizarlo). Formato: https://TU-TUNEL.trycloudflare.com/<CLAVE>/whep
export const MEDIAMTX_WHEP_URL = "https://TU-TUNEL.trycloudflare.com/TU_CLAVE_SECRETA/whep";

// Lo que el Moderador configura en OBS Studio / vMix. OJO: esto usa la
// direccion LOCAL (127.0.0.1), no el túnel -- OBS y MediaMTX corren en la
// misma computadora, así que el RTMP nunca necesita salir a internet.
export const MEDIAMTX_RTMP_URL = "rtmp://127.0.0.1:1935";
export const MEDIAMTX_STREAM_KEY = "TU_CLAVE_SECRETA";
