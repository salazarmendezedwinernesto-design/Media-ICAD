import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
import BarraTransmision from "./BarraTransmision";
import EnlaceExterno from "./EnlaceExterno";
import EnlaceReunion from "./EnlaceReunion";
import {
  IconCheck,
  IconBateria,
  IconMano,
  IconOreja,
  IconMensajeBurbuja,
  IconChevronAbajo,
  IconX,
} from "./icons";

const SOCKET_URL = SERVER_URL;

const MENSAJES_RAPIDOS_CAMARA = [
  { texto: "LIST@", Icono: IconCheck, color: "#3ddc84" },
  { texto: "BATERÍA BAJA", Icono: IconBateria, color: "#ffcc00" },
  { texto: "AYUDA", Icono: IconMano, color: "#ff5555" },
  { texto: "NO TE ESCUCHO BIEN", Icono: IconOreja, color: "#9aa0a6" },
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
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [bateria, setBateria] = useState(null);

  // Animacion del banner de mensaje: "entrando" | "visible" | "saliendo" | null
  const [bannerAnim, setBannerAnim] = useState(null);
  const bannerTimeoutRef = useRef(null);

  const socketRef = useRef(null);
  const touchStartYRef = useRef(null);

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

  // Lectura best-effort de la batería del celular (Chrome/Android). Si el
  // navegador no soporta la API (iOS Safari, Firefox, etc.) simplemente no
  // se muestra el indicador.
  useEffect(() => {
    let bateriaRef = null;
    let activo = true;

    const actualizar = () => {
      if (bateriaRef && activo) {
        setBateria(Math.round(bateriaRef.level * 100));
      }
    };

    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        if (!activo) return;
        bateriaRef = b;
        actualizar();
        b.addEventListener("levelchange", actualizar);
      });
    }

    return () => {
      activo = false;
      if (bateriaRef) bateriaRef.removeEventListener("levelchange", actualizar);
    };
  }, []);

  // Dispara la animación de entrada cuando llega un mensaje nuevo, y deja
  // el estado en "visible" una vez que termina la transición de entrada.
  useEffect(() => {
    if (tally.mensaje) {
      clearTimeout(bannerTimeoutRef.current);
      setBannerAnim("entrando");
      bannerTimeoutRef.current = setTimeout(() => {
        setBannerAnim("visible");
      }, 350);
    } else {
      setBannerAnim(null);
    }
    return () => clearTimeout(bannerTimeoutRef.current);
  }, [tally.mensaje]);

  const cerrarBanner = () => {
    setBannerAnim("saliendo");
    clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => {
      setTally((prev) => ({ ...prev, mensaje: "" }));
    }, 280);
  };

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

  // Gestos para deslizar el panel hacia arriba (abrir) o hacia abajo (cerrar)
  // desde el tirador. Un tap simple sobre el tirador también alterna.
  const alTocarTirador = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
  };
  const alSoltarTirador = (e) => {
    if (touchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartYRef.current = null;
    if (deltaY > 25)
      setPanelAbierto(false); // deslizó hacia abajo
    else if (deltaY < -25)
      setPanelAbierto(true); // deslizó hacia arriba
    else setPanelAbierto((prev) => !prev); // fue un tap
  };

  const getFondoColor = () => {
    if (tally.estado === "live") return "#c0182b";
    if (tally.estado === "preview") return "#0e9f6e";
    return "#17181c";
  };

  const getEstadoTexto = () => {
    if (tally.estado === "live") return "AL AIRE";
    if (tally.estado === "preview") return "PREVIO";
    return "ESPERA";
  };

  return (
    <div style={{ ...styles.viewport, backgroundColor: getFondoColor() }}>
      <style>{`
        @keyframes entradaBanner {
          from { opacity: 0; transform: translateY(-14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes salidaBanner {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-14px); }
        }
        @keyframes pulsoEnVivo {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        .banner-entrando { animation: entradaBanner 0.32s ease-out both; }
        .banner-saliendo { animation: salidaBanner 0.26s ease-in both; }
        .punto-estado-vivo { animation: pulsoEnVivo 1.4s infinite ease-in-out; }
        .panel-camara {
          transition: max-height 0.32s ease, opacity 0.28s ease;
          overflow: hidden;
        }
        .selector-destino-camara {
          appearance: none;
          -webkit-appearance: none;
        }
      `}</style>

      <div style={styles.headerArea}>
        <span style={styles.camLabelChico}>CAM {numero}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {confirmacion && (
            <span style={styles.confirmacionEnvio}>{confirmacion}</span>
          )}
          {bateria !== null && (
            <span style={styles.bateriaChip}>
              <IconBateria size={14} color="rgba(255,255,255,0.85)" />
              {bateria}%
            </span>
          )}
          <button style={styles.btnSalir} onClick={alSalir}>
            <IconX size={14} color="#fff" />
          </button>
        </div>
      </div>

      <BarraTransmision posicion="abajo" variante="compacta" />
      <EnlaceExterno />
      <EnlaceReunion />

      <div style={styles.mainTallyArea}>
        <span
          className={tally.estado === "live" ? "punto-estado-vivo" : ""}
          style={styles.puntoEstado}
        />
        <h1 style={styles.estadoLabel}>{getEstadoTexto()}</h1>
        <p style={styles.subtituloEstado}>
          Cámara {numero} · {tally.de}
        </p>
      </div>

      {tally.mensaje && (
        <div
          className={
            bannerAnim === "entrando"
              ? "banner-entrando"
              : bannerAnim === "saliendo"
                ? "banner-saliendo"
                : ""
          }
          style={styles.bannerMensaje}
        >
          <IconMensajeBurbuja size={18} color="#ffcc00" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.bannerDe}>{tally.de}</div>
            <div style={styles.bannerTexto}>{tally.mensaje}</div>
          </div>
          <button onClick={cerrarBanner} style={styles.btnCerrarBanner}>
            <IconX size={14} color="rgba(255,255,255,0.7)" />
          </button>
        </div>
      )}

      {/* PANEL DE RESPUESTA DESPLEGABLE */}
      <div
        className="panel-camara"
        style={{
          ...styles.panelEnvio,
          maxHeight: panelAbierto ? "420px" : "34px",
          opacity: panelAbierto ? 1 : 0.9,
        }}
      >
        <div
          style={styles.tirador}
          onClick={() => setPanelAbierto((prev) => !prev)}
          onTouchStart={alTocarTirador}
          onTouchEnd={alSoltarTirador}
        >
          <span style={styles.tiradorBarra} />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <span style={{ color: "#aaa", fontSize: "0.8rem" }}>Responder a</span>
          <div style={styles.selectorWrap}>
            <select
              value={responderA}
              onChange={(e) => setResponderA(e.target.value)}
              className="selector-destino-camara"
              style={styles.selectorDestino}
            >
              <option value="Director">Director</option>
              <option value="Pastor">Pastor</option>
              <option value="Lider">Líder</option>
            </select>
            <IconChevronAbajo size={13} color="#fff" />
          </div>
        </div>

        <div style={styles.gridMensajesRapidos}>
          {MENSAJES_RAPIDOS_CAMARA.map(({ texto, Icono, color }) => (
            <button
              key={texto}
              onClick={() => enviarMensaje(texto)}
              style={styles.btnMensajeRapido}
            >
              <Icono size={16} color={color} />
              <span>{texto}</span>
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
            ➤
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
  camLabelChico: {
    fontSize: "0.8rem",
    fontWeight: "700",
    letterSpacing: "0.5px",
    color: "rgba(255,255,255,0.8)",
  },
  confirmacionEnvio: {
    color: "#00ffcc",
    fontWeight: "bold",
    fontSize: "0.8rem",
  },
  bateriaChip: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "0.75rem",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  btnSalir: {
    backgroundColor: "rgba(255,255,255,0.15)",
    border: "none",
    color: "#fff",
    padding: "8px",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mainTallyArea: {
    textAlign: "center",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  puntoEstado: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#fff",
    display: "inline-block",
    marginBottom: "12px",
  },
  estadoLabel: {
    fontSize: "clamp(2rem, 10vh, 3.4rem)",
    margin: 0,
    fontWeight: "700",
    letterSpacing: "-0.5px",
  },
  subtituloEstado: {
    fontSize: "0.85rem",
    margin: "6px 0 0 0",
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  bannerMensaje: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "8px",
  },
  bannerDe: {
    color: "#ffcc00",
    fontWeight: "700",
    fontSize: "0.7rem",
    letterSpacing: "0.4px",
  },
  bannerTexto: {
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: "500",
    lineHeight: 1.35,
    marginTop: "2px",
  },
  btnCerrarBanner: {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    padding: "2px",
  },
  panelEnvio: {
    backgroundColor: "rgba(20, 20, 22, 0.92)",
    borderRadius: "20px 20px 0 0",
    padding: "0 14px 14px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderBottom: "none",
  },
  tirador: {
    display: "flex",
    justifyContent: "center",
    padding: "10px 0 12px",
    cursor: "pointer",
    touchAction: "none",
  },
  tiradorBarra: {
    width: "36px",
    height: "4px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  selectorWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#26262a",
    padding: "5px 10px",
    borderRadius: "999px",
  },
  selectorDestino: {
    backgroundColor: "transparent",
    color: "#fff",
    border: "none",
    fontSize: "0.8rem",
    fontWeight: "600",
    cursor: "pointer",
    outline: "none",
  },
  gridMensajesRapidos: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginBottom: "10px",
  },
  btnMensajeRapido: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 8px",
    backgroundColor: "#212124",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.75rem",
    textAlign: "left",
  },
  inputLibre: {
    flex: 1,
    backgroundColor: "#1a1a1c",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: "10px",
    outline: "none",
  },
  btnEnviarLibre: {
    backgroundColor: "#0052cc",
    border: "none",
    color: "#fff",
    padding: "0 16px",
    borderRadius: "10px",
    cursor: "pointer",
  },
};
