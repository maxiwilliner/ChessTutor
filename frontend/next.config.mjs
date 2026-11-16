/**
 * NEXT_PUBLIC_MODE=demo -> exportación estática (carpeta out/) para hosting gratuito sin servidor:
 * el análisis corre en el navegador. Sin la variable, la app usa el backend (versión completa).
 */
const demo = process.env.NEXT_PUBLIC_MODE === "demo";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(demo ? { output: "export", images: { unoptimized: true } } : {}),
};

export default nextConfig;
