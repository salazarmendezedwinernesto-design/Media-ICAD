require("dotenv").config(); // Carga las variables del .env al principio
const express = require("express");
const crypto = require("crypto");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.json());

const httpServer = createServer(app);

// Configuración de Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "*", // En producción, cambia esto por la URL de tu frontend
    methods: ["GET", "POST"],
  },
});

// ===== VARIABLES DE ENTORNO =====
const PORT = process.env.PORT || 3000;
const APP_USER = process.env.APP_USER || "icad";
const APP_PASS = process.env.APP_PASS || "icad2024";
const TOKEN_SECRET =
  process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// ===== AUTENTICACIÓN =====
function firmarToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${firma}`;
}

function verificarToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [data, firma] = token.split(".");
  const firmaEsperada = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(data)
    .digest("base64url");
  if (firma !== firmaEsperada) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (Date.now() - payload.emitido > 12 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

app.post("/api/login", (req, res) => {
  const { usuario, contrasena } = req.body || {};
  if (usuario === APP_USER && contrasena === APP_PASS) {
    const token = firmarToken({ usuario, emitido: Date.now() });
    return res.json({ ok: true, token });
  }
  return res
    .status(401)
    .json({ ok: false, error: "Usuario o contraseña incorrectos" });
});

// ... (El resto de tu lógica de sockets se mantiene igual)

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
