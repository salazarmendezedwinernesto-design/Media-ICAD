import React from "react";
import { MEDIAMTX_WHEP_URL } from "./config";
import LiveStream from "./LiveStream";

// Pagina publica (SIN login) pensada para meterse como Browser Source en
// OBS Studio o vMix. Se conecta directo por WHEP al servidor MediaMTX,
// sin pasar por Render ni por ningun login.
export default function Presentar() {
  return (
    <div style={styles.container}>
      <LiveStream whepUrl={MEDIAMTX_WHEP_URL} alto="100vh" />
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
