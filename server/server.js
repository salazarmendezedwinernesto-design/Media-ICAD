const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const httpServer = createServer(app);

// 1. Configuración de CORS única y correcta
app.use(
  cors({
    origin: "https://nexus-appweb.vercel.app", // Sin barra al final
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json());

// 2. Configuración de Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "https://nexus-appweb.vercel.app", // Coherencia con el frontend
    methods: ["GET", "POST"],
  },
});

// ===== VARIABLES =====
const PORT = process.env.PORT || 10000; // Render suele usar 10000
const APP_USER = process.env.APP_USER || "icad";
const APP_PASS = process.env.APP_PASS || "icad2024";
const TOKEN_SECRET =
  process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// ===== RUTAS =====
app.post("/api/login", (req, res) => {
  const { usuario, contrasena } = req.body || {};
  if (usuario === APP_USER && contrasena === APP_PASS) {
    const token = firmarToken({ usuario, emitido: Date.now() });
    return res.json({ ok: true, token });
  }
  return res.status(401).json({ ok: false, error: "Credenciales incorrectas" });
});

// Ruta simple de salud, útil para comprobar que el servicio está despierto
// (Render "duerme" los servicios free tras inactividad).
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hora: Date.now() });
});

// ===== FUNCIONES AUXILIARES =====
function firmarToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${firma}`;
}

function verificarToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [data, firma] = token.split(".");
  const firmaEsperada = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(data)
    .digest("base64url");

  // Comparación segura contra timing attacks
  const bufA = Buffer.from(firma);
  const bufB = Buffer.from(firmaEsperada);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ===== MIDDLEWARE DE AUTENTICACIÓN PARA SOCKET.IO =====
// Cada cliente manda { auth: { token } } al conectar (lo vimos en
// Director.jsx, Camara.jsx, Lider.jsx, Pastor.jsx, Pantalla.jsx).
// Sin este bloque, el servidor nunca validaba el token y la conexión
// se aceptaba siempre sin chequeo real.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = verificarToken(token);

  if (!payload) {
    return next(new Error("No autorizado"));
  }

  socket.usuario = payload.usuario;
  next();
});

// ===== LÓGICA DE TIEMPO REAL (lo que faltaba) =====
// Mantenemos en memoria el último estado de cada cámara, así un cliente
// que se conecta tarde (p.ej. recarga la página) puede recibir el estado
// actual en vez de quedarse "en blanco" hasta la próxima orden.
const estadoCamaras = {};

io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id} (usuario: ${socket.usuario})`);

  // Al conectarse, le mandamos al cliente el último estado conocido
  // de todas las cámaras, por si necesita "pintar" su pantalla de entrada.
  socket.emit("estado_inicial_camaras", estadoCamaras);

  // --- Director -> Cámara individual (tally: live/preview/standby + mensaje) ---
  socket.on("enviar_orden_director", (datos) => {
    if (!datos || datos.camara === undefined) return;

    const payload = {
      camara: datos.camara,
      estado: datos.estado || "standby",
      mensaje: datos.mensaje || "",
      de: datos.de || "DIRECTOR",
    };

    estadoCamaras[payload.camara] = payload;

    // Broadcast a TODOS los clientes conectados (Cámaras, Director, Líder,
    // Pastor...). Cada cliente filtra si el mensaje es para él comparando
    // el número de cámara.
    io.emit("recibir_orden_camara", payload);
  });

  // --- Director -> una o varias cámaras (mensaje de texto general) ---
  socket.on("enviar_mensaje_general", (datos) => {
    if (!datos || !Array.isArray(datos.camaras)) return;

    io.emit("recibir_mensaje_general", {
      camaras: datos.camaras,
      mensaje: datos.mensaje || "",
      hora: Date.now(),
    });
  });

  // --- Cámara -> Director / Líder / Pastor (mensaje de texto + estado rápido) ---
  socket.on("enviar_mensaje_camara", (datos) => {
    if (!datos || datos.camara === undefined) return;

    io.emit("recibir_mensaje_camara", {
      camara: datos.camara,
      texto: datos.texto || "",
      destino: datos.destino || "Director",
      hora: Date.now(),
    });
  });

  // --- Cualquier rol -> Pastor / Líder / Pantalla / Director / Todos ---
  // Este es el "bus general" que usan Director, Cámara, Líder y Pastor para
  // mandarse mensajes entre sí, filtrando por el array `destinatarios`.
  socket.on("enviar_mensaje_a_pastor", (datos) => {
    if (!datos || !datos.texto) return;

    const mensaje = {
      de: datos.de || "Desconocido",
      texto: datos.texto,
      id: datos.id || Date.now(),
      destinatarios: Array.isArray(datos.destinatarios)
        ? datos.destinatarios
        : ["Todos"],
    };

    // Lo mandamos con los 3 nombres de evento que los distintos roles
    // están escuchando, así no hay que tocar el código del cliente.
    io.emit("recibir_mensaje_pastor", mensaje);
    io.emit("recibir_mensaje_pastor_en_director", mensaje);
    io.emit("recibir_mensaje_general", mensaje);
  });

  socket.on("disconnect", (motivo) => {
    console.log(`Cliente desconectado: ${socket.id} (${motivo})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
