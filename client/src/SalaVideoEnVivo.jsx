import React, { useEffect, useState } from "react";
import {
  useRealtimeKitClient,
  RealtimeKitProvider,
} from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import { SERVER_URL } from "./config";
import { obtenerToken } from "./services/auth";

/**
 * Sala de video en vivo por WebRTC (Cloudflare RealtimeKit), casi cero
 * latencia. Reemplaza al viejo "pega un link" -- aquí nadie pega nada:
 *
 *  - modo="moderador": pide un token que SÍ puede publicar cámara/pantalla
 *    (requiere sesión -- ya se validó la contraseña del panel Moderador).
 *  - modo="espectador": pide un token que SOLO puede ver (funciona incluso
 *    sin login, para la página pública "/presentar").
 *
 * Internamente usa el UI Kit oficial de RealtimeKit (maneja selección de
 * cámara/micrófono, reconexión, etc.), así que en el panel de Moderador,
 * cuando actives la cámara, ahí mismo eliges "OBS Virtual Camera" o
 * "vMix Video" de la lista de cámaras del navegador -- no hay clave que
 * copiar a ningún lado.
 */
export default function SalaVideoEnVivo({ modo = "espectador", nombre = "Panel", alto = "100%" }) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const conectar = async () => {
      try {
        const esModerador = modo === "moderador";
        const ruta = esModerador
          ? "/api/transmision/token"
          : "/api/transmision/token-espectador";

        const encabezados = { "Content-Type": "application/json" };
        if (esModerador) {
          encabezados.Authorization = `Bearer ${obtenerToken()}`;
        }

        const respuesta = await fetch(`${SERVER_URL}${ruta}`, {
          method: "POST",
          headers: encabezados,
          body: JSON.stringify({ nombre }),
        });
        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok) {
          throw new Error(datos.error || "No se pudo conectar al video en vivo.");
        }

        if (cancelado) return;

        await initMeeting({
          authToken: datos.authToken,
          defaults: { audio: false, video: false },
        });
      } catch (e) {
        if (!cancelado) setError(e.message || "No se pudo conectar al video en vivo.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    conectar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  if (error) {
    return (
      <div style={{ ...styles.aviso, height: alto }}>
        ⚠️ {error}
      </div>
    );
  }

  if (cargando || !meeting) {
    return <div style={{ ...styles.aviso, height: alto }}>Conectando al video en vivo…</div>;
  }

  return (
    <div style={{ width: "100%", height: alto, backgroundColor: "#000" }}>
      <RealtimeKitProvider value={meeting}>
        <RtkMeeting mode="fill" meeting={meeting} />
      </RealtimeKitProvider>
    </div>
  );
}

const styles = {
  aviso: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontSize: "0.85rem",
    backgroundColor: "#000",
    padding: "10px",
    textAlign: "center",
    boxSizing: "border-box",
  },
};
