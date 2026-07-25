import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
import SalaVideoEnVivo from "./SalaVideoEnVivo";

export default function Moderador({ alSalir }) {
  const [desbloqueado, setDesbloqueado] = useState(
    () => sessionStorage.getItem("mod_desbloqueado") === "1"
  );
  const [contrasena, setContrasena] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const [verificando, setVerificando] = useState(false);

  const [transmision, setTransmision] = useState({ activa: false });
  const [sesionAbierta, setSesionAbierta] = useState(false);

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

  const iniciarTransmision = () => {
    setSesionAbierta(true);
    socketRef.current?.emit("transmision:iniciar", { de: "Moderador" });
  };

  const finalizarTransmision = () => {
    setSesionAbierta(false);
    socketRef.current?.emit("transmision:finalizar");
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
              Este panel tiene una contraseña aparte. Ingrésala para
              continuar:
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
              <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>
                {errorClave}
              </p>
            )}
            <button
              type="submit"
              disabled={!contrasena.trim() || verificando}
              style={{
                ...styles.btnIniciar,
                opacity: !contrasena.trim() || verificando ? 0.4 : 1,
              }}
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
          {transmision.activa ? "🔴 TRANSMISIÓN ACTIVA" : "⚪ SIN TRANSMISIÓN"}
        </span>

        {!sesionAbierta ? (
          <div style={styles.formulario}>
            <p style={styles.notaAyuda}>
              Al iniciar, elige tu fuente de video: puedes usar tu cámara, o
              en OBS Studio / vMix activa <strong>"Cámara Virtual"</strong> y
              selecciónala aquí como si fuera una webcam más. No hay ninguna
              clave que copiar.
            </p>
            <button style={styles.btnIniciar} onClick={iniciarTransmision}>
              🔴 Iniciar transmisión
            </button>
          </div>
        ) : (
          <div style={styles.formulario}>
            <button style={styles.btnFinalizar} onClick={finalizarTransmision}>
              🛑 Finalizar transmisión
            </button>
            <p style={styles.notaAyuda}>
              Al finalizar, la sala se cierra por completo para todos: no
              queda ninguna grabación guardada.
            </p>
          </div>
        )}
      </section>

      {sesionAbierta && (
        <section style={styles.tarjeta}>
          <span style={styles.tituloSeccion}>
            🎥 TU SALA (elige cámara/pantalla aquí)
          </span>
          <div style={{ height: "420px" }}>
            <SalaVideoEnVivo modo="moderador" nombre="Moderador" alto="100%" />
          </div>
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
  navTitle: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#9ca3af",
  },
  tarjeta: {
    backgroundColor: "#11121a",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  tituloSeccion: {
    fontSize: "0.8rem",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#6b7280",
  },
  formulario: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  etiqueta: {
    fontSize: "0.85rem",
    color: "#9ca3af",
    margin: 0,
  },
  input: {
    backgroundColor: "#0b0c10",
    border: "1px solid #2d303f",
    borderRadius: "8px",
    color: "#fff",
    padding: "14px",
    fontSize: "1rem",
    outline: "none",
  },
  btnIniciar: {
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnFinalizar: {
    backgroundColor: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  notaAyuda: {
    fontSize: "0.75rem",
    color: "#6b7280",
    margin: 0,
  },
};
