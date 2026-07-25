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
    origin: "https://crew-nexus.web.app", // Sin barra al final
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json());

// 2. Configuración de Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "https://crew-nexus.web.app", // Coherencia con el frontend (sin barra al final)
    methods: ["GET", "POST"],
  },
});

// ===== VARIABLES =====
const PORT = process.env.PORT || 10000; // Render suele usar 10000
const APP_USER = process.env.APP_USER || "icad";
const APP_PASS = process.env.APP_PASS || "icad2024";
const MOD_PASSWORD = process.env.MOD_PASSWORD || "moderador2024";
const TOKEN_SECRET =
  process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// ===== CLOUDFLARE REALTIMEKIT (video en vivo, WebRTC, casi cero latencia) =====
// Estos 4 valores se consiguen UNA sola vez en tu cuenta de Cloudflare
// (ver LEEME.md). Sin ellos configurados en Render, el botón de video en
// vivo simplemente avisa que aún no está configurado, sin romper nada más.
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_REALTIME_APP_ID = process.env.CF_REALTIME_APP_ID;
const CF_REALTIME_MEETING_ID = process.env.CF_REALTIME_MEETING_ID;
const CF_PRESET_MODERADOR = process.env.CF_PRESET_MODERADOR || "group_call_host";
const CF_PRESET_ESPECTADOR =
  process.env.CF_PRESET_ESPECTADOR || "group_call_participant";

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

// Ruta PÚBLICA (sin token) para que la pestaña "/presentar" -- pensada para
// meterse como Browser Source en OBS Studio/vMix -- pueda consultar el
// estado de la transmisión en vivo sin necesidad de iniciar sesión.
app.get("/api/transmision", (req, res) => {
  res.json(transmision);
});

// Segunda contraseña, exclusiva del panel de Moderador. Es independiente
// del usuario/contraseña general de la app (que ya usaron para entrar).
app.post("/api/moderador-login", (req, res) => {
  const { contrasena } = req.body || {};
  if (contrasena === MOD_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });
});

// Middleware para rutas REST que requieren el token de sesión normal
// (el mismo que ya usan los sockets), mandado como "Authorization: Bearer <token>".
function requiereSesion(req, res, next) {
  const encabezado = req.headers.authorization || "";
  const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : null;
  const payload = verificarToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, error: "No autorizado" });
  }
  req.usuario = payload.usuario;
  next();
}

// Genera un "authToken" de Cloudflare RealtimeKit para PUBLICAR video/cámara
// (rol Moderador). Requiere sesión iniciada -- solo alguien que ya pasó la
// contraseña del Moderador puede pedir uno de estos.
app.post("/api/transmision/token", requiereSesion, async (req, res) => {
  const resultado = await pedirTokenRealtimeKit({
    nombre: req.body?.nombre || req.usuario,
    presetName: CF_PRESET_MODERADOR,
    idParticipante: req.usuario || "moderador",
  });
  if (!resultado.ok) return res.status(resultado.status).json(resultado);
  return res.json(resultado);
});

// Genera un "authToken" de Cloudflare RealtimeKit SOLO PARA VER (rol
// espectador, no puede publicar cámara/audio). Es una ruta pública a
// propósito: la usa "/presentar", que corre SIN login (para OBS Studio).
// El preset de espectador no permite publicar nada, así que exponerla
// no compromete la transmisión.
app.post("/api/transmision/token-espectador", async (req, res) => {
  const resultado = await pedirTokenRealtimeKit({
    nombre: req.body?.nombre || "Panel",
    presetName: CF_PRESET_ESPECTADOR,
    idParticipante: `espectador-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  if (!resultado.ok) return res.status(resultado.status).json(resultado);
  return res.json(resultado);
});

async function pedirTokenRealtimeKit({ nombre, presetName, idParticipante }) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !CF_REALTIME_APP_ID || !CF_REALTIME_MEETING_ID) {
    return {
      ok: false,
      status: 500,
      error:
        "El video en vivo todavía no está configurado en el servidor (faltan las variables CF_* en Render).",
    };
  }

  try {
    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/realtime/kit/${CF_REALTIME_APP_ID}/meetings/${CF_REALTIME_MEETING_ID}/participants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CF_API_TOKEN}`,
        },
        body: JSON.stringify({
          name: String(nombre || "Invitado").slice(0, 60),
          preset_name: presetName,
          custom_participant_id: String(idParticipante),
        }),
      }
    );

    const datos = await respuesta.json();

    // La forma exacta de la respuesta puede variar; revisamos varios
    // lugares posibles del campo del token para no quedar frágiles.
    const authToken =
      datos?.result?.token || datos?.result?.data?.token || datos?.token;

    if (!respuesta.ok || !authToken) {
      console.error("Respuesta inesperada de Cloudflare RealtimeKit:", datos);
      return { ok: false, status: 502, error: "No se pudo generar el acceso al video en vivo." };
    }

    return { ok: true, status: 200, authToken };
  } catch (error) {
    console.error("Error llamando a Cloudflare RealtimeKit:", error);
    return { ok: false, status: 502, error: "Error de conexión con Cloudflare." };
  }
}

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

