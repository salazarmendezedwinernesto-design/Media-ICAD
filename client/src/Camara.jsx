import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";

const SOCKET_URL = SERVER_URL;

const MENSAJES_RAPIDOS_CAMARA = [
  "✅ LISTA",
  "🔋 BATERÍA BAJA",
  "🙋 NECESITO AYUDA",
  "🎙️ PROBLEMA DE AUDIO",
];

export default function Camara({ numero, alSalir }) {
  const [tally, setTally] = useState({
    estado: "standby",
    mensaje: "",
    de: "DIRECTOR",
  });
  const [textoLibre, setTextoLibre] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [responderA, setResponderA] = useState("Director"); // Destinatario por defecto
  const socketRef = useRef(null);

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

    socket.on("recibir_orden_camara", (datos) => {
      if (Number(datos.camara) === Number(numero)) {
        setTally((prev) => {
          // Vibrar si cambió el estado (live/preview/standby) o si llegó
          // un mensaje nuevo. Una sola vibración por evento, sin duplicar.
          const cambioEstado = datos.estado !== prev.estado;
          const llegoMensaje = Boolean(datos.mensaje);
          if ((cambioEstado || llegoMensaje) && navigator.vibrate) {
            navigator.vibrate(400);
          }
          return {
            estado: datos.estado,
            mensaje: datos.mensaje,
            de: datos.de || "DIRECTOR",
          };
        });

        // Configurar auto-respuesta inteligente basándose en la procedencia del mensaje
        if (datos.de === "PASTOR") setResponderA("Pastor");
        else if (datos.de === "LÍDER") setResponderA("Lider");
        else setResponderA("Director");
      }
    });

    // Escuchar mensajes generales de Pastor y Líder dirigidos a esta cámara
    socket.on("recibir_mensaje_general", (datos) => {
      // Validar que el mensaje venga para esta cámara específica
      const destinatarios = Array.isArray(datos.destinatarios)
        ? datos.destinatarios
        : [];
      const esParaMi =
        destinatarios.includes(`C${numero}`) || destinatarios.includes(numero);

      // Si es para mí, mostrar en el banner
      if (esParaMi && datos.mensaje) {
        setTally((prev) => ({
          ...prev,
          mensaje: datos.mensaje,
          de: datos.de || "DESCONOCIDO",
        }));

        // Configurar auto-respuesta inteligente
        if (datos.de === "Pastor") setResponderA("Pastor");
        else if (datos.de === "Lider") setResponderA("Lider");
        else setResponderA("Director");

        if (navigator.vibrate) {
          navigator.vibrate(400);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [numero]);

  const enviarMensaje = (texto) => {
    if (!texto || !texto.trim()) return;
    if (socketRef.current) {
      // Mandamos la orden adjuntando el remitente de respuesta específico
      socketRef.current.emit("enviar_mensaje_camara", {
        camara: numero,
        texto: texto.trim(),
        destino: responderA,
      });

      // Si va dirigido a Pastor o Líder lo inyectamos también por el bus general interconectado
      if (responderA === "Pastor" || responderA === "Lider") {
        socketRef.current.emit("enviar_mensaje_a_pastor", {
          de: `Camara ${numero}`,
          texto: `Respuesta a ${responderA}: ${texto.trim()}`,
          destinatarios: [responderA],
          id: Date.now(),
        });
      }
    }
    setConfirmacion(`Enviado a ${responderA} ✓`);
    setTimeout(() => setConfirmacion(""), 2000);
  };

  const getFondoColor = () => {
    if (tally.estado === "live") return "#ff0000";
    if (tally.estado === "preview") return "#00cc44";
    return "#1a1a1a";
  };

  return (
    <div style={{ ...styles.viewport, backgroundColor: getFondoColor() }}>
      <div style={styles.headerArea}>
        <div style={styles.confirmacionEnvio}>{confirmacion}</div>
        <button style={styles.btnSalir} onClick={alSalir}>
          ✕ SALIR
        </button>
      </div>

      <div style={styles.mainTallyArea}>
        <h1 style={styles.camLabel}>CAM {numero}</h1>
        <h2 style={styles.estadoLabel}>
          {tally.estado === "live"
            ? "¡AL AIRE!"
            : tally.estado === "preview"
              ? "PREVIO"
              : "ESPERA"}
        </h2>
      </div>

      {tally.mensaje && (
        <div style={styles.bannerMensaje}>
          <div style={styles.marqueeText}>
            <span style={{ color: "#ffcc00", fontWeight: "900" }}>
              {tally.de}:{" "}
            </span>
            {tally.mensaje}
          </div>
          <button
            onClick={() => setTally((prev) => ({ ...prev, mensaje: "" }))}
            style={styles.btnCerrarBanner}
          >
            ✕
          </button>
        </div>
      )}

      {/* PANEL DE RESPUESTA INTERACTIVO */}
      <div style={styles.panelEnvio}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "#aaa", fontSize: "0.8rem" }}>
            Responder a:
          </span>
          <select
            value={responderA}
            onChange={(e) => setResponderA(e.target.value)}
            style={styles.selectorDestino}
          >
            <option value="Director">Director</option>
            <option value="Pastor">Pastor</option>
            <option value="Lider">Líder</option>
          </select>
        </div>

        <div style={styles.gridMensajesRapidos}>
          {MENSAJES_RAPIDOS_CAMARA.map((txt) => (
            <button
              key={txt}
              onClick={() => enviarMensaje(txt)}
              style={styles.btnMensajeRapido}
            >
              {txt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviarMensaje(textoLibre);
            setTextoLibre("");
          }}
          style={{ display: "flex", gap: "5px" }}
        >
          <input
            type="text"
            placeholder={`Responder a ${responderA}...`}
            value={textoLibre}
            onChange={(e) => setTextoLibre(e.target.value)}
            style={styles.inputLibre}
          />
          <button type="submit" style={styles.btnEnviarLibre}>
            🛩️
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  viewport: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "12px",
    boxSizing: "border-box",
    fontFamily: "sans-serif",
    color: "#fff",
  },
  headerArea: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmacionEnvio: {
    color: "#00ffcc",
    fontWeight: "bold",
    fontSize: "0.9rem",
  },
  btnSalir: {
    backgroundColor: "rgba(255,255,255,0.15)",
    border: "none",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  mainTallyArea: {
    textAlign: "center",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  camLabel: {
    fontSize: "clamp(3.5rem, 15vh, 6rem)",
    margin: 0,
    fontWeight: "900",
    letterSpacing: "-1px",
  },
  estadoLabel: {
    fontSize: "clamp(1.2rem, 5vh, 2.2rem)",
    margin: "5px 0 0 0",
    opacity: 0.85,
    fontWeight: "bold",
  },
  bannerMensaje: {
    backgroundColor: "#7a0000",
    border: "2px solid #ffcc00",
    borderRadius: "8px",
    padding: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  marqueeText: {
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: "bold",
    flex: 1,
  },
  btnCerrarBanner: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "1.1rem",
    cursor: "pointer",
  },
  panelEnvio: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: "12px",
    padding: "12px",
    border: "1px solid #333",
  },
  selectorDestino: {
    backgroundColor: "#222",
    color: "#fff",
    border: "1px solid #444",
    padding: "4px 8px",
    borderRadius: "4px",
  },
  gridMensajesRapidos: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
    marginBottom: "8px",
  },
  btnMensajeRapido: {
    padding: "12px 4px",
    backgroundColor: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.85rem",
  },
  inputLibre: {
    flex: 1,
    backgroundColor: "#111",
    border: "1px solid #444",
    color: "#fff",
    padding: "10px",
    borderRadius: "6px",
    outline: "none",
  },
  btnEnviarLibre: {
    backgroundColor: "#0052cc",
    border: "none",
    color: "#fff",
    padding: "0 16px",
    borderRadius: "6px",
    cursor: "pointer",
  },
};
