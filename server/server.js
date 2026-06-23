const express = require("express");
const crypto = require("crypto");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express(); // <-- Línea corregida aquí
app.use(express.json());

const httpServer = createServer(app);

// Configuración de Socket.io con CORS abierto para entornos locales y producción
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// ===== AUTENTICACIÓN =====
// Usuario y contraseña se leen de variables de entorno. Si no están definidas,
// se usan valores por defecto SOLO para desarrollo local (cámbialos en producción
// configurando APP_USER y APP_PASS en el panel de tu hosting).
const APP_USER = process.env.APP_USER || "icad";
const APP_PASS = process.env.APP_PASS || "icad2024";

// Secreto para firmar tokens de sesión. En producción, define TOKEN_SECRET
// como variable de entorno; si no, se genera uno aleatorio al iniciar
// (las sesiones se invalidan cada vez que el servidor se reinicia).
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

function firmarToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  return `${data}.${firma}`;
}

function verificarToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [data, firma] = token.split(".");
  const firmaEsperada = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  if (firma !== firmaEsperada) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    // Token válido por 12 horas desde su emisión
    if (Date.now() - payload.emitido > 12 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

// Endpoint de login: valida usuario/contraseña y devuelve un token de sesión
app.post("/api/login", (req, res) => {
  const { usuario, contrasena } = req.body || {};

  if (usuario === APP_USER && contrasena === APP_PASS) {
    const token = firmarToken({ usuario, emitido: Date.now() });
    return res.json({ ok: true, token });
  }

  return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
});


// Estado en memoria de las cámaras
const estadoCamaras = {
  1: { camara: 1, estado: "standby", mensaje: "", de: "DIRECTOR" },
  2: { camara: 2, estado: "standby", mensaje: "", de: "DIRECTOR" },
  3: { camara: 3, estado: "standby", mensaje: "", de: "DIRECTOR" },
  4: { camara: 4, estado: "standby", mensaje: "", de: "DIRECTOR" },
  5: { camara: 5, estado: "standby", mensaje: "", de: "DIRECTOR" },
  6: { camara: 6, estado: "standby", mensaje: "", de: "DIRECTOR" },
};

// Estado en memoria de los mensajes que cada cámara le manda al director/líder
const mensajesCamaras = {
  1: { camara: 1, texto: "", hora: null, de: "" },
  2: { camara: 2, texto: "", hora: null, de: "" },
  3: { camara: 3, texto: "", hora: null, de: "" },
  4: { camara: 4, texto: "", hora: null, de: "" },
  5: { camara: 5, texto: "", hora: null, de: "" },
  6: { camara: 6, texto: "", hora: null, de: "" },
};

// Almacenamiento en memoria para los últimos mensajes interconectados
let ultimosMensajesPastor = [];

// Exigir token de sesión válido para poder conectarse por Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (verificarToken(token)) {
    return next();
  }
  next(new Error("No autorizado"));
});

io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // Enviar estados iniciales al conectar
  Object.values(estadoCamaras).forEach((orden) => {
    socket.emit("recibir_orden_camara", orden);
  });

  Object.values(mensajesCamaras).forEach((msg) => {
    if (msg.texto) socket.emit("recibir_mensaje_camara", msg);
  });

  ultimosMensajesPastor.forEach((msgPastor) => {
    socket.emit("recibir_mensaje_pastor_en_director", msgPastor);
  });

  // Escuchar órdenes del director o líder (Individuales o botones rápidos de Tally)
  socket.on("enviar_orden_director", (datos) => {
    const { camara, estado, mensaje, de } = datos;
    if (!camara || !estadoCamaras[camara]) return;

    if (estado === "live") {
      Object.values(estadoCamaras).forEach((orden) => {
        if (orden.camara !== Number(camara) && orden.estado === "live") {
          estadoCamaras[orden.camara] = { ...orden, estado: "standby" };
          io.emit("recibir_orden_camara", estadoCamaras[orden.camara]);
        }
      });
    }

    estadoCamaras[camara] = {
      camara: Number(camara),
      estado: estado,
      mensaje: mensaje || "",
      de: de || "DIRECTOR",
    };

    io.emit("recibir_orden_camara", estadoCamaras[camara]);
  });

  // Mensaje general del director a múltiples cámaras
  socket.on("enviar_mensaje_general", (datos) => {
    const { camaras, mensaje, de } = datos;
    if (!camaras || !Array.isArray(camaras)) return;

    camaras.forEach((num) => {
      if (estadoCamaras[num]) {
        estadoCamaras[num].mensaje = mensaje;
        estadoCamaras[num].de = de || "DIRECTOR";
        io.emit("recibir_orden_camara", estadoCamaras[num]);
      }
    });
  });

  // Escuchar mensajes provenientes de los Operadores de Cámara
  socket.on("enviar_mensaje_camara", (datos) => {
    const { camara, texto, destino } = datos; // destino puede ser 'Director', 'Lider' o 'Todos'
    if (!camara) return;

    const horaActual = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    mensajesCamaras[camara] = {
      camara: Number(camara),
      texto: texto,
      hora: horaActual,
      destino: destino || "Todos",
    };

    io.emit("recibir_mensaje_camara", mensajesCamaras[camara]);
  });

  // Canal interconectado para Pastor, Director, Líder y Pantalla
  socket.on("enviar_mensaje_a_pastor", (datos) => {
    const { de, texto, destinatarios, id } = datos;

    // No se acepta ni reenvía nada si no viene un destinatario explícito.
    if (!Array.isArray(destinatarios) || destinatarios.length === 0) return;

    const paquete = {
      id: id || Date.now(),
      de: de,
      texto: texto,
      destinatarios: destinatarios,
    };

    // Almacenar en caché para reconexiones si va para Director o Pastor
    if (
      destinatarios.includes("Director") ||
      destinatarios.includes("Pastor") ||
      destinatarios.includes("Todos")
    ) {
      ultimosMensajesPastor.push(paquete);
      if (ultimosMensajesPastor.length > 30) ultimosMensajesPastor.shift();
    }

    // Reemitir globalmente; los paneles filtrarán de acuerdo a su rol
    io.emit("recibir_mensaje_pastor_en_director", paquete);
    io.emit("recibir_mensaje_pastor", paquete);
  });

  // Mensajes desde el panel de Pantalla
  socket.on("enviar_mensaje_pantalla_desde_panel", (datos) => {
    const { de, destinatarios, texto } = datos;

    // No se acepta ni reenvía nada si no viene un destinatario explícito.
    if (!Array.isArray(destinatarios) || destinatarios.length === 0) return;

    const idMensaje = Date.now();

    const bulto = {
      id: idMensaje,
      texto: `[De Pantalla]: ${texto}`,
      de: de || "Pantalla",
      destinatarios: destinatarios,
    };

    io.emit("recibir_mensaje_pastor", bulto);
    io.emit("recibir_mensaje_pastor_en_director", bulto);
  });

  socket.on("disconnect", () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor unificado corriendo en http://localhost:${PORT}`);
});
