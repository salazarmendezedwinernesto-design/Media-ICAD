import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./auth";

const SOCKET_URL = SERVER_URL;

// Al inicio del archivo Pastor.jsx actualiza la lista estática:
const LISTA_DESTINATARIOS = [
  "Director",
  "Lider", // Agregado como objetivo de mensajería para el Pastor
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "Pantalla",
];

// Sección 2A: Botones de frases rápidas predefinidas
const FRASES_PREDEFINIDAS = [
  "IR ACABANDO",
  "CONCLUIR ORACIÓN",
  "PONER VERSÍCULO",
  "SUBIR MÚSICA",
  "CAMBIO DE SECCIÓN",
  "ORACIÓN FINAL",
];

export default function Pastor({ alSalir }) {
  const [destinatarios, setDestinatarios] = useState([]);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [mensajesRecibidos, setMensajesRecibidos] = useState([]);
  const [confirmacion, setConfirmacion] = useState("");

  // Estado inicializado explícitamente para evitar pantallas en blanco antes de conectar con el servidor
  const [estadosCamaras, setEstadosCamaras] = useState({
    1: "standby",
    2: "standby",
    3: "standby",
    4: "standby",
    5: "standby",
    6: "standby",
  });

  // Estado para controlar si el último mensaje debe parpadear
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

    // Escuchar mensajes entrantes destinados al Pastor
    socket.on("recibir_mensaje_pastor", (datos) => {
      if (!datos) return;

      // FILTRO DE SEGURIDAD: Si el mensaje lo envió un "Pastor", lo ignoramos aquí.
      // Únicamente permitiremos que entren mensajes de Pantalla o Director.
      if (datos.de === "Pastor") {
        return; // Detiene la función para que no se guarde en la bandeja del Pastor
      }

      setMensajesRecibidos((prev) => [datos, ...prev]);

      // Activar parpadeo y reiniciar el temporizador para apagarlo tras 8 segundos
      setPermitirParpadeo(true);
      if (temporizadorParpadeoRef.current)
        clearTimeout(temporizadorParpadeoRef.current);

      temporizadorParpadeoRef.current = setTimeout(() => {
        setPermitirParpadeo(false);
      }, 8000);

      // Hacer vibrar el dispositivo móvil cuando llega un mensaje nuevo
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    });

    // Escuchar el estado de Tally de las cámaras para saber en cuál están o a cuál van
    socket.on("recibir_orden_camara", (datos) => {
      // Validación estricta para evitar que valores nulos rompan la interfaz
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

  const seleccionarTodos = () => {
    setDestinatarios((prev) =>
      prev.length === LISTA_DESTINATARIOS.length
        ? []
        : [...LISTA_DESTINATARIOS],
    );
  };

  // Función unificada de envío centralizado (CORREGIDA PARA EL SERVIDOR)
  const enviarMensajeSocket = (textoAEnviar) => {
    if (!textoAEnviar || !textoAEnviar.trim() || !socketRef.current) return;

    // Si no hay destinatario seleccionado, no se envía nada
    if (destinatarios.length === 0) {
      setConfirmacion("⚠️ Selecciona un destinatario primero");
      setTimeout(() => setConfirmacion(""), 2500);
      return;
    }

    // Se cambia al evento y la estructura exacta que el servidor unificado espera procesar
    socketRef.current.emit("enviar_mensaje_a_pastor", {
      de: "Pastor",
      texto: textoAEnviar.trim(),
      destinatarios: destinatarios,
      id: Date.now(),
    });

    setConfirmacion("Enviado ✓");
    setTimeout(() => setConfirmacion(""), 2000);
  };

  // Manejador Sección 2A: Frases rápidas
  const manejarEnvioFraseRapida = (frase) => {
    enviarMensajeSocket(frase);
  };

  // Manejador Sección 2B: Mensaje personalizado libre
  const manejarEnvioTextoLibre = (e) => {
    e.preventDefault();
    if (!textoMensaje.trim()) return;
    enviarMensajeSocket(textoMensaje);
    setTextoMensaje("");
  };

  const borrarMensajeManual = (idParaBorrar) => {
    setMensajesRecibidos((prev) =>
      prev.filter((msg) => msg.id !== idParaBorrar),
    );
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes parpadeoAlertaPastorBuzon {
          0% { background-color: rgba(255, 51, 51, 0.3); box-shadow: 0 0 4px #ff3333; }
          50% { background-color: rgba(255, 51, 51, 0.6); box-shadow: 0 0 16px #ff3333; border-color: #ffffff; }
          100% { background-color: rgba(255, 51, 51, 0.3); box-shadow: 0 0 4px #ff3333; }
        }
        .alerta-activa-buzon-pastor {
          animation: parpadeoAlertaPastorBuzon 0.8s infinite ease-in-out;
        }
      `}</style>

      <header style={styles.navbar}>
        <button style={styles.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={styles.navTitle}>⛪ PANEL DEL PASTOR</h1>
        <div style={styles.confirmacion}>{confirmacion}</div>
      </header>

      <div style={styles.layoutPrincipal}>
        {/* MONITOR DE ESTADO DE CÁMARAS */}
        <div style={styles.seccionCard}>
          <h3 style={styles.tituloSeccion}>
            🎥 MONITOR EN VIVO: RETORNO DE CÁMARAS
          </h3>
          <div style={styles.gridMonitorCamaras}>
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const estado = estadosCamaras[num] || "standby";
              let fondoCam = "#2a2a2a";
              let textoEstado = "ESPERA";

              if (estado === "live") {
                fondoCam = "#ff3333";
                textoEstado = "VIVO";
              } else if (estado === "preview") {
                fondoCam = "#00cc66";
                textoEstado = "PREVIO";
              }

              return (
                <div
                  key={num}
                  style={{ ...styles.cardMonitor, backgroundColor: fondoCam }}
                >
                  <span style={styles.cardMonitorNum}>C{num}</span>
                  <span style={styles.cardMonitorEstado}>{textoEstado}</span>
                </div>
              );
            })}
          </div>
          {/* Instrucciones explicativas del significado de colores */}
          <div style={styles.instruccionesColores}>
            <div style={styles.instruccionItem}>
              <span
                style={{ ...styles.dotInstruccion, backgroundColor: "#ff3333" }}
              />{" "}
              &nbsp;<b>Rojo (VIVO):</b>
            </div>
            <div style={styles.instruccionItem}>
              <span
                style={{ ...styles.dotInstruccion, backgroundColor: "#00cc66" }}
              />{" "}
              &nbsp;<b>Verde (PREVIO):</b>
            </div>
            <div style={styles.instruccionItem}>
              <span
                style={{ ...styles.dotInstruccion, backgroundColor: "#2a2a2a" }}
              />{" "}
              &nbsp;<b>Gris (ESPERA):</b>
            </div>
          </div>
        </div>

        {/* SELECTOR DE DESTINATARIOS */}
        <div style={styles.seccionCard}>
          <h3 style={styles.tituloSeccion}>
            🎯 1. Seleccionar Destinatario(s)
          </h3>
          <button style={styles.btnLimpiarAlertas} onClick={seleccionarTodos}>
            {destinatarios.length === LISTA_DESTINATARIOS.length
              ? "✕ Deseleccionar Todo"
              : "✓ Enviar a Todos Global"}
          </button>

          <div style={styles.gridDestinatarios}>
            {LISTA_DESTINATARIOS.map((dest) => {
              const activo = destinatarios.includes(dest);
              return (
                <button
                  key={dest}
                  onClick={() => toggleDestinatario(dest)}
                  style={{
                    ...styles.btnAlertaRapida,
                    backgroundColor: activo ? "#7b1fa2" : "#2a2a2a",
                    borderColor: activo ? "#ff3333" : "#3a3a3a",
                  }}
                >
                  {activo ? "✓ " : ""}
                  {dest}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN DE ENVÍO 2A: FRASES RÁPIDAS PREDEFINIDAS */}
        <div style={styles.seccionCard}>
          <h3 style={styles.tituloSeccion}>
            ⚡ 2A. Envío Inmediato (Frases Predefinidas)
          </h3>
          <div style={styles.gridFrasesRapidas}>
            {FRASES_PREDEFINIDAS.map((frase) => (
              <button
                key={frase}
                onClick={() => manejarEnvioFraseRapida(frase)}
                disabled={destinatarios.length === 0}
                style={{
                  ...styles.btnFraseFija,
                  opacity: destinatarios.length === 0 ? 0.4 : 1,
                  cursor:
                    destinatarios.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {frase}
              </button>
            ))}
          </div>
        </div>

        {/* SECCIÓN DE ENVÍO 2B: MENSAJE LIBRE / PERSONALIZADO */}
        <div style={styles.seccionCard}>
          <h3 style={styles.tituloSeccion}>
            ✍️ 2B. Envío Mensaje Personalizado (Libre)
          </h3>
          <form
            onSubmit={manejarEnvioTextoLibre}
            style={styles.formMensajeGeneral}
          >
            <input
              type="text"
              value={textoMensaje}
              onChange={(e) => setTextoMensaje(e.target.value)}
              placeholder={
                destinatarios.length === 0
                  ? "⚠️ Selecciona un destinatario primero"
                  : "Escribe un aviso específico aquí..."
              }
              disabled={destinatarios.length === 0}
              style={styles.inputMensajeGeneral}
            />
            <button
              type="submit"
              disabled={destinatarios.length === 0 || !textoMensaje.trim()}
              style={{
                ...styles.btnEnviarGeneral,
                backgroundColor: "#7b1fa2",
                opacity:
                  destinatarios.length === 0 || !textoMensaje.trim()
                    ? 0.4
                    : 1,
                cursor:
                  destinatarios.length === 0 || !textoMensaje.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              ENVIAR MENSAJE PERSONALIZADO
            </button>
          </form>
        </div>

        {/* BUZÓN DE ENTRADA CON TIEMPO DE PARPADEO */}
        <div style={styles.seccionCard}>
          <h3 style={styles.tituloSeccion}>📥 Mensajes Recibidos en Púlpito</h3>
          {mensajesRecibidos.length === 0 ? (
            <p
              style={{
                color: "#666",
                textAlign: "center",
                fontSize: "0.85rem",
                margin: "10px 0",
              }}
            >
              Sin mensajes entrantes del control.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {mensajesRecibidos.map((msg, idx) => {
                const esUltimoMensaje = idx === 0;
                const aplicarAnimacion = esUltimoMensaje && permitirParpadeo;

                // Formatear el remitente de forma amigable según su valor de origen
                const remitenteMinuscula = msg.de ? msg.de.toLowerCase() : "";
                let etiquetaRemitente = msg.de;

                if (remitenteMinuscula === "pastor") {
                  etiquetaRemitente = "👨‍💻 Pastor";
                } else if (remitenteMinuscula === "pantalla") {
                  etiquetaRemitente = "🖥️ Pantalla";
                }

                return (
                  <div
                    key={msg.id}
                    className={
                      aplicarAnimacion ? "alerta-activa-buzon-pastor" : ""
                    }
                    style={
                      esUltimoMensaje
                        ? {
                            ...styles.mensajeItemAlerta,
                            border: permitirParpadeo
                              ? "2px solid #ff3333"
                              : "2px solid #444",
                          }
                        : styles.mensajeItem
                    }
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#ff3333",
                          fontWeight: "900",
                        }}
                      >
                        {esUltimoMensaje && permitirParpadeo
                          ? "🚨 NUEVO DE: "
                          : "De: "}
                        {etiquetaRemitente}
                      </span>
                      <p
                        style={{
                          margin: "2px 0 0 0",
                          fontSize: "1rem",
                          color: "#fff",
                          fontWeight: "600",
                        }}
                      >
                        {msg.texto}
                      </p>
                    </div>
                    <button
                      style={styles.btnCerrarMensajeCamara}
                      onClick={() => borrarMensajeManual(msg.id)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#141414",
    color: "#fff",
    minHeight: "100vh",
    padding: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    boxSizing: "border-box",
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #2d2d2d",
    paddingBottom: "10px",
    marginBottom: "12px",
  },
  btnVolver: {
    backgroundColor: "#2d2d2d",
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
    letterSpacing: "0.5px",
  },
  confirmacion: { color: "#00ff88", fontWeight: "bold", fontSize: "0.9rem" },
  layoutPrincipal: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "500px",
    margin: "0 auto",
  },
  seccionCard: {
    backgroundColor: "#1e1e1e",
    border: "1px solid #2d2d2d",
    borderRadius: "8px",
    padding: "12px",
  },
  tituloSeccion: {
    margin: "0 0 10px 0",
    fontSize: "0.85rem",
    fontWeight: "bold",
    color: "#aaa",
    borderBottom: "1px solid #2d2d2d",
    paddingBottom: "4px",
    letterSpacing: "0.5px",
  },
  gridMonitorCamaras: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
    marginBottom: "10px",
  },
  cardMonitor: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 4px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  cardMonitorNum: {
    fontSize: "1.2rem",
    fontWeight: "900",
    color: "#fff",
  },
  cardMonitorEstado: {
    fontSize: "0.7rem",
    fontWeight: "700",
    opacity: 0.9,
    letterSpacing: "0.5px",
  },
  instruccionesColores: {
    backgroundColor: "#141414",
    borderRadius: "6px",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    border: "1px solid #2d2d2d",
  },
  instruccionItem: {
    fontSize: "0.75rem",
    color: "#ccc",
    display: "flex",
    alignItems: "center",
  },
  dotInstruccion: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
    marginRight: "6px",
  },
  gridDestinatarios: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "6px",
    marginBottom: "4px",
  },
  btnAlertaRapida: {
    color: "#fff",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
    padding: "8px 4px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    cursor: "pointer",
    textTransform: "capitalize",
  },
  btnLimpiarAlertas: {
    width: "100%",
    backgroundColor: "#333",
    color: "#fff",
    border: "1px solid #444",
    padding: "8px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: "bold",
    marginBottom: "8px",
  },
  gridFrasesRapidas: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  btnFraseFija: {
    backgroundColor: "#222",
    color: "#ffcc00",
    border: "1px solid #333",
    borderRadius: "6px",
    padding: "12px 6px",
    fontSize: "0.85rem",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "center",
  },
  formMensajeGeneral: { display: "flex", flexDirection: "column", gap: "6px" },
  inputMensajeGeneral: {
    borderRadius: "4px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#141414",
    color: "#fff",
    boxSizing: "border-box",
    width: "100%",
    padding: "10px",
    fontSize: "0.9rem",
    outline: "none",
  },
  btnEnviarGeneral: {
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
    padding: "10px",
    fontSize: "0.8rem",
    letterSpacing: "0.5px",
  },
  mensajeItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#141414",
    padding: "10px",
    borderRadius: "4px",
    borderLeft: "4px solid #7b1fa2",
  },
  mensajeItemAlerta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(123, 31, 162, 0.15)",
    padding: "10px",
    borderRadius: "4px",
  },
  btnCerrarMensajeCamara: {
    backgroundColor: "transparent",
    color: "#ff4d4d",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1rem",
    padding: "0 8px",
  },
};