// ===== TRANSMISIÓN EN VIVO (Moderador) =====
// Estado guardado SOLO en memoria (nunca en disco/DB). Si el moderador pulsa
// "Finalizar" o el servidor se reinicia, esto se borra por completo: no
// queda historial ni grabación de ninguna transmisión pasada.
let transmision = {
  activa: false,
  iniciadaPor: null,
  inicio: null,
};

// Bus general de mensajería: lo usan Director, Cámara, Líder y Pantalla
// para mandarse texto libre entre sí. Valida destinatarios y emite solo a quienes les corresponde.
function difundirMensajeBus(datos) {
  const mensaje = {
    de: datos.de || "Desconocido",
    texto: datos.texto,
    id: datos.id || Date.now(),
    destinatarios: Array.isArray(datos.destinatarios)
      ? datos.destinatarios
      : ["Todos"],
  };

  // Emitir a los receptores válidos
  const { destinatarios } = mensaje;
  const esParaTodos = destinatarios.includes("Todos");

  // Si es para Director, enviar a Director
  if (esParaTodos || destinatarios.includes("Director")) {
    io.emit("recibir_mensaje_pastor_en_director", mensaje);
  }

  // Si es para Pastor, enviar a Pastor
  if (esParaTodos || destinatarios.includes("Pastor")) {
    io.emit("recibir_mensaje_pastor", mensaje);
  }

  // Si es para Líder, enviar a Líder
  if (esParaTodos || destinatarios.includes("Lider")) {
    io.emit("recibir_mensaje_pastor", mensaje);
  }

  // Si es para Pantalla, enviar a Pantalla
  if (esParaTodos || destinatarios.includes("Pantalla")) {
    io.emit("recibir_mensaje_pastor", mensaje);
  }

  // Si incluye cámaras específicas
  const camarasDestino = destinatarios.filter((d) => d.startsWith("C"));
  if (camarasDestino.length > 0) {
    io.emit("recibir_mensaje_general", mensaje);
  }
}

// ===== SALAS DE AUDIO (Walkie-Talkie por WebRTC) =====
// Este servidor NUNCA transporta audio: solo coordina ("signaling") para
// que los navegadores establezcan conexiones WebRTC directas (P2P) entre
// sí, lo cual mantiene la latencia al mínimo posible. Disponible desde
// TODOS los paneles (Director, Cámara, Pastor, Líder, Pantalla).
//
// salasAudio[sala] = { [socketId]: { nombre, rol } }
// liveAudio[sala]  = socketId marcado "en vivo" por el Director, o null
const SALAS_DISPONIBLES = ["1", "2", "3", "4", "5"];
const salasAudio = {};
const liveAudio = {};
SALAS_DISPONIBLES.forEach((s) => {
  salasAudio[s] = {};
  liveAudio[s] = null;
});

function listaSala(sala) {
  return Object.entries(salasAudio[sala] || {}).map(([socketId, info]) => ({
    socketId,
    nombre: info.nombre,
    rol: info.rol,
  }));
}

// Saca a un socket de cualquier sala de audio en la que estuviera
// (se usa al cambiar de sala, al salir explícitamente, o al desconectar).
function salirDeSalaAudio(socket) {
  const sala = socket.data?.salaAudio;
  if (!sala || !salasAudio[sala]) return;

  delete salasAudio[sala][socket.id];
  socket.leave(`audio:${sala}`);

  // Si quien se va era el marcado "en vivo", se limpia ese estado.
  if (liveAudio[sala] === socket.id) {
    liveAudio[sala] = null;
    io.to(`audio:${sala}`).emit("audio:live_actualizado", {
      sala,
      liveSocketId: null,
    });
  }

  // Avisar a los que quedan que este participante se fue, para que
  // cierren su conexión WebRTC con él.
  io.to(`audio:${sala}`).emit("audio:participante_salio", {
    socketId: socket.id,
  });

  socket.data.salaAudio = null;
  socket.data.nombreAudio = null;
}

