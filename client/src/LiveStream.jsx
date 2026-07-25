import React, { useEffect, useRef, useState } from "react";

/**
 * Reproductor de video en vivo por WHEP (WebRTC-HTTP Egress Protocol),
 * consumido directamente desde un servidor MediaMTX. Latencia sub-segundo:
 * no hay HLS, no hay iframes, no hay servidores intermedios de terceros.
 *
 * Cómo funciona (resumen):
 *  1. El navegador crea un RTCPeerConnection y arma una oferta SDP.
 *  2. Esa oferta se manda por POST al endpoint WHEP de MediaMTX
 *     (ej. http://TU_IP:8889/live/whep).
 *  3. MediaMTX responde con su propia SDP (answer) -- se la damos al
 *     RTCPeerConnection y en cuanto llegan las pistas de audio/video,
 *     las conectamos al <video>.
 *
 * Props:
 *  - whepUrl: URL completa del endpoint WHEP (ver client/src/config.js)
 *  - alto: alto CSS del contenedor
 */
export default function LiveStream({ whepUrl, alto = "100%" }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const [estado, setEstado] = useState("conectando"); // conectando | en-vivo | error | sin-senal

  useEffect(() => {
    let cancelado = false;

    const conectar = async () => {
      if (!whepUrl) {
        setEstado("error");
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      });
      pcRef.current = pc;

      // Recibimos video y audio, no enviamos nada (el navegador es solo
      // espectador; quien "publica" es OBS/vMix directo al servidor).
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (evento) => {
        if (videoRef.current && evento.streams[0]) {
          videoRef.current.srcObject = evento.streams[0];
          setEstado("en-vivo");
        }
      };

      pc.onconnectionstatechange = () => {
        if (cancelado) return;
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          setEstado("sin-senal");
        }
      };

      try {
        const oferta = await pc.createOffer();
        await pc.setLocalDescription(oferta);

        // WHEP: se manda la oferta SDP por POST y el servidor responde
        // con su SDP de respuesta (answer).
        const respuesta = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: oferta.sdp,
        });

        if (!respuesta.ok) {
          throw new Error(`El servidor WHEP respondió ${respuesta.status}`);
        }

        const sdpRespuesta = await respuesta.text();
        if (cancelado) return;

        await pc.setRemoteDescription({ type: "answer", sdp: sdpRespuesta });
      } catch (e) {
        console.error("Error conectando por WHEP:", e);
        if (!cancelado) setEstado("error");
      }
    };

    conectar();

    return () => {
      cancelado = true;
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [whepUrl]);

  return (
    <div style={{ ...styles.contenedor, height: alto }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: estado === "en-vivo" ? "block" : "none",
        }}
      />

      {estado !== "en-vivo" && (
        <div style={styles.aviso}>
          {estado === "conectando" && "Conectando…"}
          {estado === "sin-senal" && "Sin señal por ahora."}
          {estado === "error" && "No se pudo conectar al servidor de video."}
        </div>
      )}
    </div>
  );
}

const styles = {
  contenedor: {
    width: "100%",
    backgroundColor: "#000",
    borderRadius: "10px",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  aviso: {
    color: "#9ca3af",
    fontSize: "0.85rem",
    padding: "10px",
    textAlign: "center",
  },
};
