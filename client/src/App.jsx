import React, { useState } from "react";
import Director from "./Director";
import Camara from "./Camara";
import Pastor from "./Pastor";
import Pantalla from "./Pantalla";
import PantallaRetorno from "./PantallaRetorno";
import Lider from "./Lider"; // Importamos el nuevo panel de líder
import Moderador from "./Moderador";
import Login from "./Login";
import EnlaceExterno from "./EnlaceExterno";
import { IconEmisora } from "./Icons";
import { obtenerToken, borrarToken } from "./services/auth";

export default function App() {
  const [autenticado, setAutenticado] = useState(() => !!obtenerToken());
  const [rol, setRol] = useState(null); // 'director' | 'camara' | 'pastor' | 'pantalla' | 'lider' | null
  const [numCamara, setNumCamara] = useState(null);
  // Submenú exclusivo del rol "pantalla": elegir entre el panel de
  // Comunicación (el de siempre, Pantalla.jsx) o el nuevo panel de
  // Pantalla de Retorno (confidence monitor para el escenario).
  const [subPantalla, setSubPantalla] = useState(null); // null | 'comunicacion' | 'retorno'

  const resetMenu = () => {
    setRol(null);
    setNumCamara(null);
    setSubPantalla(null);
  };

  if (!autenticado) {
    return <Login alIniciarSesion={() => setAutenticado(true)} />;
  }

  if (rol === "director") {
    return <Director alSalir={resetMenu} />;
  }

  if (rol === "camara" && numCamara) {
    return <Camara numero={numCamara} alSalir={resetMenu} />;
  }

  if (rol === "pastor") {
    return <Pastor alSalir={resetMenu} />;
  }

  if (rol === "pantalla") {
    if (subPantalla === "comunicacion") {
      return <Pantalla alSalir={() => setSubPantalla(null)} />;
    }
    if (subPantalla === "retorno") {
      return <PantallaRetorno alSalir={() => setSubPantalla(null)} />;
    }
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>OPERADOR DE PANTALLA</h1>
          <p style={styles.subtitle}>Elige qué panel quieres usar</p>
        </header>
        <main style={styles.menuBox}>
          <button
            style={{ ...styles.btnDirector, backgroundColor: "#2e7d32" }}
            onClick={() => setSubPantalla("comunicacion")}
          >
            💬 COMUNICACIÓN DE PANTALLA
          </button>
          <button
            style={{
              ...styles.btnDirector,
              backgroundColor: "#0891b2",
              marginTop: "10px",
            }}
            onClick={() => setSubPantalla("retorno")}
          >
            🖥️ PANTALLA DE RETORNO
          </button>
          <button
            style={{
              ...styles.btnCerrarSesion,
              width: "100%",
              marginTop: "20px",
              textAlign: "center",
            }}
            onClick={resetMenu}
          >
            ⬅️ Volver al menú principal
          </button>
        </main>
      </div>
    );
  }

  if (rol === "lider") {
    return (
      <>
        <EnlaceExterno />
        <Lider alSalir={resetMenu} />
      </>
    );
  }

  if (rol === "moderador") {
    return <Moderador alSalir={resetMenu} />;
  }

  const cerrarSesion = () => {
    borrarToken();
    setAutenticado(false);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>COMUNICACIÓN MM ICAD</h1>
        <p style={styles.subtitle}>
          Sistema de comunicación visual de latencia cero para entornos ruidosos
        </p>
        <button style={styles.btnCerrarSesion} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <main style={styles.menuBox}>
        <h2 style={styles.menuTitle}>Selecciona tu Rol</h2>

        <button
          style={{ ...styles.btnDirector, backgroundColor: "#7b1fa2" }}
          onClick={() => setRol("pastor")}
        >
          PANEL DEL PASTOR
        </button>

        <button
          style={{
            ...styles.btnDirector,
            backgroundColor: "#e67e22",
            marginTop: "10px",
          }}
          onClick={() => setRol("lider")}
        >
          PANEL DE LÍDER
        </button>

        <button
          style={{ ...styles.btnDirector, marginTop: "10px" }}
          onClick={() => setRol("director")}
        >
          OPERADOR / DIRECTOR
        </button>

        <button
          style={{
            ...styles.btnDirector,
            backgroundColor: "#2e7d32",
            marginTop: "10px",
          }}
          onClick={() => setRol("pantalla")}
        >
          OPERADOR DE PANTALLA
        </button>

        <button
          style={{
            ...styles.btnDirector,
            backgroundColor: "#dc2626",
            marginTop: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onClick={() => setRol("moderador")}
        >
          <IconEmisora size={18} color="#fff" />
          PANEL DE MODERADOR
        </button>

        <div
          style={{
            marginTop: "25px",
            borderTop: "1px solid #333",
            paddingTop: "20px",
          }}
        >
          <p
            style={{
              ...styles.subtitle,
              marginBottom: "12px",
              textAlign: "center",
            }}
          >
            Paneles de Operadores de Cámara:
          </p>
          <div style={styles.gridCamaras}>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                style={styles.btnCamara}
                onClick={() => {
                  setNumCamara(num);
                  setRol("camara");
                }}
              >
                CAM {num}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#0a0a0a",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
  },
  header: { textAlign: "center", marginBottom: "30px" },
  title: {
    fontSize: "2rem",
    fontWeight: "900",
    color: "#ffffff",
    margin: "0 0 10px 0",
  },
  subtitle: { fontSize: "1rem", color: "#888", margin: 0 },
  btnCerrarSesion: {
    marginTop: "14px",
    backgroundColor: "transparent",
    color: "#888",
    border: "1px solid #333",
    borderRadius: "6px",
    padding: "6px 14px",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  menuBox: {
    backgroundColor: "#1e1e1e",
    borderRadius: "12px",
    padding: "30px",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    boxSizing: "border-box",
  },
  menuTitle: {
    fontSize: "1.25rem",
    textAlign: "center",
    marginBottom: "20px",
    color: "#eee",
  },
  btnDirector: {
    width: "100%",
    padding: "18px",
    backgroundColor: "#0052cc",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1.1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  gridCamaras: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "10px",
  },
  btnCamara: {
    padding: "15px 5px",
    backgroundColor: "#333",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: "6px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
