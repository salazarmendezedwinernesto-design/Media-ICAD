import React from "react";
import LiveStream from "./LiveStream";

/**
 * MonitorRetorno
 * ---------------------------------------------------------------------
 * Diseño de tarjetas (branding + cronómetro / mensaje / hora / video en
 * vivo) que se usa en DOS lugares con el mismo JSX, para que la vista
 * previa del Emisor sea un espejo fiel de lo que ve el Receptor real:
 *
 *   - Dentro de la "Vista previa del monitor" del Emisor (chica, dentro
 *     de una tarjeta) -> modoPreview = true, usa unidades "cqh/cqw"
 *     (container query units) para escalar con el tamaño de la caja.
 *   - A pantalla completa en el Receptor real -> modoPreview = false,
 *     usa "vh/vw" para escalar con el tamaño real de la pantalla.
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
  whepUrl,
  modoPreview = false,
  nombreIglesia = "Asambleas de Dios",
  paisIglesia = "EL SALVADOR",
}) {
  const u = modoPreview ? "cqh" : "vh";
  const w = modoPreview ? "cqw" : "vw";
  const escala = modoPreview ? 1 : estado.estilo?.tamano === "extra" ? 1.3 : 1;
  const colorAcento = estado.estilo?.colorAcento || "#f59e0b";

  const mostrarTemporizador =
    estado.temporizador.activo || estado.temporizador.restanteAlPausar !== null;
  const mostrarMensaje = estado.mensaje.visible && estado.mensaje.texto;
  const mostrarReloj = estado.reloj.visible;
  const mostrarNota = !!estado.nota.texto;

  const colorTemporizador = tiempoCumplido
    ? "#ef4444"
    : enAlerta
      ? "#f97316"
      : colorAcento;

  return (
    <div style={estilos.contenedor(modoPreview)}>
      {/* Encabezado + cronómetro */}
      <section style={estilos.tarjeta(modoPreview)}>
        <div style={estilos.filaEncabezado}>
          <div style={estilos.marca}>
            <IconoIglesia size={`clamp(1.1rem, ${4.5 * escala}${u}, 2.4rem)`} />
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
          {mostrarTemporizador && (
            <span
              style={{
                ...estilos.etiqueta,
                fontSize: `clamp(0.55rem, ${1.7 * escala}${u}, 0.85rem)`,
              }}
            >
              Tiempo Restante
            </span>
          )}
        </div>

        {mostrarTemporizador && (
          <div
            style={{
              ...estilos.cronometro,
              color: colorTemporizador,
              fontSize: `clamp(2.2rem, ${16 * escala}${u}, 8rem)`,
              textShadow: `0 0 ${30 * escala}${w} ${colorTemporizador}55`,
              animation: tiempoCumplido
                ? "retornoParpadeoFuerte 0.6s steps(1) infinite"
                : enAlerta
                  ? "retornoParpadeoSuave 1s ease-in-out infinite"
                  : "none",
            }}
          >
            {formatearDuracion(Math.abs(segundosVista))}
          </div>
        )}
      </section>

      {/* Mensaje */}
      {mostrarMensaje && (
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
              fontSize: `clamp(1rem, ${5 * escala}${u}, 2.6rem)`,
            }}
          >
            {estado.mensaje.texto}
          </p>
        </section>
      )}

      {/* Hora actual + video en vivo */}
      <div style={estilos.filaInferior(mostrarReloj)}>
        {mostrarReloj && (
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
                fontSize: `clamp(1.3rem, ${6.5 * escala}${u}, 3.2rem)`,
              }}
            >
              {formatearReloj(horaActual)}
            </div>
            <div
              style={{
                ...estilos.fecha,
                fontSize: `clamp(0.6rem, ${1.9 * escala}${u}, 1rem)`,
              }}
            >
              {formatearFecha(horaActual)}
            </div>
          </section>
        )}

        <section
          style={{ ...estilos.tarjeta(modoPreview), ...estilos.tarjetaVideo }}
        >
          <span style={estilos.badgeEnVivo}>
            <span style={estilos.puntoRojo} />
            EN VIVO
          </span>
          <div style={estilos.videoEnvoltorio}>
            <LiveStream whepUrl={whepUrl} alto="100%" />
          </div>
        </section>
      </div>

      {mostrarNota && (
        <p
          style={{
            ...estilos.nota,
            fontSize: `clamp(0.6rem, ${1.8 * escala}${u}, 1rem)`,
          }}
        >
          {estado.nota.texto}
        </p>
      )}
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
const BORDE_CIAN = "rgba(34, 211, 238, 0.45)";

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
    border: `1.5px solid ${BORDE_CIAN}`,
    borderRadius: preview ? "10px" : "16px",
    padding: preview ? "3% 4%" : "18px 24px",
    boxSizing: "border-box",
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
  filaInferior: (dosColumnas) => ({
    display: "grid",
    gridTemplateColumns: dosColumnas ? "1fr 1fr" : "1fr",
    gap: "16px",
    flex: 1,
    minHeight: 0,
  }),
  hora: {
    textAlign: "center",
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
    color: "#f97316",
    lineHeight: 1,
  },
  fecha: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: "6px",
  },
  tarjetaVideo: {
    position: "relative",
    padding: 0,
    overflow: "hidden",
    display: "flex",
    minHeight: 0,
  },
  videoEnvoltorio: {
    width: "100%",
    height: "100%",
  },
  badgeEnVivo: {
    position: "absolute",
    top: "3%",
    left: "4%",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: "3px 8px",
    borderRadius: "999px",
  },
  puntoRojo: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#ef4444",
    animation: "retornoParpadeoFuerte 1.2s ease-in-out infinite",
  },
  nota: {
    textAlign: "center",
    color: "#7d8899",
    margin: 0,
  },
};
