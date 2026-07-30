import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken } from "./services/auth";

/**
 * Convierte un link de YouTube o Facebook (pegado tal cual por el
 * Moderador) en una URL de embed lista para meter en un <iframe>.
 * Devuelve null si el link no se reconoce.
 */
export function detectarEnlace(urlOriginal) {
  if (!urlOriginal) return null;
  const url = String(urlOriginal).trim();

  // --- YouTube: watch?v=, youtu.be/, /live/, /embed/, /shorts/ ---
  const patronesYoutube = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/live\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
  ];
  for (const patron of patronesYoutube) {
    const m = url.match(patron);
    if (m && m[1]) {
      return {
        tipo: "youtube",
        embedUrl: `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&playsinline=1&rel=0`,
      };
    }
  }

  // --- Facebook: cualquier link de facebook.com o fb.watch con video/live ---
  if (/facebook\.com|fb\.watch/i.test(url)) {
    const href = encodeURIComponent(url);
    return {
      tipo: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&autoplay=true&mute=1`,
    };
  }

  return null;
}

/**
 * Franja flotante que muestra el enlace externo (YouTube/Facebook) que
 * el Moderador haya publicado. Aparece sola en cuanto se publica y
 * desaparece sola en cuanto se quita — no hay que hacer nada en cada
 * panel más que montar este componente una vez.
 */
export default function EnlaceExterno() {
  const [enlace, setEnlace] = useState({ activo: false, url: null });
  const [minimizado, setMinimizado] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { auth: { token: obtenerToken() } });
    socketRef.current = socket;

    socket.on("enlace:estado", (datos) => {
      if (datos) setEnlace(datos);
    });

    return () => socket.disconnect();
  }, []);

  if (!enlace.activo || !enlace.url) return null;

  const info = detectarEnlace(enlace.url);
  if (!info) return null;

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.encabezado}>
        <span style={estilos.insignia}>
          <span style={estilos.punto} />
          {info.tipo === "youtube" ? "YOUTUBE" : "FACEBOOK"} EN VIVO
        </span>
        <button style={estilos.btnToggle} onClick={() => setMinimizado((v) => !v)}>
          {minimizado ? "Ver ▼" : "Minimizar ▲"}
        </button>
      </div>

      {!minimizado && (
        <div style={estilos.marco}>
          <iframe
            key={info.embedUrl}
            src={info.embedUrl}
            title="Enlace externo"
            style={estilos.iframe}
            frameBorder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

const estilos = {
  contenedor: {
    position: "fixed",
    left: "10px",
    bottom: "10px",
    width: "min(360px, 92vw)",
    backgroundColor: "#111424",
    border: "1px solid #2563eb",
    borderRadius: "12px",
    padding: "8px",
    boxSizing: "border-box",
    zIndex: 9999,
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    fontFamily: "system-ui, sans-serif",
  },
  encabezado: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  insignia: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#2563eb",
    color: "#fff",
    fontWeight: "900",
    fontSize: "0.7rem",
    letterSpacing: "0.5px",
    padding: "4px 8px",
    borderRadius: "6px",
  },
  punto: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#fff",
    display: "inline-block",
  },
  btnToggle: {
    backgroundColor: "#1f2937",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "5px 9px",
    fontSize: "0.72rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  marco: {
    marginTop: "8px",
    borderRadius: "8px",
    overflow: "hidden",
    aspectRatio: "16 / 9",
    backgroundColor: "#000",
  },
  iframe: {
    width: "100%",
    height: "100%",
    display: "block",
  },
};
