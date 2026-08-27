import logoAD from "./logos/logoAD.png";
import logoEDC from "./logos/EDC.png";
import logoCMF from "./logos/CMF.png";
import logoEscuela from "./logos/Escuela.png";
import logoExploradores from "./logos/Exploradores.png";
import logoFraternidad from "./logos/Fraternidad.png";
import logoIglesia from "./logos/Iglesia.png";
import logoMisioneritas from "./logos/Misioneritas.png";

export const LOGOS = [
  {
    id: "asambleas-de-dios",
    nombre: "Asambleas de Dios",
    imagen: logoAD,
  },
  {
    id: "edc",
    nombre: "Embajadores de Cristo",
    imagen: logoEDC,
  },
  {
    id: "cmf",
    nombre: "Concilio Misionero Femenil",
    imagen: logoCMF,
  },
  {
    id: "escuela",
    nombre: "Escuela Bliblica Dominical",
    imagen: logoEscuela,
  },
  {
    id: "exploradores",
    nombre: "Exploradores Del Rey",
    imagen: logoExploradores,
  },
  {
    id: "fraternidad",
    nombre: "Fraternidad de Varones",
    imagen: logoFraternidad,
  },
  {
    id: "iglesia",
    nombre: "Iglesia Canaán",
    imagen: logoIglesia,
  },
  {
    id: "misioneritas",
    nombre: "Misioneritas",
    imagen: logoMisioneritas,
  },
];

export const LOGO_POR_DEFECTO = LOGOS[0];

export function buscarLogo(id) {
  return LOGOS.find((logo) => logo.id === id) || LOGO_POR_DEFECTO;
}
