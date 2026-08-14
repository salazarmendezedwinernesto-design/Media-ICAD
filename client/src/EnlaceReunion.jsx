import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken } from "./services/auth";
import { IconCamara, IconEnlace, IconAlerta } from "./icons";

/**
 * Franja flotante que muestra el link de videollamada (Google Meet) que
 * el Moderador haya publicado. Aparece sola en cuanto se publica y
 * desaparece sola en cuanto se quita — no hay que hacer nada en cada
 * panel más que montar este componente una vez (igual patrón que
 * EnlaceExterno.jsx).
 *
 * A diferencia de EnlaceExterno (YouTube/Facebook), aquí NO se intenta
 * incrustar nada en un <iframe>: Google Meet no permite ser embebido por
 * seguridad, así que solo se muestra un botón que abre la llamada en una
 * pestaña/app nueva.
 */
export default function EnlaceReunion() {
  const [reunion, setReunion] = useState({ activo: false, url: null });
  const socketRef = useRef(null);

  useEffect(() => {
    const token = obtenerToken();
    if (!token) {
      console.warn(
        "[EnlaceReunion] No hay token guardado en este navegador; el socket no podrá autenticarse.",
      );
    }

    const socket = io(SERVER_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("reunion:estado", (datos) => {
      if (datos) setReunion(datos);
    });

    return () => socket.disconnect();
  }, []);

  if (!reunion.activo || !reunion.url) return null;

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.encabezado}>
        <span style={estilos.insignia}>
          <span style={estilos.punto} />
          <IconCamara size={13} /> LLAMADA EN VIVO
        </span>
        {reunion.publicadoPor && (
          <span style={estilos.publicadoPor}>
            Iniciada por {reunion.publicadoPor}
          </span>
        )}
      </div>

      <a
        href={reunion.url}
        target="_blank"
        rel="noopener noreferrer"
        style={estilos.btnUnirse}
      >
        <IconEnlace size={14} /> Unirse a la llamada
      </a>

      {!/meet\.google\.com/i.test(reunion.url) && (
        <p style={estilos.textoAdvertencia}>
          <IconAlerta size={12} /> Este link no parece de Google Meet, pero se
          abrirá igual.
        </p>
      )}
    </div>
  );
}

const estilos = {
  // Tarjeta normal dentro del flujo de la página (igual que
  // BarraTransmision/EnlaceExterno): ocupa su espacio y empuja el resto
  // del contenido, en vez de flotar encima y tapar botones u otros
  // controles.
  contenedor: {
    width: "100%",
    backgroundColor: "#111424",
    border: "1px solid #16a34a",
    borderRadius: "10px",
    padding: "8px 10px",
    boxSizing: "border-box",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
    fontFamily: "system-ui, sans-serif",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
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
    backgroundColor: "#16a34a",
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
  publicadoPor: {
    fontSize: "0.7rem",
    color: "#9ca3af",
  },
  btnUnirse: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    backgroundColor: "#16a34a",
    color: "#fff",
    fontWeight: "700",
    fontSize: "0.85rem",
    textDecoration: "none",
    borderRadius: "8px",
    padding: "10px",
  },
  textoAdvertencia: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#f87171",
    fontSize: "0.72rem",
    margin: 0,
  },
};
