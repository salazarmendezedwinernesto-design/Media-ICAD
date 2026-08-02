import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";

const SOCKET_URL = SERVER_URL;

// Frases rápidas para la "nota de siguiente". Son solo sugerencias de
// texto libre para el operador -- NUNCA incluyen versículos ni letras de
// alabanza, por decisión explícita del ministerio.
const NOTAS_RAPIDAS = [
  "Después: Ofrenda",
  "Después: Bienvenida",
  "Después: Anuncios",
  "Después: Oración",
  "Cambio de predicador",
  "Últimos 5 minutos",
];

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

function formatearReloj(fecha) {
  return fecha.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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
      <header style={estilosMenu.navbar}>
        <button style={estilosMenu.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={estilosMenu.navTitle}>🖥️ PANTALLA DE RETORNO</h1>
        <div style={{ width: 70 }} />
      </header>

      <main style={estilosMenu.opciones}>
        <p style={estilosMenu.descripcion}>
          Monitor de confianza para el escenario (como en ProPresenter, FreeShow
          u Holyrics): reloj, cronómetro/cuenta regresiva y notas cortas para
          quienes están en tarima.
        </p>

        <button
          style={{ ...estilosMenu.btnOpcion, backgroundColor: "#2563eb" }}
          onClick={() => setModo("emisor")}
        >
          🎛️ EMISOR
          <span style={estilosMenu.subtexto}>
            Controla qué se muestra (operador de pantalla)
          </span>
        </button>

        <button
          style={{ ...estilosMenu.btnOpcion, backgroundColor: "#16a34a" }}
          onClick={() => setModo("receptor")}
        >
          📺 RECEPTOR
          <span style={estilosMenu.subtexto}>
            Monitor real que va en el escenario (pantalla completa)
          </span>
        </button>
      </main>
    </div>
  );
}

// ===================== EMISOR =====================
// Panel de control: el operador decide qué se muestra en el/los monitores
// de escenario. Todo lo que aquí se manda es texto libre escrito a mano.
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
    },
    mensaje: { texto: "", visible: false },
    nota: { texto: "" },
    estilo: { colorAcento: "#f59e0b", tamano: "grande" },
  });

  const [minutosInput, setMinutosInput] = useState(5);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [textoNota, setTextoNota] = useState("");
  const [segundosVista, setSegundosVista] = useState(0);
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: obtenerToken() } });
    socketRef.current = socket;

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
    });

    return () => socket.disconnect();
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

  const iniciarRegresiva = () => {
    const duracionSegundos = Math.max(1, Math.round(minutosInput * 60));
    enviar({
      temporizador: {
        activo: true,
        modo: "regresiva",
        duracionSegundos,
        finEpoch: Date.now() + duracionSegundos * 1000,
        inicioEpoch: null,
        restanteAlPausar: null,
      },
    });
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

  const enviarNota = (texto) => {
    setTextoNota(texto);
    enviar({ nota: { texto } });
  };

  const cambiarColor = (valor) => {
    enviar({ estilo: { colorAcento: valor } });
  };

  const cambiarTamano = (id) => {
    enviar({ estilo: { tamano: id } });
  };

  const temporizadorEnMarcha = estado.temporizador.activo;
  const enPausa =
    !estado.temporizador.activo &&
    estado.temporizador.restanteAlPausar !== null;

  return (
    <div style={estilosEmisor.container}>
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
              <span style={estilosEmisor.avisoTiempo}> ⚠️ TIEMPO CUMPLIDO</span>
            )}
        </div>

        {!temporizadorEnMarcha && !enPausa && (
          <>
            <div style={estilosEmisor.filaInputMinutos}>
              <label style={estilosEmisor.etiquetaChica}>Minutos:</label>
              <input
                type="number"
                min="1"
                value={minutosInput}
                onChange={(e) => setMinutosInput(Number(e.target.value) || 1)}
                style={estilosEmisor.inputMinutos}
              />
              <button
                style={estilosEmisor.btnAccion}
                onClick={iniciarRegresiva}
              >
                ▶️ Iniciar cuenta regresiva
              </button>
            </div>
            <button
              style={{ ...estilosEmisor.btnAccion, backgroundColor: "#7c3aed" }}
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
              style={{ ...estilosEmisor.btnAccion, backgroundColor: "#dc2626" }}
              onClick={detenerTemporizador}
            >
              ⏹️ Detener
            </button>
          </div>
        )}
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
              style={{ ...estilosEmisor.btnAccion, backgroundColor: "#374151" }}
              onClick={ocultarMensaje}
            >
              Ocultar
            </button>
          </div>
        </form>
      </section>

      {/* NOTA DE SIGUIENTE */}
      <section style={estilosEmisor.tarjeta}>
        <span style={estilosEmisor.tituloTarjeta}>
          📌 NOTA (SIGUIENTE / AVISO CORTO)
        </span>
        <div style={estilosEmisor.gridNotasRapidas}>
          {NOTAS_RAPIDAS.map((n) => (
            <button
              key={n}
              style={{
                ...estilosEmisor.btnNotaRapida,
                borderColor: textoNota === n ? "#3b82f6" : "#2d303f",
              }}
              onClick={() => enviarNota(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={estilosEmisor.formMensaje}>
          <input
            type="text"
            value={textoNota}
            onChange={(e) => setTextoNota(e.target.value)}
            placeholder="Escribe una nota personalizada..."
            style={estilosEmisor.inputTexto}
          />
          <div style={estilosEmisor.filaBotonesTemporizador}>
            <button
              style={estilosEmisor.btnAccion}
              onClick={() => enviarNota(textoNota)}
            >
              📤 Aplicar nota
            </button>
            <button
              style={{ ...estilosEmisor.btnAccion, backgroundColor: "#374151" }}
              onClick={() => enviarNota("")}
            >
              Limpiar
            </button>
          </div>
        </div>
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
  const contenedorRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: obtenerToken() } });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      if (err && err.message === "No autorizado") {
        borrarToken();
        window.location.reload();
      }
    });

    socket.on("retorno:estado", (datos) => setEstado(datos));

    return () => socket.disconnect();
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

  const colorAcento = estado.estilo?.colorAcento || "#f59e0b";
  const tamano = estado.estilo?.tamano || "grande";
  const escala = tamano === "extra" ? 1.35 : 1;

  const tiempoCumplido =
    estado.temporizador.modo === "regresiva" &&
    estado.temporizador.activo &&
    segundosVista <= 0;

  return (
    <div
      ref={contenedorRef}
      style={estilosReceptor.container}
      onClick={() => setMostrarBarra((v) => !v)}
    >
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

      {estado.reloj.visible && (
        <div
          style={{
            ...estilosReceptor.reloj,
            fontSize: `clamp(${1.5 * escala}rem, ${4 * escala}vh, ${3 * escala}rem)`,
          }}
        >
          {formatearReloj(horaActual)}
        </div>
      )}

      <div style={estilosReceptor.centro}>
        {(estado.temporizador.activo ||
          estado.temporizador.restanteAlPausar !== null) && (
          <div
            style={{
              ...estilosReceptor.temporizador,
              fontSize: `clamp(${4.5 * escala}rem, ${24 * escala}vh, ${16 * escala}rem)`,
              color: tiempoCumplido ? "#ef4444" : colorAcento,
              textShadow: `0 0 ${40 * escala}px ${tiempoCumplido ? "#ef444488" : colorAcento + "66"}`,
            }}
          >
            {formatearDuracion(Math.abs(segundosVista))}
          </div>
        )}

        {estado.mensaje.visible && estado.mensaje.texto && (
          <div
            style={{
              ...estilosReceptor.mensaje,
              fontSize: `clamp(${1.8 * escala}rem, ${7 * escala}vh, ${4 * escala}rem)`,
              color: colorAcento,
            }}
          >
            {estado.mensaje.texto}
          </div>
        )}
      </div>

      {estado.nota.texto && (
        <div
          style={{
            ...estilosReceptor.nota,
            fontSize: `clamp(${1.1 * escala}rem, ${3.5 * escala}vh, ${2 * escala}rem)`,
            color: colorAcento,
          }}
        >
          {estado.nota.texto}
        </div>
      )}
    </div>
  );
}

