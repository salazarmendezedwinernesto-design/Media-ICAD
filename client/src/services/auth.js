// Helper de autenticación compartido por toda la app.
// La sesión se guarda en sessionStorage: se borra automáticamente al cerrar
// la pestaña o el navegador, así que siempre se pide usuario y contraseña
// al volver a entrar (tal como se pidió: sin "recordar sesión").

const CLAVE_TOKEN = "icad_token";

export function guardarToken(token) {
  try {
    sessionStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Si el navegador bloquea sessionStorage (modo privado estricto, etc.)
    // simplemente no persiste; la sesión seguirá viva en memoria mientras
    // dure la pestaña actual gracias al estado de React.
  }
}

export function obtenerToken() {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function borrarToken() {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // no-op
  }
}
