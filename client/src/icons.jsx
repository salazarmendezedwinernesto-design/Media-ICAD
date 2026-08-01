import React from "react";

/**
 * Set de iconos SVG livianos (estilo trazo/línea, sin relleno) para
 * reemplazar los emojis en toda la app. No dependen de ningún paquete
 * externo — son componentes React normales.
 *
 * Uso: <IconOjo size={18} /> o <IconOjo size={18} color="#fff" />
 */

const base = (size, color, children, strokeWidth = 2) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}
  >
    {children}
  </svg>
);

export function IconOjo({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );
}

export function IconOjoTachado({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6C3.7 8.3 1 12 1 12s4 8 11 8a10.9 10.9 0 0 0 5.4-1.44" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>,
  );
}

export function IconCandado({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
  );
}

export function IconRadio({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 16.24a6 6 0 0 1 0-8.48M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
    </>,
  );
}

export function IconFlechaIzquierda({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>,
  );
}

export function IconX({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>,
  );
}

export function IconCheck({ size = 18, color = "currentColor" }) {
  return base(size, color, <polyline points="20 6 9 17 4 12" />);
}

export function IconAlerta({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>,
  );
}

export function IconEnlace({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>,
  );
}

export function IconEmisora({ size = 18, color = "currentColor" }) {
  // Antena / torre de transmisión (reemplazo de 📡)
  return base(
    size,
    color,
    <>
      <path d="M12 2v6" />
      <path d="M8 6a4 4 0 0 1 8 0" />
      <path d="M5 9a7 7 0 0 1 14 0" />
      <path d="M12 12v10" />
      <path d="M9 22h6" />
    </>,
  );
}

export function IconMicrofono({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </>,
  );
}

export function IconMicrofonoTachado({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M5 10a7 7 0 0 0 10.53 6.05M19 10a6.98 6.98 0 0 1-.65 2.98" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>,
  );
}

export function IconAltavoz({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M18.36 5.64a9 9 0 0 1 0 12.73" />
    </>,
  );
}

export function IconPantalla({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>,
  );
}

export function IconIglesia({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M12 2v4" />
      <path d="M10 4h4" />
      <path d="M12 8 4 13v9h16v-9l-8-5Z" />
      <line x1="12" y1="12" x2="12" y2="22" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </>,
  );
}

export function IconCamara({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </>,
  );
}

export function IconEnviar({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>,
  );
}

export function IconDescarga({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>,
  );
}

export function IconSubida({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>,
  );
}

export function IconRayo({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  );
}

export function IconMano({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M6 14v-2a2 2 0 0 0-4 0v3a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8v-3a2 2 0 0 0-4 0v1" />
    </>,
  );
}

export function IconObjetivo({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>,
  );
}

export function IconLapiz({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
  );
}

export function IconComputadora({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <line x1="7" y1="21" x2="17" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>,
  );
}

export function IconAlertaTriangulo({ size = 18, color = "currentColor" }) {
  return IconAlerta({ size, color });
}

export function IconBateria({ size = 18, color = "currentColor" }) {
  return base(
    size,
    color,
    <>
      <rect x="1" y="7" width="18" height="10" rx="2" />
      <line x1="23" y1="11" x2="23" y2="13" />
      <line x1="5" y1="10" x2="5" y2="14" />
    </>,
  );
}

export function IconOndas({ size = 18, color = "currentColor" }) {
  // Wifi/live pulse (reemplazo de 🔴 "en vivo")
  return base(
    size,
    color,
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 15.5a5 5 0 0 1 0-7" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.5 18.5a9 9 0 0 1 0-13" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>,
  );
}
