import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL, MEDIAMTX_WHEP_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
import MonitorRetorno from "./MonitorRetorno";
import { LOGOS } from "./logos";

const SOCKET_URL = SERVER_URL;

// Propone la ruta WHEP de Holyrics a partir de la del moderador: misma
// dirección del túnel, pero con la ruta "holyrics" en vez de la clave de
// la transmisión. Ej: https://x.trycloudflare.com/canaan2026/whep ->
// https://x.trycloudflare.com/holyrics/whep
function whepHolyricsSugerida() {
  return (MEDIAMTX_WHEP_URL || "").replace(/\/[^/]+\/whep\/?$/, "/holyrics/whep");
}

// Paleta de colores de acento para el monitor de escenario. Colores
// saturados y de alto contraste sobre fondo negro, pensados para verse
// bien de lejos bajo luces de escenario.
const PALETA_COLORES = [
  { nombre: "Ámbar", valor: "#f59e0b" },
  { nombre: "Rojo", valor: "#ef4444" },
  { nombre: "Verde lima", valor: "#a3e635" },
  { nombre: "Cian", valor: "#22d3ee" },
  { nombre: "Magenta", valor: "#ec4899" },
  { nombre: "Violeta", valor: "#a78bfa" },
  { nombre: "Blanco", valor: "#ffffff" },
];

const TAMANOS_MONITOR = [
  { id: "grande", etiqueta: "Grande" },
  { id: "extra", etiqueta: "Extra grande" },
];

// Opciones de aviso: cuántos segundos antes de llegar a 0 el monitor
// empieza a parpadear para avisar que el tiempo se está acabando.
const OPCIONES_AVISO = [
  { segundos: 10, etiqueta: "10 seg" },
  { segundos: 30, etiqueta: "30 seg" },
  { segundos: 60, etiqueta: "1 min" },
  { segundos: 120, etiqueta: "2 min" },
];

function formatearReloj(fecha) {
  let horas = fecha.getHours();
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  const segundos = String(fecha.getSeconds()).padStart(2, "0");
  const esPM = horas >= 12;
  horas = horas % 12;
  if (horas === 0) horas = 12;
  const horasStr = String(horas).padStart(2, "0");
  return `${horasStr}:${minutos}:${segundos} ${esPM ? "PM" : "AM"}`;
}

