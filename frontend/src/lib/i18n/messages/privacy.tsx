/** Página de privacidad. */
import type { ReactNode } from "react";
import type { Rich } from "./common";

const en = {
  title: "Privacy and data",
  subtitle: "A clear summary, no fine print.",
  dataTitle: "What data we use",
  dataText: (b: Rich) => (
    <>
      Only the Chess.com username you type and your {b("public games")}, which we download from Chess.com&apos;s public API (moves,
      clock times, openings and results). We don&apos;t ask for your email, password or any other personal data.
    </>
  ),
  whereTitle: "Where it's stored",
  whereDemo: (b: Rich) => (
    <>
      In this demo there is {b("no server and no accounts")}. The analysis runs in your own browser and the result (diagnosis,
      exercises and your progress) is stored only in this browser&apos;s local storage (IndexedDB). It never leaves your device and we
      can&apos;t see it.
    </>
  ),
  whereDemoApi: (code: Rich) => (
    <>
      Your browser talks directly to {code("api.chess.com")} to download your games, and to Chess.com&apos;s image server to show your
      avatar.
    </>
  ),
  whereFull:
    "The analysis runs on our server. We store the exercises generated from your mistakes and your review progress, linked to your Chess.com username, so you can pick up where you left off.",
  cookiesTitle: "Cookies and statistics",
  cookiesText:
    "We don't use tracking or advertising cookies. We may count visits in an aggregated, anonymous way with Cloudflare Web Analytics, which uses no cookies and doesn't identify people.",
  errorsText:
    "If something fails (for example, the engine doesn't start in your browser), we may receive an anonymous technical report through Sentry with the error, the browser and the device's number of cores. We remove usernames before sending it; it doesn't include your games, cookies or IP address.",
  deleteTitle: "How to delete your data",
  deleteDemo:
    "Use “Delete my data from this browser” at the bottom of any page, or clear the site's data in your browser settings. You can export it first as JSON.",
  deleteFull: "Write to us and we'll delete the exercises and progress linked to your username.",
  thirdTitle: "Third parties and licenses",
  thirdText: (stockfish: ReactNode, extra: ReactNode) => (
    <>
      ChessTutor is not affiliated with or endorsed by Chess.com. The analysis uses the {stockfish} engine, free software under the
      GPL-3.0 license{extra}.
    </>
  ),
  licenseText: "license text",
  sourceCode: "source code",
  contactTitle: "Contact",
  contactText: (link: ReactNode) => <>Questions or suggestions: {link}.</>,
  feedbackForm: "feedback form",
};

const es: typeof en = {
  title: "Privacidad y datos",
  subtitle: "Resumen claro, sin letra pequeña.",
  dataTitle: "Qué datos usamos",
  dataText: (b: Rich) => (
    <>
      Solo el nombre de usuario de Chess.com que escribes y tus {b("partidas públicas")}, que descargamos de la API pública de Chess.com
      (jugadas, tiempos del reloj, aperturas y resultados). No pedimos email, contraseña ni ningún otro dato personal.
    </>
  ),
  whereTitle: "Dónde se guardan",
  whereDemo: (b: Rich) => (
    <>
      En esta demo {b("no hay servidor ni cuentas")}. El análisis se hace en tu propio navegador y el resultado (diagnóstico, ejercicios
      y tu progreso) se guarda únicamente en el almacenamiento local de este navegador (IndexedDB). No sale de tu equipo y nosotros no
      podemos verlo.
    </>
  ),
  whereDemoApi: (code: Rich) => (
    <>
      Tu navegador habla directamente con {code("api.chess.com")} para descargar las partidas y con el servidor de imágenes de Chess.com
      para mostrar tu avatar.
    </>
  ),
  whereFull:
    "El análisis se hace en nuestro servidor. Guardamos los ejercicios generados a partir de tus errores y tu progreso de repaso, asociados a tu nombre de usuario de Chess.com, para que puedas continuar entre visitas.",
  cookiesTitle: "Cookies y estadísticas",
  cookiesText:
    "No usamos cookies de seguimiento ni publicidad. Podemos medir visitas de forma agregada y anónima con Cloudflare Web Analytics, que no usa cookies ni identifica a personas.",
  errorsText:
    "Si algo falla (por ejemplo, el motor no arranca en tu navegador), podemos recibir un informe técnico anónimo con el error, el navegador y el número de núcleos del dispositivo, a través de Sentry. Antes de enviarlo borramos los nombres de usuario; no incluye tus partidas, cookies ni tu dirección IP.",
  deleteTitle: "Cómo borrar tus datos",
  deleteDemo:
    "Usa «Borrar mis datos de este navegador» al pie de cualquier página, o borra los datos del sitio desde la configuración de tu navegador. También puedes exportarlos antes en formato JSON.",
  deleteFull: "Escríbenos y eliminaremos los ejercicios y el progreso asociados a tu usuario.",
  thirdTitle: "Terceros y licencias",
  thirdText: (stockfish: ReactNode, extra: ReactNode) => (
    <>
      ChessTutor no está afiliado ni respaldado por Chess.com. El análisis usa el motor {stockfish}, software libre bajo licencia
      GPL-3.0{extra}.
    </>
  ),
  licenseText: "texto de la licencia",
  sourceCode: "código fuente",
  contactTitle: "Contacto",
  contactText: (link: ReactNode) => <>Dudas o sugerencias: {link}.</>,
  feedbackForm: "formulario de opinión",
};

const privacy = { en, es };
export default privacy;
