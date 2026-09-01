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
import {
  IconEmisora,
  IconPersona,
  IconGrupo,
  IconCamara,
  IconPantalla,
  IconFlechaDerecha,
  IconFlechaIzquierda,
} from "./icons";
import { obtenerToken, borrarToken } from "./services/auth";

// Fondo geométrico oscuro con acento rojo — el mismo lenguaje visual del
// login, para que el menú se sienta parte del mismo sistema. Se estira a
// cualquier tamaño de pantalla gracias a preserveAspectRatio="xMidYMid slice".
function FondoCrew() {
  return (
    <svg
      viewBox="0 0 800 560"
      preserveAspectRatio="xMidYMid slice"
      style={estilos.fondoSvg}
      aria-hidden="true"
    >
      <rect width="800" height="560" fill="#0a0a0a" />
      <polygon points="0,0 340,0 120,560 0,560" fill="#131313" />
      <polygon points="800,560 460,560 680,0 800,0" fill="#131313" />
      <polygon points="800,560 620,560 800,280" fill="#E11D2E" opacity="0.85" />
      <polygon points="0,0 180,0 0,220" fill="#E11D2E" opacity="0.12" />
    </svg>
  );
}

// Una fila del menú: ícono a la izquierda, texto, flecha a la derecha.
function FilaMenu({ icono, texto, onClick }) {
  return (
    <button style={estilos.filaMenu} onClick={onClick}>
      <span style={estilos.filaIcono}>{icono}</span>
      <span style={estilos.filaTexto}>{texto}</span>
      <span style={estilos.filaFlecha}>
        <IconFlechaDerecha size={16} color="#555" />
      </span>
    </button>
  );
}

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
      <div style={estilos.container}>
        <FondoCrew />
        <div style={estilos.contenido}>
          <div style={estilos.encabezado}>
            <div style={estilos.logoLockup}>
              <IconCamara size={16} color="#fff" />
              <span style={estilos.logoTexto}>crew</span>
              <span style={estilos.logoIcad}>ICAD</span>
            </div>
            <p style={estilos.subtitulo}>Elige qué panel quieres usar</p>
          </div>

          <div style={estilos.listaMenu}>
            <FilaMenu
              icono={<IconEmisora size={18} color="#E11D2E" />}
              texto="Comunicación de pantalla"
              onClick={() => setSubPantalla("comunicacion")}
            />
            <FilaMenu
              icono={<IconPantalla size={18} color="#E11D2E" />}
              texto="Pantalla de retorno"
              onClick={() => setSubPantalla("retorno")}
            />
          </div>

          <button style={estilos.btnVolver} onClick={resetMenu}>
            <IconFlechaIzquierda size={14} color="rgba(255,255,255,0.5)" />
            <span>Volver al menú principal</span>
          </button>
        </div>
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
    <div style={estilos.container}>
      <FondoCrew />
      <div style={estilos.contenido}>
        <div style={estilos.encabezado}>
          <div style={estilos.logoLockup}>
            <IconCamara size={16} color="#fff" />
            <span style={estilos.logoTexto}>crew</span>
            <span style={estilos.logoIcad}>ICAD</span>
          </div>
          <p style={estilos.subtitulo}>Selecciona tu rol</p>
        </div>

        <div style={estilos.listaMenu}>
          <FilaMenu
            icono={<IconPersona size={18} color="#E11D2E" />}
            texto="Panel del pastor"
            onClick={() => setRol("pastor")}
          />
          <FilaMenu
            icono={<IconGrupo size={18} color="#E11D2E" />}
            texto="Panel de líder"
            onClick={() => setRol("lider")}
          />
          <FilaMenu
            icono={<IconCamara size={18} color="#E11D2E" />}
            texto="Operador / director"
            onClick={() => setRol("director")}
          />
          <FilaMenu
            icono={<IconPantalla size={18} color="#E11D2E" />}
            texto="Operador de pantalla"
            onClick={() => setRol("pantalla")}
          />
          <FilaMenu
            icono={<IconEmisora size={18} color="#E11D2E" />}
            texto="Panel de moderador"
            onClick={() => setRol("moderador")}
          />
        </div>

        <p style={estilos.etiquetaCamaras}>CÁMARAS</p>
        <div style={estilos.gridCamaras}>
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <button
              key={num}
              style={estilos.btnCamara}
              onClick={() => {
                setNumCamara(num);
                setRol("camara");
              }}
            >
              {num}
            </button>
          ))}
        </div>

        <button style={estilos.btnCerrarSesion} onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

const estilos = {
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
  contenido: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: "380px",
    padding: "2rem 1.5rem",
    boxSizing: "border-box",
  },
  encabezado: { textAlign: "center", marginBottom: "24px" },
  logoLockup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    marginBottom: "8px",
  },
  logoTexto: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#fff",
    letterSpacing: "0.5px",
  },
  logoIcad: { fontSize: "9px", fontWeight: 500, color: "#E11D2E" },
  subtitulo: { fontSize: "12px", color: "#9a9a9a", margin: 0 },
  listaMenu: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "20px",
  },
  filaMenu: {
    background: "rgba(20,20,20,0.85)",
    borderLeft: "3px solid #E11D2E",
    borderTop: "none",
    borderRight: "none",
    borderBottom: "none",
    borderRadius: "0 8px 8px 0",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  filaIcono: { display: "flex", alignItems: "center" },
  filaTexto: {
    fontSize: "13px",
    color: "#fff",
    fontWeight: 500,
    textAlign: "left",
    flex: 1,
  },
  filaFlecha: { display: "flex", alignItems: "center" },
  etiquetaCamaras: {
    fontSize: "10px",
    color: "#666",
    margin: "0 0 8px 0",
    letterSpacing: "0.5px",
    textAlign: "center",
  },
  gridCamaras: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "6px",
    marginBottom: "20px",
  },
  btnCamara: {
    background: "rgba(20,20,20,0.85)",
    border: "none",
    borderRadius: "6px",
    padding: "10px 2px",
    color: "#ccc",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  btnCerrarSesion: {
    display: "block",
    margin: "0 auto",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: "11px",
    cursor: "pointer",
    padding: "6px",
  },
  btnVolver: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    width: "100%",
    background: "none",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "8px",
    color: "rgba(255,255,255,0.6)",
    fontSize: "12px",
    padding: "10px",
    cursor: "pointer",
    boxSizing: "border-box",
  },
};