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
 *  - compacta: si es true, una vez conectado a la sala se muestra como
 *    una franja integrada en el flujo normal de la pantalla (no tapa el
 *    resto de la pantalla), para poder seguir viendo y usando el chat de
 *    texto al mismo tiempo. La pantalla de selección de sala (antes de
 *    conectarse) sigue mostrándose en pantalla completa, ya que ahí sí
 *    necesita la atención completa de la persona por un momento.
 */
export default function SalaAudio({
  rolEtiqueta,
  esDirector = false,
  alSalir,
  compacta = false,
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
  const [minimizada, setMinimizada] = useState(false); // solo aplica en modo compacto
  // socketIds (incluido el propio) cuyo audio está sonando AHORA MISMO,
  // medido por volumen real (no solo por tener el botón presionado).
  const [hablandoIds, setHablandoIds] = useState(() => new Set());

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const audiosRef = useRef({}); // { socketId: <audio> element }
  const audioCtxRef = useRef(null); // AudioContext compartido para los analizadores
  const analizadoresRef = useRef({}); // { socketId: AnalyserNode }
  const animacionVolumenRef = useRef(null); // id de requestAnimationFrame

  // ---------- Detección de "quién está hablando" por volumen real ----------
  // Usa la Web Audio API: por cada stream (el propio o el de un peer
  // remoto) se crea un AnalyserNode que mide el volumen ~12 veces por
  // segundo. Si supera un umbral chico, se considera que esa persona
  // está sonando en ese instante.
  const obtenerAudioContext = () => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  };

  const registrarAnalizador = (socketId, mediaStream) => {
    try {
      const ctx = obtenerAudioContext();
      const fuente = ctx.createMediaStreamSource(mediaStream);
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 512;
      analizador.smoothingTimeConstant = 0.7;
      fuente.connect(analizador);
      analizadoresRef.current[socketId] = {
        analizador,
        datos: new Uint8Array(analizador.frequencyBinCount),
      };
    } catch (e) {
      console.error("No se pudo crear analizador de audio:", e);
    }
  };

  const quitarAnalizador = (socketId) => {
    delete analizadoresRef.current[socketId];
  };

  // Loop continuo (requestAnimationFrame) que revisa el volumen de cada
  // analizador registrado y actualiza qué socketIds están sonando ahora.
  const iniciarLoopDeVolumen = () => {
    const UMBRAL = 14; // 0-255; ajustar si detecta de más o de menos

    const paso = () => {
      const nuevosHablando = new Set();

      Object.entries(analizadoresRef.current).forEach(([socketId, entry]) => {
        const { analizador, datos } = entry;
        analizador.getByteFrequencyData(datos);
        let suma = 0;
        for (let i = 0; i < datos.length; i++) suma += datos[i];
        const promedio = suma / datos.length;
        if (promedio > UMBRAL) nuevosHablando.add(socketId);
      });

      setHablandoIds((anterior) => {
        // Evita re-render si el contenido es idéntico al anterior.
        if (
          anterior.size === nuevosHablando.size &&
          [...anterior].every((id) => nuevosHablando.has(id))
        ) {
          return anterior;
        }
        return nuevosHablando;
      });

      animacionVolumenRef.current = requestAnimationFrame(paso);
    };

    animacionVolumenRef.current = requestAnimationFrame(paso);
  };

  const detenerLoopDeVolumen = () => {
    if (animacionVolumenRef.current) {
      cancelAnimationFrame(animacionVolumenRef.current);
      animacionVolumenRef.current = null;
    }
  };

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
    quitarAnalizador(socketId);
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
      registrarAnalizador(otroSocketId, evento.streams[0]);
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

      // Analizador para mi propio audio: así mi fila también muestra el
      // borde "hablando" cuando realmente sale sonido de mi micrófono
      // (no solo por tener el botón presionado).
      registrarAnalizador("yo", stream);
      iniciarLoopDeVolumen();
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
    detenerLoopDeVolumen();
    quitarAnalizador("yo");
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setSala(null);
    setConectado(false);
    setMiembros([]);
    setLiveSocketId(null);
    setHablando(false);
    setHablandoIds(new Set());
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("audio:salir");
        socketRef.current.disconnect();
      }
      cerrarTodosLosPeers();
      detenerLoopDeVolumen();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
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

  // ================= MODO COMPACTO (conectado, conviviendo con el chat) =================
  // Se usa una vez que ya estás dentro de una sala y la pantalla padre
  // pasó compacta=true: en vez de tapar toda la pantalla, se muestra como
  // una franja arriba, dejando visible el resto del panel (tally, chat,
  // botones rápidos) debajo.
  if (compacta && conectado) {
    return (
      <div style={styles.compactaContenedor}>
        {liveSocketId === miSocketId && (
          <div style={styles.compactaAvisoEnVivo}>
            <span style={styles.avisoEnVivoIcono}>🔴</span>
            <span style={styles.avisoEnVivoTexto}>ESTÁS EN VIVO</span>
          </div>
        )}

        <div style={styles.compactaHeader}>
          <div style={styles.compactaHeaderInfo}>
            <span style={styles.compactaPuntoSala} />
            <span style={styles.compactaTituloSala}>🎙️ Sala {sala}</span>
            <span style={styles.compactaContador}>
              {miembros.length}{" "}
              {miembros.length === 1 ? "conectado" : "conectados"}
            </span>
          </div>
          <div style={styles.compactaAcciones}>
            <button
              style={styles.compactaBtnIcono}
              onClick={() => setMinimizada((v) => !v)}
              title={minimizada ? "Expandir" : "Minimizar"}
            >
              {minimizada ? "▾" : "▴"}
            </button>
            <button
              style={styles.compactaBtnIcono}
              onClick={salirDeSala}
              title="Salir de la sala"
            >
              ✕
            </button>
          </div>
        </div>

        {!minimizada && (
          <>
            {error && <p style={styles.textoError}>⚠ {error}</p>}

            <div style={styles.compactaListaMiembros}>
              {miembros.map((m) => {
                const enVivo = liveSocketId === m.socketId;
                const soyYo = m.socketId === miSocketId;
                const estaHablando = soyYo
                  ? hablandoIds.has("yo")
                  : hablandoIds.has(m.socketId);
                return (
                  <div
                    key={m.socketId}
                    style={{
                      ...styles.compactaChipMiembro,
                      ...(enVivo ? styles.compactaChipEnVivo : {}),
                      ...(estaHablando ? styles.compactaChipHablando : {}),
                      cursor: esDirector ? "pointer" : "default",
                    }}
                    onClick={() => esDirector && marcarEnVivo(m.socketId)}
                  >
                    <span style={styles.puntoEstado(enVivo)} />
                    <span style={styles.compactaChipTexto}>
                      <strong>{m.rol}</strong>
                      <span style={styles.separador}>·</span>
                      {m.nombre}
                      {soyYo && <span style={styles.tagYo}>tú</span>}
                    </span>
                    {estaHablando && (
                      <span style={styles.badgeHablando}>🔊</span>
                    )}
                  </div>
                );
              })}
            </div>

            {esDirector && miembros.length > 0 && (
              <p style={styles.compactaHintDirector}>
                Tocá un nombre para marcarlo en vivo
              </p>
            )}

            {!micPermitido ? (
              <p style={styles.textoError}>⚠ Sin acceso al micrófono.</p>
            ) : (
              <button
                style={{
                  ...styles.compactaBtnHablar,
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
                <span style={styles.btnHablarIcono}>
                  {hablando ? "🔴" : "🎤"}
                </span>
                {hablando ? "HABLANDO..." : "MANTENÉ PRESIONADO PARA HABLAR"}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

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
            placeholder=""
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

      {liveSocketId === miSocketId && (
        <div style={styles.avisoEnVivo}>
          <span style={styles.avisoEnVivoIcono}>🔴</span>
          <span style={styles.avisoEnVivoTexto}>ESTÁS EN VIVO</span>
        </div>
      )}

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
          // "yo" se registra con la clave especial "yo" en el analizador
          // local; los demás se identifican por su socketId real.
          const estaHablando = soyYo
            ? hablandoIds.has("yo")
            : hablandoIds.has(m.socketId);
          return (
            <div
              key={m.socketId}
              style={{
                ...styles.filaMiembro,
                ...(enVivo ? styles.filaMiembroEnVivo : {}),
                ...(estaHablando ? styles.filaMiembroHablando : {}),
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
              {estaHablando && <span style={styles.badgeHablando}>🔊</span>}
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
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 9999,
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  fondoDecorativo: {
    position: "fixed",
    top: "-120px",
    right: "-80px",
    width: "260px",
    height: "260px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(0, 200, 83, 0.10), transparent 70%)",
    pointerEvents: "none",
    zIndex: -1,
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
  // Borde "estilo WhatsApp": se prende solo mientras hay sonido real
  // detectado en ese stream (no solo por tener el botón presionado).
  // Si la persona también está marcada "en vivo", este borde gana
  // prioridad visual (se aplica después en el spread de estilos).
  filaMiembroHablando: {
    border: "2px solid #00e676",
    boxShadow:
      "0 0 0 3px rgba(0, 230, 118, 0.22), 0 0 16px rgba(0, 230, 118, 0.35)",
    transition: "border-color 0.08s ease, box-shadow 0.08s ease",
  },
  badgeHablando: {
    fontSize: "0.85rem",
    flexShrink: 0,
    animation: "pulso-hablando-sala-audio 0.9s ease-in-out infinite",
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
  avisoEnVivo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "12px",
    marginBottom: "16px",
    borderRadius: "14px",
    backgroundColor: "rgba(229, 57, 53, 0.15)",
    border: "1px solid rgba(229, 57, 53, 0.5)",
    boxShadow: "0 0 24px rgba(229, 57, 53, 0.25)",
    animation: "pulso-en-vivo-sala-audio 1.4s ease-in-out infinite",
    position: "relative",
    zIndex: 1,
  },
  avisoEnVivoIcono: {
    fontSize: "1.1rem",
    animation: "pulso-hablando-sala-audio 0.9s ease-in-out infinite",
  },
  avisoEnVivoTexto: {
    fontSize: "1rem",
    fontWeight: 900,
    letterSpacing: "1px",
    color: "#ff8a80",
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

  // ===== Estilos del modo compacto (franja integrada, no tapa el chat) =====
  compactaContenedor: {
    backgroundColor: "#13131a",
    backgroundImage:
      "linear-gradient(180deg, rgba(33,150,243,0.07), transparent)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "16px",
    padding: "12px 14px",
    marginBottom: "10px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
    fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif",
    color: "#fff",
    boxSizing: "border-box",
  },
  compactaHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compactaHeaderInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    minWidth: 0,
  },
  compactaPuntoSala: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#00e676",
    boxShadow: "0 0 8px rgba(0, 230, 118, 0.7)",
    flexShrink: 0,
  },
  compactaTituloSala: {
    fontSize: "0.92rem",
    fontWeight: 800,
  },
  compactaContador: {
    fontSize: "0.72rem",
    color: "#8a8f9a",
    fontWeight: 600,
  },
  compactaAcciones: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  compactaBtnIcono: {
    backgroundColor: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  compactaAvisoEnVivo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "8px",
    marginBottom: "10px",
    borderRadius: "10px",
    backgroundColor: "rgba(229, 57, 53, 0.15)",
    border: "1px solid rgba(229, 57, 53, 0.5)",
    animation: "pulso-en-vivo-sala-audio 1.4s ease-in-out infinite",
  },
  compactaListaMiembros: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px",
    marginBottom: "10px",
  },
  compactaChipMiembro: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: "0.78rem",
    transition: "border-color 0.1s ease, box-shadow 0.1s ease",
  },
  compactaChipEnVivo: {
    backgroundColor: "rgba(0, 200, 83, 0.14)",
    border: "1px solid rgba(0, 230, 118, 0.5)",
  },
  compactaChipHablando: {
    border: "2px solid #00e676",
    boxShadow:
      "0 0 0 2px rgba(0, 230, 118, 0.2), 0 0 10px rgba(0, 230, 118, 0.3)",
  },
  compactaChipTexto: {
    color: "#e8eaed",
    whiteSpace: "nowrap",
  },
  compactaHintDirector: {
    color: "#6b7280",
    fontSize: "0.72rem",
    textAlign: "center",
    marginBottom: "8px",
  },
  compactaBtnHablar: {
    width: "100%",
    padding: "13px",
    border: "1px solid rgba(33, 150, 243, 0.4)",
    borderRadius: "12px",
    backgroundColor: "#0d63d6",
    backgroundImage: "linear-gradient(135deg, #1976f3, #0d4fb0)",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: "800",
    cursor: "pointer",
    userSelect: "none",
    touchAction: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 4px 14px rgba(13, 99, 214, 0.3)",
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
    @keyframes pulso-hablando-sala-audio {
      0%, 100% { opacity: 0.5; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.15); }
    }
    @keyframes pulso-en-vivo-sala-audio {
      0%, 100% { box-shadow: 0 0 24px rgba(229, 57, 53, 0.25); }
      50% { box-shadow: 0 0 36px rgba(229, 57, 53, 0.45); }
    }
  `;
  document.head.appendChild(styleTag);
}
