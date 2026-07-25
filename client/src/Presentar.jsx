import React from "react";
import SalaVideoEnVivo from "./SalaVideoEnVivo";

// Página pública (SIN login) pensada para meterse como Browser Source en
// OBS Studio o vMix. Se conecta directo a la sala de video en vivo como
// espectador (WebRTC, casi cero latencia) usando el token público que
// solo permite ver, nunca publicar.
export default function Presentar() {
  return (
    <div style={styles.container}>
      <SalaVideoEnVivo modo="espectador" nombre="Presentar" alto="100vh" />
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#000",
    width: "100vw",
    height: "100vh",
    margin: 0,
    overflow: "hidden",
  },
};
