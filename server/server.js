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
  // Los celulares "congelan" el JS de la pestaña (o la mandan a segundo
  // plano de verdad) cuando se bloquea la pantalla, así que unos segundos
  // sin responder al ping NO significan que la persona se fue realmente.
  // Con los valores por defecto (pingInterval 25s / pingTimeout 20s) el
  // servidor los daba de baja casi apenas se bloqueaba el teléfono. Con
  // esto le damos ~1 minuto de margen antes de considerar la conexión
  // perdida de verdad (el cliente igual reconecta e re-anuncia solo si
  // llega a caerse, ver SalaAudio.jsx).
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ===== VARIABLES =====
const PORT = process.env.PORT || 10000; // Render suele usar 10000
const APP_USER = process.env.APP_USER || "icad";
const APP_PASS = process.env.APP_PASS || "icad2024";
const MOD_PASSWORD = process.env.MOD_PASSWORD || "moderador2024";
const TOKEN_SECRET =
  process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// Clave secreta compartida con MediaMTX (tu VPS), para que nadie más
// pueda llamar a los webhooks de abajo y falsificar el estado "en vivo".
// Debe coincidir con el valor que pongas en mediamtx.yml (ver LEEME.md).
const MEDIAMTX_WEBHOOK_SECRET = process.env.MEDIAMTX_WEBHOOK_SECRET || "";

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

// ===== WEBHOOKS DE MEDIAMTX (detección automática de "en vivo") =====
// MediaMTX (en tu VPS) llama a estas 2 rutas solo por su cuenta, usando
// sus opciones "runOnReady" / "runOnNotReady" (ver mediamtx.yml en el
// LEEME.md) -- no requieren que nadie le dé clic a nada en la app.

function validarSecretoWebhook(req, res) {
  if (!MEDIAMTX_WEBHOOK_SECRET) return true; // sin secreto configurado = sin validar (solo para pruebas)
  const recibido = req.query.secreto || req.body?.secreto;
  if (recibido !== MEDIAMTX_WEBHOOK_SECRET) {
    res.status(401).json({ ok: false, error: "Secreto de webhook inválido" });
    return false;
  }
  return true;
}

// MediaMTX llama esto en cuanto OBS/vMix empieza a publicar.
app.post("/api/mediamtx/ready", (req, res) => {
  if (!validarSecretoWebhook(req, res)) return;
  transmision = { activa: true, iniciadaPor: "OBS/vMix", inicio: Date.now() };
  io.emit("transmision:estado", transmision);
  res.json({ ok: true });
});

