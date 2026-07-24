import React, { useEffect, useRef, useState } from "react";

// Detecta qué tipo de reproductor necesita el link que pegó el moderador:
//  - "hls"    -> termina en .m3u8 (típico de un servidor de streaming propio,
//                Owncast, o la salida de algunos plugins de OBS/vMix)
//  - "video"  -> termina en .mp4/.webm/.ogg (archivo de video directo)
//  - "iframe" -> cualquier otro link (embed de YouTube Live, Facebook Live,
//                salida web de vMix, restream.io, etc.) — es el caso más común
function detectarTipo(url) {
  if (!url) return "iframe";
  if (/\.m3u8(\?|$)/i.test(url)) return "hls";
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return "video";
  return "iframe";
}

// Carga hls.js desde un CDN solo si hace falta (el link es .m3u8 y el
// navegador no soporta HLS nativo, como Chrome/Firefox/Edge). Así evitamos
// añadir una dependencia nueva al proyecto: se descarga bajo demanda.
let hlsPromesaCarga = null;
function cargarHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsPromesaCarga) return hlsPromesaCarga;

  hlsPromesaCarga = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
    script.onload = () => resolve(window.Hls);
    script.onerror = () => reject(new Error("No se pudo cargar hls.js"));
    document.head.appendChild(script);
  });

  return hlsPromesaCarga;
}

/**
 * Reproductor genérico de la transmisión en vivo. Recibe la URL que pegó
 * el Moderador y decide solo cómo mostrarla.
 *
 * Props:
 *  - url: el link guardado por el Moderador
 *  - alto: alto CSS del contenedor (ej. "100%", "220px")
 *  - redondeado: si true, aplica bordes redondeados (para usarlo dentro de
 *    un panel); en la pantalla de "Presentar" se deja en false.
 */
export default function VisorTransmision({ url, alto = "100%", redondeado = true }) {
  const tipo = detectarTipo(url);
  const videoRef = useRef(null);
  const [errorHls, setErrorHls] = useState("");

  useEffect(() => {
    if (tipo !== "hls" || !url) return;
    const video = videoRef.current;
    if (!video) return;

    // Safari / iOS soportan HLS nativo directo en el <video>.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }

    let hls;
    cargarHlsJs()
      .then((Hls) => {
        if (!Hls || !Hls.isSupported()) {
          setErrorHls("Este navegador no puede reproducir HLS.");
          return;
        }
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
      })
      .catch(() => setErrorHls("No se pudo cargar el reproductor HLS."));

    return () => {
      if (hls) hls.destroy();
    };
  }, [url, tipo]);

  const estiloContenedor = {
    width: "100%",
    height: alto,
    backgroundColor: "#000",
    borderRadius: redondeado ? "10px" : 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!url) return null;

  if (tipo === "video") {
    return (
      <div style={estiloContenedor}>
        <video
          src={url}
          controls
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }

  if (tipo === "hls") {
    return (
      <div style={estiloContenedor}>
        {errorHls ? (
          <p style={{ color: "#f87171", fontSize: "0.85rem", padding: "10px" }}>
            {errorHls}
          </p>
        ) : (
          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
      </div>
    );
  }

  // Caso por defecto: iframe (YouTube/Facebook embed, salida web de vMix, etc.)
  return (
    <div style={estiloContenedor}>
      <iframe
        src={url}
        title="Transmisión en vivo"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}
