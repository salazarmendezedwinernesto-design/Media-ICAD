import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken } from "./services/auth";
import { IconAlerta, IconEnlace } from "./Icons";

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
  // Empieza minimizado (solo la franja con el título) para no ocupar
  // espacio de golpe ni tapar botones de la pantalla; cada quien lo abre
  // cuando quiera verlo.
  const [minimizado, setMinimizado] = useState(true);
  const [estadoConexion, setEstadoConexion] = useState("conectando"); // conectando | ok | error
  const socketRef = useRef(null);

  useEffect(() => {
    const token = obtenerToken();
    if (!token) {
      console.warn(
        "[EnlaceExterno] No hay token guardado en este navegador; el socket no podrá autenticarse.",
      );
    }

    const socket = io(SERVER_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[EnlaceExterno] Socket conectado:", socket.id);
      setEstadoConexion("ok");
    });

    socket.on("connect_error", (err) => {
      console.error("[EnlaceExterno] Error de conexión:", err?.message || err);
      setEstadoConexion("error");
    });

    socket.on("enlace:estado", (datos) => {
      console.log("[EnlaceExterno] enlace:estado recibido:", datos);
      if (datos) setEnlace(datos);
    });

    return () => socket.disconnect();
  }, []);

  if (!enlace.activo || !enlace.url) return null;

  const info = detectarEnlace(enlace.url);

  // Si hay un enlace activo pero no se pudo interpretar como YouTube/Facebook,
  // avisamos en vez de no mostrar nada (así se sabe que el problema es el
  // formato del link y no que la conexión esté fallando).
  if (!info) {
    return (
      <div style={estilos.contenedor}>
        <p style={{ ...estilos.textoAdvertencia, margin: 0 }}>
          <IconAlerta size={14} /> Hay un enlace publicado ({enlace.url}) pero
          no se reconoce como YouTube ni Facebook.
        </p>
      </div>
    );
  }

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.encabezado}>
        <span style={estilos.insignia}>
          <span style={estilos.punto} />
          {info.tipo === "youtube" ? "YOUTUBE" : "FACEBOOK"} EN VIVO
        </span>
        <button
          style={estilos.btnToggle}
          onClick={() => setMinimizado((v) => !v)}
        >
          {minimizado ? "Ver ▼" : "Ocultar ▲"}
        </button>
      </div>

      {estadoConexion === "error" && (
        <p style={{ ...estilos.textoAdvertencia, margin: "6px 0 0" }}>
          <IconAlerta size={13} /> No se pudo autenticar el socket en este panel
          (revisa que hayas iniciado sesión aquí).
        </p>
      )}

      {!minimizado && (
        <>
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
          <a
            href={enlace.url}
            target="_blank"
            rel="noopener noreferrer"
            style={estilos.enlaceRespaldo}
          >
            <IconEnlace size={12} /> ¿No carga? Abrir directo
          </a>
        </>
      )}
    </div>
  );
}

const estilos = {
  // Tarjeta normal dentro del flujo de la página (igual que
  // BarraTransmision): ocupa su espacio y empuja el resto del contenido,
  // en vez de flotar encima y tapar botones u otros controles.
  contenedor: {
    width: "100%",
    backgroundColor: "#111424",
    border: "1px solid #2563eb",
    borderRadius: "10px",
    padding: "8px 10px",
    boxSizing: "border-box",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
    fontFamily: "system-ui, sans-serif",
    flexShrink: 0,
  },
  encabezado: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
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
    maxHeight: "220px",
    backgroundColor: "#000",
  },
  iframe: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  textoAdvertencia: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#f87171",
    fontSize: "0.76rem",
  },
  enlaceRespaldo: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#60a5fa",
    fontSize: "0.72rem",
    textDecoration: "none",
    marginTop: "6px",
  },
};