// MediaMTX llama esto en cuanto OBS/vMix corta la transmisión.
// Se BORRA el estado por completo -- no queda nada guardado.
app.post("/api/mediamtx/not-ready", (req, res) => {
  if (!validarSecretoWebhook(req, res)) return;
  transmision = { activa: false, iniciadaPor: null, inicio: null };
  io.emit("transmision:estado", transmision);
  res.json({ ok: true });
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

// ===== TRANSMISIÓN EN VIVO (Moderador) =====
// Estado guardado SOLO en memoria (nunca en disco/DB). Si el moderador pulsa
// "Finalizar" o el servidor se reinicia, esto se borra por completo: no
// queda historial ni grabación de ninguna transmisión pasada.
let transmision = {
  activa: false,
  iniciadaPor: null,
  inicio: null,
};

// ===== ENLACE EXTERNO (YouTube / Facebook) =====
// El Moderador pega un link de YouTube o Facebook y este servidor lo
// reparte a TODOS los paneles conectados (Director, Cámara, Pastor,
// Líder, Pantalla) y también de vuelta al propio Moderador, para que
// pueda confirmar que se ve bien. Se guarda SOLO en memoria: si el
// Moderador lo quita, o el servidor se reinicia, desaparece por completo.
let enlaceExterno = {
  activo: false,
  url: null,
  publicadoPor: null,
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

// ===== PANTALLA DE RETORNO (confidence monitor / stage display) =====
// Estado guardado SOLO en memoria (igual que transmisión y enlace externo):
// si el servidor se reinicia, se borra por completo, no queda historial.
//
// El "Emisor" (operador de pantalla) controla este estado; el/los
// "Receptor" (el monitor físico en el escenario, ej. una tablet o un
// monitor conectado a una laptop) solo lo reciben y lo muestran a pantalla
// completa. Puede haber varios receptores conectados a la vez (todos
// reciben lo mismo).
//
// Nota importante: por decisión explícita, este panel NO incluye texto
// bíblico ni letras de alabanza -- solo texto libre que el operador
// escribe a mano (nota de "siguiente", mensaje personalizado, etc).
let pantallaRetorno = {
  reloj: { visible: true },
  temporizador: {
    activo: false, // si está corriendo o no
    modo: "regresiva", // "regresiva" (cuenta hacia 0) | "progresiva" (cronómetro hacia arriba)
    duracionSegundos: 300, // usado solo en modo "regresiva"
    finEpoch: null, // epoch ms en el que llega a 0 (modo regresiva, mientras activo)
    inicioEpoch: null, // epoch ms en el que arrancó (modo progresiva, mientras activo)
    restanteAlPausar: null, // segundos restantes/transcurridos guardados al pausar
    avisoSegundos: 30, // segundos antes de llegar a 0 en los que el monitor empieza a parpadear
  },
  mensaje: { texto: "", visible: false },
  nota: { texto: "" }, // etiqueta corta de "siguiente", ej. "Después: Ofrenda"
  estilo: { colorAcento: "#f59e0b", tamano: "grande" }, // apariencia del monitor, la decide el Emisor
  actualizadoPor: null,
  hora: null,
};

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

  // Y mandarles también la lista actualizada de la sala (sin esta
  // persona). Antes esto no se hacía al salir —solo al entrar— y por
  // eso el nombre se quedaba pegado en la lista de los demás para
  // siempre, aunque ya se hubiera ido.
  io.to(`audio:${sala}`).emit("audio:lista_sala", {
    sala,
    miembros: listaSala(sala),
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

  // Y el estado actual del enlace externo (YouTube/Facebook), por si el
  // Moderador ya lo había publicado antes de que este cliente entrara.
  socket.emit("enlace:estado", enlaceExterno);

  // Y el estado actual de la Pantalla de Retorno, para que un Receptor
  // que se conecta tarde (o recarga la página) vea de inmediato lo que
  // ya estaba activo, en vez de quedarse en blanco hasta el próximo cambio.
  socket.emit("retorno:estado", pantallaRetorno);

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

  // ===== ENLACE EXTERNO (YouTube / Facebook) =====

  // --- Moderador -> Todos: publica un link de YouTube o Facebook ---
  // datos: { url, tipo: "youtube"|"facebook", de }
  // El servidor no valida el link (eso ya lo hace el panel del Moderador
  // antes de mandarlo); solo lo guarda y lo reparte a todos.
  socket.on("enlace:publicar", (datos) => {
    if (!datos || !datos.url) return;
    enlaceExterno = {
      activo: true,
      url: String(datos.url).trim(),
      tipo: datos.tipo || null,
      publicadoPor: datos.de || socket.usuario || "Moderador",
      inicio: Date.now(),
    };
    io.emit("enlace:estado", enlaceExterno);
  });

  // --- Moderador -> Todos: quita el enlace publicado ---
  // Se BORRA por completo (nada queda guardado), igual que la transmisión.
  socket.on("enlace:quitar", () => {
    enlaceExterno = {
      activo: false,
      url: null,
      tipo: null,
      publicadoPor: null,
      inicio: null,
    };
    io.emit("enlace:estado", enlaceExterno);
  });

  // ===== PANTALLA DE RETORNO (confidence monitor) =====
  // El Emisor (operador) manda el estado COMPLETO que quiere mostrar; el
  // servidor lo guarda tal cual y lo reparte a todos (incluido el propio
  // Emisor, para confirmar, y a cualquier Receptor conectado).
  // datos: { reloj?, temporizador?, mensaje?, nota? } (todo opcional,
  // se combina con lo que ya había para no perder el resto del estado).
  socket.on("retorno:actualizar", (datos) => {
    if (!datos || typeof datos !== "object") return;

    pantallaRetorno = {
      ...pantallaRetorno,
      ...(datos.reloj
        ? { reloj: { ...pantallaRetorno.reloj, ...datos.reloj } }
        : {}),
      ...(datos.temporizador
        ? {
            temporizador: {
              ...pantallaRetorno.temporizador,
              ...datos.temporizador,
            },
          }
        : {}),
      ...(datos.mensaje
        ? { mensaje: { ...pantallaRetorno.mensaje, ...datos.mensaje } }
        : {}),
      ...(datos.nota
        ? { nota: { ...pantallaRetorno.nota, ...datos.nota } }
        : {}),
      ...(datos.estilo
        ? { estilo: { ...pantallaRetorno.estilo, ...datos.estilo } }
        : {}),
      actualizadoPor: datos.de || socket.usuario || "Pantalla",
      hora: Date.now(),
    };

    io.emit("retorno:estado", pantallaRetorno);
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
