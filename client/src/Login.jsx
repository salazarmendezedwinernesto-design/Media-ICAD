import React, { useState } from "react";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
// Pega aquí la URL de tu logo (puede ser un archivo en /public, ej: "/logo.png",
// o una URL externa). Si lo dejas en null, se muestra un logo de texto por defecto.
const LOGO_URL = "client/src/logo MM.jpeg";

export default function Login({ alIniciarSesion }) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
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
      <div style={styles.card}>
        <div style={styles.logoArea}>
          {LOGO_URL ? (
            <img src={LOGO_URL} alt="Logo" style={styles.logoImg} />
          ) : (
            <div style={styles.logoTexto}>
              <span style={styles.logoLinea1}>CREW</span>
              <span style={styles.logoLinea2}>MULTIMEDIA</span>
            </div>
          )}
        </div>

        <h1 style={styles.titulo}>COMUNICACIÓN MM ICAD</h1>
        <p style={styles.subtitulo}>Inicia sesión para continuar</p>

        <form onSubmit={manejarEnvio} style={styles.form}>
          <div style={styles.campo}>
            <label style={styles.etiqueta}>Usuario</label>
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

          <div style={styles.campo}>
            <label style={styles.etiqueta}>Contraseña</label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              style={styles.input}
              disabled={cargando}
            />
          </div>

          {error && <p style={styles.mensajeError}>{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            style={{
              ...styles.btnEntrar,
              opacity: cargando ? 0.6 : 1,
              cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {cargando ? "Verificando..." : "ENTRAR"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#0a0a0a",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: "12px",
    padding: "36px 30px",
    width: "100%",
    maxWidth: "380px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logoArea: {
    marginBottom: "20px",
    display: "flex",
    justifyContent: "center",
  },
  logoImg: {
    maxWidth: "160px",
    maxHeight: "120px",
    objectFit: "contain",
  },
  logoTexto: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    lineHeight: 1.1,
  },
  logoLinea1: {
    fontSize: "1.6rem",
    fontWeight: "900",
    color: "#fff",
    letterSpacing: "2px",
  },
  logoLinea2: {
    fontSize: "0.95rem",
    fontWeight: "bold",
    color: "#0052cc",
    letterSpacing: "3px",
    marginTop: "2px",
  },
  titulo: {
    fontSize: "1.3rem",
    fontWeight: "900",
    color: "#fff",
    margin: "4px 0 4px 0",
    textAlign: "center",
  },
  subtitulo: {
    fontSize: "0.85rem",
    color: "#888",
    margin: "0 0 24px 0",
    textAlign: "center",
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  campo: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  etiqueta: {
    fontSize: "0.78rem",
    color: "#aaa",
    fontWeight: "bold",
    letterSpacing: "0.4px",
  },
  input: {
    backgroundColor: "#141414",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#fff",
    padding: "12px",
    fontSize: "1rem",
    outline: "none",
    boxSizing: "border-box",
  },
  mensajeError: {
    color: "#ff5c5c",
    fontSize: "0.85rem",
    margin: 0,
    textAlign: "center",
  },
  btnEntrar: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#0052cc",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1.05rem",
    fontWeight: "bold",
    marginTop: "6px",
  },
};