const estilosMenu = {
  container: {
    backgroundColor: "#0b0c10",
    color: "#fff",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
    padding: "16px",
    boxSizing: "border-box",
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #1f2937",
    paddingBottom: "10px",
    marginBottom: "20px",
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
  opciones: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    justifyContent: "center",
    maxWidth: 480,
    margin: "0 auto",
    width: "100%",
  },
  descripcion: {
    color: "#6b7280",
    fontSize: "0.9rem",
    textAlign: "center",
    marginBottom: "10px",
    lineHeight: 1.5,
  },
  btnOpcion: {
    border: "none",
    borderRadius: "12px",
    padding: "20px",
    color: "#fff",
    fontSize: "1.2rem",
    fontWeight: "800",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  subtexto: { fontSize: "0.8rem", fontWeight: "500", opacity: 0.85 },
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
  gridNotasRapidas: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
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
  btnNotaRapida: {
    backgroundColor: "#1e202b",
    color: "#f59e0b",
    border: "1px solid",
    borderRadius: "8px",
    padding: "10px 8px",
    fontSize: "0.8rem",
    fontWeight: "600",
    cursor: "pointer",
  },
};

const estilosReceptor = {
  container: {
    backgroundColor: "#000",
    color: "#fff",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
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
    position: "absolute",
    top: "24px",
    right: "32px",
    fontSize: "clamp(1.5rem, 4vh, 3rem)",
    fontWeight: "900",
    fontVariantNumeric: "tabular-nums",
    color: "#9ca3af",
  },
  centro: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "24px",
    textAlign: "center",
  },
  temporizador: {
    fontSize: "clamp(4rem, 22vh, 14rem)",
    fontWeight: "900",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  mensaje: {
    fontSize: "clamp(1.5rem, 6vh, 3.5rem)",
    fontWeight: "800",
    color: "#fbbf24",
    maxWidth: "90%",
    wordBreak: "break-word",
  },
  nota: {
    position: "absolute",
    bottom: "24px",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: "clamp(1rem, 3vh, 1.8rem)",
    fontWeight: "700",
    color: "#60a5fa",
  },
};
