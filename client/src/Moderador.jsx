import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
import VisorTransmision from "./VisorTransmision";

export default function Moderador({ alSalir }) {
  const [url, setUrl] = useState("");
  const [transmision, setTransmision] = useState({ activa: false, url: null });
  const [confirmacion, setConfirmacion] = useState("");

  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      auth: { token: obtenerToken() },
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      if (err && err.message === "No autorizado") {
        borrarToken();
        window.location.reload();
      }
    });

    socket.on("transmision:estado", (datos) => {
      if (datos) setTransmision(datos);
    });

    return () => socket.disconnect();
  }, []);

  const iniciarTransmision = (e) => {
    e.preventDefault();
    const limpio = url.trim();
    if (!limpio || !socketRef.current) return;

    socketRef.current.emit("transmision:iniciar", {
      url: limpio,
      de: "Moderador",
    });

    setConfirmacion("✅ Transmisión iniciada, ya es visible en todos los paneles");
    setTimeout(() => setConfirmacion(""), 4000);
  };

  const finalizarTransmision = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("transmision:finalizar");
    setUrl("");
    setConfirmacion("🛑 Transmisión finalizada y eliminada");
    setTimeout(() => setConfirmacion(""), 4000);
  };

  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <button style={styles.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={styles.navTitle}>📡 PANEL DE MODERADOR</h1>
        <div style={{ width: "90px" }} />
      </header>

      <section style={styles.tarjeta}>
        <span style={styles.tituloSeccion}>
          {transmision.activa ? "🔴 TRANSMISIÓN ACTIVA" : "⚪ SIN TRANSMISIÓN"}
        </span>

        {!transmision.activa ? (
          <form onSubmit={iniciarTransmision} style={styles.formulario}>
            <label style={styles.etiqueta}>
              Pega el enlace de la transmisión (salida web de vMix, OBS, o el
              embed de YouTube/Facebook Live):
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={styles.input}
            />
            <button
              type="submit"
              disabled={!url.trim()}
              style={{
                ...styles.btnIniciar,
                opacity: !url.trim() ? 0.4 : 1,
                cursor: !url.trim() ? "not-allowed" : "pointer",
              }}
            >
              🔴 Iniciar transmisión
            </button>
          </form>
        ) : (
          <div style={styles.formulario}>
            <p style={styles.urlActiva}>{transmision.url}</p>
            <button style={styles.btnFinalizar} onClick={finalizarTransmision}>
              🛑 Finalizar transmisión
            </button>
            <p style={styles.notaAyuda}>
              Al finalizar, el enlace se elimina por completo: no queda
              guardado en ningún lado.
            </p>
          </div>
        )}

        {confirmacion && (
          <div style={styles.bannerConfirmacion}>{confirmacion}</div>
        )}
      </section>

      {transmision.activa && (
        <section style={styles.tarjeta}>
          <span style={styles.tituloSeccion}>👁️ VISTA PREVIA (lo que ven los demás paneles)</span>
          <VisorTransmision url={transmision.url} alto="280px" />
        </section>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#0b0c10",
    color: "#fff",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
    padding: "12px",
    boxSizing: "border-box",
    gap: "14px",
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #1f2937",
    paddingBottom: "10px",
    flexShrink: 0,
  },
  btnVolver: {
    backgroundColor: "#1f2937",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "8px 14px",
  },
  navTitle: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#9ca3af",
  },
  tarjeta: {
    backgroundColor: "#11121a",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  tituloSeccion: {
    fontSize: "0.8rem",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#6b7280",
  },
  formulario: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  etiqueta: {
    fontSize: "0.85rem",
    color: "#9ca3af",
    margin: 0,
  },
  input: {
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    color: "#fff",
    padding: "14px",
    fontSize: "1rem",
    outline: "none",
  },
  btnIniciar: {
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "bold",
  },
  urlActiva: {
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "0.85rem",
    color: "#9ca3af",
    wordBreak: "break-all",
    margin: 0,
  },
  btnFinalizar: {
    backgroundColor: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  notaAyuda: {
    fontSize: "0.75rem",
    color: "#6b7280",
    margin: 0,
  },
  bannerConfirmacion: {
    backgroundColor: "#065f46",
    color: "#34d399",
    padding: "8px",
    borderRadius: "6px",
    textAlign: "center",
    fontSize: "0.85rem",
    fontWeight: "bold",
  },
};
