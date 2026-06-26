import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";

const SALAS = ["1", "2", "3", "4", "5"];

// STUN público de Google: ayuda a dos dispositivos a encontrarse a través
// de NAT/routers domésticos. Si tu red (ej. wifi de iglesia con firewall
// estricto) bloquea la conexión directa, agrega aquí un servidor TURN
// propio o de un proveedor (Twilio, Metered, coturn propio) como respaldo.
// Sin TURN, en redes muy restrictivas la llamada podría no lograr conectar.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // { urls: "turn:tu-servidor-turn.com:3478", username: "user", credential: "pass" },
];

/**
 * Panel de sala de audio (walkie-talkie por WebRTC), reutilizable desde
 * cualquier rol (Director, Camara, Pastor, Lider, Pantalla).
 *
 * - El audio viaja DIRECTO entre dispositivos (peer-to-peer / WebRTC),
 *   nunca pasa por nuestro servidor, así la latencia se mantiene mínima.
 * - El servidor (Socket.IO) solo "presenta" a los dispositivos entre sí
 *   (signaling): ofertas/respuestas SDP, candidatos ICE, lista de la sala.
 * - Push-to-talk: mantener presionado para hablar; la conexión queda
 *   siempre abierta, solo se habilita/deshabilita la pista de audio local
 *   (cero retraso al presionar, sin reconexiones).
 *
 * Props:
 *  - rolEtiqueta: de dónde entra la persona, ej. "Cámara 1", "Pastor",
 *    "Líder", "Director", "Pantalla". Se muestra junto al nombre.
 *  - esDirector: si es true, puede tocar a otros para marcarlos en vivo
 *    (verde) dentro de la sala. Solo uno a la vez.
 *  - alSalir: callback para cerrar este panel y volver al rol.
 */
