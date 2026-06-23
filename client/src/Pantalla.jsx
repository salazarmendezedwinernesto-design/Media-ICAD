import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./auth";

const SOCKET_URL = SERVER_URL;
const DESTINATARIOS_PANTALLA = ["Director", "Pastor"];

const FRASE_RAPIDAS_PANTALLA = [
  "Listo en Proyección",
  "Falta video de apoyo",
  "Letra cargada",
  "Reiniciando software",
  "Problema con HDMI/Señal",
  "Texto muy largo",
];

export default function Pantalla({ alSalir }) {
  const [destinatarios, setDestinatarios] = useState([]);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [mensajesRecibidos, setMensajesRecibidos] = useState([]);
  const [confirmacion, setConfirmacion] = useState("");
  const [permitirParpadeo, setPermitirParpadeo] = useState(true);

  const socketRef = useRef(null);
  const temporizadorParpadeoRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: obtenerToken() },
    });
    socketRef.current = socket;

    // Si el servidor rechaza la conexión (token inválido o vencido),
    // se limpia la sesión y se vuelve a pedir usuario y contraseña.
    socket.on("connect_error", (err) => {
      if (err && err.message === "No autorizado") {
        borrarToken();
        window.location.reload();
      }
    });

    // 1. Escuchar instrucciones generales directas del Director
    socket.on("recibir_mensaje_general", (datos) => {
      if (datos && datos.mensaje) {
        agregarNuevoMensaje("Director (General)", datos.mensaje);
      }
    });

    // 2. NUEVO/OPTIMIZADO: Escuchar el canal interconectado (Mensajes del Director o Pastor hacia Pantalla)
    socket.on("recibir_mensaje_pastor", (datos) => {
      if (datos && datos.texto) {
        // Verificar si este mensaje tiene como destino "Pantalla" o "Todos"
        const esParaMi =
          datos.destinatarios.includes("Pantalla") ||
          datos.destinatarios.includes("Todos");

        if (esParaMi) {
          agregarNuevoMensaje(datos.de || "Sistema", datos.texto);
        }
      }
    });

    return () => {
      socket.disconnect();
      if (temporizadorParpadeoRef.current)
        clearTimeout(temporizadorParpadeoRef.current);
    };
  }, []);

  // Función auxiliar para procesar la entrada de un mensaje con alerta visual
  const agregarNuevoMensaje = (remitente, texto) => {
    setMensajesRecibidos((prev) => [
      { id: Date.now(), de: remitente, texto: texto },
      ...prev,
    ]);

    // Disparar vibración si el dispositivo lo soporta
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // Activar parpadeo de alerta crítica
    setPermitirParpadeo(true);
    if (temporizadorParpadeoRef.current)
      clearTimeout(temporizadorParpadeoRef.current);
    temporizadorParpadeoRef.current = setTimeout(() => {
      setPermitirParpadeo(false);
    }, 8000); // El parpadeo se detiene automáticamente a los 8 segundos
  };

  const toggleDestinatario = (id) => {
    setDestinatarios((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const enviarMensaje = (textoAEnviar) => {
    if (
      !textoAEnviar ||
      !textoAEnviar.trim() ||
      destinatarios.length === 0 ||
      !socketRef.current
    )
      return;

    socketRef.current.emit("enviar_mensaje_pantalla_desde_panel", {
      de: "Pantalla / Proyección",
      destinatarios: destinatarios,
      texto: textoAEnviar.trim(),
    });

    setConfirmacion("✅ Mensaje enviado correctamente");
    setTimeout(() => setConfirmacion(""), 3000);
  };

  const manejarEnvioTextoLibre = (e) => {
    e.preventDefault();
    enviarMensaje(textoMensaje);
    setTextoMensaje("");
  };

  const limpiarHistorial = () => {
    setMensajesRecibidos([]);
    setPermitirParpadeo(false);
  };

  const mensajeMasReciente = mensajesRecibidos[0];

  return (
    <div style={styles.container}>
      {/* Animaciones CSS inyectadas */}
      <style>{`
        @keyframes parpadeoFondoPantalla {
          0% { background-color: #111424; }
          50% { background-color: #1b1605; border-color: #d97706; }
          100% { background-color: #111424; }
        }
        .alerta-pantalla-activa {
          animation: parpadeoFondoPantalla 1.2s infinite ease-in-out;
          border: 2px solid #d97706 !important;
        }
      `}</style>

      {/* HEADER */}
      <header style={styles.navbar}>
        <button style={styles.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={styles.navTitle}>📺 OPERADOR DE PANTALLA</h1>
        <div style={{ width: "60px" }}></div>
      </header>

      {/* PANTALLA PRINCIPAL DE AVISOS RECIBIDOS */}
      <section
        style={{
          ...styles.pantallaAvisos,
          className: undefined,
        }}
        className={
          permitirParpadeo && mensajeMasReciente ? "alerta-pantalla-activa" : ""
        }
      >
        <div style={styles.headerAvisos}>
          <span style={styles.tituloSeccion}>
            📥 ÚLTIMA INSTRUCCIÓN RECIBIDA
          </span>
          {mensajesRecibidos.length > 0 && (
            <button style={styles.btnLimpiar} onClick={limpiarHistorial}>
              Limpiar
            </button>
          )}
        </div>

        <div style={styles.contenedorTextoCentral}>
          {mensajeMasReciente ? (
            <div style={{ width: "100%" }}>
              <span style={styles.remitenteTag}>
                ORIGEN: {mensajeMasReciente.de.toUpperCase()}
              </span>
              <p style={styles.textoInstruccion}>{mensajeMasReciente.texto}</p>
            </div>
          ) : (
            <p style={styles.textoVacio}>
              Sin instrucciones pendientes. Todo controlado.
            </p>
          )}
        </div>
      </section>

      {/* FORMULARIO DE ENVÍO Y REPORTES */}
      <main style={styles.panelEnvio}>
        <span style={styles.tituloSeccion}>📤 REPORTAR ESTADO O ALERTA</span>

        {/* Selector de Destinatarios */}
        <div style={styles.gridDestinatarios}>
          {DESTINATARIOS_PANTALLA.map((dest) => {
            const activo = destinatarios.includes(dest);
            return (
              <button
                key={dest}
                type="button"
                style={{
                  ...styles.btnDestinatario,
                  backgroundColor: activo ? "#d97706" : "#1e202b",
                  color: activo ? "#fff" : "#9ca3af",
                  borderColor: activo ? "#f59e0b" : "#2d303f",
                }}
                onClick={() => toggleDestinatario(dest)}
              >
                {activo ? `✓ Para ${dest}` : `Enviar a ${dest}`}
              </button>
            );
          })}
        </div>

        {/* Frases Rápidas Fijas */}
        <div style={styles.gridFrasesRapidas}>
          {FRASE_RAPIDAS_PANTALLA.map((frase) => (
            <button
              key={frase}
              type="button"
              disabled={destinatarios.length === 0}
              style={{
                ...styles.btnFraseFija,
                opacity: destinatarios.length === 0 ? 0.35 : 1,
                cursor: destinatarios.length === 0 ? "not-allowed" : "pointer",
              }}
              onClick={() => enviarMensaje(frase)}
            >
              {frase}
            </button>
          ))}
        </div>

        {/* Input Texto Libre */}
        <form onSubmit={manejarEnvioTextoLibre} style={styles.formMensaje}>
          <input
            type="text"
            value={textoMensaje}
            onChange={(e) => setTextoMensaje(e.target.value)}
            disabled={destinatarios.length === 0}
            placeholder={
              destinatarios.length === 0
                ? "⚠️ Selecciona un destinatario primero"
                : "Escribir reporte personalizado..."
            }
            style={styles.inputTextoLibre}
          />
          <button
            type="submit"
            disabled={destinatarios.length === 0 || !textoMensaje.trim()}
            style={{
              ...styles.btnEnviar,
              opacity:
                destinatarios.length === 0 || !textoMensaje.trim() ? 0.4 : 1,
              cursor:
                destinatarios.length === 0 || !textoMensaje.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            ENVIAR REPORTE
          </button>
        </form>

        {confirmacion && (
          <div style={styles.bannerConfirmacion}>{confirmacion}</div>
        )}
      </main>
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
    gap: "12px",
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
  pantallaAvisos: {
    flex: 1,
    backgroundColor: "#111424",
    border: "2px solid #2d303f",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
  },
  headerAvisos: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  tituloSeccion: {
    fontSize: "0.8rem",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#6b7280",
  },
  btnLimpiar: {
    backgroundColor: "transparent",
    color: "#6b7280",
    border: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    padding: "4px 8px",
  },
  contenedorTextoCentral: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  remitenteTag: {
    display: "inline-block",
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontSize: "0.8rem",
    fontWeight: "900",
    padding: "4px 10px",
    borderRadius: "4px",
    marginBottom: "10px",
  },
  textoInstruccion: {
    margin: 0,
    fontSize: "clamp(1.5rem, 6vh, 2.8rem)",
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: "1.25em",
    wordBreak: "break-word",
  },
  textoVacio: { color: "#374151", fontSize: "1.2rem", fontWeight: "600" },
  panelEnvio: {
    backgroundColor: "#11121a",
    borderRadius: "12px",
    padding: "14px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  gridDestinatarios: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  btnDestinatario: {
    border: "1px solid",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "0.88rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  gridFrasesRapidas: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  btnFraseFija: {
    backgroundColor: "#1e202b",
    color: "#f59e0b",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    padding: "14px 10px",
    fontSize: "0.85rem",
    fontWeight: "600",
  },
  formMensaje: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "4px",
  },
  inputTextoLibre: {
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    color: "#fff",
    padding: "14px",
    fontSize: "1rem",
    outline: "none",
  },
  btnEnviar: {
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "bold",
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
