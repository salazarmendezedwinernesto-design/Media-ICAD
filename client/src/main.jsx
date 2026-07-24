import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Presentar from "./Presentar";

// Ruteo mínimo, sin librería de routing: la app entera es una sola pantalla
// (App.jsx), excepto "/presentar", que es pública (sin login) y pensada
// para meterse como Browser Source en OBS Studio o vMix.
const esPresentar = window.location.pathname.replace(/\/$/, "") === "/presentar";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {esPresentar ? <Presentar /> : <App />}
  </React.StrictMode>
);
