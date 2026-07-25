import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL, MEDIAMTX_WHEP_URL } from "./config";
import { obtenerToken } from "./services/auth";
import LiveStream from "./LiveStream";

/**
 * Barra de transmision en vivo, reutilizable desde cualquier panel
 * (Director, Camara, Pastor, Lider, Pantalla).
 *
 * Solo aparece cuando MediaMTX detecto que OBS/vMix esta transmitiendo
 * (el servidor recibe ese aviso automaticamente por webhook, ver
 * server.js: /api/mediamtx/ready). No hay que darle click a nada para
 * que aparezca ni desaparezca.
 */
export default function BarraTransmision({
  posicion = "abajo",
  variante = "compacta",
  mostrarBotonPresentar = false,
}) {
  const [transmision, setTransmision] = useState({ activa: false });
  const [expandida, setExpandida] = useState(variante === "grande");
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      auth: { token: obtenerToken() },
    });
    socketRef.current = socket;

    socket.on("transmision:estado", (datos) => {
      if (datos) setTransmision(datos);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (!transmision.activa) return null;

  const abrirPresentar = () => {
    window.open("/presentar", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        ...estilos.contenedor,
        order: posicion === "arriba" ? -1 : 1,
      }}
    >
      <style>{`
        @keyframes parpadeoPuntoVivo {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        .punto-vivo-transmision { animation: parpadeoPuntoVivo 1.3s infinite ease-in-out; }
      `}</style>

      <div style={estilos.fila}>
        <div style={estilos.insigniaVivo}>
          <span className="punto-vivo-transmision" style={estilos.puntoVivo} />
          EN VIVO
        </div>

        {variante === "compacta" && (
          <button
            style={estilos.btnToggle}
            onClick={() => setExpandida((v) => !v)}
          >
            {expandida ? "Ocultar ▲" : "Ver transmisión ▼"}
          </button>
        )}

        {mostrarBotonPresentar && (
          <button style={estilos.btnPresentar} onClick={abrirPresentar}>
            🖥️ Presentar
          </button>
        )}
      </div>

      {expandida && (
        <LiveStream
          whepUrl={MEDIAMTX_WHEP_URL}
          alto={variante === "grande" ? "260px" : "170px"}
        />
      )}
    </div>
  );
}

const estilos = {
  contenedor: {
    width: "100%",
    backgroundColor: "#111424",
    border: "1px solid #dc2626",
    borderRadius: "10px",
    padding: "8px 10px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexShrink: 0,
  },
  fila: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  insigniaVivo: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#dc2626",
    color: "#fff",
    fontWeight: "900",
    fontSize: "0.75rem",
    letterSpacing: "1px",
    padding: "5px 10px",
    borderRadius: "6px",
  },
  puntoVivo: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#fff",
    display: "inline-block",
  },
  btnToggle: {
    backgroundColor: "#1f2937",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "0.8rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnPresentar: {
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "0.8rem",
    fontWeight: "600",
    cursor: "pointer",
    marginLeft: "auto",
  },
};
