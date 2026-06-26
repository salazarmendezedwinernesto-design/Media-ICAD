import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
import SalaAudio from "./SalaAudio";

const SOCKET_URL = SERVER_URL;

const ALERTAS_RAPIDAS = [
  "Mejorar encuadre",
  "Brillo",
  "Estoy con tu cámara",
  "Está desenfocada",
  "Estar concentrados",
  "Seguimiento",
];

// Rejilla unificada de objetivos en el panel general
const OBJETIVOS_SISTEMA = [
  { id: "c1", label: "C1", tipo: "camara", valor: 1 },
  { id: "c2", label: "C2", tipo: "camara", valor: 2 },
  { id: "c3", label: "C3", tipo: "camara", valor: 3 },
  { id: "c4", label: "C4", tipo: "camara", valor: 4 },
  { id: "c5", label: "C5", tipo: "camara", valor: 5 },
  { id: "c6", label: "C6", tipo: "camara", valor: 6 },
  { id: "pastor", label: " Pastor", tipo: "pastor", valor: "Pastor" },
  { id: "pantalla", label: " Pantalla", tipo: "pantalla", valor: "Pantalla" },
  { id: "lider", label: " Líder", tipo: "lider", valor: "Lider" },
];

const MENSAJES_GENERALES_RAPIDOS = [
  "Estamos en vivo",
  "Estamos fuera",
  "Hagan seguimiento al ",
  "CAMBIO DE PLAN",
  "TODO BIEN",
];

const FRASES_RAPIDAS_PASTOR = [
  " ESTAMOS LISTOS",
  " ¿Empezamos trasmisión?",
  " ¿Cortamos ya?",
  " Recibido",
  " Si",
  " No",
];

const FRASES_RAPIDAS_PANTALLA = [
  " REVISAR PANTALLA",
  " CAMBIAR FONDO",
  " PONER MUSICA",
  " PONER VIDEO",
];

const FRASES_RAPIDAS_LIDER = [
  " ATENTOS CÁMARAS",
  " CAMBIO DE ÁNGULO",
  " BUEN TRABAJO",
  " RECIBIDO",
];

