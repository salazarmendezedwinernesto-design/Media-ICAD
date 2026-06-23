import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";

const SOCKET_URL = SERVER_URL;

const DESTINATARIOS_LIDER = [
  "Director",
  "Pastor",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
];

const FRASES_RAPIDAS_LIDER = [
  "ATENTOS CÁMARAS",
  "CAMBIO DE ÁNGULO",
  "BUEN TRABAJO",
  "RECIBIDO PASTOR",
  "RECIBIDO DIRECTOR",
];

export default function Lider({ alSalir }) {
  const [destinatarios, setDestinatarios] = useState([]);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [mensajesRecibidos, setMensajesRecibidos] = useState([]);
  const [estadosCamaras, setEstadosCamaras] = useState({
    1: "standby",
    2: "standby",
    3: "standby",
    4: "standby",
    5: "standby",
    6: "standby",
  });
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

    // Escuchar directrices o avisos cruzados destinados al Líder o a Todos
    socket.on("recibir_mensaje_pastor", (datos) => {
      if (!datos || datos.de === "Lider") return;

      const esParaMi =
        datos.destinatarios.includes("Lider") ||
        datos.destinatarios.includes("Todos");
      if (esParaMi) {
        setMensajesRecibidos((prev) => [datos, ...prev]);
        setPermitirParpadeo(true);

        if (temporizadorParpadeoRef.current)
          clearTimeout(temporizadorParpadeoRef.current);
        temporizadorParpadeoRef.current = setTimeout(
          () => setPermitirParpadeo(false),
          8000,
        );

        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    });

    // Escuchar el estado de Tally en tiempo real
    socket.on("recibir_orden_camara", (datos) => {
      if (datos && datos.camara !== undefined) {
        setEstadosCamaras((prev) => ({
          ...prev,
          [datos.camara]: datos.estado || "standby",
        }));
      }
    });

    return () => {
      socket.disconnect();
      if (temporizadorParpadeoRef.current)
        clearTimeout(temporizadorParpadeoRef.current);
    };
  }, []);

  const toggleDestinatario = (dest) => {
    setDestinatarios((prev) =>
      prev.includes(dest) ? prev.filter((d) => d !== dest) : [...prev, dest],
    );
  };

  const enviarMensaje = (textoAEnviar) => {
    if (!textoAEnviar || !textoAEnviar.trim() || !socketRef.current) return;

    // Si no hay destinatario seleccionado, no se envía nada
    if (destinatarios.length === 0) {
      setConfirmacion("⚠️ Selecciona un destinatario primero");
      setTimeout(() => setConfirmacion(""), 2500);
      return;
    }

    // Separar envíos nativos a Tally de cámaras de los del chat interconectado
    const camarasAEnviar = destinatarios
      .filter((d) => d.startsWith("C"))
      .map((d) => Number(d.replace("C", "")));

    if (camarasAEnviar.length > 0) {
      socketRef.current.emit("enviar_mensaje_general", {
        camaras: camarasAEnviar,
        mensaje: textoAEnviar.trim(),
        de: "LÍDER",
      });
    }

    // Enviar a Pastor, Director o canales generales de mensajería
    const otrosDestinos = destinatarios.filter((d) => !d.startsWith("C"));
    if (otrosDestinos.length > 0) {
      socketRef.current.emit("enviar_mensaje_a_pastor", {
        de: "Lider",
        texto: textoAEnviar.trim(),
        destinatarios: otrosDestinos,
        id: Date.now(),
      });
    }

    setConfirmacion("Enviado ✓");
    setTimeout(() => setConfirmacion(""), 2000);
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes parpadeoLider {
          0% { background-color: rgba(230, 126, 34, 0.2); }
          50% { background-color: rgba(230, 126, 34, 0.5); border-color: #fff; }
          100% { background-color: rgba(230, 126, 34, 0.2); }
        }
        .alerta-lider { animation: parpadeoLider 0.8s infinite ease-in-out; }
      `}</style>

      <header style={styles.navbar}>
        <button style={styles.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={styles.navTitle}>🔸 PANEL DE LÍDER</h1>
        <div style={styles.confirmacion}>{confirmacion}</div>
      </header>

      <div style={styles.layoutPrincipal}>
        {/* RETORNO DE RETÍCULA DE CÁMARAS */}
        <div style={styles.seccionCard}>
          <h3 style={styles.tituloSeccion}>
            🎥 ESTADO DE CÁMARAS EN TIEMPO REAL
          </h3>
          <div style={styles.gridMonitorCamaras}>
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const estado = estadosCamaras[num] || "standby";
              let fondoCam = "#2a2a2a";
              let txt = "ESPERA";
              if (estado === "live") {
                fondoCam = "#ff3333";
                txt = "VIVO";
              } else if (estado === "preview") {
                fondoCam = "#00cc66";
                txt = "PREVIO";
              }
              return (
                <div
                  key={num}
                  style={{ ...styles.cardMonitor, backgroundColor: fondoCam }}
                >
                  <span style={styles.cardMonitorNum}>C{num}</span>
                  <span style={styles.cardMonitorEstado}>{txt}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RECEPTOR DE MENSAJES (BUZÓN) */}
        <div
          style={{ ...styles.seccionCard, flex: 1.2 }}
          className={
            permitirParpadeo && mensajesRecibidos.length > 0
              ? "alerta-lider"
              : ""
          }
        >
          <h3 style={styles.tituloSeccion}>
            📥 BUZÓN DE INSTRUCCIONES ENTRANTES
          </h3>
          <div style={styles.buzonMensajes}>
            {mensajesRecibidos.length === 0 ? (
              <p style={styles.textoVacio}>No hay mensajes entrantes.</p>
            ) : (
              mensajesRecibidos.map((msg) => (
                <div key={msg.id} style={styles.msgItem}>
                  <div>
                    <strong style={{ color: "#e67e22" }}>[{msg.de}]: </strong>
                    <span style={{ color: "#fff" }}>{msg.texto}</span>
                  </div>
                  <button
                    style={styles.btnBorrar}
                    onClick={() =>
                      setMensajesRecibidos((prev) =>
                        prev.filter((m) => m.id !== msg.id),
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SELECTOR DE DESTINATARIOS Y ENVÍO */}
        <div style={styles.seccionCard}>
          <h3 style={styles.tituloSeccion}>🎯 DESTINATARIOS SELECCIONADOS</h3>
          <div style={styles.gridDestinatarios}>
            {DESTINATARIOS_LIDER.map((dest) => (
              <button
                key={dest}
                onClick={() => toggleDestinatario(dest)}
                style={{
                  ...styles.btnDest,
                  backgroundColor: destinatarios.includes(dest)
                    ? "#e67e22"
                    : "#222",
                  borderColor: destinatarios.includes(dest) ? "#fff" : "#444",
                }}
              >
                {dest}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "15px" }}>
            <h4 style={styles.subTitulo}>Frases Rápidas:</h4>
            <div style={styles.gridFrases}>
              {FRASES_RAPIDAS_LIDER.map((f) => (
                <button
                  key={f}
                  onClick={() => enviarMensaje(f)}
                  disabled={destinatarios.length === 0}
                  style={{
                    ...styles.btnFrase,
                    opacity: destinatarios.length === 0 ? 0.4 : 1,
                    cursor:
                      destinatarios.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviarMensaje(textoMensaje);
              setTextoMensaje("");
            }}
            style={styles.formEnvio}
          >
            <input
              type="text"
              placeholder={
                destinatarios.length === 0
                  ? "⚠️ Selecciona un destinatario primero"
                  : "Escribe un mensaje personalizado..."
              }
              value={textoMensaje}
              onChange={(e) => setTextoMensaje(e.target.value)}
              disabled={destinatarios.length === 0}
              style={styles.inputMsg}
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
              ENVIAR
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#0b0c10",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "sans-serif",
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2833",
    padding: "10px 20px",
  },
  btnVolver: {
    backgroundColor: "#c5a059",
    border: "none",
    padding: "8px 15px",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  navTitle: { fontSize: "1.3rem", margin: 0, fontWeight: "bold" },
  confirmacion: { color: "#2ecc71", fontWeight: "bold" },
  layoutPrincipal: {
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  seccionCard: {
    backgroundColor: "#151922",
    padding: "15px",
    borderRadius: "10px",
    border: "1px solid #232936",
  },
  tituloSeccion: {
    margin: "0 0 12px 0",
    fontSize: "0.95rem",
    color: "#95a5a6",
    letterSpacing: "0.5px",
  },
  gridMonitorCamaras: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
  },
  cardMonitor: {
    padding: "12px 5px",
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  cardMonitorNum: { fontSize: "1.2rem", fontWeight: "900" },
  cardMonitorEstado: { fontSize: "0.75rem", opacity: 0.9 },
  buzonMensajes: {
    maxHeight: "180px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  textoVacio: { color: "#666", fontSize: "0.9rem", textAlign: "center" },
  msgItem: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: "#0d1117",
    padding: "10px",
    borderRadius: "6px",
  },
  btnBorrar: {
    background: "none",
    border: "none",
    color: "#e74c3c",
    fontWeight: "bold",
    cursor: "pointer",
  },
  gridDestinatarios: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
  },
  btnDest: {
    color: "#fff",
    border: "1px solid",
    padding: "10px 2px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "bold",
  },
  subTitulo: { margin: "5px 0", fontSize: "0.85rem", color: "#bbb" },
  gridFrases: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" },
  btnFrase: {
    backgroundColor: "#2c3e50",
    color: "#fff",
    border: "none",
    padding: "10px",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  formEnvio: { display: "flex", gap: "10px", marginTop: "15px" },
  inputMsg: {
    flex: 1,
    backgroundColor: "#0d1117",
    border: "1px solid #333",
    color: "#fff",
    padding: "10px",
    borderRadius: "5px",
  },
  btnEnviar: {
    backgroundColor: "#e67e22",
    border: "none",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "5px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
