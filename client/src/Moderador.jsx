import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL, MEDIAMTX_RTMP_URL, MEDIAMTX_STREAM_KEY, MEDIAMTX_WHEP_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
import LiveStream from "./LiveStream";

export default function Moderador({ alSalir }) {
  const [desbloqueado, setDesbloqueado] = useState(
    () => sessionStorage.getItem("mod_desbloqueado") === "1"
  );
  const [contrasena, setContrasena] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [transmision, setTransmision] = useState({ activa: false });
  const [copiado, setCopiado] = useState("");

  const socketRef = useRef(null);

  const verificarContrasena = async (e) => {
    e.preventDefault();
    setVerificando(true);
    setErrorClave("");
    try {
      const respuesta = await fetch(`${SERVER_URL}/api/moderador-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrasena }),
      });
      const datos = await respuesta.json();
      if (respuesta.ok && datos.ok) {
        sessionStorage.setItem("mod_desbloqueado", "1");
        setDesbloqueado(true);
      } else {
        setErrorClave(datos.error || "Contraseña incorrecta");
      }
    } catch {
      setErrorClave("No se pudo conectar con el servidor.");
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    if (!desbloqueado) return;

    const socket = io(SERVER_URL, {
      auth: { token: obtenerToken() },
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      if (err && err.message === "No autorizado") {
        borrarToken();
        window.location.reload();
      }
    });

    socket.on("transmision:estado", (datos) => {
      if (datos) setTransmision(datos);
    });

    return () => socket.disconnect();
  }, [desbloqueado]);

  const copiar = async (texto, etiqueta) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      // Si el navegador bloquea el portapapeles, el usuario igual puede
      // seleccionar el texto manualmente; no hacemos nada más.
    }
  };

  if (!desbloqueado) {
    return (
      <div style={styles.container}>
        <header style={styles.navbar}>
          <button style={styles.btnVolver} onClick={alSalir}>
            ⬅️ Menú
          </button>
          <h1 style={styles.navTitle}>📡 PANEL DE MODERADOR</h1>
          <div style={{ width: "90px" }} />
        </header>

        <section style={styles.tarjeta}>
          <span style={styles.tituloSeccion}>🔒 ACCESO RESTRINGIDO</span>
          <form onSubmit={verificarContrasena} style={styles.formulario}>
            <label style={styles.etiqueta}>
              Este panel tiene una contraseña aparte. Ingrésala para continuar:
            </label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Contraseña del moderador"
              style={styles.input}
              autoFocus
            />
            {errorClave && (
              <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>{errorClave}</p>
            )}
            <button
              type="submit"
              disabled={!contrasena.trim() || verificando}
              style={{ ...styles.btnPrimario, opacity: !contrasena.trim() || verificando ? 0.4 : 1 }}
            >
              {verificando ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <button style={styles.btnVolver} onClick={alSalir}>
          ⬅️ Menú
        </button>
        <h1 style={styles.navTitle}>📡 PANEL DE MODERADOR</h1>
        <div style={{ width: "90px" }} />
      </header>

      <section style={styles.tarjeta}>
        <span style={styles.tituloSeccion}>
          {transmision.activa ? "🔴 EN VIVO (detectado automáticamente)" : "⚪ SIN SEÑAL"}
        </span>
        <p style={styles.notaAyuda}>
          No hay que darle a ningún botón de "iniciar": en cuanto OBS Studio
          o vMix empiecen a transmitir a la dirección de abajo, esta pantalla
          (y todos los paneles) lo detectan solos. Cuando cortes la
          transmisión en OBS/vMix, desaparece sola en todos lados — no queda
          nada guardado.
        </p>
      </section>

      <section style={styles.tarjeta}>
        <span style={styles.tituloSeccion}>⚙️ CONFIGURA ESTO EN OBS STUDIO / VMIX</span>

        <div style={styles.campo}>
          <label style={styles.etiqueta}>Servidor (Server)</label>
          <div style={styles.filaCopiar}>
            <code style={styles.codigo}>{MEDIAMTX_RTMP_URL}</code>
            <button style={styles.btnCopiar} onClick={() => copiar(MEDIAMTX_RTMP_URL, "servidor")}>
              {copiado === "servidor" ? "✅" : "Copiar"}
            </button>
          </div>
        </div>

        <div style={styles.campo}>
          <label style={styles.etiqueta}>Clave de transmisión (Stream Key)</label>
          <div style={styles.filaCopiar}>
            <code style={styles.codigo}>{MEDIAMTX_STREAM_KEY}</code>
            <button style={styles.btnCopiar} onClick={() => copiar(MEDIAMTX_STREAM_KEY, "clave")}>
              {copiado === "clave" ? "✅" : "Copiar"}
            </button>
          </div>
        </div>

        <p style={styles.notaAyuda}>
          En OBS: Configuración → Emisión → Servicio: "Personalizado" →
          pega el Servidor y la Clave. En vMix: Configuración de
          Transmisión → Servidor Personalizado (RTMP) → los mismos datos.
        </p>
      </section>

      {transmision.activa && (
        <section style={styles.tarjeta}>
          <span style={styles.tituloSeccion}>👁️ VISTA PREVIA</span>
          <LiveStream whepUrl={MEDIAMTX_WHEP_URL} alto="280px" />
        </section>
      )}
    </div>
  );
}

const styles = {
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
    gap: "14px",
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #1f2937",
    paddingBottom: "10px",
    flexShrink: 0,
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
  navTitle: { margin: 0, fontSize: "1.1rem", fontWeight: "800", color: "#9ca3af" },
  tarjeta: {
    backgroundColor: "#11121a",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  tituloSeccion: { fontSize: "0.8rem", fontWeight: "700", letterSpacing: "1px", color: "#6b7280" },
  formulario: { display: "flex", flexDirection: "column", gap: "10px" },
  etiqueta: { fontSize: "0.85rem", color: "#9ca3af", margin: 0 },
  input: {
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    color: "#fff",
    padding: "14px",
    fontSize: "1rem",
    outline: "none",
  },
  btnPrimario: {
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  notaAyuda: { fontSize: "0.75rem", color: "#6b7280", margin: 0, lineHeight: 1.5 },
  campo: { display: "flex", flexDirection: "column", gap: "6px" },
  filaCopiar: { display: "flex", gap: "8px", alignItems: "center" },
  codigo: {
    flex: 1,
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "0.85rem",
    color: "#34d399",
    wordBreak: "break-all",
  },
  btnCopiar: {
    backgroundColor: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px 14px",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
  },
};