export default function SalaAudio({
  rolEtiqueta,
  esDirector = false,
  alSalir,
}) {
  const [sala, setSala] = useState(null); // "1".."5" o null = pantalla de selección
  const [nombre, setNombre] = useState("");
  const [conectado, setConectado] = useState(false);
  const [miembros, setMiembros] = useState([]); // [{socketId, nombre, rol}]
  const [miSocketId, setMiSocketId] = useState(null);
  const [liveSocketId, setLiveSocketId] = useState(null);
  const [hablando, setHablando] = useState(false);
  const [micPermitido, setMicPermitido] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const audiosRef = useRef({}); // { socketId: <audio> element }

  const cerrarPeer = (socketId) => {
    const pc = peersRef.current[socketId];
    if (pc) {
      pc.close();
      delete peersRef.current[socketId];
    }
    const audioEl = audiosRef.current[socketId];
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      delete audiosRef.current[socketId];
    }
  };

  const cerrarTodosLosPeers = () => {
    Object.keys(peersRef.current).forEach(cerrarPeer);
  };

  const obtenerOCrearPeer = (otroSocketId) => {
    if (peersRef.current[otroSocketId]) return peersRef.current[otroSocketId];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (evento) => {
      if (evento.candidate && socketRef.current) {
        socketRef.current.emit("audio:senal", {
          paraSocketId: otroSocketId,
          tipo: "ice",
          payload: evento.candidate,
        });
      }
    };

    pc.ontrack = (evento) => {
      let audioEl = audiosRef.current[otroSocketId];
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        document.body.appendChild(audioEl);
        audiosRef.current[otroSocketId] = audioEl;
      }
      audioEl.srcObject = evento.streams[0];
    };

    peersRef.current[otroSocketId] = pc;
    return pc;
  };

  const iniciarOfertaHacia = async (otroSocketId) => {
    const pc = obtenerOCrearPeer(otroSocketId);
    try {
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      socketRef.current.emit("audio:senal", {
        paraSocketId: otroSocketId,
        tipo: "oferta",
        payload: oferta,
      });
    } catch (e) {
      console.error("Error creando oferta WebRTC:", e);
    }
  };

  const entrarASala = async (numeroSala) => {
    setError("");
    setConectando(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Arranca muteado: el push-to-talk activa la pista solo al presionar.
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      localStreamRef.current = stream;
      setMicPermitido(true);
    } catch (e) {
      console.error("No se pudo acceder al micrófono:", e);
      setMicPermitido(false);
      setConectando(false);
      setError(
        "No se pudo acceder al micrófono. Revisá los permisos del navegador e intentá de nuevo.",
      );
      return;
    }

    const socket = io(SERVER_URL, { auth: { token: obtenerToken() } });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      if (err && err.message === "No autorizado") {
        borrarToken();
        window.location.reload();
      } else {
        setError("No se pudo conectar al servidor de audio.");
        setConectando(false);
      }
    });

    socket.on("audio:estado_sala", (datos) => {
      setMiSocketId(datos.socketId);
      setLiveSocketId(datos.liveSocketId || null);
      datos.participantes.forEach((p) => iniciarOfertaHacia(p.socketId));
      setConectando(false);
      setSala(numeroSala);
      setConectado(true);
    });

    socket.on("audio:lista_sala", (datos) => {
      setMiembros(datos.miembros);
    });

    socket.on("audio:participante_salio", (datos) => {
      cerrarPeer(datos.socketId);
    });

    socket.on("audio:live_actualizado", (datos) => {
      setLiveSocketId(datos.liveSocketId || null);
    });

    socket.on("audio:senal", async (datos) => {
      const { deSocketId, tipo, payload } = datos;
      const pc = obtenerOCrearPeer(deSocketId);

      try {
        if (tipo === "oferta") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const respuesta = await pc.createAnswer();
          await pc.setLocalDescription(respuesta);
          socket.emit("audio:senal", {
            paraSocketId: deSocketId,
            tipo: "respuesta",
            payload: respuesta,
          });
        } else if (tipo === "respuesta") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (tipo === "ice") {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        }
      } catch (e) {
        console.error("Error procesando señal WebRTC:", e);
      }
    });

    socket.emit("audio:unirse", {
      sala: numeroSala,
      nombre: nombre.trim() || "Sin nombre",
      rol: rolEtiqueta,
    });
  };

  const salirDeSala = () => {
    if (socketRef.current) {
      socketRef.current.emit("audio:salir");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    cerrarTodosLosPeers();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setSala(null);
    setConectado(false);
    setMiembros([]);
    setLiveSocketId(null);
    setHablando(false);
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("audio:salir");
        socketRef.current.disconnect();
      }
      cerrarTodosLosPeers();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empezarAHablar = () => {
    if (!micPermitido || !localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
    setHablando(true);
  };

  const dejarDeHablar = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
    setHablando(false);
  };

  const marcarEnVivo = (socketId) => {
    if (!socketRef.current || !sala) return;
    const nuevoLive = liveSocketId === socketId ? null : socketId;
    socketRef.current.emit("audio:marcar_live", { sala, socketId: nuevoLive });
  };

  if (!conectado) {
    return (
      <div style={styles.contenedor}>
        <div style={styles.fondoDecorativo} />

        <div style={styles.headerArea}>
          <div style={styles.headerTextos}>
            <span style={styles.iconoGrande}>🎙️</span>
            <div>
              <h2 style={styles.titulo}>Sala de audio</h2>
              <p style={styles.subtitulo}>
                Comunicación en vivo, baja latencia
              </p>
            </div>
          </div>
          <button style={styles.btnSalirChico} onClick={alSalir}>
            ✕
          </button>
        </div>

        <div style={styles.tarjetaSetup}>
          <label style={styles.etiquetaCampo}>Tu nombre</label>
          <input
            type="text"
            placeholder="Ej. Gaby"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={styles.inputNombre}
            maxLength={24}
            disabled={conectando}
            autoFocus
          />

          <label style={styles.etiquetaCampo}>Elegí una sala</label>
          <div style={styles.gridSalas}>
            {SALAS.map((s) => (
              <button
                key={s}
                style={{
                  ...styles.btnSala,
                  opacity: !nombre.trim() || conectando ? 0.4 : 1,
                  cursor:
                    !nombre.trim() || conectando ? "not-allowed" : "pointer",
                }}
                disabled={!nombre.trim() || conectando}
                onClick={() => entrarASala(s)}
              >
                <span style={styles.btnSalaNumero}>{s}</span>
                <span style={styles.btnSalaTexto}>SALA</span>
              </button>
            ))}
          </div>

          {conectando && (
            <p style={styles.hintConectando}>
              <span style={styles.spinner} /> Conectando al micrófono y a la
              sala...
            </p>
          )}
          {!conectando && !nombre.trim() && (
            <p style={styles.hintNombre}>
              Escribí tu nombre para poder entrar.
            </p>
          )}
          {error && <p style={styles.textoError}>⚠ {error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.contenedor}>
      <div style={styles.fondoDecorativo} />

      <div style={styles.headerArea}>
        <div style={styles.headerTextos}>
          <span style={styles.iconoGrande}>🎙️</span>
          <div>
            <h2 style={styles.titulo}>Sala {sala}</h2>
            <p style={styles.subtitulo}>
              {miembros.length}{" "}
              {miembros.length === 1
                ? "persona conectada"
                : "personas conectadas"}
            </p>
          </div>
        </div>
        <button style={styles.btnSalirChico} onClick={salirDeSala}>
          ✕
        </button>
      </div>

      {error && <p style={styles.textoError}>⚠ {error}</p>}

      <div style={styles.listaMiembros}>
        {miembros.length === 0 && (
          <div style={styles.vacioListaCaja}>
            <span style={styles.vacioListaIcono}>👋</span>
            <p style={styles.vacioLista}>Esperando a que otros se unan...</p>
          </div>
        )}
        {miembros.map((m) => {
          const enVivo = liveSocketId === m.socketId;
          const soyYo = m.socketId === miSocketId;
          return (
            <div
              key={m.socketId}
              style={{
                ...styles.filaMiembro,
                ...(enVivo ? styles.filaMiembroEnVivo : {}),
                cursor: esDirector ? "pointer" : "default",
              }}
              onClick={() => esDirector && marcarEnVivo(m.socketId)}
            >
              <span style={styles.puntoEstado(enVivo)} />
              <span style={styles.etiquetaMiembro}>
                <strong style={styles.rolMiembro}>{m.rol}</strong>
                <span style={styles.separador}>·</span>
                <span style={styles.nombreMiembro}>{m.nombre}</span>
                {soyYo && <span style={styles.tagYo}>tú</span>}
              </span>
              {enVivo && <span style={styles.badgeLive}>● EN VIVO</span>}
            </div>
          );
        })}
      </div>

      {esDirector && miembros.length > 0 && (
        <p style={styles.hintDirector}>
          Tocá un nombre para marcarlo en vivo · Solo uno a la vez
        </p>
      )}

      {!micPermitido ? (
        <p style={styles.textoError}>
          ⚠ Sin acceso al micrófono. Revisá los permisos del navegador y volvé a
          entrar.
        </p>
      ) : (
        <button
          style={{
            ...styles.btnHablar,
            ...(hablando ? styles.btnHablarActivo : {}),
          }}
          onMouseDown={empezarAHablar}
          onMouseUp={dejarDeHablar}
          onMouseLeave={dejarDeHablar}
          onTouchStart={(e) => {
            e.preventDefault();
            empezarAHablar();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            dejarDeHablar();
          }}
        >
          <span style={styles.btnHablarIcono}>{hablando ? "🔴" : "🎤"}</span>
          {hablando ? "HABLANDO..." : "MANTENÉ PRESIONADO PARA HABLAR"}
        </button>
      )}
    </div>
  );
}

const styles = {
  contenedor: {
    backgroundColor: "#0a0a0f",
    backgroundImage:
      "radial-gradient(circle at 50% 0%, rgba(21, 101, 192, 0.12), transparent 60%)",
    color: "#fff",
    minHeight: "100vh",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  fondoDecorativo: {
    position: "absolute",
    top: "-120px",
    right: "-80px",
    width: "260px",
    height: "260px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(0, 200, 83, 0.10), transparent 70%)",
    pointerEvents: "none",
  },
  headerArea: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "22px",
    position: "relative",
    zIndex: 1,
  },
  headerTextos: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  iconoGrande: {
    fontSize: "1.8rem",
    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
  },
  titulo: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 800,
    letterSpacing: "0.2px",
  },
  subtitulo: {
    color: "#8a8f9a",
    fontSize: "0.82rem",
    margin: "2px 0 0 0",
  },
  btnSalirChico: {
    backgroundColor: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.95rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s ease",
    flexShrink: 0,
  },
  tarjetaSetup: {
    backgroundColor: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    position: "relative",
    zIndex: 1,
  },
  etiquetaCampo: {
    display: "block",
    color: "#9aa0ab",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: "8px",
  },
  inputNombre: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "#fff",
    fontSize: "1rem",
    boxSizing: "border-box",
    marginBottom: "20px",
    outline: "none",
  },
  gridSalas: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  btnSala: {
    padding: "18px 8px",
    backgroundColor: "rgba(21, 101, 192, 0.18)",
    backgroundImage:
      "linear-gradient(135deg, rgba(33, 150, 243, 0.25), rgba(21, 101, 192, 0.12))",
    color: "#fff",
    border: "1px solid rgba(33, 150, 243, 0.35)",
    borderRadius: "14px",
    fontSize: "1rem",
    fontWeight: "800",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    transition: "transform 0.1s ease",
  },
  btnSalaNumero: {
    fontSize: "1.6rem",
    lineHeight: 1,
  },
  btnSalaTexto: {
    fontSize: "0.65rem",
    letterSpacing: "1.5px",
    color: "#bcd6f5",
    fontWeight: 700,
  },
  hintConectando: {
    color: "#9ecbff",
    fontSize: "0.85rem",
    textAlign: "center",
    marginTop: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  spinner: {
    width: "12px",
    height: "12px",
    border: "2px solid rgba(158,203,255,0.3)",
    borderTopColor: "#9ecbff",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin-sala-audio 0.7s linear infinite",
  },
  hintNombre: {
    color: "#6b7280",
    fontSize: "0.8rem",
    textAlign: "center",
    marginTop: "14px",
  },
  textoError: {
    color: "#ff6b6b",
    fontSize: "0.85rem",
    fontWeight: "600",
    marginTop: "12px",
  },
  listaMiembros: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "18px",
    overflowY: "auto",
    position: "relative",
    zIndex: 1,
  },
  vacioListaCaja: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "40px 20px",
    color: "#666",
  },
  vacioListaIcono: { fontSize: "1.8rem", opacity: 0.6 },
  vacioLista: { color: "#6b7280", fontSize: "0.9rem", margin: 0 },
  filaMiembro: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    borderRadius: "14px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
  },
  filaMiembroEnVivo: {
    backgroundColor: "rgba(0, 200, 83, 0.12)",
    border: "1px solid rgba(0, 230, 118, 0.45)",
    boxShadow: "0 0 18px rgba(0, 200, 83, 0.15)",
  },
  puntoEstado: (enVivo) => ({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: enVivo ? "#00e676" : "#555",
    boxShadow: enVivo ? "0 0 10px rgba(0, 230, 118, 0.7)" : "none",
    flexShrink: 0,
  }),
  etiquetaMiembro: {
    flex: 1,
    fontSize: "0.95rem",
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    flexWrap: "wrap",
  },
  rolMiembro: { color: "#e8eaed", fontWeight: 700 },
  separador: { color: "#555" },
  nombreMiembro: { color: "#c7cbd1" },
  tagYo: {
    color: "#7aa2ff",
    fontSize: "0.7rem",
    fontWeight: 700,
    backgroundColor: "rgba(122, 162, 255, 0.15)",
    padding: "2px 7px",
    borderRadius: "999px",
    marginLeft: "2px",
  },
  badgeLive: {
    backgroundColor: "#00c853",
    color: "#04210f",
    fontSize: "0.68rem",
    fontWeight: "900",
    padding: "4px 9px",
    borderRadius: "999px",
    flexShrink: 0,
    letterSpacing: "0.3px",
  },
  hintDirector: {
    color: "#6b7280",
    fontSize: "0.78rem",
    textAlign: "center",
    marginBottom: "14px",
    position: "relative",
    zIndex: 1,
  },
  btnHablar: {
    width: "100%",
    padding: "20px",
    border: "1px solid rgba(33, 150, 243, 0.4)",
    borderRadius: "16px",
    backgroundColor: "#0d63d6",
    backgroundImage: "linear-gradient(135deg, #1976f3, #0d4fb0)",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: "800",
    cursor: "pointer",
    userSelect: "none",
    touchAction: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    letterSpacing: "0.3px",
    boxShadow: "0 8px 24px rgba(13, 99, 214, 0.35)",
    transition: "transform 0.08s ease, box-shadow 0.15s ease",
    position: "relative",
    zIndex: 1,
  },
  btnHablarActivo: {
    backgroundColor: "#c62828",
    backgroundImage: "linear-gradient(135deg, #e53935, #b71c1c)",
    boxShadow:
      "0 0 0 6px rgba(229, 57, 53, 0.18), 0 8px 24px rgba(183, 28, 28, 0.45)",
    transform: "scale(0.98)",
  },
  btnHablarIcono: {
    fontSize: "1.2rem",
  },
};

// Animación del spinner de "conectando" (única regla global que este
// componente necesita; se inyecta una sola vez).
if (
  typeof document !== "undefined" &&
  !document.getElementById("sala-audio-keyframes")
) {
  const styleTag = document.createElement("style");
  styleTag.id = "sala-audio-keyframes";
  styleTag.innerHTML = `
    @keyframes spin-sala-audio { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(styleTag);
}
