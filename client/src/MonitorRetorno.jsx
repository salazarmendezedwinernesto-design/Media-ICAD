import React from "react";
import { buscarLogo } from "./logos";

/**
 * MonitorRetorno
 * ---------------------------------------------------------------------
 * Diseño de tarjetas (branding + cronómetro / hora / mensaje) que se usa
 * en DOS lugares con el mismo JSX, para que la vista previa del Emisor
 * sea un espejo fiel de lo que ve el Receptor real:
 *
 *   - Dentro de la "Vista previa del monitor" del Emisor (chica, dentro
 *     de una tarjeta) -> modoPreview = true, usa unidades "cqh/cqw"
 *     (container query units) para escalar con el tamaño de la caja.
 *   - A pantalla completa en el Receptor real -> modoPreview = false,
 *     usa "vh/vw" para escalar con el tamaño real de la pantalla.
 *
 * Layout FIJO a propósito: las tres tarjetas (Tiempo Restante, Hora y
 * fecha actual, Mensaje) SIEMPRE están presentes en el DOM con el mismo
 * tamaño y el mismo borde blanco, aunque el Emisor oculte el reloj o no
 * haya ningún conteo corriendo. Lo único que cambia es el contenido de
 * adentro (se muestra un guion "—" en vez del valor), nunca la caja. Así
 * el monitor de escenario no "salta" ni se reacomoda cuando el operador
 * activa o desactiva algo.
 *
 * No maneja sockets ni estado propio -- todo le llega por props desde
 * PantallaRetorno.jsx, que es quien sabe hablar con el servidor.
 */
export default function MonitorRetorno({
  estado,
  horaActual,
  segundosVista,
  tiempoCumplido,
  enAlerta,
  modoPreview = false,
}) {
  const u = modoPreview ? "cqh" : "vh";
  const w = modoPreview ? "cqw" : "vw";
  const escala = modoPreview ? 1 : estado.estilo?.tamano === "extra" ? 1.3 : 1;
  const colorAcento = estado.estilo?.colorAcento || "#f59e0b";

  // Marca (logo + nombre + país) que el Emisor eligió para el monitor.
  // Si el estado todavía no trae "marca" (ej. servidor viejo sin
  // reiniciar), se usa el logo por defecto sin romper nada.
  const marca = estado.marca || {};
  const logo = buscarLogo(marca.logoId);
  const nombreIglesia = marca.nombre?.trim() || logo.nombre;
  const paisIglesia = marca.pais?.trim() || logo.pais;

  const mostrarTemporizador =
    estado.temporizador.activo || estado.temporizador.restanteAlPausar !== null;
  const mostrarReloj = estado.reloj.visible;

  // Cuadro de mensaje: el único origen de texto ahora es el mensaje
  // personalizado que escribe el operador desde el Emisor.
  const textoCuadroMensaje =
    estado.mensaje.visible && estado.mensaje.texto ? estado.mensaje.texto : "";
  const mostrarMensaje = !!textoCuadroMensaje;

  const colorTemporizador = tiempoCumplido
    ? "#ef4444"
    : enAlerta
      ? "#f97316"
      : colorAcento;

  return (
    <div style={estilos.contenedor(modoPreview)}>
      {/* Encabezado + cronómetro. La tarjeta siempre tiene el mismo alto;
          si no hay conteo activo, se muestra "00:00" apagado en vez de
          desaparecer la caja. */}
      <section style={estilos.tarjeta(modoPreview)}>
        <div style={estilos.filaEncabezado}>
          <div style={estilos.marca}>
            {logo.imagen ? (
              <img
                src={logo.imagen}
                alt={nombreIglesia}
                style={{
                  ...estilos.logoImagen,
                  height: `clamp(1.4rem, ${5.5 * escala}${u}, 3rem)`,
                }}
              />
            ) : (
              <IconoIglesia
                size={`clamp(1.1rem, ${4.5 * escala}${u}, 2.4rem)`}
              />
            )}
            <div style={estilos.marcaTexto}>
              <span
                style={{
                  ...estilos.nombreIglesia,
                  fontSize: `clamp(0.85rem, ${3.4 * escala}${u}, 1.5rem)`,
                }}
              >
                {nombreIglesia}
              </span>
              <span
                style={{
                  ...estilos.paisIglesia,
                  fontSize: `clamp(0.55rem, ${1.7 * escala}${u}, 0.85rem)`,
                }}
              >
                {paisIglesia}
              </span>
            </div>
          </div>
          <span
            style={{
              ...estilos.etiqueta,
              fontSize: `clamp(0.55rem, ${1.7 * escala}${u}, 0.85rem)`,
              opacity: mostrarTemporizador ? 1 : 0.35,
            }}
          >
            Tiempo Restante
          </span>
        </div>

        <div
          style={{
            ...estilos.cronometro,
            color: mostrarTemporizador ? colorTemporizador : "#3f4756",
            fontSize: `clamp(2.6rem, ${22 * escala}${u}, 11rem)`,
            textShadow: mostrarTemporizador
              ? `0 0 ${30 * escala}${w} ${colorTemporizador}55`
              : "none",
            animation: !mostrarTemporizador
              ? "none"
              : tiempoCumplido
                ? "retornoParpadeoFuerte 0.6s steps(1) infinite"
                : enAlerta
                  ? "retornoParpadeoSuave 1s ease-in-out infinite"
                  : "none",
          }}
        >
          {mostrarTemporizador
            ? formatearDuracion(Math.abs(segundosVista))
            : "00:00"}
        </div>
      </section>

      {/* Hora actual + Mensaje: dos columnas de ancho fijo, SIEMPRE las
          dos presentes (no se reacomoda el grid si se oculta el reloj o
          no hay mensaje puesto). */}
      <div style={estilos.filaInferior}>
        <section style={estilos.tarjeta(modoPreview)}>
          <span
            style={{
              ...estilos.etiquetaCentrada,
              fontSize: `clamp(0.55rem, ${1.7 * escala}${u}, 0.85rem)`,
            }}
          >
            Hora y fecha actual
          </span>
          <div
            style={{
              ...estilos.hora,
              fontSize: `clamp(1.6rem, ${9 * escala}${u}, 5rem)`,
              opacity: mostrarReloj ? 1 : 0.3,
            }}
          >
            {mostrarReloj ? formatearReloj(horaActual) : "--:--:--"}
          </div>
          <div
            style={{
              ...estilos.fecha,
              fontSize: `clamp(0.75rem, ${2.4 * escala}${u}, 1.3rem)`,
              opacity: mostrarReloj ? 1 : 0.3,
            }}
          >
            {mostrarReloj ? formatearFecha(horaActual) : "—"}
          </div>
        </section>

        <section style={estilos.tarjeta(modoPreview)}>
          <span
            style={{
              ...estilos.etiquetaCentrada,
              fontSize: `clamp(0.55rem, ${1.7 * escala}${u}, 0.85rem)`,
            }}
          >
            Mensaje
          </span>
          <p
            style={{
              ...estilos.mensaje,
              fontSize: `clamp(1.2rem, ${6 * escala}${u}, 3.4rem)`,
              opacity: mostrarMensaje ? 1 : 0.3,
            }}
          >
            {mostrarMensaje ? textoCuadroMensaje : "—"}
          </p>
        </section>
      </div>
    </div>
  );
}