export default function Director({ alSalir }) {
  const [estadosLocales, setEstadosLocales] = useState({});
  const [mensajesCamaras, setMensajesCamaras] = useState({});
  const [mostrarAudio, setMostrarAudio] = useState(false);

  // Guardamos las IDs de los objetivos seleccionados (ej: ["c1", "pastor"])
  const [seleccionados, setSeleccionados] = useState([]);

  const [textoGeneral, setTextoGeneral] = useState("");
  const [esHorizontal, setEsHorizontal] = useState(false);

  const [mensajesDelPastor, setMensajesDelPastor] = useState([]);
  const [textoParaPastor, setTextoParaPastor] = useState("");

  const [mensajesDePantalla, setMensajesDePantalla] = useState([]);
  const [textoParaPantalla, setTextoParaPantalla] = useState("");

  const [mensajesDelLider, setMensajesDelLider] = useState([]);
  const [textoParaLider, setTextoParaLider] = useState("");

  // Texto libre dedicado por cámara (uno independiente para cada una)
  const [textosLibresCamara, setTextosLibresCamara] = useState({});

  const socketRef = useRef(null);

  useEffect(() => {
    const manejarResize = () => {
      const ancho = window.innerWidth;
      const alto = window.innerHeight;
      setEsHorizontal(ancho > alto);
    };
    manejarResize();
    window.addEventListener("resize", manejarResize);
    return () => window.removeEventListener("resize", manejarResize);
  }, []);

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
      setEstadosLocales((prev) => ({ ...prev, [datos.camara]: datos }));
    });

    socket.on("recibir_mensaje_camara", (datos) => {
      if (datos && datos.texto && datos.texto.trim() !== "") {
        setMensajesCamaras((prev) => ({ ...prev, [datos.camara]: datos }));
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);

        setTimeout(() => {
          setMensajesCamaras((prev) => {
            const actual = prev[datos.camara];
            if (actual && actual.hora === datos.hora) {
              return { ...prev, [datos.camara]: null };
            }
            return prev;
          });
        }, 300000);
      }
    });

    // ESCUCHA FILTRADA: Solo guarda mensajes que realmente vengan dirigidos al Director
    socket.on("recibir_mensaje_pastor_en_director", (datos) => {
      const idMensaje = datos.id || Date.now();

      // Validar que el mensaje realmente venga dirigido al Director (o a Todos).
      // Si no, el Director no debe verlo, sin importar de quién venga.
      const listaDestinatarios = Array.isArray(datos.destinatarios)
        ? datos.destinatarios
        : [];
      const esParaMi =
        listaDestinatarios.includes("Director") ||
        listaDestinatarios.includes("Todos");

      if (!esParaMi) return;

      // 1. Mensajes que vienen desde el panel de Pantalla
      if (datos.de === "Pantalla / Proyección") {
        setMensajesDePantalla((prev) => [
          { id: idMensaje, texto: datos.texto },
          ...prev,
        ]);

        setTimeout(() => {
          setMensajesDePantalla((prev) =>
            prev.filter((m) => m.id !== idMensaje),
          );
        }, 300000);
      }
      // 2. Mensajes que vienen del Líder (separados del buzón del Pastor)
      else if (datos.de === "Lider") {
        setMensajesDelLider((prev) => [
          { id: idMensaje, texto: datos.texto },
          ...prev,
        ]);

        setTimeout(() => {
          setMensajesDelLider((prev) => prev.filter((m) => m.id !== idMensaje));
        }, 300000);
      }
      // 3. Mensajes que vienen del Pastor (descartando los ecos del Director)
      else if (datos.de !== "Director") {
        setMensajesDelPastor((prev) => [
          { id: idMensaje, texto: datos.texto },
          ...prev,
        ]);

        setTimeout(() => {
          setMensajesDelPastor((prev) =>
            prev.filter((m) => m.id !== idMensaje),
          );
        }, 300000);
      }

      // Solo vibra si el mensaje es entrante de un operador externo
      if (datos.de !== "Director" && "vibrate" in navigator) {
        navigator.vibrate([300, 100, 300]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Lógica de Envío Inteligente desde el Panel General
  const enviarMensajeGeneral = (texto) => {
    if (
      !texto ||
      !texto.trim() ||
      seleccionados.length === 0 ||
      !socketRef.current
    )
      return;

    const textoLimpio = texto.trim();

    const camarasAEnviar = OBJETIVOS_SISTEMA.filter(
      (o) => seleccionados.includes(o.id) && o.tipo === "camara",
    ).map((o) => o.valor);
    const enviarAPastor = seleccionados.includes("pastor");
    const enviarAPantalla = seleccionados.includes("pantalla");
    const enviarALider = seleccionados.includes("lider");

    if (camarasAEnviar.length > 0) {
      socketRef.current.emit("enviar_mensaje_general", {
        camaras: camarasAEnviar,
        mensaje: textoLimpio,
      });
    }

    if (enviarAPastor || enviarAPantalla || enviarALider) {
      const destinatariosEspeciales = [];
      if (enviarAPastor) destinatariosEspeciales.push("Pastor");
      if (enviarAPantalla) destinatariosEspeciales.push("Pantalla");
      if (enviarALider) destinatariosEspeciales.push("Lider");

      if (seleccionados.length === OBJETIVOS_SISTEMA.length) {
        destinatariosEspeciales.push("Todos");
      }

      socketRef.current.emit("enviar_mensaje_a_pastor", {
        de: "Director",
        texto: textoLimpio,
        id: Date.now(),
        destinatarios: destinatariosEspeciales,
      });
    }
  };

  const manejarEnvioTextoGeneral = (e) => {
    e.preventDefault();
    enviarMensajeGeneral(textoGeneral);
    setTextoGeneral("");
  };

  // Envíos de Tally con Regla de Exclusividad de VIVO (Live)
  const enviarOrden = (numCamara, estado, mensaje = "") => {
    if (!socketRef.current) return;

    // Si se va a poner una cámara en VIVO, apagamos cualquier otra que ya lo esté
    if (estado === "live") {
      Object.keys(estadosLocales).forEach((camId) => {
        const camNum = Number(camId);
        if (camNum !== numCamara && estadosLocales[camNum]?.estado === "live") {
          // Cambiar de live a standby de forma automática en el servidor
          socketRef.current.emit("enviar_orden_director", {
            camara: camNum,
            estado: "standby",
            mensaje: "",
          });
        }
      });
    }

    // Emitir el cambio solicitado originalmente
    socketRef.current.emit("enviar_orden_director", {
      camara: numCamara,
      estado,
      mensaje,
    });
  };

  const enviarMensajeAPastor = (textoAEnviar) => {
    if (!textoAEnviar || !textoAEnviar.trim() || !socketRef.current) return;
    socketRef.current.emit("enviar_mensaje_a_pastor", {
      de: "Director",
      texto: textoAEnviar.trim(),
      id: Date.now(),
      destinatarios: ["Pastor"],
    });
  };

  const enviarMensajeAPantalla = (textoAEnviar) => {
    if (!textoAEnviar || !textoAEnviar.trim() || !socketRef.current) return;
    socketRef.current.emit("enviar_mensaje_a_pastor", {
      de: "Director",
      texto: textoAEnviar.trim(),
      id: Date.now(),
      destinatarios: ["Pantalla"],
    });
  };

  const enviarMensajeALider = (textoAEnviar) => {
    if (!textoAEnviar || !textoAEnviar.trim() || !socketRef.current) return;
    socketRef.current.emit("enviar_mensaje_a_pastor", {
      de: "Director",
      texto: textoAEnviar.trim(),
      id: Date.now(),
      destinatarios: ["Lider"],
    });
  };

  // Manda un mensaje libre a UNA cámara específica, sin tocar su tally
  // actual (reenvía el mismo estado que ya tenía).
  const enviarMensajeLibreACamara = (numCamara, textoAEnviar) => {
    if (!textoAEnviar || !textoAEnviar.trim() || !socketRef.current) return;
    const estadoActual = estadosLocales[numCamara]?.estado || "standby";
    socketRef.current.emit("enviar_orden_director", {
      camara: numCamara,
      estado: estadoActual,
      mensaje: textoAEnviar.trim(),
    });
  };

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const seleccionarTodoElSistema = () => {
    setSeleccionados(
      seleccionados.length === OBJETIVOS_SISTEMA.length
        ? []
        : OBJETIVOS_SISTEMA.map((o) => o.id),
    );
  };

  const fontClamp = (minPx, vwValue, maxPx) =>
    `clamp(${minPx}px, ${vwValue}vw, ${maxPx}px)`;

  return (
    <div
      style={{
        ...styles.container,
        padding: esHorizontal ? "10px" : "12px",
        height: esHorizontal ? "100vh" : "auto",
        width: "100vw",
      }}
    >
      <style>{`
        @keyframes parpadeoAlerta {
          0% { background-color: #7a0000; box-shadow: 0 0 4px #ff3333; }
          50% { background-color: #ff0000; box-shadow: 0 0 14px #ff3333; }
          100% { background-color: #7a0000; box-shadow: 0 0 4px #ff3333; }
        }
        .alerta-activa { animation: parpadeoAlerta 1s infinite ease-in-out; }
        
        .alerta-activa-pastor { animation: parpadeoAlertaRojoPastor 0.9s infinite ease-in-out; }
        @keyframes parpadeoAlertaRojoPastor {
          0% { background-color: rgba(255, 0, 0, 0.25); box-shadow: 0 0 4px #ff1a1a; border-color: #ff0000; }
          50% { background-color: rgba(255, 0, 0, 0.55); box-shadow: 0 0 14px #ff1a1a; border-color: #ff3333; }
          100% { background-color: rgba(255, 0, 0, 0.25); box-shadow: 0 0 4px #ff1a1a; border-color: #ff0000; }
        }

        .alerta-activa-pantalla { animation: parpadeoAlertaRojoPantalla 0.9s infinite ease-in-out; }
        @keyframes parpadeoAlertaRojoPantalla {
          0% { background-color: rgba(255, 0, 0, 0.25); box-shadow: 0 0 4px #ff1a1a; border-color: #ff0000; }
          50% { background-color: rgba(255, 0, 0, 0.55); box-shadow: 0 0 14px #ff1a1a; border-color: #ff3333; }
          100% { background-color: rgba(255, 0, 0, 0.25); box-shadow: 0 0 4px #ff1a1a; border-color: #ff0000; }
        }

        .alerta-activa-lider { animation: parpadeoAlertaLider 0.9s infinite ease-in-out; }
        @keyframes parpadeoAlertaLider {
          0% { background-color: rgba(230, 126, 34, 0.25); box-shadow: 0 0 4px #e67e22; border-color: #e67e22; }
          50% { background-color: rgba(230, 126, 34, 0.55); box-shadow: 0 0 14px #e67e22; border-color: #f39c12; }
          100% { background-color: rgba(230, 126, 34, 0.25); box-shadow: 0 0 4px #e67e22; border-color: #e67e22; }
        }
      `}</style>

      <header style={styles.navbar}>
        <button style={styles.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={styles.navTitle}>🎛️ PANEL DEL DIRECTOR</h1>
        <button style={styles.btnVolver} onClick={() => setMostrarAudio(true)}>
          🎙️ Audio
        </button>
      </header>

      {mostrarAudio && (
        <SalaAudio
          alSalir={() => setMostrarAudio(false)}
          esDirector={true}
          rolEtiqueta="Director"
          compacta={true}
        />
      )}

      <div
        style={{
          ...styles.layoutPrincipal,
          flexDirection: esHorizontal ? "row" : "column",
          gap: esHorizontal ? "12px" : "16px",
          width: "100%",
          height: esHorizontal ? "calc(100vh - 70px)" : "auto",
        }}
      >
        {/* PANEL GENERAL LATERAL UNIFICADO */}
        <aside
          style={{
            ...styles.sidebarGeneral,
            width: esHorizontal ? "24vw" : "100%",
            maxWidth: esHorizontal ? "190px" : "none",
            padding: "12px",
            height: esHorizontal ? "100%" : "auto",
            overflowY: esHorizontal ? "auto" : "visible",
          }}
        >
          <h2
            style={{
              ...styles.sidebarTitulo,
              fontSize: fontClamp(12, 1.5, 15),
            }}
          >
            📢 Panel General
          </h2>

          <button
            style={{
              ...styles.btnTodas,
              fontSize: fontClamp(11, 1.3, 13),
              padding: "7px 4px",
              marginBottom: "8px",
            }}
            onClick={seleccionarTodoElSistema}
          >
            {seleccionados.length === OBJETIVOS_SISTEMA.length
              ? "✕ Deseleccionar"
              : "✓ Seleccionar Todo"}
          </button>

          <div style={{ ...styles.gridSeleccionCamaras, gap: "6px" }}>
            {OBJETIVOS_SISTEMA.map((obj) => {
              const activa = seleccionados.includes(obj.id);
              const esEspecial = obj.tipo !== "camara";
              return (
                <button
                  key={obj.id}
                  style={{
                    ...styles.btnSeleccionCamara,
                    backgroundColor: activa
                      ? esEspecial
                        ? "#6d28d9"
                        : "#0052cc"
                      : "#2a2a2a",
                    borderColor: activa
                      ? esEspecial
                        ? "#a78bfa"
                        : "#3d8bff"
                      : "#3a3a3a",
                    gridColumn: esEspecial ? "span 2" : "auto",
                    fontSize: fontClamp(11, 1.3, 13),
                    padding: "8px 4px",
                  }}
                  onClick={() => toggleSeleccion(obj.id)}
                >
                  {activa ? "✓ " : ""}
                  {obj.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              ...styles.listaMensajesGenerales,
              gap: "5px",
              marginTop: "12px",
            }}
          >
            {MENSAJES_GENERALES_RAPIDOS.map((msg) => (
              <button
                key={msg}
                style={{
                  ...styles.btnMesaenajeGeneral,
                  opacity: seleccionados.length === 0 ? 0.4 : 1,
                  cursor:
                    seleccionados.length === 0 ? "not-allowed" : "pointer",
                  fontSize: fontClamp(10, 1.2, 12),
                  padding: "8px 4px",
                }}
                disabled={seleccionados.length === 0}
                onClick={() => enviarMensajeGeneral(msg)}
              >
                {msg}
              </button>
            ))}
          </div>

          <form
            style={{
              ...styles.formFormularioGeneral,
              marginTop: "10px",
              paddingTop: "10px",
            }}
            onSubmit={manejarEnvioTextoGeneral}
          >
            <input
              type="text"
              value={textoGeneral}
              onChange={(e) => setTextoGeneral(e.target.value)}
              placeholder="Escribir aviso..."
              style={{
                ...styles.inputMensajeGeneral,
                fontSize: fontClamp(11, 1.3, 13),
                padding: "8px",
              }}
            />
            <button
              type="submit"
              style={{
                ...styles.btnEnviarGeneral,
                opacity: seleccionados.length === 0 ? 0.4 : 1,
                cursor: seleccionados.length === 0 ? "not-allowed" : "pointer",
                fontSize: fontClamp(11, 1.3, 13),
                padding: "8px",
              }}
              disabled={seleccionados.length === 0}
            >
              ENVIAR ({seleccionados.length})
            </button>
          </form>
        </aside>

        {/* ÁREA DE TRABAJO DERECHA */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            height: esHorizontal ? "100%" : "auto",
            overflowY: "auto",
            paddingRight: esHorizontal ? "4px" : "0",
          }}
        >
          {/* SECCIÓN: PASTOR, PANTALLA & LÍDER */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            {/* PASTOR */}
            <section
              style={{
                ...styles.seccionPastor,
                flex: 1,
                borderColor: "#b71c1c",
              }}
            >
              <div style={styles.headerPastorControl}>
                <h2
                  style={{
                    ...styles.pastorTitulo,
                    color: "#ff8a80",
                    fontSize: fontClamp(12, 1.4, 15),
                  }}
                >
                  COMUNICACIÓN CON EL PASTOR
                </h2>
              </div>
              <div style={styles.buzonPastor}>
                {mensajesDelPastor.length === 0 ? (
                  <p style={styles.textoBuzonVacio}>
                    Esperando mensajes del Pastor...
                  </p>
                ) : (
                  mensajesDelPastor.map((msg, idx) => (
                    <div
                      key={msg.id}
                      className={idx === 0 ? "alerta-activa-pastor" : ""}
                      style={
                        idx === 0
                          ? styles.itemMensajePastorAlerta
                          : styles.itemMensajePastor
                      }
                    >
                      <span style={styles.tagPastorOrigen}>PASTOR:</span>
                      <span style={styles.textoMensajePastor}>{msg.texto}</span>
                      <button
                        style={styles.btnBorrarMsgPastor}
                        onClick={() =>
                          setMensajesDelPastor((prev) =>
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "4px",
                  marginBottom: "4px",
                }}
              >
                {FRASES_RAPIDAS_PASTOR.map((frase) => (
                  <button
                    key={frase}
                    style={{
                      ...styles.btnAlertaRapidaPastor,
                      fontSize: fontClamp(9, 1.05, 11),
                    }}
                    onClick={() => enviarMensajeAPastor(frase)}
                  >
                    {frase.split(" ").slice(1).join(" ") || frase}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarMensajeAPastor(textoParaPastor);
                  setTextoParaPastor("");
                }}
                style={styles.formEnvioPastor}
              >
                <input
                  type="text"
                  value={textoParaPastor}
                  onChange={(e) => setTextoParaPastor(e.target.value)}
                  placeholder="Mensaje al Pastor..."
                  style={styles.inputPastorText}
                />
                <button
                  type="submit"
                  style={{
                    ...styles.btnEnviarPastor,
                    backgroundColor: "#b71c1c",
                  }}
                >
                  OK
                </button>
              </form>
            </section>

            {/* FILA INFERIOR: PANTALLA & LÍDER */}
            <div
              style={{
                display: "flex",
                flexDirection: esHorizontal ? "row" : "column",
                gap: "12px",
              }}
            >
              {/* PANTALLA */}
              <section
                style={{
                  ...styles.seccionPastor,
                  flex: 1,
                  borderColor: "#2e7d32",
                }}
              >
                <div style={styles.headerPastorControl}>
                  <h2
                    style={{
                      ...styles.pastorTitulo,
                      color: "#a5d6a7",
                      fontSize: fontClamp(12, 1.4, 15),
                    }}
                  >
                    INSTRUCCIONES A PANTALLA
                  </h2>
                </div>
                <div style={styles.buzonPastor}>
                  {mensajesDePantalla.length === 0 ? (
                    <p style={styles.textoBuzonVacio}>
                      Esperando reportes de Proyección...
                    </p>
                  ) : (
                    mensajesDePantalla.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className="alerta-activa-pantalla"
                        style={
                          idx === 0
                            ? styles.itemMensajePastorAlerta
                            : styles.itemMensajePastor
                        }
                      >
                        <span
                          style={{
                            ...styles.tagPastorOrigen,
                            color: "#4caf50",
                          }}
                        >
                          PANTALLA:
                        </span>
                        <span style={styles.textoMensajePastor}>
                          {msg.texto}
                        </span>
                        <button
                          style={styles.btnBorrarMsgPastor}
                          onClick={() =>
                            setMensajesDePantalla((prev) =>
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px",
                    marginBottom: "4px",
                  }}
                >
                  {FRASES_RAPIDAS_PANTALLA.map((frase) => (
                    <button
                      key={frase}
                      style={{
                        ...styles.btnAlertaRapidaPastor,
                        color: "#a5d6a7",
                        fontSize: fontClamp(9, 1.05, 11),
                      }}
                      onClick={() => enviarMensajeAPantalla(frase)}
                    >
                      {frase.split(" ").slice(1).join(" ")}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviarMensajeAPantalla(textoParaPantalla);
                    setTextoParaPantalla("");
                  }}
                  style={styles.formEnvioPastor}
                >
                  <input
                    type="text"
                    value={textoParaPantalla}
                    onChange={(e) => setTextoParaPantalla(e.target.value)}
                    placeholder="Instrucción a Proyección..."
                    style={styles.inputPastorText}
                  />
                  <button
                    type="submit"
                    style={{
                      ...styles.btnEnviarPastor,
                      backgroundColor: "#2e7d32",
                    }}
                  >
                    OK
                  </button>
                </form>
              </section>

              {/* LÍDER */}
              <section
                style={{
                  ...styles.seccionPastor,
                  flex: 1,
                  borderColor: "#e67e22",
                }}
              >
                <div style={styles.headerPastorControl}>
                  <h2
                    style={{
                      ...styles.pastorTitulo,
                      color: "#f0b27a",
                      fontSize: fontClamp(12, 1.4, 15),
                    }}
                  >
                    COMUNICACIÓN CON EL LÍDER
                  </h2>
                </div>
                <div style={styles.buzonPastor}>
                  {mensajesDelLider.length === 0 ? (
                    <p style={styles.textoBuzonVacio}>
                      Esperando mensajes del Líder...
                    </p>
                  ) : (
                    mensajesDelLider.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className={idx === 0 ? "alerta-activa-lider" : ""}
                        style={
                          idx === 0
                            ? {
                                ...styles.itemMensajePastorAlerta,
                                borderColor: "#e67e22",
                              }
                            : styles.itemMensajePastor
                        }
                      >
                        <span
                          style={{
                            ...styles.tagPastorOrigen,
                            color: "#e67e22",
                          }}
                        >
                          LÍDER:
                        </span>
                        <span style={styles.textoMensajePastor}>
                          {msg.texto}
                        </span>
                        <button
                          style={styles.btnBorrarMsgPastor}
                          onClick={() =>
                            setMensajesDelLider((prev) =>
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px",
                    marginBottom: "4px",
                  }}
                >
                  {FRASES_RAPIDAS_LIDER.map((frase) => (
                    <button
                      key={frase}
                      style={{
                        ...styles.btnAlertaRapidaPastor,
                        color: "#f0b27a",
                        fontSize: fontClamp(9, 1.05, 11),
                      }}
                      onClick={() => enviarMensajeALider(frase)}
                    >
                      {frase.split(" ").slice(1).join(" ") || frase}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviarMensajeALider(textoParaLider);
                    setTextoParaLider("");
                  }}
                  style={styles.formEnvioPastor}
                >
                  <input
                    type="text"
                    value={textoParaLider}
                    onChange={(e) => setTextoParaLider(e.target.value)}
                    placeholder="Mensaje al Líder..."
                    style={styles.inputPastorText}
                  />
                  <button
                    type="submit"
                    style={{
                      ...styles.btnEnviarPastor,
                      backgroundColor: "#e67e22",
                    }}
                  >
                    OK
                  </button>
                </form>
              </section>
            </div>
          </div>

          {/* REJILLA DE CÁMARAS */}
          <div
            style={{
              ...styles.gridControl,
              gridTemplateColumns: esHorizontal ? "1fr 1fr" : "1fr",
              gap: esHorizontal ? "12px" : "16px",
              flex: 1,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const infoCamara = estadosLocales[num] || {
                estado: "standby",
                mensaje: "",
              };
              const mensajeCamara = mensajesCamaras[num];
              const estadoEnEspanol =
                infoCamara.estado === "live"
                  ? "VIVO"
                  : infoCamara.estado === "preview"
                    ? "PREVIO"
                    : "ESPERA";

              return (
                <div
                  key={num}
                  style={{ ...styles.cardCamara, padding: "12px" }}
                >
                  <div style={styles.cardHeader}>
                    <h3
                      style={{
                        ...styles.camTitle,
                        fontSize: fontClamp(12, 1.5, 15),
                      }}
                    >
                      CÁMARA {num}
                    </h3>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor:
                          infoCamara.estado === "live"
                            ? "#ff3333"
                            : infoCamara.estado === "preview"
                              ? "#00cc66"
                              : "#555",
                        fontSize: fontClamp(10, 1.2, 12),
                        padding: "4px 8px",
                      }}
                    >
                      {estadoEnEspanol}
                    </span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    {mensajeCamara && mensajeCamara.texto && (
                      <div
                        className="alerta-activa"
                        style={{
                          ...styles.mensajeDesdeCamara,
                          fontSize: fontClamp(11, 1.3, 13),
                          margin: "8px 0",
                        }}
                      >
                        <span
                          style={{
                            paddingLeft: "8px",
                            wordBreak: "break-word",
                          }}
                        >
                          🚨 CAM {num}: {mensajeCamara.texto}
                        </span>
                        <button
                          onClick={() =>
                            setMensajesCamaras((p) => ({ ...p, [num]: null }))
                          }
                          style={styles.btnDescartarAlerta}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      ...styles.tallyActions,
                      gap: "6px",
                      margin: "6px 0",
                    }}
                  >
                    <button
                      style={{
                        ...styles.btnTally,
                        backgroundColor: "#ff3333",
                        opacity: infoCamara.estado === "live" ? 1 : 0.4,
                        fontSize: fontClamp(11, 1.4, 14),
                        padding: "10px 0",
                      }}
                      onClick={() => enviarOrden(num, "live")}
                    >
                      VIVO
                    </button>
                    <button
                      style={{
                        ...styles.btnTally,
                        backgroundColor: "#00cc66",
                        opacity: infoCamara.estado === "preview" ? 1 : 0.4,
                        fontSize: fontClamp(11, 1.4, 14),
                        padding: "10px 0",
                      }}
                      onClick={() => enviarOrden(num, "preview")}
                    >
                      PREV
                    </button>
                    <button
                      style={{
                        ...styles.btnTally,
                        backgroundColor: "#444",
                        opacity: infoCamara.estado === "standby" ? 1 : 0.4,
                        fontSize: fontClamp(11, 1.4, 14),
                        padding: "10px 0",
                      }}
                      onClick={() => enviarOrden(num, "standby")}
                    >
                      STBY
                    </button>
                  </div>

                  <div style={styles.alertBox}>
                    <div
                      style={{
                        ...styles.gridAlertas,
                        gap: "6px",
                        padding: "6px 0",
                      }}
                    >
                      {ALERTAS_RAPIDAS.map((alerta) => (
                        <button
                          key={alerta}
                          style={{
                            ...styles.btnAlerta,
                            padding: "8px 4px",
                            fontSize: fontClamp(10, 1.2, 12),
                          }}
                          onClick={() =>
                            enviarOrden(num, infoCamara.estado, alerta)
                          }
                        >
                          {alerta}
                        </button>
                      ))}
                    </div>

                    {/* MENSAJE LIBRE DEDICADO A ESTA CÁMARA */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        enviarMensajeLibreACamara(num, textosLibresCamara[num]);
                        setTextosLibresCamara((prev) => ({
                          ...prev,
                          [num]: "",
                        }));
                      }}
                      style={{ ...styles.formEnvioPastor, marginTop: "6px" }}
                    >
                      <input
                        type="text"
                        value={textosLibresCamara[num] || ""}
                        onChange={(e) =>
                          setTextosLibresCamara((prev) => ({
                            ...prev,
                            [num]: e.target.value,
                          }))
                        }
                        placeholder={`Mensaje a CÁMARA ${num}...`}
                        style={styles.inputPastorText}
                      />
                      <button
                        type="submit"
                        style={{
                          ...styles.btnEnviarPastor,
                          backgroundColor: "#0052cc",
                        }}
                      >
                        OK
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#141414",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
    boxSizing: "border-box",
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #2d2d2d",
    paddingBottom: "12px",
    marginBottom: "16px",
    flexShrink: 0,
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
    fontSize: "1.2rem",
    fontWeight: "800",
    textAlign: "center",
  },
  layoutPrincipal: { display: "flex", boxSizing: "border-box", minHeight: 0 },
  gridControl: { display: "grid", boxSizing: "border-box" },
  cardCamara: {
    backgroundColor: "#1e1e1e",
    borderRadius: "8px",
    border: "1px solid #2d2d2d",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mensajeDesdeCamara: {
    border: "1px solid #ff4d4d",
    color: "#ffffff",
    borderRadius: "6px",
    textAlign: "left",
    fontWeight: "bold",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 0",
  },
  btnDescartarAlerta: {
    backgroundColor: "transparent",
    color: "#ff8080",
    border: "none",
    fontSize: "1.1rem",
    fontWeight: "bold",
    cursor: "pointer",
    padding: "4px 12px",
  },
  camTitle: { margin: 0, fontWeight: "bold", color: "#aaa" },
  badge: { borderRadius: "4px", fontWeight: "900", color: "#fff" },
  tallyActions: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr" },
  btnTally: {
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    fontWeight: "900",
    cursor: "pointer",
    textAlign: "center",
  },
  alertBox: { borderTop: "1px solid #2d2d2d" },
  gridAlertas: { display: "grid", gridTemplateColumns: "1fr 1fr" },
  btnAlerta: {
    backgroundColor: "#2a2a2a",
    color: "#ffcc00",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sidebarGeneral: {
    flexShrink: 0,
    backgroundColor: "#1e1e1e",
    border: "1px solid #2d2d2d",
    borderRadius: "8px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
  },
  sidebarTitulo: {
    margin: "0 0 6px 0",
    fontWeight: "800",
    textAlign: "center",
    color: "#bbb",
  },
  btnTodas: {
    width: "100%",
    backgroundColor: "#2d2d2d",
    color: "#fff",
    border: "1px solid #3d3d3d",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  gridSeleccionCamaras: { display: "grid", gridTemplateColumns: "1fr 1fr" },
  btnSeleccionCamara: {
    color: "#fff",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  listaMensajesGenerales: { display: "flex", flexDirection: "column" },
  btnMesaenajeGeneral: {
    backgroundColor: "#2a2a2a",
    color: "#ffcc00",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "center",
  },
  formFormularioGeneral: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    borderTop: "1px solid #2d2d2d",
  },
  inputMensajeGeneral: {
    borderRadius: "4px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#141414",
    color: "#fff",
    boxSizing: "border-box",
    width: "100%",
    textAlign: "center",
  },
  btnEnviarGeneral: {
    backgroundColor: "#0052cc",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  seccionPastor: {
    backgroundColor: "#1e1e1e",
    borderRadius: "8px",
    border: "1px solid #b71c1c",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexBasis: "50%",
  },
  headerPastorControl: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pastorTitulo: { margin: 0, fontWeight: "bold" },
  buzonPastor: {
    backgroundColor: "#141414",
    borderRadius: "6px",
    padding: "6px 10px",
    border: "1px solid #2d2d2d",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minHeight: "60px",
    maxHeight: "100px",
    overflowY: "auto",
  },
  textoBuzonVacio: {
    color: "#555",
    fontSize: "0.8rem",
    margin: "auto 0",
    textAlign: "center",
  },
  itemMensajePastor: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 0, 0, 0.05)",
    padding: "4px 8px",
    borderRadius: "4px",
  },
  itemMensajePastorAlerta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "5px 8px",
    borderRadius: "4px",
    border: "1px solid #ff3333",
  },
  tagPastorOrigen: {
    color: "#ff3333",
    fontWeight: "bold",
    fontSize: "0.8rem",
    marginRight: "6px",
    flexShrink: 0,
  },
  textoMensajePastor: {
    color: "#fff",
    fontSize: "0.85rem",
    flex: 1,
    wordBreak: "break-word",
  },
  btnBorrarMsgPastor: {
    background: "transparent",
    border: "none",
    color: "#ff8080",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.8rem",
  },
  formEnvioPastor: { display: "flex", gap: "6px" },
  inputPastorText: {
    flex: 1,
    minWidth: 0,
    borderRadius: "4px",
    border: "1px solid #3a3a3a",
    backgroundColor: "#141414",
    color: "#fff",
    padding: "6px 10px",
    fontSize: "0.85rem",
    outline: "none",
  },
  btnEnviarPastor: {
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
    padding: "0 14px",
    fontSize: "0.8rem",
  },
  btnAlertaRapidaPastor: {
    backgroundColor: "#2a2a2a",
    color: "#ffcc00",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
    padding: "6px 2px",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "center",
  },
};
