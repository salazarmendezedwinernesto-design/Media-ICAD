# 📡 Sistema de Tally Visual y Mensajería en Tiempo Real

Sistema sin base de datos (estado 100% en memoria) para coordinar transmisiones en vivo
en entornos de alto ruido, usando WebSockets para latencia cero entre el Director y
hasta 5 cámaras conectadas desde celulares en la misma red Wi-Fi.

## 📂 Estructura

```
tally-proyecto/
├── server/          # Node.js + Express + Socket.io
│   ├── package.json
│   └── server.js
└── client/          # React + Vite
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx       (menú de selección de rol)
        ├── Director.jsx  (panel de control del operador)
        └── Camara.jsx    (pantalla del camarógrafo)
```

## 🚀 Instalación y ejecución (en VS Code)

### 1. Abre el proyecto en VS Code
Descomprime el zip y abre la carpeta `tally-proyecto` en VS Code (`File > Open Folder`).

### 2. Averigua tu IP local
Abre una terminal integrada de VS Code (`` Ctrl + ` ``) y ejecuta:

- **Windows:** `ipconfig` → busca "Dirección IPv4" en tu adaptador Wi-Fi.
- **Mac / Linux:** `ifconfig` o `ip a` → busca la IP en tu interfaz `en0` / `wlan0`.

Anota algo como `192.168.1.50`.

### 3. Configura la IP en el cliente
Edita estos dos archivos y reemplaza `CAMBIA_POR_TU_IP_LOCAL` por tu IP real:

- `client/src/Director.jsx` (línea con `const SOCKET_URL = ...`)
- `client/src/Camara.jsx` (línea con `const SOCKET_URL = ...`)

Ejemplo:
```js
const SOCKET_URL = "http://192.168.1.50:3000";
```

### 4. Instala dependencias y levanta el servidor
En una terminal:
```bash
cd server
npm install
npm start
```
Debe mostrar: `Servidor de Tally corriendo en http://0.0.0.0:3000`

### 5. Instala dependencias y levanta el cliente
Abre **otra terminal** (deja el servidor corriendo):
```bash
cd client
npm install
npm run dev -- --host
```
Vite mostrará algo como:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.50:5173/
```

### 6. Conecta los dispositivos
- **En tu PC/laptop:** abre `http://localhost:5173` y selecciona "🎛️ OPERADOR / DIRECTOR".
- **En cada celular** (conectado al mismo Wi-Fi): abre `http://192.168.1.50:5173`
  (usa la IP que mostró Vite como "Network") y selecciona la cámara correspondiente
  ("📷 CÁMARA 1", "📷 CÁMARA 2", etc.).

> ⚠️ Tanto las PCs como los celulares deben estar en la **misma red Wi-Fi**.
> Verifica también que el firewall de tu PC no esté bloqueando los puertos `3000` y `5173`.

## 🔧 Funcionamiento

- El **Director** tiene un panel con las 5 cámaras. Cada una tiene 3 botones de estado
  (🔴 EN VIVO, 🟢 PREVIO, ⚪ ESPERA) y 6 botones de alertas rápidas.
- Cada **Cámara** muestra en pantalla completa el color y estado correspondiente,
  y si llega una alerta, vibra el celular (`navigator.vibrate`) y muestra un banner
  negro con texto amarillo parpadeante.
- El celular de cada cámara usa `navigator.wakeLock` para evitar que la pantalla se
  apague durante la transmisión.
- Todo el estado vive en memoria en `server.js`: si un celular se desconecta y se
  vuelve a conectar (o entra alguien nuevo), recibe el estado actual al instante
  gracias al evento `estado_inicial`.

## 📝 Notas importantes

- **WakeLock** requiere un contexto seguro. En LAN sobre `http://` puede funcionar en
  Chrome para Android en la mayoría de los casos, pero algunos navegadores son más
  estrictos y solo lo permiten en HTTPS o `localhost`. Si falla, revisa la consola del
  navegador (no rompe la app, solo no se activará el wake lock).
- **Vibración (`navigator.vibrate`)** funciona en Chrome/Android. iOS Safari no soporta
  esta API; en iPhones el aviso será solo visual (banner parpadeante).
- Si cambias de red Wi-Fi o reinicias el router, vuelve a verificar la IP local de tu PC,
  ya que puede cambiar.
# Media-ICAD
