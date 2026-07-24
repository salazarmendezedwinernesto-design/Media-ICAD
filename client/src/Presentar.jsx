import React, { useEffect, useState } from "react";
import { SERVER_URL } from "./config";
import VisorTransmision from "./VisorTransmision";

// Página pública (SIN login) pensada para meterse como Browser Source en
// OBS Studio o vMix. Por eso NO usa Socket.IO con token: en vez de eso,
// consulta cada pocos segundos una ruta pública del servidor
// (GET /api/transmision) para saber si hay transmisión activa. Así OBS
// puede tener esta pestaña abierta permanentemente sin depender de una
// sesión iniciada en el navegador.
export default function Presentar() {
  const [transmision, setTransmision] = useState({ activa: false, url: null });

  useEffect(() => {
    let cancelado = false;

    const consultar = async () => {
      try {
        const base = SERVER_URL || "";
        const respuesta = await fetch(`${base}/api/transmision`);
        const datos = await respuesta.json();
        if (!cancelado && datos) setTransmision(datos);
      } catch {
        // Si el servidor está dormido (Render free tier) o hay un corte de
        // red momentáneo, simplemente se reintenta en el próximo ciclo.
      }
    };

    consultar();
    const intervalo = setInterval(consultar, 3000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  return (
    <div style={styles.container}>
      {transmision.activa && transmision.url ? (
        <VisorTransmision url={transmision.url} alto="100vh" redondeado={false} />
      ) : (
        <div style={styles.esperando}>
          <span style={styles.puntoInactivo} />
          Esperando transmisión...
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#000",
    width: "100vw",
    height: "100vh",
    margin: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  esperando: {
    color: "#4b5563",
    fontFamily: "system-ui, sans-serif",
    fontSize: "1.2rem",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  puntoInactivo: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#374151",
    display: "inline-block",
  },
};
