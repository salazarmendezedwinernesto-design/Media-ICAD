import React, { useState } from "react";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken, guardarToken } from "./services/auth";
import { IconOjo, IconOjoTachado } from "./icons";

export default function Login({ alIniciarSesion }) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !contrasena.trim()) {
      setError("Completa usuario y contraseña");
      return;
    }

    setCargando(true);
    setError("");

    try {
      const base = SERVER_URL || "";
      const respuesta = await fetch(`${base}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: usuario.trim(),
          contrasena: contrasena,
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok || !datos.ok) {
        setError(datos.error || "Usuario o contraseña incorrectos");
        setCargando(false);
        return;
      }

      guardarToken(datos.token);
      alIniciarSesion();
    } catch (err) {
      setError("No se pudo conectar con el servidor. Verifica tu conexión.");
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Estilos responsive: en pantallas angostas (celular) se reduce el
          padding, el tamaño de fuente y el ancho máximo del formulario.
          Todo lo demás (colores, layout) es fluido por sí solo. */}
      <style>{`
        @media (max-width: 640px) {
          .login-crew-content {
            max-width: 280px !important;
            padding: 1.25rem !important;
          }
          .login-crew-titulo {
            font-size: 13px !important;
          }
          .login-crew-boton {
            height: 42px !important;
            font-size: 12px !important;
          }
        }
        @media (max-width: 380px) {
          .login-crew-content {
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Fondo geométrico oscuro con acento rojo — se estira a cualquier
          tamaño de pantalla gracias a preserveAspectRatio="xMidYMid slice" */}
      <svg
        viewBox="0 0 800 520"
        preserveAspectRatio="xMidYMid slice"
        style={styles.fondoSvg}
        aria-hidden="true"
      >
        <rect width="800" height="520" fill="#0a0a0a" />
        <polygon points="0,0 340,0 120,520 0,520" fill="#141414" />
        <polygon points="800,520 460,520 680,0 800,0" fill="#141414" />
        <polygon
          points="800,520 620,520 800,240"
          fill="#E11D2E"
          opacity="0.9"
        />
        <polygon points="0,0 180,0 0,220" fill="#E11D2E" opacity="0.15" />
        <line
          x1="340"
          y1="0"
          x2="120"
          y2="520"
          stroke="#2a2a2a"
          strokeWidth="2"
        />
        <line
          x1="680"
          y1="0"
          x2="460"
          y2="520"
          stroke="#2a2a2a"
          strokeWidth="2"
        />
      </svg>

      <div className="login-crew-content" style={styles.content}>
        <div style={styles.logoLockup}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span style={styles.logoTexto}>crew</span>
          <span style={styles.logoIcad}>ICAD</span>
        </div>

        <p className="login-crew-titulo" style={styles.subtitulo}>
          Inicia sesión para continuar
        </p>

        <form onSubmit={manejarEnvio} style={styles.form}>
          <div style={styles.campo}>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Usuario"
              autoComplete="username"
              style={styles.input}
              disabled={cargando}
            />
          </div>

          <div style={styles.campoContrasena}>
            <input
              type={mostrarContrasena ? "text" : "password"}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              style={styles.inputContrasena}
              disabled={cargando}
            />
            <button
              type="button"
              onClick={() => setMostrarContrasena((prev) => !prev)}
              style={styles.btnVerContrasena}
              disabled={cargando}
              aria-label={
                mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              title={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {mostrarContrasena ? (
                <IconOjoTachado size={16} color="rgba(255,255,255,0.6)" />
              ) : (
                <IconOjo size={16} color="rgba(255,255,255,0.6)" />
              )}
            </button>
          </div>

          {error && <p style={styles.mensajeError}>{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="login-crew-boton"
            style={{
              ...styles.btnEntrar,
              opacity: cargando ? 0.6 : 1,
              cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {cargando ? "VERIFICANDO..." : "ENTRAR"}
          </button>
        </form>

        <p style={styles.pie}>Acceso exclusivo para el equipo de producción</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
    boxSizing: "border-box",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  },
  fondoSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  content: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: "320px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2rem",
    boxSizing: "border-box",
  },
  logoLockup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "32px",
  },
  logoTexto: {
    fontSize: "15px",
    fontWeight: 500,
    color: "#fff",
    letterSpacing: "0.5px",
  },
  logoIcad: {
    fontSize: "10px",
    fontWeight: 500,
    color: "#E11D2E",
  },
  subtitulo: {
    fontSize: "13px",
    color: "#ccc",
    margin: "0 0 28px 0",
    textAlign: "center",
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  campo: {
    width: "100%",
    marginBottom: "22px",
  },
  campoContrasena: {
    width: "100%",
    marginBottom: "10px",
    position: "relative",
  },
  input: {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    padding: "0 0 10px 0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  inputContrasena: {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    padding: "0 26px 10px 0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  btnVerContrasena: {
    position: "absolute",
    right: 0,
    bottom: "6px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  mensajeError: {
    color: "#ff6b6b",
    fontSize: "12px",
    margin: "0 0 14px 0",
    textAlign: "center",
  },
  btnEntrar: {
    width: "100%",
    height: "44px",
    background: "#E11D2E",
    color: "#fff",
    border: "none",
    borderRadius: "24px",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: "1px",
    marginTop: "12px",
  },
  pie: {
    textAlign: "center",
    fontSize: "11px",
    color: "rgba(255,255,255,0.45)",
    margin: "20px 0 0 0",
  },
};