io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id} (usuario: ${socket.usuario})`);

  // Al conectarse, le mandamos al cliente el último estado conocido
  // de todas las cámaras, para que su interfaz se pinte correctamente.
  Object.values(estadoCamaras).forEach((estado) => {
    socket.emit("recibir_orden_camara", estado);
  });

  // También le mandamos el estado actual de la transmisión en vivo, para
  // que si ya estaba activa, la barra aparezca de inmediato sin esperar
  // al próximo evento del moderador.
  socket.emit("transmision:estado", transmision);

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

    const mensaje = {
      camaras: datos.camaras,
      mensaje: datos.mensaje || "",
      de: datos.de || "DIRECTOR",
      // Convertir número de cámaras a formato "C1", "C2", etc. para compatibilidad
      destinatarios: datos.camaras.map((cam) => `C${cam}`),
      id: Date.now(),
      hora: Date.now(),
    };

    io.emit("recibir_mensaje_general", mensaje);
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
  // Este es el "bus general" que usan Director, Cámara y Líder para
  // mandarse mensajes entre sí, filtrando por el array `destinatarios`.
  socket.on("enviar_mensaje_a_pastor", (datos) => {
    if (!datos || !datos.texto) return;
    difundirMensajeBus(datos);
  });

  // --- Pantalla -> Director / Pastor (reportes y alertas del operador) ---
  // Pantalla.jsx usa un nombre de evento propio en vez de
  // "enviar_mensaje_a_pastor", pero el resultado esperado es el mismo:
  // que Director/Pastor lo vean en su bandeja de mensajes entrantes.
  socket.on("enviar_mensaje_pantalla_desde_panel", (datos) => {
    if (!datos || !datos.texto) return;
    difundirMensajeBus(datos);
  });

  // ===== TRANSMISIÓN EN VIVO (Moderador) =====

  // --- Moderador -> Todos: activó su cámara/pantalla en la sala de video en vivo ---
  socket.on("transmision:iniciar", (datos) => {
    transmision = {
      activa: true,
      iniciadaPor: datos?.de || socket.usuario || "Moderador",
      inicio: Date.now(),
    };
    io.emit("transmision:estado", transmision);
  });

  // --- Moderador -> Todos: finalizar transmisión ---
  // No se "apaga" nada más: se BORRA el estado por completo (nada queda
  // guardado), tal como se pidió.
  socket.on("transmision:finalizar", () => {
    transmision = { activa: false, iniciadaPor: null, inicio: null };
    io.emit("transmision:estado", transmision);
  });

  // ===== EVENTOS DE SALA DE AUDIO =====

  // Unirse a una sala (1-5). Si ya estaba en otra, primero sale de esa.
  // datos: { sala: "1".."5", nombre: "Gaby", rol: "Camara 1" | "Pastor" | ... }
  socket.on("audio:unirse", (datos) => {
    if (!datos || !datos.sala || !datos.nombre) return;
    const sala = String(datos.sala);
    if (!SALAS_DISPONIBLES.includes(sala)) return;

    const nombre = String(datos.nombre).trim().slice(0, 24) || "Sin nombre";
    const rol = String(datos.rol || "Invitado")
      .trim()
      .slice(0, 30);

    // Si ya estaba en otra sala de audio (o la misma), primero se retira.
    salirDeSalaAudio(socket);

    socket.data.salaAudio = sala;
    socket.data.nombreAudio = nombre;
    socket.join(`audio:${sala}`);
    salasAudio[sala][socket.id] = { nombre, rol };

    // Avisamos a los que YA estaban en la sala que llegó alguien nuevo,
    // para que cada uno inicie una conexión WebRTC con el recién llegado.
    socket.to(`audio:${sala}`).emit("audio:nuevo_participante", {
      socketId: socket.id,
      nombre,
      rol,
    });

    // Al recién llegado le mandamos la lista completa de quienes ya
    // estaban, para que sepa con quién debe negociar conexión WebRTC.
    socket.emit("audio:estado_sala", {
      sala,
      socketId: socket.id,
      participantes: listaSala(sala).filter((m) => m.socketId !== socket.id),
      liveSocketId: liveAudio[sala],
    });

    // El resto de la sala recibe la lista actualizada (para pintar nombres).
    io.to(`audio:${sala}`).emit("audio:lista_sala", {
      sala,
      miembros: listaSala(sala),
    });
  });

  // Salir explícitamente de la sala (botón "Salir" en el panel de audio).
  socket.on("audio:salir", () => {
    salirDeSalaAudio(socket);
  });

  // --- Señalización WebRTC (relay puro; el audio nunca pasa por aquí) ---
  // datos: { paraSocketId, tipo: "oferta"|"respuesta"|"ice", payload }
  socket.on("audio:senal", (datos) => {
    if (!datos || !datos.paraSocketId || !datos.tipo) return;
    io.to(datos.paraSocketId).emit("audio:senal", {
      deSocketId: socket.id,
      tipo: datos.tipo,
      payload: datos.payload,
    });
  });

  // --- Tally de audio (verde/rojo por persona, dentro de una sala) ---
  // Control del Director: marca a UNA persona como "en vivo" dentro de
  // su sala; al marcar a otra, la anterior pasa a rojo automáticamente.
  // socketId null = nadie en vivo (todos en rojo).
  socket.on("audio:marcar_live", (datos) => {
    if (!datos || !datos.sala) return;
    const sala = String(datos.sala);
    if (!SALAS_DISPONIBLES.includes(sala)) return;

    const socketId = datos.socketId || null;
    if (socketId && !salasAudio[sala][socketId]) return; // ya no está en la sala

    liveAudio[sala] = socketId;
    io.to(`audio:${sala}`).emit("audio:live_actualizado", {
      sala,
      liveSocketId: socketId,
    });
  });

  socket.on("disconnect", (motivo) => {
    console.log(`Cliente desconectado: ${socket.id} (${motivo})`);
    salirDeSalaAudio(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