function formatearDuracion(totalSegundos) {
  const s = Math.max(0, Math.round(totalSegundos));
  const horas = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const mm = String(min).padStart(2, "0");
  const ss = String(seg).padStart(2, "0");
  return horas > 0 ? `${horas}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Calcula, a partir del estado que manda el servidor, cuántos segundos
// hay que mostrar EN ESTE INSTANTE -- así el Emisor y todos los
// Receptores quedan sincronizados sin que el servidor tenga que estar
// mandando un "tick" cada segundo.
function segundosAMostrar(temporizador) {
  const {
    activo,
    modo,
    duracionSegundos,
    finEpoch,
    inicioEpoch,
    restanteAlPausar,
  } = temporizador;

  if (!activo) {
    if (restanteAlPausar !== null && restanteAlPausar !== undefined) {
      return restanteAlPausar;
    }
    return modo === "progresiva" ? 0 : duracionSegundos;
  }

  if (modo === "progresiva") {
    return (Date.now() - inicioEpoch) / 1000;
  }
  // modo "regresiva"
  return (finEpoch - Date.now()) / 1000;
}

export default function PantallaRetorno({ alSalir }) {
  const [modo, setModo] = useState(null); // null | 'emisor' | 'receptor'

  if (modo === "emisor") {
    return <PantallaRetornoEmisor alSalir={() => setModo(null)} />;
  }
  if (modo === "receptor") {
    return <PantallaRetornoReceptor alSalir={() => setModo(null)} />;
  }

  return (
    <div style={estilosMenu.container}>
      <svg
        viewBox="0 0 800 560"
        preserveAspectRatio="xMidYMid slice"
        style={estilosMenu.fondoSvg}
        aria-hidden="true"
      >
        <rect width="800" height="560" fill="#0a0a0a" />
        <polygon points="0,0 340,0 120,560 0,560" fill="#141414" />
        <polygon points="800,560 460,560 680,0 800,0" fill="#141414" />
        <polygon points="800,560 620,560 800,280" fill="#E11D2E" opacity="0.9" />
        <polygon points="0,0 180,0 0,220" fill="#E11D2E" opacity="0.15" />
      </svg>

      <header style={estilosMenu.navbar}>
        <button style={estilosMenu.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <div style={{ width: 70 }} />
      </header>

      <main style={estilosMenu.opciones}>
        <p style={estilosMenu.descripcion}>
          Monitor de confianza para el escenario: reloj, cronómetro/cuenta
          regresiva y notas cortas para quienes están en tarima.
        </p>

        <button style={estilosMenu.btnOpcion} onClick={() => setModo("emisor")}>
          <span style={estilosMenu.iconoOpcion}>🖥️</span>
          <span style={estilosMenu.textoOpcion}>
            <span style={estilosMenu.tituloOpcion}>Emisor</span>
            <span style={estilosMenu.subtexto}>
              Controla qué se muestra (operador de pantalla)
            </span>
          </span>
          <span style={estilosMenu.flechaOpcion}>›</span>
        </button>

        <button style={estilosMenu.btnOpcion} onClick={() => setModo("receptor")}>
          <span style={estilosMenu.iconoOpcion}>📺</span>
          <span style={estilosMenu.textoOpcion}>
            <span style={estilosMenu.tituloOpcion}>Receptor</span>
            <span style={estilosMenu.subtexto}>
              Monitor real que va en el escenario (pantalla completa)
            </span>
          </span>
          <span style={estilosMenu.flechaOpcion}>›</span>
        </button>
      </main>
    </div>
  );
}

// ===================== EMISOR =====================
// Panel de control: el operador decide qué se muestra en el/los monitores
// de escenario. Todo lo que aquí se manda es texto libre escrito a mano.
// (Ya no hay conexión de video vía OBS/RTMP: ese flujo no se usa en la
// Pantalla de Retorno, así que se quitó por completo de este panel.)
function PantallaRetornoEmisor({ alSalir }) {
  const socketRef = useRef(null);

  const [estado, setEstado] = useState({
    reloj: { visible: true },
    temporizador: {
      activo: false,
      modo: "regresiva",
      duracionSegundos: 300,
      finEpoch: null,
      inicioEpoch: null,
      restanteAlPausar: null,
      avisoSegundos: 30,
    },
    mensaje: { texto: "", visible: false },
    nota: { texto: "" },
    estilo: { colorAcento: "#f59e0b", tamano: "grande" },
    marca: { logoId: "asambleas-de-dios", nombre: "", pais: "" },
    holyrics: {
      activo: false,
      url: "",
      disposicion: "completa",
      fuente: "enlace",
      whepUrl: "",
    },
  });

  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  const [minutosInput, setMinutosInput] = useState(5);
  const [avisoInput, setAvisoInput] = useState(30);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [urlHolyricsInput, setUrlHolyricsInput] = useState("");
  const [whepHolyricsInput, setWhepHolyricsInput] = useState("");
  const [segundosVista, setSegundosVista] = useState(0);
  const [confirmacion, setConfirmacion] = useState("");
  const [conectado, setConectado] = useState(true);
  const [conteoReceptores, setConteoReceptores] = useState(0);
  const [horaActualPreview, setHoraActualPreview] = useState(new Date());

  // Tiempos programados (presets de contador con nombre), guardados en
  // este navegador.
  const [presets, setPresets] = useState([]);
  const [presetNombreInput, setPresetNombreInput] = useState("");
  const [presetMinutosInput, setPresetMinutosInput] = useState(10);

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: obtenerToken() } });
    socketRef.current = socket;

    socket.on("connect", () => setConectado(true));
    socket.on("disconnect", () => setConectado(false));

    socket.on("connect_error", (err) => {
      if (err && err.message === "No autorizado") {
        borrarToken();
        window.location.reload();
      }
    });

    socket.on("retorno:estado", (datos) => {
      if (!datos) return;
      setEstado(datos);
      setTextoMensaje(datos.mensaje?.texto || "");
      setTextoNota(datos.nota?.texto || "");
      setNombreMarcaInput(datos.marca?.nombre || "");
      setPaisMarcaInput(datos.marca?.pais || "");
      setUrlHolyricsInput(datos.holyrics?.url || "");
      setWhepHolyricsInput(
        datos.holyrics?.whepUrl || whepHolyricsSugerida(),
      );
    });

    socket.on("retorno:conteoReceptores", (n) => setConteoReceptores(n));

    // Tiempos programados compartidos: llegan del servidor, así se ven
    // iguales en todos los dispositivos.
    socket.on("retorno:presets", (lista) => {
      if (Array.isArray(lista)) setPresets(lista);
    });

    return () => socket.disconnect();
  }, []);

  // Reloj de la vista previa (para que el mini-monitor también muestre la
  // hora corriendo, igual que el Receptor real).
  useEffect(() => {
    const intervalo = setInterval(() => setHoraActualPreview(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  // Refresca el número que muestra el propio Emisor (vista previa) cada
  // 250ms mientras el temporizador está corriendo.
  useEffect(() => {
    if (!estado.temporizador.activo) {
      setSegundosVista(segundosAMostrar(estado.temporizador));
      return;
    }
    const intervalo = setInterval(() => {
      setSegundosVista(segundosAMostrar(estado.temporizador));
    }, 250);
    return () => clearInterval(intervalo);
  }, [estado.temporizador]);

  const enviar = (parcial) => {
    socketRef.current?.emit("retorno:actualizar", {
      de: "Pantalla / Emisor",
      ...parcial,
    });
    setConfirmacion("✅ Enviado al monitor");
    setTimeout(() => setConfirmacion(""), 1500);
  };

  const toggleReloj = () => {
    enviar({ reloj: { visible: !estado.reloj.visible } });
  };

  // "minutosOverride" permite iniciar la cuenta con un valor distinto al
  // que está escrito en el input (lo usan los tiempos programados/presets).
  const iniciarRegresiva = (minutosOverride) => {
    const minutos =
      typeof minutosOverride === "number" ? minutosOverride : minutosInput;
    const duracionSegundos = Math.max(1, Math.round((Number(minutos) || 0) * 60));
    enviar({
      temporizador: {
        activo: true,
        modo: "regresiva",
        duracionSegundos,
        finEpoch: Date.now() + duracionSegundos * 1000,
        inicioEpoch: null,
        restanteAlPausar: null,
        avisoSegundos: avisoInput,
      },
    });
  };

  // Permite cambiar el umbral de aviso incluso con el temporizador ya
  // corriendo, sin reiniciar la cuenta.
  const cambiarAviso = (segundos) => {
    setAvisoInput(segundos);
    enviar({ temporizador: { avisoSegundos: segundos } });
  };

  const iniciarCronometro = () => {
    enviar({
      temporizador: {
        activo: true,
        modo: "progresiva",
        inicioEpoch: Date.now(),
        finEpoch: null,
        restanteAlPausar: null,
      },
    });
  };

  const pausarTemporizador = () => {
    const restante = segundosAMostrar(estado.temporizador);
    enviar({
      temporizador: {
        activo: false,
        restanteAlPausar: restante,
      },
    });
  };

  const reanudarTemporizador = () => {
    const restante = estado.temporizador.restanteAlPausar || 0;
    if (estado.temporizador.modo === "progresiva") {
      enviar({
        temporizador: {
          activo: true,
          inicioEpoch: Date.now() - restante * 1000,
          restanteAlPausar: null,
        },
      });
    } else {
      enviar({
        temporizador: {
          activo: true,
          finEpoch: Date.now() + restante * 1000,
          restanteAlPausar: null,
        },
      });
    }
  };

  const detenerTemporizador = () => {
    enviar({
      temporizador: {
        activo: false,
        finEpoch: null,
        inicioEpoch: null,
        restanteAlPausar: null,
      },
    });
  };

  const enviarMensaje = (e) => {
    e.preventDefault();
    enviar({
      mensaje: { texto: textoMensaje.trim(), visible: !!textoMensaje.trim() },
    });
  };

  const ocultarMensaje = () => {
    setTextoMensaje("");
    enviar({ mensaje: { texto: "", visible: false } });
  };

  const cambiarColor = (valor) => {
    enviar({ estilo: { colorAcento: valor } });
  };

  const cambiarTamano = (id) => {
    enviar({ estilo: { tamano: id } });
  };

  // --- Holyrics -----------------------------------------------------
  const guardarUrlHolyrics = (e) => {
    e?.preventDefault();
    const url = urlHolyricsInput.trim();
    // Al pegar un enlace nuevo se activa de inmediato; si se deja vacío
    // el servidor lo desactiva.
    enviar({ holyrics: { url, activo: url !== "" } });
  };

  const toggleHolyrics = () => {
    enviar({ holyrics: { activo: !estado.holyrics?.activo } });
  };

  const cambiarFuenteHolyrics = (fuente) => {
    enviar({ holyrics: { fuente } });
  };

  const guardarWhepHolyrics = (e) => {
    e?.preventDefault();
    enviar({
      holyrics: {
        whepUrl: whepHolyricsInput.trim(),
        fuente: "video",
        activo: whepHolyricsInput.trim() !== "",
      },
    });
  };

  const cambiarDisposicionHolyrics = (disposicion) => {
    enviar({ holyrics: { disposicion } });
  };

  // --- Marca / Logo -------------------------------------------------
  const seleccionarLogo = (logoId) => {
    enviar({ marca: { logoId } });
  };

  // --- Tiempos programados (presets) --------------------------------
  const agregarPreset = () => {
    const nombre = presetNombreInput.trim();
    if (!nombre) return;
    const minutos = Math.max(1, Math.round(Number(presetMinutosInput)) || 1);
    socketRef.current?.emit("retorno:presets:agregar", { nombre, minutos });
    setPresetNombreInput("");
  };

  const eliminarPreset = (id) => {
    socketRef.current?.emit("retorno:presets:eliminar", id);
  };

  const iniciarPreset = (preset) => {
    iniciarRegresiva(preset.minutos);
  };

  const temporizadorEnMarcha = estado.temporizador.activo;
  const enPausa =
    !estado.temporizador.activo &&
    estado.temporizador.restanteAlPausar !== null;

  // Mismo cálculo que en el Receptor, para que la vista previa parpadee
  // exactamente en el mismo momento que el monitor real de tarima.
  const avisoSegundosPreview = estado.temporizador.avisoSegundos ?? 30;
  const tiempoCumplidoPreview =
    estado.temporizador.modo === "regresiva" &&
    estado.temporizador.activo &&
    segundosVista <= 0;
  const enAlertaPreview =
    estado.temporizador.modo === "regresiva" &&
    estado.temporizador.activo &&
    !tiempoCumplidoPreview &&
    segundosVista > 0 &&
    segundosVista <= avisoSegundosPreview;

  return (
    <div style={estilosEmisor.container}>
      <style>{ESTILOS_ANIMACION}</style>
      <header style={estilosEmisor.navbar}>
        <button style={estilosEmisor.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={estilosEmisor.navTitle}>🎛️ EMISOR · PANTALLA DE RETORNO</h1>
        <div style={{ width: 70 }} />
      </header>

      {confirmacion && (
        <div style={estilosEmisor.bannerConfirmacion}>{confirmacion}</div>
      )}

      {/* Layout adaptable: en pantallas angostas (celular) todo queda en
          una sola columna con la vista previa arriba; en pantallas anchas
          (PC/tablet) los controles van a la izquierda y la vista previa +
          estado de conexión quedan fijos a la derecha. */}
      <div style={estilosEmisor.grid}>
        <aside style={estilosEmisor.columnaLateral}>
          {/* ESTADO DE CONEXIÓN */}
          <section style={estilosEmisor.tarjeta}>
            <span style={estilosEmisor.tituloTarjeta}>
              📡 ESTADO DE CONEXIÓN
            </span>
            <div style={estilosEmisor.filaConexion}>
              <span
                style={{
                  ...estilosEmisor.puntoConexion,
                  backgroundColor: conectado ? "#22c55e" : "#ef4444",
                }}
              />
              <span style={{ fontWeight: 700 }}>
                {conectado ? "Conectado al servidor" : "Sin conexión…"}
              </span>
            </div>
            <span style={estilosEmisor.etiquetaChica}>
              {conteoReceptores === 0
                ? "📺 Ningún monitor conectado todavía"
                : `📺 ${conteoReceptores} monitor${conteoReceptores > 1 ? "es" : ""} de escenario conectado${conteoReceptores > 1 ? "s" : ""}`}
            </span>
          </section>

          {/* VISTA PREVIA DEL MONITOR REAL */}
          <section style={estilosEmisor.tarjeta}>
            <span style={estilosEmisor.tituloTarjeta}>
              👁️ VISTA PREVIA DEL MONITOR
            </span>
            <div style={estilosEmisor.cajaPreview}>
              <MonitorRetorno
                estado={estado}
                horaActual={horaActualPreview}
                segundosVista={segundosVista}
                tiempoCumplido={tiempoCumplidoPreview}
                enAlerta={enAlertaPreview}
                modoPreview
              />
            </div>
            <span style={estilosEmisor.etiquetaChica}>
              Así se ve ahora mismo en el monitor real.
            </span>
          </section>
        </aside>

        <div style={estilosEmisor.columnaControles}>
          {/* RELOJ */}
          <section style={estilosEmisor.tarjeta}>
            <div style={estilosEmisor.filaTitulo}>
              <span style={estilosEmisor.tituloTarjeta}>🕒 RELOJ</span>
              <button
                style={{
                  ...estilosEmisor.btnToggle,
                  backgroundColor: estado.reloj.visible ? "#16a34a" : "#374151",
                }}
                onClick={toggleReloj}
              >
                {estado.reloj.visible ? "Visible en monitor" : "Oculto"}
              </button>
            </div>
          </section>

          {/* TEMPORIZADOR */}
          <section style={estilosEmisor.tarjeta}>
            <span style={estilosEmisor.tituloTarjeta}>
              ⏱️ CRONÓMETRO / CUENTA REGRESIVA
            </span>

            <div style={estilosEmisor.vistaTemporizador}>
              {formatearDuracion(segundosVista)}
              {estado.temporizador.modo === "regresiva" &&
                segundosVista <= 0 &&
                temporizadorEnMarcha && (
                  <span style={estilosEmisor.avisoTiempo}>
                    {" "}
                    ⚠️ TIEMPO CUMPLIDO
                  </span>
                )}
            </div>

            <div>
              <span style={estilosEmisor.etiquetaChica}>
                🚨 Avisar (pantalla parpadea) cuando falten:
              </span>
              <div style={estilosEmisor.filaBotonesTemporizador}>
                {OPCIONES_AVISO.map((op) => (
                  <button
                    key={op.segundos}
                    onClick={() => cambiarAviso(op.segundos)}
                    style={{
                      ...estilosEmisor.btnAccion,
                      padding: "8px",
                      fontSize: "0.8rem",
                      backgroundColor:
                        (estado.temporizador.avisoSegundos ?? avisoInput) ===
                        op.segundos
                          ? "#dc2626"
                          : "#374151",
                    }}
                  >
                    {op.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            {!temporizadorEnMarcha && !enPausa && (
              <>
                <div style={estilosEmisor.filaInputMinutos}>
                  <label style={estilosEmisor.etiquetaChica}>Minutos:</label>
                  <input
                    type="number"
                    min="1"
                    value={minutosInput}
                    onChange={(e) => {
                      const valor = e.target.value;
                      setMinutosInput(valor === "" ? "" : Number(valor));
                    }}
                    style={estilosEmisor.inputMinutos}
                  />
                  <button
                    style={estilosEmisor.btnAccion}
                    onClick={() => iniciarRegresiva()}
                  >
                    ▶️ Iniciar cuenta regresiva
                  </button>
                </div>
                <button
                  style={{
                    ...estilosEmisor.btnAccion,
                    backgroundColor: "#7c3aed",
                  }}
                  onClick={iniciarCronometro}
                >
                  ▶️ Iniciar cronómetro (cuenta hacia arriba)
                </button>
              </>
            )}

            {(temporizadorEnMarcha || enPausa) && (
              <div style={estilosEmisor.filaBotonesTemporizador}>
                {temporizadorEnMarcha ? (
                  <button
                    style={{
                      ...estilosEmisor.btnAccion,
                      backgroundColor: "#d97706",
                    }}
                    onClick={pausarTemporizador}
                  >
                    ⏸️ Pausar
                  </button>
                ) : (
                  <button
                    style={{
                      ...estilosEmisor.btnAccion,
                      backgroundColor: "#16a34a",
                    }}
                    onClick={reanudarTemporizador}
                  >
                    ▶️ Reanudar
                  </button>
                )}
                <button
                  style={{
                    ...estilosEmisor.btnAccion,
                    backgroundColor: "#dc2626",
                  }}
                  onClick={detenerTemporizador}
                >
                  ⏹️ Detener
                </button>
              </div>
            )}
          </section>

          {/* TIEMPOS PROGRAMADOS (presets de contador con nombre) */}
          <section style={estilosEmisor.tarjeta}>
            <span style={estilosEmisor.tituloTarjeta}>
              🗂️ TIEMPOS PROGRAMADOS
            </span>
            <span style={estilosEmisor.etiquetaChica}>
              Guarda de una vez los tiempos que usas seguido (ej. "Alabanza" 20
              min, "Prédica" 45 min) y arráncalos con un clic el día del evento,
              sin escribir minutos cada vez.
            </span>

            {presets.length > 0 && (
              <div style={estilosEmisor.listaPresets}>
                {presets.map((p) => (
                  <div key={p.id} style={estilosEmisor.filaPreset}>
                    <span style={estilosEmisor.nombrePreset}>
                      {p.nombre}
                      <span style={estilosEmisor.minutosPreset}>
                        {" "}
                        · {p.minutos} min
                      </span>
                    </span>
                    <div style={estilosEmisor.botonesPreset}>
                      <button
                        style={{
                          ...estilosEmisor.btnAccion,
                          padding: "8px 12px",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => iniciarPreset(p)}
                      >
                        ▶️ Iniciar
                      </button>
                      <button
                        style={estilosEmisor.btnEliminarPreset}
                        title="Eliminar este tiempo programado"
                        onClick={() => eliminarPreset(p.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={estilosEmisor.filaInputMinutos}>
              <input
                type="text"
                value={presetNombreInput}
                onChange={(e) => setPresetNombreInput(e.target.value)}
                placeholder="Nombre (ej: Alabanza)"
                style={{ ...estilosEmisor.inputTexto, flex: 1 }}
              />
              <input
                type="number"
                min="1"
                value={presetMinutosInput}
                onChange={(e) => {
                  const valor = e.target.value;
                  setPresetMinutosInput(valor === "" ? "" : Number(valor));
                }}
                style={estilosEmisor.inputMinutos}
              />
              <button style={estilosEmisor.btnAccion} onClick={agregarPreset}>
                💾 Guardar
              </button>
            </div>
          </section>

          {/* MENSAJE PERSONALIZADO */}
          <section style={estilosEmisor.tarjeta}>
            <span style={estilosEmisor.tituloTarjeta}>
              💬 MENSAJE PARA EL ESCENARIO
            </span>
            <form onSubmit={enviarMensaje} style={estilosEmisor.formMensaje}>
              <input
                type="text"
                value={textoMensaje}
                onChange={(e) => setTextoMensaje(e.target.value)}
                placeholder="Ej: 2 minutos y entramos, Ajusta el micrófono..."
                style={estilosEmisor.inputTexto}
              />
              <div style={estilosEmisor.filaBotonesTemporizador}>
                <button type="submit" style={estilosEmisor.btnAccion}>
                  📤 Mostrar en monitor
                </button>
                <button
                  type="button"
                  style={{
                    ...estilosEmisor.btnAccion,
                    backgroundColor: "#374151",
                  }}
                  onClick={ocultarMensaje}
                >
                  Ocultar
                </button>
              </div>
            </form>
          </section>
          {/* HOLYRICS */}
          <section style={estilosEmisor.tarjeta}>
            <div style={estilosEmisor.filaTitulo}>
              <span style={estilosEmisor.tituloTarjeta}>
                📖 HOLYRICS (letras, versículos, imágenes y videos)
              </span>
              <button
                type="button"
                style={{
                  ...estilosEmisor.btnToggle,
                  backgroundColor: estado.holyrics?.activo
                    ? "#16a34a"
                    : "#374151",
                }}
                onClick={toggleHolyrics}
                disabled={
                  estado.holyrics?.fuente === "video"
                    ? !estado.holyrics?.whepUrl
                    : !estado.holyrics?.url
                }
              >
                {estado.holyrics?.activo ? "ACTIVO" : "APAGADO"}
              </button>
            </div>
            <div style={estilosEmisor.filaBotonesTemporizador}>
              {[
                { id: "video", etiqueta: "🎥 Video de pantalla (todo)" },
                { id: "enlace", etiqueta: "🔗 Enlace web" },
              ].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  style={{
                    ...estilosEmisor.btnAccion,
                    backgroundColor:
                      (estado.holyrics?.fuente || "enlace") === op.id
                        ? "#2563eb"
                        : "#374151",
                  }}
                  onClick={() => cambiarFuenteHolyrics(op.id)}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>

            {(estado.holyrics?.fuente || "enlace") === "video" ? (
              <form
                onSubmit={guardarWhepHolyrics}
                style={estilosEmisor.formMensaje}
              >
                <input
                  type="url"
                  value={whepHolyricsInput}
                  onChange={(e) => setWhepHolyricsInput(e.target.value)}
                  placeholder="https://TU-TUNEL.trycloudflare.com/holyrics/whep"
                  style={estilosEmisor.inputTexto}
                />
                <div style={estilosEmisor.filaBotonesTemporizador}>
                  <button type="submit" style={estilosEmisor.btnAccion}>
                    🎥 Conectar y mostrar
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={guardarUrlHolyrics}
                style={estilosEmisor.formMensaje}
              >
                <input
                  type="url"
                  value={urlHolyricsInput}
                  onChange={(e) => setUrlHolyricsInput(e.target.value)}
                  placeholder="Pega aquí el enlace de salida web de Holyrics"
                  style={estilosEmisor.inputTexto}
                />
                <div style={estilosEmisor.filaBotonesTemporizador}>
                  <button type="submit" style={estilosEmisor.btnAccion}>
                    🔗 Conectar y mostrar
                  </button>
                </div>
              </form>
            )}
            <div style={estilosEmisor.filaBotonesTemporizador}>
              {[
                { id: "completa", etiqueta: "Pantalla completa" },
                { id: "dividida", etiqueta: "Dividida" },
              ].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  style={{
                    ...estilosEmisor.btnAccion,
                    backgroundColor:
                      (estado.holyrics?.disposicion || "completa") === op.id
                        ? "#2563eb"
                        : "#374151",
                  }}
                  onClick={() => cambiarDisposicionHolyrics(op.id)}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>
            <span style={estilosEmisor.etiquetaChica}>
              Video: muestra la pantalla pública de Holyrics tal cual (letras,
              versículos, imágenes y videos) y funciona por internet. Enlace:
              solo texto e imágenes, y requiere ver Holyrics en la misma red.
            </span>
          </section>

          {/* APARIENCIA DEL MONITOR */}
          <section style={estilosEmisor.tarjeta}>
            <span style={estilosEmisor.tituloTarjeta}>
              🎨 APARIENCIA DEL MONITOR
            </span>

            <span style={estilosEmisor.etiquetaChica}>Color de acento:</span>
            <div style={estilosEmisor.gridColores}>
              {PALETA_COLORES.map((c) => (
                <button
                  key={c.valor}
                  title={c.nombre}
                  onClick={() => cambiarColor(c.valor)}
                  style={{
                    ...estilosEmisor.swatchColor,
                    backgroundColor: c.valor,
                    outline:
                      estado.estilo?.colorAcento === c.valor
                        ? "3px solid #fff"
                        : "3px solid transparent",
                  }}
                />
              ))}
            </div>

            <span style={estilosEmisor.etiquetaChica}>Tamaño del texto:</span>
            <div style={estilosEmisor.filaBotonesTemporizador}>
              {TAMANOS_MONITOR.map((t) => (
                <button
                  key={t.id}
                  onClick={() => cambiarTamano(t.id)}
                  style={{
                    ...estilosEmisor.btnAccion,
                    backgroundColor:
                      estado.estilo?.tamano === t.id ? "#2563eb" : "#374151",
                  }}
                >
                  {t.etiqueta}
                </button>
              ))}
            </div>
          </section>

          {/* MARCA / LOGO (arriba a la izquierda del monitor) */}
          <section style={estilosEmisor.tarjeta}>
            <span style={estilosEmisor.tituloTarjeta}>🖼️ MARCA / LOGO</span>
            <span style={estilosEmisor.etiquetaChica}>
              Elige qué logo usar. Aparece arriba a la izquierda del monitor de
              escenario.
            </span>

            <span style={estilosEmisor.etiquetaChica}>Logo a usar:</span>
            <div style={estilosEmisor.gridLogos}>
              {LOGOS.map((logo) => (
                <button
                  key={logo.id}
                  onClick={() => seleccionarLogo(logo.id)}
                  style={{
                    ...estilosEmisor.btnLogo,
                    borderColor:
                      (estado.marca?.logoId || "asambleas-de-dios") === logo.id
                        ? "#2563eb"
                        : "#2d303f",
                  }}
                >
                  {logo.imagen ? (
                    <img
                      src={logo.imagen}
                      alt={logo.nombre}
                      style={estilosEmisor.previewLogoImg}
                    />
                  ) : (
                    <span style={estilosEmisor.previewLogoPlaceholder}>🖼️</span>
                  )}
                  <span>{logo.nombre}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
// Esto es lo que se pone a pantalla completa en el monitor/tablet del
// escenario. Diseño de alto contraste, texto grande, para leerse de lejos.
function PantallaRetornoReceptor({ alSalir }) {
  const socketRef = useRef(null);
  const [estado, setEstado] = useState(null);
  const [horaActual, setHoraActual] = useState(new Date());
  const [segundosVista, setSegundosVista] = useState(0);
  const [mostrarBarra, setMostrarBarra] = useState(true);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);
  const [conectado, setConectado] = useState(true);
  const contenedorRef = useRef(null);
  // Screen Wake Lock: evita que la tablet/celular en tarima apague o
  // bloquee la pantalla solo (mismo patrón que en SalaAudio.jsx). Sin
  // esto, el monitor se puede quedar en negro a media prédica.
  const wakeLockRef = useRef(null);

  const pedirWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (e) {
      // Puede fallar si la pestaña no está visible en ese instante o el
      // navegador no lo soporta; no es un error fatal, seguimos igual.
      console.warn("No se pudo activar Wake Lock:", e);
    }
  };

  const soltarWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }
    } catch (e) {
      /* ya se soltó solo o no existía */
    } finally {
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: obtenerToken() } });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConectado(true);
      // Se re-anuncia como Receptor en cada conexión (también en
      // reconexiones, porque el socket.id cambia cada vez).
      socket.emit("retorno:soyReceptor");
    });
    socket.on("disconnect", () => setConectado(false));

    socket.on("connect_error", (err) => {
      if (err && err.message === "No autorizado") {
        borrarToken();
        window.location.reload();
      }
    });

    socket.on("retorno:estado", (datos) => setEstado(datos));

    pedirWakeLock();

    return () => {
      soltarWakeLock();
      socket.disconnect();
    };
  }, []);

  // Re-solicita el Wake Lock cuando la pestaña vuelve a estar visible: el
  // navegador lo suelta solo al pasar a segundo plano (ej. al bloquear el
  // celular), así que hay que pedirlo de nuevo apenas vuelve a mostrarse.
  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        pedirWakeLock();
      }
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () =>
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!estado) return;
    setSegundosVista(segundosAMostrar(estado.temporizador));
    const intervalo = setInterval(() => {
      setSegundosVista(segundosAMostrar(estado.temporizador));
    }, 250);
    return () => clearInterval(intervalo);
  }, [estado]);

  // Escucha cambios de pantalla completa (ej. si el usuario la cierra con
  // Esc en vez de con el botón) para mantener el ícono/estado correctos.
  useEffect(() => {
    const manejarCambio = () =>
      setEnPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", manejarCambio);
    return () =>
      document.removeEventListener("fullscreenchange", manejarCambio);
  }, []);

  const alternarPantallaCompleta = async (e) => {
    e.stopPropagation();
    try {
      if (!document.fullscreenElement) {
        await contenedorRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Algunos navegadores (ej. Safari iOS viejo) no soportan la API;
      // el monitor sigue funcionando igual, solo sin ocultar la barra del navegador.
    }
  };

  if (!estado) {
    return (
      <div style={estilosReceptor.container}>
        <p style={{ color: "#374151" }}>Conectando al monitor de escenario…</p>
      </div>
    );
  }

  const avisoSegundos = estado.temporizador.avisoSegundos ?? 30;

  const tiempoCumplido =
    estado.temporizador.modo === "regresiva" &&
    estado.temporizador.activo &&
    segundosVista <= 0;

  // Últimos segundos antes de llegar a 0: la pantalla empieza a avisar
  // (parpadeo suave) para que quien está en tarima note el cambio sin
  // tener que estar mirando fijo el número.
  const enAlerta =
    estado.temporizador.modo === "regresiva" &&
    estado.temporizador.activo &&
    !tiempoCumplido &&
    segundosVista > 0 &&
    segundosVista <= avisoSegundos;

  return (
    <div
      ref={contenedorRef}
      style={{
        ...estilosReceptor.container,
        ...(tiempoCumplido ? estilosReceptor.flashCumplido : {}),
      }}
      onClick={() => setMostrarBarra((v) => !v)}
    >
      <style>{ESTILOS_ANIMACION}</style>

      <MonitorRetorno
        estado={estado}
        horaActual={horaActual}
        segundosVista={segundosVista}
        tiempoCumplido={tiempoCumplido}
        enAlerta={enAlerta}
      />

      {/* Indicador discreto de conexión: verde = conectado al servidor,
          rojo parpadeante = se perdió la conexión (ej. wifi cortado o
          Render dormido). Se queda visible aunque se oculte la barra de
          arriba, porque si el monitor se desconecta hay que notarlo. */}
      <div
        title={conectado ? "Conectado" : "Sin conexión"}
        style={{
          ...estilosReceptor.puntoConexion,
          backgroundColor: conectado ? "#22c55e" : "#ef4444",
          animation: conectado
            ? "none"
            : "retornoParpadeoFuerte 0.8s ease-in-out infinite",
        }}
      />

      {mostrarBarra && (
        <div style={estilosReceptor.barraSuperior}>
          <button
            style={estilosReceptor.btnVolver}
            onClick={(e) => {
              e.stopPropagation();
              alSalir();
            }}
          >
            ⬅️
          </button>
          <button
            style={estilosReceptor.btnVolver}
            onClick={alternarPantallaCompleta}
          >
            {enPantallaCompleta
              ? "🗗 Salir de pantalla completa"
              : "⛶ Pantalla completa"}
          </button>
        </div>
      )}

      {tiempoCumplido && !estado.holyrics?.activo && (
        <div style={estilosReceptor.avisoCumplidoTexto}>TIEMPO CUMPLIDO</div>
      )}
    </div>
  );
}

// Animaciones del monitor de escenario (Receptor). Se inyectan con una
// etiqueta <style> porque los @keyframes no se pueden expresar con
// estilos en línea de React.
const ESTILOS_ANIMACION = `
@keyframes retornoParpadeoSuave {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@keyframes retornoParpadeoFuerte {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
}
@keyframes retornoFlashFondo {
  0%, 100% { background-color: #000; }
  50% { background-color: #450a0a; }
}
`;

const estilosMenu = {
  container: {
    position: "relative",
    backgroundColor: "#0a0a0a",
    color: "#fff",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    padding: "16px",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  fondoSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  navbar: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "10px",
    marginBottom: "20px",
  },
  btnVolver: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "500",
    padding: "8px 14px",
    fontSize: "13px",
  },
  opciones: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    justifyContent: "center",
    maxWidth: 420,
    margin: "0 auto",
    width: "100%",
  },
  descripcion: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "13px",
    textAlign: "center",
    marginBottom: "18px",
    lineHeight: 1.5,
  },
  btnOpcion: {
    borderLeft: "3px solid #E11D2E",
    borderRadius: "0 8px 8px 0",
    backgroundColor: "#141414",
    padding: "16px 18px",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
  },
  iconoOpcion: {
    fontSize: "18px",
    flexShrink: 0,
  },
  textoOpcion: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
  },
  tituloOpcion: {
    fontSize: "15px",
    fontWeight: 500,
    color: "#fff",
  },
  flechaOpcion: {
    fontSize: "18px",
    color: "rgba(255,255,255,0.35)",
    flexShrink: 0,
  },
  subtexto: {
    fontSize: "12px",
    fontWeight: 400,
    color: "rgba(255,255,255,0.45)",
  },
};

const estilosEmisor = {
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
    fontSize: "1.05rem",
    fontWeight: "800",
    color: "#9ca3af",
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
  // Layout adaptable con flexbox: cada columna tiene un "flex-basis"
  // mínimo, así que en pantallas angostas (celular) se apilan solas en
  // una sola columna, y en pantallas anchas (PC/tablet) quedan una al
  // lado de la otra -- sin necesidad de media queries.
  grid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-start",
  },
  columnaControles: {
    flex: "2 1 380px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  columnaLateral: {
    flex: "1 1 300px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    position: "sticky",
    top: "12px",
  },
  filaConexion: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  puntoConexion: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  cajaPreview: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    backgroundColor: "#000",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    overflow: "hidden",
    containerType: "size",
  },
  tarjeta: {
    backgroundColor: "#11121a",
    borderRadius: "12px",
    padding: "14px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  filaTitulo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tituloTarjeta: {
    fontSize: "0.8rem",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#6b7280",
  },
  btnToggle: {
    border: "none",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  vistaTemporizador: {
    fontSize: "2.2rem",
    fontWeight: "900",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  avisoTiempo: { fontSize: "0.9rem", color: "#ef4444", display: "block" },
  filaInputMinutos: { display: "flex", gap: "8px", alignItems: "center" },
  etiquetaChica: { fontSize: "0.8rem", color: "#9ca3af" },
  inputMinutos: {
    width: "70px",
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "6px",
    color: "#fff",
    padding: "10px",
    fontSize: "1rem",
  },
  filaBotonesTemporizador: { display: "flex", gap: "8px" },
  btnAccion: {
    flex: 1,
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "0.9rem",
    fontWeight: "700",
    cursor: "pointer",
  },
  formMensaje: { display: "flex", flexDirection: "column", gap: "8px" },
  inputTexto: {
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    color: "#fff",
    padding: "12px",
    fontSize: "0.95rem",
    outline: "none",
  },
  gridColores: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  swatchColor: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "1px solid #2d303f",
    cursor: "pointer",
  },
  gridLogos: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  btnLogo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e202b",
    border: "2px solid #2d303f",
    borderRadius: "8px",
    padding: "10px",
    minWidth: "90px",
    cursor: "pointer",
    color: "#fff",
    fontSize: "0.75rem",
    fontWeight: "600",
    textAlign: "center",
  },
  previewLogoImg: {
    width: "36px",
    height: "36px",
    objectFit: "contain",
  },
  previewLogoPlaceholder: {
    fontSize: "1.5rem",
    lineHeight: 1,
  },
  listaPresets: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  filaPreset: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    backgroundColor: "#1e202b",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    padding: "8px 12px",
  },
  nombrePreset: {
    fontWeight: "700",
    fontSize: "0.9rem",
  },
  minutosPreset: {
    fontWeight: "500",
    color: "#9ca3af",
  },
  botonesPreset: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  btnEliminarPreset: {
    backgroundColor: "#374151",
    border: "none",
    borderRadius: "6px",
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
};

const estilosReceptor = {
  container: {
    backgroundColor: "#000",
    color: "#fff",
    minHeight: "100vh",
    width: "100%",
    maxWidth: "1800px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    padding: "24px",
    boxSizing: "border-box",
    position: "relative",
    cursor: "pointer",
  },
  barraSuperior: {
    position: "absolute",
    top: "16px",
    left: "16px",
    right: "16px",
    display: "flex",
    justifyContent: "space-between",
    zIndex: 10,
  },
  btnVolver: {
    backgroundColor: "rgba(31,41,55,0.7)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    padding: "10px 14px",
    fontSize: "1rem",
  },
  reloj: {
    fontWeight: "900",
    fontVariantNumeric: "tabular-nums",
    color: "#9ca3af",
    whiteSpace: "nowrap",
  },
  temporizador: {
    fontWeight: "900",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  mensaje: {
    fontWeight: "800",
    maxWidth: "90vw",
    wordBreak: "break-word",
    textAlign: "center",
  },
  nota: {
    fontWeight: "700",
    whiteSpace: "nowrap",
  },
  flashCumplido: {
    animation: "retornoFlashFondo 0.6s steps(1) infinite",
  },
  avisoCumplidoTexto: {
    position: "absolute",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    color: "#ef4444",
    fontSize: "1.4rem",
    fontWeight: "800",
    letterSpacing: "2px",
    animation: "retornoParpadeoFuerte 0.6s steps(1) infinite",
    zIndex: 3,
  },
  puntoConexion: {
    position: "absolute",
    bottom: "10px",
    left: "10px",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    zIndex: 20,
    opacity: 0.7,
  },
};