// Persistencia del estado de la Pantalla de Retorno (estado + tiempos
// programados), para que sobreviva reinicios del servidor y se comparta
// entre todos los dispositivos.
//
// - Si defines FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio en
//   una sola línea) usa Firestore: documento "config/retorno". Es la opción
//   recomendada en Render gratis, porque su disco se borra en cada reinicio.
// - Si no, guarda en un archivo JSON local (sirve en local o con disco
//   persistente).
const fs = require("fs");
const path = require("path");

const ARCHIVO = path.join(__dirname, "datos-retorno.json");
let docFirestore = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const admin = require("firebase-admin");
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
      ),
    });
    docFirestore = admin.firestore().doc("config/retorno");
    console.log("Persistencia: Firestore activo");
  } else {
    console.log("Persistencia: archivo local (datos-retorno.json)");
  }
} catch (e) {
  console.error("No se pudo iniciar Firestore, se usa archivo local:", e.message);
  docFirestore = null;
}

async function cargar() {
  try {
    if (docFirestore) {
      const snap = await docFirestore.get();
      return snap.exists ? snap.data() : null;
    }
    if (fs.existsSync(ARCHIVO)) {
      return JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
    }
  } catch (e) {
    console.error("Error cargando datos guardados:", e.message);
  }
  return null;
}

let temporizadorGuardado = null;
let pendiente = null;

// Guarda con un pequeño retraso para no escribir en cada cambio seguido.
function guardar(datos) {
  pendiente = datos;
  if (temporizadorGuardado) return;
  temporizadorGuardado = setTimeout(async () => {
    temporizadorGuardado = null;
    const aGuardar = pendiente;
    try {
      if (docFirestore) await docFirestore.set(aGuardar);
      else fs.writeFileSync(ARCHIVO, JSON.stringify(aGuardar));
    } catch (e) {
      console.error("Error guardando datos:", e.message);
    }
  }, 500);
}

module.exports = { cargar, guardar };