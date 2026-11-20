/**
 * Genera las imágenes para compartir (Open Graph, 1200×630) en inglés y español desde una misma plantilla:
 *   src/app/opengraph-image.png      (inglés, por defecto)
 *   src/app/es/opengraph-image.png   (español)
 *
 * Necesita Playwright con Chromium y conexión (fuentes de Google Fonts). Uso, desde frontend/:
 *   PLAYWRIGHT_MODULE=/ruta/a/node_modules/playwright node scripts/og-image.mjs
 * (sin la variable intenta `import("playwright")`).
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const TEXT = {
  en: {
    out: "src/app/opengraph-image.png",
    title: ["Stop repeating ", "the same", " mistakes."],
    subtitle: "Analyze your Chess.com games with Stockfish and train the exact positions where you went wrong.",
    pill: "Free · in your browser",
  },
  es: {
    out: "src/app/es/opengraph-image.png",
    title: ["Deja de repetir ", "los mismos", " errores."],
    subtitle: "Analiza tus partidas de Chess.com con Stockfish y entrena las posiciones exactas donde fallaste.",
    pill: "Gratis · en tu navegador",
  },
};

const KNIGHT = `<svg viewBox="0 0 32 32" width="38" height="38" fill="#DDB463"><path d="M7.5 28.5h17.5v-2.6H7.5z"/><path d="M9.6 25.9c-.1-4.3 1.9-7.2 5.4-9.4l-3.4.3-3 2.3-2.9-2.5c.4-3.7 2.5-7.2 5.7-9.3l.3-3.4 2.9 2.2c5-.3 9.6 2.6 11.2 8.3 1.1 3.9.7 8-.5 11.5z"/><circle cx="13.6" cy="11.4" r="1.15" fill="#0B0F15"/></svg>`;

function board() {
  const sq = 47.5;
  let cells = "";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      cells += `<rect x="${c * sq}" y="${r * sq}" width="${sq}" height="${sq}" fill="${(r + c) % 2 ? "#a07a55" : "#e8dcc5"}"/>`;
  // Flechas: la jugada de la partida (rojo) y la del motor (verde), en coordenadas de casilla
  const arrow = (from, to, color, id) => {
    const [x1, y1, x2, y2] = [...from, ...to].map((v) => v * sq);
    return `<defs><marker id="${id}" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="${color}"/></marker></defs>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="11" stroke-linecap="round" marker-end="url(#${id})" opacity="0.92"/>`;
  };
  return `<svg width="${8 * sq}" height="${8 * sq}" viewBox="0 0 ${8 * sq} ${8 * sq}">${cells}
    ${arrow([5.5, 5.5], [3.6, 2.9], "#FB7185", "r")}
    ${arrow([2.5, 6.5], [4.55, 3.45], "#34D399", "g")}</svg>`;
}

const html = (t) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;font-family:Inter,sans-serif;color:#F3EDE2;
    background:radial-gradient(900px 500px at 0% 0%, rgba(221,180,99,.14), transparent 60%),#0B0F15}
  .left{position:absolute;left:72px;top:98px;width:600px}
  .brand{display:flex;align-items:center;gap:16px}
  .logo{width:58px;height:58px;border-radius:14px;border:1px solid rgba(201,154,69,.35);
    background:linear-gradient(180deg,rgba(221,180,99,.2),rgba(221,180,99,.05));display:flex;align-items:center;justify-content:center}
  .name{font-family:Fraunces,serif;font-weight:600;font-size:32px}
  .name span{color:#DDB463}
  h1{font-family:Fraunces,serif;font-weight:600;font-size:66px;line-height:1.08;letter-spacing:-0.5px;margin-top:38px}
  h1 em{color:#EBCB8B}
  p{margin-top:24px;font-size:24px;line-height:1.5;color:#BDB6AA;max-width:600px}
  .pill{display:inline-block;margin-top:30px;padding:9px 18px;border-radius:999px;border:1px solid rgba(201,154,69,.45);
    color:#EBCB8B;font-weight:600;font-size:18px}
  .board{position:absolute;left:736px;top:118px;padding:6px;border-radius:14px;background:#1F2733;
    box-shadow:0 30px 60px rgba(0,0,0,.45)}
  .board svg{display:block;border-radius:9px}
</style></head><body>
  <div class="left">
    <div class="brand"><div class="logo">${KNIGHT}</div><div class="name">Chess<span>Tutor</span></div></div>
    <h1>${t.title[0]}<em>${t.title[1]}</em>${t.title[2]}</h1>
    <p>${t.subtitle}</p>
    <div class="pill">${t.pill}</div>
  </div>
  <div class="board">${board()}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, t] of Object.entries(TEXT)) {
  await page.setContent(html(t), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, t.out) });
  console.log(`${lang} -> ${t.out}`);
}
await browser.close();
