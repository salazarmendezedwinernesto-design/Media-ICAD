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
        <div style={styles.headerArea}>
          <h2 style={styles.titulo}>🎙️ Sala de audio</h2>
          <button style={styles.btnSalirChico} onClick={alSalir}>
            ✕ Cerrar
          </button>
        </div>

        <p style={styles.subtitulo}>
          Elegí una sala para hablar por voz con el equipo. Conexión directa,
          baja latencia.
        </p>

        <input
          type="text"
          placeholder="Tu nombre (ej. Gaby)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={styles.inputNombre}
          maxLength={24}
          disabled={conectando}
        />

        <div style={styles.gridSalas}>
          {SALAS.map((s) => (
            <button
              key={s}
              style={{
                ...styles.btnSala,
                opacity: !nombre.trim() || conectando ? 0.5 : 1,
              }}
              disabled={!nombre.trim() || conectando}
              onClick={() => entrarASala(s)}
            >
              {conectando ? "..." : `SALA ${s}`}
            </button>
          ))}
        </div>

        {!nombre.trim() && (
          <p style={styles.hintNombre}>Escribí tu nombre para poder entrar.</p>
        )}
        {error && <p style={styles.textoError}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={styles.contenedor}>
      <div style={styles.headerArea}>
        <h2 style={styles.titulo}>🎙️ Sala {sala}</h2>
        <button style={styles.btnSalirChico} onClick={salirDeSala}>
          ✕ Salir de la sala
        </button>
      </div>

      {error && <p style={styles.textoError}>{error}</p>}

      <div style={styles.listaMiembros}>
        {miembros.length === 0 && (
          <p style={styles.vacioLista}>Esperando a que otros se unan...</p>
        )}
        {miembros.map((m) => {
          const enVivo = liveSocketId === m.socketId;
          const soyYo = m.socketId === miSocketId;
          return (
            <div
              key={m.socketId}
              style={{
                ...styles.filaMiembro,
                backgroundColor: enVivo ? "#1b5e20" : "#1a1a1a",
                border: enVivo ? "1px solid #2e7d32" : "1px solid #333",
                cursor: esDirector ? "pointer" : "default",
              }}
              onClick={() => esDirector && marcarEnVivo(m.socketId)}
            >
              <span style={styles.puntoEstado(enVivo)} />
              <span style={styles.etiquetaMiembro}>
                <strong>{m.rol}</strong>
                <span style={styles.separador}> · </span>
                {m.nombre}
                {soyYo && <span style={styles.tagYo}> (tú)</span>}
              </span>
              {enVivo && <span style={styles.badgeLive}>EN VIVO</span>}
            </div>
          );
        })}
      </div>

      {esDirector && (
        <p style={styles.hintDirector}>
          Tocá un nombre para marcarlo en vivo (verde). Solo uno a la vez.
        </p>
      )}

      {!micPermitido ? (
        <p style={styles.textoError}>
          Sin acceso al micrófono. Revisá los permisos del navegador y volvé a
          entrar.
        </p>
      ) : (
        <button
          style={{
            ...styles.btnHablar,
            backgroundColor: hablando ? "#d32f2f" : "#0052cc",
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
          {hablando ? "🔴 HABLANDO..." : "🎤 MANTENÉ PRESIONADO PARA HABLAR"}
        </button>
      )}
    </div>
  );
}

const styles = {
  contenedor: {
    backgroundColor: "#0f0f0f",
    color: "#fff",
    minHeight: "100vh",
    padding: "16px",
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  headerArea: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  titulo: { margin: 0, fontSize: "1.3rem" },
  subtitulo: { color: "#999", fontSize: "0.9rem", marginTop: 0 },
  btnSalirChico: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "none",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.85rem",
  },
  inputNombre: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #444",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    fontSize: "1rem",
    boxSizing: "border-box",
    marginBottom: "14px",
    outline: "none",
  },
  gridSalas: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  btnSala: {
    padding: "20px 8px",
    backgroundColor: "#1565c0",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "1.05rem",
    fontWeight: "900",
    cursor: "pointer",
  },
  hintNombre: {
    color: "#777",
    fontSize: "0.8rem",
    textAlign: "center",
    marginTop: "10px",
  },
  textoError: {
    color: "#ff5252",
    fontSize: "0.85rem",
    fontWeight: "bold",
  },
  listaMiembros: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
    marginBottom: "14px",
    overflowY: "auto",
  },
  vacioLista: { color: "#666", fontSize: "0.9rem", textAlign: "center" },
  filaMiembro: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "8px",
  },
  puntoEstado: (enVivo) => ({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: enVivo ? "#00e676" : "#666",
    flexShrink: 0,
  }),
  etiquetaMiembro: { flex: 1, fontSize: "0.95rem" },
  separador: { color: "#666" },
  tagYo: { color: "#888", fontStyle: "italic" },
  badgeLive: {
    backgroundColor: "#00c853",
    color: "#04210f",
    fontSize: "0.7rem",
    fontWeight: "900",
    padding: "3px 8px",
    borderRadius: "999px",
  },
  hintDirector: {
    color: "#777",
    fontSize: "0.8rem",
    textAlign: "center",
    marginBottom: "10px",
  },
  btnHablar: {
    width: "100%",
    padding: "22px",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "1.05rem",
    fontWeight: "900",
    cursor: "pointer",
    userSelect: "none",
    touchAction: "none",
  },
};
