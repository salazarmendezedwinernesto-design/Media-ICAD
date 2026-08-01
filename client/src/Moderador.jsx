import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { obtenerToken, borrarToken } from "./services/auth";
import { detectarEnlace } from "./EnlaceExterno";
import {
  IconFlechaIzquierda,
  IconEmisora,
  IconCandado,
  IconOndas,
  IconX,
  IconOjo,
  IconAlerta,
  IconEnlace,
} from "./Icons";

export default function Moderador({ alSalir }) {
  const [desbloqueado, setDesbloqueado] = useState(
    () => sessionStorage.getItem("mod_desbloqueado") === "1",
  );
  const [contrasena, setContrasena] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const [verificando, setVerificando] = useState(false);

  const [enlace, setEnlace] = useState({ activo: false, url: null });
  const [campoUrl, setCampoUrl] = useState("");
  const [errorUrl, setErrorUrl] = useState("");

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

    socket.on("enlace:estado", (datos) => {
      if (datos) setEnlace(datos);
    });

    return () => socket.disconnect();
  }, [desbloqueado]);

  const publicarEnlace = (e) => {
    e.preventDefault();
    setErrorUrl("");

    const info = detectarEnlace(campoUrl);
    if (!info) {
      setErrorUrl(
        "Ese link no parece de YouTube ni de Facebook. Revísalo e intenta de nuevo.",
      );
      return;
    }

    socketRef.current?.emit("enlace:publicar", {
      url: campoUrl.trim(),
      tipo: info.tipo,
      de: "Moderador",
    });
    setCampoUrl("");
  };

  const quitarEnlace = () => {
    socketRef.current?.emit("enlace:quitar");
  };

  if (!desbloqueado) {
    return (
      <div style={styles.container}>
        <header style={styles.navbar}>
          <button style={styles.btnVolver} onClick={alSalir}>
            <IconFlechaIzquierda size={16} /> Menú
          </button>
          <h1 style={styles.navTitle}>
            <IconEmisora size={18} color="#9ca3af" /> PANEL DE MODERADOR
          </h1>
          <div style={{ width: "90px" }} />
        </header>

        <section style={styles.tarjeta}>
          <span style={styles.tituloSeccion}>
            <IconCandado size={14} /> ACCESO RESTRINGIDO
          </span>
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
              <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>
                {errorClave}
              </p>
            )}
            <button
              type="submit"
              disabled={!contrasena.trim() || verificando}
              style={{
                ...styles.btnPrimario,
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

  const infoActual = enlace.activo ? detectarEnlace(enlace.url) : null;

  return (
    <div style={styles.container}>
      <header style={styles.navbar}>
        <button style={styles.btnVolver} onClick={alSalir}>
          <IconFlechaIzquierda size={16} /> Menú
        </button>
        <h1 style={styles.navTitle}>
          <IconEmisora size={18} color="#9ca3af" /> PANEL DE MODERADOR
        </h1>
        <div style={{ width: "90px" }} />
      </header>

      <section style={styles.tarjeta}>
        <span
          style={{
            ...styles.tituloSeccion,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {enlace.activo ? (
            <>
              <IconOndas size={14} color="#ef4444" /> ENLACE ACTIVO EN TODOS LOS
              PANELES
            </>
          ) : (
            "SIN ENLACE PUBLICADO"
          )}
        </span>
        <p style={styles.notaAyuda}>
          Pega aquí un link de YouTube o Facebook (una transmisión en vivo, un
          video, lo que sea) y aparecerá automáticamente en Director, Cámaras,
          Pastor, Líder y Pantalla. Cuando quieras quitarlo, desaparece solo en
          todos lados — no queda nada guardado.
          <br />
          <strong>Para Facebook:</strong> el video o transmisión en vivo tiene
          que estar configurado como <strong>Público</strong> (no "Solo
          amigos"), o el reproductor no podrá mostrarlo en ningún panel.
        </p>

        <form onSubmit={publicarEnlace} style={styles.formulario}>
          <input
            type="text"
            value={campoUrl}
            onChange={(e) => setCampoUrl(e.target.value)}
            placeholder="Pega aquí el link de YouTube o Facebook..."
            style={styles.input}
          />
          {errorUrl && (
            <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>
              {errorUrl}
            </p>
          )}
          <button
            type="submit"
            disabled={!campoUrl.trim()}
            style={{
              ...styles.btnPrimario,
              opacity: !campoUrl.trim() ? 0.4 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <IconEmisora size={16} /> Publicar en todos los paneles
          </button>
        </form>

        {enlace.activo && (
          <button
            style={{
              ...styles.btnQuitar,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            onClick={quitarEnlace}
          >
            <IconX size={16} /> Quitar enlace de todos los paneles
          </button>
        )}
      </section>

      {enlace.activo && infoActual && (
        <section style={styles.tarjeta}>
          <span
            style={{
              ...styles.tituloSeccion,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <IconOjo size={14} /> VISTA PREVIA (así lo ven todos)
          </span>
          <div style={styles.marcoPrevia}>
            <iframe
              key={infoActual.embedUrl}
              src={infoActual.embedUrl}
              title="Vista previa del enlace"
              style={styles.iframePrevia}
              frameBorder="0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <a
            href={enlace.url}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.enlaceRespaldo}
          >
            <IconEnlace size={14} /> ¿No carga? Abrir el link directo en una
            pestaña nueva
          </a>
        </section>
      )}

      {enlace.activo && !infoActual && (
        <section style={styles.tarjeta}>
          <p
            style={{
              color: "#f87171",
              fontSize: "0.85rem",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <IconAlerta size={16} /> Hay un enlace publicado pero no se pudo
            interpretar como YouTube ni Facebook. Quítalo y publica uno nuevo.
          </p>
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
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  navTitle: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#9ca3af",
    display: "flex",
    alignItems: "center",
    gap: "8px",
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
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnQuitar: {
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "0.9rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  notaAyuda: {
    fontSize: "0.75rem",
    color: "#6b7280",
    margin: 0,
    lineHeight: 1.5,
  },
  marcoPrevia: {
    borderRadius: "8px",
    overflow: "hidden",
    aspectRatio: "16 / 9",
    backgroundColor: "#000",
  },
  iframePrevia: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  enlaceRespaldo: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#60a5fa",
    fontSize: "0.78rem",
    textDecoration: "none",
  },
};