function IconoIglesia({ size = 20, color = "#67e8f9" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 2c-1.6 2-2.4 3.6-2.4 5 0 1.4 1.1 2.4 2.4 2.4S14.4 8.4 14.4 7c0-1.4-.8-3-2.4-5Z" />
      <path d="M12 9.4V22" />
      <path d="M8 22v-6.5c0-.8.4-1.5 1.1-1.9L12 12l2.9 1.6c.7.4 1.1 1.1 1.1 1.9V22" />
      <path d="M3 22h18" />
      <path d="M5 22v-8l3-1.8" />
      <path d="M19 22v-8l-3-1.8" />
    </svg>
  );
}

// ---- Helpers de formato ----------------------------------------------

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

function formatearFecha(fecha) {
  const texto = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ---- Estilos ------------------------------------------------------------

const BG_CARD = "#0a0f1a";
// Borde blanco fijo: mismo grosor y color siempre, sin importar qué
// tarjeta esté "apagada" (solo cambia la opacidad del contenido, nunca
// el borde ni el tamaño de la caja).
const BORDE_BLANCO = "rgba(255, 255, 255, 0.85)";

const estilos = {
  contenedor: (preview) => ({
    width: "100%",
    height: preview ? "100%" : undefined,
    flex: preview ? undefined : "1 1 auto",
    minHeight: preview ? undefined : 0,
    display: "flex",
    flexDirection: "column",
    gap: preview ? "2%" : "16px",
    padding: preview ? "3%" : "20px",
    boxSizing: "border-box",
    backgroundColor: "#05070c",
    containerType: preview ? "size" : undefined,
  }),
  tarjeta: (preview) => ({
    backgroundColor: BG_CARD,
    border: `1.5px solid ${BORDE_BLANCO}`,
    borderRadius: preview ? "10px" : "16px",
    padding: preview ? "3% 4%" : "18px 24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  }),
  filaEncabezado: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  marca: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  logoImagen: {
    width: "auto",
    maxWidth: "40%",
    objectFit: "contain",
    flexShrink: 0,
  },
  marcaTexto: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.15,
    minWidth: 0,
  },
  nombreIglesia: {
    fontWeight: 800,
    color: "#f8fafc",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  paisIglesia: {
    fontWeight: 600,
    color: "#7d8899",
    letterSpacing: "0.12em",
    whiteSpace: "nowrap",
  },
  etiqueta: {
    fontWeight: 700,
    color: "#7d8899",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  etiquetaCentrada: {
    display: "block",
    textAlign: "center",
    fontWeight: 700,
    color: "#7d8899",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  cronometro: {
    textAlign: "center",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    marginTop: "4px",
  },
  mensaje: {
    textAlign: "center",
    fontWeight: 800,
    color: "#f8fafc",
    margin: 0,
    wordBreak: "break-word",
  },
  // Grid de dos columnas SIEMPRE fijo (Hora | Mensaje). Ya no depende de
  // si el reloj está visible, así que nunca se reacomoda.
  filaInferior: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    flex: 1,
    minHeight: 0,
  },
  hora: {
    textAlign: "center",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
    color: "#ffffff",
    lineHeight: 1,
  },
  fecha: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: "6px",
  },
  nota: {
    textAlign: "center",
    color: "#7d8899",
    margin: 0,
  },
};
